// Estimated street furniture follows the existing road and park geometry.
import * as THREE from 'three';
import { positionClear } from '../../core/motion.js';
import { PLACE } from '../../story/sagaData.js';
import { drapeRibbon } from './drape.js';

const CELL = 32;
const key = (x, z) => `${x},${z}`;
const anchors = Object.values(PLACE);

function distanceTo(x, z, edge) {
  const t = THREE.MathUtils.clamp(((x - edge.x) * edge.dx + (z - edge.z) * edge.dz) / edge.length, 0, 1);
  return Math.hypot(x - edge.x - edge.dx * edge.length * t, z - edge.z - edge.dz * edge.length * t);
}

function streetIndex(roads) {
  const buckets = new Map();
  const strips = [];
  for (const road of roads) {
    if (road.py || road.k > 5) continue;
    const edges = [];
    const r = road.p;
    let length = 0;
    for (let i = 2; i < r.length; i += 2) {
      const x = r[i - 2], z = r[i - 1], bx = r[i], bz = r[i + 1];
      const size = Math.hypot(bx - x, bz - z);
      if (size < .05) continue;
      const edge = { road, x, z, dx: (bx - x) / size, dz: (bz - z) / size, length: size, start: length };
      edges.push(edge);
      length += size;
      const pad = road.w / 2 + 8;
      for (let ix = Math.floor((Math.min(x, bx) - pad) / CELL); ix <= Math.floor((Math.max(x, bx) + pad) / CELL); ix++) {
        for (let iz = Math.floor((Math.min(z, bz) - pad) / CELL); iz <= Math.floor((Math.max(z, bz) + pad) / CELL); iz++) {
          const k = key(ix, iz);
          if (!buckets.has(k)) buckets.set(k, []);
          buckets.get(k).push(edge);
        }
      }
    }
    if (edges.length) strips.push({ road, edges, length });
  }
  const nearby = (x, z) => buckets.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) || [];
  return { strips, nearby };
}

function* stations(strip, start, step, end) {
  let i = 0;
  for (let d = start; d < strip.length - end; d += step) {
    while (i + 1 < strip.edges.length && d >= strip.edges[i + 1].start) i++;
    const e = strip.edges[i], t = d - e.start;
    yield { x: e.x + e.dx * t, z: e.z + e.dz * t, dx: e.dx, dz: e.dz };
  }
}

function inRing(ring, x, z) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    if ((ring[i + 1] > z) !== (ring[j + 1] > z) &&
        x < ring[i] + (ring[j] - ring[i]) * (z - ring[i + 1]) / (ring[j + 1] - ring[i + 1])) inside = !inside;
  }
  return inside;
}

export function planStreetDetail(zone, geo) {
  const { strips, nearby } = streetIndex(geo.roads);
  const ground = (x, z) => zone.terrain.walkAt(x, z);
  const dry = (x, z) => !zone.terrain.isWater(x, z);
  const roadClear = (x, z, pad, except) => nearby(x, z).every(e => e.road === except ||
    distanceTo(x, z, e) > e.road.w / 2 + pad);
  const lamps = [], rests = [], drains = [], paint = [];
  const fits = (x, z, r) => {
    if (!dry(x, z) || anchors.some(p => Math.hypot(x - p.x, z - p.z) < 9)) return false;
    const y = ground(x, z);
    for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
      if (!dry(x + dx, z + dz) || Math.abs(ground(x + dx, z + dz) - y) > .22) return false;
    }
    return positionClear({ x, y, z }, r, zone);
  };
  const spaced = (items, x, z, d) => items.every(p => Math.hypot(x - p.x, z - p.z) >= d);
  const atSide = (p, offset) => ({ x: p.x - p.dz * offset, z: p.z + p.dx * offset });
  const parks = geo.parks.map(p => {
    const xs = p.ring.filter((_, i) => i % 2 === 0), zs = p.ring.filter((_, i) => i % 2 === 1);
    return { ...p, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
  });
  const inPark = (x, z) => parks.some(p => x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1 && inRing(p.ring, x, z));

  for (const strip of strips) {
    const { road } = strip;
    if (road.k === 0 && road.w >= 7 && road.w <= 15) {
      // Short paint bars stay clear of mapped junctions, including footways.
      for (const p of stations(strip, 8, 9, 8)) {
        if (!dry(p.x, p.z) || !roadClear(p.x, p.z, 2.5, road)) continue;
        const a = [p.x - p.dx * 1.45, p.z - p.dz * 1.45];
        const b = [p.x + p.dx * 1.45, p.z + p.dz * 1.45];
        if (dry(...a) && dry(...b) && roadClear(...a, .4, road) && roadClear(...b, .4, road)) {
          drapeRibbon(paint, [a, b], .065, ground, .063, 1.5);
        }
      }
      for (const p of stations(strip, 18, 37, 12)) {
        const { x, z } = atSide(p, road.w / 2 - .32);
        if (dry(x, z) && roadClear(x, z, 1, road) && positionClear({ x, y: ground(x, z), z }, .45, zone)) {
          drains.push({ x, z, y: ground(x, z) + .068, yaw: Math.atan2(p.dx, p.dz) });
        }
      }
    }
    if ((road.k === 0 || road.k === 2) && lamps.length < 300) {
      const pedestrian = road.k === 2;
      for (const p of stations(strip, 14, pedestrian ? 29 : 37, 10)) {
        for (const side of [1, -1]) {
          const { x, z } = atSide(p, (road.w / 2 + .9) * side);
          if (!fits(x, z, .48) || !roadClear(x, z, .56) || !spaced(lamps, x, z, 19) || !spaced(rests, x, z, 3)) continue;
          lamps.push({ x, z, y: ground(x, z), yaw: Math.atan2(p.dx, p.dz) + side * Math.PI / 2, pedestrian });
          break;
        }
        if (lamps.length >= 300) break;
      }
    }
    if (road.k === 3 && rests.length < 84) {
      for (const p of stations(strip, 12, 29, 9)) {
        for (const side of [-1, 1]) {
          const { x, z } = atSide(p, (road.w / 2 + 2.2) * side);
          if (!inPark(x, z) || !fits(x, z, 1.45) || !roadClear(x, z, 1.45) ||
              !spaced(rests, x, z, 23) || !spaced(lamps, x, z, 3)) continue;
          rests.push({ x, z, y: ground(x, z), yaw: Math.atan2(p.dx, p.dz) + side * Math.PI / 2 });
          break;
        }
        if (rests.length >= 84) break;
      }
    }
  }
  return { lamps, rests, drains, paint };
}

export function installStreetDetail(zone, geo, markMaterial) {
  const plan = planStreetDetail(zone, geo);
  const root = new THREE.Group();
  root.name = 'Brisbane street details';
  const solidMaterial = new THREE.MeshStandardMaterial({ roughness: .76, metalness: .12 });
  const lensMaterial = new THREE.MeshStandardMaterial({
    emissive: 0xffd894, emissiveIntensity: .34, roughness: .36,
  });
  const colors = {
    metal: new THREE.Color(0x344741),
    wood: new THREE.Color(0xa3714c),
    stone: new THREE.Color(0x968e7e),
    lamp: new THREE.Color(0xffebc7),
    dark: new THREE.Color(0x262d2d),
  };
  const shapes = {
    box: new THREE.BoxGeometry(1, 1, 1),
    pole: new THREE.CylinderGeometry(.40, .5, 1, 8),
  };
  const batches = new Map(), matrix = new THREE.Object3D();
  const part = (p, x, y, z, w, h, d, color, shape = 'box') => {
    const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
    const wx = p.x + x * c + z * s, wz = p.z - x * s + z * c;
    matrix.position.set(wx, p.y + y, wz);
    matrix.rotation.set(0, p.yaw, 0, 'YXZ');
    if (p.drain) {
      const ground = zone.terrain.walkAt;
      matrix.position.y = ground(wx, wz) + .068 + y;
      const r = .20;
      matrix.rotation.x = -Math.atan2(ground(wx + r * s, wz + r * c) - ground(wx - r * s, wz - r * c), 2 * r);
      matrix.rotation.z = Math.atan2(ground(wx + r * c, wz - r * s) - ground(wx - r * c, wz + r * s), 2 * r);
    }
    matrix.scale.set(w, h, d);
    matrix.updateMatrix();
    const material = color === 'lamp' ? lensMaterial : solidMaterial;
    const id = `${Math.floor(p.x / 320)}/${Math.floor(p.z / 320)}/${material.id}/${shape}`;
    if (!batches.has(id)) batches.set(id, { material, shape, parts: [] });
    batches.get(id).parts.push({ matrix: matrix.matrix.clone(), color: colors[color] });
  };
  const solid = (p, w, d, height) => {
    const c = Math.abs(Math.cos(p.yaw)), s = Math.abs(Math.sin(p.yaw));
    const x = (w * c + d * s) / 2, z = (w * s + d * c) / 2;
    zone.colliders.push(new THREE.Box3(
      new THREE.Vector3(p.x - x, p.y - .2, p.z - z),
      new THREE.Vector3(p.x + x, p.y + height, p.z + z),
    ));
  };

  for (const p of plan.lamps) {
    const h = p.pedestrian ? 4.05 : 5.8;
    const arm = p.pedestrian ? .65 : 1.05;
    part(p, 0, -.035, 0, .43, .43, .43, 'stone', 'pole');
    part(p, 0, .45, 0, .22, .85, .22, 'metal', 'pole');
    part(p, 0, h / 2, 0, .13, h, .13, 'metal', 'pole');
    part(p, 0, h - .09, arm / 2, .085, .085, arm, 'metal');
    part(p, 0, h - .11, arm, .39, .13, .53, 'metal');
    part(p, 0, h - .185, arm, .32, .034, .42, 'lamp');
    solid(p, .29, .29, h);
  }
  for (const p of plan.rests) {
    for (const x of [-.68, .68]) {
      const foot = Math.min(...[-.32, 0, .32].map(z => zone.terrain.walkAt(
        p.x + x * Math.cos(p.yaw) + z * Math.sin(p.yaw),
        p.z - x * Math.sin(p.yaw) + z * Math.cos(p.yaw),
      ))) - p.y - .10;
      part(p, x, (.43 + foot) / 2, 0, .19, .43 - foot, .64, 'metal');
      part(p, x, .67, -.23, .075, .51, .075, 'metal');
      part(p, x, .68, -.01, .075, .065, .43, 'metal');
    }
    for (let i = 0; i < 4; i++) part(p, 0, .46, -.18 + i * .12, 1.84, .06, .10, 'wood');
    for (let i = 0; i < 3; i++) part(p, 0, .65 + i * .13, -.25, 1.84, .105, .064, 'wood');
    solid(p, 1.84, .64, .98);
  }
  for (const drain of plan.drains) {
    const p = { ...drain, drain: true };
    part(p, 0, -.025, 0, .41, .034, .79, 'dark');
    for (let i = 0; i < 6; i++) part(p, 0, -.003, -.3 + i * .12, .37, .01, .035, 'metal');
  }

  for (const { material, shape, parts } of batches.values()) {
    const mesh = new THREE.InstancedMesh(shapes[shape], material, parts.length);
    parts.forEach((part, i) => {
      mesh.setMatrixAt(i, part.matrix);
      mesh.setColorAt(i, part.color);
    });
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  if (plan.paint.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(plan.paint, 3));
    g.computeVertexNormals();
    const paint = new THREE.Mesh(g, markMaterial);
    paint.receiveShadow = true;
    root.add(paint);
  }
  zone.group.add(root);
  zone.cleanups.push(() => {
    solidMaterial.dispose();
    lensMaterial.dispose();
    for (const shape of Object.values(shapes)) shape.dispose();
  });
  return { lamps: plan.lamps, rests: plan.rests, drains: plan.drains, paintVertices: plan.paint.length / 3, batches: batches.size };
}
