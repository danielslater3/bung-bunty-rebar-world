import { DurableObject } from 'cloudflare:workers';
import { RoomEngine, freshRoom } from './engine.js';
import { PROTOCOL } from '../src/multiplayer/catalog.js';
const attachmentPlayer = (p) => ({
  pos: p.pos,
  yaw: p.yaw,
  riding: p.riding,
  moveSeq: p.moveSeq,
  moveAt: p.moveAt,
  warp: p.warp,
});
const json = (data, status = 200, headers = {}) =>
  Response.json(data, { status, headers });
export default {
  async fetch(request, env) {
    const u = new URL(request.url),
      origin = request.headers.get('Origin');
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',');
    if (origin && !allowed.includes(origin))
      return json({ error: 'This game origin is not enabled.' }, 403);
    const cors = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
      'Cache-Control': 'no-store',
    };
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: cors });
    try {
      if (u.pathname === '/health')
        return json(
          { ok: true, protocol: PROTOCOL, maxPlayers: 10 },
          200,
          cors,
        );
      if (u.pathname === '/rooms' && request.method === 'POST') {
        const bytes = crypto.getRandomValues(new Uint8Array(8)),
          chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
          code = Array.from(bytes, (b) => chars[b % chars.length]).join('');
        const stub = env.ROOMS.getByName(code, { locationHint: 'oc' });
        await stub.create(code);
        return json({ code, protocol: PROTOCOL }, 201, cors);
      }
      const match = u.pathname.match(
        /^\/rooms\/([A-HJ-NP-Z2-9]{8})(\/socket)?$/,
      );
      if (!match) return json({ error: 'Room not found.' }, 404, cors);
      const stub = env.ROOMS.getByName(match[1], { locationHint: 'oc' });
      // A WebSocket upgrade must use fetch; metadata and creation use RPC.
      if (
        match[2] &&
        request.headers.get('Upgrade')?.toLowerCase() === 'websocket'
      )
        return await stub.fetch(request);
      const meta = await stub.metadata();
      return json(meta, meta.error ? 404 : 200, cors);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'room_request_failed',
          message: String(error.message).slice(0, 100),
        }),
      );
      return json(
        {
          error:
            'The room server is temporarily unavailable. Please reconnect.',
        },
        503,
        cors,
      );
    }
  },
};
export class BungRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(
        'CREATE TABLE IF NOT EXISTS room_state (id INTEGER PRIMARY KEY CHECK (id=1), body TEXT NOT NULL)',
      );
      const rows = ctx.storage.sql
        .exec('SELECT body FROM room_state WHERE id=1')
        .toArray();
      this.engine = rows.length
        ? new RoomEngine(JSON.parse(rows[0].body))
        : null;
      if (this.engine) {
        for (const p of Object.values(this.engine.s.players))
          p.connected = false;
        for (const ws of ctx.getWebSockets()) {
          const a = ws.deserializeAttachment();
          if (a?.id && this.engine.s.players[a.id])
            Object.assign(
              this.engine.s.players[a.id],
              a.player && (a.player.warp ?? 0) === (this.engine.s.players[a.id].warp ?? 0)
                ? {
                    pos: a.player.pos,
                    yaw: a.player.yaw,
                    moveSeq: a.player.moveSeq,
                    moveAt: a.player.moveAt,
                    lastSeen: Date.now(),
                    riding: a.player.riding,
                  }
                : {},
              { connected: true },
            );
        }
        this.engine.elect();
      }
    });
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong'),
    );
  }
  persist(next) {
    this.ctx.storage.sql.exec(
      'INSERT INTO room_state(id,body) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',
      JSON.stringify(next.s),
    );
    this.engine = next;
  }
  next() {
    return new RoomEngine(structuredClone(this.engine.s));
  }
  async create(code) {
    if (!this.engine) this.persist(new RoomEngine(freshRoom(code, Date.now())));
    await this.schedule();
    return true;
  }
  metadata() {
    return this.engine
      ? {
          code: this.engine.s.code,
          protocol: PROTOCOL,
          players: Object.values(this.engine.s.players).filter(
            (p) => p.connected,
          ).length,
          maxPlayers: 10,
        }
      : { error: 'That room has expired or does not exist.' };
  }
  async fetch(request) {
    if (!this.engine) return json({ error: 'Room not found.' }, 404);
    if (this.ctx.getWebSockets().length >= 32)
      return json({ error: 'Room connection limit.' }, 429);
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({
      pending: true,
      at: Date.now(),
      rateAt: Date.now(),
      rate: 0,
    });
    await this.schedule();
    return new Response(null, { status: 101, webSocket: client });
  }
  send(ws, data) {
    try {
      ws.send(JSON.stringify(data));
    } catch {
      try {
        ws.close(1011, 'Reconnect');
      } catch {}
    }
  }
  broadcast() {
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (a?.id && !this.engine.s.players[a.id]) {
        this.send(ws, {
          type: 'removed',
          message: 'The room host removed you.',
        });
        ws.close(4003, 'Removed');
        continue;
      }
      if (a?.id)
        this.send(ws, {
          type: 'state',
          room: this.engine.view(a.id),
          serverTime: Date.now(),
        });
    }
  }
  async webSocketMessage(ws, message) {
    if (typeof message !== 'string' || message.length > 8192) {
      ws.close(1009, 'Message too large');
      return;
    }
    let a = ws.deserializeAttachment();
    try {
      const m = JSON.parse(message);
      if (!m || typeof m !== 'object' || Array.isArray(m))
        throw Error('Invalid message.');
      const now = Date.now();
      let reschedule = m.type !== 'move';
      if (now - a.rateAt > 1000) {
        a.rateAt = now;
        a.rate = 0;
      }
      if (++a.rate > 24) {
        ws.serializeAttachment(a);
        throw Error('Slow down a little.');
      }
      if (a.pending) {
        if (m.type !== 'hello' || m.protocol !== PROTOCOL)
          throw Error('Update the game before joining this room.');
        const next = this.next(),
          p = next.join(
            m.name,
            typeof m.token === 'string' ? m.token : null,
            m.appearance,
          );
        // Rejoining a session replaces the old socket without taking an extra slot.
        for (const other of this.ctx.getWebSockets())
          if (other !== ws && other.deserializeAttachment()?.id === p.id)
            other.close(4001, 'Rejoined in another tab');
        this.persist(next);
        a = { id: p.id, player: attachmentPlayer(p), rateAt: now, rate: 1 };
        ws.serializeAttachment(a);
        this.send(ws, {
          type: 'welcome',
          id: p.id,
          token: p.token,
          seq: p.moveSeq,
          room: next.view(p.id),
          serverTime: now,
        });
        this.broadcast();
      } else if (m.type === 'move') {
        const current = this.engine.s.players[a.id];
        const previous = current && { pos: current.pos, at: current.moveAt || 0 };
        if (this.engine.move(a.id, m)) {
          const gate = this.engine.ringCrossed(a.id, previous);
          const pickup = this.engine.pickupOnMove(a.id, previous);
          if (gate || pickup) {
            const next = this.next();
            if (pickup) {
              next.collectPickup(next.s.players[a.id], pickup);
              next.changed();
            }
            if (gate) next.advanceRing(a.id, previous);
            this.persist(next);
            reschedule = gate;
            this.broadcast();
          }
          const p = this.engine.s.players[a.id];
          a.player = attachmentPlayer(p);
          ws.serializeAttachment(a);
          for (const peer of this.ctx.getWebSockets())
            if (peer !== ws && peer.deserializeAttachment()?.id)
              this.send(peer, {
                type: 'move',
                id: p.id,
                pos: p.pos,
                yaw: p.yaw,
                seq: p.moveSeq,
                riding: p.riding,
                serverTime: now,
              });
        }
      } else if (m.type === 'command') {
        const next = this.next();
        if (next.command(a.id, m)) {
          this.persist(next);
          this.broadcast();
        }
        a.player = attachmentPlayer(this.engine.s.players[a.id]);
        ws.serializeAttachment(a);
      } else if (m.type === 'sync') {
        const next = this.next();
        if (next.tick()) this.persist(next);
        this.send(ws, {
          type: 'state',
          room: this.engine.view(a.id),
          serverTime: now,
        });
      } else throw Error('Unknown message.');
      ws.serializeAttachment(a);
      if (reschedule) await this.schedule();
    } catch (error) {
      if (a && !a.pending && this.engine.s.players[a.id])
        a.player = attachmentPlayer(this.engine.s.players[a.id]);
      if (a) ws.serializeAttachment(a);
      this.send(ws, {
        type: 'error',
        message: String(error.message).slice(0, 180),
        pos: a?.id ? this.engine.s.players[a.id]?.pos : null,
      });
      if (a?.pending) ws.close(4003, 'Cannot join');
    }
  }
  async webSocketClose(ws, code, reason) {
    const a = ws.deserializeAttachment();
    if (a?.id && this.engine.s.players[a.id]) {
      const replacement = this.ctx
        .getWebSockets()
        .some(
          (other) =>
            other !== ws &&
            other.readyState === 1 &&
            other.deserializeAttachment()?.id === a.id,
        );
      if (!replacement) {
        const next = this.next();
        next.disconnect(a.id);
        this.persist(next);
        this.broadcast();
      }
    }
    try {
      // 1005 means the peer omitted a close status. It is an event-only
      // sentinel, like 1006/1015, and cannot be put into a close frame.
      // Echoing it throws and leaves the browser waiting for a handshake.
      const replyCode = [1004, 1005, 1006, 1015].includes(code) ? 1000 : code;
      ws.close(replyCode, reason);
    } catch {}
    await this.schedule();
  }
  async webSocketError(ws) {
    await this.webSocketClose(ws, 1011, 'Connection lost');
  }
  async schedule() {
    if (!this.engine) return;
    let next = Date.now() + 3600000;
    if (this.engine.s.arena?.deadline) next = Math.min(next, this.engine.s.arena.deadline);
    for (const g of Object.values(this.engine.s.games))
      if (g.status === 'playing') {
        next = Math.min(
          next,
          g.deadline || next,
          g.revealUntil || next,
          ['memory', 'connect', 'tictactoe'].includes(g.id)
            ? g.turnAt + 60000
            : next,
        );
      }
    for (const p of Object.values(this.engine.s.players)) {
      if (!p.connected) next = Math.min(next, p.lastSeen + 45001);
      if (p.ring?.deadline) next = Math.min(next, p.ring.deadline);
    }
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (a?.pending) next = Math.min(next, a.at + 10000);
    }
    const scheduled = await this.ctx.storage.getAlarm();
    const at = Math.max(Date.now() + 100, next);
    if (scheduled == null || at < scheduled) await this.ctx.storage.setAlarm(at);
  }
  async alarm() {
    if (!this.engine) return;
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (a?.pending && Date.now() - a.at >= 10000)
        ws.close(4008, 'Handshake timed out');
    }
    const next = this.next();
    next.tick();
    this.persist(next);
    this.broadcast();
    if (
      !this.ctx.getWebSockets().length &&
      Date.now() - this.engine.s.created > 86400000
    ) {
      await this.ctx.storage.deleteAll();
      this.engine = null;
      return;
    }
    await this.schedule();
  }
}
