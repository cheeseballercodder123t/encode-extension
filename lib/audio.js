// lib/audio.js
// Lightweight Web Audio API synthesizer for tactile auditory feedback (zero external audio files)

class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  playBeep(freq, type = 'sine', duration = 0.12, gainLevel = 0.08) {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainLevel, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Audio playback fails silently if browser blocks before user gesture
    }
  }

  playSuccess() {
    this.playBeep(523.25, 'triangle', 0.1, 0.05); // C5
    setTimeout(() => this.playBeep(659.25, 'triangle', 0.1, 0.05), 80); // E5
    setTimeout(() => this.playBeep(783.99, 'triangle', 0.18, 0.06), 160); // G5
  }

  playPop() {
    this.playBeep(620, 'sine', 0.04, 0.03);
  }

  playChime() {
    this.playBeep(440, 'sine', 0.08, 0.04);
    setTimeout(() => this.playBeep(554.37, 'sine', 0.08, 0.04), 70);
    setTimeout(() => this.playBeep(659.25, 'sine', 0.14, 0.05), 140);
  }

  playError() {
    this.playBeep(240, 'sawtooth', 0.15, 0.05);
  }
}

export const sound = new SoundFX();
