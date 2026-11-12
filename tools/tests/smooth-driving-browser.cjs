const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:8765');await page.waitForFunction(()=>window.BUNG,null,{timeout:60000});
 const result=await page.evaluate(async()=>{
  const g=BUNG;g.renderer.setAnimationLoop(null);await g.loadZone('brisbane',true);g.mode='playing';g.menus.close();g.dialogue.clear();g.saga.freeze=g.saga.scenePlaying=false;
  const {state}=await import('/src/core/state.js'),{garageAction}=await import('/src/garage/catalog.js'),{fitGarage}=await import('/src/garage/models.js'),T=await import('three');
  state.garage[state.trolley]=garageAction({},'drift','equip',100).next;state.upgrades={};fitGarage(g.trolley.mesh,state.garage[state.trolley]);
  const original=g.zone,weatherZone=g.weather.zone;
  const fixture={name:'motion fixture',colliders:[],grounds:[],sampleGround:()=>0,groundAt:()=>0,swimInfo:()=>null,slopeAt:()=>0};
  const out=[];
  try{
   g.zone=fixture;g.weather.zone=fixture;g.weather.conditions={rain:0};
   const t=g.trolley;
   for(const fps of [60,90,144,165]){
    t.pos.set(0,0,0);t.heading=0;t.speed=t.maxSpeed;t.vy=0;t.grounded=t.riding=t.summoned=true;t.snapPose();
    g.input.keys={KeyW:true};g.input.pressed={};g.shakeT=0;g.camYaw=Math.PI;g.camPitch=.3;g.camPos.set(0,4,-8);
    let prev=0,min=Infinity,max=-Infinity,riderError=0;
    for(let n=0;n<fps*4;n++){
     t.update(1/fps);g.updateCamera(1/fps);
     if(n>fps){const dz=t.mesh.position.z-prev;min=Math.min(min,dz);max=Math.max(max,dz);riderError=Math.max(riderError,Math.abs(g.player.mesh.position.z-t.mesh.position.z),Math.abs(g.player.mesh.position.y-t.mesh.position.y-.55));}
     prev=t.mesh.position.z;
    }
    g.weather.applyWind(1/fps,{time:0,vx:0,vz:0,tornado:null},{gust:70,windX:10,windZ:1},g.player.pos);
    const windRiderError=Math.abs(g.player.mesh.position.y-t.mesh.position.y-.55);
    out.push({fps,min,max,riderError,windRiderError});
   }
   fixture.colliders.push(new T.Box3(new T.Vector3(-10,-1,12),new T.Vector3(10,4,12.2)));
   t.pos.set(0,0,0);t.speed=15;t.heading=0;t.snapPose();let wallMin=Infinity,wallMax=-Infinity;
   for(let i=0;i<240;i++){t.update(1/120);if(i>180){wallMin=Math.min(wallMin,t.pos.z);wallMax=Math.max(wallMax,t.pos.z);}}
   return {frames:out,wallRange:wallMax-wallMin,wallZ:t.pos.z};
  }finally{g.zone=original;g.weather.zone=weatherZone;}
 });
 for(const frame of result.frames){assert.ok(frame.min>0);assert.ok(frame.max-frame.min<1e-6,JSON.stringify(frame));assert.ok(frame.riderError<1e-6&&frame.windRiderError<1e-6,JSON.stringify(frame));}
 assert.ok(result.wallRange<1e-6&&result.wallZ<12,JSON.stringify(result));assert.deepEqual(errors,[]);
 console.log('SMOOTH DRIVING PASSED',JSON.stringify(result));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
