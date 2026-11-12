const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:8765');await page.waitForFunction(()=>window.BUNG,null,{timeout:60000});
 await page.evaluate(async()=>{const g=BUNG;g.renderer.setAnimationLoop(null);await g.loadZone('brisbane',true);g.mode='playing';g.menus.close();g.dialogue.clear();g.saga.freeze=g.saga.scenePlaying=false;g.input.enabled=true;window.T=await import('three');});
 for(const key of ['KeyA','KeyD']){
  await page.evaluate(()=>{const g=BUNG,t=g.trolley,p=g.zone.garage.frame.world({x:0,y:g.zone.garage.floor+.1,z:10});t.pos.set(p.x,p.y,p.z);t.heading=0;t.speed=12;t.drive.reset(12,0);t.riding=t.summoned=t.grounded=true;g.input.keys={KeyW:true};g.input.pressed={};window.start=t.pos.clone();window.camera=new T.PerspectiveCamera(60,1,.1,100);camera.position.copy(start).add(new T.Vector3(0,3,-8));camera.lookAt(start.clone().add(new T.Vector3(0,1,3)));camera.updateMatrixWorld();});
  await page.keyboard.down(key);
  const result=await page.evaluate(()=>{const g=BUNG;for(let i=0;i<24;i++)g.trolley.update(1/120);const x=g.trolley.pos.clone().project(camera).x;return {x,yaw:g.trolley.heading};});
  await page.keyboard.up(key);
  assert.ok(key==='KeyA'?result.x<0:result.x>0,JSON.stringify({key,result}));
 }
 assert.deepEqual(errors,[]);console.log('SCREEN STEERING PASSED: A left, D right via actual key events and trolley physics');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
