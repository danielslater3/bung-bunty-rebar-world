import { DurableObject } from 'cloudflare:workers';
import { profileRecord, applyProfile } from '../src/profile/data.js';
export async function profileKey(secret) {
 if(typeof secret!=='string'||!/^bung-[a-f0-9]{64}$/.test(secret))throw Error('Use your complete private Bung recovery code.');
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret));
 return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
}
export class BungProfile extends DurableObject {
 constructor(ctx,env){
  super(ctx,env);
  ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS profile(id INTEGER PRIMARY KEY,body TEXT NOT NULL)');
  ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS operations(id TEXT PRIMARY KEY)');
 }
 existing(){return this.ctx.storage.sql.exec('SELECT body FROM profile WHERE id=1').toArray().map(row=>JSON.parse(row.body))[0]||null;}
 read(seed={}){
  const rows=this.ctx.storage.sql.exec('SELECT body FROM profile WHERE id=1').toArray();
  if(rows.length)return JSON.parse(rows[0].body);
  const record=profileRecord(seed);
  this.ctx.storage.sql.exec('INSERT INTO profile(id,body) VALUES(1,?)',JSON.stringify(record));
  return record;
 }
 apply(op){
  if(typeof op.id!=='string'||op.id.length<8||op.id.length>160)throw Error('Invalid profile transaction.');
  return this.ctx.storage.transactionSync(()=>{
   const record=this.read();
   if(this.ctx.storage.sql.exec('SELECT id FROM operations WHERE id=?',op.id).toArray().length)return record;
   const next=applyProfile(record,op);
   this.ctx.storage.sql.exec('UPDATE profile SET body=? WHERE id=1',JSON.stringify(next));
   this.ctx.storage.sql.exec('INSERT INTO operations(id) VALUES(?)',op.id);
   return next;
  });
 }
}
