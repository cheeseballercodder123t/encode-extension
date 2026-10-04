// content/google-slides.js
// Specialized content extractor for Google Slides (docs.google.com/presentation/*)

function extractGoogleSlides() {
  const result = {
    type: 'google-slides',
    title: document.title.replace(/ - Google Slides$/, '').trim(),
    currentSlideNumber: null,
    totalSlides: null,
    slideText: [],
    speakerNotes: '',
    fullText: ''
  };

  // 1. Try to find slide number indicator (e.g. filmstrip or slide picker)
  try {
    const filmstripThumbs = document.querySelectorAll('.punch-filmstrip-thumbnail');
    if (filmstripThumbs && filmstripThumbs.length > 0) {
      result.totalSlides = filmstripThumbs.length;
      filmstripThumbs.forEach((thumb, idx) => {
        if (thumb.classList.contains('punch-filmstrip-thumbnail-selected') || thumb.getAttribute('aria-selected') === 'true') {
          result.currentSlideNumber = idx + 1;
        }
      });
    }
  } catch (e) {
    console.debug('Slide count detection error:', e);
  }

  // 2. Extract SVG text from the current active slide stage
  const activeSlideSvgs = document.querySelectorAll('.punch-viewer-svgpage, .punch-full-screen-element svg, svg.punch-viewer-svgpage-svg');
  const textsFound = new Set();

  function scanSvg(element) {
    if (!element) return;
    const textNodes = element.querySelectorAll('text, tspan');
    textNodes.forEach(node => {
      const text = (node.textContent || '').trim();
      if (text && text.length > 1 && !textsFound.has(text)) {
        textsFound.add(text);
        result.slideText.push(text);
      }
    });
  }

  if (activeSlideSvgs.length > 0) {
    // Usually the last or visible SVG is the main stage
    activeSlideSvgs.forEach(svg => scanSvg(svg));
  } else {
    // Fallback: search any svg text on the page
    document.querySelectorAll('svg text').forEach(t => {
      const txt = (t.textContent || '').trim();
      if (txt && !textsFound.has(txt)) {
        textsFound.add(txt);
        result.slideText.push(txt);
      }
    });
  }

  // 3. Extract speaker notes
  const speakerNoteBoxes = document.querySelectorAll(
    'div[aria-label*="Speaker note" i], div[aria-label*="Notes" i], .punch-notes-text, [role="region"][aria-label*="notes" i]'
  );
  speakerNoteBoxes.forEach(box => {
    const note = (box.innerText || box.textContent || '').trim();
    if (note && note !== 'Click to add speaker notes') {
      result.speakerNotes += (result.speakerNotes ? '\n' : '') + note;
    }
  });

  // 4. Assemble clean combined representation
  let assembled = '';
  if (result.title) assembled += `Title: ${result.title}\n`;
  if (result.currentSlideNumber) {
    assembled += `Slide ${result.currentSlideNumber}${result.totalSlides ? ' of ' + result.totalSlides : ''}\n\n`;
  }
  if (result.slideText.length > 0) {
    assembled += '--- Slide Content ---\n' + result.slideText.join('\n') + '\n\n';
  }
  if (result.speakerNotes) {
    assembled += '--- Speaker Notes ---\n' + result.speakerNotes + '\n';
  }

  // Fallback to active selection if SVG scraping didn't catch rich canvas text
  const selection = window.getSelection()?.toString()?.trim();
  if (selection) {
    assembled += (assembled ? '\n--- Selected Text ---\n' : '') + selection;
  }

  result.fullText = assembled.trim() || document.title;
  return result;
}

// Listen for extractor requests from side panel or background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extract_content' || message.action === 'extract_google_slides') {
    const data = extractGoogleSlides();
    sendResponse({ success: true, ...data, text: data.fullText });
  }
  return true;
});
