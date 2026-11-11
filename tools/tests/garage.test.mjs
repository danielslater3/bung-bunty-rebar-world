import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PARTS, garageAction, tuning } from '../../src/garage/catalog.js';
import { ROOM_FLEET } from '../../src/multiplayer/fleet.js';
import { buildTrolley } from '../../src/entities/models.js';
import { fitGarage } from '../../src/garage/models.js';

test('garage purchases spend once, replace slots and preserve owned parts',()=>{
 let record;
 assert.throws(()=>garageAction(record,'v12','equip',0),/rebar/);
 let result=garageAction(record,'v12','equip',100);record=result.next;
 assert.equal(result.cost,65);assert.equal(tuning(record).cylinders,12);
 result=garageAction(record,'v12','equip',0);assert.equal(result.cost,0);
 result=garageAction(record,'v12','remove',0);assert.equal(tuning(result.next).cylinders,0);
 assert.ok(result.next.owned.includes('v12'));
});
test('every trolley supports each garage fitting with finite geometry and reversible wheel alignment',()=>{
 const previous=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};
 try {
 for(const fleet of ROOM_FLEET){
  const model=buildTrolley(fleet.id);
  for(const part of PARTS){
   const record=garageAction({},part.id,'equip',100).next;
   fitGarage(model,record);
   model.traverse(o=>{if(o.isMesh)for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));});
  }
  fitGarage(model,{});
  for(const wheel of model.userData.wheels)assert.equal(wheel.steer.rotation.z,0);
 }
 } finally {if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
