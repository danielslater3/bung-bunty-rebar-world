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
   const record=garageAction({},part.id,'equip',part.price).next;
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

test('elite engines cost more, preserve ownership and scale real trolley speed above the V12 ceiling',async()=>{
 const {engineSpeedScale,buildRecord}=await import('../../src/garage/catalog.js');
 const {Trolley}=await import('../../src/entities/Trolley.js');
 const {state}=await import('../../src/core/state.js');
 const speed=Object.getOwnPropertyDescriptor(Trolley.prototype,'maxSpeed').get;
 const v12=tuning(garageAction({},'v12','equip',65).next);
 for(const [id,price,factor,cylinders] of [['r16',180,1.4,16],['g18',350,2,18]]){
  assert.throws(()=>garageAction({},id,'equip',price-1),/rebar/);
  const purchase=garageAction({},id,'equip',price),t=tuning(purchase.next);
  assert.equal(purchase.cost,price);assert.equal(t.cylinders,cylinders);
  assert.ok(Math.abs(t.speed/v12.speed-factor)<1e-12);assert.ok(Math.abs(t.accel/v12.accel-factor)<1e-12);
  assert.equal(engineSpeedScale(purchase.next),factor);
  const restored=buildRecord(JSON.parse(JSON.stringify(purchase.next)));
  assert.equal(restored.equipped.engine,id);assert.equal(garageAction(restored,id,'equip',0).cost,0);
  const saved=state.saga;try{state.saga={};
   for(const boosting of [false,true]){
    const context={game:{multiplayer:{raceEntry:()=>null}},spec:{speed:10},boosting,tune:t};
    const baseline=speed.call({...context,tune:v12});assert.ok(Math.abs(speed.call(context)/baseline-factor)<1e-12);
   }
  }finally{state.saga=saved;}
 }
});
