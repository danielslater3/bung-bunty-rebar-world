import { PROFILE_URL, profileRecord, profileDelta, applyProfile } from './data.js';
const CACHE='bung-permanent-profile-v1',OPS='bung-profile-op-v1:';
const copy=value=>JSON.parse(JSON.stringify(value));
export class Profile {
 constructor(){this.ready=false;this.inRoom=false;this.online=false;this.status='Saved on this device';this.busy=null;this.elapsed=0;this.poll=0;this.session=crypto.randomUUID();}
 endpoint(){return sessionStorage.getItem('bung-room-server')||PROFILE_URL;}
 write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{this.status='Device storage full · keep the game open and free some space';return false;}}
 save(){return this.write(CACHE,this.cache);}
 pending(){
  const prefix=OPS+this.cache.key+':',out=[];
  for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(prefix)){try{out.push(JSON.parse(localStorage.getItem(key)));}catch{}}}
  return out.sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
 }
 async request(body){
  const response=await fetch(this.endpoint()+'/profile',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+this.cache.key},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
  const data=await response.json();
  if(!response.ok){const error=Error(data.error||'Profile sync unavailable.');error.record=data.record;throw error;}
  return profileRecord(data);
 }
 async connect(state,seed){
  this.state=state;
  try{this.cache=JSON.parse(localStorage.getItem(CACHE));}catch{}
  if(!/^bung-[a-f0-9]{64}$/.test(this.cache?.key||'')){
   const bytes=crypto.getRandomValues(new Uint8Array(32));
   const key='bung-'+Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
   this.cache={key,initial:profileRecord(seed),record:profileRecord(seed)};this.save();
  }
  this.ready=true;this.rebase();
  try{await this.flush();}catch{}
 }
 capture(state=this.state){
  if(!this.ready||this.inRoom||!state)return;
  const next=profileRecord(state),op=profileDelta(this.baseline,next);
  if(!op)return;
  const previous=this.pending().at(-1);
  const moneyOnly=x=>!Object.keys(x.garage||{}).length&&!Object.keys(x.upgrades||{}).length&&!Object.keys(x.inventory||{}).length;
  if(op.delta>0&&moneyOnly(op)&&previous?.owner===this.session&&!previous.attempted&&previous.delta>0&&moneyOnly(previous)&&previous.delta+op.delta<=1e9){
   previous.delta+=op.delta;if(!this.write(OPS+this.cache.key+':'+previous.id,previous))return false;this.baseline=this.visible=next;this.status='Sync pending';return true;
  }
  op.id=crypto.randomUUID();op.at=Date.now();op.owner=this.session;
  if(!this.write(OPS+this.cache.key+':'+op.id,op))return false;
  this.baseline=this.visible=next;
  this.status='Sync pending';
  return true;
 }
 rebase(){
  let record=profileRecord(this.cache.record);
  for(const op of this.pending())try{record=applyProfile(record,op);}catch{}
  this.visible=record;
  this.apply(this.state);
 }
 apply(state){
  if(!this.ready||!state)return;
  const r=this.visible||this.cache.record;
  state.rebars=r.rebar;state.coins=0;state.currencyVersion=1;
  state.garage=copy(r.garage);state.upgrades=copy(r.upgrades);
  state.maxStability=100+(state.upgrades.stab||0)*25;
  for(const zone of ['sydney','hongkong','shenzhen','void'])if(state.upgrades['map_'+zone]&&!state.unlockedZones?.includes(zone))state.unlockedZones?.push(zone);
  for(const flag of ['warehouse','hkdesk'])if(state.upgrades[flag])state.flags[flag]=true;
  this.baseline=profileRecord(state);
  this.onChange?.();
 }
 accept(record){
  if(this.capture()===false)throw Error(this.status);
  this.cache.record=profileRecord(record);this.save();this.rebase();
 }
 async flush(){
  if(!this.ready||this.restoring)return;
  if(this.busy)return this.busy;
  this.busy=this.perform().finally(()=>{this.busy=null;});return this.busy;
 }
 async perform(){
  try{
   if(this.capture()===false)throw Error(this.status);
   let record=await this.request({type:'read',seed:this.cache.initial});
   if(!this.pending().length)this.accept(record);
   while(this.pending().length){
    const op=this.pending()[0];
    op.attempted=true;if(!this.write(OPS+this.cache.key+':'+op.id,op))throw Error(this.status);
    try{record=await this.request({type:'apply',operation:op});}
    catch(error){
     if(error.record){
      localStorage.removeItem(OPS+this.cache.key+':'+op.id);
      this.accept(error.record);this.status='Balance refreshed — an unfunded change was not applied';continue;
     }
     throw error;
    }
    this.capture();localStorage.removeItem(OPS+this.cache.key+':'+op.id);this.accept(record);
   }
   this.online=true;this.status='Cloud saved';
  }catch(error){this.online=false;this.status='Saved on this device · sync pending';throw error;}
 }
 tick(dt){
  if(!this.ready||this.inRoom||this.restoring)return;
  this.elapsed+=dt;this.poll+=dt;
  if(this.elapsed<.5)return;this.elapsed=0;this.capture();
  if(this.pending().length||this.poll>8){this.poll=0;this.flush().catch(()=>{});}
 }
 async prepareRoom(){this.capture();await this.flush();if(!this.online)throw Error('Connect your permanent profile before entering a room.');return this.cache.key;}
 room(record){
  if(!this.ready)return;this.inRoom=true;
  this.cache.record=profileRecord(record);this.visible=this.cache.record;this.save();this.apply(this.state);
 }
 leaveRoom(){this.inRoom=false;this.rebase();this.flush().catch(()=>{});}
 async restore(code){
  if(this.inRoom)throw Error('Leave the room before restoring a different profile.');
  if(!/^bung-[a-f0-9]{64}$/.test(code.trim()))throw Error('Enter the complete recovery code.');
  await this.flush();const previous=this.cache;
  this.restoring=true;
  this.cache={key:code.trim(),initial:profileRecord(),record:profileRecord()};
  try{const record=await this.request({type:'restore'});this.cache.record=record;this.save();this.rebase();this.online=true;this.status='Cloud saved';}
  catch(error){this.cache=previous;this.rebase();throw error;}
  finally{this.restoring=false;}
 }
}
export const profile=new Profile();
