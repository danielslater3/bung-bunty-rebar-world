// Every mapped shop and food venue in the district, on the wall nearest its node.
// Chain lettering is a stand-in. Other names are the OpenStreetMap name.
import * as THREE from 'three';
import { SHOPS } from './brisbane.shops.js';

const COLS = 10;
const ROWS = 16;
const CW = 256;
const CH = 72;

function ringContains(ring, x, z) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i], zi = ring[i + 1], xj = ring[j], zj = ring[j + 1];
    const denom = zj - zi;
    if (!denom) continue;
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / denom + xi) inside = !inside;
  }
  return inside;
}

function ringArea(ring) {
  let a = 0;
  for (let i = 0; i < ring.length; i += 2) {
    const j = (i + 2) % ring.length;
    a += ring[i] * ring[j + 1] - ring[j] * ring[i + 1];
  }
  return Math.abs(a) * 0.5;
}

function closestEdge(ring, x, z) {
  const pts = [];
  for (let i = 0; i < ring.length; i += 2) pts.push([ring[i], ring[i + 1]]);
  if (pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.5) pts.pop();
  if (pts.length < 3) return null;
  let cx = 0, cz = 0;
  for (const p of pts) { cx += p[0]; cz += p[1]; }
  cx /= pts.length; cz /= pts.length;
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len2 = dx * dx + dz * dz, length = Math.sqrt(len2);
    if (length < 2.8) continue;
    const width = Math.min(3.7, length - .28);
    const margin = (width / 2 + .10) / length;
    let t = ((x - a[0]) * dx + (z - a[1]) * dz) / len2;
    t = Math.max(margin, Math.min(1 - margin, t));
    const qx = a[0] + dx * t, qz = a[1] + dz * t;
    const d = (x - qx) ** 2 + (z - qz) ** 2;
    if (d >= bestD) continue;
    bestD = d;
    let nx = -dz, nz = dx;
    const nlen = Math.hypot(nx, nz) || 1;
    nx /= nlen; nz /= nlen;
    if ((cx - qx) * nx + (cz - qz) * nz > 0) { nx = -nx; nz = -nz; }
    best = { x: qx, z: qz, nx, nz, tx: dx / length, tz: dz / length,
      d: Math.sqrt(d), width, lo: (margin - t) * length, hi: (1 - margin - t) * length };
  }
  return best;
}

function indexBuildings(buildings) {
  const cell = 48;
  const buckets = new Map();
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (!b.r || b.r.length < 6) continue;
    let x = 0, z = 0, n = 0;
    for (let k = 0; k < b.r.length; k += 2) { x += b.r[k]; z += b.r[k + 1]; n++; }
    x /= n; z /= n;
    const rec = { r: b.r, h: b.h, g: b.g, b: b.b, x, z, area: ringArea(b.r) };
    const key = `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
    let arr = buckets.get(key);
    if (!arr) buckets.set(key, arr = []);
    arr.push(rec);
  }
  return { buckets, cell };
}

function candidates(index, x, z) {
  const { buckets, cell } = index;
  const ix = Math.floor(x / cell), iz = Math.floor(z / cell);
  const out = [];
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      const arr = buckets.get(`${ix + dx},${iz + dz}`);
      if (arr) out.push(...arr);
    }
  }
  return out;
}

function hostFor(index, x, z) {
  const list = candidates(index, x, z);
  let contained = null;
  let containedD = Infinity;
  let nearest = null;
  let nearestD = 18 * 18;
  for (const rec of list) {
    const d2 = (rec.x - x) ** 2 + (rec.z - z) ** 2;
    if (d2 < nearestD) { nearestD = d2; nearest = rec; }
    if (d2 > 110 * 110 || !ringContains(rec.r, x, z)) continue;
    if (d2 < containedD) { containedD = d2; contained = rec; }
  }
  return contained || nearest;
}

function paintCell(g, x, y, shop) {
  g.fillStyle = shop[3];
  g.fillRect(x, y, CW, CH);
  g.strokeStyle = shop[4];
  g.globalAlpha = .35;
  g.lineWidth = 2;
  g.strokeRect(x + 5, y + 5, CW - 10, CH - 10);
  g.globalAlpha = 1;
  g.fillStyle = shop[4];
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const label = shop[0] === 'McREBARS' ? 'McREBAR' : shop[0];
  let size = 37;
  g.font = `800 ${size}px Arial, sans-serif`;
  while (size > 11 && g.measureText(label).width > CW - 16) {
    size -= 2;
    g.font = `800 ${size}px Arial, sans-serif`;
  }
  g.fillText(label, x + CW / 2, y + CH / 2 + 1);
}

function pushSign(positions, uvs, px, py, pz, nx, nz, width, u0, v0, u1, v1) {
  const yaw = Math.atan2(nx, nz);
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const hw = width / 2, hy = .40;
  const p = (x, y, z) => [px + x * c + z * s, py + y, pz - x * s + z * c];
  const v = [p(-hw, -hy, 0.04), p(hw, -hy, 0.04), p(hw, hy, 0.04), p(-hw, hy, 0.04)];
  const uv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  const order = [0, 1, 2, 0, 2, 3];
  for (const i of order) {
    positions.push(v[i][0], v[i][1], v[i][2]);
    uvs.push(uv[i][0], uv[i][1]);
  }
}

export function layoutShopSigns(buildings, anchors, groundAt) {
  const index = indexBuildings(buildings);
  const placed = [];
  for (const shop of SHOPS) {
    const [name, x, z] = shop;
    if (anchors.some(a => {
      const d = Math.hypot(a.x - x, a.z - z);
      return d < 2 || (a.name.toLowerCase() === (name === 'McREBARS' ? 'mcrebar' : name.toLowerCase()) && d < 28);
    })) continue;
    const host = hostFor(index, x, z);
    if (!host) continue;
    const edge = closestEdge(host.r, x, z);
    if (!edge || edge.d > 24) continue;
    for (const width of [edge.width, edge.width * .8, edge.width * .65]) {
      const margin = (edge.width - width) / 2;
      const step = width + .14;
      const offset = [0, -step, step, -2 * step, 2 * step].find(d => {
        if (d < edge.lo - margin || d > edge.hi + margin) return false;
        const sx = edge.x + edge.tx * d, sz = edge.z + edge.tz * d;
        return !placed.some(p =>
          p.nx * edge.nx + p.nz * edge.nz > .85 &&
          Math.abs((p.x - sx) * edge.nx + (p.z - sz) * edge.nz - .40) < .45 &&
          Math.abs((p.x - sx) * edge.tx + (p.z - sz) * edge.tz) < (p.width + width) / 2 + .14);
      });
      if (offset == null) continue;
      const sx = edge.x + edge.tx * offset, sz = edge.z + edge.tz * offset;
      const height = host.h >= 6 ? 4.43 : Math.max(1.2, host.h * .62);
      const y = (host.g ?? groundAt(sx, sz)) + (host.b || 0) + height;
      placed.push({ shop, x: sx + edge.nx * .40, y, z: sz + edge.nz * .40, nx: edge.nx, nz: edge.nz, width });
      break;
    }
  }
  return placed;
}

export function dressShops(group, buildings, anchors, groundAt) {
  const placed = layoutShopSigns(buildings, anchors, groundAt);
  const per = COLS * ROWS;
  for (let start = 0; start < placed.length; start += per) {
    const slice = placed.slice(start, start + per);
    const canvas = document.createElement('canvas');
    canvas.width = COLS * CW;
    canvas.height = ROWS * CH;
    const g = canvas.getContext('2d');
    const positions = [];
    const uvs = [];
    slice.forEach((item, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      paintCell(g, col * CW, row * CH, item.shop);
      const u0 = (col * CW + 2) / canvas.width;
      const u1 = ((col + 1) * CW - 2) / canvas.width;
      const v1 = 1 - (row * CH + 2) / canvas.height;
      const v0 = 1 - ((row + 1) * CH - 2) / canvas.height;
      pushSign(positions, uvs, item.x, item.y, item.z, item.nx, item.nz, item.width, u0, v0, u1, v1);
    });
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.6, metalness: 0, side: THREE.DoubleSide,
      emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.18,
    }));
    mesh.name = 'Mapped shop signs';
    mesh.userData.signs = slice;
    mesh.userData.abs = true;
    mesh.userData.dispose = () => { tex.dispose(); mesh.material.dispose(); };
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return placed.length;
}
