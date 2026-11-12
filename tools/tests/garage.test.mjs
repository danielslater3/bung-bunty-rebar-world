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

test('independent axle setup clamps values, links controls and moves chassis without moving contact wheels',async()=>{
 const {garageSetup,buildRecord}=await import('../../src/garage/catalog.js');
 let record={};for(const id of ['low','camber','wide'])record=garageAction(record,id,'equip',100).next;
 record=garageSetup(record,{frontHeight:-.42,rearHeight:-.12,heightLinked:false,frontCamber:-16,rearCamber:-4,camberLinked:false,frontWidth:1.5,rearWidth:1.9,widthLinked:false});
 const model=buildTrolley();fitGarage(model,record);
 assert.ok(Math.abs(model.userData.chassis.position.y+.27)<1e-9);
 assert.ok(model.userData.chassis.rotation.x>0);assert.equal(model.userData.wheels[0].spin.scale.x,1.5);assert.equal(model.userData.wheels[2].spin.scale.x,1.9);
 assert.ok(model.userData.wheels.every(w=>w.steer.position.y>.12&&w.steer.position.y<.3));
 const linked=garageSetup(record,{frontHeight:-99,rearHeight:99,frontCamber:-99,frontWidth:99});
 assert.equal(linked.setup.frontHeight,-.42);assert.equal(linked.setup.rearHeight,-.42);assert.equal(linked.setup.frontCamber,-18);assert.equal(linked.setup.frontWidth,2);
 const unfunded=garageSetup({},record.setup);assert.equal(tuning(unfunded).height,0);assert.equal(tuning(unfunded).frontWidth,1);
 assert.deepEqual(buildRecord(JSON.parse(JSON.stringify(record))).setup,record.setup);
});
