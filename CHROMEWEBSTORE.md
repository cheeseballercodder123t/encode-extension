# Chrome Web Store Listing & Compliance

## Metadata

* **Name:** Encode Companion — 1-Click Slides & Gemini to Anki
* **Version:** 1.0.0
* **Category:** Productivity / Education
* **Short Description:** Zero-friction flashcard companion: Capture Google Slides, Gemini chat, or any webpage into Anki & RemNote.

### Detailed Description

Turn your slides, AI chats, and study materials into durable flashcards without copy-paste fatigue.

Encode Companion connects your everyday learning flow (Google Slides, Gemini chats, digital textbooks, and web articles) directly to Anki and RemNote.

### Features
* **1-Click Google Slides Capture**: Instantly extracts the current slide's content, titles, and speaker notes directly into the sidebar.
* **1-Click Gemini Chat Capture**: Capture Gemini explanations and study summaries straight into flashcards without switching tabs.
* **Cognitive Flashcard Forge**: Employs cognitive learning principles to generate atomic clozes, 4-quadrant concept cards, and practice drills.
* **Wozniak 20-Rule Sanitization**: Enforces the 20-word ceiling and 1-idea rule so your cards never turn into frustrating review leeches.
* **Direct Anki Push**: 1-click push to Anki via AnkiConnect (`DeepEncode::{Topic}`) with duplicate detection.
* **RemNote Power Syntax**: One-click copy formatted with bidirectional `::`, forward `>>`, and cloze deletion tags.
* **DeepEncode Studio Bridge**: Send captured materials into the DeepEncode studio for full interactive workouts.

---

## Permissions Justification

| Permission | Plain-English Justification |
| :--- | :--- |
| `sidePanel` | Displays the companion interface alongside active study materials (slides, chats, articles) without covering the page. |
| `storage` | Stores user preferences (Anki deck name, API keys) and persists pending captured selections locally on device. |
| `tabs` | Identifies whether the active tab is Google Slides, Gemini, or a webpage to configure the 1-click capture action. |
| `scripting` | Injects content extractors into Google Slides or Gemini on demand when the user clicks the "Grab" button. |
| `activeTab` | Reads the currently highlighted text or active slide content only when explicitly triggered by the user. |
| `contextMenus` | Adds a right-click "Encode selection with DeepEncode" option for fast capture from any webpage. |

### Host Permissions Justification

| Host Pattern | Justification |
| :--- | :--- |
| `https://docs.google.com/presentation/*` | Required to extract slide text, speaker notes, and presentation titles from Google Slides. |
| `https://gemini.google.com/*` | Required to extract response messages and conversation summaries from Gemini chat. |
| `http://127.0.0.1:8765/*`, `http://localhost:8765/*` | Required to communicate with the local AnkiConnect desktop add-on to push cards directly to Anki. |
| `<all_urls>` | Allows capturing highlighted text selections or articles from web textbooks and educational resources across the web. |

---

## Privacy & Data Use

* **Data Collection**: No personal user data or analytics are collected or transmitted to external third-party tracking servers.
* **API Keys**: User-provided Gemini API keys are stored exclusively in `chrome.storage.local` on the user's machine and are transmitted solely to the official Google Gemini API endpoint.
* **Study Material**: Extracted study text is processed directly via the user's configured AI key and exported to the user's local Anki client or clipboard.
