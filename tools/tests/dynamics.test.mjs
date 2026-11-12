import {test} from 'node:test';import assert from 'node:assert/strict';
import {TrolleyDynamics} from '../../src/garage/dynamics.js';
const input={tyre:'stock',throttle:1,steer:0,maxSpeed:24,accel:22,grounded:true};
function run(tyre,steer=.75,fps=60){const d=new TrolleyDynamics();let peak=0;for(let n=0;n<fps*7;n++){d.update(1/fps,{...input,tyre,steer:n>fps*3?steer:0});peak=Math.max(peak,Math.abs(d.slip));}return {d,peak};}
test('drift tyres develop real sideslip under throttle without a handbrake',()=>{
 const drift=run('drift'),race=run('race');assert.ok(drift.peak>.17&&drift.peak<.5);assert.ok(drift.peak>race.peak*4);assert.ok(Math.hypot(drift.d.vx,drift.d.vz)>5);
 for(let n=0;n<300;n++)drift.d.update(1/60,{...input,tyre:'drift',throttle:0});assert.ok(Math.abs(drift.d.slip)<.02);
});
test('fixed-step vehicle dynamics agree across render rates and recover from countersteering',()=>{
 const a=run('drift',.7,30).d,b=run('drift',.7,120).d;
 // Input transitions are aligned to the same physical time below.
 const c=new TrolleyDynamics(),d=new TrolleyDynamics();for(let i=0;i<300;i++)c.update(1/30,{...input,steer:.5});for(let i=0;i<1200;i++)d.update(1/120,{...input,steer:.5});
 assert.ok(Math.abs(c.vx-d.vx)<1e-9&&Math.abs(c.heading-d.heading)<1e-9);
 for(const model of [a,b]){for(let n=0;n<180;n++)model.update(1/60,{...input,tyre:'drift',steer:0,throttle:0});assert.ok(Math.abs(model.slip)<.02);}
});
test('braking, reverse, wet traction, width and rough-ground tyre choices affect forces',()=>{
 const brake=new TrolleyDynamics();brake.reset(20,0);for(let n=0;n<60;n++)brake.update(1/60,{...input,throttle:-1});assert.ok(brake.forward<12);
 const reverse=new TrolleyDynamics();for(let n=0;n<240;n++)reverse.update(1/60,{...input,throttle:-1,steer:.3});assert.ok(reverse.forward<0&&reverse.forward>=-7.2);
 const grip=(options)=>{const model=new TrolleyDynamics();for(let n=0;n<120;n++)model.update(1/60,{...input,...options});return model.forward;};
 assert.ok(grip({rain:1})<grip({rain:0}));assert.ok(grip({rearWidth:1.8})>grip({rearWidth:.7}));assert.ok(grip({tyre:'offroad',rough:true})>grip({tyre:'race',rough:true}));
});

test('assisted drifting retains speed in a sustained turn and catches quickly on release',()=>{
 const d=new TrolleyDynamics();for(let i=0;i<600;i++)d.update(1/60,{...input,tyre:'drift',steer:i>180?1:0});
 assert.ok(d.forward>20);assert.ok(Math.abs(d.slip)<.4);assert.ok(Math.abs(d.slip)>.18);
 for(let i=0;i<60;i++)d.update(1/60,{...input,tyre:'drift',steer:0});
 assert.ok(Math.abs(d.slip)<.03);assert.ok(d.forward>20);
});

test('cruise speed and interpolated motion do not chatter at 60, 90, 144 or 165 Hz',()=>{
 for(const fps of [60,90,144,165]){
  const d=new TrolleyDynamics();let previous=0,min=Infinity,max=-Infinity,lo=Infinity,hi=-Infinity;
  for(let n=0;n<fps*20;n++){
   d.update(1/fps,{...input,tyre:'drift'});
   if(n>fps*16){const step=d.renderZ-previous;min=Math.min(min,step);max=Math.max(max,step);lo=Math.min(lo,d.forward);hi=Math.max(hi,d.forward);assert.ok(step>0);}
   previous=d.renderZ;
  }
  assert.ok(max-min<1e-7,JSON.stringify({fps,min,max}));assert.ok(hi-lo<1e-7);
 }
});
test('steering transitions have bounded angular acceleration and wall contacts do not bounce',()=>{
 const d=new TrolleyDynamics();d.reset(20,0);let previous=0;
 for(let i=0;i<480;i++){
  const steer=i<120?1:i<240?-1:0;
  d.update(1/120,{...input,tyre:'drift',steer});
  assert.ok(Math.abs(d.yawRate-previous)*120<10);previous=d.yawRate;
 }
 assert.ok(Math.abs(d.slip)<.03);
 d.vx=8;d.vz=10;d.collide(1,0);assert.equal(d.vx,0);assert.equal(d.vz,10);d.collide(1,0);assert.equal(d.vz,10);assert.equal(d.renderX,d.x);
});

test('ArcadeVehiclePhysics port times drift grip, damps lateral impulses and scales yaw torque',async()=>{
 const {driftEnvelope,lateralFriction,turningVelocity}=await import('../../src/garage/vendor/ArcadeVehiclePhysics.js');
 let drift=0;for(let i=0;i<60;i++)drift=driftEnvelope(drift,true,1/120);assert.ok(Math.abs(drift-1)<1e-9);
 for(let i=0;i<120;i++)drift=driftEnvelope(drift,false,1/120);assert.ok(drift<1e-9);
 const a={vx:8,vz:12},b={...a};lateralFriction(a,0,.2,1/60);lateralFriction(b,0,.05,1/60);
 assert.ok(a.vx<b.vx&&a.vx>0);assert.equal(a.vz,12);
 const reverse={vx:8,vz:-12};lateralFriction(reverse,0,.2,1/60);assert.equal(reverse.vx,a.vx);assert.equal(reverse.vz,-12);
 assert.ok(turningVelocity(0,1,7,1,1/120,7)>turningVelocity(0,1,7,0,1/120,7));
 assert.equal(turningVelocity(0,0,7,1,1/120,7),0);
});
