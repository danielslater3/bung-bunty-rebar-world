// Sydney Airport on the OpenStreetMap metre grid.
// The T1 polygon is the mapped way. The terminal interior is not a measured plan.
import * as THREE from 'three';
import { SYDNEY_GEO as GEO } from './sydney.data.js';
import { mountOsmDistrict } from './renderDistrict.js';
import { mat } from '../../core/utils.js';
import { dressSydney } from '../rebirthZones.js';
import { bus } from '../../core/state.js';

function alongNear(flat, ox, oz, rad, spacing, limit) {
  const pts = [];
  for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
  const out = [];
  let acc = spacing * 0.5;
  for (let i = 1; i < pts.length && out.length < limit; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dz = pts[i][1] - pts[i - 1][1];
    const seg = Math.hypot(dx, dz);
    if (seg < 0.01) continue;
    while (acc <= seg && out.length < limit) {
      const t = acc / seg;
      const x = pts[i - 1][0] + dx * t;
      const z = pts[i - 1][1] + dz * t;
      if ((x - ox) ** 2 + (z - oz) ** 2 < rad * rad) out.push([x, z, Math.atan2(dx, dz)]);
      acc += spacing;
    }
    acc -= seg;
  }
  return out;
}

export function buildOsmSydney(game) {
  const Z = mountOsmDistrict(game, 'sydney', GEO, {
    log: 'sydney',
    land: 0xc6c2b6,
    water: 0x1a6ea4,
    park: 0x3f8f45,
    road: 0x3a4048,
    pave: 0xd9d3c6,
    path: 0xc8bfae,
    apron: 0x6a7078,
    runway: 0x343a42,
    taxi: 0x454c54,
    sky: [0xb7d4ea, 0xd5e7f4, 160, 4200, 0xe8f4ff, 0x6a6e68, 1.05, 0xfff6e8, 1.35],
    far: 9000,
    lampCap: 360,
    toast: 'SYDNEY AIRPORT · NSW IMAGERY · © OSM · 1 m = 1 m',
  });

  const T = GEO.landmarks.terminal;
  const ux = T.x - T.cx;
  const uz = T.z - T.cz;
  const ul = Math.hypot(ux, uz) || 1;
  const fx = ux / ul;
  const fz = uz / ul;
  Z.spawn.set(T.x, 0.5, T.z);
  Z.spawnYaw = (T.heading || 0) - Math.PI;

  const gate = { x: T.x + fx * 16, z: T.z + fz * 16 };
  const booth = { x: T.x - fz * 9, z: T.z + fx * 9 };

  Z.box(booth.x, 0, booth.z, 5, 3.2, 3.2, mat(0xd92e2e, { roughness: 0.55 }));
  Z.textSign(booth.x, 4.2, booth.z, 0, 'OPERATION REBAR\nPASSPORT', { w: 4.4, h: 1.3, post: true, bg: '#d92e2e', fg: '#fff', glow: true });
  Z.interact(booth.x, 1.2, booth.z, '<b>[E]</b> OPERATION REBAR PASSPORT CHECKPOINT', () => {
    bus.emit('qe', { type: 'reach', target: 'passport' });
    game.audio.sfx('unlock');
    game.toast('PASSPORT STAMPED — BLUE TO RED TRANSITION READY', 'red');
    game.say('bung', 'Operation Rebar Passport: stamped. I am now legally unstoppable.');
  }, 4.5);

  Z.textSign(T.x, 4.6, T.z, 0, 'T1 INTERNATIONAL\nLANDSIDE\nINTERIOR NOT MAPPED', { w: 5.6, h: 1.8, post: true, bg: '#14305a', fg: '#ffe9a8', glow: true });
  Z.textSign(T.cx, 8, T.cz, 0, 'INTERNATIONAL TERMINAL', { w: 6, h: 0.8, bg: '#f4f1e8', fg: '#1a1d26' });

  const spots = alongNear(GEO.route, T.cx, T.cz, 280, 28, 10);
  const tiers = ['silver', 'silver', 'silver', 'gold', 'silver', 'silver', 'gold', 'glitch', 'silver', 'gold'];
  spots.forEach((s, i) => Z.portal(tiers[i] || 'silver', s[0], 2.4, s[1], s[2]));
  if (spots.length < 8) {
    for (let i = spots.length; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      Z.portal(i === 7 ? 'gold' : 'silver', T.x + Math.cos(a) * 18, 2.4, T.z + Math.sin(a) * 18, a);
    }
  }

  Z.addCollectible('burger', new THREE.Vector3(gate.x + 3, 1.1, gate.z));
  Z.addCollectible('burger', new THREE.Vector3(gate.x - 2, 1.1, gate.z + 3));
  Z.addCollectible('burger', new THREE.Vector3(booth.x + 4, 1.1, booth.z + 2));
  Z.textSign(gate.x, 3.2, gate.z - 4, 0, 'GABOR\'S HOARD\n(NOT A REAL SHOP)', { w: 4.8, h: 1.2, post: true, bg: '#e8a755', fg: '#1a1d26' });

  Z.exchangeKiosk(T.x - fx * 10, 0.02, T.z - fz * 10, T.heading || 0);
  Z.deploymentBoard(T.x - fz * 12, 0.02, T.z + fx * 12, (T.heading || 0) + 1);
  Z.fuelStation(gate.x + 8, gate.z - 6, T.heading || 0);
  Z.spawner('bandit', gate.x, 0, gate.z, 12, 2);
  Z.spawner('drone', T.x + 30, 4, T.z, 18, 2);
  Z.pedestrians(T.x, T.z, 16, 24, 7, 81);

  for (const key of ['rwy16R34L', 'rwy16L34R', 'rwy0725']) {
    const R = GEO.landmarks[key];
    if (!R) continue;
    Z.textSign(R.cx, 4, R.cz, 0, R.name.toUpperCase(), { w: 5.2, h: 0.7, bg: '#1a1d26', fg: '#f4f1e8' });
  }

  Z.interact(T.x + 3, 0.4, T.z + 2, '<b>[E]</b> Read the T1 survey post', () => {
    const rows = GEO.checks.slice(0, 3).map((c) => `${c.a} to ${c.b}: ${c.enu.toFixed(1)} m here, ${c.vincenty.toFixed(1)} m on the ellipsoid`);
    game.dialogue.conversation([
      ['ching', `OpenStreetMap. ${rows[0]}. ${rows[1]}.`],
      ['ching', `${rows[2]}. The T1 way is about 94 by 140 metres. I did not invent the rest of the building around it.`],
      ['bung', 'The runway is real. My declaration form is a napkin.'],
    ]);
  }, 4);

  for (const [x, z] of [[T.x + 6, T.z + 5], [T.x - 5, T.z + 7], [booth.x - 4, booth.z], [gate.x + 2, gate.z + 5]]) {
    Z.rebar(x, 0, z);
    Z.coin(x + 2, 0, z - 2);
  }

  dressSydney(Z, game, gate);
  Z._baseGrounds = Z.grounds.filter((g) => !g.userData || !g.userData.walk);
  return Z;
}
