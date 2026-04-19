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
const btnTextEl = explainBtn.querySelector('.btn-text');

const defaultButtonText = btnTextEl.textContent;

async function parseJsonSafely(response) {
  const raw = await response.text();
  if (!raw || !raw.trim()) {
    return {
      error: 'Empty response from server.',
    };
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {
      error: 'Server returned a non-JSON response.',
      details: raw.slice(0, 200),
    };
  }
}

function renderList(container, items = []) {
  container.innerHTML = '';
  if (!Array.isArray(items) || !items.length) {
    const li = document.createElement('li');
    li.innerHTML = '<em>*crickets chirping*</em>';
    container.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    container.appendChild(li);
  });
}

function resetOutputs() {
  jobOfCodeEl.textContent = 'The void is listening...';
  keyBreakdownEl.innerHTML = '';
  plumbingEl.innerHTML = '';
  summaryEl.textContent = '';
}

async function explainCode() {
  const code = codeInputEl.value.trim();
  if (!code) {
    statusText.textContent = 'Oops! You forgot to paste the spooky code.';
    statusText.classList.add('error');
    return;
  }

  statusText.classList.remove('error');
  statusText.textContent = 'Consulting the code spirits 🔮...';
  explainBtn.disabled = true;
  btnTextEl.textContent = 'Decrypting matrix...';
  resetOutputs();

  try {
    const response = await fetch('/api/explain', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: apiKeyEl.value.trim(),
        code,
        language: languageEl.value.trim(),
        tone: toneEl.value,
      }),
    });

    const data = await parseJsonSafely(response);

    if (!response.ok) {
      throw new Error(data?.details ? `${data.error} ${data.details}` : data?.error || 'Spirits refused to answer.');
    }

    jobOfCodeEl.textContent = data.job_of_code || "Couldn't figure this one out.";
    renderList(keyBreakdownEl, data.key_breakdown || []);
    renderList(plumbingEl, data.plumbing_and_systems || []);
    summaryEl.textContent = data.summary || 'No summary this time.';

    const source = (data.source || '').includes('groq') ? 'Groq ✨' : 'Mock Mode 🤖';
    statusText.textContent = data.warning
      ? `Enlightenment achieved (${source}, fallback used).`
      : `Enlightenment achieved! (${source})`;
  } catch (error) {
    statusText.classList.add('error');
    statusText.textContent = `Yikes: ${error.message}`;
  } finally {
    explainBtn.disabled = false;
    btnTextEl.textContent = defaultButtonText;
  }
}

explainBtn.addEventListener('click', explainCode);