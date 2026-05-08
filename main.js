// ─── Language name map ───────────────────────────────────────────────────────
const LANG_NAMES = {
  fr: 'French', es: 'Spanish', de: 'German', it: 'Italian',
  pt: 'Portuguese', ja: 'Japanese', zh: 'Chinese', ko: 'Korean',
  ru: 'Russian', ar: 'Arabic'
};

// DeepL uses uppercase language codes
const DEEPL_LANG = {
  fr: 'FR', es: 'ES', de: 'DE', it: 'IT',
  pt: 'PT', ja: 'JA', zh: 'ZH', ko: 'KO',
  ru: 'RU', ar: 'AR'
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

const apiKeyInput   = document.getElementById('apiKeyInput');
const apiSetBtn     = document.getElementById('apiSetBtn');
const apiDot        = document.getElementById('apiDot');
const apiNote       = document.getElementById('apiNote');

// ─── State — session only, wiped on every page reload ────────────────────────
let currentLang = targetLangSel.value;
let sessionLog = JSON.parse(localStorage.getItem('languageBuilderLog') || '[]');
let deeplKey    = '';   // never saved to localStorage — clears on tab close

targetLangSel.addEventListener('change', () => {
  currentLang = targetLangSel.value;
});

// ─── Status helper ───────────────────────────────────────────────────────────
function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (type ? ' ' + type : '');
}

// ─── DeepL key setup ─────────────────────────────────────────────────────────
apiSetBtn.addEventListener('click', () => {
  const val = apiKeyInput.value.trim();
  if (!val) return;

  deeplKey = val;
  apiDot.classList.add('connected');
  apiKeyInput.classList.add('connected');
  apiSetBtn.textContent = 'Connected ✔';
  apiSetBtn.classList.add('connected');
  apiNote.textContent = 'DeepL active — high-quality translations for French & Spanish.';
  apiKeyInput.blur();
});

apiKeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') apiSetBtn.click();
});

// ─── Translation ──────────────────────────────────────────────────────────────
// Uses DeepL if key set, falls back to MyMemory (free, no key)
async function translate(text, targetLang) {

  // ── DeepL ─────────────────────────────────────────────────────────────────
  if (deeplKey) {
    try {
      const dlLang   = DEEPL_LANG[targetLang] || targetLang.toUpperCase();
      // Free keys end in :fx and use the free endpoint
      const endpoint = deeplKey.endsWith(':fx')
        ? 'https://api-free.deepl.com/v2/translate'
        : 'https://api.deepl.com/v2/translate';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${deeplKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: [text],
          source_lang: 'EN',
          target_lang: dlLang
        })
      });

      if (!res.ok) throw new Error('DeepL HTTP ' + res.status);
      const data = await res.json();
      if (data.translations?.[0]?.text) return data.translations[0].text;
      throw new Error('DeepL bad response');
    } catch (err) {
      console.warn('[Translate] DeepL failed, falling back to MyMemory:', err);
    }
  }

  // ── MyMemory fallback ─────────────────────────────────────────────────────
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
    console.warn('[Translate] MyMemory failed:', err);
  }

  throw new Error('Translation failed. Check your connection and try again.');
}

// ─── Core pipeline ───────────────────────────────────────────────────────────
async function processSentence(text) {
  text = text.trim();
  if (!text) return;

  currentLang = targetLangSel.value;
  const langName = LANG_NAMES[currentLang] || currentLang.toUpperCase();

  enTextEl.value = text;
  trTextEl.value = '';
  trTag.textContent = currentLang.toUpperCase();
  trLangName.textContent = langName;
  confirmCard.classList.add('visible');

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
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = (e) => {
    let interim = '';
    let final   = '';

    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t;
      else interim += t;
    }

    manualInput.value = final || interim;
    if (final) processSentence(final);
  };

  recognition.onerror = (e) => {
    setStatus('Mic error: ' + e.error, 'error');
    stopListening();
  };

  recognition.onend = () => stopListening();

  micBtn.addEventListener('click', () => {
    if (isListening) recognition.stop();
    else startListening();
  });

} else {
  micBtn.disabled = true;
  micLabel.textContent = 'Mic not supported';
  setStatus('Use the text input instead.', 'error');
}

function startListening() {
  if (!recognition) return;
  try {
    manualInput.value = '';
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
processBtn.addEventListener('click', () => processSentence(manualInput.value));

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

  addToLog(en, tr, lang);
  setStatus('Saved to this session ✔', 'success');
  confirmCard.classList.remove('visible');
  manualInput.value = '';
  localStorage.setItem('languageBuilderLog', JSON.stringify(sessionLog));
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
  shareBtn.style.display = 'inline-flex';
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const shareBtn = document.getElementById('shareBtn');

shareBtn.addEventListener('click', async () => {
  if (sessionLog.length === 0) return;

  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const lines = [`Language Builder — ${date}`, ''];

  sessionLog.slice().reverse().forEach(({ en, tr, lang }, i) => {
    lines.push(`${i + 1}. ${en}`);
    lines.push(`   ${lang.toUpperCase()}: ${tr}`);
    lines.push('');
  });

  const text = lines.join('\n');

  // iPhone / modern browsers
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Language Builder',
        text
      });

      setStatus('Shared successfully ✔', 'success');
    } catch (err) {
      setStatus('Share cancelled.', 'error');
    }
  } else {
    // fallback copy
    await navigator.clipboard.writeText(text);
    setStatus('Copied to clipboard ✔', 'success');
  }
});