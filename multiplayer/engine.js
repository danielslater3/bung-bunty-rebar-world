// Authoritative rules shared by Durable Objects and deterministic Node tests.
import {
  GAMES,
  gameDefinition,
  MAX_PLAYERS,
  PROTOCOL,
  SPAWN,
  RALLY,
  QUEST_STAGES,
  ROLES,
  normalizeAppearance,
} from '../src/multiplayer/catalog.js';
import { arenaContains, arenaLive, availablePickup, crossesGate, EXCHANGE, EXCHANGE_ITEMS, PICKUPS, RING_GATES } from '../src/multiplayer/cityActivities.js';
import { arenaCommand, arenaTick, emptyArena, removeArenaPlayer } from './burgerHeist.js';
import { advanceRace, collectHunt, eventCommand, eventTick, raceGate, racing, welcomeEvents } from './roomEvents.js';
import { roomTrolley } from '../src/multiplayer/fleet.js';
import { GARAGE, garageAction, garageSetup } from '../src/garage/catalog.js';
import { hashWeather, weatherAt } from '../src/weather/model.js';
export const freshRoom = (code, now) => ({
  code,
  version: PROTOCOL,
  created: now,
  revision: 0,
  players: {},
  host: null,
  chat: [],
  games: {},
  events: {},
  quest: {
    status: 'waiting',
    roles: [null, null, null, null],
    stage: 0,
    done: [false, false, false, false],
    pads: {},
    awarded: false,
  },
  banned: [],
  savedPlayers: [],
  rareUntil: {},
  arena: emptyArena(),
});
const fail = (message) => {
  throw new Error(message);
};
const clean = (s, n) =>
  String(s || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '')
    .trim()
    .slice(0, n);
const gap = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const same = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length)
    return false;
  let v = 0;
  for (let i = 0; i < a.length; i++) v |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return v === 0;
};
const finite = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
const lines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];
export class RoomEngine {
  constructor(
    data,
    now = () => Date.now(),
    random = Math.random,
    id = () => crypto.randomUUID(),
  ) {
    this.s = data;
    this.s.savedPlayers ??= [];
    this.s.rareUntil ??= {};
    this.s.arena ??= emptyArena();
    this.s.events ??= {};
    for (const p of Object.values(this.s.players)) {
      p.appearance = normalizeAppearance(p.appearance);
      p.rebar ??= 0;
      p.claims ??= {};
      p.inventory ??= {};
      p.garage ??= {};
      p.trolley = roomTrolley(p.trolley).id;
    }
    this.now = now;
    this.random = random;
    this.id = id;
  }
  join(name, token, appearance, trolley) {
    this.expire();
    if (this.s.banned.some((t) => same(t, token)))
      fail('You were removed from this room.');
    let p = Object.values(this.s.players).find((p) => same(p.token, token));
    if (!p) {
      if (Object.keys(this.s.players).length >= MAX_PLAYERS)
        fail('Room full — maximum 10 players.');
      const saved = this.s.savedPlayers.findIndex(p => same(p.token, token));
      const profile = saved >= 0 ? this.s.savedPlayers.splice(saved, 1)[0] : null;
      const id = profile?.id || this.id();
      p = {
        id,
        token: profile?.token || this.id(),
        name: clean(name, 20) || 'Bung',
        appearance: normalizeAppearance(appearance),
        color: Array.from({ length: 10 }, (_, i) => i).find(
          (i) => !Object.values(this.s.players).some((p) => p.color === i),
        ),
        order: (this.s.joinSerial = (this.s.joinSerial || 0) + 1),
        joined: this.now(),
        connected: true,
        lastSeen: this.now(),
        pos: { ...SPAWN },
        yaw: 0,
        score: profile?.score ?? 0,
        rebar: profile?.rebar ?? 0,
        claims: profile?.claims || {},
        inventory: profile?.inventory || {},
        trolley: roomTrolley(trolley ?? profile?.trolley).id,
        garage: profile?.garage || {},
        profileKey: profile?.profileKey,
        sharedUpgrades: profile?.sharedUpgrades || {},
        ringBest: profile?.ringBest,
        ring: profile?.ring?.deadline > this.now() ? profile.ring : null,
        moveSeq: -1,
        actionIds: [],
        chatAt: [],
        mutedUntil: 0,
      };
      p.pos = {
        ...SPAWN,
        x: SPAWN.x + ((p.color % 5) - 2) * 2.5,
        z: SPAWN.z + (p.color < 5 ? -3 : 3),
      };
      if (p.ring) p.pos = profile.pos;
      this.s.players[id] = p;
    }
    // A reconnect preserves the stored outfit unless the join screen explicitly
    // supplies a fresh choice. The stable id retains points and quest role.
    if (appearance !== undefined)
      p.appearance = normalizeAppearance(appearance);
    else p.appearance = normalizeAppearance(p.appearance);
    p.trolley = roomTrolley(trolley ?? p.trolley).id;
    if (typeof name === 'string') p.name = clean(name, 20) || 'Bung';
    p.connected = true;
    p.lastSeen = this.now();
    welcomeEvents(this, p);
    this.elect();
    this.changed();
    return p;
  }
  changed() {
    this.s.revision++;
  }
  elect() {
    const live = Object.values(this.s.players)
      .filter((p) => p.connected)
      .sort(
        (a, b) =>
          (a.order || a.joined) - (b.order || b.joined) ||
          a.id.localeCompare(b.id),
      );
    if (!this.s.players[this.s.host]?.connected)
      this.s.host = live[0]?.id || null;
    for (const g of Object.values(this.s.games))
      if (!this.s.players[g.owner]?.connected)
        g.owner =
          g.players.find((id) => this.s.players[id]?.connected) || g.owner;
  }
  disconnect(id) {
    const p = this.s.players[id];
    if (p) {
      p.connected = false;
      removeArenaPlayer(this, id);
      p.lastSeen = this.now();
      this.elect();
      this.changed();
    }
  }
  expire() {
    for (const p of Object.values(this.s.players))
      if (!p.connected && this.now() - p.lastSeen > 45000) this.remove(p.id);
  }
  remove(id, kicked = false) {
    removeArenaPlayer(this, id);
    const p = this.s.players[id];
    if (p && !kicked) {
      const { token, score, rebar, inventory, claims, ringBest, ring, pos, trolley, garage, profileKey, sharedUpgrades } = p;
      this.s.savedPlayers.push({ id, token, score, rebar, inventory, claims, ringBest, ring, pos, trolley, garage, profileKey, sharedUpgrades });
      this.s.savedPlayers = this.s.savedPlayers.slice(-32);
    }
    delete this.s.players[id];
    const q = this.s.quest;
    const i = q.roles.indexOf(id);
    if (i >= 0) q.roles[i] = null;
    for (const g of Object.values(this.s.games)) {
      if (g.players.includes(id) && g.status === 'playing')
        this.finish(
          g,
          g.players.filter((x) => x !== id && this.s.players[x]?.connected),
          'A Bung left the table.',
        );
      g.players = g.players.filter((x) => x !== id);
      if (!g.players.length) delete this.s.games[g.id];
    }
    this.elect();
    this.changed();
  }
  move(id, msg) {
    const p = this.s.players[id],
      n = this.now();
    if (!p) fail('Join first.');
    if ((msg.warp ?? 0) !== (p.warp ?? 0)) return false;
    if (racing(this, id) && this.s.events.race.status === 'running' && n < this.s.events.race.launchAt) return false;
    if (!Number.isSafeInteger(msg.seq) || msg.seq <= p.moveSeq) return false;
    const v = msg.pos;
    if (
      !v ||
      !finite(v.x, -12000, 12000) ||
      !finite(v.z, -12000, 12000) ||
      !finite(v.y, -20, 600) ||
      !finite(msg.yaw, -10000, 10000)
    )
      fail('Invalid position.');
    const arena = this.s.arena;
    const fighter = arenaLive(arena) && arena.players.includes(id);
    if (fighter) {
      if (msg.riding || !arenaContains(v)) fail('Position corrected: stay on foot inside the arena.');
      if ((arena.phase === 'countdown' || p.stunnedUntil > n) && gap(p.pos, v) > .65) return false;
    }
    if (n - (p.moveAt || 0) < 80) return false;
    let speedLimit = 58;
    if (!fighter) {
      const frame = weatherAt(hashWeather(this.s.code), Math.max(0, (n-this.s.created)/1000));
      const tornado = frame.tornado;
      if (tornado?.ground && Math.hypot(p.pos.x-tornado.x,p.pos.z-tornado.z)<tornado.reach+30)
        p.weatherFlight={until:n+(tornado.duration+3)*1000,speed:Math.max(82,tornado.toss+60)};
      if (p.weatherFlight?.until>n) speedLimit=p.weatherFlight.speed;
      else {
        delete p.weatherFlight;
        // Driving and the deterministic storm's wind can combine.
        if(frame.core>.35 && Math.hypot(p.pos.x-frame.x,p.pos.z-frame.z)<1700) speedLimit=82;
      }
    }
    const allowed =
      (fighter ? 13 : speedLimit) * Math.min(2, Math.max(0.08, (n - (p.moveAt || n - 125)) / 1000)) + 2;
    if (gap(p.pos, v) > allowed)
      fail('Position corrected: travel through the city normally.');
    p.pos = { x: v.x, y: v.y, z: v.z };
    p.yaw = msg.yaw;
    p.riding = !!msg.riding;
    p.moveSeq = msg.seq;
    p.moveAt = n;
    p.lastSeen = n;
    return true;
  }
  ringCrossed(id, previous) {
    const p = this.s.players[id], run = p?.ring;
    return run?.deadline > this.now() &&
      p.moveAt - previous.at <= 1000 && p.moveAt > previous.at &&
      crossesGate(previous.pos, p.pos, RING_GATES[run.index]);
  }
  advanceRing(id, previous) {
    if (!this.ringCrossed(id, previous)) return false;
    const p = this.s.players[id], run = p.ring, now = this.now();
    if (run.index === 0) {
      run.start = now;
      run.deadline = Math.min(now + 90000, this.s.events.ring?.deadline ?? Infinity);
    }
    run.index++;
    if (run.index === RING_GATES.length) {
      const time = now - run.start;
      p.ringBest = Math.min(p.ringBest ?? time, time);
      p.ring = { ...run, deadline: 0, time };
      this.reward(p, 40, 24, 'Ring Rush complete');
    }
    this.changed();
    return true;
  }
  raceGate(id, previous) { return raceGate(this, id, previous); }
  advanceRace(id, previous) { return advanceRace(this, id, previous); }
  pickupOnMove(id, previous) {
    const p = this.s.players[id], now = this.now();
    const radius = p.riding ? 1.9 : 1.35;
    const height = 1.55;
    // A reconnect or server warp starts a fresh sweep at the accepted endpoint.
    const age = p.moveAt - previous.at;
    const from = age > 0 && age <= 1000 ? previous.pos : p.pos;
    const dx = (p.pos.x - from.x) / radius;
    const dy = (p.pos.y - from.y) / height;
    const dz = (p.pos.z - from.z) / radius;
    const lenSq = dx * dx + dy * dy + dz * dz;
    return PICKUPS.find(item => {
      if (!availablePickup(item, p, this.s, now)) return false;
      const x = (item.x - from.x) / radius;
      const y = (item.y - from.y) / height;
      const z = (item.z - from.z) / radius;
      const t = lenSq ? Math.max(0, Math.min(1, (x * dx + y * dy + z * dz) / lenSq)) : 0;
      const ox = x - dx * t, oy = y - dy * t, oz = z - dz * t;
      return ox * ox + oy * oy + oz * oz <= 1;
    });
  }
  collectPickup(p, item) {
    const now = this.now();
    if (!availablePickup(item, p, this.s, now)) fail('That collectible has already been claimed.');
    if (availablePickup(item, p, this.s, now, true)) {
      if (item.kind === 'rare') this.s.rareUntil[item.id] = now + 180000;
      else p.claims[item.id] = now + (item.kind === 'rebar' ? 90000 : 86400000);
      this.reward(p, item.kind === 'rare' ? 12 : 0, item.rebar, item.label, 'rebar');
    }
    collectHunt(this, p, item);
  }
  near(p, target, radius) {
    return p.moveAt != null && this.now() - p.moveAt <= 1400 &&
      gap(p.pos, target) <= radius && Math.abs(p.pos.y - target.y) < 3;
  }
  reward(p, points, rebar, reason, sound = 'questDone') {
    p.score += points;
    p.rebar += rebar;
    p.receipt = { id: this.id(), points, rebar, reason, sound };
  }
  command(id, m) {
    this.tick();
    const p = this.s.players[id];
    if (!p?.connected) fail('Reconnect to play.');
    if (typeof m.requestId !== 'string' || m.requestId.length > 64)
      fail('Missing action identifier.');
    if (p.actionIds.includes(m.requestId)) return false;
    p.actionIds.push(m.requestId);
    if (p.actionIds.length > 32) p.actionIds.shift();
    p.lastSeen = this.now();
    const a = this.s.arena;
    if (racing(this, id) && ['joinGame', 'startGame', 'questJoin', 'arenaJoin', 'arenaWatch'].includes(m.cmd))
      fail('Leave the trolley race before joining another event.');
    if ((arenaLive(a) || a.phase === 'waiting') && a.players.includes(id) &&
        ['joinGame', 'startGame', 'questJoin', 'ringStart'].includes(m.cmd))
      fail('Leave Burger Heist before starting another activity.');
    switch (m.cmd) {
      case 'sellScore': {
        const sold=p.score;
        if(sold<=0)fail('No Bung Score to sell.');
        this.reward(p,-sold,Math.max(1,Math.round(sold/10)),'Bung Score sold for rebar','sell');
        break;
      }
      case 'garageTune': {
        if(racing(this,id))fail('Finish the race before adjusting your setup.');
        if(!this.near(p,GARAGE,22))fail('Drive into Bung Garage to tune your trolley.');
        p.garage??={};p.garage[p.trolley]=garageSetup(p.garage[p.trolley],m.setup);break;
      }
      case 'garageBuy': {
        if(racing(this,id))fail('Finish the race before visiting Bung Garage.');
        if(!this.near(p,GARAGE,22))fail('Drive into Bung Garage to fit parts.');
        const {next,cost}=garageAction(p.garage?.[p.trolley],m.part,m.action,p.rebar);
        p.garage??={};p.garage[p.trolley]=next;
        this.reward(p,0,-cost,'Bung Garage fitted your part','buy');
        break;
      }
      case 'chat': {
        const text = clean(m.text, 180);
        if (!text) fail('Write a message first.');
        if (p.mutedUntil > this.now()) fail('Chat is muted by the room host.');
        p.chatAt = p.chatAt.filter((t) => this.now() - t < 5000);
        if (p.chatAt.length >= 4) fail('Give the chat a moment.');
        p.chatAt.push(this.now());
        this.s.chat.push({
          id: this.id(),
          from: id,
          name: p.name,
          text,
          at: this.now(),
        });
        this.s.chat = this.s.chat.slice(-50);
        break;
      }
      case 'moderate': {
        if (this.s.host !== id) fail('Only the room host can do that.');
        const target = this.s.players[m.player];
        if (!target || target.id === id) fail('Choose another player.');
        if (m.action === 'kick') {
          this.s.banned.push(target.token);
          this.s.banned = this.s.banned.slice(-32);
          this.remove(target.id, true);
        } else if (m.action === 'mute') target.mutedUntil = this.now() + 300000;
        else fail('Unknown moderation action.');
        break;
      }
      case 'joinGame':
        this.joinGame(p, m.game);
        break;
      case 'ready': {
        const g = this.gameFor(p, m.game, 'waiting');
        g.ready[id] = !g.ready[id];
        break;
      }
      case 'startGame':
        this.startGame(p, m.game);
        break;
      case 'leaveGame': {
        const g = this.s.games[m.game];
        if (g?.players.includes(id)) {
          if (g.status === 'playing')
            this.finish(
              g,
              g.players.filter((x) => x !== id && this.s.players[x]?.connected),
              'A Bung left the table.',
            );
          g.players = g.players.filter((x) => x !== id);
          if (!g.players.length) delete this.s.games[m.game];
          else if (g.owner === id) g.owner = g.players[0];
        }
        break;
      }
      case 'play':
        this.play(p, m.game, m.action);
        break;
      case 'questJoin': {
        if (this.s.quest.status === 'complete')
          fail('Quest complete. The host can start another expedition.');
        if (this.s.quest.roles.includes(id)) break;
        const slot = this.s.quest.roles.indexOf(null);
        if (slot < 0)
          fail(
            'The quest has its four players. You can spectate or play a minigame.',
          );
        if (
          Object.values(this.s.games).some(
            (g) => g.status === 'playing' && g.players.includes(id),
          )
        )
          fail('Finish your minigame first.');
        this.s.quest.roles[slot] = id;
        this.s.quest.invite ??= this.id();
        this.s.quest.inviter ??= id;
        this.s.quest.opened ??= this.now();
        break;
      }
      case 'questLeave': {
        const i = this.s.quest.roles.indexOf(id);
        if (i >= 0) this.s.quest.roles[i] = null;
        break;
      }
      case 'questStart': {
        if (this.s.host !== id) fail('The room host starts the expedition.');
        const q = this.s.quest;
        if (q.status === 'playing') fail('The expedition is already running.');
        if (q.roles.some((x) => !this.s.players[x]?.connected))
          fail('Exactly four connected quest players are needed.');
        if (
          Object.values(this.s.games).some(
            (g) =>
              g.status === 'playing' &&
              g.players.some((id) => q.roles.includes(id)),
          )
        )
          fail(
            'All four quest players must finish or leave their minigames first.',
          );
        if ((arenaLive(this.s.arena) || this.s.arena.phase === 'waiting') &&
            q.roles.some(id => this.s.arena.players.includes(id))) fail('All four quest players must leave the arena queue.');
        q.status = 'playing';
        q.started = this.now();
        q.stage = 0;
        q.done = [false, false, false, false];
        q.pads = {};
        q.awarded = false;
        break;
      }
      case 'questReset': {
        if (this.s.host !== id) fail('Only the host can reset the quest.');
        this.s.quest = {
          status: 'waiting',
          roles: [null, null, null, null],
          stage: 0,
          done: [false, false, false, false],
          pads: {},
          awarded: false,
        };
        break;
      }
      case 'arenaJoin':
        if (p.ring?.deadline) eventCommand(this, p, { cmd: 'ringCancel' });
        arenaCommand(this, p, m);
        this.s.arena.invite ??= this.id();
        this.s.arena.opened ??= this.now();
        break;
      case 'arenaReady':
      case 'arenaLeave':
      case 'arenaAct':
      case 'arenaWatch':
      case 'arenaUnwatch':
        arenaCommand(this, p, m);
        break;
      case 'pickup': {
        const item = PICKUPS.find(x => x.id === m.item);
        if (!item || !this.near(p, item, p.riding ? 3 : 2.65)) fail('Stand close to the collectible first.');
        this.collectPickup(p, item);
        break;
      }
      case 'exchangeBuy': {
        const item = EXCHANGE_ITEMS.find(x => x.id === m.item);
        if (!item) fail('Unknown Exchange item.');
        if (p.inventory[item.id]) break;
        if (!this.near(p, EXCHANGE, 5)) fail('Visit the City Hall Rebar Exchange to buy upgrades.');
        if (p.rebar < item.price) fail(`You need ${item.price} rebar for ${item.label}.`);
        p.inventory[item.id] = true;
        this.reward(p, 0, -item.price, item.label + ' equipped', 'buy');
        break;
      }
      case 'horn':
        if (!p.inventory.horn || !p.riding || this.now() - (p.hornAt || 0) < 1800)
          fail('Equip the horn and drive your trolley before honking.');
        p.hornAt = this.now();
        break;
      case 'ringStart':
      case 'ringCancel':
      case 'huntStart':
      case 'huntLeave':
      case 'raceStart':
      case 'raceJoin':
      case 'raceLeave':
      case 'raceReset':
        eventCommand(this, p, m);
        break;
      case 'questAct':
        this.questAct(p);
        break;
      default:
        fail('Unknown room action.');
    }
    this.elect();
    this.changed();
    return true;
  }
  joinGame(p, id) {
    const def = gameDefinition(id);
    if (!def) fail('Unknown minigame.');
    if (this.s.quest.status === 'playing' && this.s.quest.roles.includes(p.id))
      fail('Finish or leave the quest before joining a table.');
    if (
      Object.values(this.s.games).some(
        (g) =>
          g.status !== 'finished' && g.id !== id && g.players.includes(p.id),
      )
    )
      fail('Leave your current table first.');
    let g = this.s.games[id];
    if (!g || g.status === 'finished')
      g = this.s.games[id] = {
        id,
        instance: this.id(),
        owner: p.id,
        status: 'waiting',
        players: [],
        ready: {},
        scores: {},
        winners: [],
        awarded: false,
        created: this.now(),
      };
    if (g.players.includes(p.id)) return;
    if (g.status !== 'waiting')
      fail('Match in progress. Spectate, or choose another table.');
    if (g.players.length >= def.max) fail('This table is full.');
    g.players.push(p.id);
    g.ready[p.id] = false;
  }
  gameFor(p, id, status = 'playing') {
    const g = this.s.games[id];
    if (!g || !g.players.includes(p.id) || g.status !== status)
      fail('You are not playing at this table.');
    return g;
  }
  shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  startGame(p, id) {
    const g = this.gameFor(p, id, 'waiting'),
      def = gameDefinition(id);
    if (g.owner !== p.id) fail('The table captain starts the match.');
    if (
      g.players.length < def.min ||
      g.players.some((x) => !g.ready[x] || !this.s.players[x]?.connected)
    )
      fail('Everyone must be connected and ready.');
    if (
      this.s.quest.status === 'playing' &&
      g.players.some((id) => this.s.quest.roles.includes(id))
    )
      fail('Quest players must finish or leave the expedition first.');
    g.status = 'playing';
    g.started = this.now();
    g.deadline = this.now() + 180000;
    g.turn = 0;
    g.turnAt = this.now();
    for (const x of g.players) g.scores[x] = 0;
    if (id === 'tictactoe') g.board = Array(9).fill(null);
    if (id === 'connect') g.board = Array(42).fill(null);
    if (id === 'memory') {
      g.cards = this.shuffle([...Array(8).keys(), ...Array(8).keys()]);
      g.matched = [];
      g.face = [];
    }
    if (id === 'reaction') {
      g.go = this.now() + 2500 + Math.floor(this.random() * 2000);
      g.attempts = {};
      g.deadline = g.go + 10000;
    }
    if (id === 'rhythm') {
      g.go = this.now() + 2500;
      g.beats = {};
      g.deadline = g.go + 8 * 750 + 750;
    }
    if (id === 'feint') {
      g.choices = {};
      g.round = 1;
      g.deadline = this.now() + 30000;
    }
    if (id === 'stack') {
      g.stacks = Object.fromEntries(
        g.players.map((id) => [
          id,
          {
            center: 0,
            width: 90,
            layers: 0,
            done: false,
            at: this.now(),
            history: [],
          },
        ]),
      );
    }
    if (id === 'code') {
      g.code = this.shuffle([0, 1, 2, 3, 4, 5]).slice(0, 4);
      g.guesses = {};
    }
    if (id === 'slide') {
      let b = [0, 1, 2, 3, 4, 5, 6, 7, 8],
        blank = 8,
        prev = -1;
      for (let n = 0; n < 60; n++) {
        const moves = [
          blank - 3,
          blank + 3,
          blank % 3 ? blank - 1 : -1,
          blank % 3 < 2 ? blank + 1 : -1,
        ].filter((i) => i >= 0 && i < 9 && i !== prev);
        const next = moves[Math.floor(this.random() * moves.length)];
        [b[next], b[blank]] = [b[blank], b[next]];
        prev = blank;
        blank = next;
      }
      if (b.every((v, i) => v === i)) [b[7], b[8]] = [b[8], b[7]];
      g.puzzles = Object.fromEntries(g.players.map((id) => [id, b.slice()]));
      g.moves = {};
    }
    if (id === 'rally') {
      g.checkpoints = {};
      g.deadline = this.now() + 600000;
    }
  }
  turn(g, p) {
    if (g.players[g.turn % g.players.length] !== p.id)
      fail('Wait for your turn.');
  }
  next(g) {
    g.turn = (g.turn + 1) % g.players.length;
    g.turnAt = this.now();
  }
  finish(g, winners = [], reason = 'Match complete') {
    if (g.status === 'finished') return;
    g.status = 'finished';
    g.winners = [...new Set(winners)].filter((id) => g.players.includes(id));
    g.reason = reason;
    g.finished = this.now();
    if (!g.awarded) {
      for (const id of g.players) {
        const p = this.s.players[id];
        if (p) {
          const points = g.winners.length ? (g.winners.includes(id) ? 10 : 2) : 3;
          this.reward(p, points, points, 'Minigame complete');
        }
      }
      g.awarded = true;
    }
  }
  best(g) {
    const best = Math.max(...g.players.map((id) => g.scores[id] || 0));
    return best > 0 ? g.players.filter((id) => g.scores[id] === best) : [];
  }
  play(p, id, a) {
    const g = this.gameFor(p, id);
    if (!a || typeof a !== 'object') fail('Choose a move.');
    if (id === 'tictactoe') {
      this.turn(g, p);
      if (
        !Number.isInteger(a.cell) ||
        a.cell < 0 ||
        a.cell > 8 ||
        g.board[a.cell] !== null
      )
        fail('Choose an empty square.');
      g.board[a.cell] = p.id;
      if (lines.some((l) => l.every((i) => g.board[i] === p.id)))
        this.finish(g, [p.id], 'Three enormous tokens in a row!');
      else if (g.board.every(Boolean))
        this.finish(g, [], 'A perfectly balanced burger draw.');
      else this.next(g);
    }
    if (id === 'connect') {
      this.turn(g, p);
      if (!Number.isInteger(a.column) || a.column < 0 || a.column > 6)
        fail('Choose a column.');
      let row = 5;
      while (row >= 0 && g.board[row * 7 + a.column]) row--;
      if (row < 0) fail('That grill column is full.');
      g.board[row * 7 + a.column] = p.id;
      let win = false;
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
        [1, 1],
        [1, -1],
      ])
        for (let offset = -3; offset <= 0; offset++) {
          let run = true;
          for (let k = 0; k < 4; k++) {
            const x = a.column + (k + offset) * dx,
              y = row + (k + offset) * dy;
            if (x < 0 || x > 6 || y < 0 || y > 5 || g.board[y * 7 + x] !== p.id)
              run = false;
          }
          if (run) win = true;
        }
      if (win) this.finish(g, [p.id], 'Four in a grill!');
      else if (g.board.every(Boolean))
        this.finish(g, [], 'The grill is full. Draw.');
      else this.next(g);
    }
    if (id === 'memory') {
      this.turn(g, p);
      if (g.revealUntil > this.now()) fail('Look at the two cards first.');
      const c = a.cell;
      if (
        !Number.isInteger(c) ||
        c < 0 ||
        c > 15 ||
        g.matched.includes(c) ||
        g.face.includes(c)
      )
        fail('Choose a hidden card.');
      g.face.push(c);
      if (g.face.length === 2) {
        if (g.cards[g.face[0]] === g.cards[g.face[1]]) {
          g.matched.push(...g.face);
          g.face = [];
          g.scores[p.id]++;
          if (g.matched.length === 16)
            this.finish(g, this.best(g), 'Every bit of loot recovered.');
        } else g.revealUntil = this.now() + 1400;
      }
    }
    if (id === 'reaction') {
      if (g.attempts[p.id] !== undefined) fail('One burger, one buzzer.');
      const delta = this.now() - g.go;
      g.attempts[p.id] = delta < 0 ? -1 : delta;
      if (delta >= 0) g.scores[p.id] = Math.max(1, 10000 - delta);
      if (g.players.every((x) => g.attempts[x] !== undefined))
        this.finish(g, this.best(g), 'Fastest properly served burger wins.');
    }
    if (id === 'rhythm') {
      const index = a.beat;
      if (!Number.isInteger(index) || index < 0 || index > 7)
        fail('Invalid beat.');
      const hits = g.beats[p.id] || (g.beats[p.id] = {});
      if (hits[index] !== undefined) fail('That bar already has a verse.');
      const delta = Math.abs(this.now() - (g.go + index * 750));
      hits[index] = delta <= 240 ? Math.round(100 * (1 - delta / 300)) : 0;
      g.scores[p.id] = Object.values(hits).reduce((a, b) => a + b, 0);
    }
    if (id === 'feint') {
      if (![0, 1, 2].includes(a.choice) || g.choices[p.id] !== undefined)
        fail('Choose once: rebar, burger or goggles.');
      g.choices[p.id] = a.choice;
      if (g.players.every((x) => g.choices[x] !== undefined)) {
        const [x, y] = g.players,
          d = (g.choices[x] - g.choices[y] + 3) % 3;
        g.last = {
          choices: { ...g.choices },
          winner: d === 0 ? null : d === 1 ? x : y,
        };
        if (g.last.winner) g.scores[g.last.winner]++;
        if (Math.max(...Object.values(g.scores)) >= 3)
          this.finish(g, this.best(g), 'Forehead feint champion.');
        else {
          g.round++;
          g.choices = {};
          g.deadline = this.now() + 30000;
        }
      }
    }
    if (id === 'stack') {
      const s = g.stacks[p.id];
      if (s.done) fail('Your burger is plated.');
      if (this.now() - s.at < 250) fail('Let the next layer move.');
      const moving = Math.sin((this.now() - s.at) / 650) * 70,
        left = Math.max(s.center - s.width / 2, moving - s.width / 2),
        right = Math.min(s.center + s.width / 2, moving + s.width / 2);
      if (right - left < 6) s.done = true;
      else {
        s.center = (left + right) / 2;
        s.width = right - left;
        s.layers++;
        s.history.push({ center: s.center, width: s.width });
        g.scores[p.id] = s.layers * 100 + Math.round(s.width);
        if (s.layers === 12) s.done = true;
      }
      s.at = this.now();
      if (g.players.every((x) => g.stacks[x].done))
        this.finish(g, this.best(g), 'The tallest surviving burger wins.');
    }
    if (id === 'code') {
      const guesses = g.guesses[p.id] || (g.guesses[p.id] = []);
      if (guesses.length >= 8)
        fail('Eight guesses used. Watch the other Bungs.');
      if (
        !Array.isArray(a.code) ||
        a.code.length !== 4 ||
        new Set(a.code).size !== 4 ||
        a.code.some((v) => !Number.isInteger(v) || v < 0 || v > 5)
      )
        fail('Use four different colours.');
      const exact = a.code.filter((v, i) => g.code[i] === v).length,
        total = a.code.filter((v) => g.code.includes(v)).length;
      guesses.push({ code: a.code.slice(), exact, near: total - exact });
      g.scores[p.id] = exact * 10 + total;
      if (exact === 4)
        this.finish(g, [p.id], 'Seb’s lock defeated. The steel is free.');
      else if (g.players.every((x) => (g.guesses[x]?.length || 0) >= 8))
        this.finish(g, this.best(g), 'Closest code wins.');
    }
    if (id === 'slide') {
      const b = g.puzzles[p.id],
        cell = a.cell,
        blank = b.indexOf(8);
      if (
        !Number.isInteger(cell) ||
        cell < 0 ||
        cell > 8 ||
        Math.abs(Math.floor(cell / 3) - Math.floor(blank / 3)) +
          Math.abs((cell % 3) - (blank % 3)) !==
          1
      )
        fail('Slide a neighbouring tile into the gap.');
      [b[cell], b[blank]] = [b[blank], b[cell]];
      g.moves[p.id] = (g.moves[p.id] || 0) + 1;
      g.scores[p.id] = b.filter((v, i) => v === i).length;
      if (b.every((v, i) => v === i))
        this.finish(g, [p.id], 'Singlet restored to perfect order.');
    }
    if (id === 'rally') {
      const n = g.checkpoints[p.id] || 0,
        target = RALLY[n];
      if (!target || gap(p.pos, target) > 10)
        fail('Reach your next marked checkpoint first.');
      g.checkpoints[p.id] = n + 1;
      g.scores[p.id] = n + 1;
      if (n + 1 === RALLY.length)
        this.finish(g, [p.id], 'Brisbane has a new rebar rally champion.');
    }
  }
  questAct(p) {
    const q = this.s.quest,
      role = q.roles.indexOf(p.id);
    if (q.status !== 'playing' || role < 0)
      fail('Join the four-player expedition first.');
    if (q.roles.some((id) => !this.s.players[id]?.connected))
      fail(
        'Waiting for all four roles. A missing player can reconnect or be replaced.',
      );
    const t = QUEST_STAGES[q.stage].points[role];
    if (gap(p.pos, { x: t[0], z: t[1] }) > 3.5)
      fail('Stand at your own gold quest marker.');
    if (q.stage === 2) {
      q.pads[role] = this.now();
      if (
        q.roles.every(
          (id, i) =>
            gap(this.s.players[id].pos, {
              x: QUEST_STAGES[2].points[i][0],
              z: QUEST_STAGES[2].points[i][1],
            }) < 3.5 && this.now() - (q.pads[i] || 0) < 12000,
        )
      )
        q.done = [true, true, true, true];
    } else q.done[role] = true;
    if (q.done.every(Boolean)) {
      if (q.stage === 3) {
        q.status = 'complete';
        if (!q.awarded) {
          for (const id of q.roles) this.reward(this.s.players[id], 100, 50, 'Seb’s expedition complete');
          q.awarded = true;
        }
      } else {
        q.stage++;
        q.done = [false, false, false, false];
        q.pads = {};
      }
    }
  }
  tick() {
    this.expire();
    let changed = arenaTick(this);
    if (eventTick(this)) changed = true;
    for (const p of Object.values(this.s.players)) {
      if (p.ring?.deadline && this.now() >= p.ring.deadline) {
        p.ring = { ...p.ring, deadline: 0, expired: true };
        changed = true;
      }
    }
    for (const g of Object.values(this.s.games)) {
      if (g.status !== 'playing') continue;
      if (g.id === 'memory' && g.revealUntil && this.now() >= g.revealUntil) {
        g.face = [];
        g.revealUntil = 0;
        this.next(g);
        changed = true;
      }
      if (
        ['tictactoe', 'connect', 'memory'].includes(g.id) &&
        this.now() - g.turnAt > 60000
      ) {
        const loser = g.players[g.turn];
        this.finish(
          g,
          g.players.filter((x) => x !== loser),
          'Turn timed out.',
        );
        changed = true;
      }
      if (g.deadline && this.now() >= g.deadline) {
        this.finish(g, this.best(g), 'Time! The room’s best score wins.');
        changed = true;
      }
    }
    if (changed) this.changed();
    return changed;
  }
  view(viewer) {
    const s = structuredClone(this.s);
    delete s.banned;
    delete s.savedPlayers;
    for (const p of Object.values(s.players)) {
      delete p.token;
      delete p.profileKey;
      delete p.actionIds;
      delete p.chatAt;
      delete p.moveAt;
      delete p.arenaReturn;
      if (p.id !== viewer) delete p.watchReturn;
      delete p.arenaActAt;
      if (p.id !== viewer) {
        delete p.receipt;
        delete p.claims;
      }
    }
    for (const g of Object.values(s.games)) {
      if (g.id === 'memory') {
        g.visible = g.cards?.map((v, i) =>
          g.matched.includes(i) || g.face.includes(i) ? v : null,
        );
        delete g.cards;
      }
      if (g.id === 'code') {
        delete g.code;
        g.guesses = { [viewer]: g.guesses?.[viewer] || [] };
      }
      if (g.id === 'feint') {
        g.chosen = Object.keys(g.choices || {});
        delete g.choices;
      }
    }
    return s;
  }
}
