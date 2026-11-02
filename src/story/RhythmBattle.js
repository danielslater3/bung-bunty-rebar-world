// Deterministic three-round timing chart. Simulation time pauses with the game.
export class RhythmBattle {
  constructor(saved = {}) {
    this.round = Math.max(0, Math.min(2, saved.round || 0));
    this.total = Number(saved.total) || 0;
    this.best = Number(saved.best) || 0;
    this.bank = this.total;
    this.restart();
  }
  restart() {
    this.total = this.bank;
    this.time = 0;
    this.index = 0;
    this.hits = 0;
    this.misses = 0;
    this.combo = 0;
    this.feedback = 'GET READY';
    this.complete = false;
  }
  get gap() {
    return [0.72, 0.64, 0.56][this.round];
  }
  get due() {
    return 1.2 + this.index * this.gap;
  }
  get window() {
    return [0.16, 0.14, 0.12][this.round];
  }
  update(dt, press = false) {
    if (this.complete) return null;
    this.time += Math.max(0, Math.min(0.1, dt));
    let event = null;
    const error = Math.abs(this.time - this.due);
    if (press && this.index < 8) {
      if (error <= this.window) {
        this.hits++;
        this.combo++;
        this.best = Math.max(this.best, this.combo);
        this.total += 100 + this.combo * 15;
        this.index++;
        event = 'hit';
        this.feedback = error < 0.055 ? 'PERFECT' : 'GOLD BAR';
      } else {
        this.combo = 0;
        this.feedback = 'OFF BEAT';
        event = 'early';
      }
    }
    while (this.index < 8 && this.time > this.due + this.window) {
      this.index++;
      this.misses++;
      this.combo = 0;
      this.feedback = 'MISSED';
      event = 'miss';
    }
    if (this.index === 8 && this.time > 1.2 + 7 * this.gap + 0.65) {
      if (this.hits < 6) {
        this.restart();
        this.feedback = 'ROUND RETRY · SIX GOLD BARS NEEDED';
        return 'retry';
      }
      if (this.round < 2) {
        this.bank = this.total;
        this.round++;
        this.restart();
        this.feedback = 'NEXT ROUND';
        return 'round';
      }
      this.complete = true;
      return 'complete';
    }
    return event;
  }
  snapshot() {
    return { round: this.round, total: this.complete ? this.total : this.bank, best: this.best };
  }
}
