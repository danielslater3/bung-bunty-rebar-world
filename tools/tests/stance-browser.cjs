const{chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:1440,height:950}});
 await context.addInitScript(url=>sessionStorage.setItem('bung-room-server',url),process.env.ROOM_SERVER||'http://127.0.0.1:8796');
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:8765/');await page.waitForFunction(()=>window.BUNG,null,{timeout:60000});
 await page.evaluate(async()=>{
  const g=BUNG;g.renderer.setAnimationLoop(null);await g.loadZone('brisbane',true);g.mode='playing';g.menus.close();g.dialogue.clear();g.saga.freeze=g.saga.scenePlaying=false;
  const {state}=await import('/src/core/state.js'),{garageAction}=await import('/src/garage/catalog.js');window.state=state;
  let record;for(const id of ['low','camber','wide','drift','v12','turbo','cyan','spoiler'])record=garageAction(record,id,'equip',500).next;
  state.rebars=500;state.garage[state.trolley]=record;
  const garage=g.zone.garage,p=garage.frame.world({x:0,y:garage.floor+.1,z:10});g.player.pos.set(p.x,p.y,p.z);g.garage.open();
 });
 const ui=page.getByRole('dialog',{name:'Bung Garage'});await ui.getByRole('button',{name:'Setup',exact:true}).click();
 async function slide(name,value){await ui.getByLabel(name,{exact:true}).evaluate((e,value)=>{e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));},value);}
 await slide('Front ride height',-420);
 assert.equal(await ui.getByLabel('Rear ride height',{exact:true}).inputValue(),'-420');
 await ui.getByLabel('Link front and rear height',{exact:true}).uncheck();await slide('Rear ride height',-180);
 await ui.getByLabel('Link front and rear camber',{exact:true}).uncheck();await slide('Front camber',-12);await slide('Rear camber',-5);
 await ui.getByLabel('Link front and rear width',{exact:true}).uncheck();await slide('Front tyre width',150);await slide('Rear tyre width',185);
 await ui.getByRole('button',{name:'APPLY SETUP',exact:true}).click();
 const result=await page.evaluate(async()=>{
  const g=BUNG;g.garage.update();const t=g.trolley;
  t.pos.copy(g.player.pos);t.summoned=t.riding=true;t.grounded=true;t.speed=0;t.update(1/60);
  const record=state.garage[state.trolley];
  const pose={body:t.mesh.userData.chassis.position.y,rider:g.player.mesh.position.y-t.pos.y,pitch:g.player.mesh.rotation.x,front:t.wheels[0].steer.rotation.z,rear:t.wheels[2].steer.rotation.z,width:t.wheels[0].spin.scale.x};
  const {profile}=await import('/src/profile/Profile.js');await profile.flush();
  return {record,pose,cloud:profile.cache.record.garage[state.trolley]};
 });
 assert.equal(result.record.setup.frontHeight,-.42);assert.equal(result.record.setup.rearHeight,-.18);
 assert.ok(Math.abs(result.pose.body+.3)<1e-8);assert.ok(Math.abs(result.pose.rider-.25)<1e-8);
 assert.ok(Math.abs(result.pose.front)>Math.abs(result.pose.rear));assert.equal(result.pose.width,1.5);
 assert.deepEqual(result.cloud.setup,result.record.setup);
 await page.screenshot({path:'../browser-tests/bung-stance-desktop.png'});
 await page.setViewportSize({width:440,height:860});await page.screenshot({path:'../browser-tests/bung-stance-mobile.png'});
 assert.ok(await ui.evaluate(e=>e.scrollWidth<=e.clientWidth+2));
 assert.deepEqual(errors,[]);console.log('STANCE PASSED',result.pose);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
