// WebAudio synthesized SFX + procedural per-zone music sequencer + voice beeps.
// Every sound is generated in code so the game ships with zero audio assets,
// but each call site is named so real recorded assets can replace them later.
import { state } from './state.js';

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Per-zone music presets: tempo, bass pattern (midi), lead pattern, vibe.
const MUSIC = {
  menu:     { bpm: 96,  bass: [38, 38, 45, 43], lead: [62, 65, 69, 67, 65, 62, 60, 62], wave: 'square', hat: 2, vibe: 'hero' },
  mansion:  { bpm: 88,  bass: [36, 36, 43, 41], lead: [60, 64, 67, 64, 62, 59, 60, 0],  wave: 'triangle', hat: 2, vibe: 'chill' },
  brisbane: { bpm: 112, bass: [40, 40, 47, 45], lead: [64, 67, 71, 69, 67, 64, 62, 64], wave: 'sawtooth', hat: 1, vibe: 'funk' },
  sydney:   { bpm: 100, bass: [38, 41, 45, 41], lead: [65, 0, 69, 72, 0, 69, 65, 0],   wave: 'sine', hat: 2, vibe: 'airport' },
  hongkong: { bpm: 140, bass: [33, 33, 33, 40], lead: [57, 60, 64, 63, 60, 57, 55, 57], wave: 'sawtooth', hat: 1, vibe: 'tekk' },
  shenzhen: { bpm: 150, bass: [31, 31, 38, 36], lead: [55, 58, 62, 61, 58, 55, 53, 55], wave: 'sawtooth', hat: 1, vibe: 'cyber' },
  void:     { bpm: 70,  bass: [36, 0, 43, 0],   lead: [72, 0, 76, 0, 79, 0, 74, 0],    wave: 'sine', hat: 4, vibe: 'glitch' },
  boss:     { bpm: 160, bass: [29, 29, 36, 29], lead: [53, 56, 60, 59, 56, 53, 51, 53], wave: 'square', hat: 1, vibe: 'chaos' },
};

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.currentTrack = null;
    this._seqTimer = null;
    this._step = 0;
    this._nextNoteTime = 0;
    // Named looping sounds (e.g. trolley boost). Each entry owns its nodes
    // and a stop() that fades out and disposes them. startLoop/stopLoop are
    // idempotent: callers may NOT spam them per frame — but if they do,
    // nothing breaks because we check existence first.
    this.loops = {};
  }

  // Must be called from a user gesture.
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.musicGain.gain.value = state.settings.music * 0.5;
    this.sfxGain.gain.value = state.settings.sfx;
  }

  resume() { this.ctx?.resume?.(); }

  // ---------- LOOPING SFX ----------
  // Start a named loop exactly once. Subsequent calls while running are no-ops.
  startLoop(name) {
    if (!this.ctx || this.loops[name]) return;
    const t = this.ctx.currentTime;
    if (name === 'boost') {
      // Ridiculous turbo: LFO-wobbled saw through a lowpass + hiss.
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = 88;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 12;
      const lfoG = this.ctx.createGain(); lfoG.gain.value = 22;
      lfo.connect(lfoG); lfoG.connect(o.frequency);
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 950;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.1);
      // Looping noise hiss
      const len = Math.floor(this.ctx.sampleRate * 0.5);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.4;
      const noise = this.ctx.createBufferSource();
      noise.buffer = buf; noise.loop = true;
      const nf = this.ctx.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 1800;
      const ng = this.ctx.createGain(); ng.gain.value = 0.035;
      o.connect(f); f.connect(g); g.connect(this.sfxGain);
      noise.connect(nf); nf.connect(ng); ng.connect(this.sfxGain);
      o.start(t); lfo.start(t); noise.start(t);
      this.loops[name] = {
        stop: () => {
          const t2 = this.ctx.currentTime;
          g.gain.cancelScheduledValues(t2);
          g.gain.setValueAtTime(g.gain.value, t2);
          g.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.15);
          ng.gain.setValueAtTime(ng.gain.value, t2);
          ng.gain.linearRampToValueAtTime(0, t2 + 0.15);
          o.stop(t2 + 0.2); lfo.stop(t2 + 0.2); noise.stop(t2 + 0.2);
        },
      };
    }
  }

  // Stop a named loop exactly once. No-op if it isn't running.
  stopLoop(name) {
    const l = this.loops[name];
    if (!l) return;
    delete this.loops[name];
    try { l.stop(); } catch { /* audio teardown must never break gameplay */ }
  }

  stopAllLoops() { for (const k of Object.keys(this.loops)) this.stopLoop(k); }

  loopRunning(name) { return !!this.loops[name]; }

  // ---------- MUSIC SEQUENCER ----------
  playMusic(trackName) {
    if (!this.ctx || this.currentTrack === trackName) return;
    this.stopMusic();
    const preset = MUSIC[trackName] || MUSIC.menu;
    this.currentTrack = trackName;
    this._step = 0;
    this._nextNoteTime = this.ctx.currentTime + 0.1;
    const stepDur = 60 / preset.bpm / 2; // 8th notes
    this._seqTimer = setInterval(() => {
      while (this._nextNoteTime < this.ctx.currentTime + 0.2) {
        this._scheduleStep(preset, this._nextNoteTime);
        this._nextNoteTime += stepDur;
        this._step++;
      }
    }, 60);
  }

  stopMusic() {
    if (this._seqTimer) clearInterval(this._seqTimer);
    this._seqTimer = null;
    this.currentTrack = null;
  }

  _scheduleStep(p, t) {
    const s = this._step;
    // Bass every 2 steps
    if (s % 2 === 0) {
      const note = p.bass[(s / 2) % p.bass.length];
      if (note) this._note(this.musicGain, midi(note), t, 0.28, 'triangle', 0.22);
    }
    // Lead
    const lead = p.lead[s % p.lead.length];
    if (lead) this._note(this.musicGain, midi(lead), t, 0.16, p.wave, 0.06);
    // Hat (noise tick)
    if (s % p.hat === 0) this._noise(this.musicGain, t, 0.03, 6000, 0.035);
    // Kick on the beat for energetic tracks
    if (p.bpm >= 110 && s % 4 === 0) this._kick(this.musicGain, t, 0.16);
  }

  _note(dest, freq, t, dur, wave = 'sine', vol = 0.1, slide = 0) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = wave; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }

  _noise(dest, t, dur, hp = 1000, vol = 0.08) {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t);
  }

  _kick(dest, t, vol = 0.2) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + 0.15);
  }

  // ---------- SFX ----------
  sfx(name) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const G = this.sfxGain;
    switch (name) {
      case 'rebar':       this._note(G, 1320, t, 0.18, 'square', 0.10); this._note(G, 1980, t + 0.06, 0.2, 'sine', 0.08); break;
      case 'coin':        this._note(G, 1568, t, 0.1, 'sine', 0.12); this._note(G, 2093, t + 0.07, 0.18, 'sine', 0.1); break;
      case 'shard':       this._note(G, 880, t, 0.3, 'sine', 0.12, 600); this._note(G, 1320, t + 0.1, 0.3, 'sine', 0.09, 800); break;
      case 'portal':      this._noise(G, t, 0.22, 800, 0.1); this._note(G, 500, t, 0.3, 'sine', 0.14, 900); break;
      case 'portalGold':  this._noise(G, t, 0.25, 600, 0.12); this._note(G, 660, t, 0.35, 'sine', 0.15, 1200); this._note(G, 990, t + 0.1, 0.3, 'square', 0.07); break;
      case 'portalBad':   this._note(G, 320, t, 0.3, 'sawtooth', 0.13, -200); this._noise(G, t, 0.3, 300, 0.1); break;
      case 'combo': {
        const c = Math.min(state.combo, 10);
        this._note(G, 700 + c * 90, t, 0.14, 'square', 0.1);
        this._note(G, 1050 + c * 110, t + 0.05, 0.16, 'sine', 0.09);
        break;
      }
      case 'comboLost':   this._note(G, 400, t, 0.25, 'sawtooth', 0.1, -250); break;
      case 'jump':        this._note(G, 300, t, 0.16, 'sine', 0.1, 280); break;
      case 'doubleJump':  this._note(G, 420, t, 0.18, 'square', 0.08, 380); break;
      case 'land':        this._noise(G, t, 0.08, 400, 0.07); this._kick(G, t, 0.12); break;
      case 'bigLand':     this._kick(G, t, 0.3); this._noise(G, t, 0.18, 200, 0.12); break;
      case 'belly':       this._kick(G, t, 0.22); this._note(G, 180, t, 0.18, 'sine', 0.14, -80); break;
      case 'pulse':       this._note(G, 220, t, 0.45, 'sawtooth', 0.13, 500); this._noise(G, t, 0.3, 1500, 0.08); break;
      case 'grappleFire': this._noise(G, t, 0.12, 2500, 0.09); this._note(G, 900, t, 0.12, 'square', 0.05, -500); break;
      case 'grappleHit':  this._note(G, 1200, t, 0.08, 'square', 0.1); this._noise(G, t, 0.05, 3000, 0.08); break;
      case 'bonk':        this._note(G, 240, t, 0.16, 'square', 0.13, -120); break;
      case 'hurt':        this._kick(G, t, 0.25); this._note(G, 200, t, 0.3, 'sawtooth', 0.11, -130); break;
      case 'trolleyStart':this._note(G, 80, t, 0.5, 'sawtooth', 0.13, 160); this._note(G, 120, t + 0.3, 0.4, 'square', 0.1, 100); break;
      case 'boost':       this._note(G, 150, t, 0.7, 'sawtooth', 0.13, 600); this._noise(G, t, 0.5, 1000, 0.09); break;
      case 'drift':       this._noise(G, t, 0.25, 2800, 0.08); break;
      case 'ramp':        this._note(G, 350, t, 0.4, 'square', 0.1, 700); break;
      case 'buy':         this._note(G, 1047, t, 0.1, 'sine', 0.12); this._note(G, 1319, t + 0.08, 0.1, 'sine', 0.12); this._noise(G, t + 0.16, 0.1, 4000, 0.06); break;
      case 'denied':      this._note(G, 200, t, 0.2, 'square', 0.1); this._note(G, 160, t + 0.15, 0.25, 'square', 0.1); break;
      case 'quest': {
        [523, 659, 784, 1047].forEach((f, i) => this._note(G, f, t + i * 0.1, 0.25, 'square', 0.1));
        break;
      }
      case 'questDone': {
        [523, 659, 784, 1047, 1319].forEach((f, i) => this._note(G, f, t + i * 0.09, 0.3, 'square', 0.11));
        this._kick(G, t + 0.45, 0.2);
        break;
      }
      case 'scooter':     this._note(G, 100, t, 0.6, 'sawtooth', 0.12, 300); this._note(G, 140, t + 0.2, 0.5, 'square', 0.08, 220); break;
      case 'evil':        this._note(G, 280, t, 0.3, 'sawtooth', 0.1, -60); this._note(G, 210, t + 0.22, 0.35, 'sawtooth', 0.1, -50); break;
      case 'explode':     this._kick(G, t, 0.35); this._noise(G, t, 0.5, 150, 0.18); this._note(G, 90, t, 0.5, 'sawtooth', 0.12, -40); break;
      case 'sell':        [784, 988, 1175, 1568].forEach((f, i) => this._note(G, f, t + i * 0.06, 0.15, 'sine', 0.1)); break;
      case 'unlock':      [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this._note(G, f, t + i * 0.08, 0.35, 'triangle', 0.1)); break;
      case 'eat':         this._noise(G, t, 0.1, 500, 0.1); this._note(G, 160, t + 0.1, 0.12, 'sine', 0.1); break;
      case 'tick':        this._note(G, 1100, t, 0.05, 'square', 0.06); break;
      case 'hover':       this._note(G, 1500, t, 0.04, 'sine', 0.04); break;
      case 'milestone': {
        [659, 784, 988, 1319, 1568].forEach((f, i) => this._note(G, f, t + i * 0.07, 0.3, 'square', 0.1));
        this._kick(G, t, 0.22);
        this._noise(G, t + 0.3, 0.25, 3500, 0.06);
        break;
      }
      case 'refuel':      this._note(G, 300, t, 0.4, 'sine', 0.1, 500); this._note(G, 900, t + 0.3, 0.15, 'sine', 0.08); break;
    }
  }

  // Voice beeps: each speaker has a base pitch; text length drives blip count.
  voice(speaker, text) {
    if (!this.ctx) return;
    const base = { bung: 130, ching: 360, gabor: 230, system: 600 }[speaker] || 200;
    const words = Math.min(10, Math.ceil(text.length / 9));
    const t0 = this.ctx.currentTime;
    for (let i = 0; i < words; i++) {
      const f = base * (0.9 + Math.random() * 0.3);
      this._note(this.sfxGain, f, t0 + i * 0.085, 0.07, speaker === 'gabor' ? 'sawtooth' : 'square', 0.05);
    }
  }
}
