// 130 Queen Street. The mapped tenancy faces the mall. Street retail stays
// on the ground floor. McRebar is the level above it, reached by the mall stair,
// laid out from the supplied plan: front seating, dining, order, collect, kitchen.
import * as THREE from 'three';
import { mat } from '../core/utils.js';
import { PLACE } from './sagaData.js?v=20261029b';

const AX = 151.3, AZ = 81.4, BX = 137.3, BZ = 93.7;
const LEN = Math.hypot(BX - AX, BZ - AZ);
const TX = (BX - AX) / LEN, TZ = (BZ - AZ) / LEN;
const OUTX = TZ, OUTZ = -TX;
const MID = [(AX + BX) / 2, (AZ + BZ) / 2];

export function mcrebarPoint(along, depth) {
  return {
    x: MID[0] + TX * along - OUTX * depth,
    z: MID[1] + TZ * along - OUTZ * depth,
  };
}

function yaw() {
  // Local +Z points into the tenancy, off the mall.
  return Math.atan2(-OUTX, -OUTZ);
}

function buildPodium(Z, y, ry, add) {
  const black = mat(0x141414, { roughness: 0.48, metalness: 0.22 });
  const gold = mat(0xf2c14b, { metalness: 0.85, roughness: 0.28, emissive: 0x5a3c08, emissiveIntensity: 0.55 });
  const deck = mat(0xb08968, { roughness: 0.78 });
  const rail = mat(0xd5eef5, { roughness: 0.05, metalness: 0.15, transparent: true, opacity: 0.38, side: THREE.DoubleSide });
  const lit = mat(0xffe2b8, { emissive: 0xffb45a, emissiveIntensity: 0.7, roughness: 0.32 });
  const steel = mat(0xc5ccd4, { metalness: 0.7, roughness: 0.25 });

  // Sills either side of the door, then a head that runs the full mall front.
  // The skin sits out past the mall's own signs so those signs do not show through the windows.
  add(-5.0, -1.45, 7.2, 0.22, 2.7, black, { dy: -0.08, collide: false, ground: false });
  add(5.0, -1.45, 7.2, 0.22, 2.7, black, { dy: -0.08, collide: false, ground: false });
  add(9.05, -4.3, 0.42, 6.2, 3.3, black, { dy: 0.02, collide: false, ground: false });
  add(9.32, -4.5, 0.06, 2.05, 1.35, lit, { dy: 0.5, collide: false, ground: false });
  add(9.32, -4.5, 0.06, 1.85, 1.35, lit, { dy: 3.25, collide: false, ground: false });
  add(-5.05, -2.72, 7.5, 0.38, 0.32, black, { dy: 0.02, collide: false, ground: false });
  add(5.05, -2.72, 7.5, 0.38, 0.32, black, { dy: 0.02, collide: false, ground: false });
  add(0, -2.72, 17.6, 0.46, 0.36, black, { dy: 2.68, collide: false, ground: false });

  const lower = [[-7.5, 1.9], [-5.35, 1.9], [-3.2, 1.9], [3.2, 1.9], [5.35, 1.9], [7.55, 1.95]];
  for (const [a, w] of lower) {
    add(a, -2.6, w, 2.15, 0.08, lit, { dy: 0.46, collide: false, ground: false });
    add(a, -2.82, 0.05, 2.15, 0.1, black, { dy: 0.46, collide: false, ground: false });
  }
  for (const a of [-8.55, -6.4, -4.25, -2.1, 2.1, 4.25, 6.45, 8.6]) {
    add(a, -2.75, 0.24, 2.66, 0.4, black, { dy: 0.02, collide: false, ground: false });
  }

  // Upper row of windows, including the bay over the entrance, then the parapet.
  for (const a of [-7.5, -5.35, -3.2, -1.05, 1.1, 3.25, 5.4, 7.55]) {
    add(a, -2.6, 1.75, 1.95, 0.08, lit, { dy: 3.22, collide: false, ground: false });
    add(a, -2.82, 0.05, 1.95, 0.1, black, { dy: 3.22, collide: false, ground: false });
  }
  for (const a of [-8.55, -6.4, -4.25, -2.1, 0.05, 2.2, 4.35, 6.5, 8.6]) {
    add(a, -2.75, 0.2, 2.15, 0.38, black, { dy: 3.14, collide: false, ground: false });
  }
  add(0, -2.82, 18.2, 0.72, 0.42, black, { dy: 5.32, collide: false, ground: false });
  add(0, -2.98, 18.4, 0.05, 0.08, gold, { dy: 5.28, collide: false, ground: false });
  add(0, -2.9, 18.6, 0.14, 0.55, mat(0x0c0c0c, { roughness: 0.6 }), { dy: 6.04, collide: false, ground: false });
  Z.textSign(mcrebarPoint(0, -3.05).x, y + 5.68, mcrebarPoint(0, -3.05).z, ry + Math.PI, 'McREBAR\n130 QUEEN STREET', { w: 3.4, h: 0.7, bg: '#141414', fg: '#f2c14b' });

  // Corner return. The mall edge ends at B and the block turns down the side street.
  const CX = 109.8, CZ = 61.8;
  const sideLen = Math.hypot(CX - BX, CZ - BZ) || 1;
  const ux = (CX - BX) / sideLen, uz = (CZ - BZ) / sideLen;
  const nx = uz, nz = -ux;
  const sideYaw = Math.atan2(nx, nz);
  const side = (s, out, w, h, d, dy, material) => {
    Z.box(BX + ux * s + nx * out, y + dy, BZ + uz * s + nz * out, w, h, d, material, { collide: false, ground: false, ry: sideYaw });
  };
  side(4.4, 0.22, 7.6, 6.15, 0.28, 0.02, black);
  for (const s of [1.7, 4.0, 6.3]) {
    side(s, 0.42, 1.55, 2.1, 0.06, 0.48, lit);
    side(s, 0.42, 1.55, 1.9, 0.06, 3.24, lit);
  }
  side(4.2, 0.18, 8.0, 0.42, 0.32, 2.7, black);
  side(4.2, 0.18, 8.2, 0.7, 0.4, 5.32, black);
  const corner = mcrebarPoint(9.15, -2.7);
  Z.box(corner.x, y + 0.02, corner.z, 0.85, 6.3, 0.85, black, { collide: false, ground: false });

  // Gold rebar arch in the corner window, facing the mall.
  const archAt = mcrebarPoint(7.55, -3.05);
  const arch = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.11, 12, 28, Math.PI), gold);
  tube.position.y = 0.95;
  arch.add(tube);
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.95, 10), gold);
  legL.position.set(-0.95, 0.48, 0);
  const legR = legL.clone();
  legR.position.x = 0.95;
  arch.add(legL, legR);
  arch.position.set(archAt.x, y + 0.62, archAt.z);
  arch.rotation.y = ry + Math.PI;
  Z.group.add(arch);

  // Terrace decks either side of the stair, with a glass balustrade.
  for (const [a, w] of [[-5.15, 6.5], [4.2, 3.8]]) {
    add(a, -3.55, w, 0.14, 1.55, deck, { dy: -0.02 });
    add(a, -4.25, w, 1.05, 0.04, rail, { dy: 0.12, collide: false, ground: false });
    add(a, -4.25, w, 0.05, 0.05, steel, { dy: 1.12, collide: false, ground: false });
    const posts = w > 5 ? [-2.4, -0.8, 0.8, 2.4] : [-1.3, 0, 1.3];
    for (const da of posts) {
      add(a + da, -4.25, 0.06, 1.05, 0.06, steel, { dy: 0.12, collide: false, ground: false });
    }
    const pot = mcrebarPoint(a + (a < 0 ? 1.4 : -1.4), -3.2);
    const planter = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.28, 8), mat(0x2a3038, { roughness: 0.6 }));
    planter.position.set(pot.x, y + 0.28, pot.z);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat(0x2f6b3a, { roughness: 0.8 }));
    leaf.position.set(pot.x, y + 0.52, pot.z);
    Z.group.add(planter, leaf);
  }
}

export function buildMcRebar(saga) {
  const Z = saga.game.zone;
  const door = mcrebarPoint(0, -1.15);
  const street = saga.ground(door.x, door.z);
  // The facade opening starts 3.35 m above the tenancy's mapped ground.
  const y = 13.9;
  const ry = yaw();
  const black = mat(0x161616, { roughness: 0.55, metalness: 0.18 });
  const gold = mat(0xf2c14b, { metalness: 0.85, roughness: 0.28, emissive: 0x5a3c08, emissiveIntensity: 0.6 });
  const timber = mat(0xc4a077, { roughness: 0.62 });
  const seat = mat(0x6a4a38, { roughness: 0.78 });
  const tile = mat(0xc8c6c2, { roughness: 0.62 });
  const steel = mat(0xb7bdc4, { metalness: 0.65, roughness: 0.28 });
  const glass = mat(0xd5eef5, { roughness: 0.06, metalness: 0.12, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
  const screen = mat(0xfff6e8, { emissive: 0xfff1d2, emissiveIntensity: 0.9 });

  const add = (along, depth, w, h, d, material, opts = {}) => {
    const p = mcrebarPoint(along, depth);
    return Z.box(p.x, y + (opts.dy || 0), p.z, w, h, d, material, { collide: false, ...opts, ry: opts.ry ?? ry });
  };
  // Collision is axis-aligned. Posts follow the walls without sealing the door.
  const posts = (a0, d0, a1, d1, skip) => {
    const a = mcrebarPoint(a0, d0);
    const b = mcrebarPoint(a1, d1);
    const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.z - a.z) / 1.15));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const along = a0 + (a1 - a0) * t;
      const depth = d0 + (d1 - d0) * t;
      if (skip && skip(along, depth)) continue;
      const p = mcrebarPoint(along, depth);
      const post = Z.box(p.x, y, p.z, 0.5, 2.7, 0.5, black);
      post.visible = false;
    }
  };
  posts(-7.6, 0.3, -7.6, 11.1);
  posts(7.6, 0.3, 7.6, 11.1);
  posts(-7.6, 11.15, 7.6, 11.15);
  posts(-7.4, 0.2, 7.4, 0.2, (along) => Math.abs(along) < 1.55);

  // Floor, ceiling, enclosing walls. The front wall has the mall door.
  add(0, 5.7, 15.4, 0.12, 11.2, speckledFloor(), { dy: 0, collide: false });
  add(0, 5.7, 15.6, 0.1, 11.4, perfCeiling(), { dy: 3.05, collide: false, ground: false });
  add(-7.65, 5.7, 0.14, 3.05, 11.2, black);
  add(7.65, 5.7, 0.14, 3.05, 11.2, black);
  add(0, 11.25, 15.4, 3.05, 0.14, black);
  add(-4.4, 0.15, 6.4, 3.05, 0.12, black);
  add(4.4, 0.15, 6.4, 3.05, 0.12, black);
  // Glazed shopfront in the door opening.
  add(0, -0.02, 2.55, 2.7, 0.04, glass, { dy: 0, collide: false, ground: false });
  buildPodium(Z, y, ry, add);

  // Landing in the doorway, then a stair the player can climb one tread at a time.
  add(0, -0.9, 2.7, 0.16, 2.1, mat(0xd9d4cc, { roughness: 0.8 }), { dy: -0.16, collide: false });
  const rise = Math.max(0.4, y - street);
  const steps = Math.max(4, Math.round(rise / 0.15));
  const tread = rise / steps;
  for (let i = 0; i < steps; i++) {
    const depth = -1.85 - i * 0.42;
    const p = mcrebarPoint(0, depth);
    const top = y - i * tread;
    Z.box(p.x, top - tread, p.z, 2.4, tread, 0.42, mat(0xd9d4cc, { roughness: 0.8 }), { collide: false, ry });
  }
  for (const side of [-1.25, 1.25]) {
    for (let i = 0; i < steps; i += 2) {
      const depth = -1.85 - i * 0.42;
      const p = mcrebarPoint(side, depth);
      const top = y - i * tread;
      Z.box(p.x, top, p.z, 0.06, 0.95, 0.06, steel, { collide: false, ground: false });
    }
  }

  // Perforated timber ceiling reads as a grid of battens, not a flat slab only.
  for (let i = -6; i <= 6; i += 1.5) {
    add(i, 5.7, 0.06, 0.04, 10.4, mat(0x8a5a32, { roughness: 0.7 }), { dy: 2.92, collide: false, ground: false });
  }

  const table = (along, depth) => {
    const p = mcrebarPoint(along, depth);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 18), timber);
    top.position.set(p.x, y + 0.75, p.z);
    top.castShadow = true;
    Z.group.add(top);
    add(along, depth, 0.08, 0.72, 0.08, mat(0x22262e, { roughness: 0.5 }), { dy: 0, collide: false, ground: false });
    const leg = mat(0x1a1a1a, { roughness: 0.45, metalness: 0.2 });
    for (const [da, dd] of [[0.72, 0], [-0.72, 0], [0, 0.72], [0, -0.72]]) {
      const ca = along + da;
      const cd = depth + dd;
      add(ca, cd, 0.4, 0.05, 0.4, seat, { dy: 0.44, collide: false, ground: false });
      for (const [la, ld] of [[0.15, 0.15], [0.15, -0.15], [-0.15, 0.15], [-0.15, -0.15]]) {
        add(ca + la, cd + ld, 0.035, 0.44, 0.035, leg, { dy: 0, collide: false, ground: false });
      }
      const sideAlong = Math.abs(da) > Math.abs(dd);
      const bx = da === 0 ? 0 : Math.sign(da) * 0.18;
      const bz = dd === 0 ? 0 : Math.sign(dd) * 0.18;
      add(ca + bx, cd + bz, sideAlong ? 0.045 : 0.36, 0.38, sideAlong ? 0.36 : 0.045, seat, { dy: 0.5, collide: false, ground: false });
    }
  };
  // Front band: cafe seating to the left, family seating to the right.
  for (const a of [-5.4, -3.8, -2.3]) table(a, 2.1);
  for (const a of [2.4, 4.1, 5.6]) table(a, 2.15);
  add(6.5, 1.3, 0.45, 0.7, 0.45, mat(0x3e6b45, { roughness: 0.85 }), { collide: false, ground: false });
  // Main floor, the young-adult tables, and the long communal table from the plan.
  for (const [a, d] of [[-1.2, 4.3], [1.4, 4.5], [-3.6, 4.6], [3.6, 4.4]]) table(a, d);
  add(0.2, 5.15, 2.6, 0.08, 0.9, timber, { dy: 0.74, collide: false, ground: false });
  add(0.2, 5.15, 0.1, 0.74, 0.1, mat(0x22262e, { roughness: 0.5 }), { collide: false, ground: false });
  add(-0.7, 5.15, 0.4, 0.42, 0.9, seat, { dy: 0.42, collide: false, ground: false });
  add(1.1, 5.15, 0.4, 0.42, 0.9, seat, { dy: 0.42, collide: false, ground: false });
  // Private dining, a closed glass room on the left.
  add(-6.3, 6.4, 2.3, 2.4, 0.06, glass, { collide: false, ground: false });
  add(-5.2, 7.3, 0.06, 2.4, 2.2, glass, { collide: false, ground: false });
  table(-6.3, 7.5);

  // Order and collect counters, then the kitchen behind them.
  add(-1.6, 8.15, 3.4, 1.05, 0.7, steel);
  add(2.6, 8.15, 3.2, 1.05, 0.7, mat(0x2a3038, { roughness: 0.45, metalness: 0.3 }));
  Z.textSign(mcrebarPoint(-1.6, 8.72).x, y + 2.58, mcrebarPoint(-1.6, 8.72).z, ry, 'ORDER', { w: 1.5, h: 0.26, bg: '#161616', fg: '#fff6e8' });
  Z.textSign(mcrebarPoint(2.6, 7.7).x, y + 2.15, mcrebarPoint(2.6, 7.7).z, ry, 'COLLECT', { w: 1.6, h: 0.32, bg: '#161616', fg: '#fff6e8' });
  // Menu board and the two order kiosks from the interior photograph.
  add(-1.6, 8.7, 2.6, 1.15, 0.08, menuBoard(), { dy: 1.2, collide: false, ground: false });
  for (const a of [-3.3, -0.2]) {
    add(a, 6.7, 0.42, 1.45, 0.28, mat(0x1a1d26, { roughness: 0.4 }));
    add(a, 6.55, 0.32, 0.7, 0.04, kioskScreen(), { dy: 0.85, collide: false, ground: false });
  }
  add(1.1, 6.5, 0.38, 1.6, 0.38, mat(0xcfc8bc, { roughness: 0.7 }));
  Z.textSign(mcrebarPoint(1.1, 6.15).x, y + 1.15, mcrebarPoint(1.1, 6.15).z, ry, 'NAPKINS\n& STRAWS', { w: 0.55, h: 0.7, bg: '#cfc8bc', fg: '#1a1d26' });
  // Kitchen: cold wall, bench, pass.
  add(2.2, 10.2, 6.4, 2.4, 0.12, mat(0x3a414c, { roughness: 0.6 }));
  add(4.8, 9.6, 2.2, 0.9, 1.1, steel, { collide: false, ground: false });
  add(-5.5, 9.4, 2.4, 2.2, 2.2, mat(0xd9d6d0, { roughness: 0.5 }));

  // Track rail and heads, the same run the interior photograph shows over the counter.
  add(0.3, 5.4, 6.2, 0.035, 0.05, mat(0x111111, { roughness: 0.4, metalness: 0.4 }), { dy: 2.9, collide: false, ground: false });
  for (const a of [-2.2, -0.4, 1.4, 3.2]) {
    add(a, 5.4, 0.07, 0.18, 0.07, mat(0x111111, { roughness: 0.4 }), { dy: 2.7, collide: false, ground: false });
    const p = mcrebarPoint(a, 5.4);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.07, 10), mat(0x161616, { roughness: 0.35, metalness: 0.3 }));
    head.position.set(p.x, y + 2.62, p.z);
    Z.group.add(head);
  }
  for (const [a, d] of [[-3.2, 3.2], [3.2, 3.4], [0, 6.8], [-4, 8]]) {
    const p = mcrebarPoint(a, d);
    const glow = new THREE.PointLight(0xfff3dd, 6, 10, 2);
    glow.position.set(p.x, y + 2.65, p.z);
    Z.group.add(glow);
  }

  // The meal stays hidden until he orders it.
  const meal = new THREE.Group();
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.3), mat(0xe7e2d4, { roughness: 0.6 }));
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mat(0xe0a04a, { roughness: 0.7 }));
  bun.scale.y = 0.7;
  bun.position.set(-0.08, 0.08, 0);
  const fries = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.08), mat(0xf0c43a, { roughness: 0.6 }));
  fries.position.set(0.12, 0.08, 0);
  meal.add(tray, bun, fries);
  const counter = mcrebarPoint(-1.6, 7.85);
  meal.position.set(counter.x, y + 1.1, counter.z);
  meal.visible = false;
  Z.group.add(meal);

  // Move the quest point onto the order counter, on this floor.
  const stand = mcrebarPoint(-1.6, 7.15);
  PLACE.mcrebar.x = stand.x;
  PLACE.mcrebar.z = stand.z;
  const it = Z.interactables?.find((x) => x.id === 'mcrebar');
  if (it) it.pos.set(stand.x, y + 1.0, stand.z);

  return { y, meal, counter, door, stand, spot: mcrebarPoint(0.6, 3.3) };
}

function paint(draw, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, emissive: 0xfff6e8, emissiveMap: t, emissiveIntensity: 0.35 });
}

function menuBoard() {
  return paint((g, w, h) => {
    g.fillStyle = '#f6f1e6';
    g.fillRect(0, 0, w, h);
    const items = [['DELUXE', '#e0a04a'], ['GIRDER', '#c45a2a'], ['FRIES', '#f0c43a'], ['SHAKE', '#e7b7a2']];
    items.forEach((it, i) => {
      const x = 28 + i * 118;
      g.fillStyle = it[1];
      g.fillRect(x, 28, 100, 64);
      g.fillStyle = '#1a1d26';
      g.font = '700 18px sans-serif';
      g.textAlign = 'center';
      g.fillText(it[0], x + 50, 116);
    });
    g.font = '800 32px sans-serif';
    g.fillText('McREBAR', w / 2, 168);
  }, 512, 220);
}

function kioskScreen() {
  return paint((g, w, h) => {
    g.fillStyle = '#102033';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2c14b';
    g.font = '800 42px sans-serif';
    g.textAlign = 'center';
    g.fillText('ORDER', w / 2, h / 2 - 8);
    g.font = '700 28px sans-serif';
    g.fillStyle = '#fff6e8';
    g.fillText('HERE', w / 2, h / 2 + 36);
  }, 256, 420);
}

function speckledFloor() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#b7b5b0';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 180; i++) {
    g.fillStyle = i % 2 ? 'rgba(255,255,255,.18)' : 'rgba(40,40,40,.12)';
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 4);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
}

function perfCeiling() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#c4a077';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#3a2a1c';
  for (let y = 6; y < 64; y += 10) {
    for (let x = 6; x < 64; x += 10) {
      g.beginPath();
      g.arc(x, y, 2.1, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 7);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.72 });
}

export function buildCollectorLawn(saga) {
  const Z = saga.game.zone;
  const p = PLACE.event;
  const y = saga.ground(p.x, p.z);
  const cloth = mat(0x6d1d2c, { roughness: 0.75 });
  const brass = mat(0xe0b15a, { metalness: 0.8, roughness: 0.28 });
  const glass = mat(0xd5eef5, { transparent: true, opacity: 0.3, roughness: 0.05 });
  Z.box(p.x, y, p.z, 9, 0.08, 9, mat(0xded7c8, { roughness: 0.9 }), { collide: false });
  const spots = [[-2.4, 1.2, 0x1f8a4c, 'LEFT'], [0, 1.2, 0xc9ccd4, 'MID'], [2.4, 1.2, 0xf0d78a, 'RIGHT']];
  for (const [dx, dz, color, name] of spots) {
    Z.box(p.x + dx, y, p.z + dz, 0.7, 0.85, 0.7, mat(0x2a3038, { roughness: 0.5 }));
    Z.box(p.x + dx, y + 0.85, p.z + dz, 0.55, 0.9, 0.55, glass, { collide: false, ground: false });
    Z.box(p.x + dx, y + 1.15, p.z + dz, 0.08, 0.55, 0.08, mat(color, { metalness: 0.6, roughness: 0.3 }), { collide: false, ground: false });
    Z.textSign(p.x + dx, y + 1.95, p.z + dz, 0, name, { w: 0.9, h: 0.28, bg: '#1a1d26', fg: '#fff6e8' });
  }
  // Rope between the cases.
  Z.box(p.x - 1.2, y + 0.7, p.z + 1.2, 2.2, 0.04, 0.04, cloth, { collide: false, ground: false });
  Z.box(p.x + 1.2, y + 0.7, p.z + 1.2, 2.2, 0.04, 0.04, cloth, { collide: false, ground: false });
  // Scanner on its own stand, and a mop with a real head.
  Z.box(p.x + 3.4, y, p.z - 1, 0.45, 1.05, 0.35, mat(0x1a1d26, { roughness: 0.4 }));
  Z.box(p.x + 3.4, y + 1.05, p.z - 1, 0.32, 0.22, 0.06, mat(0x35c5f0, { emissive: 0x1787c9, emissiveIntensity: 0.8 }), { collide: false, ground: false });
  const mop = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 6), timberSafe());
  handle.position.y = 0.7;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.16), mat(0xd9d4c4, { roughness: 1 }));
  head.position.y = 0.06;
  mop.add(handle, head);
  mop.position.set(p.x - 3.2, y, p.z - 1.4);
  mop.rotation.z = 0.15;
  Z.group.add(mop);
  Z.textSign(p.x, y + 2.3, p.z - 4.1, 0, 'COLLECTOR LAWN\nSOUTH BANK', { w: 4.2, h: 0.9, bg: '#14305a', fg: '#ffe9a8' });
  return { brass };
}

function timberSafe() {
  return mat(0x8a5a32, { roughness: 0.7 });
}
