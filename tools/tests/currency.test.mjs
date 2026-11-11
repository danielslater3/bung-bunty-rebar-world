import {test} from 'node:test';
import assert from 'node:assert/strict';
import {migrateCurrency,state} from '../../src/core/state.js';
import {ShopSystem,SHOP_CATEGORIES} from '../../src/systems/ShopSystem.js';
test('old wallets merge once without losing existing rebar',()=>{
 const data={coins:120,rebars:5};migrateCurrency(data);assert.equal(data.rebars,125);assert.equal(data.coins,0);migrateCurrency(data);assert.equal(data.rebars,125);
});
test('score sells directly into spendable rebar and old trolley purchases are unavailable',()=>{
 Object.assign(state,{score:100,rebars:3,coins:0});
 const g={audio:{sfx(){}},toast(){},say(){},hud:{displayScore:100},chain:{resetChain(){}}};
 const shop=new ShopSystem(g);shop.sellScore();assert.equal(state.rebars,13);assert.equal(state.score,0);assert.equal(state.coins,0);
 assert.ok(!SHOP_CATEGORIES.includes('TROLLEY'));assert.equal(shop.buy('turbo'),false);
});
