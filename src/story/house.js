// Bung's West End house. A real plan: verandah, bedroom, living room,
// kitchen, rebar cupboard and a carport. Furniture is geometry he can use.
import * as THREE from 'three';
import { mat } from '../core/utils.js';
import { PLACE } from './sagaData.js?v=20261029b';

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
  const board = mat(0xf3ead8, { roughness: 0.86 });
  const boardD = mat(0xe2d3b8, { roughness: 0.9 });
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
  Z.box(X1, y, cz, 0.16, 2.7, D, boardD);
  Z.box(cx - 3.7, y, Z0, 5.0, 2.7, 0.16, board);
  Z.box(cx + 3.7, y, Z0, 5.0, 2.7, 0.16, board);
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
  for (const x of [X0 + 0.3, cx, X1 - 0.3]) {
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
  Z.box(X1 - 0.12, y, cz, 0.04, 0.12, D - 0.3, skirting, { collide: false, ground: false });
  Z.box(cx, y + 2.55, cz, W - 0.2, 0.06, 0.06, skirting, { collide: false, ground: false });

  // Windows
  for (const [x, z, ry] of [[X0 - 0.02, home.z - 2.2, Math.PI / 2], [X1 + 0.02, home.z + 2.4, Math.PI / 2], [cx + 3.2, Z1 + 0.02, 0]]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.05, 0.05), glass);
    win.position.set(x, y + 1.45, z);
    win.rotation.y = ry;
    Z.group.add(win);
    Z.box(x, y + 1.45, z, ry ? 0.08 : 1.25, 1.15, ry ? 1.25 : 0.08, trim, { collide: false, ground: false });
  }

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

  // Carport over the trolley pad.
  const g = PLACE.garage;
  const gy = saga.ground(g.x, g.z);
  for (const [dx, dz] of [[-1.3, -1.1], [1.3, -1.1], [-1.3, 1.1], [1.3, 1.1]]) {
    Z.box(g.x + dx, gy, g.z + dz, 0.12, 2.5, 0.12, trim);
  }
  Z.box(g.x, gy + 2.45, g.z, 3.1, 0.1, 2.7, mat(0xc4552a, { roughness: 0.7 }), { collide: false, ground: false });
  Z.box(g.x, gy, g.z, 2.2, 0.08, 1.3, mat(0xe0b15a, { metalness: 0.75, roughness: 0.28, emissive: 0x5a3c08 }), { collide: false });
  Z.textSign(home.x, y + 2.35, Z0 - 2.5, Math.PI, "BUNG'S PLACE\nWEST END", { w: 3.4, h: 0.85, bg: '#ffc02e', fg: '#1a1d26' });

  // Gate posts where the yard meets the street.
  const gate = PLACE.gate;
  const qy = saga.ground(gate.x, gate.z);
  Z.box(gate.x - 1.4, qy, gate.z, 0.16, 1.3, 0.16, trim);
  Z.box(gate.x + 1.4, qy, gate.z, 0.16, 1.3, 0.16, trim);

  return { y, door, wardL, wardR, cupL, cupR, hanging, bars, emerald };
}
