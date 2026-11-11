import { DurableObject } from 'cloudflare:workers';
import { RoomEngine, freshRoom } from './engine.js';
import { profileKey, BungProfile } from './profiles.js';
import { profileRecord, profileDelta } from '../src/profile/data.js';
export { BungProfile };
import { PROTOCOL } from '../src/multiplayer/catalog.js';
const attachmentPlayer = (p) => ({
  pos: p.pos,
  yaw: p.yaw,
  riding: p.riding,
  moveSeq: p.moveSeq,
  moveAt: p.moveAt,
  warp: p.warp,
  weatherFlight: p.weatherFlight,
});
const json = (data, status = 200, headers = {}) =>
  Response.json(data, { status, headers });
async function profileBody(request){
  const reader=request.body?.getReader();if(!reader)throw Error('Missing profile request.');
  const decoder=new TextDecoder();let size=0,body='';
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
    if(size>65536){await reader.cancel();throw Error('Profile request too large.');}
    body+=decoder.decode(value,{stream:true});
  }}finally{reader.releaseLock();}
  return body+decoder.decode();
}
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      Vary: 'Origin',
      'Cache-Control': 'no-store',
    };
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: cors });
    try {
      if(u.pathname==='/profile'&&request.method==='POST'){
        if(Number(request.headers.get('content-length'))>65536)return json({error:'Profile request too large.'},413,cors);
        const key=await profileKey((request.headers.get('Authorization')||'').replace(/^Bearer /,''));
        const body=await profileBody(request);
        const m=JSON.parse(body),stub=env.PROFILES.getByName(key);
        if(m.type==='restore'){
          const record=await stub.existing();return json(record||{error:'That recovery code has no saved profile.'},record?200:404,cors);
        }
        if(m.type==='read')return json(await stub.read(m.seed),200,cors);
        if(m.type==='apply')try{return json(await stub.apply(m.operation),200,cors);}
          catch(error){
            if(!/Not enough rebar|Invalid |Wallet limit/.test(String(error.message)))throw error;
            return json({error:String(error.message).slice(0,180),record:await stub.read()},409,cors);
          }
        return json({error:'Unknown profile action.'},400,cors);
      }
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
    this.profiles=env.PROFILES;
    this.ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(
        'CREATE TABLE IF NOT EXISTS room_state (id INTEGER PRIMARY KEY CHECK (id=1), body TEXT NOT NULL)',
      );
      ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS commit_journal(id INTEGER PRIMARY KEY,body TEXT NOT NULL)');
      const rows = ctx.storage.sql
        .exec('SELECT body FROM room_state WHERE id=1')
        .toArray();
      this.engine = rows.length
        ? new RoomEngine(JSON.parse(rows[0].body))
        : null;
      await this.drainPending();
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
  economy(p){return profileRecord({rebar:p.rebar,garage:p.garage,upgrades:p.sharedUpgrades,inventory:p.inventory});}
  applyEconomy(p,record){p.rebar=record.rebar;p.garage=record.garage;p.sharedUpgrades=record.upgrades;p.inventory=record.inventory;p.profileRevision=record.revision;}
  async refreshEconomy(id){
    const p=this.engine?.s.players[id];if(!p?.profileKey)return;
    const record=await this.profiles.getByName(p.profileKey).read();
    if(record.revision!==p.profileRevision||record.rebar!==p.rebar){this.applyEconomy(p,record);this.persist(this.engine);}
  }
  async commit(next){
    const operations=[];
    for(const p of Object.values(next.s.players)){
      if(!p.profileKey)continue;
      const before=this.engine.s.players[p.id];
      if(!before||before.profileKey!==p.profileKey)continue;
      const change=profileDelta(this.economy(before),this.economy(p));
      if(change)operations.push({key:p.profileKey,player:p.id,operation:{...change,id:crypto.randomUUID()}});
    }
    if(!operations.length){this.persist(next);return;}
    operations.sort((a,b)=>a.operation.delta-b.operation.delta);
    this.ctx.storage.sql.exec('INSERT INTO commit_journal(id,body) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',JSON.stringify({state:next.s,operations}));
    await this.drainPending();
  }
  async drainPending(){
    const rows=this.ctx.storage.sql.exec('SELECT body FROM commit_journal WHERE id=1').toArray();if(!rows.length)return;
    const journal=JSON.parse(rows[0].body);
    const records=new Map();
    for(const item of journal.operations){
      let record;
      try{record=await this.profiles.getByName(item.key).apply(item.operation);}
      catch(error){
        if(String(error.message).includes('Not enough rebar'))this.ctx.storage.sql.exec('DELETE FROM commit_journal WHERE id=1');
        throw error;
      }
      records.set(item.key,record);
    }
    for(const p of Object.values(journal.state.players))if(records.has(p.profileKey))this.applyEconomy(p,records.get(p.profileKey));
    this.ctx.storage.transactionSync(()=>{
      this.persist(new RoomEngine(journal.state));
      this.ctx.storage.sql.exec('DELETE FROM commit_journal WHERE id=1');
    });
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
  async webSocketMessage(ws,message){
    return this.ctx.blockConcurrencyWhile(async()=>{
      try{await this.drainPending();await this.handleMessage(ws,message);}
      catch{this.send(ws,{type:'error',message:'Profile sync interrupted. Reconnect to finish saving.'});}
    });
  }
  async handleMessage(ws, message) {
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
            m.trolley,
          );
        if(m.profile){
          const key=await profileKey(m.profile),stub=this.profiles.getByName(key);
          let record=await stub.read();
          if(!p.profileKey&&(p.rebar||Object.keys(p.garage||{}).length||Object.keys(p.inventory||{}).length))
            record=await stub.apply({id:'legacy-room:'+next.s.code+':'+p.id,delta:p.rebar,garage:p.garage,inventory:p.inventory,upgrades:{}});
          p.profileKey=key;this.applyEconomy(p,record);
        }
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
          const race = this.engine.raceGate(a.id, previous);
          const pickup = this.engine.pickupOnMove(a.id, previous);
          if (gate || race || pickup) {
            const next = this.next();
            if (pickup) {
              next.collectPickup(next.s.players[a.id], pickup);
              next.changed();
            }
            if (gate) next.advanceRing(a.id, previous);
            if (race) next.advanceRace(a.id, previous);
            await this.commit(next);
            reschedule = !!(gate || race);
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
        await this.refreshEconomy(a.id);
        const next = this.next();
        if (next.command(a.id, m)) {
          await this.commit(next);
          this.broadcast();
        }
        a.player = attachmentPlayer(this.engine.s.players[a.id]);
        ws.serializeAttachment(a);
      } else if (m.type === 'sync') {
        await this.refreshEconomy(a.id);
        const next = this.next();
        if (next.tick()) await this.commit(next);
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
  async webSocketClose(ws,code,reason){
    return this.ctx.blockConcurrencyWhile(async()=>{await this.drainPending();await this.handleClose(ws,code,reason);});
  }
  async handleClose(ws, code, reason) {
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
    for (const event of Object.values(this.engine.s.events))
      if (event.status !== 'finished' && event.deadline) next = Math.min(next, event.deadline);
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
  async alarm(){return this.ctx.blockConcurrencyWhile(async()=>{await this.drainPending();await this.handleAlarm();});}
  async handleAlarm() {
    if (!this.engine) return;
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (a?.pending && Date.now() - a.at >= 10000)
        ws.close(4008, 'Handshake timed out');
    }
    const next = this.next();
    next.tick();
    await this.commit(next);
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
