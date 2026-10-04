// content/google-slides.js
// Enhanced content script for Google Slides (docs.google.com/presentation/*)
// Injects floating companion pill: [⚡ Encode Slide (Alt+S)], [📥 DeepEncode Web], and [📖 Sidebar]

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
    activeSlideSvgs.forEach(svg => scanSvg(svg));
  } else {
    document.querySelectorAll('svg text').forEach(t => {
      const txt = (t.textContent || '').trim();
      if (txt && !textsFound.has(txt)) {
        textsFound.add(txt);
        result.slideText.push(txt);
      }
    });
  }

  const speakerNoteBoxes = document.querySelectorAll(
    'div[aria-label*="Speaker note" i], div[aria-label*="Notes" i], .punch-notes-text, [role="region"][aria-label*="notes" i]'
  );
  speakerNoteBoxes.forEach(box => {
    const note = (box.innerText || box.textContent || '').trim();
    if (note && note !== 'Click to add speaker notes') {
      result.speakerNotes += (result.speakerNotes ? '\n' : '') + note;
    }
  });

  // Detect visual diagram presence & spatial labels in SVG / Canvas
  result.diagramLabels = [];
  result.hasDiagram = false;
  try {
    const activeSvg = document.querySelector('.punch-viewer-svgpage svg, svg.punch-viewer-svgpage-svg, .punch-full-screen-element svg');
    if (activeSvg) {
      const paths = activeSvg.querySelectorAll('path, ellipse, polygon, polyline, line');
      const images = activeSvg.querySelectorAll('image');
      const rects = activeSvg.querySelectorAll('rect');

      const visualShapeCount = paths.length + images.length + (rects.length > 2 ? rects.length : 0);
      if (visualShapeCount >= 3 || images.length > 0) {
        result.hasDiagram = true;
      }

      const svgRect = activeSvg.getBoundingClientRect ? activeSvg.getBoundingClientRect() : { left: 0, top: 0, width: 800, height: 600 };
      const svgW = svgRect.width || 800;
      const svgH = svgRect.height || 600;

      const textNodes = Array.from(activeSvg.querySelectorAll('text, tspan'));
      const spatialItems = [];
      const seenTexts = new Set();

      textNodes.forEach(node => {
        const txt = (node.textContent || '').trim();
        if (txt && txt.length > 1 && !seenTexts.has(txt)) {
          seenTexts.add(txt);
          let posX = 'Center';
          let posY = 'Middle';
          try {
            const b = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
            if (b) {
              const relX = (b.left - svgRect.left) / svgW;
              const relY = (b.top - svgRect.top) / svgH;
              posX = relX < 0.33 ? 'Left' : relX > 0.66 ? 'Right' : 'Center';
              posY = relY < 0.33 ? 'Top' : relY > 0.66 ? 'Bottom' : 'Middle';
            }
          } catch (err) {}
          spatialItems.push({
            text: txt,
            position: `${posY} ${posX}`.trim()
          });
        }
      });

      const diagramLabels = spatialItems.filter(item => item.text.split(/\s+/).length <= 10);
      if (diagramLabels.length >= 2) {
        result.hasDiagram = true;
        result.diagramLabels = diagramLabels;
      }
    }
  } catch (diagErr) {
    console.debug('Diagram extraction error:', diagErr);
  }

  let assembled = '';
  if (result.title) assembled += `Presentation: ${result.title}\n`;
  if (result.currentSlideNumber) {
    assembled += `Slide ${result.currentSlideNumber}${result.totalSlides ? ' of ' + result.totalSlides : ''}\n\n`;
  }
  if (result.slideText.length > 0) {
    assembled += '--- Slide Content ---\n' + result.slideText.join('\n') + '\n\n';
  }
  if (result.diagramLabels && result.diagramLabels.length > 0) {
    assembled += '--- Diagram & Spatial Labels ---\n' +
      result.diagramLabels.map((lbl, idx) => `[Slot ${idx + 1}]: "${lbl.text}" (${lbl.position})`).join('\n') + '\n\n';
  }
  if (result.speakerNotes) {
    assembled += '--- Speaker Notes ---\n' + result.speakerNotes + '\n';
  }

  const selection = window.getSelection()?.toString()?.trim();
  if (selection) {
    assembled += (assembled ? '\n--- Selected Text ---\n' : '') + selection;
  }

  result.fullText = assembled.trim() || document.title;
  return result;
}

// --- Floating Toast Utility ---
function showSlidesToast(message, type = 'success', actionText = null, onAction = null) {
  let toast = document.getElementById('deepencode-slides-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'deepencode-slides-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 74px;
      right: 24px;
      z-index: 999999;
      background: #0f111a;
      color: #f8fafc;
      border: 1px solid ${type === 'error' ? '#ef4444' : '#f59e0b'};
      box-shadow: 0 6px 24px rgba(0,0,0,0.5), 0 0 12px rgba(245,158,11,0.25);
      padding: 12px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      transition: all 0.25s ease;
      display: flex;
      align-items: center;
      gap: 12px;
      max-width: 420px;
    `;
    document.body.appendChild(toast);
  }

  toast.innerHTML = '';
  const icon = document.createElement('span');
  icon.textContent = type === 'error' ? '⚠️' : '⚡';
  toast.appendChild(icon);

  const textDiv = document.createElement('div');
  textDiv.innerHTML = message;
  textDiv.style.flex = '1';
  toast.appendChild(textDiv);

  if (actionText && onAction) {
    const actBtn = document.createElement('button');
    actBtn.textContent = actionText;
    actBtn.style.cssText = `
      background: #f59e0b;
      color: #07080d;
      border: none;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
    `;
    actBtn.addEventListener('click', () => {
      onAction();
      toast.remove();
    });
    toast.appendChild(actBtn);
  }

  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// --- Floating Slides Overlay Companion Widget ---
function injectSlidesCompanionWidget() {
  if (document.getElementById('deepencode-slides-companion')) return;

  const widget = document.createElement('div');
  widget.id = 'deepencode-slides-companion';
  widget.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 24px;
    z-index: 999998;
    background: #0f111a;
    border: 1px solid rgba(245, 158, 11, 0.4);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), 0 0 12px rgba(245, 158, 11, 0.15);
    border-radius: 30px;
    padding: 6px 10px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    user-select: none;
    transition: all 0.2s ease;
  `;

  // 1. Encode Slide Button (Alt+S)
  const btnSlide = document.createElement('button');
  btnSlide.innerHTML = '⚡ <b>Encode Slide to Anki</b>';
  btnSlide.title = 'Instantly extract this slide and add atomic flashcards to Anki (Shortcut: Alt+S)';
  btnSlide.style.cssText = `
    background: #f59e0b;
    color: #07080d;
    border: none;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
  `;
  btnSlide.addEventListener('mouseenter', () => {
    btnSlide.style.background = '#d97706';
    btnSlide.style.boxShadow = '0 0 10px rgba(245, 158, 11, 0.4)';
  });
  btnSlide.addEventListener('mouseleave', () => {
    btnSlide.style.background = '#f59e0b';
    btnSlide.style.boxShadow = 'none';
  });

  btnSlide.addEventListener('click', async () => {
    const data = extractGoogleSlides();
    if (!data.fullText || data.fullText.length < 15) {
      showSlidesToast('No text detected on the active slide. Select text or ensure slide contains content.', 'error');
      return;
    }

    btnSlide.disabled = true;
    btnSlide.innerHTML = '⏳ <b>Forging...</b>';

    chrome.runtime.sendMessage({
      action: 'quick_encode_and_push',
      text: data.fullText,
      title: `${data.title} - Slide ${data.currentSlideNumber || ''}`
    }, response => {
      btnSlide.disabled = false;
      btnSlide.innerHTML = '⚡ <b>Encode Slide to Anki</b>';

      if (response && response.success) {
        if (response.ankiOffline) {
          showSlidesToast(
            `Forged <b>${response.cardCount} cards</b>! Saved in sidebar (open Anki to push).`,
            'success',
            'Open Sidebar',
            () => chrome.runtime.sendMessage({ action: 'open_sidepanel' })
          );
        } else {
          showSlidesToast(
            `Added <b>${response.added} cards</b> to <code>${response.deck}</code> (${response.skipped} duplicates skipped).`,
            'success',
            'Open Sidebar',
            () => chrome.runtime.sendMessage({ action: 'open_sidepanel' })
          );
        }
      } else {
        showSlidesToast(
          `Failed: ${response?.error || 'Check extension settings'}`,
          'error',
          'Settings',
          () => chrome.runtime.sendMessage({ action: 'open_sidepanel' })
        );
      }
    });
  });

  // 2. Open in DeepEncode Web Button
  const btnWeb = document.createElement('button');
  btnWeb.innerHTML = '📥 DeepEncode';
  btnWeb.title = 'Open this slide in DeepEncode Full Web App';
  btnWeb.style.cssText = `
    background: rgba(255, 255, 255, 0.06);
    color: #e2e8f0;
    border: 1px solid rgba(255, 255, 255, 0.12);
    padding: 6px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  `;
  btnWeb.addEventListener('mouseenter', () => {
    btnWeb.style.background = 'rgba(255, 255, 255, 0.15)';
  });
  btnWeb.addEventListener('mouseleave', () => {
    btnWeb.style.background = 'rgba(255, 255, 255, 0.06)';
  });
  btnWeb.addEventListener('click', () => {
    const data = extractGoogleSlides();
    chrome.runtime.sendMessage({
      action: 'open_deepencode',
      text: data.fullText,
      auto: 'forge'
    });
  });

  // 3. Open Sidebar Button
  const btnOpen = document.createElement('button');
  btnOpen.textContent = '📖 Sidebar';
  btnOpen.title = 'Open Encode Companion side panel';
  btnOpen.style.cssText = `
    background: transparent;
    color: #94a3b8;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 6px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  `;
  btnOpen.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'open_sidepanel' });
  });

  widget.appendChild(btnSlide);
  widget.appendChild(btnWeb);
  widget.appendChild(btnOpen);
  document.body.appendChild(widget);
}

// Keyboard shortcut: Alt+S to encode slide
window.addEventListener('keydown', (e) => {
  if (e.altKey && (e.key === 's' || e.key === 'S')) {
    e.preventDefault();
    const btn = document.querySelector('#deepencode-slides-companion button');
    if (btn) btn.click();
  }
});

setTimeout(injectSlidesCompanionWidget, 1500);

// Listen for extractor requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extract_content' || message.action === 'extract_google_slides') {
    const data = extractGoogleSlides();
    sendResponse({ success: true, ...data, text: data.fullText });
  }
  return true;
});
