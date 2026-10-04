// lib/forge.js
// Cognitive Flashcard Generator (Gemini API & Chrome Prompt API)

import { sanitizeDeck } from './wozniak.js';

export async function forgeFlashcards({ text, sourceTitle, apiKey, cardStyle = 'balanced' }) {
  if (!text || text.trim().length < 15) {
    throw new Error('Please provide at least a sentence or paragraph of study material to encode.');
  }

  // System instructions inspired by DeepEncode's learning science rules
  const systemPrompt = `You are DeepEncode's Flashcard Forge.
Your mission is to transform notes, lecture slides, and AI conversations into high-yield, durable flashcards based on cognitive learning science:
1. Minimum Information Principle (Piotr Wozniak): The answer/back of a card must NEVER exceed 20 words. Keep it atomic.
2. 1-Idea Rule: Never combine two distinct facts with "and" on one card. Split them.
3. High-Contrast Discrimination: For tricky mechanisms, always identify the "Lookalike Trap" (what students confuse this with).
4. Cloze Deletion Rules: Use {{c1::keyword}} format. Cloze only the pivotal causal word or number, never the entire sentence.

Style requested: "${cardStyle}" (balanced: mix of clozes and mechanisms; cloze_only: rapid clozes; mechanisms: deep causal cards).

Return ONLY valid JSON (no markdown fences, no explanatory chat):
{
  "topic": "Clean 2-4 word topic title",
  "cards": [
    {
      "type": "cloze" | "mechanism" | "drill",
      "front": "Prompt or cloze with {{c1::blank}}",
      "back": "Atomic answer (<= 20 words, or empty if cloze)",
      "trap": "Optional: Common misconception or lookalike"
    }
  ]
}`;

  let rawJsonText = '';

  // 1. Try Gemini API if API key provided
  if (apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${systemPrompt}\n\nSource Title: ${sourceTitle || 'Untitled'}\n\nStudy Material to Encode:\n${text.slice(0, 20000)}` }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gemini API Error (${res.status}): ${errBody.slice(0, 300)}`);
    }

    const data = await res.json();
    rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  } else if (typeof window !== 'undefined' && (window.ai?.languageModel || window.LanguageModel)) {
    // 2. Fallback to Chrome's Built-in Local Prompt API if available
    const lm = window.ai?.languageModel || window.LanguageModel;
    const session = await lm.create({
      systemPrompt
    });
    rawJsonText = await session.prompt(`Source: ${sourceTitle}\n\nMaterial:\n${text.slice(0, 8000)}`);
  } else {
    throw new Error('No Gemini API key set. Click the gear icon (Settings) in the top-right to enter your Gemini API key (or use Chrome Built-in AI).');
  }

  if (!rawJsonText) {
    throw new Error('Received empty response from the AI model.');
  }

  // Strip markdown code fences if model returned ```json ... ```
  let cleaned = rawJsonText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '');
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Failed to parse AI output as JSON: ${e.message}\nRaw text: ${cleaned.slice(0, 200)}...`);
  }

  const rawCards = Array.isArray(parsed.cards) ? parsed.cards : [];
  const topic = parsed.topic || sourceTitle || 'General Knowledge';

  // Run through Wozniak sanitization
  const { cards, stats, dropped } = sanitizeDeck(rawCards);

  return {
    topic,
    cards,
    stats,
    dropped
  };
}
