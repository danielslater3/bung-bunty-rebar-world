// Queen Street Mall and City Hall. Geography stays on the OpenStreetMap footprints.
// Facades are materials and massing, not roof pixels and not the orthophoto.
// Estimates are named in the comments. Published figures are named with their source.
import * as THREE from 'three';

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
  const mallTex = canvasTex(128, (g) => {
    g.fillStyle = '#5c574f';
    g.fillRect(0, 0, 128, 128);
    const tones = ['#b7b1a6', '#c8c2b6', '#aea89d', '#d0c9bd'];
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        g.fillStyle = tones[(x + y) % tones.length];
        g.fillRect(x * 64 + 5, y * 64 + 5, 54, 54);
      }
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
  const asphaltTex = canvasTex(64, (g) => {
    g.fillStyle = '#3c4148';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#32373d';
    for (let i = 0; i < 80; i++) g.fillRect((i * 17) % 64, (i * 29) % 64, 2, 1);
    g.fillStyle = '#4a5158';
    for (let i = 0; i < 40; i++) g.fillRect((i * 23) % 64, (i * 11) % 64, 1, 1);
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

export function addMallFronts(group, buildings, mallFlat, hall, kit) {
  const candidates = [];
  for (const b of buildings) {
    if (!b.r || b.r.length < 6) continue;
    let cx = 0, cz = 0, n = 0;
    for (let i = 0; i < b.r.length; i += 2) { cx += b.r[i]; cz += b.r[i + 1]; n++; }
    cx /= n; cz /= n;
    if (hall && Math.hypot(cx - hall.cx, cz - hall.cz) < 20) continue;
    const edge = streetEdge(b.r, mallFlat);
    if (!edge || edge.hit.d > 18) continue;
    candidates.push(edge);
  }
  candidates.sort((a, b) => a.hit.d - b.hit.d);
  const glass = [];
  const awnings = [];
  const fascia = [];
  let fronts = 0;
  for (const edge of candidates) {
    if (fronts >= 200) break;
    const hit = edge.hit;
    const len = Math.min(edge.len, 48);
    let nx = -(edge.z1 - edge.z0) / edge.len;
    let nz = (edge.x1 - edge.x0) / edge.len;
    if ((hit.x - edge.mx) * nx + (hit.z - edge.mz) * nz < 0) { nx = -nx; nz = -nz; }
    const yaw = Math.atan2(nx, nz);
    pushBox(glass, edge.mx + nx * 0.22, 2.05, edge.mz + nz * 0.22, len, 3.7, 0.34, yaw);
    pushBox(fascia, edge.mx + nx * 0.16, 3.95, edge.mz + nz * 0.16, len, 0.28, 0.22, yaw);
    pushBox(awnings, edge.mx + nx * 0.62, 3.72, edge.mz + nz * 0.62, len, 0.07, 0.85, yaw);
    fronts++;
  }
  const add = (positions, material) => {
    if (!positions.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  add(glass, kit.shop);
  add(fascia, kit.fascia);
  add(awnings, kit.awning);
  return fronts;
}

// Ground-floor glass on retail and commercial buildings that face a road.
// The Queen Street mall pass already covers the mall edges.
export function addDistrictFronts(group, buildings, roads, mallFlat, hall, kit) {
  const CELL = 56;
  const buckets = new Map();
  for (const road of roads) {
    if (road.py || !road.p) continue;
    const p = road.p;
    for (let i = 0; i + 3 < p.length; i += 2) {
      const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3];
      const key = `${Math.floor((ax + bx) / 2 / CELL)},${Math.floor((az + bz) / 2 / CELL)}`;
      let segs = buckets.get(key);
      if (!segs) buckets.set(key, segs = []);
      segs.push(ax, az, bx, bz);
    }
  }
  const nearby = (x, z) => {
    const ix = Math.floor(x / CELL), iz = Math.floor(z / CELL);
    const out = [];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const segs = buckets.get(`${ix + dx},${iz + dz}`);
        if (segs) out.push(segs);
      }
    }
    return out;
  };
  const distSeg = (segs, x, z) => {
    let best = Infinity;
    for (let s = 0; s < segs.length; s += 4) {
      const ax = segs[s], az = segs[s + 1], bx = segs[s + 2], bz = segs[s + 3];
      const dx = bx - ax, dz = bz - az;
      const len2 = dx * dx + dz * dz || 1;
      let t = ((x - ax) * dx + (z - az) * dz) / len2;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
      const d = (x - (ax + dx * t)) ** 2 + (z - (az + dz * t)) ** 2;
      if (d < best) best = d;
    }
    return best;
  };
  const RETAIL = 0xc45a4a;
  const COMMERCIAL = 0xb7b1a4;
  const glass = [];
  const awnings = [];
  let fronts = 0;
  for (const b of buildings) {
    if (!b.r || b.r.length < 6 || b.h >= 36) continue;
    if (b.c !== RETAIL && b.c !== COMMERCIAL) continue;
    let cx = 0, cz = 0, n = 0;
    for (let i = 0; i < b.r.length; i += 2) { cx += b.r[i]; cz += b.r[i + 1]; n++; }
    cx /= n; cz /= n;
    if (hall && Math.hypot(cx - hall.cx, cz - hall.cz) < 20) continue;
    if (closestMall(mallFlat, cx, cz).d < 18) continue;
    let best = null;
    let bestD = 14 * 14;
    for (let i = 0; i < b.r.length; i += 2) {
      const j = (i + 2) % b.r.length;
      const x0 = b.r[i], z0 = b.r[i + 1], x1 = b.r[j], z1 = b.r[j + 1];
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 4) continue;
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      let d = Infinity;
      for (const segs of nearby(mx, mz)) d = Math.min(d, distSeg(segs, mx, mz));
      if (d < bestD) { bestD = d; best = { x0, z0, x1, z1, mx, mz, len }; }
    }
    if (!best) continue;
    const len = Math.min(best.len, 28);
    let nx = -(best.z1 - best.z0) / best.len;
    let nz = (best.x1 - best.x0) / best.len;
    if ((cx - best.mx) * nx + (cz - best.mz) * nz > 0) { nx = -nx; nz = -nz; }
    const yaw = Math.atan2(nx, nz);
    pushBox(glass, best.mx + nx * 0.2, 1.9, best.mz + nz * 0.2, len, 3.2, 0.28, yaw);
    pushBox(awnings, best.mx + nx * 0.55, 3.55, best.mz + nz * 0.55, len, 0.07, 0.7, yaw);
    fronts++;
  }
  const add = (positions, material) => {
    if (!positions.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  add(glass, kit.shop);
  add(awnings, kit.awning);
  return fronts;
}

export function addMallFurniture(group, mallFlat, buildings, spawn, kit) {
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
      if (blocked(buildings, px, pz)) continue;
      const pot = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 1.5), kit.planter);
      pot.position.set(px, 0.28, pz);
      pot.castShadow = true;
      pot.receiveShadow = true;
      group.add(pot);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.6, 6), kit.trunk);
      trunk.position.set(px, 1.3, pz);
      group.add(trunk);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.85, 8, 6), kit.foliage);
      crown.position.set(px, 2.35, pz);
      crown.castShadow = true;
      group.add(crown);
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

export function addCityHall(group, ring, cx, cz, buildings, kit) {
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

  const faces = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [sx, sz] of faces) {
    const ox = sx * 6.05, oz = sz * 6.05;
    const clock = addMesh(group, new THREE.Mesh(new THREE.CircleGeometry(2.4, 28), kit.clock));
    clock.position.set(cx + ox, 64, cz + oz);
    clock.lookAt(cx + ox * 2, 64, cz + oz * 2);
    const rim = addMesh(group, new THREE.Mesh(new THREE.RingGeometry(2.15, 2.5, 28), kit.clockRim));
    rim.position.copy(clock.position);
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
    step.position.set(cx + fx * (front + 0.8 + out), rise * (4 - i) - rise / 2, cz + fz * (front + 0.8 + out));
    step.rotation.y = yaw;
  }

  // Wing windows are not placed on a single plane. The real footprint steps,
  // and a flat row of recesses was floating off the walls.

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
  const plazaPos = [...a, ...b, ...c, ...a, ...c, ...d];
  group.add(tiledMesh(plazaPos, kit.plaza, 2.4));

  let palms = 0;
  for (const u of [-width / 2 + 4, width / 2 - 4]) {
    for (const v of [10, 20, 30, 40]) {
      const x = cx + px * u + fx * (front + v);
      const z = cz + pz * u + fz * (front + v);
      if (blocked(buildings, x, z)) continue;
      const trunk = addMesh(group, new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 6.2, 6), kit.trunk));
      trunk.position.set(x, 3.1, z);
      const crown = addMesh(group, new THREE.Mesh(new THREE.SphereGeometry(1.35, 8, 6), kit.foliage));
      crown.position.set(x, 6.5, z);
      palms++;
    }
  }
  return { body: BODY, tower: TOWER_TOP, front, palms };
}

// Glass shade roofs along Queen Street. The mall photos show covered sections and open sky,
// so these are separate bays, not one tunnel. The steel-and-glass form is modelled from that
// public structure. Shop names in those photos are not reproduced.
export function addMallCanopy(group, mallFlat, buildings) {
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
      bay.position.set(x, 0, z);
      bay.rotation.y = yaw;
      for (const sx of [-4.2, 4.2]) {
        for (const sz of [-6.2, 6.2]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 6.2, 8), steel);
          post.position.set(sx, 3.1, sz);
          post.castShadow = true;
          bay.add(post);
        }
      }
      for (const side of [-1, 1]) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.05, 13.2), glass);
        panel.position.set(side * 2.15, 6.35, 0);
        panel.rotation.z = side * -0.16;
        bay.add(panel);
      }
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 13.4), steel);
      ridge.position.set(0, 6.72, 0);
      bay.add(ridge);
      for (const sz of [-6.4, 0, 6.4]) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.1, 0.12), steel);
        rib.position.set(0, 6.45, sz);
        bay.add(rib);
      }
      group.add(bay);
      bays++;
    }
    acc -= seg;
  }
  return bays;
}
