const {chromium}=require('playwright');const assert=require('node:assert/strict');
const endpoint=process.env.ROOM_SERVER||'http://127.0.0.1:8796';
const url=process.env.GAME_URL||'http://127.0.0.1:8765/';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const errors=[];
 async function boot(){
  const context=await browser.newContext({viewport:{width:1200,height:800}});
  await context.addInitScript(value=>sessionStorage.setItem('bung-room-server',value),endpoint);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
  await page.waitForFunction(()=>!!window.BUNG,null,{timeout:60000});
  await page.evaluate(async()=>{window.profile=(await import('/src/profile/Profile.js')).profile;window.state=(await import('/src/core/state.js')).state;BUNG.renderer.render=()=>{};});
  return page;
 }
 async function create(page){
  await page.evaluate(()=>BUNG.multiplayer.showLobby());await page.getByLabel('Your player name').fill('Permanent Bung');
  await page.getByLabel('Trolley edition').selectOption('james');
  await page.getByRole('button',{name:'CREATE A ROOM',exact:true}).click();
  await page.waitForFunction(()=>BUNG.multiplayer.active&&!BUNG.loading,null,{timeout:60000});
 }
 try{
  const a=await boot();
  await a.evaluate(async()=>{
   const {garageAction}=await import('/src/garage/catalog.js');
   state.rebars+=100;state.upgrades.tank=2;
   const result=garageAction(state.garage.james,'v12','equip',state.rebars);
   state.rebars-=result.cost;state.garage.james=result.next;
   await profile.flush();
  });
  assert.equal(await a.evaluate(()=>state.rebars),35);
  await a.evaluate(()=>BUNG.startGame(true,'roam'));
  assert.equal(await a.evaluate(()=>state.rebars),35);
  assert.equal(await a.evaluate(()=>BUNG.trolley.tune.cylinders),12);
  await a.evaluate(async()=>{
   const {SaveSystem}=await import('/src/core/state.js'),{createSaga}=await import('/src/story/sagaData.js');
   SaveSystem.save();
   SaveSystem.beginReplay({...state,saga:createSaga(),_replay:{chapter:0},rebars:0,garage:{},upgrades:{}});
   if(state.rebars!==35||state.garage.james.equipped.engine!=='v12')throw Error('Replay reset the permanent wallet');
   if(!SaveSystem.load(false))throw Error('Campaign could not reload after profile replay');
  });
  await create(a);
  assert.equal(await a.evaluate(()=>BUNG.multiplayer.room.players[BUNG.multiplayer.client.id].rebar),35);
  assert.equal(await a.evaluate(()=>state.upgrades.tank),2);
  await a.evaluate(()=>{const item=BUNG.multiplayer.loot.find(p=>p.item.id==='hall-stamp').item;BUNG.player.pos.set(item.x,item.y,item.z);});
  await a.waitForFunction(()=>state.rebars===43);
  await a.evaluate(()=>BUNG.multiplayer.leave());
  assert.equal(await a.evaluate(()=>state.rebars),43);
  assert.equal(await a.evaluate(()=>state.garage.james.equipped.engine),'v12');
  await create(a);
  assert.equal(await a.evaluate(()=>state.rebars),43);
  assert.equal(await a.evaluate(()=>state.garage.james.equipped.engine),'v12');
  assert.equal(await a.evaluate(()=>BUNG.multiplayer.room.players[BUNG.multiplayer.client.id].profileKey),undefined);
  await a.evaluate(()=>BUNG.multiplayer.leave());
  const code=await a.evaluate(()=>profile.cache.key);
  await a.reload();await a.waitForFunction(()=>!!window.BUNG,null,{timeout:60000});
  await a.evaluate(async()=>{window.profile=(await import('/src/profile/Profile.js')).profile;window.state=(await import('/src/core/state.js')).state;BUNG.renderer.render=()=>{};});
  assert.equal(await a.evaluate(()=>state.rebars),43);
  const b=await boot();
  await b.getByRole('button',{name:'PLAYER PROFILE',exact:true}).click();
  const dialog=b.getByRole('dialog',{name:'Bung player profile'});
  await dialog.getByLabel('Recovery code to restore').fill(code);
  await dialog.getByRole('button',{name:'RESTORE PROFILE',exact:true}).click();
  await dialog.getByText('Profile restored. Your wallet and trolley builds are ready.',{exact:true}).waitFor();
  assert.equal(await b.evaluate(()=>state.rebars),43);
  assert.equal(await b.evaluate(()=>state.garage.james.equipped.engine),'v12');
  await dialog.getByRole('button',{name:'BACK',exact:true}).click();
  await b.context().setOffline(true);
  await b.evaluate(async()=>{state.rebars+=7;try{await profile.flush();}catch{}});
  assert.equal(await b.evaluate(()=>profile.pending().length),1);
  await b.context().setOffline(false);await b.evaluate(()=>profile.flush());
  await a.evaluate(()=>profile.flush());assert.equal(await a.evaluate(()=>state.rebars),50);
  await Promise.all([a.evaluate(async()=>{state.rebars+=5;await profile.flush();}),b.evaluate(async()=>{state.rebars+=8;await profile.flush();})]);
  await a.evaluate(()=>profile.flush());await b.evaluate(()=>profile.flush());
  assert.equal(await a.evaluate(()=>state.rebars),63);assert.equal(await b.evaluate(()=>state.rebars),63);
  assert.deepEqual(errors,[]);
  console.log('PERMANENT PROFILE PASSED: mode changes, two rooms, reload, recovery, offline retry, two-device earnings, private identity');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
