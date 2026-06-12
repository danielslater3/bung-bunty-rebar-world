// The Rebar Exchange — upgrades, food buffs, and map unlocks.
// Score selling also lives here (Exchange kiosks call sellScore()).
import { state, bus, SaveSystem, upgLevel } from '../core/state.js';

export const UPGRADES = [
  // ---- Bung ----
  { id: 'jump2',   cat: 'BUNG', name: 'Extra Jump', desc: 'Double jump. Physics is a suggestion.', cost: 200, max: 1 },
  { id: 'belly',   cat: 'BUNG', name: 'Bigger Belly Bounce', desc: '+ belly bounce radius. The belly is a weapon.', cost: 120, max: 3, scale: 1.6 },
  { id: 'magnet',  cat: 'BUNG', name: 'Rebar Magnet', desc: 'Pull nearby collectibles toward you.', cost: 150, max: 3, scale: 1.7 },
  { id: 'sprint',  cat: 'BUNG', name: 'Faster Sprint', desc: '+1.5 sprint speed per level.', cost: 130, max: 3, scale: 1.6 },
  { id: 'jumph',   cat: 'BUNG', name: 'Higher Jump', desc: 'More vertical Bung.', cost: 110, max: 3, scale: 1.6 },
  { id: 'stab',    cat: 'BUNG', name: 'More Bung Stability', desc: '+25 max stability per level.', cost: 140, max: 3, scale: 1.7 },
  // ---- Grapple ----
  { id: 'grange',  cat: 'GRAPPLE', name: 'Longer Grapple', desc: '+8m rebar chain range per level.', cost: 130, max: 3, scale: 1.6 },
  { id: 'gpull',   cat: 'GRAPPLE', name: 'Faster Pull', desc: 'Yank harder. Fly further.', cost: 130, max: 3, scale: 1.6 },
  { id: 'gair',    cat: 'GRAPPLE', name: 'Air Control Boost', desc: 'Steer mid-air like a legend.', cost: 120, max: 2, scale: 1.7 },
  // ---- Trolley ----
  { id: 'turbo',   cat: 'TROLLEY', name: 'Trolley Turbo', desc: '+ top speed & acceleration.', cost: 160, max: 3, scale: 1.7 },
  { id: 'drift',   cat: 'TROLLEY', name: 'Golden Drift', desc: 'Sharper drift + bigger release boost.', cost: 140, max: 3, scale: 1.6 },
  { id: 'tank',    cat: 'TROLLEY', name: 'Bigger Fuel Tank', desc: '+30 Trolley Fuel per level.', cost: 130, max: 3, scale: 1.6 },
  { id: 'handling',cat: 'TROLLEY', name: 'Better Handling', desc: 'Tighter turning at speed.', cost: 120, max: 3, scale: 1.6 },
  { id: 'ramp',    cat: 'TROLLEY', name: 'Ramp Launch Boost', desc: 'Ramps launch you higher.', cost: 140, max: 2, scale: 1.8 },
  // ---- Food (consumable buffs) ----
  { id: 'burger',  cat: 'FOOD', name: 'Rebar Deluxe Burger', desc: '30s strength boost + full stability.', cost: 60, consumable: true },
  { id: 'fries',   cat: 'FOOD', name: 'Trolley Fries', desc: 'Instantly refill Trolley Fuel.', cost: 40, consumable: true },
  { id: 'drink',   cat: 'FOOD', name: 'Blue Mode Drink', desc: '30s movement speed boost.', cost: 50, consumable: true },
  { id: 'noodles', cat: 'FOOD', name: 'Red Mode Noodles', desc: '45s cyber resistance (slower bugs).', cost: 70, consumable: true },
  // ---- Maps ----
  { id: 'map_sydney',   cat: 'MAPS', name: 'Sydney Staging Zone', desc: 'Early access without finishing Operation 4.', cost: 600, max: 1, mapUnlock: 'sydney' },
  { id: 'map_hongkong', cat: 'MAPS', name: 'Hong Kong Neon Rain City', desc: 'Early Red Mode access.', cost: 1000, max: 1, mapUnlock: 'hongkong' },
  { id: 'map_shenzhen', cat: 'MAPS', name: 'Shenzhen Cyber Rebar Core', desc: 'Skip straight to the endgame zone.', cost: 1500, max: 1, mapUnlock: 'shenzhen' },
  { id: 'map_void',     cat: 'MAPS', name: 'Rebar Void', desc: 'The floating portal dimension. Score attack heaven.', cost: 800, max: 1, mapUnlock: 'void' },
];

export const SHOP_CATEGORIES = ['BUNG', 'GRAPPLE', 'TROLLEY', 'FOOD', 'MAPS'];

export class ShopSystem {
  constructor(game) {
    this.game = game;
  }

  costOf(upg) {
    if (upg.consumable) return upg.cost;
    const lvl = upgLevel(upg.id);
    return Math.round(upg.cost * Math.pow(upg.scale || 1.6, lvl));
  }

  canBuy(upg) {
    if (!upg.consumable && upgLevel(upg.id) >= (upg.max || 1)) return false;
    if (upg.mapUnlock && state.unlockedZones.includes(upg.mapUnlock)) return false;
    return state.coins >= this.costOf(upg);
  }

  buy(upgId) {
    const upg = UPGRADES.find((u) => u.id === upgId);
    const g = this.game;
    if (!upg || !this.canBuy(upg)) { g.audio.sfx('denied'); return false; }
    state.coins -= this.costOf(upg);
    g.audio.sfx('buy');

    if (upg.consumable) {
      this.applyConsumable(upg.id);
    } else if (upg.mapUnlock) {
      state.upgrades[upg.id] = 1;
      if (!state.unlockedZones.includes(upg.mapUnlock)) state.unlockedZones.push(upg.mapUnlock);
      if (upg.mapUnlock === 'hongkong' || upg.mapUnlock === 'shenzhen') state.redMode = true;
      g.audio.sfx('unlock');
      g.toast(`${upg.name.toUpperCase()} UNLOCKED`, 'blue');
    } else {
      state.upgrades[upg.id] = upgLevel(upg.id) + 1;
      g.toast(`UPGRADE: ${upg.name.toUpperCase()} LV.${state.upgrades[upg.id]}`);
      if (upg.id === 'stab') {
        state.maxStability = 100 + upgLevel('stab') * 25;
        state.stability = state.maxStability;
      }
      if (upg.id === 'tank') {
        state.maxFuel = 60 + upgLevel('tank') * 30;
      }
    }
    bus.emit('hud');
    SaveSystem.save();
    return true;
  }

  applyConsumable(id) {
    const g = this.game;
    g.audio.sfx('eat');
    switch (id) {
      case 'burger':
        state.buffs.strength = 30;
        state.stability = state.maxStability;
        g.say('bung', 'Rebar Deluxe acquired. Strength levels: illegal.');
        break;
      case 'fries':
        state.fuel = state.maxFuel;
        g.say('bung', 'Trolley Fries. For the trolley. Mostly.');
        break;
      case 'drink':
        state.buffs.speed = 30;
        g.say('bung', 'Blue Mode Drink engaged. Zoom protocol active.');
        break;
      case 'noodles':
        state.buffs.cyber = 45;
        g.say('bung', 'Red Mode Noodles. Spicy enough to firewall my organs.');
        break;
    }
    bus.emit('hud');
  }

  // Score → Rebar Coins at 10:1, with a combo-best bonus.
  sellScore() {
    const g = this.game;
    if (state.score <= 0) {
      g.audio.sfx('denied');
      g.toast('NO SCORE TO SELL — GO HIT SOME PORTALS', 'red');
      return;
    }
    const coins = Math.max(1, Math.round(state.score / 10));
    state.coins += coins;
    const sold = state.score;
    state.score = 0;
    g.hud.displayScore = 0; // no slow tween down after a sale
    g.chain.resetChain('sold', true); // intentional chain reset (silent)
    g.audio.sfx('sell');
    g.toast(`SOLD ${sold} SCORE FOR ${coins} REBAR COINS`);
    g.say('ching', 'Transaction processed. Try not to spend it all on burgers.');
    bus.emit('hud');
    bus.emit('qe', { type: 'sell', target: 'any' });
    SaveSystem.save();
  }
}
