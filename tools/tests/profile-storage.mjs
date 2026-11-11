import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {BungProfile} from '../../multiplayer/profiles.js';
import {BungRoom} from '../../multiplayer/worker.js';
globalThis.WebSocketRequestResponsePair=class{};
function context(){
 const db=new DatabaseSync(':memory:');
 const ctx={getWebSockets:()=>[],setWebSocketAutoResponse(){},blockConcurrencyWhile(fn){return this.pending=Promise.resolve().then(fn);}};
 ctx.storage={sql:{exec(sql,...args){const statement=db.prepare(sql);const rows=statement.all(...args);return {toArray:()=>rows};}},transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}},getAlarm:async()=>null,setAlarm:async()=>{}};
 return ctx;
}
const playerContext=context(),permanent=new BungProfile(playerContext,{});permanent.read({rebar:100});
let fail=true;
const env={PROFILES:{getByName:()=>({read:()=>permanent.read(),apply:async(op)=>{const result=permanent.apply(op);if(fail){fail=false;throw Error('Connection lost after durable debit');}return result;}})}};
const roomContext=context();let room=new BungRoom(roomContext,env);await roomContext.pending;await room.create('BUNGBUNG');
let player=room.engine.join('Persistent Bung');player.profileKey='private-hash';room.applyEconomy(player,permanent.read());player.pos={x:94,y:9.7,z:37};player.moveAt=Date.now();room.persist(room.engine);
const next=room.next();next.command(player.id,{cmd:'garageBuy',part:'v12',action:'equip',requestId:'garage-restart-test'});
await assert.rejects(()=>room.commit(next),/Connection lost/);
assert.equal(permanent.read().rebar,35);
assert.equal(roomContext.storage.sql.exec('SELECT id FROM commit_journal').toArray().length,1);
// A fresh room instance replays its persisted outbox after the remote debit.
room=new BungRoom(roomContext,env);await roomContext.pending;
assert.equal(room.engine.s.players[player.id].rebar,35);
assert.equal(room.engine.s.players[player.id].garage.james.equipped.engine,'v12');
assert.equal(permanent.read().rebar,35);
assert.equal(roomContext.storage.sql.exec('SELECT id FROM commit_journal').toArray().length,0);
const restartedProfile=new BungProfile(playerContext,{});assert.equal(restartedProfile.read().rebar,35);
// A stale room cannot spend a wallet depleted on another device.
player=room.engine.s.players[player.id];player.connected=true;player.rebar=100;player.garage={};player.moveAt=Date.now();room.persist(room.engine);
const stale=room.next();stale.command(player.id,{cmd:'garageBuy',part:'v12',action:'equip',requestId:'stale-purchase-test'});
await assert.rejects(()=>room.commit(stale),/Not enough rebar/);
assert.equal(permanent.read().rebar,35);assert.equal(roomContext.storage.sql.exec('SELECT id FROM commit_journal').toArray().length,0);
await room.refreshEconomy(player.id);assert.equal(room.engine.s.players[player.id].rebar,35);
console.log('PROFILE RECOVERY PASSED: durable SQLite restart, interrupted debit replay, no duplicate charge, stale-room spending rejected');
