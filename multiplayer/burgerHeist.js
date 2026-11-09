// All round transitions run on the owning room instance.
import { ARENA, ARENA_COVER, ARENA_DOCK, ARENA_STAND, arenaContains, arenaLive } from '../src/multiplayer/cityActivities.js';
export const emptyArena = (size = 2) => ({
  size, phase: 'waiting', players: [], ready: {}, teams: {}, scores: [0, 0],
  deadline: 0, carrier: null, burger: null, winner: null, result: '',
});
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const blocked = (a, b) => {
  for (let i = 1; i < 10; i++) {
    const t = i / 10, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
    if (ARENA_COVER.some(c => Math.abs(x - ARENA.x - c.dx) < c.w / 2 &&
      Math.abs(z - ARENA.z - c.dz) < c.d / 2)) return true;
  }
  return false;
};
function warp(p, pos) {
  p.pos = { x: pos.x, y: pos.y, z: pos.z };
  p.riding = false;
  p.moveAt = null;
  p.warp = (p.warp || 0) + 1;
}
function start(engine) {
  const a = engine.s.arena;
  a.phase = 'countdown';
  a.deadline = engine.now() + 3500;
  a.burger = { x: ARENA.x, y: ARENA.y, z: ARENA.z };
  for (const [i, id] of a.players.entries()) {
    const p = engine.s.players[id], team = i % 2, dock = ARENA_DOCK[team];
    a.teams[id] = team;
    p.arenaReturn = p.pos;
    p.stunnedUntil = 0;
    p.arenaActAt = 0;
    warp(p, { ...dock, z: dock.z + (i < 2 ? -2.7 : 2.7) });
  }
}
function finish(engine, winner, result, award) {
  const a = engine.s.arena;
  a.phase = 'finished';
  a.deadline = 0;
  a.winner = winner;
  a.result = result;
  a.carrier = null;
  a.burger = null;
  for (const id of a.players) {
    const p = engine.s.players[id];
    if (!p) continue;
    if (p.arenaReturn) warp(p, p.arenaReturn);
    delete p.arenaReturn;
    delete p.stunnedUntil;
    if (award && p.connected) {
      const won = a.teams[id] === winner;
      engine.reward(p, won ? 25 : winner == null ? 12 : 8, won ? 18 : 8, result);
    }
  }
}
export function removeArenaPlayer(engine, id) {
  const a = engine.s.arena;
  if (!a.players.includes(id)) return;
  if (arenaLive(a)) {
    const opposing = 1 - a.teams[id];
    const present = a.players.some(pid => a.teams[pid] === opposing && engine.s.players[pid]?.connected);
    finish(engine, a.phase === 'playing' && present ? opposing : null,
      'Burger Heist ended early · a fighter left', false);
  }
  if (a.phase === 'waiting') {
    a.players = a.players.filter(pid => pid !== id);
    delete a.ready[id];
  }
}
export function arenaTick(engine) {
  const a = engine.s.arena, now = engine.now();
  if (!a.deadline || now < a.deadline) return false;
  if (a.phase === 'countdown') {
    a.phase = 'playing';
    a.deadline = now + 90000;
  } else if (a.phase === 'playing') {
    const [red, blue] = a.scores;
    const winner = red === blue ? null : red > blue ? 0 : 1;
    finish(engine, winner, winner == null ? 'Burger Heist draw' : 'Burger Heist won on time', true);
  }
  return true;
}

export function arenaCommand(engine, p, m) {
  const now = engine.now(), room = engine.s;
  let a = room.arena;
  const live = arenaLive(a);
  const member = a.players.includes(p.id);
  const fail = message => { throw new Error(message); };
  if (m.cmd === 'arenaWatch' || m.cmd === 'arenaUnwatch') {
    if (live && member) fail('Leave the round before spectating.');
    if (m.cmd === 'arenaUnwatch') {
      if (p.watchReturn) warp(p, p.watchReturn);
      delete p.watchReturn;
      return;
    }
    if (p.watchReturn) return;
    if (p.ring?.deadline || (room.quest.status === 'playing' && room.quest.roles.includes(p.id)) ||
        Object.values(room.games).some(g => g.status === 'playing' && g.players.includes(p.id)))
      fail('Finish your current activity before spectating.');
    p.watchReturn = p.pos;
    warp(p, ARENA_STAND);
    return;
  }
  if (m.cmd === 'arenaJoin') {
    if (live) fail('Burger Heist is already in progress.');
    if (p.ring?.deadline) fail('Finish or cancel Ring Rush first.');
    if (room.quest.status === 'playing' && room.quest.roles.includes(p.id)) fail('Finish the expedition first.');
    if (Object.values(room.games).some(g => g.status === 'playing' && g.players.includes(p.id))) fail('Finish your minigame first.');
    const size = m.size === 4 ? 4 : 2;
    if (a.phase === 'finished' || !a.players.length) a = room.arena = emptyArena(size);
    if (a.size !== size) fail('The waiting arena has a different team size.');
    if (!a.players.includes(p.id)) {
      if (a.players.length >= a.size) fail('The arena is full.');
      a.players.push(p.id);
    }
    return;
  }
  if (!member) fail('Join the Burger Heist queue first.');
  if (m.cmd === 'arenaLeave') {
    removeArenaPlayer(engine, p.id);
    return;
  }
  if (m.cmd === 'arenaReady') {
    if (a.phase !== 'waiting') fail('The arena has already started.');
    if (room.quest.status === 'playing' && room.quest.roles.includes(p.id)) fail('Finish the expedition first.');
    if (Object.values(room.games).some(g => g.status === 'playing' && g.players.includes(p.id))) fail('Finish your minigame first.');
    a.ready[p.id] = !a.ready[p.id];
    if (a.players.length === a.size && a.players.every(id => a.ready[id] && room.players[id]?.connected)) start(engine);
    return;
  }
  if (a.phase !== 'playing' || !arenaContains(p.pos) || p.riding || p.stunnedUntil > now ||
      p.moveAt == null || now - p.moveAt > 1300) fail('Get ready inside the arena first.');
  if (now - (p.arenaActAt || 0) < 350) fail('Give the tackle a moment.');
  p.arenaActAt = now;
  const team = a.teams[p.id];
  if (a.carrier === p.id) {
    if (distance(p.pos, ARENA_DOCK[team]) > 3) fail('Carry the burger back to your team dock.');
    a.scores[team]++;
    a.carrier = null;
    a.burger = { x: ARENA.x, y: ARENA.y, z: ARENA.z };
    if (a.scores[team] >= 2) finish(engine, team, 'Burger Heist complete', true);
    return;
  }
  if (!a.carrier) {
    if (distance(p.pos, a.burger) > 2.6) fail('Get closer to the burger.');
    a.carrier = p.id;
    return;
  }
  const carrier = room.players[a.carrier];
  if (a.teams[carrier.id] === team) fail('Your teammate has the burger. Cover their return.');
  if (distance(p.pos, carrier.pos) > 2.8 || blocked(p.pos, carrier.pos)) fail('Get alongside the opposing carrier to tackle.');
  a.carrier = p.id;
  carrier.stunnedUntil = now + 1300;
  const dock = ARENA_DOCK[a.teams[carrier.id]];
  warp(carrier, { ...dock, z: dock.z + 2.7 });
}
