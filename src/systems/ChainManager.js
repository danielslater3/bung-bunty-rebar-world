// RebarChainManager — THE single source of truth for the Rebar Chain.
//
// Architecture rule (2.0): collectibles, portals, enemies and bosses never
// touch state.combo / state.score directly. They call:
//     game.chain.addChain(source)            → grow the chain
//     game.chain.addScore(basePoints, source)→ score (multiplied by the chain)
//     game.chain.resetChain(reason)          → break the chain (with a reason)
// The manager owns the combo timer, milestones, UI events (via bus) and
// debug logging. UI displays this state — it never controls it.
import { state, bus } from '../core/state.js';
import { dlog } from '../core/Debug.js';

const CHAIN_WINDOW = 7;        // seconds to keep the chain alive
const WARNING_AT = 1.8;        // seconds left when the UI starts flashing
const MULTIPLIER_CAP = 10;     // score multiplier cap (chain itself is uncapped)

const MILESTONES = {
  5:  { text: 'REBAR CHAIN ACTIVE',       cls: 'blue' },
  10: { text: 'DOUBLE REBAR MODE',        cls: '' },
  20: { text: 'BUNG ASCENSION',           cls: 'red' },
  50: { text: 'IMPOSSIBLE TROLLEY EVENT', cls: 'red' },
};

export class ChainManager {
  constructor(game) {
    this.game = game;
    this.WINDOW = CHAIN_WINDOW;
    this.lastSource = null;     // last_combo_source
    this.warned = false;
    this.paused = false;        // pause_chain_if_needed (menus pause the loop anyway)
  }

  get chain() { return state.combo; }                                  // current_chain
  get multiplier() { return Math.max(1, Math.min(MULTIPLIER_CAP, state.combo)); } // combo_multiplier
  get maxChainReached() { return state.bestCombo; }                    // max_chain_reached
  get timeLeft() { return state.comboTimer; }

  // ---- add_chain(source, amount) ----
  addChain(source, amount = 1) {
    state.combo += amount;
    state.comboTimer = CHAIN_WINDOW;
    this.warned = false;
    this.lastSource = source;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    dlog('chain', `+${amount} from ${source} → x${state.combo}`);

    if (state.combo > 1) this.game.audio.sfx('combo');
    bus.emit('chain', { chain: state.combo, source });
    bus.emit('qe', { type: 'combo', target: 'best', value: state.combo });

    const ms = MILESTONES[state.combo];
    if (ms) {
      this.game.audio.sfx('milestone');
      this.game.hud.milestoneBanner(ms.text, ms.cls);
      this.game.shake(0.25, 0.4);
      if (state.combo === 10) this.game.say('bung', 'DOUBLE REBAR MODE! We are so back, mate!');
      if (state.combo === 20) this.game.say('bung', 'BUNG ASCENSION! Physics has entered negotiations!');
      if (state.combo === 50) this.game.say('ching', 'That should be impossible. The trolley disagrees.');
    }
    bus.emit('hud');
    return state.combo;
  }

  // ---- add score through the chain multiplier ----
  addScore(basePoints, source) {
    const rush = this.game.scoreAttack && this.game.scoreAttack.t > 0 ? 2 : 1;
    const gained = Math.round(basePoints * this.multiplier * rush);
    state.score += gained;
    state.totalScoreEarned += gained;
    dlog('chain', `score +${gained} (${basePoints} x${this.multiplier}${rush > 1 ? ' x2 RUSH' : ''}) from ${source}`);
    bus.emit('score', { gained, source });
    bus.emit('hud');
    return gained;
  }

  // ---- reset_chain(reason) ----
  // Only legit reasons reset the chain: timer expiry, damage, leech drain,
  // glitch portals, selling score. Never scene changes or UI hiccups.
  resetChain(reason, silent = false) {
    const had = state.combo;
    state.combo = 0;
    state.comboTimer = 0;
    this.warned = false;
    if (had > 1) {
      dlog('chain', `reset (${reason}) from x${had}`);
      if (!silent) {
        this.game.audio.sfx('comboLost');
        this.game.toast(reason, 'red');
      }
    }
    bus.emit('chain', { chain: 0, source: 'reset:' + reason });
    bus.emit('hud');
  }

  update(dt) {
    if (this.paused || state.combo <= 0) return;
    state.comboTimer -= dt;
    if (state.comboTimer <= WARNING_AT && !this.warned && state.combo > 1) {
      this.warned = true;
      bus.emit('chain-warning');
    }
    if (state.comboTimer <= 0) {
      this.resetChain('REBAR CHAIN EXPIRED', state.combo <= 1);
    }
  }
}
