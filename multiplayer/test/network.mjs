// Integration against an actual workerd Durable Object, not an in-process mock.
import assert from 'node:assert/strict';
const endpoint = process.env.ROOM_SERVER || 'http://127.0.0.1:8795';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, label) => {
  for (let i = 0; i < 200; i++) {
    const v = fn();
    if (v) return v;
    await sleep(25);
  }
  throw Error('Timed out: ' + label);
};
const r = await fetch(endpoint + '/rooms', { method: 'POST' }),
  { code } = await r.json();
assert.equal(r.status, 201);
const clients = [];
async function join(name, token, appearance) {
  const ws = new WebSocket(
      endpoint.replace(/^http/, 'ws') + `/rooms/${code}/socket`,
    ),
    c = { ws, messages: [], name };
  clients.push(c);
  ws.onmessage = (e) => {
    if (e.data === 'pong') return;
    const m = JSON.parse(e.data);
    c.messages.push(m);
    if (m.type === 'welcome') {
      c.id = m.id;
      c.token = m.token;
      c.room = m.room;
    }
    if (m.type === 'state') c.room = m.room;
    if (m.type === 'error') c.error = m.message;
  };
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  ws.send(
    JSON.stringify({ type: 'hello', protocol: 1, name, token, appearance }),
  );
  await until(() => c.id || c.error, 'join');
  return c;
}
function cmd(c, cmd, data = {}) {
  c.ws.send(
    JSON.stringify({
      type: 'command',
      cmd,
      requestId: crypto.randomUUID(),
      ...data,
    }),
  );
}
try {
  const a = await join('First Bung', undefined, {
      character: 'gabor',
      colors: ['#abcdef', '#123456', '#998877', '#eecc00'],
    }),
    b = await join('Burger Bung', undefined, {character:'ch\u0069ng',colors:['#00ab99','#223344','#334455','#445566']});
  assert.equal(a.room.host, a.id);
  assert.equal(b.room.players[b.id].appearance.character, 'chung');
  assert.equal(b.room.players[b.id].appearance.colors[0], '#00ab99');
  await until(
    () => b.room.players[a.id]?.appearance?.character === 'gabor',
    'shared outfit',
  );
  assert.equal(b.room.players[a.id].appearance.colors[0], '#abcdef');
  cmd(a, 'chat', { text: 'OIII! <img src=x onerror=alert(1)>' });
  await until(() => b.room.chat.length === 1, 'chat delivery');
  assert.equal(b.room.chat[0].name, 'First Bung');
  cmd(a, 'joinGame', { game: 'tictactoe' });
  await until(() => b.room.games.tictactoe, 'table create');
  cmd(b, 'joinGame', { game: 'tictactoe' });
  await until(() => a.room.games.tictactoe.players.length === 2, 'table join');
  cmd(a, 'ready', { game: 'tictactoe' });
  cmd(b, 'ready', { game: 'tictactoe' });
  await until(
    () => Object.values(a.room.games.tictactoe.ready).every(Boolean),
    'ready',
  );
  cmd(a, 'startGame', { game: 'tictactoe' });
  await until(() => b.room.games.tictactoe.status === 'playing', 'start');
  cmd(b, 'play', { game: 'tictactoe', action: { cell: 0 } });
  await until(() => b.error?.includes('turn'), 'illegal turn rejected');
  for (const [c, cell] of [
    [a, 0],
    [b, 3],
    [a, 1],
    [b, 4],
    [a, 2],
  ]) {
    cmd(c, 'play', { game: 'tictactoe', action: { cell } });
    await until(
      () =>
        a.room.games.tictactoe.board[cell] === c.id &&
        b.room.games.tictactoe.board[cell] === c.id,
      'board convergence',
    );
  }
  assert.equal(b.room.games.tictactoe.winners[0], a.id);
  assert.equal(b.room.players[a.id].score, 10);
  const extra = [];
  for (let i = 2; i < 10; i++) extra.push(await join('Bung ' + i));
  const full = await join('Eleventh');
  assert.match(full.error, /maximum 10/);
  assert.equal(Object.keys(a.room.players).length, 10);
  for (const c of [a, b, ...extra.slice(0, 2)]) {
    cmd(c, 'questJoin');
    await sleep(40);
  }
  await until(() => a.room.quest.roles.every(Boolean), 'four roles');
  cmd(a, 'questStart');
  await until(() => b.room.quest.status === 'playing', 'shared quest start');
  cmd(a, 'questAct');
  await until(
    () => a.error?.includes('own gold'),
    'remote quest claim rejected',
  );
  a.ws.close(1000, 'host left');
  await until(() => b.room.host === b.id, 'host migration');
  const reconnect = await join('First Bung', a.token);
  assert.equal(reconnect.room.players[a.id].appearance.character, 'gabor');
  assert.equal(reconnect.room.players[a.id].appearance.colors[0], '#abcdef');
  let closed = false;
  b.ws.addEventListener('close', () => (closed = true), { once: true });
  b.ws.close(); // A status-less close must receive a valid close reply.
  await until(() => closed, 'status-less close handshake');
  const restoredB = await join('Burger Bung', b.token);
  assert.equal(restoredB.id, b.id);
  assert.equal(restoredB.room.players[b.id].appearance.character, 'chung');

  assert.equal(reconnect.id, a.id);
  assert.equal(reconnect.room.players[a.id].score, 10);
  assert.equal(reconnect.room.quest.status, 'playing');
  const before = JSON.stringify(reconnect.room.games.tictactoe);

  console.log(
    JSON.stringify(
      {
        room: code,
        chat: 'delivered',
        ticTacToe: 'converged',
        capacity: 10,
        eleventh: 'rejected',
        quest: 'four roles started; invalid claims rejected',
        rejoin: 'same identity and score',
        host: 'migrated',
      },
      null,
      2,
    ),
  );
} finally {
  for (const c of clients)
    try {
      c.ws.close();
    } catch {}
}
