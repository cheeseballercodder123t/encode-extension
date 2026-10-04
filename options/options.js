// options.js
document.addEventListener('DOMContentLoaded', async () => {
  const geminiKey = document.getElementById('gemini-key');
  const defaultDeck = document.getElementById('default-deck');
  const ankiUrl = document.getElementById('anki-url');
  const deepEncodeUrl = document.getElementById('deepencode-url');
  const saveBtn = document.getElementById('save-btn');
  const status = document.getElementById('status');

  const data = await chrome.storage.local.get(['geminiApiKey', 'defaultDeck', 'ankiConnectUrl', 'deepEncodeUrl']);
  if (data.geminiApiKey) geminiKey.value = data.geminiApiKey;
  if (data.defaultDeck) defaultDeck.value = data.defaultDeck;
  if (data.ankiConnectUrl) ankiUrl.value = data.ankiConnectUrl;
  if (data.deepEncodeUrl) deepEncodeUrl.value = data.deepEncodeUrl;

  saveBtn.addEventListener('click', async () => {
    await chrome.storage.local.set({
      geminiApiKey: geminiKey.value.trim(),
      defaultDeck: defaultDeck.value.trim() || 'DeepEncode::QuickCapture',
      ankiConnectUrl: ankiUrl.value.trim() || 'http://127.0.0.1:8765',
      deepEncodeUrl: deepEncodeUrl.value.trim() || 'http://localhost:3000'
    });
    status.textContent = 'Options saved!';
    setTimeout(() => { status.textContent = ''; }, 2500);
  });
});
