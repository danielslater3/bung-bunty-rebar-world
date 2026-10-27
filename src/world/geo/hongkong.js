// Hong Kong district on the OpenStreetMap metre grid.
// Lands Department meshes are not in this scene. See data/geo/HONGKONG.md.
import * as THREE from 'three';
import { HONGKONG_GEO as GEO } from './hongkong.data.js';
import { mountOsmDistrict } from './renderDistrict.js';
import { bus, addCoins, state } from '../../core/state.js';
import { dressHongKong } from '../rebirthZones.js';

function along(flat, spacing, fn, limit) {
  const pts = [];
  for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
  if (pts.length < 2) return 0;
  let acc = spacing * 0.5;
  let n = 0;
  for (let i = 1; i < pts.length && n < limit; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dz = pts[i][1] - pts[i - 1][1];
    const seg = Math.hypot(dx, dz);
    if (seg < 0.01) continue;
    while (acc <= seg && n < limit) {
      const t = acc / seg;
      fn(pts[i - 1][0] + dx * t, pts[i - 1][1] + dz * t, Math.atan2(dx, dz), n++);
      acc += spacing;
    }
    acc -= seg;
  }
  return n;
}

export function buildOsmHongKong(game) {
  const Z = mountOsmDistrict(game, 'hongkong', GEO, {
    log: 'hongkong',
    night: false,
    land: 0xc6bfb4,
    water: 0x8aa090,
    park: 0x2d7a42,
    road: 0x323844,
    pave: 0x5a5044,
    path: 0x6a5c4c,
    curb: 0x5a626c,
    sky: [0x9ec8ea, 0xd5e7f4, 80, 3800, 0xd7eeff, 0x8a7a62, 1.05, 0xfff4dc, 1.35],
    rain: [1000, 0x9fd4ff, 150],
    far: 8000,
    lampCap: 480,
    toast: 'HONG KONG · SENTINEL-2 COLOUR · © OSM · 1 m = 1 m',
    toastTone: 'red',
  });

  const L = GEO.landmarks;
  const spawn = L.twoIfc;
  Z.spawn.set(spawn.x, 0.5, spawn.z);
  Z.spawnYaw = spawn.heading || 0;

  const tiers = ['bronze', 'bronze', 'silver', 'bronze', 'silver', 'bronze', 'gold', 'bronze', 'silver', 'cyber', 'gold', 'cyber'];
  along(GEO.route, 190, (x, z, rot, i) => {
    Z.portal(tiers[i] || 'bronze', x, 2.6, z, rot);
  }, 12);

  const ferry = L.starFerry;
  Z.npc('ching', ferry.x, 0, ferry.z, spawn.heading || 0);
  Z.interact(ferry.x, 0.4, ferry.z, '<b>[E]</b> Chung — Central Star Ferry Pier', () => {
    bus.emit('qe', { type: 'talk', target: 'ching-rooftop' });
    game.dialogue.conversation([
      ['ching', 'Central Star Ferry Pier. The harbour in front of you is the mapped coastline, not a texture I invented.'],
      ['bung', 'DIGITECH BLUE MODE. I can see Two IFC and I am still not wearing trousers.'],
      ['ching', 'Gabor\'s stall is back toward the tower. The rooftop chain is a harbourfront chain now. The portals are on the real streets.'],
    ]);
  }, 4);

  Z.textSign(spawn.x, 4.2, spawn.z, 0, 'TWO INTERNATIONAL\nFINANCE CENTRE', { w: 6.2, h: 1.5, post: true, bg: '#0b1c2e', fg: '#2ee6ff', glow: true });
  Z.textSign(ferry.x, 3.4, ferry.z, 0, 'CENTRAL STAR FERRY', { w: 5.4, h: 0.9, post: true, bg: '#0b1c2e', fg: '#ffe9a8', glow: true });
  Z.textSign(L.clockTower.x, 3.6, L.clockTower.z, 0, 'TSIM SHA TSUI\nCLOCK TOWER', { w: 5.2, h: 1.3, post: true, bg: '#1a1208', fg: '#ffc23d', glow: true });
  Z.textSign(L.hsbc.cx, 6, L.hsbc.cz, 0, 'HSBC BUILDING', { w: 4.6, h: 0.8, post: true, bg: '#f4f1e8', fg: '#1a1d26' });
  Z.textSign(L.centralPlaza.cx, 8, L.centralPlaza.cz, 0, 'CENTRAL PLAZA', { w: 4.8, h: 0.8, post: true, bg: '#3a1020', fg: '#ffd0dc', glow: true });

  Z.interact(spawn.x + 3, 0.4, spawn.z + 3, '<b>[E]</b> Read the IFC survey post', () => {
    const rows = GEO.checks.filter((c) => c.a === 'twoIfc').slice(0, 4)
      .map((c) => `${c.b}: ${c.enu.toFixed(1)} m here, ${c.vincenty.toFixed(1)} m on the ellipsoid`);
    game.dialogue.conversation([
      ['ching', `OpenStreetMap, metre for metre, origin on Two IFC. ${rows[0]}. ${rows[1]}.`],
      ['ching', `${rows[2]}. ${rows[3]}. Bank of China Tower has no height tag in this extract, so that extrusion is the 9 m default.`],
      ['bung', 'The harbour is real. The singlet remains a rumour.'],
    ]);
  }, 4);

  Z.exchangeKiosk(spawn.x + 8, 0.02, spawn.z - 6, spawn.heading || 0);
  Z.deploymentBoard(spawn.x - 8, 0.02, spawn.z + 4, (spawn.heading || 0) + Math.PI);
  Z.fuelStation(spawn.x + 14, spawn.z + 6, spawn.heading || 0);

  Z.spawner('blob', ferry.x + 16, 0, ferry.z + 8, 22, 2);
  Z.spawner('blob', L.clockTower.x, 0, L.clockTower.z, 26, 2);
  Z.spawner('drone', L.admiralty.cx, 6, L.admiralty.cz, 20, 2);
  Z.pedestrians(spawn.x, spawn.z, 14, 36, 8, 31);
  Z.pedestrians(ferry.x, ferry.z, 12, 28, 6, 44);
  Z.pedestrians(L.clockTower.x, L.clockTower.z, 16, 30, 6, 52);

  along(GEO.route, 70, (x, z, rot, i) => {
    if (i % 2 === 0) Z.rebar(x + 1.5, 0, z);
    else Z.coin(x - 1.5, 0, z);
  }, 16);
  Z.addCollectible('fuel', new THREE.Vector3(ferry.x + 4, 0.8, ferry.z - 4));

  Z.interact(L.exchangeSquare.cx + 12, 0.2, L.exchangeSquare.cz, '<b>[E]</b> NOODLEMART — side quest', () => {
    if (!state.flags.noodleQuest) {
      state.flags.noodleQuest = true;
      addCoins(100);
      game.audio.sfx('buy');
      game.toast('NOODLEMART DELIVERY COMPLETE: +100 BUNGBUCKS', 'blue');
      game.dialogue.conversation([
        ['system', 'NOODLEMART: deliver these noodles to literally anyone.'],
        ['bung', 'Delivered them to myself. The receipt is a concept.'],
      ]);
    } else game.say('bung', 'NoodleMart appreciates my business.');
  }, 4);

  dressHongKong(Z, game, { spawn, ferry, clock: L.clockTower });

  Z._baseGrounds = Z.grounds.filter((g) => !g.userData || !g.userData.walk);
  return Z;
}
