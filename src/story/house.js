// Bung's West End house. A real plan: verandah, bedroom, living room,
// kitchen, rebar cupboard and a workshop garage. Furniture is geometry he can use.
import * as THREE from 'three';
import { ribbon3d } from '../world/geo/drape.js';
import { mat } from '../core/utils.js';
import { PLACE } from './sagaData.js';

function woodTex() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#b8885c';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 18; i++) {
    g.strokeStyle = i % 2 ? 'rgba(90,50,24,.35)' : 'rgba(255,220,170,.18)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, i * 7 + 2);
    g.bezierCurveTo(40, i * 7, 80, i * 7 + 8, 128, i * 7 + 1);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function boardTex(dark) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  for (let row = 0; row < 128; row += 8) {
    g.fillStyle = dark ? (row % 16 ? '#d9cdb4' : '#cfc2a6') : (row % 16 ? '#f4ecdc' : '#e7dcc4');
    g.fillRect(0, row, 64, 7);
    g.fillStyle = 'rgba(80,60,30,.4)';
    g.fillRect(0, row + 7, 64, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.88 });
}

function hinge(group, x, y, z) {
  const h = new THREE.Group();
  h.position.set(x, y, z);
  group.add(h);
  return h;
}

export function buildHouse(saga) {
  const Z = saga.game.zone;
  const home = PLACE.home;
  let peak = saga.ground(home.x, home.z);
  let low = peak;
  for (let x = home.x - 6; x <= home.x + 6; x += 1.5) {
    for (let z = home.z - 4.4; z <= home.z + 5.2; z += 1.5) {
      const h = saga.ground(x, z);
      if (h > peak) peak = h;
      if (h < low) low = h;
    }
  }
  const y = peak + 0.04;
  const board = boardTex(false);
  const boardD = boardTex(true);
  const plaster = mat(0xf7f2e8, { roughness: 0.94 });
  const trim = mat(0xf7f4ee, { roughness: 0.7 });
  const timber = mat(0x8a5a32, { roughness: 0.72 });
  const floorMat = new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.78, metalness: 0.02 });
  const tile = mat(0xd7d2c8, { roughness: 0.55 });
  const cloth = mat(0x6d7c8a, { roughness: 0.9 });
  const glass = mat(0x9fd4ea, { roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  const bulb = mat(0xfff1c9, { emissive: 0xffe2a0, emissiveIntensity: 1.4 });
  const rust = mat(0xb35c2a, { metalness: 0.72, roughness: 0.38 });

  const X0 = home.x - 6.2, X1 = home.x + 6.2;
  const Z0 = home.z - 4.6, Z1 = home.z + 5.4;
  const cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  const W = X1 - X0, D = Z1 - Z0;

  Z.box(cx, y, cz, W, 0.16, D, floorMat, { collide: false });
  if (y - low > 0.05) {
    Z.box(cx, low - 0.08, cz, W + 0.6, (y - low) + 0.08, D + 0.6, mat(0x9a9186, { roughness: 0.95 }), { collide: false, ground: false });
  }
  Z.box(cx, y + 2.72, cz, W + 0.4, 0.16, D + 0.5, mat(0x6e4b32, { roughness: 0.8 }), { collide: false, ground: false });
  // Weatherboards. North wall keeps a front door.
  Z.box(cx, y, Z1, W, 2.7, 0.16, board);
  Z.box(X0, y, cz, 0.16, 2.7, D, board);
  // East wall, split for the door into the garage.
  const sideDoorZ = home.z + 1.6;
  const sideHalf = 0.82;
  const eastNorthLen = (sideDoorZ - sideHalf) - Z0;
  const eastSouthLen = Z1 - (sideDoorZ + sideHalf);
  Z.box(X1, y, Z0 + eastNorthLen / 2, 0.16, 2.7, eastNorthLen, boardD);
  Z.box(X1, y, Z1 - eastSouthLen / 2, 0.16, 2.7, eastSouthLen, boardD);
  Z.box(X1, y, sideDoorZ - sideHalf, 0.2, 2.2, 0.1, trim);
  Z.box(X1, y, sideDoorZ + sideHalf, 0.2, 2.2, 0.1, trim);
  Z.box(X1, y + 2.15, sideDoorZ, 0.2, 0.12, sideHalf * 2 + 0.16, trim);
  Z.box(cx - 3.7, y, Z0, 5.0, 2.7, 0.16, board);
  Z.box(cx + 3.7, y, Z0, 5.0, 2.7, 0.16, board);
  // Plaster lining so the weatherboards stay on the outside.
  Z.box(cx, y, Z1 - 0.1, W - 0.35, 2.58, 0.04, plaster, { collide: false, ground: false });
  Z.box(X0 + 0.1, y, cz, 0.04, 2.58, D - 0.35, plaster, { collide: false, ground: false });
  Z.box(X1 - 0.1, y, Z0 + eastNorthLen / 2, 0.04, 2.58, Math.max(0.2, eastNorthLen - 0.3), plaster, { collide: false, ground: false });
  Z.box(X1 - 0.1, y, Z1 - eastSouthLen / 2, 0.04, 2.58, Math.max(0.2, eastSouthLen - 0.2), plaster, { collide: false, ground: false });
  Z.box(cx - 3.7, y, Z0 + 0.1, 4.7, 2.58, 0.04, plaster, { collide: false, ground: false });
  Z.box(cx + 3.7, y, Z0 + 0.1, 4.7, 2.58, 0.04, plaster, { collide: false, ground: false });
  // Door frame and a half-glazed door, left open.
  Z.box(cx - 1.15, y, Z0, 0.1, 2.35, 0.18, trim);
  Z.box(cx + 1.15, y, Z0, 0.1, 2.35, 0.18, trim);
  Z.box(cx, y + 2.2, Z0, 2.4, 0.12, 0.18, trim);
  const door = hinge(Z.group, cx - 1.05, y, Z0 - 0.02);
  const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.96, 2.15, 0.06), timber);
  doorMesh.position.set(0.48, 1.08, 0);
  door.add(doorMesh);
  const doorGlass = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.02), glass);
  doorGlass.position.set(0.48, 1.55, 0.04);
  door.add(doorGlass);
  door.rotation.y = -1.15;

  // Verandah deck and posts, facing the yard.
  Z.box(cx, y - 0.02, Z0 - 1.35, W + 0.3, 0.12, 2.5, mat(0xc4a077, { roughness: 0.8 }), { collide: false });
  for (const x of [X0 + 0.3, X1 - 0.3]) {
    Z.box(x, y, Z0 - 2.45, 0.14, 2.55, 0.14, trim);
  }
  Z.box(cx, y + 2.45, Z0 - 1.35, W + 0.2, 0.1, 2.6, mat(0x6e4b32, { roughness: 0.75 }), { collide: false, ground: false });
  const yard = saga.ground(cx, Z0 - 3.4);
  const drop = Math.max(0, y + 0.08 - yard);
  const treads = Math.max(1, Math.ceil(drop / 0.14));
  const rise = drop / treads;
  for (let i = 0; i < treads; i++) {
    const top = y + 0.08 - i * rise;
    Z.box(cx, top - rise, Z0 - 2.55 - i * 0.36, 2.2, rise, 0.36, mat(0xc4a077, { roughness: 0.8 }), { collide: false });
  }

  // Bedroom (front) / living (back) with a doorway.
  Z.box(cx - 3.55, y, home.z - 0.2, 5.1, 2.55, 0.12, boardD);
  Z.box(cx + 3.55, y, home.z - 0.2, 5.1, 2.55, 0.12, boardD);
  const skirting = mat(0xf7f4ee, { roughness: 0.7 });
  Z.box(cx, y, Z1 - 0.12, W - 0.3, 0.12, 0.04, skirting, { collide: false, ground: false });
  Z.box(X0 + 0.12, y, cz, 0.04, 0.12, D - 0.3, skirting, { collide: false, ground: false });
  Z.box(X1 - 0.12, y, Z0 + eastNorthLen / 2, 0.04, 0.12, Math.max(0.2, eastNorthLen - 0.4), skirting, { collide: false, ground: false });
  Z.box(X1 - 0.12, y, Z1 - eastSouthLen / 2, 0.04, 0.12, Math.max(0.2, eastSouthLen - 0.3), skirting, { collide: false, ground: false });
  Z.box(cx, y + 2.55, cz, W - 0.2, 0.06, 0.06, skirting, { collide: false, ground: false });

  // Windows: jambs, sill, head and a mullion, with the glass in the opening.
  const windowAt = (x, z, ry) => {
    const frame = new THREE.Group();
    frame.position.set(x, y + 1.45, z);
    frame.rotation.y = ry;
    const pane = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.95, 0.03), glass);
    frame.add(pane);
    const bar = (bx, by, bw, bh) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.08), trim);
      m.position.set(bx, by, 0);
      frame.add(m);
    };
    bar(0, 0.55, 1.28, 0.08);
    bar(0, -0.55, 1.28, 0.08);
    bar(-0.58, 0, 0.08, 1.02);
    bar(0.58, 0, 0.08, 1.02);
    bar(0, 0, 0.045, 0.95);
    Z.group.add(frame);
  };
  windowAt(X0 - 0.02, home.z - 2.2, Math.PI / 2);
  windowAt(X1 + 0.02, home.z + 2.4, Math.PI / 2);
  windowAt(cx + 3.2, Z1 + 0.02, 0);

  // Bed, where the chapter starts. Frame, mattress, pillow and a folded blanket.
  const bed = PLACE.bed;
  const headZ = bed.z + 1.05;
  Z.box(bed.x, y, headZ, 1.5, 0.85, 0.08, timber, { collide: false, ground: false });
  for (const [dx, dz] of [[-0.58, -0.85], [0.58, -0.85], [-0.58, 0.9], [0.58, 0.9]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.32, 8), timber);
    leg.position.set(bed.x + dx, y + 0.16, bed.z + dz);
    Z.group.add(leg);
  }
  Z.box(bed.x, y + 0.32, bed.z + 0.05, 1.28, 0.08, 1.9, timber, { collide: false, ground: false });
  Z.box(bed.x, y + 0.4, bed.z + 0.02, 1.32, 0.18, 1.95, mat(0xf7f4ee, { roughness: 0.9 }), { collide: false });
  Z.box(bed.x, y + 0.56, bed.z + 0.55, 1.22, 0.06, 0.85, mat(0xc45a4a, { roughness: 0.85 }), { collide: false, ground: false });
  Z.box(bed.x, y + 0.02, bed.z, 1.9, 0.02, 2.5, mat(0x8d4a3a, { roughness: 0.95 }), { collide: false, ground: false });
  const pillow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), mat(0xf4f1ea, { roughness: 0.9 }));
  pillow.scale.set(1.3, 0.45, 0.85);
  pillow.position.set(bed.x, y + 0.68, headZ - 0.28);
  Z.group.add(pillow);
  const standTop = y + 0.48;
  Z.box(bed.x + 0.95, y, bed.z - 0.7, 0.42, 0.48, 0.38, timber, { collide: false });
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.16, 10, 1, true), mat(0xfff1c4, { side: THREE.DoubleSide, emissive: 0xffe2a0, emissiveIntensity: 0.55 }));
  shade.position.set(bed.x + 0.95, standTop + 0.28, bed.z - 0.7);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), bulb);
  lamp.position.set(bed.x + 0.95, standTop + 0.22, bed.z - 0.7);
  Z.group.add(shade, lamp);
  const light = new THREE.PointLight(0xffe2b0, 2.2, 9, 2);
  light.position.set(bed.x + 0.4, y + 2.15, bed.z);
  Z.group.add(light);

  // Wardrobe against the west side of the living room. Doors start shut.
  const w = PLACE.wardrobe;
  Z.box(w.x - 0.24, y, w.z, 0.06, 1.9, 1.25, timber);
  Z.box(w.x, y, w.z - 0.6, 0.55, 1.9, 0.06, timber);
  Z.box(w.x, y, w.z + 0.6, 0.55, 1.9, 0.06, timber);
  Z.box(w.x, y + 1.84, w.z, 0.55, 0.06, 1.25, timber, { collide: false, ground: false });
  Z.box(w.x, y, w.z, 0.55, 0.08, 1.25, timber);
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 6), mat(0xc9ccd4, { metalness: 0.7, roughness: 0.3 }));
  rail.rotation.x = Math.PI / 2;
  rail.position.set(w.x, y + 1.45, w.z);
  Z.group.add(rail);
  const hanging = new THREE.Group();
  const hangShirt = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.55, 0.08), mat(0xf4f1ea, { roughness: 0.8 }));
  hangShirt.position.set(w.x, y + 1.15, w.z - 0.18);
  const hangShorts = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.32), mat(0x7a5230, { roughness: 0.9 }));
  hangShorts.position.set(w.x, y + 1.05, w.z + 0.18);
  hanging.add(hangShirt, hangShorts);
  Z.group.add(hanging);
  const wardL = hinge(Z.group, w.x + 0.28, y, w.z - 0.58);
  const wardR = hinge(Z.group, w.x + 0.28, y, w.z + 0.58);
  for (const [h, dir] of [[wardL, 1], [wardR, -1]]) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.82, 0.56), mat(0x6d4318, { roughness: 0.7 }));
    leaf.position.set(0, 0.95, dir * 0.28);
    const pull = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), rust);
    pull.position.set(0.05, 0.95, dir * 0.12);
    h.add(leaf, pull);
  }

  // Rebar cupboard. Two doors, two shelves, a bar in each clip.
  const s = PLACE.shelf;
  const shell = mat(0x3a414c, { roughness: 0.55, metalness: 0.25 });
  Z.box(s.x + 0.22, y, s.z, 0.06, 1.7, 1.45, shell);
  Z.box(s.x, y, s.z - 0.7, 0.5, 1.7, 0.06, shell);
  Z.box(s.x, y, s.z + 0.7, 0.5, 1.7, 0.06, shell);
  Z.box(s.x, y + 1.64, s.z, 0.5, 0.06, 1.45, shell, { collide: false, ground: false });
  Z.box(s.x, y, s.z, 0.5, 0.08, 1.45, shell);
  const bars = new THREE.Group();
  for (const shelfY of [0.42, 1.02]) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 1.2), mat(0x8a929c, { metalness: 0.4, roughness: 0.45 }));
    shelf.position.set(s.x, y + shelfY, s.z);
    bars.add(shelf);
  }
  const colours = [0xb35c2a, 0xc9ccd4, 0xe0b15a, 0x6d543c, 0xd27a4a];
  colours.forEach((color, i) => {
    const col = i % 3;
    const row = i < 3 ? 0 : 1;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.36, 8), mat(color, { metalness: 0.75, roughness: 0.32 }));
    bar.rotation.z = Math.PI / 2;
    bar.position.set(s.x - 0.02, y + 0.5 + row * 0.6, s.z - 0.38 + col * 0.38);
    bars.add(bar);
  });
  const emerald = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 8), mat(0x1f8a4c, { metalness: 0.7, roughness: 0.28, emissive: 0x0d4a28, emissiveIntensity: 0.6 }));
  emerald.rotation.x = Math.PI / 2;
  emerald.position.set(s.x, y + 1.12, s.z + 0.4);
  emerald.visible = false;
  bars.add(emerald);
  Z.group.add(bars);
  const cupL = hinge(Z.group, s.x - 0.26, y, s.z - 0.68);
  const cupR = hinge(Z.group, s.x - 0.26, y, s.z + 0.68);
  for (const [h, dir] of [[cupL, 1], [cupR, -1]]) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.6, 0.66), mat(0x2a3038, { roughness: 0.45, metalness: 0.35 }));
    leaf.position.set(0, 0.85, dir * 0.33);
    const pull = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 6), rust);
    pull.rotation.z = Math.PI / 2;
    pull.position.set(-0.05, 0.85, dir * 0.16);
    h.add(leaf, pull);
  }
  Z.textSign(s.x - 0.32, y + 1.82, s.z, -Math.PI / 2, 'REBAR CUPBOARD', { w: 1.2, h: 0.18, bg: '#1a1d26', fg: '#f2c14b' });

  // Kitchen along the south wall.
  Z.box(cx, y, Z1 - 0.7, 4.8, 0.92, 0.7, tile);
  Z.box(cx - 1.5, y + 0.92, Z1 - 0.7, 0.55, 0.06, 0.38, mat(0x8d98a3, { metalness: 0.7, roughness: 0.22 }), { collide: false, ground: false });
  Z.box(cx - 1.5, y + 0.96, Z1 - 0.7, 0.38, 0.04, 0.24, mat(0x5c6770, { metalness: 0.8, roughness: 0.18 }), { collide: false, ground: false });
  Z.box(cx - 0.15, y + 0.94, Z1 - 0.55, 0.22, 0.02, 0.22, mat(0x2a3038, { metalness: 0.6, roughness: 0.3 }), { collide: false, ground: false });
  Z.box(cx + 0.25, y + 0.94, Z1 - 0.55, 0.22, 0.02, 0.22, mat(0x2a3038, { metalness: 0.6, roughness: 0.3 }), { collide: false, ground: false });
  Z.box(cx + 1.7, y, Z1 - 0.85, 0.7, 1.7, 0.65, mat(0xe7e4dc, { roughness: 0.45 }));
  Z.box(cx + 1.32, y + 0.85, Z1 - 0.5, 0.04, 0.55, 0.04, mat(0xc9ccd4, { metalness: 0.75, roughness: 0.25 }), { collide: false, ground: false });
  Z.box(cx - 0.4, y + 1.45, Z1 - 0.52, 2.8, 0.62, 0.32, mat(0xf4f0e6, { roughness: 0.55 }), { collide: false, ground: false });
  const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.2, 6), mat(0xc9ccd4, { metalness: 0.8, roughness: 0.2 }));
  tap.position.set(cx - 1.5, y + 1.1, Z1 - 0.62);
  Z.group.add(tap);
  for (const dx of [-0.15, 0.25]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 14), mat(0x2a3038, { metalness: 0.65, roughness: 0.3 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(cx + dx, y + 0.98, Z1 - 0.55);
    Z.group.add(ring);
  }
  const pend = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.12, 10, 1, true), mat(0xfff1c4, { side: THREE.DoubleSide, emissive: 0xffe2a0, emissiveIntensity: 0.45 }));
  pend.position.set(cx, y + 2.22, Z1 - 1.35);
  Z.group.add(pend);
  const kitchenLight = new THREE.PointLight(0xfff4e0, 1.8, 8, 2);
  kitchenLight.position.set(cx, y + 2.4, Z1 - 1.3);
  Z.group.add(kitchenLight);

  // Couch and rug in the living room, clear of the cupboard and wardrobe.
  const couchZ = home.z + 2.15;
  Z.box(cx, y, couchZ, 1.9, 0.4, 0.82, cloth, { collide: false });
  Z.box(cx, y + 0.4, couchZ + 0.34, 1.9, 0.55, 0.16, cloth, { collide: false, ground: false });
  Z.box(cx - 0.88, y + 0.4, couchZ - 0.02, 0.14, 0.26, 0.78, cloth, { collide: false, ground: false });
  Z.box(cx + 0.88, y + 0.4, couchZ - 0.02, 0.14, 0.26, 0.78, cloth, { collide: false, ground: false });
  Z.box(cx, y + 0.4, couchZ - 0.02, 0.03, 0.05, 0.62, mat(0x556270, { roughness: 0.9 }), { collide: false, ground: false });
  Z.box(cx, y + 0.01, home.z + 1.5, 2.4, 0.02, 1.6, mat(0x8d3b3b, { roughness: 0.95 }), { collide: false, ground: false });
  Z.box(cx, y, home.z + 1.05, 0.85, 0.34, 0.48, timber, { collide: false });

  Z.textSign(home.x, y + 2.35, Z0 - 2.5, Math.PI, "BUNG'S PLACE\nWEST END", { w: 3.4, h: 0.85, bg: '#ffc02e', fg: '#1a1d26' });

  // Workshop garage on the east side. Wide enough for the trolley to reverse,
  // turn and leave by the north door onto the driveway.
  const concrete = mat(0xb7b2a8, { roughness: 0.92 });
  const steel = mat(0x8d939c, { metalness: 0.72, roughness: 0.35 });
  const minX = X1 + 0.35;
  const maxX = minX + 7.6;
  const minZ = Z0 - 6.8;
  const maxZ = sideDoorZ + 2.4;
  const gcx = (minX + maxX) / 2;
  const gcz = (minZ + maxZ) / 2;
  const gFloor = y + 0.16;
  Z.box(gcx, y, gcz, maxX - minX, 0.16, maxZ - minZ, concrete);
  Z.box((X1 + minX) / 2, y, sideDoorZ, minX - X1 + 0.2, 0.16, sideHalf * 2, concrete);
  const gapX = (X1 + 0.08 + minX) / 2;
  const gapW = Math.max(0.12, minX - (X1 + 0.08));
  Z.box(gapX, y, (Z0 + sideDoorZ - sideHalf) / 2, gapW, 2.7, (sideDoorZ - sideHalf) - Z0, boardD);
  Z.box(gapX, y, (sideDoorZ + sideHalf + maxZ) / 2, gapW, 2.7, maxZ - (sideDoorZ + sideHalf), boardD);
  Z.box(maxX, y, gcz, 0.16, 2.75, maxZ - minZ, boardD);
  Z.box(gcx, y, maxZ, maxX - minX, 2.75, 0.16, boardD);
  // North wall stays solid. The real building north of the yard blocks that way.
  Z.box(gcx, y, minZ, maxX - minX, 2.75, 0.16, boardD);
  const opening = 4.2;
  const doorZ = minZ + 2.7;
  const southOfDoor = Z0 - (doorZ + opening / 2);
  const northOfDoor = (doorZ - opening / 2) - minZ;
  if (southOfDoor > 0.2) Z.box(minX, y, Z0 - southOfDoor / 2, 0.16, 2.75, southOfDoor, boardD);
  if (northOfDoor > 0.2) Z.box(minX, y, minZ + northOfDoor / 2, 0.16, 2.75, northOfDoor, boardD);
  Z.box(minX, y + 2.45, doorZ, 0.2, 0.3, opening + 0.2, trim);
  Z.box(gcx, y + 2.72, gcz, maxX - minX + 0.3, 0.14, maxZ - minZ + 0.3, mat(0x6e4b32, { roughness: 0.8 }), { collide: false, ground: false });
  const doorMount = new THREE.Group();
  doorMount.position.set(minX - 0.02, y + 2.42, doorZ);
  doorMount.rotation.y = Math.PI / 2;
  Z.group.add(doorMount);
  const doorHinge = new THREE.Group();
  doorMount.add(doorHinge);
  const panelMat = mat(0xd9d3c8, { roughness: 0.55, metalness: 0.12 });
  for (let i = 0; i < 5; i++) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(opening - 0.18, 0.4, 0.05), panelMat);
    panel.position.set(0, -0.26 - i * 0.42, 0);
    doorHinge.add(panel);
  }
  const blocker = new THREE.Box3(
    new THREE.Vector3(minX - 0.22, y, doorZ - opening / 2 + 0.05),
    new THREE.Vector3(minX + 0.22, y + 2.3, doorZ + opening / 2 - 0.05),
  );
  Z.colliders.push(blocker);

  const benchX = maxX - 0.7;
  Z.box(benchX, y, gcz + 1.2, 0.7, 0.92, 2.4, timber);
  Z.box(benchX, y + 0.92, gcz + 1.2, 0.78, 0.06, 2.5, mat(0x6d5138, { roughness: 0.7 }), { collide: false, ground: false });
  Z.colliders.push(new THREE.Box3(
    new THREE.Vector3(benchX - 0.4, y, gcz - 0.1),
    new THREE.Vector3(benchX + 0.4, y + 1.05, gcz + 2.5),
  ));
  for (let i = 0; i < 4; i++) {
    const tool = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.04), steel);
    tool.position.set(benchX - 0.2, y + 1.15, gcz + 0.3 + i * 0.4);
    tool.rotation.z = i % 2 ? 0.4 : -0.2;
    Z.group.add(tool);
  }
  const rackZ = maxZ - 0.55;
  Z.box(gcx - 0.4, y, rackZ, 2.2, 1.35, 0.35, steel);
  for (let i = 0; i < 5; i++) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.15, 6), rust);
    rod.rotation.z = Math.PI / 2;
    rod.position.set(gcx - 1.15 + i * 0.38, y + 0.85, rackZ);
    Z.group.add(rod);
  }
  Z.box(maxX - 0.5, y, gcz - 2.4, 0.62, 1.15, 0.5, mat(0x3e4a44, { roughness: 0.6 }));
  const bayLight = new THREE.PointLight(0xfff1d2, 2.0, 14, 2);
  bayLight.position.set(gcx, y + 2.45, gcz);
  Z.group.add(bayLight);
  const bayLamp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.28), mat(0xfff1c9, { emissive: 0xffe2a0, emissiveIntensity: 0.8 }));
  bayLamp.position.set(gcx, y + 2.55, gcz);
  Z.group.add(bayLamp);
  Z.textSign(minX - 0.16, y + 2.15, doorZ, -Math.PI / 2, 'JAMES REBAR', { w: 2.4, h: 0.36, bg: '#1a1d26', fg: '#ffc02e' });

  // Drive west, clear of the building that sits immediately north of the yard,
  // then north onto the street the route already uses.
  PLACE.gate.x = -844.3;
  PLACE.gate.z = 877.1;
  const gate = PLACE.gate;
  const street = saga.ground(gate.x, gate.z);
  const westRun = minX - (gate.x + 1.5);
  const driveway = [
    [minX + 1, gFloor, doorZ], [gate.x, street + .04, doorZ], [gate.x, street + .04, gate.z],
  ];
  const drivewayPositions=[];
  ribbon3d(drivewayPositions,driveway,2.2,(x,z)=>saga.ground(x,z),.015);
  const drivewayGeo=new THREE.BufferGeometry();
  drivewayGeo.setAttribute('position',new THREE.Float32BufferAttribute(drivewayPositions,3));
  drivewayGeo.computeVertexNormals();
  const drivewayMesh=new THREE.Mesh(drivewayGeo,concrete);
  drivewayMesh.receiveShadow=true;Z.group.add(drivewayMesh);Z.grounds.push(drivewayMesh);Z._baseGrounds?.push(drivewayMesh);
  // Match the collision sampler as well as the raycast set. The old eight
  // horizontal slabs formed abrupt steps which caught a reversing trolley.
  Z.walkSurfaces?.add(drivewayPositions);

  PLACE.garage.x = gcx + 1.4;
  PLACE.garage.z = gcz + 1.6;
  const garage = {
    minX, maxX, minZ, maxZ,
    cx: gcx + 0.8, cz: doorZ,
    heading: -Math.PI / 2,
    doorX: minX, doorZ,
    hinge: doorHinge, blocker, target: 0, moving: false, open: false,
  };

  const qy = street;
  Z.box(gate.x - 2.7, qy, gate.z, 0.16, 1.3, 0.16, trim);
  Z.box(gate.x + 2.7, qy, gate.z, 0.16, 1.3, 0.16, trim);
  const lane = mat(0xf0c14b, { roughness: 0.55, emissive: 0x5a3c08, emissiveIntensity: 0.15 });
  for (let i = 0; i < 5; i++) {
    Z.box(minX + 1.1 + i * 1.15, y + 0.165, doorZ, 0.55, 0.015, 0.14, lane, { collide: false, ground: false });
  }
  Z.box(gcx + 2.15, y + 1.2, minZ + 0.28, 1.7, 0.62, 0.32, steel, { collide: false, ground: false });
  Z.colliders.push(new THREE.Box3(
    new THREE.Vector3(gcx + 1.2, y, minZ),
    new THREE.Vector3(gcx + 3.1, y + 1.9, minZ + 0.55),
  ));
  for (const [dx, col] of [[1.6, 0x8a3b2a], [2.15, 0x2a3a4a]]) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.55, 10), mat(col, { roughness: 0.45, metalness: 0.35 }));
    drum.position.set(maxX - 0.55, y + 0.44, maxZ - 1.3 - dx);
    Z.group.add(drum);
  }

  return {
    y, door, wardL, wardR, cupL, cupR, hanging, bars, emerald, garage,
    garageRoute: [{x: gcx, y: gFloor, z: doorZ}, {x: minX-1, y: gFloor, z: doorZ}, {x:gate.x,y:street,z:doorZ}, {x:gate.x,y:street,z:gate.z}],
    drivewayMesh,
    frontRoute: [{x:cx,y:y+.16,z:Z0+1}, {x:cx,y:y+.12,z:Z0-2.5}, {x:cx,y:yard,z:Z0-3-treads*.36}, {x:cx,y:saga.ground(cx,doorZ),z:doorZ}, {x:gate.x,y:street,z:doorZ}, {x:gate.x,y:street,z:gate.z}],
    rooms: [
      { minX: X0 - 0.3, maxX: X1 + 0.3, minZ: Z0 - 2.8, maxZ: Z1 + 0.3, floor: y, ceil: y + 2.68 },
      { minX: garage.minX - 0.4, maxX: garage.maxX + 0.4, minZ: garage.minZ - 0.4, maxZ: garage.maxZ + 0.4, floor: y, ceil: y + 2.68 },
    ],
  };
}
