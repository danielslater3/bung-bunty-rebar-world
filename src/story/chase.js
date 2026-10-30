// Queen Street chase helpers. The polyline lives in sagaData so the boot
// path never loads the city mesh. Positions stay on that polyline.
import * as THREE from 'three';

export function pathLength(pts) {
  let n = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    n += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  }
  return n;
}

export function pointAlong(pts, dist) {
  let left = Math.max(0, dist);
  const last = pts.length - 1;
  for (let i = 0; i < last; i++) {
    const ax = pts[i][0];
    const az = pts[i][1];
    const bx = pts[i + 1][0];
    const bz = pts[i + 1][1];
    const seg = Math.hypot(bx - ax, bz - az) || 0.0001;
    if (left <= seg || i === last - 1) {
      const u = Math.min(1, left / seg);
      return {
        x: ax + (bx - ax) * u,
        z: az + (bz - az) * u,
        tx: (bx - ax) / seg,
        tz: (bz - az) / seg,
        i,
      };
    }
    left -= seg;
  }
  return { x: pts[last][0], z: pts[last][1], tx: 0, tz: 1, i: last };
}

// Closest point on the polyline. `dist` is metres from the start.
export function projectAlong(pts, x, z) {
  let bestD = Infinity;
  let bestAlong = 0;
  let bx = pts[0][0];
  let bz = pts[0][1];
  let bi = 0;
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0];
    const az = pts[i][1];
    const dx = pts[i + 1][0] - ax;
    const dz = pts[i + 1][1] - az;
    const seg = Math.hypot(dx, dz) || 0.0001;
    const len2 = dx * dx + dz * dz || 1e-6;
    let t = ((x - ax) * dx + (z - az) * dz) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = ax + dx * t;
    const pz = az + dz * t;
    const d = Math.hypot(px - x, pz - z);
    if (d < bestD) {
      bestD = d;
      bestAlong = acc + seg * t;
      bx = px;
      bz = pz;
      bi = i;
    }
    acc += seg;
  }
  return { dist: bestAlong, off: bestD, x: bx, z: bz, i: bi };
}

export function ensureTrail(saga) {
  if (saga._trail) return saga._trail;
  const group = saga.game.zone?.group;
  if (!group) return null;
  const pool = [];
  const geo = new THREE.RingGeometry(0.1, 0.22, 10);
  geo.rotateX(-Math.PI / 2);
  for (let i = 0; i < 48; i++) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xff9a1a,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, material);
    mesh.visible = false;
    mesh.userData.dispose=()=>material.dispose();
    mesh.renderOrder = 3;
    group.add(mesh);
    pool.push({ mesh, life: 0, max: 8.5 });
  }
  saga._trail = { pool, cursor: 0, lx: 0, lz: 0, dropped: false };
  return saga._trail;
}

export function dropTrail(saga, x, y, z) {
  const trail = ensureTrail(saga);
  if (!trail) return;
  if (trail.dropped && Math.hypot(x - trail.lx, z - trail.lz) < 3.1) return;
  trail.lx = x;
  trail.lz = z;
  trail.dropped = true;
  const slot = trail.pool[trail.cursor];
  trail.cursor = (trail.cursor + 1) % trail.pool.length;
  slot.mesh.visible = true;
  slot.mesh.position.set(x, y + 0.12, z);
  slot.life = slot.max;
  slot.mesh.material.opacity = 0.95;
  slot.mesh.scale.setScalar(1);
}

export function tickTrail(saga, dt) {
  const trail = saga._trail;
  if (!trail) return;
  for (let i = 0; i < trail.pool.length; i++) {
    const slot = trail.pool[i];
    if (slot.life <= 0) continue;
    slot.life -= dt;
    const u = Math.max(0, slot.life / slot.max);
    slot.mesh.material.opacity = u * 0.9;
    slot.mesh.scale.setScalar(0.4 + u * 0.75);
    if (slot.life <= 0) slot.mesh.visible = false;
  }
}

export function clearTrail(saga) {
  const trail = saga._trail;
  if (!trail) return;
  trail.dropped = false;
  for (let i = 0; i < trail.pool.length; i++) {
    trail.pool[i].life = 0;
    trail.pool[i].mesh.visible = false;
  }
}
