import { buildRecord } from '../garage/catalog.js';
export const PROFILE_URL='https://bung-bunty-rooms.sitecraft-au.workers.dev';
const clone=value=>JSON.parse(JSON.stringify(value));
const levels=value=>Object.fromEntries(Object.entries(value||{}).filter(([k,v])=>/^[a-z0-9_]{1,40}$/i.test(k)&&Number.isInteger(v)&&v>=0&&v<=100));
export function profileRecord(value={}) {
 if(!value||typeof value!=='object')value={};
 const garage={};
 for(const [key,record] of Object.entries(value.garage||{}))if(/^[a-z0-9_-]{1,24}$/i.test(key)&&!['__proto__','constructor','prototype'].includes(key))garage[key]=buildRecord(record);
 const rebar=Number(value.rebar??value.rebars??0);
 const upgrades=levels(value.upgrades);
 for(const id of ['handling','tank'])if(value.inventory?.[id]===true)upgrades[id]=Math.max(1,upgrades[id]||0);
 return {rebar:Number.isSafeInteger(rebar)&&rebar>=0?rebar:0,garage,upgrades,inventory:Object.fromEntries(Object.entries(value.inventory||{}).filter(([k,v])=>/^[a-z0-9_]{1,40}$/i.test(k)&&v===true)),revision:Math.max(0,Number(value.revision)||0)};
}
export function profileDelta(before,after) {
 const a=profileRecord(before),b=profileRecord(after),garage={};
 for(const [id,record] of Object.entries(b.garage))if(JSON.stringify(a.garage[id])!==JSON.stringify(record))garage[id]=record;
 const upgrades={},inventory={};
 for(const [id,level] of Object.entries(b.upgrades))if(level>(a.upgrades[id]||0))upgrades[id]=level;
 for(const id of Object.keys(b.inventory))if(!a.inventory[id])inventory[id]=true;
 const delta=b.rebar-a.rebar;
 return delta||Object.keys(garage).length||Object.keys(upgrades).length||Object.keys(inventory).length?{delta,garage,upgrades,inventory}:null;
}
export function applyProfile(record,op) {
 const next=profileRecord(record);
 if(!Number.isSafeInteger(op.delta)||Math.abs(op.delta)>1e9)throw Error('Invalid rebar change.');
 if(next.rebar+op.delta<0)throw Error('Not enough rebar in your permanent wallet.');
 if(!Number.isSafeInteger(next.rebar+op.delta))throw Error('Wallet limit reached.');
 next.rebar+=op.delta;
 const patch=profileRecord(op);
 for(const [id,build] of Object.entries(patch.garage)){
  const previous=next.garage[id]||{owned:[],equipped:{}};
  next.garage[id]=buildRecord({owned:[...previous.owned,...build.owned],equipped:build.equipped});
 }
 for(const [id,level] of Object.entries(patch.upgrades))next.upgrades[id]=Math.max(next.upgrades[id]||0,level);
 Object.assign(next.inventory,patch.inventory);next.revision++;
 return clone(next);
}
