// =========================
// STATE (no database needed)
// =========================

let currentCard = null;

const status = document.getElementById("status");
const modal = document.getElementById("modal");

const enText = document.getElementById("enText");
const trText = document.getElementById("trText");

// =========================
// SPEECH RECOGNITION
// =========================

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

const recognition = new SpeechRecognition();
recognition.lang = "en-US";
recognition.interimResults = false;

recognition.onresult = async (e) => {
  const text = e.results[0][0].transcript;
  await processSentence(text);
};

// =========================
// BUTTONS
// =========================

document.getElementById("startBtn").onclick = () => {
  recognition.start();
  status.innerText = "Listening...";
};

document.getElementById("stopBtn").onclick = () => {
  recognition.stop();
  status.innerText = "Stopped.";
};

document.getElementById("processBtn").onclick = async () => {
  const text = document.getElementById("manualInput").value;
  if (!text) return;
  await processSentence(text);
};

// =========================
// CORE PIPELINE
// =========================

async function processSentence(text) {
  status.innerText = "Translating...";

  const translated = await translate(text);

  currentCard = {
    en: text,
    tr: translated,
    lang: document.getElementById("targetLang").value
  };

  showModal(currentCard);
}

// =========================
// TRANSLATION
// =========================

async function translate(text) {
  const lang = document.getElementById("targetLang").value;

  const res = await fetch("https://libretranslate.de/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: text,
      source: "en",
      target: lang,
      format: "text"
    })
  });

  const data = await res.json();
  return data.translatedText;
}

// =========================
// MODAL CONTROL
// =========================

function showModal(card) {
  enText.innerText = card.en;
  trText.innerText = card.tr;
  modal.style.display = "flex";
}

document.getElementById("discardBtn").onclick = () => {
  modal.style.display = "none";
  currentCard = null;
};

// =========================
// ANKI CONNECT (NO EXPORT NEEDED)
// =========================

async function sendToAnki(card) {
  const payload = {
    action: "addNote",
    version: 6,
    params: {
      note: {
        deckName: "Language Builder",
        modelName: "Basic",
        fields: {
          Front: card.en,
          Back: card.tr
        },
        tags: ["language-builder", card.lang]
      }
    }
  };

  const res = await fetch("http://localhost:8765", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  return await res.json();
}

// =========================
// SAVE TO ANKI
// =========================

document.getElementById("saveBtn").onclick = async () => {
  status.innerText = "Sending to Anki...";

  try {
    await sendToAnki(currentCard);
    status.innerText = "Saved to Anki ✔";
  } catch (e) {
    status.innerText = "Error: Is Anki open + AnkiConnect installed?";
  }

  modal.style.display = "none";
  currentCard = null;
};