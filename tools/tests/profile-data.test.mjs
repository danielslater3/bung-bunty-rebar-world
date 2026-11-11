import {test} from 'node:test';
import assert from 'node:assert/strict';
import {profileRecord,profileDelta,applyProfile} from '../../src/profile/data.js';
import {garageAction} from '../../src/garage/catalog.js';
test('permanent profile deltas merge earnings across devices without replacing other builds',()=>{
 const base=profileRecord({rebars:100,garage:{james:garageAction({},'v12','equip',100).next}});
 const a=profileRecord({...base,rebar:110}),b=profileRecord({...base,rebar:107});
 const merged=applyProfile(applyProfile(base,profileDelta(base,a)),profileDelta(base,b));
 assert.equal(merged.rebar,117);assert.equal(merged.garage.james.equipped.engine,'v12');
 const other=garageAction({},'cyan','equip',100).next;
 const fitted=applyProfile(merged,{delta:-8,garage:{concrete:other}});
 assert.equal(fitted.rebar,109);assert.equal(fitted.garage.james.equipped.engine,'v12');assert.equal(fitted.garage.concrete.equipped.underglow,'cyan');
});
test('wallet rejects overdrafts and invalid changes and permits free part removal',()=>{
 const base=profileRecord({rebar:10,garage:{james:garageAction({},'v12','equip',100).next}});
 assert.throws(()=>applyProfile(base,{delta:-11}),/Not enough/);
 assert.throws(()=>applyProfile(base,{delta:NaN}),/Invalid/);
 assert.throws(()=>applyProfile(base,{delta:Infinity}),/Invalid/);
 const removed=applyProfile(base,{delta:0,garage:{james:{owned:[],equipped:{}}}});
 assert.deepEqual(removed.garage.james.equipped,{});assert.ok(removed.garage.james.owned.includes('v12'));
 assert.equal(profileDelta(base,base),null);
});
