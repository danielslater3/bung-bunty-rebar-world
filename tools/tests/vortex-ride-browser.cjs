const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:1365,height:890}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:8765');await page.waitForFunction(()=>window.BUNG,null,{timeout:60000});
 const result=await page.evaluate(async()=>{
  const g=BUNG;g.renderer.setAnimationLoop(null);await g.loadZone('brisbane',true);g.mode='playing';g.menus.close();g.dialogue.clear();g.saga.freeze=g.saga.scenePlaying=false;
  const T=await import('three'),{TIERS}=await import('/src/weather/model.js'),{positionClear}=await import('/src/core/motion.js');
  let spot;for(let x=-50;x<200&&!spot;x+=10)for(let z=0;z<200;z+=10){const p={x,y:g.zone.groundAt(x,z),z};if(positionClear(p,.85,g.zone)&&!g.indoorCeiling(x,p.y+1,z)){spot=p;break;}}
  if(!spot)throw Error('No clear CBD fixture');
  const results=[];
  for(const mounted of [false,true]){
   const w=g.weather;w.vortexRide.reset();w.throwUntil=-Infinity;g.player.teleport(new T.Vector3(spot.x,spot.y,spot.z));
   const trolley=g.trolley;trolley.summoned=mounted;trolley.riding=mounted;trolley.pos.copy(g.player.pos);trolley.speed=trolley.vy=0;trolley.grounded=true;trolley.snapPose();
   const t={...TIERS[5],tier:5,id:'browser-fixture',x:spot.x-15,z:spot.z,vx:0,vz:0,ground:true,strength:1,touchdown:1,endsAt:180};
   let maxHeight=0,riderError=0,orbit=false,released=false,landed=false;const frame={time:150,tornado:t,vx:0,vz:0};
   for(let n=0;n<2700;n++){
    frame.time=150+n/60;frame.tornado=n<1080?t:null;
    g.player.update(1/60);trolley.update(1/60);w.applyWind(1/60,frame,{gust:0,windX:0,windZ:0},g.player.pos);
    maxHeight=Math.max(maxHeight,g.player.pos.y-spot.y);orbit||=w.vortexRide.phase==='orbit';released||=w.vortexRide.phase==='release';
    if(mounted)riderError=Math.max(riderError,Math.abs(g.player.mesh.position.y-trolley.mesh.position.y-.55-trolley.tune.height));
    if(released&&!w.vortexRide.active){landed=true;break;}
   }
   results.push({mounted,orbit,released,landed,maxHeight,riderError,stillMounted:trolley.riding,finite:Object.values(g.player.pos).every(Number.isFinite)});
  }
  // Render the actual larger procedural wedge over the mapped CBD for inspection.
  const w=g.weather;w.exercise={tier:5,track:0,time:180};w.update(0);const t=w.frame.tornado;
  const floor=g.zone.groundAt(t.x,t.z);g.camera.position.set(t.x+800,floor+120,t.z+640);g.camera.lookAt(t.x,floor+140,t.z);g.renderer.render(g.scene,g.camera);
  return results;
 });
 for(const r of result){assert.ok(r.orbit&&r.released&&r.landed&&r.finite,JSON.stringify(r));assert.ok(r.maxHeight>60,JSON.stringify(r));if(r.mounted)assert.ok(r.stillMounted&&r.riderError<1e-5,JSON.stringify(r));}
 await page.screenshot({path:'../browser-tests/bung-vortex-ride.png'});assert.deepEqual(errors,[]);console.log('MAPPED VORTEX RIDE PASSED',JSON.stringify(result));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
