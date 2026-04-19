const explainBtn = document.getElementById('explainBtn');
const statusText = document.getElementById('statusText');

const apiKeyEl = document.getElementById('apiKey');
const languageEl = document.getElementById('language');
const toneEl = document.getElementById('tone');
const codeInputEl = document.getElementById('codeInput');

const jobOfCodeEl = document.getElementById('jobOfCode');
const keyBreakdownEl = document.getElementById('keyBreakdown');
const plumbingEl = document.getElementById('plumbing');
const summaryEl = document.getElementById('summary');
const defaultButtonText = explainBtn.textContent;

function renderList(container, items = []) {
  container.innerHTML = '';
  if (!Array.isArray(items) || !items.length) {
    const li = document.createElement('li');
    li.textContent = 'No details returned yet.';
    container.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    container.appendChild(li);
  });
}

async function explainCode() {
  const code = codeInputEl.value.trim();
  if (!code) {
    statusText.textContent = 'Please paste some code first.';
    return;
  }

  statusText.textContent = 'Analyzing...';
  explainBtn.disabled = true;
  explainBtn.textContent = 'Analyzing...';

  try {
    const response = await fetch('/api/explain', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: apiKeyEl.value.trim(),
        code,
        language: languageEl.value.trim() || 'unknown',
        tone: toneEl.value,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.details ? `${data.error} ${data.details}` : data?.error || 'Request failed.');
    }

    jobOfCodeEl.textContent = data.job_of_code || 'No explanation returned.';
    renderList(keyBreakdownEl, data.key_breakdown || []);
    renderList(plumbingEl, data.plumbing_and_systems || []);
    summaryEl.textContent = data.summary || 'No summary returned.';

    const source = data.source === 'groq' ? 'Groq' : 'mock mode';
    statusText.textContent = `Done (${source}).`;
  } catch (error) {
    statusText.textContent = `Error: ${error.message}`;
  } finally {
    explainBtn.disabled = false;
    explainBtn.textContent = defaultButtonText;
  }
}

explainBtn.addEventListener('click', explainCode);
