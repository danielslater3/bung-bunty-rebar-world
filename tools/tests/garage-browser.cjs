const{chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const p=await b.newPage({viewport:{width:1280,height:820}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto(process.env.GAME_URL||'http://127.0.0.1:8765');await p.waitForFunction(()=>window.BUNG,null,{polling:150,timeout:60000});
console.log(await p.evaluate(async()=>{
 const g=BUNG;g.renderer.setAnimationLoop(null);
 await g.loadZone('brisbane',true);g.mode='playing';g.menus.close();g.dialogue.clear();g.saga.freeze=g.saga.scenePlaying=false;
 const T=await import('three'),{positionClear}=await import('/src/core/motion.js'),{state}=await import('/src/core/state.js');
 const z=g.zone,garage=z.garage;if(!garage)throw Error(document.body.innerText.slice(-2500));
 let previous;
 for(let step=-8;step<25;step+=.5){
  const point=garage.frame.world({x:0,y:garage.floor+.1,z:step});
  const floor=z.groundAt(point.x,point.z,garage.floor+.1);
  point.y=floor;
  if(!positionClear(point,.85,z))throw Error('Blocked garage approach '+step);
  if(previous!==undefined&&Math.abs(floor-previous)>.22)throw Error('Abrupt garage floor at '+step);
  previous=floor;
 }
 const start=garage.frame.world({x:0,y:garage.floor,z:-8});
 const trolley=g.trolley;state.flags.trolleyUnlocked=true;if(state.saga)state.saga.trolleyDamage=false;
 trolley.pos.set(start.x,z.groundAt(start.x,start.z,garage.floor),start.z);
 trolley.heading=-Math.atan2(.74,.67);trolley.speed=0;trolley.vy=0;
 trolley.summoned=trolley.riding=true;trolley.grounded=true;g.input.keys={KeyW:true};
 let entered=false;
 for(let i=0;i<200;i++){
  trolley.update(1/60);
  if(garage.frame.local(trolley.pos).z>20){entered=true;break;}
 }
 if(!entered)throw Error('Trolley could not drive into garage '+JSON.stringify(garage.frame.local(trolley.pos)));
 trolley.heading+=Math.PI;trolley.speed=0;
 let exited=false;
 for(let i=0;i<200;i++){
  trolley.update(1/60);
  if(garage.frame.local(trolley.pos).z < -8){exited=true;break;}
 }
 if(!exited)throw Error('Trolley could not drive out of garage');
 g.input.keys={};trolley.dismiss();
 state.rebars=200;
 const pos=garage.frame.world({x:0,y:garage.floor+.1,z:10});g.player.teleport(new T.Vector3(pos.x,pos.y,pos.z));
 g.garage.open();
 return {floor:garage.floor,near:g.garage.near()};
}));
const dialog=p.getByRole('dialog',{name:'Bung Garage'});
await dialog.locator('.bung-garage-part').filter({hasText:'Sir Twelve V12'}).getByRole('button').click();
await p.evaluate(()=>BUNG.garage.update());
assert.equal(await p.evaluate(()=>BUNG.trolley.tune.cylinders),12);
await dialog.getByRole('navigation',{name:'Garage sections'}).getByRole('button',{name:'Handling',exact:true}).click();
await dialog.locator('.bung-garage-part').filter({hasText:'Off-road tyres'}).getByRole('button').click();
await p.evaluate(()=>BUNG.garage.update());
await dialog.getByRole('button',{name:'BACK TO BRISBANE'}).click();
assert.equal(await p.evaluate(async()=>{
 const {state,SaveSystem}=await import('/src/core/state.js');
 state.garage={};SaveSystem.load();BUNG.garage.update();return BUNG.trolley.tune.cylinders;
}),12);
await p.evaluate(()=>{const g=BUNG,garage=g.zone.garage;const pos=garage.frame.world({x:0,y:garage.floor+4,z:-12});g.camera.position.set(pos.x,pos.y,pos.z);const target=garage.frame.world({x:0,y:garage.floor+2,z:14});g.camera.lookAt(target.x,target.y,target.z);g.renderer.render(g.scene,g.camera);});
await p.screenshot({path:'../browser-tests/bung-garage.png'});
assert.deepEqual(errors,[]);console.log('GARAGE WALK-IN AND FITTING PASSED');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
