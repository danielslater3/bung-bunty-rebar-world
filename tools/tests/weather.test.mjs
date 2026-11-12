import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conditionsAt, hashWeather, rainAt, TIERS, tornadoTier, vortexAt, weatherAt, weatherWarning } from '../../src/weather/model.js';
import { buildingDamage, StormDamage } from '../../src/weather/stormDamage.js';
import { BufferAttribute } from 'three';
import { EDITIONS, editionFor, editionImage } from '../../src/phone/editions.js';
import { statSync } from 'node:fs';

test('each of the ten handset concepts maps to one available edition asset', () => {
  assert.equal(EDITIONS.length, 10);
  assert.equal(new Set(EDITIONS.map(e => e.id)).size, 10);
  assert.equal(editionFor('unknown').id, 'titanium');
  for (const e of EDITIONS) assert.ok(statSync(new URL(editionImage(e))).size > 10000);
});

test('room weather is repeatable, varied and finite, with bounded rainfall and gusts', () => {
  const seed = hashWeather('BUNGBUNG'), modes = new Set();
  for (let i = 0; i < 24000; i += 17) {
    const f = weatherAt(seed, i);
    assert.deepEqual(f, weatherAt(seed, i));
    modes.add(f.mode);
    const p = conditionsAt(f, f.x, f.z);
    assert.ok(p.rain >= 0 && p.rain <= 1);
    assert.ok(Number.isFinite(p.gust) && p.gust > 0);
    assert.ok(rainAt(f, f.x + 5000, f.z + 5000) < .01);
  }
  assert.equal(modes.size, 4);
});

test('a supercell warns before touchdown, spins up, and dissipates', () => {
  const seed = hashWeather('test'), seen = [];
  for (let i = 0; i < 360; i++) seen.push(weatherAt(seed, i, { track: 0, tier: 5 }));
  const warn = seen.findIndex(f => f.warned);
  const funnel = seen.findIndex(f => f.tornado);
  const contact = seen.findIndex(f => f.tornado?.ground);
  assert.ok(warn < funnel && funnel < contact);
  assert.equal(seen[contact].tornado.rating, 'EF5');
  assert.ok(seen.some(f => f.lightning));
  assert.equal(seen.at(-1).tornado, null);
  assert.equal(seen.at(-1).warned, false);
  assert.ok(TIERS.every((t, i) => !i || t.gust > TIERS[i-1].gust));
  assert.deepEqual([0, .5, .8, .9, .99, .998].map(tornadoTier), [0,1,2,3,4,5]);
  assert.equal(Array.from({ length: 1000 }, (_, i) => tornadoTier(i / 1000)).filter(t => t === 5).length, 3);
});

test('the vortex combines tangential flow, inward pull and lift only on touchdown', () => {
  const t = { ...TIERS[3], tier: 3, ground: true, strength: 1, x: 0, z: 0 };
  const v = vortexAt(t, 30, 0, 5);
  assert.ok(v.x < 0 && v.z < 0 && v.lift > 0 && v.caught);
  assert.equal(vortexAt(t, 250, 0, 0), null);
  assert.equal(vortexAt({ ...t, ground: false }, 30, 0, 0), null);
  assert.equal(vortexAt(t, 30, 0, 100), null);
});

test('warnings report large hail and the actual tornado tier, with a local range limit', () => {
  const seed = hashWeather('warning'), drill = { track: 0, tier: 5 };
  const frames = Array.from({ length: 220 }, (_, time) => weatherAt(seed, time, drill));
  const frame = frames.find(f => f.tornado?.ground);
  const t = frame.tornado;
  const warning = weatherWarning(frame, t.x, t.z, true);
  assert.equal(warning.severity, 'extreme');
  assert.match(warning.title, /EF5 tornado on ground/);
  assert.match(warning.detail, /Very large hail \(85 mm\)/);
  assert.equal(weatherWarning(frame, t.x + 3000, t.z, true), null);
  const watch = frames.find(f => f.warned && !f.tornado);
  assert.equal(weatherWarning(watch, watch.x, watch.z).title, 'Tornado watch');
});

test('EF5 has a wider capture zone and temporary building collapse restores mesh and collision', () => {
  const seed = hashWeather('damage'), drill = { track: 0, tier: 5 };
  const frame = weatherAt(seed, 157, drill), t = frame.tornado;
  assert.ok(t?.ground);
  assert.ok(vortexAt(t, t.x + 240, t.z, 0).caught);
  assert.equal(vortexAt({ ...t, ...TIERS[0], tier: 0 }, t.x + 240, t.z, 0), null);
  const coords = [t.x, 12, t.z, t.x + 6, 8, t.z + 4, t.x, 0, t.z + 4];
  const attr = new BufferAttribute(new Float32Array(coords), 3);
  const building = { x: t.x, z: t.z, ground: 0, footprint: { h: 12 }, ranges: [[attr, 0, 9]] };
  assert.equal(buildingDamage({ ...t, ...TIERS[0], tier: 0 }, building), 0);
  assert.ok(buildingDamage(t, building) > .8);
  const damage = new StormDamage({ stormBuildings: [building] });
  damage.update(frame, seed, drill);
  assert.ok(attr.array[1] < 6 && building.footprint.h < 6);
  damage.update(weatherAt(seed, 345, drill), seed, drill);
  assert.equal(attr.array[1], 12);
  assert.equal(building.footprint.h, 12);
  assert.equal(damage.active.size, 0);
});

test('seeded curved tornado paths span the map and always cross the CBD continuously',async()=>{
 const {tornadoPosition,WEATHER_BOUNDS:b}=await import('../../src/weather/model.js');
 const signatures=new Set();
 for(let seed=0;seed<120;seed++){
  const a=tornadoPosition(seed,0,0),city=tornadoPosition(seed,0,.5),end=tornadoPosition(seed,0,1);
  assert.ok(city.x>=-100&&city.x<=240&&city.z>=25&&city.z<=210);
  assert.ok(Math.hypot(end.x-a.x,end.z-a.z)>300);
  signatures.add(JSON.stringify([a,city,end]));
  let previous=a;
  for(let j=1;j<=1000;j++){
   const point=tornadoPosition(seed,0,j/1000);
   assert.deepEqual(point,tornadoPosition(seed,0,j/1000));
   assert.ok(point.x>=b.minX&&point.x<=b.maxX&&point.z>=b.minZ&&point.z<=b.maxZ);
   assert.ok(Math.hypot(point.x-previous.x,point.z-previous.z)<30);previous=point;
  }
 }
 assert.equal(signatures.size,120);
});
test('every tier entrains, orbits until dissipation, releases and permits recovery',async()=>{
 const {VortexRide}=await import('../../src/weather/VortexRide.js');
 for(let tier=0;tier<=5;tier++){
  const ride=new VortexRide(),t={...TIERS[tier],tier,id:'test',x:0,z:0,vx:0,vz:0,endsAt:40,ground:true};
  const p={x:t.capture*.7,y:0,z:0};assert.ok(ride.begin(t,p,0,0));let high=0,turns=0;
  for(let n=1;n<=2400;n++){
   const time=n/60,step=ride.step(1/60,time,time<35?t:null,p,0);
   p.x+=step.dx;p.z+=step.dz;p.y+=step.dy;high=Math.max(high,p.y);turns+=Math.abs(step.yaw-(ride.lastYaw??step.yaw));ride.lastYaw=step.yaw;
   assert.ok(Object.values(p).every(Number.isFinite));
   if(time<35)assert.equal(ride.phase,'orbit');
   else if(p.y<=0){ride.landed(time);break;}
  }
  assert.ok(high>10&&turns>Math.PI*3);assert.equal(ride.active,false);
  assert.equal(ride.begin(t,p,0,36),false);
 }
});
