// lib/anki.js
// Client for AnkiConnect API (localhost:8765)

export class AnkiConnectClient {
  constructor(url = 'http://127.0.0.1:8765') {
    this.url = url;
  }

  async invoke(action, params = {}) {
    const payload = { action, version: 6, params };
    // Send via chrome.runtime background message to prevent mixed content & CORS hurdles
    const response = await chrome.runtime.sendMessage({
      action: 'anki_request',
      payload
    });

    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to reach AnkiConnect. Is Anki open with AnkiConnect enabled?');
    }

    const { error, result } = response.data;
    if (error) {
      throw new Error(`AnkiConnect Error: ${error}`);
    }

    return result;
  }

  async checkConnection() {
    try {
      const version = await this.invoke('version');
      return { connected: true, version };
    } catch (err) {
      return { connected: false, error: err.message };
    }
  }

  async ensureDeck(deckName) {
    return await this.invoke('createDeck', { deck: deckName });
  }

  async getExistingFronts(deckName) {
    try {
      const noteIds = await this.invoke('findNotes', { query: `deck:"${deckName}"` });
      if (!noteIds || noteIds.length === 0) return new Set();
      const notesInfo = await this.invoke('notesInfo', { notes: noteIds.slice(-200) });
      const fronts = new Set();
      for (const info of notesInfo) {
        if (info.fields && (info.fields.Front || info.fields.Text)) {
          const val = (info.fields.Front?.value || info.fields.Text?.value || '').trim();
          fronts.add(val.toLowerCase());
        }
      }
      return fronts;
    } catch {
      return new Set();
    }
  }

  async pushCards(deckName, cards) {
    await this.ensureDeck(deckName);
    const existing = await this.getExistingFronts(deckName);

    const notesToAdd = [];
    let skippedCount = 0;

    for (const card of cards) {
      // Deduplicate against existing fronts in deck
      const normFront = card.front.toLowerCase().trim();
      if (existing.has(normFront)) {
        skippedCount++;
        continue;
      }

      if (card.type === 'cloze') {
        notesToAdd.push({
          deckName,
          modelName: 'Cloze',
          fields: {
            Text: card.front,
            'Extra': card.trap ? `<b>Lookalike Trap:</b> ${card.trap}` : ''
          },
          tags: ['DeepEncode', 'ChromeExtension', 'AutoForged']
        });
      } else {
        // Basic model
        notesToAdd.push({
          deckName,
          modelName: 'Basic',
          fields: {
            Front: card.front,
            Back: card.back + (card.trap ? `<br><br><small style="color:#d97706"><b>Trap:</b> ${card.trap}</small>` : '')
          },
          tags: ['DeepEncode', 'ChromeExtension', 'AutoForged']
        });
      }
    }

    if (notesToAdd.length === 0) {
      return { added: 0, skipped: skippedCount, total: cards.length };
    }

    const results = await this.invoke('addNotes', { notes: notesToAdd });
    const addedCount = results.filter(id => id !== null).length;

    return {
      added: addedCount,
      skipped: skippedCount,
      failed: notesToAdd.length - addedCount,
      total: cards.length
    };
  }
}
