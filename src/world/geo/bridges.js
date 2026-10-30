// Bridge superstructure on the mapped decks.
// Deck height follows the compiled terrain/clearance profile used by collision.
// Neville Bonner is the white cable-stayed bridge in the aerial view.
// Victoria is built as the concrete road bridge. OSM tags that polygon "arch".
// Story Bridge is a steel cantilever; OSM tags the way "suspension".
// William Jolly is the concrete arch bridge. Kurilpa's masts are a simplified
// reading of the tensegrity bridge, not a member-by-member model.
import * as THREE from 'three';
import { deckProfile } from '/src/world/geo/drape.js';

function std(color, rough, metal = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

const CONCRETE = new THREE.MeshStandardMaterial({
  color: 0xd5d7d2, roughness: 0.8, emissive: 0x323432, emissiveIntensity: 0.2,
});
const PARAPET = std(0xd9dbd6, 0.62);
const PIER = std(0x9ea19c, 0.84);
const STEEL = std(0x8e9398, 0.45, 0.35);
const WHITE = std(0xf2f4f6, 0.38, 0.2);
const CABLE = std(0xf7f8f8, 0.25, 0.55);
const LANE = std(0xf4f5f2, 0.48);

function pushBox(buf, cx, cy, cz, sx, sy, sz, yaw) {
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const p = (x, y, z) => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
  const v = [
    p(-hx, -hy, -hz), p(hx, -hy, -hz), p(hx, hy, -hz), p(-hx, hy, -hz),
    p(-hx, -hy, hz), p(hx, -hy, hz), p(hx, hy, hz), p(-hx, hy, hz),
  ];
  const tris = [
    0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7,
    0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2,
  ];
  for (let i = 0; i < tris.length; i++) {
    const q = v[tris[i]];
    buf.push(q[0], q[1], q[2]);
  }
}

// A continuous sloping prism, with both ends meeting the sampled deck profile.
// Batched into the existing material buffers (no per-segment draw calls).
function pushBeam(buf, a, b, width, height) {
  const dx = b[0] - a[0], dz = b[2] - a[2], len = Math.hypot(dx, dz);
  if (len < 0.001) return;
  const nx = -dz / len * width / 2, nz = dx / len * width / 2;
  const v = [];
  for (const p of [a, b]) for (const y of [-height / 2, height / 2]) {
    v.push([p[0] - nx, p[1] + y, p[2] - nz], [p[0] + nx, p[1] + y, p[2] + nz]);
  }
  for (const i of [0,2,1,1,2,3,4,5,6,5,7,6,0,4,2,2,4,6,1,3,5,3,7,5,2,6,3,3,6,7,0,1,4,1,5,4]) buf.push(...v[i]);
}

function flush(group, buf, material) {
  if (!buf.length) return;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(buf, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
}

function ringPts(ring) {
  const pts = [];
  for (let i = 0; i < ring.length; i += 2) pts.push([ring[i], ring[i + 1]]);
  if (pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1) pts.pop();
  return pts;
}

function axisOf(pts) {
  let best = 0;
  let a = 0;
  let b = 1;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = (pts[i][0] - pts[j][0]) ** 2 + (pts[i][1] - pts[j][1]) ** 2;
      if (d > best) { best = d; a = i; b = j; }
    }
  }
  const ax = pts[a][0], az = pts[a][1], bx = pts[b][0], bz = pts[b][1];
  const len = Math.sqrt(best) || 1;
  return {
    ax, az, bx, bz, len,
    dx: (bx - ax) / len, dz: (bz - az) / len,
    yaw: Math.atan2(bx - ax, bz - az),
  };
}

function along(axis, t) {
  return [axis.ax + (axis.bx - axis.ax) * t, axis.az + (axis.bz - axis.az) * t];
}

function centerAxis(pts) {
  const raw = axisOf(pts);
  let cx = 0;
  let cz = 0;
  for (const p of pts) { cx += p[0]; cz += p[1]; }
  cx /= pts.length;
  cz /= pts.length;
  const half = raw.len * 0.42;
  return {
    ax: cx - raw.dx * half, az: cz - raw.dz * half,
    bx: cx + raw.dx * half, bz: cz + raw.dz * half,
    dx: raw.dx, dz: raw.dz, len: half * 2, yaw: raw.yaw,
  };
}

function cable(group, x, y0, z, px, py, pz, radius = 0.055) {
  const dir = new THREE.Vector3(px - x, py - y0, pz - z);
  const len = dir.length();
  if (len < 0.5) return;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 5), CABLE);
  mesh.position.set((x + px) / 2, (y0 + py) / 2, (z + pz) / 2);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.multiplyScalar(1 / len));
  mesh.castShadow = true;
  group.add(mesh);
}

function fan(group, ox, oy, oz, deckY, axis, from, to, n, radius) {
  for (let i = 0; i < n; i++) {
    const t = from + (to - from) * (i / Math.max(1, n - 1));
    const [px, pz] = along(axis, t);
    cable(group, ox, oy, oz, px, deckY, pz, radius);
  }
}

function leanedMast(group, x, z, yaw, lateral, deckY, height, lean) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.55, height, 2.5), WHITE);
  const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const qLean = new THREE.Quaternion().setFromAxisAngle(lateral, lean);
  mesh.quaternion.copy(qLean).multiply(qYaw);
  const base = new THREE.Vector3(0, -height / 2, 0).applyQuaternion(mesh.quaternion);
  mesh.position.set(x - base.x, deckY - base.y, z - base.z);
  mesh.castShadow = true;
  group.add(mesh);
  const tip = new THREE.Vector3(0, height * 0.46, 0).applyQuaternion(mesh.quaternion);
  return mesh.position.clone().add(tip);
}

function cables(group, x, z, top, deckY, axis, from, to, n) {
  for (let i = 0; i < n; i++) {
    const t = from + (to - from) * (i / Math.max(1, n - 1));
    const [px, pz] = along(axis, t);
    cable(group, x, top, z, px, deckY, pz);
  }
}

function pylon(buf, x, z, yaw, deckY, height, lean) {
  const meshY = deckY + height * 0.42;
  pushBox(buf, x, meshY, z, 1.15, height, 1.7, yaw);
  return deckY + height * 0.86;
}

function pointInRing(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], zi = pts[i][1];
    const xj = pts[j][0], zj = pts[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / ((zj - zi) || 1e-9) + xi) inside = !inside;
  }
  return inside;
}

export function bridgeDeckList(bridges) {
  const decks = [];
  for (const bridge of bridges || []) {
    if (!bridge.ring || bridge.ring.length < 8) continue;
    const pts = ringPts(bridge.ring);
    if (pts.length < 3) continue;
    decks.push({ y: bridge.y, pts, at: deckProfile(bridge) });
  }
  return decks;
}

export function deckCovers(decks, x, z, y) {
  for (const deck of decks) {
    const deckY = deck.at ? deck.at(x, z) : deck.y;
    if (Math.abs(deckY - y) > 1.6) continue;
    if (pointInRing(x, z, deck.pts)) return true;
  }
  return false;
}

export function buildBridges(group, geo, terrain) {
  const plantPier = (buf, x, z, top, yaw, sx, sz) => {
    const gy = terrain && terrain.heightAt ? terrain.heightAt(x, z) : 0;
    const base = Math.min(gy, top - 0.4);
    const h = top - base;
    if (h < 1.2) return;
    pushBox(buf, x, (top + base) / 2, z, sx, h, sz, yaw);
  };
  const parapet = [];
  const concrete = [];
  const pier = [];
  const steel = [];
  const white = [];
  const lane = [];
  let named = 0;

  const seen = new Set();
  const builtName = new Set();
  for (const bridge of geo.bridges || []) {
    if (!bridge.ring || bridge.ring.length < 8 || seen.has(bridge.osm)) continue;
    seen.add(bridge.osm);
    const pts = ringPts(bridge.ring);
    if (pts.length < 4) continue;
    const yOf = deckProfile(bridge);
    const axisEarly = centerAxis(pts);
    const y = yOf((axisEarly.ax + axisEarly.bx) / 2, (axisEarly.az + axisEarly.bz) / 2);
    const name = bridge.name || '';
    const rail = (name === 'Neville Bonner Bridge' || name === 'Kurilpa Bridge' || name === 'Goodwill Bridge') ? white : parapet;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 4) continue;
      const edgeDx = (b[0] - a[0]) / len, edgeDz = (b[1] - a[1]) / len;
      if (Math.abs(edgeDx * axisEarly.dx + edgeDz * axisEarly.dz) < 0.72) continue;
      const yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
      const sections = Math.ceil(len / 5);
      for (let k = 0; k < sections; k++) {
        const at = (t, lift) => {
          const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
          return [x, yOf(x, z) + lift, z];
        };
        pushBeam(rail, at(k / sections, 0.55), at((k + 1) / sections, 0.55), 0.34, 1.05);
        pushBeam(concrete, at(k / sections, -0.25), at((k + 1) / sections, -0.25), 0.5, 0.6);
      }
    }
    const axis = centerAxis(pts);
    if (axis.len < 30) continue;
    if (name) {
      if (builtName.has(name)) continue;
      builtName.add(name);
    }
    if (name === 'Neville Bonner Bridge') {
      // The aerial shows one white mast, leaned along the span, with the cable
      // fan running both ways. Mast height, lean and cable count are estimates.
      const lateral = new THREE.Vector3(axis.dz, 0, -axis.dx);
      const [x, z] = along(axis, 0.36);
      const tip = leanedMast(group, x, z, axis.yaw, lateral, yOf(x, z), 36, 0.26);
      fan(group, tip.x, tip.y, tip.z, yOf(x, z) + 0.55, axis, 0.04, 0.28, 7, 0.07);
      fan(group, tip.x, tip.y, tip.z, yOf(x, z) + 0.55, axis, 0.44, 0.96, 12, 0.07);
      named++;
    } else if (name === 'Victoria Bridge') {
      for (let i = 1; i <= 3; i++) {
        const [x, z] = along(axis, i / 4);
        plantPier(pier, x, z, yOf(x, z), axis.yaw, 3.2, 7);
      }
      pushBox(concrete, (axis.ax + axis.bx) / 2, y - 1.35, (axis.az + axis.bz) / 2, 11, 0.9, axis.len * 0.86, axis.yaw);
      named++;
    } else if (name === 'Story Bridge') {
      for (const t of [0.32, 0.68]) {
        const [x, z] = along(axis, t);
        const dy = yOf(x, z);
        pushBox(steel, x, dy + 16, z, 14, 32, 3.4, axis.yaw);
        pushBox(steel, x, dy + 30, z, 14, 2.2, 2.4, axis.yaw);
      }
      const mx = (axis.ax + axis.bx) / 2, mz = (axis.az + axis.bz) / 2;
      pushBox(steel, mx, yOf(mx, mz) + 7, mz, 1.2, 3.4, axis.len * 0.62, axis.yaw);
      named++;
    } else if (name === 'William Jolly Bridge') {
      // Concrete arches spring near the water and crown under the deck.
      // Three spans is the reading of the bridge, not a measured arch survey.
      const nArch = Math.max(3, Math.round(axis.len / 55));
      const halfSpan = (axis.len * 0.7) / nArch / 2;
      const rise = Math.max(5.5, y - 0.2);
      const radius = (halfSpan * halfSpan + rise * rise) / (2 * rise);
      const arc = 2 * Math.asin(Math.min(0.96, halfSpan / radius));
      for (let i = 0; i < nArch; i++) {
        const [x, z] = along(axis, (i + 0.5) / nArch);
        const arch = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.85, 8, 28, arc), CONCRETE);
        const qCrown = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2 - arc / 2);
        const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-axis.dz, axis.dx));
        arch.quaternion.copy(qYaw).multiply(qCrown);
        arch.position.set(x, rise - radius, z);
        arch.castShadow = true;
        group.add(arch);
        plantPier(pier, x, z, yOf(x, z), axis.yaw, 2.6, 8);
      }
      named++;
    } else if (name === 'Kurilpa Bridge') {
      for (const t of [0.3, 0.46, 0.62]) {
        const [x, z] = along(axis, t);
        for (const side of [-1, 1]) {
          const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 22, 6), WHITE);
          mast.position.set(x + axis.dz * side * 3.4, yOf(x, z) + 12, z - axis.dx * side * 3.4);
          mast.rotation.z = side * 0.16;
          mast.castShadow = true;
          group.add(mast);
        }
      }
      named++;
    } else if (name === 'Goodwill Bridge' || name === 'Kangaroo Point Bridge') {
      const [x, z] = along(axis, 0.55);
      const dy = yOf(x, z);
      const height = name === 'Goodwill Bridge' ? 32 : 83;
      const top = pylon(white, x, z, axis.yaw, dy, height, 0);
      cables(group, x, z, top, dy + 0.4, axis, 0.12, 0.48, 7);
      cables(group, x, z, top, dy + 0.4, axis, 0.6, 0.9, 7);
      named++;
    } else if (name === 'Go Between Bridge') {
      for (const t of [0.4, 0.6]) {
        const [x, z] = along(axis, t);
        const dy = yOf(x, z);
        const top = pylon(concrete, x, z, axis.yaw, dy, 22, 0);
        cables(group, x, z, top, dy + 0.4, axis, t - 0.16, t + 0.16, 6);
      }
      named++;
    } else if (axis.len > 40) {
      const n = Math.max(2, Math.round(axis.len / 32));
      for (let i = 1; i < n; i++) {
        const [x, z] = along(axis, i / n);
        plantPier(pier, x, z, yOf(x, z), axis.yaw, 1.3, 1.8);
      }
    }
  }

  let raised = 0;
  const decks = bridgeDeckList(geo.bridges);
  const claimed = new Set();
  for (const road of geo.roads) {
    if (!road.py || (road.k > 1 && road.w < 7)) continue;
    const pts = [];
    for (let i = 0; i < road.p.length; i += 3) pts.push([road.p[i], road.p[i + 2], road.p[i + 1]]);
    if (pts.length < 2) continue;
    let maxY = 0;
    for (const p of pts) if (p[1] > maxY) maxY = p[1];
    if (maxY < 1.6) continue;
    let span = 0;
    for (let i = 1; i < pts.length; i++) span += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]);
    if (span < 14) continue;
    raised++;
    const half = road.w * 0.5;
    let acc = 12;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if (a[1] < 0.9 && b[1] < 0.9) continue;
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const seg = Math.hypot(dx, dz) || 0.001;
      const yaw = Math.atan2(dx, dz);
      const nx = -dz / seg, nz = dx / seg;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, mz = (a[2] + b[2]) / 2;
      if (deckCovers(decks, mx, mz, my)) continue;
      const cell = `${Math.round(mx / 7)},${Math.round(mz / 7)},${Math.round(my)}`;
      if (claimed.has(cell)) continue;
      claimed.add(cell);
      const inset = Math.max(0.35, half - 0.45);
      for (const side of [-1, 1]) {
        pushBeam(parapet, [a[0] + nx * inset * side, a[1] + 0.42, a[2] + nz * inset * side], [b[0] + nx * inset * side, b[1] + 0.42, b[2] + nz * inset * side], 0.28, 0.72);
      }
      pushBeam(concrete, [a[0], a[1] - 0.3, a[2]], [b[0], b[1] - 0.3, b[2]], Math.max(0.8, road.w - 0.4), 0.5);
      if (road.w >= 6) {
        let dash = 2;
        while (dash < seg - 1.2) {
          const t = dash / seg;
          pushBox(lane, a[0] + dx * t, a[1] + dy * t + 0.08, a[2] + dz * t, 0.14, 0.04, Math.min(3.4, seg * 0.4), yaw);
          dash += 9;
        }
      }
      while (acc <= seg) {
        const t = acc / seg;
        const x = a[0] + dx * t, py = a[1] + dy * t, z = a[2] + dz * t;
        if (py > 3) {
          const spread = Math.min(half * 0.5, 5.5);
          if (road.w > 8) {
            plantPier(pier, x + nx * spread, z + nz * spread, py, yaw, 1.15, 1.45);
            plantPier(pier, x - nx * spread, z - nz * spread, py, yaw, 1.15, 1.45);
            pushBox(concrete, x, py - 0.7, z, Math.max(1.2, road.w * 0.38), 0.35, 1.1, yaw);
          } else {
            plantPier(pier, x, z, py, yaw, 1.25, 1.7);
          }
        }
        acc += 22;
      }
      acc -= seg;
    }
  }

  flush(group, parapet, PARAPET);
  flush(group, concrete, CONCRETE);
  flush(group, pier, PIER);
  flush(group, steel, STEEL);
  flush(group, white, WHITE);
  flush(group, lane, LANE);
  return { named, raised };
}
