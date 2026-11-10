import { PICKUPS, arenaLive, huntOpen } from '../src/multiplayer/cityActivities.js';
import { raceCourse, crossesCheckpoint } from '../src/multiplayer/raceCourses.js';

const active = (event, now) => event?.deadline > now && event.status !== 'finished';
export const huntTargets = PICKUPS.filter(p => p.kind !== 'rare').map(p => p.id);

function busy(engine, id) {
  const s = engine.s;
  return (arenaLive(s.arena) || s.arena.phase === 'waiting') && s.arena.players.includes(id) ||
    s.quest.status === 'playing' && s.quest.roles.includes(id) ||
    Object.values(s.games).some(g => g.status === 'playing' && g.players.includes(id));
}
export function racing(engine, id) {
  const r = engine.s.events.race;
  return active(r, engine.now()) && !!r.entries[id] && !r.entries[id].finished;
}
function enrollRing(p, event) {
  if (p.ring?.event === event.id && p.ring.time != null) return;
  if (p.ring?.deadline > event.created) return;
  event.entries[p.id] = true;
  p.ring = { event: event.id, index: 0, start: 0, deadline: event.deadline };
}
function enrollHunt(p, event) {
  event.entries[p.id] ??= 0;
}
export function welcomeEvents(engine, p) {
  if (busy(engine, p.id) || racing(engine, p.id)) return;
  const { ring, hunt } = engine.s.events;
  if (active(ring, engine.now()) && ring.entries[p.id] !== false) enrollRing(p, ring);
  if (active(hunt, engine.now()) && hunt.entries[p.id] !== false) enrollHunt(p, hunt);
}

function warpRacer(p, pos) {
  p.pos = { x: pos.x, y: pos.y, z: pos.z };
  p.yaw = pos.yaw;
  p.riding = true;
  p.moveAt = null;
  p.warp = (p.warp || 0) + 1;
}

export function eventCommand(engine, player, m) {
  const events = engine.s.events, now = engine.now(), id = player.id;
  if (m.cmd === 'ringStart' || m.cmd === 'huntStart') {
    if (busy(engine, id) || racing(engine, id)) throw Error('Finish your current activity first.');
    const ring = m.cmd === 'ringStart';
    const kind = ring ? 'ring' : 'hunt';
    const enroll = ring ? enrollRing : enrollHunt;
    let event = events[kind];
    if (!active(event, now)) {
      event = events[kind] = { id: engine.id(), host: id, created: now, status: 'running',
        deadline: now + (ring ? 240000 : 420000), entries: {} };
      if (!ring) Object.assign(event, { targets: huntTargets, found: {} });
      for (const p of Object.values(engine.s.players))
        if (p.connected && !busy(engine, p.id) && !racing(engine, p.id)) enroll(p, event);
    }
    if (event.entries[id] === false) delete event.entries[id];
    enroll(player, event);
    return;
  }
  if (m.cmd === 'ringCancel' || m.cmd === 'huntLeave') {
    const ring = m.cmd === 'ringCancel', event = events[ring ? 'ring' : 'hunt'];
    if (event) event.entries[id] = false;
    if (ring) player.ring = null;
    return;
  }

  let race = events.race;
  if (m.cmd === 'raceStart') {
    const course = raceCourse(m.course);
    if (!course) throw Error('Choose a Brisbane race course.');
    if (active(race, now)) throw Error('A trolley race is already open. Join it or wait for the finish.');
    if (busy(engine, id)) throw Error('Finish your current activity first.');
    race = events.race = { id: engine.id(), host: id, course: course.id, status: 'recruiting',
      created: now, deadline: now + 15000, entries: { [id]: { index: 0, penalty: 0 } }, results: [] };
  } else if (m.cmd === 'raceJoin') {
    if (!active(race, now) || race.status !== 'recruiting' || race.id !== m.event)
      throw Error('This race has already left the starting grid.');
    if (busy(engine, id)) throw Error('Finish your current activity first.');
    race.entries[id] ??= { index: 0, penalty: 0 };
  } else if (m.cmd === 'raceLeave') {
    if (race?.entries[id] && !race.entries[id].finished) {
      delete race.entries[id];
      if (!Object.keys(race.entries).length) {
        race.status = 'finished';
        race.deadline = 0;
      }
    }
  } else if (m.cmd === 'raceReset') {
    const entry = race?.entries[id];
    if (!entry || entry.finished || race.status !== 'running' || now < race.launchAt ||
      now - (entry.resetAt || 0) < 3500) throw Error('You can reset to the last checkpoint every few seconds.');
    const course = raceCourse(race.course);
    warpRacer(player, course.gates[entry.index - 1] || course.start);
    entry.penalty += 5000;
    entry.resetAt = now;
  }
}

export function eventTick(engine) {
  const events = engine.s.events, now = engine.now();
  let changed = false;
  for (const event of [events.ring, events.hunt]) {
    if (event?.status === 'running' && now >= event.deadline) {
      event.status = 'finished';
      changed = true;
    }
  }
  const race = events.race;
  if (race?.status === 'recruiting' && now >= race.deadline) {
    const course = raceCourse(race.course);
    for (const id of Object.keys(race.entries)) {
      const p = engine.s.players[id];
      if (!p?.connected || busy(engine, id)) delete race.entries[id];
      else {
        p.ring = null;
        warpRacer(p, course.start);
      }
    }
    race.status = Object.keys(race.entries).length ? 'running' : 'finished';
    race.launchAt = now + 3500;
    race.deadline = race.status === 'running' ? now + 420000 : 0;
    changed = true;
  }
  if (race?.status === 'running' && (now >= race.deadline ||
      Object.entries(race.entries).every(([id, e]) => e.finished || !engine.s.players[id]))) {
    race.status = 'finished';
    race.deadline = 0;
    changed = true;
  }
  return changed;
}

export function raceGate(engine, id, before) {
  const race = engine.s.events.race, p = engine.s.players[id], entry = race?.entries[id];
  if (race?.status !== 'running' || !entry || entry.finished || engine.now() < race.launchAt ||
    engine.now() >= race.deadline || !p.riding || p.moveAt - before.at > 1000 || p.moveAt <= before.at) return null;
  const gate = raceCourse(race.course).gates[entry.index];
  return gate && crossesCheckpoint(before.pos, p.pos, gate) ? gate : null;
}

export function advanceRace(engine, id, before) {
  const gate = raceGate(engine, id, before);
  if (!gate) return false;
  const race = engine.s.events.race, entry = race.entries[id];
  entry.index++;
  if (gate.power) entry.power = { type: gate.power, at: engine.now(), index: entry.index };
  if (entry.index === raceCourse(race.course).gates.length) {
    entry.finished = engine.now() - race.launchAt + entry.penalty;
    race.results.push({ id, time: entry.finished });
    race.results.sort((a, b) => a.time - b.time);
    engine.reward(engine.s.players[id], 60, 24, 'Trolley race finished');
    eventTick(engine);
  }
  engine.changed();
  return true;
}

export function collectHunt(engine, p, item) {
  const hunt = engine.s.events.hunt;
  if (!hunt || !huntOpen(engine.s, p, item, engine.now())) return false;
  hunt.entries[p.id]++;
  hunt.found[item.id] = p.id;
  if (Object.keys(hunt.found).length === hunt.targets.length) {
    hunt.status = 'finished';
    for (const id of Object.keys(hunt.entries)) {
      if (hunt.entries[id] !== false && engine.s.players[id])
        engine.reward(engine.s.players[id], 45, 12, 'Room Rebar Hunt complete');
    }
  }
  return true;
}
