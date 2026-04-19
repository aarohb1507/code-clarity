const express = require('express');
const path = require('path');
require('dotenv').config({ quiet: true });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function buildPrompt(code, language = 'unknown') {
  return [
    'You are a calm senior developer mentor helping reduce developer anxiety.',
    'Explain the code clearly with technical accuracy and minimal jargon.',
    'Use simple, direct language. Avoid buzzwords and complex metaphors.',
    'Return STRICT JSON only with this shape:',
    '{',
    '  "job_of_code": "string",',
    '  "key_breakdown": ["string"],',
    '  "plumbing_and_systems": ["string"],',
    '  "summary": "string"',
    '}',
    '',
    `Language hint: ${language}`,
    'Code block:',
    code,
  ].join('\n');
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractJsonFromText(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const direct = safeJsonParse(raw);
  if (direct) return direct;

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    const fromFence = safeJsonParse(fenced[1].trim());
    if (fromFence) return fromFence;
  }

  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return safeJsonParse(raw.slice(firstBrace, lastBrace + 1));
  }

  return null;
}

function normalizeExplanationShape(data) {
  return {
    job_of_code: String(data?.job_of_code || 'No explanation returned.'),
    key_breakdown: Array.isArray(data?.key_breakdown) ? data.key_breakdown.map(String) : [],
    plumbing_and_systems: Array.isArray(data?.plumbing_and_systems) ? data.plumbing_and_systems.map(String) : [],
    summary: String(data?.summary || 'No summary returned.'),
  };
}

function buildFallbackResponse(code, language, warning, details) {
  return {
    ...mockExplanation(code, language),
    source: 'mock-fallback',
    warning,
    ...(details ? { details: String(details).slice(0, 300) } : {}),
  };
}

function getAssistantContent(payload) {
  const messageContent = payload?.choices?.[0]?.message?.content;
  if (typeof messageContent === 'string') {
    return messageContent;
  }

  if (Array.isArray(messageContent)) {
    return messageContent
      .map((part) => (typeof part === 'string' ? part : part?.text || ''))
      .join('\n')
      .trim();
  }

  return '';
}

async function requestGroqCompletion({ key, selectedModel, prompt, useJsonResponseFormat = true }) {
  const body = {
    model: selectedModel,
    temperature: 0.2,
    messages: [
      { role: 'system', content: 'You explain code clearly for anxious developers.' },
      { role: 'user', content: prompt },
    ],
  };

  if (useJsonResponseFormat) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(20000),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  return response;
}

function normalizeLineItem(line) {
  return String(line || '')
    .replace(/^[-*\d.)\s]+/, '')
    .trim();
}

function textToExplanationShape(text, language) {
  const raw = String(text || '').trim();
  const lines = raw
    .split('\n')
    .map((line) => normalizeLineItem(line))
    .filter(Boolean);

  const cleanedParagraphs = raw
    .replace(/```[\s\S]*?```/g, '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const job_of_code =
    cleanedParagraphs[0] || `This ${language || 'code'} snippet performs a focused task and returns a result.`;

  const key_breakdown = lines.slice(0, 4);
  const plumbing_and_systems = lines.slice(4, 8);
  const summary =
    cleanedParagraphs[cleanedParagraphs.length - 1] ||
    'This code follows a direct input-process-output flow with clear steps.';

  return normalizeExplanationShape({
    job_of_code,
    key_breakdown,
    plumbing_and_systems,
    summary,
  });
}

function mockExplanation(code, language) {
  const lines = code.split('\n').length;
  return {
    job_of_code: `This ${language || 'code'} snippet processes input and produces an output based on explicit logic.`,
    key_breakdown: [
      `It has about ${lines} line(s), so complexity appears small-to-medium.`,
      'There is likely a clear input -> processing -> output flow.',
      'The main goal is to make one concrete task happen step by step.',
    ],
    plumbing_and_systems: [
      'Think of this like a small pipeline: data enters, gets transformed, then exits.',
      'Each statement likely handles either setup, decision-making, or data movement.',
      'If this is part of a bigger app, this block is one station in that app pipeline.',
    ],
    summary: 'This code appears to handle a focused task in a predictable sequence with manageable complexity.',
    source: 'mock',
  };
}

app.post('/api/explain', async (req, res) => {
  const { apiKey, code, language, model, tone } = req.body || {};

  if (!code || !String(code).trim()) {
    return res.status(400).json({ error: 'Please provide a code snippet.' });
  }

  const key = String(apiKey || process.env.GROQ_API_KEY || '').trim();
  if (!key) {
    return res.json(mockExplanation(code, language));
  }

  const selectedModel = model || 'llama-3.1-8b-instant';

  try {
    const toneInstruction =
      tone === 'balanced'
        ? 'Use clear technical language while staying concise.'
        : 'Use beginner-friendly technical language with low jargon.';

    const prompt = [
      buildPrompt(code, language),
      '',
      toneInstruction,
      `Tone preference: ${tone || 'beginner'}`,
    ].join('\n');

    let response = await requestGroqCompletion({
      key,
      selectedModel,
      prompt,
      useJsonResponseFormat: true,
    });

    if (!response.ok) {
      const errorText = await response.text();
      const supportsRetryWithoutJsonFormat =
        response.status === 400 && /response_format|json_object/i.test(errorText);

      if (supportsRetryWithoutJsonFormat) {
        response = await requestGroqCompletion({
          key,
          selectedModel,
          prompt,
          useJsonResponseFormat: false,
        });

        if (!response.ok) {
          const retryErrorText = await response.text();
          return res.json(
            buildFallbackResponse(
              code,
              language,
              'Groq request failed after retry; returned fallback explanation instead.',
              retryErrorText,
            ),
          );
        }
      } else {
        return res.json(
          buildFallbackResponse(
            code,
            language,
            'Groq request failed; returned fallback explanation instead.',
            errorText,
          ),
        );
      }
    }

    const payload = await response.json();
    const content = getAssistantContent(payload);

    if (!content) {
      return res.json(
        buildFallbackResponse(
          code,
          language,
          'Groq returned an empty response; returned fallback explanation instead.',
        ),
      );
    }

    const parsed = extractJsonFromText(content);
    if (!parsed) {
      return res.json({
        ...textToExplanationShape(content, language),
        source: 'groq-text-fallback',
      });
    }

    return res.json({ ...normalizeExplanationShape(parsed), source: 'groq' });
  } catch (error) {
    return res.json(
      buildFallbackResponse(
        code,
        language,
        'Groq request errored; returned fallback explanation instead.',
        error.message,
      ),
    );
  }
});

app.get(/.*/, (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`dev-anxiety-killer running on http://localhost:${PORT}`);
  });
}

module.exports = app;
