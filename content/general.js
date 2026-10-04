// content/general.js
// General content extractor for articles, textbooks, and web pages

function extractGeneralContent() {
  const selection = window.getSelection()?.toString()?.trim();
  const title = document.title;
  const url = window.location.href;

  if (selection) {
    return {
      type: 'selection',
      title,
      url,
      text: selection
    };
  }

  // Look for main content container
  const mainArticle = document.querySelector('article, main, [role="main"], #content, .content, .post-content, #bodyContent');
  let bodyText = '';
  if (mainArticle) {
    bodyText = mainArticle.innerText;
  } else {
    // Collect all paragraphs
    const paragraphs = Array.from(document.querySelectorAll('p, h1, h2, h3, li'))
      .map(p => p.innerText.trim())
      .filter(t => t.length > 20);
    bodyText = paragraphs.slice(0, 30).join('\n\n');
  }

  return {
    type: 'webpage',
    title,
    url,
    text: bodyText ? `Title: ${title}\nURL: ${url}\n\n${bodyText.slice(0, 8000)}` : title
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extract_content' || message.action === 'extract_general') {
    const data = extractGeneralContent();
    sendResponse({ success: true, ...data });
  }
  return true;
});
