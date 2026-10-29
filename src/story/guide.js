// A chevron that leads along a street route. The polylines come from the
// Brisbane road, mall and bridge graph, so the arrow turns with the street.
import * as THREE from 'three';
import { mat } from '../core/utils.js';
import { state } from '../core/state.js';
import { PLACE } from './sagaData.js?v=20261029b';
import { ROUTES } from './routes.js?v=20261029b';

const DEST = { mcrebar: 'door', event: 'lawn', hall: 'hall', bank: 'bank', mallBolt: 'bolt' };

export function buildGuide(group) {
  const g = new THREE.Group();
  const gold = mat(0xffc02e, { emissive: 0xffc02e, emissiveIntensity: 0.85, metalness: 0.4, roughness: 0.28 });
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 1.05), gold);
  shaft.position.z = -0.55;
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 1.25), gold);
  left.position.set(-0.42, 0, 0.22);
  left.rotation.y = 0.62;
  const right = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 1.25), gold);
  right.position.set(0.42, 0, 0.22);
  right.rotation.y = -0.62;
  g.add(shaft, left, right);
  g.visible = false;
  group.add(g);
  return g;
}

function destination(step) {
  if (!step || state.saga?.chapter > 3) return null;
  if (step.kind === 'reach') return DEST[step.at] || null;
  if (step.kind === 'parts') {
    const have = state.saga.stepState?.parts || {};
    const id = step.parts.find((p) => !have[p]);
    return id ? DEST[id] : null;
  }
  return null;
}

function pickRoute(dest, from) {
  let best = null;
  let bestD = Infinity;
  for (const [key, pts] of Object.entries(ROUTES)) {
    if (!key.endsWith('>' + dest)) continue;
    let near = Infinity;
    for (const p of pts) near = Math.min(near, Math.hypot(p[0] - from.x, p[1] - from.z));
    if (near < bestD) { bestD = near; best = pts; }
  }
  return best;
}

function aheadPoint(pts, from, dist) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - from.x, pts[i][1] - from.z);
    if (d < bestD) { bestD = d; best = i; }
  }
  if (bestD > 22) return { x: pts[best][0], z: pts[best][1] };
  let left = dist;
  for (let i = best; i < pts.length - 1; i++) {
    const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0], bz = pts[i + 1][1];
    const seg = Math.hypot(bx - ax, bz - az) || 0.001;
    let start = 0;
    if (i === best) {
      const t = ((from.x - ax) * (bx - ax) + (from.z - az) * (bz - az)) / (seg * seg);
      start = Math.max(0, Math.min(1, t)) * seg;
    }
    const remain = seg - start;
    if (left <= remain) {
      const t = (start + left) / seg;
      return { x: ax + (bx - ax) * t, z: az + (bz - az) * t };
    }
    left -= remain;
  }
  const last = pts[pts.length - 1];
  return { x: last[0], z: last[1] };
}

export function updateGuide(saga) {
  const arrow = saga.actors?.guide;
  if (!arrow) return;
  const step = saga.currentStep();
  const show = saga.game.mode === 'playing' && !state.saga?.intermission;
  const dest = show ? destination(step) : null;
  const here = saga.here();
  let aim = null;
  if (dest) {
    const route = pickRoute(dest, here);
    if (route) aim = aheadPoint(route, here, 12);
  } else if (show && step?.kind === 'rings') {
    const have = state.saga.stepState?.rings || {};
    const id = step.rings.find((p) => !have[p]);
    if (id && PLACE[id]) aim = { x: PLACE[id].x, z: PLACE[id].z };
  }
  if (!aim) { arrow.visible = false; return; }
  const dx = aim.x - here.x;
  const dz = aim.z - here.z;
  if (Math.hypot(dx, dz) < 2.6) { arrow.visible = false; return; }
  const facing = Math.atan2(dx, dz);
  arrow.visible = true;
  arrow.position.set(
    here.x + Math.sin(facing) * 3.8,
    here.y + 2.25 + Math.sin(saga.game.elapsed * 4) * 0.08,
    here.z + Math.cos(facing) * 3.8,
  );
  arrow.rotation.y = facing + Math.PI;
}
