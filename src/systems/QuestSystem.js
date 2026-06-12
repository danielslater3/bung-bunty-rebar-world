// Operation Rebar: Blue to Red — main campaign quest chain + tracker.
// Objectives are event-driven: gameplay code emits bus 'qe' events
// ({type, target, n/value}) and the active objective counts them.
import { state, bus, SaveSystem } from '../core/state.js';

export const QUESTS = [
  {
    id: 'q1', name: 'Wake Up, Bung', zone: 'mansion',
    brief: [['ching', 'Bung. Bung! The Rebar Network is glitching all over Brisbane.'],
            ['bung', 'OIIII. Say no more. Operation Rebar is officially deployed.'],
            ['ching', 'You have not even put pants on. Collect some rebars first.']],
    objectives: [
      { text: 'Talk to Ching', type: 'talk', target: 'ching', count: 1 },
      { text: 'Collect 5 rebars around the mansion', type: 'collect', target: 'rebar', count: 5 },
      { text: 'Enter the Rebar Lab (basement)', type: 'reach', target: 'rebarlab', count: 1 },
    ],
    reward: { coins: 50 },
    onComplete: (g) => g.say('ching', 'Good. Now get to the garage. It is trolley time.'),
  },
  {
    id: 'q2', name: 'Golden Trolley Test', zone: 'mansion',
    brief: [['ching', 'Golden trolley systems online. Try not to drift it inside the mansion again.'],
            ['bung', 'The trolley never lies, Ching. THE TROLLEY NEVER LIES.']],
    objectives: [
      { text: 'Summon the James Rebar Trolley in the garage (T)', type: 'mount', target: 'trolley', count: 1 },
      { text: 'Drive through 5 trolley rings on the lawn', type: 'ring', target: 'trolley', count: 5 },
      { text: 'Use boost (SHIFT while driving)', type: 'boost', target: 'trolley', count: 1 },
      { text: 'Hit the lawn ramp at speed', type: 'ramp', target: 'trolley', count: 1 },
    ],
    reward: { coins: 100 },
    onComplete: (g) => {
      g.say('bung', 'This is peak Bung engineering!');
    },
  },
  {
    id: 'q3', name: 'Portal Situation, Mate', zone: 'brisbane',
    brief: [['ching', 'Portals are opening across the Brisbane Rebar District. The field is unstable. Aim properly this time.'],
            ['bung', 'Blue to Red mode activated. Let\'s cook.']],
    objectives: [
      { text: 'Travel to Brisbane Rebar District (Deployment Board)', type: 'enter', target: 'brisbane', count: 1 },
      { text: 'Pass through 10 portals', type: 'portal', target: 'any', count: 10 },
      { text: 'Build a 5x Rebar Chain combo', type: 'combo', target: 'best', value: 5, count: 1 },
      { text: 'Sell score at a Rebar Exchange', type: 'sell', target: 'any', count: 1 },
    ],
    reward: { coins: 150 },
    onComplete: (g) => g.say('ching', 'Not bad. I can hear Gabor\'s scooter from here though...'),
  },
  {
    id: 'q4', name: 'Gabor Has Entered the District', zone: 'brisbane',
    brief: [['gabor', 'BUNG BUNTY! Your rebars are MINE! Behold my scooter-based genius!'],
            ['bung', 'Gabor, you absolute pest!'],
            ['ching', 'Gabor has entered the zone. He stole a Cyber Rebar Shard. Get it back.']],
    objectives: [
      { text: 'Defeat 4 Gabor Drones', type: 'defeat', target: 'drone', count: 4 },
      { text: 'Chase down Gabor\'s scooter — hit it 3x with Rebar Pulse (G)', type: 'boss', target: 'chase', count: 1 },
      { text: 'Recover the stolen Cyber Rebar Shard', type: 'collect', target: 'shard', count: 1 },
    ],
    reward: { coins: 250, unlock: 'sydney' },
    onComplete: (g) => {
      g.toast('SYDNEY STAGING ZONE UNLOCKED', 'blue');
      g.audio.sfx('unlock');
      g.say('gabor', 'You may have won this round, but my forehead contains unlimited strategy!');
    },
  },
  {
    id: 'q5', name: 'Blue to Red Deployment', zone: 'sydney',
    brief: [['ching', 'The Sydney Staging Zone is our gateway. Blue Mode is stable. Red Mode is not.'],
            ['bung', 'Operation Rebar Passport, activate. I am basically an international rebar diplomat.']],
    objectives: [
      { text: 'Travel to Sydney Staging Zone', type: 'enter', target: 'sydney', count: 1 },
      { text: 'Complete the travel gate portal challenge (8 portals)', type: 'portal', target: 'any', count: 8 },
      { text: 'Recover 3 Rebar Deluxe ingredients from Gabor\'s hoard', type: 'collect', target: 'burger', count: 3 },
      { text: 'Activate the Operation Rebar Passport checkpoint', type: 'reach', target: 'passport', count: 1 },
    ],
    reward: { coins: 300, unlock: 'hongkong', redMode: true },
    onComplete: (g) => {
      g.toast('RED MODE UNLOCKED — HONG KONG NEON RAIN CITY OPEN', 'red');
      g.audio.sfx('unlock');
      g.say('bung', 'Hong Kong rain mode activated.');
    },
  },
  {
    id: 'q6', name: 'Rain, Rebars, and Rooftops', zone: 'hongkong',
    brief: [['ching', 'Hong Kong Neon Rain City. Vertical routes, corrupted portals, Typhoon Blobs. Stay sharp.'],
            ['bung', 'I can smell the Rebar Coins through the rain.']],
    objectives: [
      { text: 'Travel to Hong Kong Neon Rain City', type: 'enter', target: 'hongkong', count: 1 },
      { text: 'Complete the rooftop portal chain (12 portals)', type: 'portal', target: 'any', count: 12 },
      { text: 'Bonk 3 Typhoon Blobs', type: 'defeat', target: 'blob', count: 3 },
      { text: 'Meet Ching at the rooftop checkpoint', type: 'talk', target: 'ching-rooftop', count: 1 },
    ],
    reward: { coins: 400, unlock: 'shenzhen' },
    onComplete: (g) => {
      g.toast('SHENZHEN CYBER REBAR CORE UNLOCKED', 'red');
      g.audio.sfx('unlock');
      g.say('ching', 'The cyber rebar core is opening. This is it, Bung.');
    },
  },
  {
    id: 'q7', name: 'The Cyber Rebar Core', zone: 'shenzhen',
    brief: [['ching', 'Shenzhen Cyber Rebar Core. Gabor has corruption towers draining the Rebar Network.'],
            ['gabor', 'The Rebar Network belongs to GABOR! I am not annoying. I am INEVITABLE.']],
    objectives: [
      { text: 'Travel to Shenzhen Cyber Rebar Core', type: 'enter', target: 'shenzhen', count: 1 },
      { text: 'Disable 3 corruption towers (Rebar Pulse them)', type: 'tower', target: 'any', count: 3 },
      { text: 'Collect 3 Cyber Rebar Shards', type: 'collect', target: 'shard', count: 3 },
      { text: 'Defeat 5 Cyber Rebar Bugs', type: 'defeat', target: 'bug', count: 5 },
    ],
    reward: { coins: 500, unlock: 'void' },
    onComplete: (g) => {
      g.toast('REBAR VOID UNLOCKED — FINAL BOSS READY', 'red');
      g.audio.sfx('unlock');
      g.say('ching', 'His machine is powering up in the boss arena. End this.');
    },
  },
  {
    id: 'q8', name: 'Mega Forehead Shutdown', zone: 'shenzhen',
    brief: [['gabor', 'BEHOLD! THE MEGA FOREHEAD REBAR MACHINE! Powered by pure forehead strategy!'],
            ['bung', 'That is the dumbest thing I have ever seen. I love it. Time to break it.'],
            ['ching', 'Destroy the corruption nodes, then pulse the core. Rebar World needs you. Somehow.']],
    objectives: [
      { text: 'Enter the final boss arena (north platform)', type: 'reach', target: 'bossarena', count: 1 },
      { text: 'Destroy the Mega Forehead Rebar Machine', type: 'boss', target: 'final', count: 1 },
    ],
    reward: { coins: 1000 },
    onComplete: (g) => {
      g.say('bung', 'WE ARE SO BACK, MATE! Rebar World is saved. Accidentally. As usual.');
      g.menus.showVictory();
    },
  },
];

export class QuestSystem {
  constructor(game) {
    this.game = game;
    bus.on('qe', (e) => this.onEvent(e));
  }

  get active() {
    return QUESTS[state.quests.activeIndex] || null;
  }

  progressKey(qi, oi) { return `${qi}:${oi}`; }

  getProgress(oi) {
    return state.quests.progress[this.progressKey(state.quests.activeIndex, oi)] || 0;
  }

  startActiveQuestBriefing() {
    const q = this.active;
    if (!q || state.flags['briefed_' + q.id]) return;
    state.flags['briefed_' + q.id] = true;
    this.game.audio.sfx('quest');
    this.game.toast(`NEW OPERATION: ${q.name.toUpperCase()}`);
    if (q.brief) this.game.dialogue.conversation(q.brief);
    // Credit "travel to X" objectives if Bung is already standing there
    bus.emit('qe', { type: 'enter', target: state.currentZone });
    bus.emit('quest-ui');
  }

  onEvent(e) {
    const q = this.active;
    if (!q) return;
    let changed = false;
    q.objectives.forEach((obj, oi) => {
      if (obj.type !== e.type) return;
      if (obj.target !== e.target && obj.target !== 'any') return;
      const key = this.progressKey(state.quests.activeIndex, oi);
      const cur = state.quests.progress[key] || 0;
      if (cur >= obj.count) return;
      if (obj.value !== undefined) {
        // Threshold objective (e.g. reach combo 5)
        if ((e.value || 0) >= obj.value) {
          state.quests.progress[key] = obj.count;
          changed = true;
        }
      } else {
        state.quests.progress[key] = Math.min(obj.count, cur + (e.n || 1));
        changed = true;
      }
      if (changed && state.quests.progress[key] >= obj.count) {
        this.game.audio.sfx('quest');
        this.game.toast(`OBJECTIVE COMPLETE: ${obj.text.toUpperCase()}`, 'blue');
      }
    });
    if (changed) {
      bus.emit('quest-ui');
      this.checkComplete();
    }
  }

  checkComplete() {
    const q = this.active;
    if (!q) return;
    const allDone = q.objectives.every((obj, oi) => this.getProgress(oi) >= obj.count);
    if (!allDone) return;

    // Complete!
    state.quests.completed.push(q.id);
    const g = this.game;
    g.audio.sfx('questDone');
    g.hud.questBanner(q.name); // big centre-screen completion banner
    g.toast(`OPERATION COMPLETE: ${q.name.toUpperCase()}`, 'blue');
    if (q.reward) {
      if (q.reward.coins) { state.coins += q.reward.coins; g.toast(`+${q.reward.coins} REBAR COINS`); }
      if (q.reward.unlock && !state.unlockedZones.includes(q.reward.unlock)) {
        state.unlockedZones.push(q.reward.unlock);
      }
      if (q.reward.redMode) state.redMode = true;
    }
    if (q.onComplete) q.onComplete(g);
    state.quests.activeIndex++;
    bus.emit('hud');
    bus.emit('quest-ui');
    SaveSystem.save();
    // Brief next quest shortly after
    setTimeout(() => this.startActiveQuestBriefing(), 4500);
  }
}
