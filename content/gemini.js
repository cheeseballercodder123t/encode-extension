// content/gemini.js
// Enhanced content script for Google Gemini (gemini.google.com)
// Injects 1-click [⚡ Encode to Anki] and [📥 DeepEncode Web] buttons directly into Gemini responses
// Injects Socratic Prompt Assistant above the Gemini input bar

function extractGeminiContent() {
  const result = {
    type: 'gemini-chat',
    title: document.title.replace(/ - Gemini$/, '').trim(),
    latestResponse: '',
    fullConversation: '',
    turns: []
  };

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

  if (responseContainers.length > 0) {
    const lastContainer = responseContainers[responseContainers.length - 1];
    result.latestResponse = (lastContainer.innerText || lastContainer.textContent || '').trim();
  }

  if (result.turns.length > 0) {
    result.fullConversation = result.turns
      .map(t => `### ${t.role}\n${t.text}`)
      .join('\n\n');
  }

  const selection = window.getSelection()?.toString()?.trim();
  let text = '';
  if (selection) {
    text = `--- Selected from Gemini ---\n${selection}`;
  } else if (result.latestResponse) {
    text = result.latestResponse;
  } else if (result.fullConversation) {
    text = result.fullConversation;
  } else {
    const md = document.querySelectorAll('.markdown');
    if (md.length > 0) {
      text = (md[md.length - 1].innerText || '').trim();
    }
  }

  result.text = text || document.body.innerText.slice(0, 5000);
  return result;
}

// --- Floating Toast Utility ---
function showToast(message, type = 'success', actionText = null, onAction = null) {
  let toastContainer = document.getElementById('deepencode-toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'deepencode-toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.style.cssText = `
    background: #0f111a;
    color: #f8fafc;
    border: 1px solid ${type === 'error' ? '#ef4444' : '#f59e0b'};
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45), 0 0 12px ${type === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.25)'};
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 400px;
    animation: deepencode-fade-in 0.2s ease-out;
  `;

  const icon = document.createElement('span');
  icon.textContent = type === 'error' ? '⚠️' : '⚡';
  icon.style.fontSize = '16px';
  toast.appendChild(icon);

  const textSpan = document.createElement('div');
  textSpan.innerHTML = message;
  textSpan.style.flex = '1';
  toast.appendChild(textSpan);

  if (actionText && onAction) {
    const actionBtn = document.createElement('button');
    actionBtn.textContent = actionText;
    actionBtn.style.cssText = `
      background: #f59e0b;
      color: #07080d;
      border: none;
      padding: 5px 9px;
      border-radius: 5px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    `;
    actionBtn.addEventListener('click', () => {
      onAction();
      toast.remove();
    });
    toast.appendChild(actionBtn);
  }

  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// --- In-Page Action Button Injection into Gemini Model Responses ---
function injectButtonsIntoGeminiResponses() {
  const responses = document.querySelectorAll(
    'message-content, [data-message-author-role="model"], model-response, .model-response-text'
  );

  responses.forEach(resEl => {
    if (resEl.getAttribute('data-deepencode-injected')) return;
    resEl.setAttribute('data-deepencode-injected', 'true');

    // Create a mini toolbar container
    const toolbar = document.createElement('div');
    toolbar.className = 'deepencode-gemini-actions';
    toolbar.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 10px 0 4px 0;
      user-select: none;
    `;

    // 1. [⚡ Encode to Anki]
    const btnAnki = document.createElement('button');
    btnAnki.innerHTML = '⚡ <span>Encode to Anki</span>';
    btnAnki.title = 'Turn this explanation into atomic, Wozniak-sanitized Anki flashcards';
    btnAnki.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.35);
      color: #f59e0b;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: inherit;
    `;

    btnAnki.addEventListener('mouseenter', () => {
      btnAnki.style.background = 'rgba(245, 158, 11, 0.22)';
      btnAnki.style.borderColor = '#f59e0b';
    });
    btnAnki.addEventListener('mouseleave', () => {
      btnAnki.style.background = 'rgba(245, 158, 11, 0.12)';
      btnAnki.style.borderColor = 'rgba(245, 158, 11, 0.35)';
    });

    btnAnki.addEventListener('click', async (e) => {
      e.stopPropagation();
      const textToEncode = (resEl.innerText || resEl.textContent || '').trim();
      if (!textToEncode) return;

      btnAnki.disabled = true;
      btnAnki.innerHTML = '⏳ <span>Forging cards...</span>';

      chrome.runtime.sendMessage({
        action: 'quick_encode_and_push',
        text: textToEncode,
        title: document.title.replace(/ - Gemini$/, '').trim()
      }, response => {
        btnAnki.disabled = false;
        btnAnki.innerHTML = '⚡ <span>Encode to Anki</span>';

        if (response && response.success) {
          if (response.ankiOffline) {
            showToast(
              `Forged <b>${response.cardCount} cards</b>! Saved in sidebar (open Anki to push).`,
              'success',
              'Open Sidebar',
              () => chrome.runtime.sendMessage({ action: 'open_sidepanel' })
            );
          } else {
            showToast(
              `Added <b>${response.added} cards</b> to <code>${response.deck}</code> (${response.skipped} duplicates skipped).`,
              'success',
              'Open Sidebar',
              () => chrome.runtime.sendMessage({ action: 'open_sidepanel' })
            );
          }
        } else {
          showToast(
            `Failed: ${response?.error || 'Check your Gemini API key in extension settings.'}`,
            'error',
            'Settings',
            () => chrome.runtime.sendMessage({ action: 'open_sidepanel' })
          );
        }
      });
    });

    // 2. [📥 DeepEncode Web]
    const btnWeb = document.createElement('button');
    btnWeb.innerHTML = '📥 <span>Open in DeepEncode</span>';
    btnWeb.title = 'Open full interactive workout & flashcard studio in DeepEncode';
    btnWeb.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #94a3b8;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: inherit;
    `;

    btnWeb.addEventListener('mouseenter', () => {
      btnWeb.style.color = '#f8fafc';
      btnWeb.style.borderColor = 'rgba(255, 255, 255, 0.3)';
    });
    btnWeb.addEventListener('mouseleave', () => {
      btnWeb.style.color = '#94a3b8';
      btnWeb.style.borderColor = 'rgba(255, 255, 255, 0.15)';
    });

    btnWeb.addEventListener('click', (e) => {
      e.stopPropagation();
      const textToEncode = (resEl.innerText || resEl.textContent || '').trim();
      chrome.runtime.sendMessage({
        action: 'open_deepencode',
        text: textToEncode,
        auto: 'forge'
      });
    });

    toolbar.appendChild(btnAnki);
    toolbar.appendChild(btnWeb);
    resEl.appendChild(toolbar);
  });
}

// --- In-Page Socratic Prompt Assistant above Gemini Input Box ---
function injectSocraticPromptChip() {
  if (document.getElementById('deepencode-socratic-chip')) return;

  const chatInputContainer = document.querySelector(
    '.input-area, .chat-input-container, rich-textarea, .text-input-field, form[action*="chat"]'
  );
  if (!chatInputContainer) return;

  const chipContainer = document.createElement('div');
  chipContainer.id = 'deepencode-socratic-chip';
  chipContainer.style.cssText = `
    display: flex;
    gap: 8px;
    margin-bottom: 6px;
    padding: 2px 4px;
    user-select: none;
  `;

  const chip = document.createElement('button');
  chip.type = 'button';
  chip.innerHTML = '💡 <span>Insert Socratic Slide Prompt</span>';
  chip.title = 'Pre-fill Gemini with a high-yield learning prompt (causal mechanisms, analogies, lookalike traps)';
  chip.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px dashed rgba(245, 158, 11, 0.4);
    color: #f59e0b;
    padding: 4px 10px;
    border-radius: 14px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
  `;

  chip.addEventListener('mouseenter', () => {
    chip.style.background = 'rgba(245, 158, 11, 0.2)';
  });
  chip.addEventListener('mouseleave', () => {
    chip.style.background = 'rgba(245, 158, 11, 0.1)';
  });

  chip.addEventListener('click', () => {
    const promptText = `I have uploaded / attached my lecture slides. For the key concepts:
1. Explain the underlying CAUSAL MECHANISM (why it works step-by-step).
2. Give one intuitive REAL-WORLD ANALOGY.
3. Identify the #1 LOOKALIKE TRAP (what students commonly confuse it with, and why that misconception fails).`;

    const inputEl = document.querySelector('rich-textarea p, textarea, [contenteditable="true"]');
    if (inputEl) {
      if (inputEl.tagName === 'TEXTAREA') {
        inputEl.value = promptText;
      } else {
        inputEl.textContent = promptText;
      }
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.focus();
      showToast('Inserted Socratic learning prompt into Gemini!', 'success');
    }
  });

  chipContainer.appendChild(chip);
  chatInputContainer.parentElement?.insertBefore(chipContainer, chatInputContainer);
}

// Observe DOM for streaming responses and layout updates
const observer = new MutationObserver(() => {
  injectButtonsIntoGeminiResponses();
  injectSocraticPromptChip();
});
observer.observe(document.body, { childList: true, subtree: true });
setTimeout(() => {
  injectButtonsIntoGeminiResponses();
  injectSocraticPromptChip();
}, 1200);

// Listen for extractor requests from sidebar/popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extract_content' || message.action === 'extract_gemini') {
    const data = extractGeminiContent();
    sendResponse({ success: true, ...data });
  }
  return true;
});
