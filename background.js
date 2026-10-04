// background.js - Encode Companion Service Worker (ES Module)
import { forgeFlashcards } from './lib/forge.js';
import { AnkiConnectClient } from './lib/anki.js';

const anki = new AnkiConnectClient();

chrome.runtime.onInstalled.addListener(async () => {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (err) {
    console.error('Failed to set side panel behavior:', err);
  }

  const existing = await chrome.storage.local.get(['geminiApiKey', 'defaultDeck', 'ankiConnectUrl', 'deepEncodeUrl', 'cardStyle']);
  const defaults = {
    geminiApiKey: existing.geminiApiKey || '',
    defaultDeck: existing.defaultDeck || 'DeepEncode::QuickCapture',
    ankiConnectUrl: existing.ankiConnectUrl || 'http://127.0.0.1:8765',
    deepEncodeUrl: existing.deepEncodeUrl || 'http://localhost:3000',
    cardStyle: existing.cardStyle || 'balanced'
  };
  await chrome.storage.local.set(defaults);

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'encode-selection',
      title: '⚡ Encode selection with DeepEncode',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: 'encode-page',
      title: '⚡ Encode this entire page / slide',
      contexts: ['page']
    });
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;

  let textToCapture = '';
  let captureSource = tab.url || '';
  let captureTitle = tab.title || '';

  if (info.menuItemId === 'encode-selection' && info.selectionText) {
    textToCapture = info.selectionText.trim();
  } else if (info.menuItemId === 'encode-page') {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'extract_content' });
      if (response && response.text) {
        textToCapture = response.text;
        captureTitle = response.title || captureTitle;
      }
    } catch {
      textToCapture = tab.title || '';
    }
  }

  if (textToCapture) {
    await chrome.storage.local.set({
      pendingCapture: {
        text: textToCapture,
        source: captureSource,
        title: captureTitle,
        timestamp: Date.now()
      }
    });

    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch (err) {
      console.warn('Could not automatically open side panel:', err);
    }
  }
});

// Handle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.action === 'ping') {
        sendResponse({ status: 'ok' });
        return;
      }

      if (message.action === 'open_sidepanel') {
        if (sender.tab && sender.tab.windowId) {
          await chrome.sidePanel.open({ windowId: sender.tab.windowId });
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'No active window found' });
        }
        return;
      }

      if (message.action === 'anki_request') {
        const { ankiConnectUrl = 'http://127.0.0.1:8765' } = await chrome.storage.local.get('ankiConnectUrl');
        const res = await fetch(ankiConnectUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message.payload)
        });
        const data = await res.json();
        sendResponse({ success: true, data });
        return;
      }

      if (message.action === 'get_current_tab') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        sendResponse({ tab });
        return;
      }

      // 1-Click in-page encode and push action
      if (message.action === 'quick_encode_and_push') {
        const { text, title } = message;
        const config = await chrome.storage.local.get(['geminiApiKey', 'defaultDeck', 'cardStyle']);
        const apiKey = config.geminiApiKey || '';
        const defaultDeck = config.defaultDeck || 'DeepEncode::QuickCapture';
        const cardStyle = config.cardStyle || 'balanced';

        // 1. Forge cards
        const deck = await forgeFlashcards({
          text,
          sourceTitle: title || 'Quick Capture',
          apiKey,
          cardStyle
        });

        if (!deck || deck.cards.length === 0) {
          sendResponse({ success: false, error: 'No cards could be forged from this content.' });
          return;
        }

        // 2. Push to Anki
        const targetDeck = `${defaultDeck}::${deck.topic.replace(/\s+/g, '_')}`;\n        const pushResult = await anki.pushCards(targetDeck, deck.cards);\n\n        // Also save to recent storage so side panel shows it\n        await chrome.storage.local.set({ lastForgedDeck: deck });\n\n        sendResponse({\n          success: true,\n          added: pushResult.added,\n          skipped: pushResult.skipped,\n          deck: targetDeck,\n          topic: deck.topic\n        });\n        return;\n      }\n\n      sendResponse({ status: 'unhandled_action' });\n    } catch (err) {\n      console.error('Error in background listener:', err);\n      sendResponse({ success: false, error: err.message || String(err) });\n    }\n  })();\n\n  return true;\n});\n