// Central game state, event bus, and save system.
// Everything that needs to persist lives in `state`; everything that needs
// cross-system communication goes through `bus`.

export const bus = {
  _m: new Map(),
  on(evt, fn) {
    if (!this._m.has(evt)) this._m.set(evt, []);
    this._m.get(evt).push(fn);
  },
  emit(evt, data) {
    const fns = this._m.get(evt);
    if (fns) for (const f of fns.slice()) f(data);
  },
};

export const DEFAULT_STATE = () => ({
  // Vital stats
  stability: 100, maxStability: 100,
  energy: 30, maxEnergy: 100,
  fuel: 60, maxFuel: 60,

  // Currencies & collectibles
  coins: 0,
  rebars: 0,
  shards: 0,
  score: 0,
  combo: 0,
  comboTimer: 0,
  bestCombo: 0,
  totalScoreEarned: 0,

  // Upgrades: id -> level
  upgrades: {},

  // Buff timers (seconds remaining)
  buffs: { strength: 0, speed: 0, cyber: 0, fuelregen: 0 },

  // Progression
  currentZone: 'mansion',
  unlockedZones: ['mansion', 'brisbane'],
  redMode: false,
  quests: { activeIndex: 0, completed: [], progress: {} },
  flags: {}, // misc story flags (foundPhone, gaborDefeated, etc.)

  settings: { music: 0.6, sfx: 0.8, sensitivity: 1.0 },
});

export let state = DEFAULT_STATE();

const SAVE_KEY = 'bung-bunty-rebar-world-save-v1';

export const SaveSystem = {
  hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
  },
  save() {
    try {
      const s = { ...state, combo: 0, comboTimer: 0 };
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
      bus.emit('saved');
    } catch (e) { console.warn('Save failed', e); }
  },
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      Object.assign(state, DEFAULT_STATE(), data);
      // Never resume mid-buff / mid-combo
      state.buffs = { strength: 0, speed: 0, cyber: 0, fuelregen: 0 };
      state.stability = state.maxStability;
      return true;
    } catch (e) { console.warn('Load failed', e); return false; }
  },
  reset() {
    state = Object.assign(state, DEFAULT_STATE());
    try { localStorage.removeItem(SAVE_KEY); } catch {}
  },
};

// ---- Convenience mutators (emit events for HUD/quests) ----
export function addCoins(n) { state.coins += n; bus.emit('hud'); }
export function addRebars(n) {
  state.rebars += n;
  bus.emit('hud');
  bus.emit('qe', { type: 'collect', target: 'rebar', n });
}
export function addShards(n) {
  state.shards += n;
  bus.emit('hud');
  bus.emit('qe', { type: 'collect', target: 'shard', n });
}
export function addEnergy(n) {
  state.energy = Math.min(state.maxEnergy, state.energy + n);
  bus.emit('hud');
}
export function upgLevel(id) { return state.upgrades[id] || 0; }
