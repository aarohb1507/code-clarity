const express = require('express');
const path = require('path');

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

  const key = apiKey || process.env.GROQ_API_KEY;
  if (!key) {
    return res.json(mockExplanation(code, language));
  }

  const selectedModel = model || 'llama-3.1-8b-instant';

  try {
    const prompt = [
      buildPrompt(code, language),
      '',
      `Tone preference: ${tone || 'beginner'}`,
    ].join('\n');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'You explain code clearly for anxious developers.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: 'LLM request failed.',
        details: errorText.slice(0, 300),
      });
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(502).json({ error: 'LLM returned an empty response.' });
    }

    const parsed = safeJsonParse(content);
    if (!parsed) {
      return res.status(502).json({
        error: 'LLM response was not valid JSON.',
        raw: String(content).slice(0, 500),
      });
    }

    return res.json({ ...parsed, source: 'groq' });
  } catch (error) {
    return res.status(500).json({
      error: 'Server error while explaining code.',
      details: error.message,
    });
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
