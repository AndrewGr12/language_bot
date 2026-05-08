// =========================
// STORAGE
// =========================

let sentences = JSON.parse(localStorage.getItem("sentences") || "[]");

function save() {
  localStorage.setItem("sentences", JSON.stringify(sentences));
  render();
}

// =========================
// SPEECH RECOGNITION
// =========================

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

recognition.lang = "en-US";
recognition.interimResults = false;

const status = document.getElementById("status");

document.getElementById("startBtn").onclick = () => {
  recognition.start();
  status.innerText = "Listening...";
};

document.getElementById("stopBtn").onclick = () => {
  recognition.stop();
  status.innerText = "Stopped.";
};

recognition.onresult = async (event) => {
  const text = event.results[0][0].transcript;
  status.innerText = "Heard: " + text;

  const translated = await translate(text);

  addSentence(text, translated);
};

// =========================
// MANUAL INPUT
// =========================

document.getElementById("addManual").onclick = async () => {
  const text = document.getElementById("manualInput").value;
  if (!text) return;

  const translated = await translate(text);

  addSentence(text, translated);

  document.getElementById("manualInput").value = "";
};

// =========================
// TRANSLATION (PLUG-IN READY)
// =========================

async function translate(text) {
  const lang = document.getElementById("targetLang").value;

  try {
    // Free API (can be swapped later)
    const res = await fetch("https://libretranslate.de/translate", {
      method: "POST",
      body: JSON.stringify({
        q: text,
        source: "en",
        target: lang,
        format: "text"
      }),
      headers: { "Content-Type": "application/json" }
    });

    const data = await res.json();
    return data.translatedText || "[translation error]";
  } catch (e) {
    return "[translation failed]";
  }
}

// =========================
// ADD SENTENCE
// =========================

function addSentence(en, translated) {
  sentences.push({
    en,
    translated,
    time: Date.now()
  });

  save();
}

// =========================
// TEXT TO SPEECH
// =========================

function speak(text) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  speechSynthesis.speak(utter);
}

function speakForeign(text) {
  const lang = document.getElementById("targetLang").value;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  speechSynthesis.speak(utter);
}

// =========================
// RENDER LIST
// =========================

function render() {
  const list = document.getElementById("list");
  list.innerHTML = "";

  sentences.slice().reverse().forEach((s, i) => {
    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <div><b>EN:</b> ${s.en}</div>
      <div class="small"><b>TRANSLATED:</b> ${s.translated}</div>

      <div class="actions">
        <button onclick="speak('${escapeQuotes(s.en)}')">🔊 English</button>
        <button onclick="speakForeign('${escapeQuotes(s.translated)}')">🌍 Target</button>
      </div>
    `;

    list.appendChild(div);
  });
}

function escapeQuotes(str) {
  return str.replace(/'/g, "\\'");
}

render();