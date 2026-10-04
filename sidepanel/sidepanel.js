// sidepanel.js - Controller for Encode Companion Side Panel
import { forgeFlashcards } from '../lib/forge.js';
import { AnkiConnectClient } from '../lib/anki.js';
import { formatForRemNote } from '../lib/wozniak.js';

let currentDeckData = null;
let activeSourceInfo = { type: 'webpage', title: '', url: '' };
const anki = new AnkiConnectClient();

// DOM Elements
const ankiBadge = document.getElementById('anki-badge');
const ankiStatusText = document.getElementById('anki-status-text');
const btnGrabContext = document.getElementById('btn-grab-context');
const btnGrabText = document.getElementById('btn-grab-text');
const btnGrabSelection = document.getElementById('btn-grab-selection');
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
    // Clear once consumed
    await chrome.storage.local.remove('pendingCapture');
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

  // Ensure content scripts are injected if page was already loaded
  const fileToInject = tab.url.includes('docs.google.com/presentation')
    ? 'content/google-slides.js'
    : tab.url.includes('gemini.google.com')
    ? 'content/gemini.js'
    : 'content/general.js';

  try {
    // Try sending message first
    const action = selectionOnly ? 'extract_content' : (
      tab.url.includes('docs.google.com/presentation') ? 'extract_google_slides' :
      tab.url.includes('gemini.google.com') ? 'extract_gemini' : 'extract_content'
    );

    let res;
    try {
      res = await chrome.tabs.sendMessage(tab.id, { action });
    } catch {
      // Content script not loaded yet, inject it on the fly
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

// --- Card Rendering ---
function renderCards(deck) {
  currentDeckData = deck;
  deckTopicTitle.textContent = deck.topic;
  deckAuditStats.textContent = `${deck.cards.length} cards · ${deck.stats.clean} clean · ${deck.stats.warnings} flagged`;

  cardsContainer.innerHTML = '';

  deck.cards.forEach((card, idx) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card-item';

    const typeTag = document.createElement('span');
    typeTag.className = `card-type-tag card-type-${card.type}`;
    typeTag.textContent = card.type;

    const frontEl = document.createElement('div');
    frontEl.className = 'card-front';

    // Highlight clozes visually
    if (card.type === 'cloze') {
      frontEl.innerHTML = card.front.replace(/\{\{c\d+::(.*?)\}\}/g, '<span class="cloze-highlight">[$1]</span>');
    } else {
      frontEl.textContent = `${idx + 1}. ${card.front}`;
    }

    cardEl.appendChild(typeTag);
    cardEl.appendChild(frontEl);

    if (card.back) {
      const backEl = document.createElement('div');
      backEl.className = 'card-back';
      backEl.textContent = card.back;
      cardEl.appendChild(backEl);
    }

    if (card.trap) {
      const trapEl = document.createElement('div');
      trapEl.className = 'card-trap';
      trapEl.innerHTML = `⚠️ <b>Lookalike Trap:</b> ${card.trap}`;
      cardEl.appendChild(trapEl);
    }

    cardsContainer.appendChild(cardEl);
  });

  resultsView.classList.remove('hidden');
}

// --- Event Listeners ---
function setupEventListeners() {
  inputText.addEventListener('input', updateWordCount);

  btnGrabContext.addEventListener('click', () => grabFromCurrentTab(false));
  btnGrabSelection.addEventListener('click', () => grabFromCurrentTab(true));

  btnDismissError.addEventListener('click', hideError);

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
      renderCards(deck);
    } catch (err) {
      showError(err.message);
    } finally {
      loadingState.classList.add('hidden');
      btnForge.disabled = false;
    }
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

// Start
document.addEventListener('DOMContentLoaded', init);
