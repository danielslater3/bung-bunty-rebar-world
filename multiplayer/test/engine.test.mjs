import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomEngine, freshRoom } from '../engine.js';
import { GAMES, QUEST_STAGES } from '../../src/multiplayer/catalog.js';
function setup(n = 2) {
  let time = 1000000,
    serial = 0,
    seed = 21;
  const e = new RoomEngine(
    freshRoom('BUNGBUNG', time),
    () => time,
    () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    },
    () => `id-${++serial}`,
  );
  const p = Array.from({ length: n }, (_, i) => e.join('Bung ' + i));
  const cmd = (who, cmd, data = {}) =>
    e.command(who.id, { cmd, requestId: 'req-' + ++serial, ...data });
  const start = (id) => {
    for (const x of p) {
      cmd(x, 'joinGame', { game: id });
      cmd(x, 'ready', { game: id });
    }
    cmd(p[0], 'startGame', { game: id });
    return e.s.games[id];
  };
  return {
    e,
    p,
    cmd,
    start,
    get time() {
      return time;
    },
    set time(t) {
      time = t;
    },
  };
}
test('ten-player cap, reconnect reservation, replacement, host migration, expiry and moderation', () => {
  const s = setup(10),
    { e, p, cmd } = s;
  assert.throws(() => e.join('Eleventh'), /maximum 10/);
  const token = p[0].token;
  e.disconnect(p[0].id);
  assert.equal(e.s.host, p[1].id);
  assert.equal(e.join('Original', token).id, p[0].id);
  assert.equal(Object.keys(e.s.players).length, 10);
  assert.throws(
    () => cmd(p[0], 'moderate', { player: p[1].id, action: 'kick' }),
    /Only/,
  );
  cmd(p[1], 'moderate', { player: p[0].id, action: 'kick' });
  assert.throws(() => e.join('Ban evasion', token), /removed/);
  e.disconnect(p[2].id);
  s.time += 46000;
  e.expire();
  assert.equal(e.s.players[p[2].id], undefined);
  assert.ok(e.join('Replacement'));
});
test('room privacy, chat throttling, no impersonation and command deduplication', () => {
  const { e, p, cmd } = setup();
  cmd(p[0], 'chat', { text: '<img src=x onerror=alert(1)> OIII!' });
  const view = e.view(p[1].id);
  assert.equal(view.chat[0].name, p[0].name);
  assert.equal(view.players[p[0].id].token, undefined);
  assert.equal(view.banned, undefined);
  const m = { cmd: 'chat', text: 'once', requestId: 'dedupe' };
  e.command(p[0].id, m);
  e.command(p[0].id, m);
  assert.equal(e.s.chat.filter((m) => m.text === 'once').length, 1);
  cmd(p[0], 'chat', { text: 'third' });
  cmd(p[0], 'chat', { text: 'fourth' });
  assert.throws(() => cmd(p[0], 'chat', { text: 'spam' }), /moment/);
});
test('movement rejects nonfinite values, speed warps and old sequence numbers', () => {
  const s = setup(),
    { e, p } = s;
  s.time += 125;
  assert.ok(e.move(p[0].id, { seq: 0, pos: { x: 6, y: 12, z: 80 }, yaw: 0 }));
  assert.equal(
    e.move(p[0].id, { seq: 0, pos: { x: 7, y: 12, z: 80 }, yaw: 0 }),
    false,
  );
  s.time += 125;
  assert.throws(
    () => e.move(p[0].id, { seq: 1, pos: { x: 9000, y: 12, z: 80 }, yaw: 0 }),
    /corrected/,
  );
  assert.throws(
    () => e.move(p[0].id, { seq: 1, pos: { x: NaN, y: 12, z: 80 }, yaw: 0 }),
    /Invalid/,
  );
});
test('all ten games require readiness and reject nonparticipants', () => {
  for (const def of GAMES) {
    const s = setup();
    s.cmd(s.p[0], 'joinGame', { game: def.id });
    assert.throws(() => s.cmd(s.p[0], 'startGame', { game: def.id }), /ready/);
    s.cmd(s.p[1], 'joinGame', { game: def.id });
    s.cmd(s.p[1], 'ready', { game: def.id });
    s.cmd(s.p[0], 'ready', { game: def.id });
    s.cmd(s.p[0], 'startGame', { game: def.id });
    const other = s.e.join('Spectator');
    assert.throws(
      () => s.cmd(other, 'play', { game: def.id, action: { cell: 0 } }),
      /not playing/,
    );
    assert.equal(s.e.s.games[def.id].status, 'playing');
  }
});
test('rebar/burger tic-tac-toe validates turns and awards victory once', () => {
  const { e, p, cmd, start } = setup(),
    g = start('tictactoe');
  assert.throws(
    () => cmd(p[1], 'play', { game: g.id, action: { cell: 0 } }),
    /turn/,
  );
  for (const [who, cell] of [
    [0, 0],
    [1, 3],
    [0, 1],
    [1, 4],
    [0, 2],
  ])
    cmd(p[who], 'play', { game: g.id, action: { cell } });
  assert.equal(g.winners[0], p[0].id);
  assert.equal(p[0].score, 10);
  e.finish(g, [p[0].id]);
  assert.equal(p[0].score, 10);
});
test('connect four detects a vertical win', () => {
  const { p, cmd, start } = setup(),
    g = start('connect');
  for (const [who, column] of [
    [0, 0],
    [1, 1],
    [0, 0],
    [1, 1],
    [0, 0],
    [1, 1],
    [0, 0],
  ])
    cmd(p[who], 'play', { game: g.id, action: { column } });
  assert.equal(g.winners[0], p[0].id);
});
test('memory hides all unturned cards, delays mismatch and completes matching pairs', () => {
  const s = setup(),
    { e, p, cmd, start } = s,
    g = start('memory');
  assert.ok(e.view(p[0].id).games.memory.visible.every((v) => v === null));
  assert.equal(e.view(p[0].id).games.memory.cards, undefined);
  let a = 0,
    b = g.cards.findIndex((v) => v !== g.cards[0]);
  cmd(p[0], 'play', { game: g.id, action: { cell: a } });
  cmd(p[0], 'play', { game: g.id, action: { cell: b } });
  assert.throws(
    () => cmd(p[0], 'play', { game: g.id, action: { cell: 2 } }),
    /Look/,
  );
  s.time += 1500;
  e.tick();
  assert.equal(g.turn, 1);
  for (let v = 0; v < 8; v++) {
    for (let i = 0; i < 16; i++)
      if (g.cards[i] === v)
        cmd(p[1], 'play', { game: g.id, action: { cell: i } });
  }
  assert.equal(g.status, 'finished');
  assert.equal(g.scores[p[1].id], 8);
});
test('buzzer penalises early hits and uses server receipt time', () => {
  const s = setup(),
    g = s.start('reaction');
  s.cmd(s.p[0], 'play', { game: g.id, action: {} });
  assert.equal(g.attempts[s.p[0].id], -1);
  s.time = g.go + 250;
  s.cmd(s.p[1], 'play', { game: g.id, action: {} });
  assert.equal(g.winners[0], s.p[1].id);
});
test('rhythm scores eight distinct timed bars and ends on the server clock', () => {
  const s = setup(),
    g = s.start('rhythm');
  for (let i = 0; i < 8; i++) {
    s.time = g.go + i * 750;
    s.cmd(s.p[0], 'play', { game: g.id, action: { beat: i } });
    assert.throws(
      () => s.cmd(s.p[0], 'play', { game: g.id, action: { beat: i } }),
      /already/,
    );
  }
  s.time = g.deadline + 1;
  s.e.tick();
  assert.equal(g.winners[0], s.p[0].id);
  assert.equal(g.scores[s.p[0].id], 800);
});
test('forehead feint hides choices and resolves first to three', () => {
  const s = setup(),
    g = s.start('feint');
  for (let n = 0; n < 3; n++) {
    s.cmd(s.p[0], 'play', { game: g.id, action: { choice: 0 } });
    assert.equal(s.e.view(s.p[1].id).games.feint.choices, undefined);
    s.cmd(s.p[1], 'play', { game: g.id, action: { choice: 2 } });
  }
  assert.equal(g.winners[0], s.p[0].id);
  assert.equal(g.scores[s.p[0].id], 3);
});
test('burger stack measures authoritative overlap and finishes twelve layers', () => {
  const s = setup(),
    g = s.start('stack');
  for (const p of s.p)
    for (let i = 0; i < 12; i++) {
      const v = g.stacks[p.id],
        period = Math.PI * 650;
      s.time = v.at + Math.ceil((s.time - v.at + 300) / period) * period;
      s.cmd(p, 'play', { game: g.id, action: {} });
    }
  assert.equal(g.status, 'finished');
  assert.ok(g.stacks[s.p[0].id].layers === 12);
});
test('codebreak keeps the code secret and validates colour multiplicity', () => {
  const s = setup(),
    g = s.start('code');
  assert.equal(s.e.view(s.p[1].id).games.code.code, undefined);
  assert.throws(
    () => s.cmd(s.p[0], 'play', { game: g.id, action: { code: [0, 0, 0, 0] } }),
    /different/,
  );
  s.cmd(s.p[0], 'play', { game: g.id, action: { code: g.code.slice() } });
  assert.equal(g.winners[0], s.p[0].id);
});
function solve(board) {
  const start = board.join(''),
    target = '012345678',
    queue = [start],
    parent = new Map([[start, null]]);
  for (let n = 0; n < queue.length; n++) {
    const s = queue[n];
    if (s === target) {
      const moves = [];
      let t = s;
      while (parent.get(t)) {
        const [a, cell] = parent.get(t);
        moves.push(cell);
        t = a;
      }
      return moves.reverse();
    }
    const b = s.indexOf('8');
    for (const i of [
      b - 3,
      b + 3,
      b % 3 ? b - 1 : -1,
      b % 3 < 2 ? b + 1 : -1,
    ].filter((i) => i >= 0 && i < 9)) {
      const a = s.split('');
      [a[b], a[i]] = [a[i], a[b]];
      const t = a.join('');
      if (!parent.has(t)) {
        parent.set(t, [s, i]);
        queue.push(t);
      }
    }
  }
  throw Error('Unsolvable');
}
test('singlet shuffles are solvable using only legal neighbouring moves', () => {
  const s = setup(),
    g = s.start('slide');
  for (const cell of solve(g.puzzles[s.p[0].id]))
    s.cmd(s.p[0], 'play', { game: g.id, action: { cell } });
  assert.equal(g.winners[0], s.p[0].id);
});
test('rally requires real ordered checkpoint proximity', () => {
  const s = setup(),
    g = s.start('rally');
  assert.throws(
    () => s.cmd(s.p[0], 'play', { game: g.id, action: {} }),
    /Reach/,
  );
  for (const [x, z] of [
    [173.1, 81.5],
    [196.5, 67.7],
    [155.6, 95.9],
    [5, 80],
  ]) {
    s.p[0].pos = { x, z, y: 12 };
    s.cmd(s.p[0], 'play', { game: g.id, action: {} });
  }
  assert.equal(g.winners[0], s.p[0].id);
});
test('four-player quest requires four distinct roles, all pads, replacement and awards once', () => {
  const s = setup(4),
    { e, p, cmd } = s;
  for (const x of p) cmd(x, 'questJoin');
  cmd(p[0], 'questStart');
  assert.throws(() => cmd(p[0], 'questAct'), /own gold/);
  for (let stage = 0; stage < 4; stage++) {
    for (let role = 0; role < 4; role++) {
      const [x, z] = QUEST_STAGES[stage].points[role];
      p[role].pos = { x, z, y: 12 };
    }
    if (stage === 1) {
      e.disconnect(p[3].id);
      assert.throws(() => cmd(p[0], 'questAct'), /four roles/);
      e.join('back', p[3].token);
    }
    for (const x of p) cmd(x, 'questAct');
  }
  assert.equal(e.s.quest.status, 'complete');
  for (const x of p) assert.equal(x.score, 100);
  assert.throws(() => cmd(p[0], 'questAct'), /Join/);
  assert.equal(p[0].score, 100);
});

test('display names and outfits are validated, shared, persisted and restored on reconnect', () => {
  const s = setup(0),
    { e } = s;
  const a = e.join('  Gold\u0000 Legend  ', undefined, {
    character: 'gabor',
    colors: ['#ABCDEF', '#123456', '#654321', '#ff8800'],
  });
  const original = structuredClone(a.appearance);
  assert.equal(a.name, 'Gold Legend');
  assert.deepEqual(a.appearance, {
    character: 'gabor',
    colors: ['#abcdef', '#123456', '#654321', '#ff8800'],
  });
  const restored = new RoomEngine(
    JSON.parse(JSON.stringify(e.s)),
    () => s.time,
    Math.random,
    () => crypto.randomUUID(),
  );
  restored.disconnect(a.id);
  const joined = restored.join('New display name', a.token);
  assert.equal(joined.id, a.id);
  assert.deepEqual(joined.appearance, original);
  assert.equal(joined.name, 'New display name');
  assert.deepEqual(
    restored.view(joined.id).players[joined.id].appearance,
    original,
  );
  const same = restored.join('New display name', a.token, {
    character: 'invented',
    colors: ['bad'],
  });
  assert.equal(same.appearance.character, 'bung');
  const other = restored.join('Other', undefined, {
    character: 'ching',
    colors: ['#112233'],
  });
  assert.equal(other.appearance.character, 'ching');
  assert.notDeepEqual(other.appearance, same.appearance);
});

test('a waiting table cannot pull an active quest player into another match, and a running match blocks quest start', () => {
  const s = setup(4),
    { p, cmd } = s;
  for (const x of p) cmd(x, 'questJoin');
  for (const x of p.slice(0, 2)) {
    cmd(x, 'joinGame', { game: 'tictactoe' });
    cmd(x, 'ready', { game: 'tictactoe' });
  }
  cmd(p[0], 'questStart');
  assert.throws(
    () => cmd(p[0], 'startGame', { game: 'tictactoe' }),
    /expedition/,
  );
  cmd(p[0], 'questReset');
  for (const x of p) cmd(x, 'questJoin');
  cmd(p[0], 'startGame', { game: 'tictactoe' });
  assert.throws(() => cmd(p[0], 'questStart'), /minigames/);
});
