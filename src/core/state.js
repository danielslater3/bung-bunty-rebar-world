// Central game state, event bus, and save system.
// Everything that needs to persist lives in `state`; everything that needs
// cross-system communication goes through `bus`.

export const bus = {
  _m: new Map(),
  on(evt, fn) {
    if (!this._m.has(evt)) this._m.set(evt, []);
    this._m.get(evt).push(fn);
    return () => {
      const list=this._m.get(evt);if(!list)return;
      const i=list.indexOf(fn);if(i>=0)list.splice(i,1);
      if(!list.length)this._m.delete(evt);
    };
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
  saga: null,
  currentZone: 'mansion',
  unlockedZones: ['mansion', 'brisbane'],
  redMode: false,
  quests: { activeIndex: 0, completed: [], progress: {} },
  flags: {}, // misc story flags (foundPhone, gaborDefeated, etc.)

  // Rebirth: graded rebar yard + unlocked lore cards. Coins are BungBucks.
  stock: {},
  archive: ['bung', 'ching', 'gabor', 'james', 'conspiracy'],

  settings: { music: 0.6, sfx: 0.8, sensitivity: 1.0 },
  trolley: 'james',

  // Where Bung was in each district, and which world pickups are already gone.
  places: {},
  picked: {},
});

export let state = DEFAULT_STATE();

const SAVE_KEY = 'bung-bunty-rebar-world-save-v1';

export const SaveSystem = {
  hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
  },
  peek() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; }
  },
  save(game) {
    try {
      if (game?.player && (game.mode === 'playing' || game.mode === 'paused')) {
        const p = game.player;
        const t = game.trolley;
        if (!state.places || typeof state.places !== 'object') state.places = {};
        state.places[state.currentZone] = {
          x: p.pos.x, y: p.pos.y, z: p.pos.z,
          facing: p.facing,
          camYaw: game.camYaw,
          camPitch: game.camPitch,
          riding: !!t?.riding,
          summoned: !!t?.summoned,
          tx: t?.pos.x ?? p.pos.x,
          ty: t?.pos.y ?? p.pos.y,
          tz: t?.pos.z ?? p.pos.z,
          theading: t?.heading || 0,
        };
      }
      const s = {
        ...state,
        combo: 0,
        comboTimer: 0,
        buffs: { strength: 0, speed: 0, cyber: 0, fuelregen: 0 },
      };
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
      if (!state.stock || typeof state.stock !== 'object') state.stock = {};
      if (!Array.isArray(state.archive)) state.archive = ['bung', 'ching', 'gabor', 'james', 'conspiracy'];
      if (!state.trolley) state.trolley = 'james';
      if (!state.places || typeof state.places !== 'object') state.places = {};
      if (!state.picked || typeof state.picked !== 'object') state.picked = {};
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
