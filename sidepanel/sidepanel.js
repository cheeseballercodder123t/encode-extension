// sidepanel.js - Controller for Encode Companion Side Panel
import { forgeFlashcards } from '../lib/forge.js';
import { AnkiConnectClient } from '../lib/anki.js';
import { formatForRemNote, sanitizeDeck } from '../lib/wozniak.js';

let currentDeckData = null;
let activeSourceInfo = { type: 'webpage', title: '', url: '' };
let isRecording = false;
let speechRecognizer = null;
const anki = new AnkiConnectClient();

// DOM Elements
const ankiBadge = document.getElementById('anki-badge');
const ankiStatusText = document.getElementById('anki-status-text');
const btnGrabContext = document.getElementById('btn-grab-context');
const btnGrabText = document.getElementById('btn-grab-text');
const btnGrabSelection = document.getElementById('btn-grab-selection');
const btnMic = document.getElementById('btn-mic');
const micIcon = document.getElementById('mic-icon');
const btnCopyGeminiPrompt = document.getElementById('btn-copy-gemini-prompt');
const sourceIndicator = document.getElementById('capture-source-indicator');
const sourceTypePill = document.getElementById('source-type-pill');
const sourceTitleDisplay = document.getElementById('source-title-display');
const inputText = document.getElementById('input-text');
const wordCountLabel = document.getElementById('word-count');
const btnForge = document.getElementById('btn-forge');
const loadingState = document.getElementById('loading-state');
const errorBanner = document.getElementById('error-banner');
const errorMessage = document.getElementById('error-message');
const btnDismissError = document.getElementById('btn-dismiss-error');
const receiptBanner = document.getElementById('receipt-banner');
const receiptMessage = document.getElementById('receipt-message');
const resultsView = document.getElementById('results-view');
const deckTopicTitle = document.getElementById('deck-topic-title');
const deckAuditStats = document.getElementById('deck-audit-stats');
const cardsContainer = document.getElementById('cards-container');
const btnAddCard = document.getElementById('btn-add-card');
const btnPushAnki = document.getElementById('btn-push-anki');
const btnCopyRemnote = document.getElementById('btn-copy-remnote');
const btnCopyJson = document.getElementById('btn-copy-json');
const btnOpenDeepEncode = document.getElementById('btn-open-deepencode');

// Settings modal
const btnSettings = document.getElementById('btn-settings');
const settingsModal = document.getElementById('settings-modal');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');
const settingGeminiKey = document.getElementById('setting-gemini-key');
const settingDefaultDeck = document.getElementById('setting-default-deck');
const settingAnkiUrl = document.getElementById('setting-anki-url');
const settingDeepEncodeUrl = document.getElementById('setting-deepencode-url');

// --- Initialization ---
async function init() {
  await checkAnkiStatus();
  await inspectActiveTab();
  await checkPendingCapture();
  await checkLastForgedDeck();
  setupEventListeners();
}

async function checkAnkiStatus() {
  try {
    const { connected, version } = await anki.checkConnection();
    if (connected) {
      ankiBadge.className = 'badge badge-online';
      ankiStatusText.textContent = `Anki v${version}`;
      ankiBadge.title = `AnkiConnect is connected and ready`;
    } else {
      ankiBadge.className = 'badge badge-offline';
      ankiStatusText.textContent = 'Anki Offline';
      ankiBadge.title = 'Anki is closed or AnkiConnect add-on is missing (code 2055492159)';
    }
  } catch {
    ankiBadge.className = 'badge badge-offline';
    ankiStatusText.textContent = 'Anki Offline';
  }
}

async function inspectActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return;

    activeSourceInfo.url = tab.url;
    activeSourceInfo.title = tab.title || '';

    if (tab.url.includes('docs.google.com/presentation')) {
      activeSourceInfo.type = 'google-slides';
      btnGrabText.textContent = 'Grab Active Slide';
    } else if (tab.url.includes('gemini.google.com')) {
      activeSourceInfo.type = 'gemini-chat';
      btnGrabText.textContent = 'Grab Gemini Chat';
    } else {
      activeSourceInfo.type = 'webpage';
      btnGrabText.textContent = 'Grab Page Content';
    }
  } catch (err) {
    console.debug('Tab inspection error:', err);
  }
}

async function checkPendingCapture() {
  const { pendingCapture } = await chrome.storage.local.get('pendingCapture');
  if (pendingCapture && pendingCapture.text) {
    inputText.value = pendingCapture.text;
    updateWordCount();
    setSourceIndicator(pendingCapture.title || 'Context Capture', 'Captured');
    await chrome.storage.local.remove('pendingCapture');
  }
}

async function checkLastForgedDeck() {
  const { lastForgedDeck } = await chrome.storage.local.get('lastForgedDeck');
  if (lastForgedDeck && lastForgedDeck.cards && lastForgedDeck.cards.length > 0) {
    renderCards(lastForgedDeck);
  }
}

function setSourceIndicator(title, type) {
  sourceTitleDisplay.textContent = title;
  sourceTypePill.textContent = type || 'Source';
  sourceIndicator.classList.remove('hidden');
}

function updateWordCount() {
  const text = inputText.value.trim();
  const words = text ? text.split(/\s+/).length : 0;
  wordCountLabel.textContent = `${words} words`;
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorBanner.classList.remove('hidden');
}

function hideError() {
  errorBanner.classList.add('hidden');
}

function showReceipt(msg) {
  receiptMessage.innerHTML = msg;
  receiptBanner.classList.remove('hidden');
  setTimeout(() => {
    receiptBanner.classList.add('hidden');
  }, 4000);
}

// --- Content Grabber ---
async function grabFromCurrentTab(selectionOnly = false) {
  hideError();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    showError('No active browser tab found.');
    return;
  }

  const fileToInject = tab.url.includes('docs.google.com/presentation')
    ? 'content/google-slides.js'
    : tab.url.includes('gemini.google.com')
    ? 'content/gemini.js'
    : 'content/general.js';

  try {
    const action = selectionOnly ? 'extract_content' : (
      tab.url.includes('docs.google.com/presentation') ? 'extract_google_slides' :
      tab.url.includes('gemini.google.com') ? 'extract_gemini' : 'extract_content'
    );

    let res;
    try {
      res = await chrome.tabs.sendMessage(tab.id, { action });
    } catch {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [fileToInject]
      });
      res = await chrome.tabs.sendMessage(tab.id, { action });
    }

    if (res && res.text) {
      inputText.value = res.text;
      updateWordCount();
      activeSourceInfo.title = res.title || tab.title;
      activeSourceInfo.url = tab.url;
      setSourceIndicator(activeSourceInfo.title, res.type || 'Tab');
    } else {
      showError('No text found on active tab. Try selecting text first.');
    }
  } catch (err) {
    showError(`Could not read tab: ${err.message}. (Note: Chrome internal pages cannot be read).`);
  }
}

// --- Web Speech API Dictation ---
function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    btnMic.title = 'Speech recognition not supported in this browser';
    btnMic.disabled = true;
    return;
  }

  speechRecognizer = new SpeechRecognition();
  speechRecognizer.continuous = true;
  speechRecognizer.interimResults = true;

  speechRecognizer.onstart = () => {
    isRecording = true;
    micIcon.textContent = '🔴';
    btnMic.classList.add('mic-active');
  };

  speechRecognizer.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    if (transcript) {
      inputText.value += (inputText.value ? ' ' : '') + transcript;
      updateWordCount();
    }
  };

  speechRecognizer.onerror = (e) => {
    console.warn('Speech recognition error:', e.error);
    stopRecording();
  };

  speechRecognizer.onend = () => {
    stopRecording();
  };
}

function toggleRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    try {
      speechRecognizer.start();
    } catch (e) {
      console.warn('Could not start recognition:', e);
    }
  }
}

function stopRecording() {
  isRecording = false;
  micIcon.textContent = '🎙️';
  btnMic.classList.remove('mic-active');
  try { speechRecognizer.stop(); } catch {}
}

// --- Card Rendering with Inline Editing ---
function renderCards(deck) {
  currentDeckData = deck;
  deckTopicTitle.textContent = deck.topic;
  updateAuditDisplay();

  cardsContainer.innerHTML = '';

  deck.cards.forEach((card, idx) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card-item';

    const cardHeader = document.createElement('div');
    cardHeader.className = 'card-item-header';

    const typeTag = document.createElement('span');
    typeTag.className = `card-type-tag card-type-${card.type}`;
    typeTag.textContent = card.type;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'card-del-btn';
    deleteBtn.textContent = '✕';
    deleteBtn.title = 'Remove this card';
    deleteBtn.addEventListener('click', () => {
      deck.cards.splice(idx, 1);
      renderCards(deck);
    });

    cardHeader.appendChild(typeTag);
    cardHeader.appendChild(deleteBtn);
    cardEl.appendChild(cardHeader);

    // Front (Editable)
    const frontEl = document.createElement('div');
    frontEl.className = 'card-front editable-field';
    frontEl.contentEditable = 'true';
    frontEl.textContent = card.front;
    frontEl.addEventListener('input', () => {
      card.front = frontEl.textContent.trim();
      updateAuditDisplay();
    });
    cardEl.appendChild(frontEl);

    // Back (Editable if present)
    if (card.back !== undefined) {
      const backEl = document.createElement('div');
      backEl.className = 'card-back editable-field';
      backEl.contentEditable = 'true';
      backEl.textContent = card.back;
      backEl.addEventListener('input', () => {
        card.back = backEl.textContent.trim();
        updateAuditDisplay();
      });
      cardEl.appendChild(backEl);
    }

    // Trap (Editable if present)
    if (card.trap) {
      const trapEl = document.createElement('div');
      trapEl.className = 'card-trap editable-field';
      trapEl.contentEditable = 'true';
      trapEl.textContent = `Trap: ${card.trap}`;
      trapEl.addEventListener('input', () => {
        card.trap = trapEl.textContent.replace(/^Trap:\s*/, '').trim();
      });
      cardEl.appendChild(trapEl);
    }

    cardsContainer.appendChild(cardEl);
  });

  resultsView.classList.remove('hidden');
}

function updateAuditDisplay() {
  if (!currentDeckData) return;
  const { stats } = sanitizeDeck(currentDeckData.cards);
  deckAuditStats.textContent = `${currentDeckData.cards.length} cards · ${stats.clean} clean · ${stats.warnings} leeches/warnings`;
}

// --- Event Listeners ---
function setupEventListeners() {
  setupSpeechRecognition();

  inputText.addEventListener('input', updateWordCount);

  btnGrabContext.addEventListener('click', () => grabFromCurrentTab(false));
  btnGrabSelection.addEventListener('click', () => grabFromCurrentTab(true));
  btnMic.addEventListener('click', toggleRecording);

  btnDismissError.addEventListener('click', hideError);

  // Copy Gemini Socratic prompt
  btnCopyGeminiPrompt.addEventListener('click', async () => {
    const text = inputText.value.trim();
    const prompt = `I am studying this lecture / slide material:\n\n---\n${text || activeSourceInfo.title || 'Selected concepts'}\n---\n\nPlease explain:\n1. The core underlying causal mechanism (why does it work this way step-by-step?).\n2. One intuitive real-world analogy.\n3. The most common student misconception or lookalike confusion and why it fails.`;

    await navigator.clipboard.writeText(prompt);
    showReceipt('💡 Copied Socratic Gemini prompt to clipboard!');
  });

  // Forge button
  btnForge.addEventListener('click', async () => {
    hideError();
    const text = inputText.value.trim();
    if (!text) {
      showError('Please paste or grab study material first.');
      return;
    }

    const { geminiApiKey = '' } = await chrome.storage.local.get('geminiApiKey');
    const selectedStyle = document.querySelector('input[name="card-style"]:checked')?.value || 'balanced';

    loadingState.classList.remove('hidden');
    resultsView.classList.add('hidden');
    btnForge.disabled = true;

    try {
      const deck = await forgeFlashcards({
        text,
        sourceTitle: activeSourceInfo.title,
        apiKey: geminiApiKey,
        cardStyle: selectedStyle
      });
      await chrome.storage.local.set({ lastForgedDeck: deck });
      renderCards(deck);
    } catch (err) {
      showError(err.message);
    } finally {
      loadingState.classList.add('hidden');
      btnForge.disabled = false;
    }
  });

  // Add blank card
  btnAddCard.addEventListener('click', () => {
    if (!currentDeckData) return;
    currentDeckData.cards.push({
      type: 'cloze',
      front: 'Concept {{c1::key fact}} prompt',
      back: '',
      trap: ''
    });
    renderCards(currentDeckData);
  });

  // Push to Anki
  btnPushAnki.addEventListener('click', async () => {
    if (!currentDeckData || currentDeckData.cards.length === 0) return;
    btnPushAnki.disabled = true;
    btnPushAnki.textContent = 'Pushing...';

    try {
      const { defaultDeck = 'DeepEncode::QuickCapture' } = await chrome.storage.local.get('defaultDeck');
      const targetDeck = `${defaultDeck}::${currentDeckData.topic.replace(/\s+/g, '_')}`;

      const res = await anki.pushCards(targetDeck, currentDeckData.cards);
      showReceipt(`✅ <b>Anki:</b> Added ${res.added} cards (${res.skipped} skipped as duplicates) to <code>${targetDeck}</code>`);
      await checkAnkiStatus();
    } catch (err) {
      showError(err.message);
    } finally {
      btnPushAnki.disabled = false;
      btnPushAnki.innerHTML = '<span>🚀</span> Push to Anki';
    }
  });

  // Copy for RemNote
  btnCopyRemnote.addEventListener('click', async () => {
    if (!currentDeckData) return;
    const remnoteText = formatForRemNote(currentDeckData.cards);
    await navigator.clipboard.writeText(remnoteText);
    showReceipt('📋 <b>RemNote Power Syntax</b> copied to clipboard!');
  });

  // Copy raw JSON
  btnCopyJson.addEventListener('click', async () => {
    if (!currentDeckData) return;
    await navigator.clipboard.writeText(JSON.stringify(currentDeckData, null, 2));
    showReceipt('📑 Copied raw card JSON to clipboard!');
  });

  // Open in DeepEncode full app
  btnOpenDeepEncode.addEventListener('click', async () => {
    const { deepEncodeUrl = 'http://localhost:3000' } = await chrome.storage.local.get('deepEncodeUrl');
    const text = inputText.value.trim();
    const encoded = encodeURIComponent(text);
    const targetUrl = `${deepEncodeUrl}?source=${encoded}`;
    chrome.tabs.create({ url: targetUrl });
  });

  // Settings Modal Handlers
  btnSettings.addEventListener('click', async () => {
    const data = await chrome.storage.local.get(['geminiApiKey', 'defaultDeck', 'ankiConnectUrl', 'deepEncodeUrl']);
    settingGeminiKey.value = data.geminiApiKey || '';
    settingDefaultDeck.value = data.defaultDeck || 'DeepEncode::QuickCapture';
    settingAnkiUrl.value = data.ankiConnectUrl || 'http://127.0.0.1:8765';
    settingDeepEncodeUrl.value = data.deepEncodeUrl || 'http://localhost:3000';
    settingsModal.classList.remove('hidden');
  });

  btnCloseSettings.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });

  btnSaveSettings.addEventListener('click', async () => {
    await chrome.storage.local.set({
      geminiApiKey: settingGeminiKey.value.trim(),
      defaultDeck: settingDefaultDeck.value.trim() || 'DeepEncode::QuickCapture',
      ankiConnectUrl: settingAnkiUrl.value.trim() || 'http://127.0.0.1:8765',
      deepEncodeUrl: settingDeepEncodeUrl.value.trim() || 'http://localhost:3000'
    });
    settingsModal.classList.add('hidden');
    await checkAnkiStatus();
    showReceipt('⚙️ Settings saved successfully.');
  });
}

document.addEventListener('DOMContentLoaded', init);
