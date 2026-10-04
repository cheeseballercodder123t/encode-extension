// content/gemini.js
// Specialized content extractor for Google Gemini (gemini.google.com)

function extractGeminiContent() {
  const result = {
    type: 'gemini-chat',
    title: document.title.replace(/ - Gemini$/, '').trim(),
    latestResponse: '',
    fullConversation: '',
    turns: []
  };

  // Look for Gemini response elements
  // Gemini uses custom elements such as <message-content>, <model-response>, or class names like .model-response-text
  const responseContainers = document.querySelectorAll(
    'message-content, .model-response-text, .response-container, [data-message-author-role="model"], model-response'
  );

  const turnElements = document.querySelectorAll(
    'user-query, model-response, [data-message-author-role], .conversation-turn'
  );

  if (turnElements && turnElements.length > 0) {
    turnElements.forEach(el => {
      const isUser = el.tagName.toLowerCase().includes('user') || el.getAttribute('data-message-author-role') === 'user';
      const role = isUser ? 'User' : 'Gemini';
      const text = (el.innerText || el.textContent || '').trim();
      if (text) {
        result.turns.push({ role, text });
      }
    });
  }

  // Find the latest Gemini response
  if (responseContainers.length > 0) {
    const lastContainer = responseContainers[responseContainers.length - 1];
    result.latestResponse = (lastContainer.innerText || lastContainer.textContent || '').trim();
  }

  // Format full conversation
  if (result.turns.length > 0) {
    result.fullConversation = result.turns
      .map(t => `### ${t.role}\n${t.text}`)
      .join('\n\n');
  }

  // Check selection
  const selection = window.getSelection()?.toString()?.trim();

  // Pick best representation
  let text = '';
  if (selection) {
    text = `--- Selected from Gemini ---\n${selection}`;
  } else if (result.latestResponse) {
    text = result.latestResponse;
  } else if (result.fullConversation) {
    text = result.fullConversation;
  } else {
    // Fallback: search markdown containers
    const md = document.querySelectorAll('.markdown');
    if (md.length > 0) {
      text = (md[md.length - 1].innerText || '').trim();
    }
  }

  result.text = text || document.body.innerText.slice(0, 5000);
  return result;
}

// Listen for extractor requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extract_content' || message.action === 'extract_gemini') {
    const data = extractGeminiContent();
    sendResponse({ success: true, ...data });
  }
  return true;
});
