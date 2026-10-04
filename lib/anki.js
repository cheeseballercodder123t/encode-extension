// lib/anki.js
// Client for AnkiConnect API (localhost:8765) and native Anki TSV Exporter

export class AnkiConnectClient {
  constructor(url = 'http://127.0.0.1:8765') {
    this.url = url;
  }

  async getUrl() {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        const { ankiConnectUrl } = await chrome.storage.local.get('ankiConnectUrl');
        if (ankiConnectUrl) return ankiConnectUrl;
      } catch {}
    }
    return this.url;
  }

  async invoke(action, params = {}) {
    const payload = { action, version: 6, params };
    const targetUrl = await this.getUrl();

    // 1. Try direct fetch first (works directly in Service Worker background, Sidepanel, Options)
    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.error) throw new Error(`AnkiConnect: ${data.error}`);
        return data.result;
      }
    } catch (directErr) {
      // 2. If direct fetch fails (e.g. in a Content Script with strict CSP blocking localhost),
      // proxy through chrome.runtime.sendMessage if we are in a content script
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        try {
          const response = await chrome.runtime.sendMessage({
            action: 'anki_request',
            payload
          });
          if (response && response.success) {
            const { error, result } = response.data;
            if (error) throw new Error(`AnkiConnect: ${error}`);
            return result;
          }
        } catch {}
      }
      throw new Error(`Cannot connect to Anki at ${targetUrl}. Is Anki open with AnkiConnect add-on installed (code: 2055492159)?`);
    }
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
      const normFront = (card.front || '').toLowerCase().trim();
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
    const addedCount = Array.isArray(results) ? results.filter(id => id !== null).length : 0;

    return {
      added: addedCount,
      skipped: skippedCount,
      failed: notesToAdd.length - addedCount,
      total: cards.length
    };
  }

  /**
   * Generates a native Anki-importable TSV text format (works without AnkiConnect)
   * Users can simply drag or File -> Import this file directly into Anki desktop or AnkiWeb.
   */
  static generateAnkiTsv(cards, tag = 'DeepEncode') {
    const lines = [
      '#separator:tab',
      '#html:true',
      '#tags column:3'
    ];

    for (const c of cards) {
      const front = (c.front || '').replace(/\t/g, ' ').replace(/\n/g, '<br>');
      const back = (c.back || '').replace(/\t/g, ' ').replace(/\n/g, '<br>') +
        (c.trap ? `<br><small style="color:#d97706"><b>Trap:</b> ${c.trap.replace(/\t/g, ' ')}</small>` : '');
      lines.push(`${front}\t${back}\t${tag}`);
    }

    return lines.join('\n');
  }
}
