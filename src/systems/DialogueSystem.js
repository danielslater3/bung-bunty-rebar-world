// Subtitle/voice queue. Voice is placeholder beeps via AudioManager — the
// `say(speaker, text)` API stays identical when real recordings arrive.
const SPEAKER_NAMES = { bung: 'BUNG BUNTY', ching: 'CHING', gabor: 'GABOR MIHALA', system: 'OPERATION REBAR' };

export class DialogueSystem {
  constructor(game) {
    this.game = game;
    this.queue = [];
    this.current = null;
    this.timer = 0;
    this.el = document.getElementById('dialogue');
    this.elSpeaker = document.getElementById('dialogue-speaker');
    this.elText = document.getElementById('dialogue-text');
    this.onEnd = null;
  }

  // Quick one-liner (barks). Skips the queue if idle, otherwise drops it.
  say(speaker, text) {
    if (this.current && this.queue.length > 0) return; // don't pile up barks
    this.queue.push({ speaker, text, dur: Math.max(2.2, text.length * 0.045) });
    if (!this.current) this._next();
  }

  // Scripted conversation: array of [speaker, text]
  conversation(lines, onEnd = null) {
    this.queue = lines.map(([speaker, text]) => ({ speaker, text, dur: Math.max(2.4, text.length * 0.05) }));
    this.onEnd = onEnd;
    this._next(true);
  }

  _next(force = false) {
    if (this.current && !force && this.queue.length === 0) return;
    this.current = this.queue.shift() || null;
    if (!this.current) {
      this.el.classList.add('hidden');
      const cb = this.onEnd; this.onEnd = null;
      if (cb) cb();
      return;
    }
    const { speaker, text, dur } = this.current;
    this.timer = dur;
    this.elSpeaker.textContent = SPEAKER_NAMES[speaker] || speaker.toUpperCase();
    this.elSpeaker.className = speaker;
    this.elText.textContent = text;
    this.el.classList.remove('hidden');
    this.game.audio.voice(speaker, text);
  }

  skip() {
    if (this.current) this._next(true);
  }

  update(dt) {
    if (!this.current) return;
    this.timer -= dt;
    if (this.game.input.pressed['KeyE'] && this.queue.length > 0) this._next(true);
    else if (this.timer <= 0) this._next(true);
  }

  get busy() { return !!this.current; }
}
