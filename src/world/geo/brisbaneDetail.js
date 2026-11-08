// Queen Street Mall and City Hall. Geography stays on the OpenStreetMap footprints.
// Facades are materials and massing, not roof pixels and not the orthophoto.
// Estimates are named in the comments. Published figures are named with their source.
import * as THREE from 'three';
import { rng } from '../../core/utils.js';
import { drapePolygon } from './drape.js';
import { buildStreetTree, mergeStatic } from './cityModels.js';

const SANDSTONE = 0xe9c99a; // sunlit stone sampled from the Kgbo CC BY-SA 4.0 City Hall photograph
const PLAZA = 0xa59d90; // paving sampled from the same photograph
const RECESS = 0x6e5338;

function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

function std(opts) {
  return new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, side: THREE.DoubleSide, ...opts });
}

export function createStreetKit() {
  const mallTex = canvasTex(256, (g, size) => {
    g.fillStyle = '#a39d91';
    g.fillRect(0, 0, size, size);
    const tones = ['#c3bdb0', '#bbb5a9', '#c9c1b4', '#c0baaf', '#b7b1a6'];
    for (let y = 0; y < 4; y++) {
      const shift = y % 2 * 32;
      for (let x = -1; x < 4; x++) {
        const u = x * 64 + shift, v = y * 64;
        g.fillStyle = tones[((x + 1) * 3 + y * 7) % tones.length];
        g.fillRect(u + 1, v + 1, 63, 63);
        g.fillStyle = 'rgba(255,247,228,.15)';
        g.fillRect(u + 1, v + 1, 62, 1);
        g.fillStyle = 'rgba(47,41,34,.07)';
        g.fillRect(u + 1, v + 63, 62, 1);
      }
    }
    for (let i = 0; i < 5500; i++) {
      g.fillStyle = i % 2 ? 'rgba(52,42,28,.09)' : 'rgba(255,254,234,.14)';
      g.fillRect((i * 73.11) % size, (i * 49.77) % size, 1 + i % 3, 1);
    }
  });
  const landTex = canvasTex(128, (g) => {
    g.fillStyle = '#a39686';
    g.fillRect(0, 0, 128, 128);
    const specks = ['#8f9a74', '#b5a892', '#978976', '#7f8c68', '#c0b29e'];
    for (let i = 0; i < 46; i++) {
      g.fillStyle = specks[i % specks.length];
      g.fillRect((i * 37) % 120, (i * 19) % 120, 10 + (i % 5) * 4, 8 + (i % 3) * 3);
    }
  });
  const punched = (wall, win) => canvasTex(64, (g) => {
    g.fillStyle = wall;
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = win;
    g.fillRect(7, 8, 18, 22);
    g.fillRect(36, 8, 18, 22);
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.fillRect(7, 8, 18, 5);
    g.fillRect(36, 8, 18, 5);
    g.fillStyle = 'rgba(70,58,46,0.45)';
    g.fillRect(0, 60, 64, 4);
  });
  const asphaltTex = canvasTex(128, (g, size) => {
    const random = rng(522);
    g.fillStyle = '#41454a';
    g.fillRect(0, 0, size, size);
    for (let i = 0; i < 2400; i++) {
      g.fillStyle = i % 2 ? 'rgba(163,159,147,.13)' : 'rgba(23,24,24,.21)';
      g.fillRect(random() * size, random() * size, 1 + random() * 2, 1);
    }
  });
  const plazaTex = canvasTex(128, (g) => {
    g.fillStyle = '#8f877c';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#a59d90';
    g.fillRect(3, 3, 58, 58);
    g.fillRect(67, 3, 58, 58);
    g.fillRect(3, 67, 58, 58);
    g.fillRect(67, 67, 58, 58);
  });
  const glassTex = (pane, mullion, joint) => canvasTex(64, (g) => {
    g.fillStyle = pane;
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = joint;
    g.fillRect(0, 46, 64, 8);
    g.fillStyle = mullion;
    g.fillRect(0, 0, 2, 64);
    g.fillRect(31, 0, 2, 64);
    g.fillRect(0, 0, 64, 2);
  });
  // Near-white maps. The mesh vertex colour is the wall paint, so a brick
  // building and a cream house can share one material without cloning the texture.
  // Canvas y=0 is the top of the wall after flipY. Keep that band solid so a
  // roof cut does not slice a row of windows into a parapet.
  const paint = canvasTex(64, (g) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#3e4e58';
    g.fillRect(8, 30, 16, 18);
    g.fillRect(38, 30, 16, 18);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillRect(8, 30, 16, 4);
    g.fillRect(38, 30, 16, 4);
  });
  const brickTex = canvasTex(64, (g) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#d2cbc3';
    for (let y = 8; y < 64; y += 8) g.fillRect(0, y, 64, 1);
    for (let x = 0; x < 64; x += 16) g.fillRect(x, 28, 1, 36);
    g.fillStyle = '#3e4e58';
    g.fillRect(6, 34, 12, 12);
    g.fillRect(38, 34, 12, 12);
  });
  const metalTex = canvasTex(64, (g) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#d5dae0';
    for (let y = 16; y < 64; y += 10) g.fillRect(0, y, 64, 3);
    g.fillStyle = '#5e6a72';
    g.fillRect(8, 36, 18, 10);
    g.fillRect(38, 36, 18, 10);
  });

  return {
    mall: std({ map: mallTex, roughness: 0.94, vertexColors: false }),
    asphalt: std({ map: asphaltTex, roughness: 0.96 }),
    path: std({ color: 0xcbbda8, roughness: 0.95 }),
    curb: std({ color: 0x9a9186, roughness: 0.92 }),
    cycle: std({ color: 0x3d6e58, roughness: 0.9 }),
    bus: std({ color: 0x6a453c, roughness: 0.92 }),
    mark: std({ color: 0xf2efe6, roughness: 0.55 }),
    plaza: std({ map: plazaTex, roughness: 0.9 }),
    grass: std({ color: 0x6a8a4a, roughness: 1 }),
    water: std({
      color: 0x6a7460, roughness: 0.42, metalness: 0.04, transparent: true, opacity: 0.94,
    }),
    bridge: std({ color: 0x8d9298, roughness: 0.62, metalness: 0.2 }),
    glassHigh: std({
      map: glassTex('#7e9aab', '#d5dee4', '#5f727c'),
      color: 0xffffff, roughness: 0.22, metalness: 0.06, vertexColors: true,
    }),
    glassMid: std({
      map: glassTex('#8b9398', '#d7dce0', '#667077'),
      color: 0xffffff, roughness: 0.28, metalness: 0.05, vertexColors: true,
    }),
    glassDark: std({
      map: glassTex('#5a656c', '#c5ced4', '#3c444a'),
      color: 0xffffff, roughness: 0.32, metalness: 0.1, vertexColors: true,
    }),
    masonry: std({ map: paint, color: 0xffffff, roughness: 0.86, vertexColors: true }),
    brick: std({ map: brickTex, color: 0xffffff, roughness: 0.9, vertexColors: true }),
    metal: std({ map: metalTex, color: 0xffffff, roughness: 0.5, metalness: 0.32, vertexColors: true }),
    retail: std({
      map: punched('#e4d4ba', '#5d7c88'),
      color: 0xffffff, roughness: 0.82, vertexColors: true,
    }),
    plain: std({
      map: punched('#d2c4b0', '#6a7d88'),
      color: 0xffffff, roughness: 0.86, vertexColors: true,
    }),
    land: std({ map: landTex, roughness: 0.98 }),
    roof: std({ roughness: 0.9, vertexColors: true }),
    sandstone: std({ color: SANDSTONE, roughness: 0.88 }),
    copper: std({ color: 0x6e7d72, roughness: 0.45, metalness: 0.35 }),
    clock: std({ color: 0xf7f4ee, roughness: 0.4 }),
    clockRim: std({ color: 0x1c1c1c, roughness: 0.5 }),
    recess: std({ color: RECESS, roughness: 0.8 }),
    shop: std({ color: 0x6f8c98, roughness: 0.16, metalness: 0.08 }),
    fascia: std({ color: 0x6d6258, roughness: 0.72 }),
    awning: std({ color: 0xe6e1d8, roughness: 0.48, metalness: 0.22, emissive: 0x2e2c28, emissiveIntensity: 0.35 }),
    planter: std({ color: 0x8d8378, roughness: 0.9 }),
    foliage: std({ color: 0x3f6b3a, roughness: 0.85 }),
    bench: std({ color: 0x8a6244, roughness: 0.8 }),
    trunk: std({ color: 0x6b543c, roughness: 0.9 }),
    beacon: std({ color: 0xd23a32, emissive: 0x8a1c16, emissiveIntensity: 0.6, roughness: 0.4 }),
  };
}

export function tiledMesh(positions, material, tile) {
  const count = positions.length / 3;
  const uv = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    uv[i * 2] = positions[i * 3] / tile;
    uv[i * 2 + 1] = positions[i * 3 + 2] / tile;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}

function pushBox(positions, cx, cy, cz, sx, sy, sz, yaw) {
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const p = (x, y, z) => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
  const v = [
    p(-hx, -hy, -hz), p(hx, -hy, -hz), p(hx, hy, -hz), p(-hx, hy, -hz),
    p(-hx, -hy, hz), p(hx, -hy, hz), p(hx, hy, hz), p(-hx, hy, hz),
  ];
  const tris = [
    0, 1, 2, 0, 2, 3,
    4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1,
    3, 2, 6, 3, 6, 7,
    0, 3, 7, 0, 7, 4,
    1, 5, 6, 1, 6, 2,
  ];
  for (let i = 0; i < tris.length; i++) {
    const q = v[tris[i]];
    positions.push(q[0], q[1], q[2]);
  }
}

function ringContains(ring, x, z) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i], zi = ring[i + 1], xj = ring[j], zj = ring[j + 1];
    const denom = (zj - zi) || 0.00001;
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / denom + xi) inside = !inside;
  }
  return inside;
}

function blocked(buildings, x, z) {
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (!b.r || b.r.length < 6) continue;
    let cx = 0, cz = 0, n = 0;
    for (let k = 0; k < b.r.length; k += 2) { cx += b.r[k]; cz += b.r[k + 1]; n++; }
    cx /= n; cz /= n;
    if ((cx - x) ** 2 + (cz - z) ** 2 > 55 * 55) continue;
    if (ringContains(b.r, x, z)) return true;
  }
  return false;
}

export function closestMall(flat, x, z) {
  let best = Infinity, px = x, pz = z;
  for (let i = 0; i < flat.length; i += 2) {
    const d = (flat[i] - x) ** 2 + (flat[i + 1] - z) ** 2;
    if (d < best) { best = d; px = flat[i]; pz = flat[i + 1]; }
  }
  return { d: Math.sqrt(best), x: px, z: pz };
}

function closestOnSegments(flat, x, z) {
  let best = Infinity, px = x, pz = z;
  for (let i = 0; i < flat.length - 2; i += 2) {
    const ax = flat[i], az = flat[i + 1], bx = flat[i + 2], bz = flat[i + 3];
    if (!Number.isFinite(ax) || !Number.isFinite(az) || !Number.isFinite(bx) || !Number.isFinite(bz)) continue;
    const dx = bx - ax, dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    let t = ((x - ax) * dx + (z - az) * dz) / len2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const qx = ax + dx * t, qz = az + dz * t;
    const d = (x - qx) ** 2 + (z - qz) ** 2;
    if (d < best) { best = d; px = qx; pz = qz; }
  }
  return { d: Math.sqrt(best), x: px, z: pz };
}

export function streetEdge(ring, flat) {
  let best = Infinity;
  let edge = null;
  for (let i = 0; i < ring.length; i += 2) {
    const j = (i + 2) % ring.length;
    const x0 = ring[i], z0 = ring[i + 1], x1 = ring[j], z1 = ring[j + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 5) continue;
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    const hit = closestOnSegments(flat, mx, mz);
    if (hit.d < best) best = hit.d, edge = { x0, z0, x1, z1, mx, mz, len, hit };
  }
  return edge;
}

export function addMallFronts(group, buildings, mallFlat, hall, kit, groundAt, appleHost) {
  const candidates = [];
  for (const b of buildings) {
    if (b === appleHost || !b.r || b.r.length < 6 || (b.b || 0) > .5 || b.h < 4) continue;
    let cx = 0, cz = 0, n = 0;
    for (let i = 0; i < b.r.length; i += 2) { cx += b.r[i]; cz += b.r[i + 1]; n++; }
    cx /= n; cz /= n;
    if (hall && Math.hypot(cx - hall.cx, cz - hall.cz) < 20) continue;
    const edge = streetEdge(b.r, mallFlat);
    if (!edge || edge.hit.d > 18) continue;
    candidates.push({ ...edge, floor: b.g ?? groundAt(edge.mx, edge.mz) });
  }
  candidates.sort((a, b) => a.hit.d - b.hit.d);
  const glass = [];
  const awnings = [];
  const fascia = [];
  const trim = [];
  let fronts = 0;
  for (const edge of candidates) {
    if (fronts >= 200) break;
    const hit = edge.hit;
    const len = Math.min(edge.len, 48);
    let nx = -(edge.z1 - edge.z0) / edge.len;
    let nz = (edge.x1 - edge.x0) / edge.len;
    if ((hit.x - edge.mx) * nx + (hit.z - edge.mz) * nz < 0) { nx = -nx; nz = -nz; }
    const yaw = Math.atan2(nx, nz);
    const tx = Math.cos(yaw), tz = -Math.sin(yaw);
    const place = (buf, u, y, offset, w, h, d) => pushBox(
      buf, edge.mx + nx * offset + tx * u, edge.floor + y, edge.mz + nz * offset + tz * u,
      w, h, d, yaw,
    );
    place(glass, 0, 1.96, .10, len, 3.58, .16);
    place(fascia, 0, 3.92, .16, len, .31, .24);
    place(awnings, 0, 3.68, .50, len, .12, 1.04);
    place(trim, 0, 3.61, 1.02, len, .13, .07);
    place(trim, 0, 2.85, .195, len, .055, .055);
    place(fascia, 0, .29, .13, len, .26, .23);
    const bays = Math.max(2, Math.ceil(len / 2.8));
    for (let i = 0; i <= bays; i++) place(trim, (i / bays - .5) * (len - .10), 2.05, .194, .065, 3.35, .07);
    fronts++;
  }
  const add = (positions, material) => {
    if (!positions.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.userData.abs = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  add(glass, kit.shop);
  add(fascia, kit.fascia);
  add(awnings, kit.awning);
  add(trim, kit.clockRim);
  return fronts;
}

export function addMallFurniture(group, mallFlat, buildings, spawn, kit, groundAt) {
  let placed = 0;
  const pts = [];
  for (let i = 0; i < mallFlat.length; i += 2) pts.push([mallFlat[i], mallFlat[i + 1]]);
  let acc = 12;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dz = pts[i][1] - pts[i - 1][1];
    const seg = Math.hypot(dx, dz);
    if (seg < 0.05) continue;
    const step = 16;
    while (acc <= seg && placed < 28) {
      const t = acc / seg;
      const x = pts[i - 1][0] + dx * t;
      const z = pts[i - 1][1] + dz * t;
      const side = placed % 2 === 0 ? 1 : -1;
      const ox = (-dz / seg) * 3.2 * side;
      const oz = (dx / seg) * 3.2 * side;
      const px = x + ox, pz = z + oz;
      acc += step;
      if (Math.hypot(px - spawn.x, pz - spawn.z) < 9) continue;
      const corners = [-.8, .8].flatMap(x => [-.8, .8].map(z => [
        px + dz / seg * x + dx / seg * z, pz - dx / seg * x + dz / seg * z,
      ]));
      if (corners.some(([x, z]) => blocked(buildings, x, z) || Math.abs(groundAt(x, z) - groundAt(px, pz)) > .23)) continue;
      const planter = new THREE.Group();
      const yaw = Math.atan2(dx, dz);
      const base = groundAt(px, pz) + .05;
      const box = (w, h, d, y, material, offset = 0) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
        mesh.position.set(offset, y, 0);
        planter.add(mesh);
      };
      box(1.48, .74, 1.48, .13, kit.planter);
      box(1.55, .12, 1.55, .49, kit.curb);
      box(1.22, .025, 1.22, .559, kit.recess);
      for (const offset of [-.57, -.43, -.29]) box(.105, .055, 1.56, .58, kit.bench, offset * side);
      mergeStatic(planter);
      const tree = buildStreetTree(placed);
      tree.scale.setScalar(.55);
      tree.position.y = .57;
      planter.add(tree);
      planter.position.set(px, base, pz);
      planter.rotation.y = yaw;
      planter.userData.abs = true;
      group.add(planter);
      placed++;
    }
    acc -= seg;
  }
  return placed;
}

function addMesh(group, mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

// Tower apex is 92 m, the figure on the current Brisbane City Council City Hall page.
// Museum of Brisbane publishes 87.47 m for the same tower. The clock face is almost 5 m
// across (Brisbane City Council). Body height, tower plan, column count and column height
// are estimates read from the Kgbo photograph against that 92 m tower, not a measured survey.
const TOWER_TOP = 92;
const BODY = 22;

export function addCityHall(group, ring, cx, cz, buildings, kit, groundAt = () => 0) {
  // Adelaide Street (OSM way 198003875) lies to the east of this footprint, which is the
  // King George Square side. The public front faces that way.
  const dirx = 0.976;
  const dirz = -0.217;
  const dlen = Math.hypot(dirx, dirz);
  const fx = dirx / dlen, fz = dirz / dlen;
  const px = -fz, pz = fx;
  let front = -1e9;
  for (let i = 0; i < ring.length; i += 2) {
    const p = (ring[i] - cx) * fx + (ring[i + 1] - cz) * fz;
    if (p > front) front = p;
  }

  const stone = kit.sandstone;
  const tower = addMesh(group, new THREE.Mesh(new THREE.BoxGeometry(12, 62, 12), stone));
  tower.position.set(cx, BODY + 31, cz);
  const cap = addMesh(group, new THREE.Mesh(new THREE.BoxGeometry(16, 1.2, 16), stone));
  cap.position.set(cx, BODY + 0.4, cz);

  const dome = addMesh(group, new THREE.Mesh(
    new THREE.SphereGeometry(6.1, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    kit.copper,
  ));
  dome.position.set(cx, 84, cz);
  const spire = addMesh(group, new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.7, 6.2, 8), kit.copper));
  spire.position.set(cx, 89, cz);
  const beacon = addMesh(group, new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), kit.beacon));
  beacon.position.set(cx, TOWER_TOP - 0.4, cz);

  const dial = canvasTex(256, (g, size) => {
    const center = size / 2;
    g.translate(center, center);
    g.fillStyle = '#f3e8cd';
    g.fillRect(-center, -center, size, size);
    g.fillStyle = '#363536';
    for (let i = 0; i < 60; i++) {
      const hour = i % 5 === 0;
      g.fillRect(hour ? -2.3 : -1, -116, hour ? 4.6 : 2, hour ? 15 : 6);
      g.rotate(Math.PI / 30);
    }
    const hand = (angle, length, width) => {
      g.save();
      g.rotate(angle);
      g.fillRect(-width / 2, -length, width, length + 12);
      g.restore();
    };
    hand(Math.PI / 3, 62, 7);
    hand(-Math.PI / 3, 90, 4);
    g.beginPath();
    g.arc(0, 0, 6, 0, Math.PI * 2);
    g.fill();
  });
  const dialMaterial = std({ map: dial, roughness: .5 });
  const faces = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [sx, sz] of faces) {
    const ox = sx * 6.05, oz = sz * 6.05;
    const clock = addMesh(group, new THREE.Mesh(new THREE.CircleGeometry(2.4, 28), dialMaterial));
    clock.position.set(cx + ox, 64, cz + oz);
    clock.lookAt(cx + ox * 2, 64, cz + oz * 2);
    const rim = addMesh(group, new THREE.Mesh(new THREE.RingGeometry(2.15, 2.5, 28), kit.clockRim));
    rim.position.set(cx + sx * 6.067, 64, cz + sz * 6.067);
    rim.lookAt(cx + ox * 2, 64, cz + oz * 2);
    const opening = addMesh(group, new THREE.Mesh(new THREE.BoxGeometry(
      Math.abs(sx) > 0 ? 0.4 : 3.2,
      4.2,
      Math.abs(sz) > 0 ? 0.4 : 3.2,
    ), kit.recess));
    opening.position.set(cx + sx * 5.8, 76, cz + sz * 5.8);
  }

  const yaw = Math.atan2(fx, fz);
  const columnCount = 8;
  const span = 28;
  for (let i = 0; i < columnCount; i++) {
    const u = -span / 2 + (span / (columnCount - 1)) * i;
    const x = cx + px * u + fx * (front + 0.8);
    const z = cz + pz * u + fz * (front + 0.8);
    const col = addMesh(group, new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 12.6, 10), stone));
    col.position.set(x, 7.5, z);
    const foot = groundAt(x, z) - groundAt(cx, cz) - .12;
    if (foot < 1.36) {
      const plinth = addMesh(group, new THREE.Mesh(new THREE.BoxGeometry(1.38, 1.36 - foot, 1.38), stone));
      plinth.position.set(x, (1.36 + foot) / 2, z);
      plinth.rotation.y = yaw;
    }
    const capital = addMesh(group, new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.5, 0.55, 10), stone));
    capital.position.set(x, 13.9, z);
  }
  const entab = addMesh(group, new THREE.Mesh(new THREE.BoxGeometry(span + 2.4, 1.35, 2.4), stone));
  entab.position.set(cx + fx * (front + 0.8), 15.0, cz + fz * (front + 0.8));
  entab.rotation.y = yaw;

  const shape = new THREE.Shape();
  shape.moveTo(-span / 2 - 0.6, 0);
  shape.lineTo(span / 2 + 0.6, 0);
  shape.lineTo(0, 5.4);
  const pedGeo = new THREE.ExtrudeGeometry(shape, { depth: 2.6, bevelEnabled: false });
  pedGeo.translate(0, 0, -1.3);
  const ped = addMesh(group, new THREE.Mesh(pedGeo, stone));
  ped.position.set(cx + fx * (front + 0.8), 15.6, cz + fz * (front + 0.8));
  ped.rotation.y = yaw;

  const door = addMesh(group, new THREE.Mesh(new THREE.BoxGeometry(5.2, 4.6, 0.5), kit.recess));
  door.position.set(cx + fx * (front + 0.35), 3.4, cz + fz * (front + 0.35));
  door.rotation.y = yaw;

  // Four entrance steps. The count and the 18 cm rise are estimated from the
  // Kgbo photograph, not a measured stair survey.
  for (let i = 0; i < 4; i++) {
    const rise = 0.18;
    const tread = 1.35;
    const out = 1.15 + i * tread;
    const step = addMesh(group, new THREE.Mesh(new THREE.BoxGeometry(span + 3.2, rise, tread), stone));
    const x = cx + fx * (front + .8 + out), z = cz + fz * (front + .8 + out);
    const top = rise * (4 - i);
    const base = Math.min(top - rise, ...[-1, 0, 1].map(side =>
      groundAt(x + side * px * (span + 3.2) / 2, z + side * pz * (span + 3.2) / 2) - groundAt(cx, cz) - .16));
    step.position.set(x, (top + base) / 2, z);
    step.scale.y = (top - base) / rise;
    step.rotation.y = yaw;
  }

  // Recesses and stone mouldings follow each real footprint edge.
  const wings = new THREE.Group();
  let area = 0;
  for (let i = 0; i < ring.length; i += 2) {
    const j = (i + 2) % ring.length;
    area += ring[i] * ring[j + 1] - ring[j] * ring[i + 1];
  }
  for (let i = 0; i < ring.length; i += 2) {
    const j = (i + 2) % ring.length, x0 = ring[i], z0 = ring[i + 1];
    const dx = ring[j] - x0, dz = ring[j + 1] - z0, len = Math.hypot(dx, dz);
    if (len < 4.3) continue;
    const sign = area > 0 ? 1 : -1;
    const nx = dz / len * sign, nz = -dx / len * sign;
    const wallYaw = Math.atan2(nx, nz);
    const piece = (u, y, offset, w, h, d, material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x0 - cx + dx / len * u + nx * offset, y, z0 - cz + dz / len * u + nz * offset);
      mesh.rotation.y = wallYaw;
      wings.add(mesh);
    };
    piece(len / 2, 20.55, .08, len - .04, .55, .40, stone);
    piece(len / 2, 21.25, .14, len - .04, .21, .44, stone);
    piece(len / 2, 5.86, .05, len - .06, .26, .29, stone);
    const bays = Math.floor(len / 3.65);
    for (let k = 0; k < bays; k++) {
      const u = (k + .5) * len / bays;
      const x = x0 - cx + dx / len * u, z = z0 - cz + dz / len * u;
      if (x * fx + z * fz > front - 3.5 && Math.abs(x * px + z * pz) < 15.5) continue;
      for (const y of [8.3, 14.5]) {
        piece(u, y, .055, 1.48, 2.55, .15, kit.recess);
        piece(u, y, .14, .055, 2.36, .06, stone);
        piece(u, y + .19, .14, 1.37, .055, .06, stone);
        piece(u, y - 1.29, .15, 1.72, .15, .34, stone);
        piece(u, y + 1.28, .13, 1.70, .22, .31, stone);
      }
    }
  }
  mergeStatic(wings);
  wings.position.set(cx, 0, cz);
  group.add(wings);

  // Plaza extent is the gap from this front to Adelaide Street, not a surveyed square polygon.
  const depth = 48;
  const width = 70;
  const y = 0.08;
  const corner = (u, v) => [
    cx + px * u + fx * (front + v),
    y,
    cz + pz * u + fz * (front + v),
  ];
  const a = corner(-width / 2, 2);
  const b = corner(width / 2, 2);
  const c = corner(width / 2, depth);
  const d = corner(-width / 2, depth);
  // Sample the actual ground throughout the plaza, not one elevation at the
  // centre of City Hall. The enclosing withLift adds the building datum once.
  const datum = groundAt(cx,cz), plazaPos=[];
  drapePolygon(plazaPos,[a[0],a[2],b[0],b[2],c[0],c[2],d[0],d[2]],(x,z)=>groundAt(x,z)-datum+.08,2);
  const plaza=tiledMesh(plazaPos,kit.plaza,2.4);plaza.name='Grounded City Hall plaza';group.add(plaza);

  let palms = 0;
  for (const u of [-width / 2 + 4, width / 2 - 4]) {
    for (const v of [10, 20, 30, 40]) {
      const x = cx + px * u + fx * (front + v);
      const z = cz + pz * u + fz * (front + v);
      if (blocked(buildings, x, z)) continue;
      const palm=buildStreetTree(palms,true);palm.position.set(x,groundAt(x,z)-datum,z);group.add(palm);
      palms++;
    }
  }
  return { body: BODY, tower: TOWER_TOP, front, palms, plaza, dispose: () => { dial.dispose(); dialMaterial.dispose(); } };
}

// Glass shade roofs along Queen Street. The mall photos show covered sections and open sky,
// so these are separate bays, not one tunnel. The steel-and-glass form is modelled from that
// public structure. Shop names in those photos are not reproduced.
export function addMallCanopy(group, mallFlat, buildings, groundAt) {
  const steel = std({ color: 0xf3f5f7, roughness: 0.32, metalness: 0.28 });
  const glass = std({
    color: 0xd5e4ea, roughness: 0.06, metalness: 0.08,
    transparent: true, opacity: 0.38, depthWrite: false,
  });
  const pts = [];
  for (let i = 0; i < mallFlat.length; i += 2) pts.push([mallFlat[i], mallFlat[i + 1]]);
  let acc = 24;
  let bays = 0;
  for (let i = 1; i < pts.length && bays < 8; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dz = pts[i][1] - pts[i - 1][1];
    const seg = Math.hypot(dx, dz);
    if (seg < 0.05) continue;
    while (acc <= seg && bays < 8) {
      const t = acc / seg;
      const x = pts[i - 1][0] + dx * t;
      const z = pts[i - 1][1] + dz * t;
      acc += 52;
      if (blocked(buildings, x, z)) continue;
      const yaw = Math.atan2(dx, dz);
      const bay = new THREE.Group();
      const feet = [-4.2, 4.2].flatMap(sx => [-6.2, 6.2].map(sz => ({
        sx, sz, x: x + Math.cos(yaw) * sx + Math.sin(yaw) * sz,
        z: z - Math.sin(yaw) * sx + Math.cos(yaw) * sz,
      })));
      if (feet.some(p => blocked(buildings, p.x, p.z))) continue;
      const y = groundAt(x, z);
      const frame = new THREE.Group();
      for (const p of feet) {
        const foot = groundAt(p.x, p.z) - y - .12;
        const height = 6.02 - foot;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(.11, .15, height, 10), steel);
        post.position.set(p.sx, foot + height / 2, p.sz);
        frame.add(post);
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(.21, .24, .25, 10), steel);
        collar.position.set(p.sx, foot + .19, p.sz);
        frame.add(collar);
      }
      for (const side of [-1, 1]) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.05, 13.2), glass);
        panel.position.set(side * 2.15, 6.35, 0);
        panel.rotation.z = side * -0.16;
        bay.add(panel);
      }
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 13.4), steel);
      ridge.position.set(0, 6.72, 0);
      frame.add(ridge);
      for (const side of [-1, 1]) {
        const eave = new THREE.Mesh(new THREE.BoxGeometry(.13, .15, 13.3), steel);
        eave.position.set(side * 4.24, 5.94, 0);
        frame.add(eave);
        for (const z of [-6.4, -3.2, 0, 3.2, 6.4]) {
          const rib = new THREE.Mesh(new THREE.BoxGeometry(4.42, .09, .12), steel);
          rib.position.set(side * 2.15, 6.29, z);
          rib.rotation.z = side * -.16;
          frame.add(rib);
        }
      }
      mergeStatic(frame);
      bay.add(frame);
      bay.position.set(x, y, z);
      bay.rotation.y = yaw;
      bay.userData.abs = true;
      group.add(bay);
      bays++;
    }
    acc -= seg;
  }
  return bays;
}
