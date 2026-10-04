// lib/wozniak.js
// Wozniak Sanitization & Card Quality Engine (ported from DeepEncode)
// Grounded in SuperMemo 20 Rules of Formulating Knowledge (Piotr Wozniak)

export function sanitizeCard(card) {
  const result = {
    ...card,
    warnings: [],
    valid: true
  };

  // 1. Minimum Information Principle (20-word ceiling on answers/backs)
  if (result.back) {
    const wordCount = result.back.trim().split(/\s+/).length;
    if (wordCount > 20) {
      result.warnings.push(`Back exceeds 20 words (${wordCount} words). High risk of leech.`);
      result.isLeechRisk = true;
    }
  }

  // 2. Cloze formatting validation & normalization
  if (result.type === 'cloze' || (result.front && result.front.includes('{{'))) {
    result.type = 'cloze';
    // Ensure properly closed clozes
    const openCount = (result.front.match(/\{\{c\d+::/g) || []).length;
    const closeCount = (result.front.match(/\}\}/g) || []).length;
    if (openCount !== closeCount) {
      result.warnings.push('Malformed cloze syntax: mismatched {{ and }} brackets.');
      result.valid = false;
    }

    // Normalize cloze indices to dense sequence c1, c2, ...
    let clozeIdx = 1;
    result.front = result.front.replace(/\{\{c\d+::(.*?)\}\}/g, (match, content) => {
      return `{{c${clozeIdx++}::${content}}}`;
    });
  }

  // 3. One-Idea Rule check (Split compound sentences joining unrelated assertions)
  if (result.back && result.back.includes(' and ') && result.back.length > 60) {
    result.warnings.push('Compound answer detected: Consider splitting into 2 atomic cards.');
  }

  return result;
}

export function sanitizeDeck(cards) {
  const sanitized = [];
  const dropped = [];

  for (const raw of cards) {
    const card = sanitizeCard(raw);
    if (!card.front || (!card.back && card.type !== 'cloze')) {
      dropped.push({ card, reason: 'Empty front or missing back' });
      continue;
    }
    sanitized.push(card);
  }

  return {
    cards: sanitized,
    dropped,
    stats: {
      total: cards.length,
      clean: sanitized.filter(c => c.warnings.length === 0).length,
      warnings: sanitized.filter(c => c.warnings.length > 0).length,
      dropped: dropped.length
    }
  };
}

export function formatForRemNote(cards) {
  // RemNote Power Syntax
  // >> for forward only
  // :: for concept / two-way
  // {{cloze}} for clozes
  return cards.map(c => {
    if (c.type === 'cloze') {
      // RemNote recognizes {{text}} as cloze deletion natively
      return c.front.replace(/\{\{c\d+::(.*?)\}\}/g, '{{$1}}');
    }
    if (c.type === 'mechanism') {
      let line = `${c.front} :: ${c.back}`;
      if (c.trap) {
        line += `\n    #[[Extra Card Detail]] Trap / Lookalike: ${c.trap}`;
      }
      return line;
    }
    // Standard Q/A: use forward-only >> to avoid backwards nonsensical questions
    return `${c.front} >> ${c.back}`;
  }).join('\n\n');
}
