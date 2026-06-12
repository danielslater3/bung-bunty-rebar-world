// HUD: Bung Stability, Rebar Energy, Trolley Fuel, Bung Score, Rebar Chain,
// currencies, the Operation Rebar Briefing quest tracker, prompts and toasts.
import { state, bus } from '../core/state.js';

export class HUD {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('hud');
    this.$ = (id) => document.getElementById(id);
    this.displayScore = 0; // tweened toward state.score every frame
    bus.on('hud', () => this.refresh());
    bus.on('quest-ui', () => this.refreshQuest());
    // Chain UI pulses on every chain increase; warning flash near expiry
    bus.on('chain', ({ chain }) => { if (chain > 1) this.pulse('hud-combo'); });
    bus.on('chain-warning', () => {
      const el = this.$('hud-combo');
      el.classList.add('chain-warning');
      setTimeout(() => el.classList.remove('chain-warning'), 1900);
    });
    bus.on('score', () => this.pulse('hud-score'));
  }

  // Re-trigger a CSS pulse animation on an element
  pulse(id) {
    const el = this.$(id);
    el.classList.remove('pulse');
    void el.offsetWidth; // reflow to restart the animation
    el.classList.add('pulse');
  }

  show() { this.el.classList.remove('hidden'); this.refresh(); this.refreshQuest(); }
  hide() { this.el.classList.add('hidden'); }

  refresh() {
    this.$('bar-stability').style.width = `${(state.stability / state.maxStability) * 100}%`;
    this.$('bar-energy').style.width = `${(state.energy / state.maxEnergy) * 100}%`;
    this.$('bar-fuel').style.width = `${(state.fuel / state.maxFuel) * 100}%`;
    this.$('coins-val').textContent = state.coins.toLocaleString();
    this.$('rebars-val').textContent = state.rebars;
    this.$('shards-val').textContent = state.shards;
    const comboEl = this.$('hud-combo');
    if (state.combo > 1) {
      comboEl.classList.remove('hidden');
      // Show the true chain value (UI must match actual chain state)
      this.$('combo-val').textContent = `x${state.combo}`;
    } else comboEl.classList.add('hidden');
    // Trolley fuel bar only matters once the trolley exists
    this.$('fuel-wrap').style.display = state.flags.trolleyUnlocked ? '' : 'none';
  }

  refreshQuest() {
    const qs = this.game.quests;
    const q = qs.active;
    const nameEl = this.$('quest-name');
    const list = this.$('quest-objectives');
    list.innerHTML = '';
    if (!q) {
      nameEl.textContent = 'ALL OPERATIONS COMPLETE. FREE ROAM, LEGEND.';
      return;
    }
    nameEl.textContent = q.name;
    q.objectives.forEach((obj, oi) => {
      const li = document.createElement('li');
      const prog = qs.getProgress(oi);
      const suffix = obj.count > 1 ? ` (${prog}/${obj.count})` : '';
      li.textContent = obj.text + suffix;
      if (prog >= obj.count) li.classList.add('done');
      list.appendChild(li);
    });
  }

  update(dt = 0.016) {
    // Score number tweens smoothly toward the real value instead of snapping
    const target = state.score;
    if (this.displayScore !== target) {
      const diff = target - this.displayScore;
      this.displayScore += diff * Math.min(1, dt * 8);
      if (Math.abs(target - this.displayScore) < 1) this.displayScore = target;
      this.$('score-val').textContent = Math.round(this.displayScore).toLocaleString();
    }
    // Combo timer bar shows real decay from the ChainManager window
    if (state.combo > 0) {
      this.$('combo-timer-fill').style.width = `${(state.comboTimer / this.game.chain.WINDOW) * 100}%`;
    }
  }

  prompt(html) {
    const el = this.$('interact-prompt');
    if (html) { el.innerHTML = html; el.classList.remove('hidden'); }
    else el.classList.add('hidden');
  }

  toast(msg, cls = '') {
    const zone = this.$('toast-zone');
    const t = document.createElement('div');
    t.className = `toast ${cls}`;
    t.textContent = msg;
    zone.appendChild(t);
    while (zone.children.length > 4) zone.firstChild.remove();
    setTimeout(() => t.remove(), 3100);
  }

  // Big centre-screen chain milestone celebration (5x/10x/20x/50x)
  milestoneBanner(text, cls = '') {
    const el = this.$('milestone-banner');
    el.textContent = text;
    el.className = `milestone ${cls}`;
    clearTimeout(this._msT);
    this._msT = setTimeout(() => el.classList.add('hidden'), 2400);
  }

  // Gold banner when an Operation completes
  questBanner(name) {
    const el = this.$('quest-banner');
    el.innerHTML = `<div class="qb-top">OPERATION COMPLETE</div><div class="qb-name">${name}</div>`;
    el.classList.remove('hidden');
    clearTimeout(this._qbT);
    this._qbT = setTimeout(() => el.classList.add('hidden'), 4000);
  }

  bossBanner(text) {
    const el = this.$('boss-banner');
    if (text) { el.textContent = text; el.classList.remove('hidden'); setTimeout(() => el.classList.add('hidden'), 4000); }
    else el.classList.add('hidden');
  }

  zoneBanner(mode, name) {
    const el = this.$('zone-banner');
    el.innerHTML = `<div class="zb-op">OPERATION REBAR — ${mode}</div><div class="zb-name">${name}</div>`;
    el.classList.remove('hidden');
    clearTimeout(this._zbT);
    this._zbT = setTimeout(() => el.classList.add('hidden'), 3500);
  }

  hurtFlash() {
    const el = this.$('damage-vignette');
    el.classList.add('hurt');
    setTimeout(() => el.classList.remove('hurt'), 220);
  }
}
