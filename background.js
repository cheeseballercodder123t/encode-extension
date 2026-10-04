// background.js - Encode Companion Service Worker

chrome.runtime.onInstalled.addListener(async () => {
  // Rule 2: Configure side panel to open when clicking the toolbar icon
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (err) {
    console.error('Failed to set side panel behavior:', err);
  }

  // Set default settings if not already present
  const existing = await chrome.storage.local.get(['geminiApiKey', 'defaultDeck', 'ankiConnectUrl', 'deepEncodeUrl', 'cardStyle']);
  const defaults = {
    geminiApiKey: existing.geminiApiKey || '',
    defaultDeck: existing.defaultDeck || 'DeepEncode::QuickCapture',
    ankiConnectUrl: existing.ankiConnectUrl || 'http://127.0.0.1:8765',
    deepEncodeUrl: existing.deepEncodeUrl || 'http://localhost:3000',
    cardStyle: existing.cardStyle || 'balanced' // 'balanced' | 'cloze_only' | 'mechanisms'
  };
  await chrome.storage.local.set(defaults);

  // Setup context menu
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'encode-selection',
      title: 'Encode selection with DeepEncode',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: 'encode-page',
      title: 'Encode this entire page / slide',
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
    // We will ask the active tab to extract content
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'extract_content' });
      if (response && response.text) {
        textToCapture = response.text;
        captureTitle = response.title || captureTitle;
      }
    } catch {
      // Content script may not be loaded yet, fallback to selection or page title
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

    // Open side panel
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch (err) {
      console.warn('Could not automatically open side panel:', err);
    }
  }
});

// Bridge messages between side panel and active tab or background tasks
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.action === 'ping') {
        sendResponse({ status: 'ok' });
        return;
      }

      if (message.action === 'anki_request') {
        // Proxy AnkiConnect request to avoid mixed content or localhost CORS issues
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

      sendResponse({ status: 'unhandled_action' });
    } catch (err) {
      sendResponse({ success: false, error: err.message || String(err) });
    }
  })();

  return true; // Keep channel open for async response
});
