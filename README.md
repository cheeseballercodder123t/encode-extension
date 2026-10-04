# Encode Companion — Chrome Extension

> **Zero-friction cognitive flashcard companion for [DeepEncode](https://github.com/cheeseballercodder123t/Encode).**  
> Turn your Google Slides, Gemini chats, and web materials directly into high-yield **Anki** and **RemNote** cards from your browser side panel.

---

## ⚡ The Problem It Solves

Chatting with Gemini about your lecture slides is natural and fast. But turning that understanding into durable spaced repetition cards usually means:
1. Copying slide text or Gemini output
2. Opening an app or Anki
3. Reformatting cards to avoid bloated paragraphs
4. Manually organizing decks

**Encode Companion** eliminates this entire friction loop by living directly in Chrome's **Side Panel** and right inside your study tabs:
* **In-Page Gemini Integration:** Injects a glowing `[⚡ Encode to Anki]` button directly beside every Gemini model answer, plus an in-chat Socratic prompt assistant.
* **Google Slides Companion Widget:** Floating overlay pill on slides with `[⚡ Encode Slide to Anki]` (shortcut `Alt+S`), DeepEncode launcher, and slide index tracker.
* **Wozniak 20-Rule Quality Enforcement:** Sanitizes generated cards against the 20-word ceiling and 1-idea rule so you never create review leeches.
* **Direct Anki Push & Native .txt TSV:** Pushes cards directly into your Anki desktop collection via AnkiConnect, or downloads a 1-click importable `.txt` deck with zero add-ons required.
* **RemNote Power Syntax:** Copies cards formatted with `::`, `>>`, and `{{clozes}}`.
* **Voice Active Recall:** Integrated speech dictation (`🎙️`) for verbal recall drills right in your browser sidebar.
* **DeepEncode Studio Bridge:** Send captured materials into the DeepEncode studio with `?source=...&auto=forge` for full interactive Socratic workouts.

---

## 🚀 Installation (Load Unpacked)

1. Clone or download this repository.
2. In Google Chrome, navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked** and select this directory (`encode-extension`).
5. Click the extension icon in your toolbar to open the **Side Panel**.

---

## ⚙️ Setup & Configuration

### 1. Gemini API Key (Optional but Recommended)
* Click the **⚙️ (Settings)** icon in the side panel header.
* Paste your Gemini API key (get a free key at [Google AI Studio](https://aistudio.google.com/)).
* Alternatively, if your browser supports the Chrome Built-in Prompt API (`window.ai`), local on-device generation is automatically supported!

### 2. AnkiConnect (For 1-Tap Anki Push)
1. In the Anki desktop application, install the [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on (code: `2055492159`).
2. Keep Anki open.
3. The side panel badge will automatically display **`Anki v6`** (green) when connected!

---

## 🛠️ Project Structure

```
encode-extension/
├── manifest.json              # Chrome Manifest V3
├── background.js              # Service worker (side panel behavior, Anki proxy, context menus)
├── CHROMEWEBSTORE.md          # Store metadata, permissions justifications, privacy policy
├── icons/                     # 16px, 32px, 48px, 128px PNG icons
├── content/
│   ├── google-slides.js       # Extractor for docs.google.com/presentation
│   ├── gemini.js              # Extractor for gemini.google.com
│   └── general.js             # Generic extractor for articles & text selections
├── sidepanel/
│   ├── sidepanel.html         # Side panel interface (illuminated dark theme)
│   ├── sidepanel.css          # DeepEncode styling & animations
│   └── sidepanel.js           # Controller: capture, forge, export
├── lib/
│   ├── audio.js               # Web Audio API sound feedback
│   ├── wozniak.js             # 20-word ceiling, 1-idea rule, RemNote formatting
│   ├── anki.js                # AnkiConnect API client & duplicate checker
│   └── forge.js               # Flashcard generation engine (Gemini / window.ai)
└── options/
    ├── options.html           # Dedicated options page
    └── options.js             # Options storage logic
```

---

## 📄 License

MIT
