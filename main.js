// ─── Language name map ───────────────────────────────────────────────────────
const LANG_NAMES = {
  fr: 'French', es: 'Spanish', de: 'German', it: 'Italian',
  pt: 'Portuguese', ja: 'Japanese', zh: 'Chinese', ko: 'Korean',
  ru: 'Russian', ar: 'Arabic'
};

// ─── DOM refs ────────────────────────────────────────────────────────────────
const micBtn        = document.getElementById('micBtn');
const micLabel      = micBtn.querySelector('.mic-label');
const statusEl      = document.getElementById('status');
const manualInput   = document.getElementById('manualInput');
const processBtn    = document.getElementById('processBtn');
const targetLangSel = document.getElementById('targetLang');

const confirmCard   = document.getElementById('confirmCard');
const enTextEl      = document.getElementById('enText');
const trTextEl      = document.getElementById('trText');
const trTag         = document.getElementById('trTag');
const trLangName    = document.getElementById('trLangName');
const transLoader   = document.getElementById('transLoader');
const saveBtn       = document.getElementById('saveBtn');
const discardBtn    = document.getElementById('discardBtn');
const retranslateBtn= document.getElementById('retranslateBtn');

const logSection    = document.getElementById('logSection');
const logList       = document.getElementById('logList');
const exportBtn     = document.getElementById('exportBtn');

// ─── State — session only, wiped on every page reload ────────────────────────
// (No localStorage — intentional. Refresh = clean slate.)
let currentLang = targetLangSel.value;
let sessionLog  = [];   // [{ en, tr, lang }]  lives only in RAM

// Keep lang label in sync
targetLangSel.addEventListener('change', () => {
  currentLang = targetLangSel.value;
});

// ─── Status helper ───────────────────────────────────────────────────────────
function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (type ? ' ' + type : '');
}

// ─── Translation via MyMemory (free, no key) ─────────────────────────────────
async function translate(text, targetLang) {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error('MyMemory HTTP ' + res.status);
    const data = await res.json();
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return data.responseData.translatedText;
    }
    throw new Error('MyMemory bad response');
  } catch (err) {
    console.warn('[Translate] MyMemory failed, trying Lingva:', err);
  }

  try {
    const res  = await fetch(`https://lingva.ml/api/v1/en/${targetLang}/${encodeURIComponent(text)}`);
    if (!res.ok) throw new Error('Lingva HTTP ' + res.status);
    const data = await res.json();
    if (data.translation) return data.translation;
    throw new Error('Lingva bad response');
  } catch (err) {
    console.error('[Translate] Both services failed:', err);
    throw new Error('Translation failed. Check your connection and try again.');
  }
}

// ─── Core pipeline ───────────────────────────────────────────────────────────
async function processSentence(text) {
  text = text.trim();
  if (!text) return;

  currentLang = targetLangSel.value;
  const langName = LANG_NAMES[currentLang] || currentLang.toUpperCase();

  // Show the confirm card immediately with English text
  enTextEl.value = text;
  trTextEl.value = '';
  trTag.textContent = currentLang.toUpperCase();
  trLangName.textContent = langName;
  confirmCard.classList.add('visible');

  // Show loader, disable save while translating
  transLoader.classList.add('active');
  saveBtn.disabled = true;
  setStatus('Translating…');

  try {
    const translated = await translate(text, currentLang);
    trTextEl.value = translated;
    setStatus('Done. Edit if needed, then save.', 'success');
  } catch (err) {
    setStatus(err.message, 'error');
    trTextEl.value = '';
    trTextEl.placeholder = 'Translation failed — type it manually';
  } finally {
    transLoader.classList.remove('active');
    saveBtn.disabled = false;
  }
}

// ─── Re-translate ─────────────────────────────────────────────────────────────
retranslateBtn.addEventListener('click', async () => {
  const text = enTextEl.value.trim();
  if (!text) return;

  trTextEl.value = '';
  transLoader.classList.add('active');
  saveBtn.disabled = true;
  setStatus('Re-translating…');

  try {
    const translated = await translate(text, currentLang);
    trTextEl.value = translated;
    setStatus('Re-translated.', 'success');
  } catch (err) {
    setStatus(err.message, 'error');
  } finally {
    transLoader.classList.remove('active');
    saveBtn.disabled = false;
  }
});

// ─── Speech recognition ──────────────────────────────────────────────────────
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening  = false;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = true;   // show words as you speak
  recognition.maxAlternatives = 1;

  // Show interim results live in the textarea
  recognition.onresult = (e) => {
    let interim = '';
    let final   = '';

    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) {
        final += t;
      } else {
        interim += t;
      }
    }

    // Show what's being heard in real time
    manualInput.value = final || interim;

    // Once we have a final result, run the pipeline
    if (final) {
      processSentence(final);
    }
  };

  recognition.onerror = (e) => {
    setStatus('Mic error: ' + e.error, 'error');
    stopListening();
  };

  recognition.onend = () => stopListening();

  micBtn.addEventListener('click', () => {
    if (isListening) {
      recognition.stop();
    } else {
      startListening();
    }
  });

} else {
  micBtn.disabled = true;
  micLabel.textContent = 'Mic not supported';
  setStatus('Use the text input instead.', 'error');
}

function startListening() {
  if (!recognition) return;
  try {
    manualInput.value = '';   // clear previous text when starting a new recording
    recognition.start();
    isListening = true;
    micBtn.classList.add('listening');
    micLabel.textContent = 'Tap to stop';
    setStatus('Listening… speak now');
  } catch (e) {
    setStatus('Could not start mic.', 'error');
  }
}

function stopListening() {
  isListening = false;
  micBtn.classList.remove('listening');
  micLabel.textContent = 'Hold to speak';
  if (!statusEl.classList.contains('error') && !statusEl.classList.contains('success')) {
    setStatus('Ready.');
  }
}

// ─── Manual process button ───────────────────────────────────────────────────
processBtn.addEventListener('click', () => {
  processSentence(manualInput.value);
});

manualInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    processSentence(manualInput.value);
  }
});

// ─── Discard ─────────────────────────────────────────────────────────────────
discardBtn.addEventListener('click', () => {
  confirmCard.classList.remove('visible');
  setStatus('Discarded.');
});

// ─── Save to session log ──────────────────────────────────────────────────────
saveBtn.addEventListener('click', () => {
  const en   = enTextEl.value.trim();
  const tr   = trTextEl.value.trim();
  const lang = currentLang;

  if (!en || !tr) {
    setStatus('Both fields must be filled in.', 'error');
    return;
  }

  // Add to session log (RAM only — wiped on reload)
  addToLog(en, tr, lang);
  setStatus('Saved to this session ✔', 'success');

  // Reset UI
  confirmCard.classList.remove('visible');
  manualInput.value = '';
});

// ─── Session log ─────────────────────────────────────────────────────────────
function addToLog(en, tr, lang) {
  sessionLog.unshift({ en, tr, lang });

  const li = document.createElement('li');
  li.className = 'log-item';
  li.innerHTML = `
    <span class="log-en">${escapeHtml(en)}</span>
    <span class="log-sep">${lang.toUpperCase()} →</span>
    <span class="log-tr">${escapeHtml(tr)}</span>
  `;
  logList.prepend(li);
  logSection.classList.add('visible');

  // Show export button as soon as there's something to export
  exportBtn.style.display = 'inline-flex';
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Export session as .txt (download to device / AirDrop / share) ────────────
// Format: simple two-column text, easy to paste into Apple Notes, Notion, etc.
exportBtn.addEventListener('click', () => {
  if (sessionLog.length === 0) return;

  const langName = LANG_NAMES[sessionLog[0].lang] || sessionLog[0].lang.toUpperCase();
  const date     = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  const lines    = [`Language Builder — ${date}`, ''];

  sessionLog.slice().reverse().forEach(({ en, tr, lang }, i) => {
    lines.push(`${i + 1}. EN: ${en}`);
    lines.push(`   ${lang.toUpperCase()}: ${tr}`);
    lines.push('');
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `language-builder-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);

  setStatus('Exported! Open the file on your device.', 'success');
});