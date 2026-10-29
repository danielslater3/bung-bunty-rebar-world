// A chevron that leads along a street route. Heading comes from the street
// the player is on, not from a point that can jump behind them.
import * as THREE from 'three';
import { mat, dampAngle } from '../core/utils.js';
import { state } from '../core/state.js';
import { PLACE } from './sagaData.js?v=20261029b';
import { ROUTES } from './routes.js?v=20261029b';

const DEST = { mcrebar: 'door', event: 'lawn', hall: 'hall', bank: 'bank', mallBolt: 'bolt' };

export function buildGuide(group) {
  const g = new THREE.Group();
  const gold = mat(0xffc02e, { emissive: 0xffc02e, emissiveIntensity: 0.55, metalness: 0.55, roughness: 0.32 });
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.85), gold);
  shaft.position.z = -0.42;
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.72), gold);
  left.position.set(-0.28, 0, 0.16);
  left.rotation.y = 0.55;
  const right = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.72), gold);
  right.position.set(0.28, 0, 0.16);
  right.rotation.y = -0.55;
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

function closestOnRoute(pts, from) {
  let bestD = Infinity;
  let bestI = 0;
  let bx = pts[0][0];
  let bz = pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0];
    const az = pts[i][1];
    const dx = pts[i + 1][0] - ax;
    const dz = pts[i + 1][1] - az;
    const len2 = dx * dx + dz * dz || 1e-6;
    let t = ((from.x - ax) * dx + (from.z - az) * dz) / len2;
    t = Math.max(0, Math.min(1, t));
    const x = ax + dx * t;
    const z = az + dz * t;
    const d = Math.hypot(x - from.x, z - from.z);
    if (d < bestD) {
      bestD = d;
      bestI = i;
      bx = x;
      bz = z;
    }
  }
  return { i: bestI, d: bestD, x: bx, z: bz };
}

function directAim(step) {
  if (!step || state.saga?.chapter > 3 || !PLACE[step.at]) return null;
  if (step.kind === 'interact' || step.kind === 'reach') return PLACE[step.at];
  if (step.kind === 'rings') {
    const have = state.saga.stepState?.rings || {};
    const id = step.rings.find((p) => !have[p]);
    return id ? PLACE[id] : null;
  }
  return null;
}

export function updateGuide(saga) {
  const arrow = saga.actors?.guide;
  if (!arrow) return;
  const step = saga.currentStep();
  const show = saga.game.mode === 'playing' && !state.saga?.intermission;
  const here = saga.here();
  const dest = show ? destination(step) : null;
  let heading = null;

  if (dest) {
    if (arrow.userData.dest !== dest || !arrow.userData.route) {
      arrow.userData.dest = dest;
      arrow.userData.route = pickRoute(dest, here);
      arrow.userData.seg = 0;
    }
    const route = arrow.userData.route;
    if (route && route.length > 1) {
      const near = closestOnRoute(route, here);
      if (near.d > 40) {
        arrow.userData.route = pickRoute(dest, here);
        arrow.userData.seg = 0;
      }
      const live = arrow.userData.route;
      const on = closestOnRoute(live, here);
      let seg = on.i;
      const lock = arrow.userData.seg ?? 0;
      if (on.d < 16) {
        if (on.i > lock) seg = on.i;
        else if (lock - on.i >= 2 && on.d < 7) seg = on.i;
        else seg = lock;
      }
      arrow.userData.seg = seg;
      const ax = live[seg][0];
      const az = live[seg][1];
      const bx = live[Math.min(seg + 1, live.length - 1)][0];
      const bz = live[Math.min(seg + 1, live.length - 1)][1];
      const end = live[live.length - 1];
      const toEnd = Math.hypot(end[0] - here.x, end[1] - here.z);
      if (toEnd < 4) { arrow.visible = false; return; }
      if (on.d > 14) heading = Math.atan2(on.x - here.x, on.z - here.z);
      else heading = Math.atan2(bx - ax, bz - az);
    }
  } else {
    arrow.userData.dest = null;
    arrow.userData.route = null;
    const spot = show ? directAim(step) : null;
    if (spot) {
      const dx = spot.x - here.x;
      const dz = spot.z - here.z;
      if (Math.hypot(dx, dz) < 2.4) { arrow.visible = false; return; }
      heading = Math.atan2(dx, dz);
    }
  }

  if (heading == null || Number.isNaN(heading)) { arrow.visible = false; return; }
  const riding = saga.game.trolley.riding;
  const lift = (riding ? 1.85 : 1.35) + Math.sin(saga.game.elapsed * 3) * 0.05;
  const ahead = riding ? 3.4 : 2.6;
  arrow.visible = true;
  arrow.position.set(
    here.x + Math.sin(heading) * ahead,
    here.y + lift,
    here.z + Math.cos(heading) * ahead,
  );
  const dt = saga.game._dt || 0.016;
  if (arrow.userData.yaw == null) arrow.userData.yaw = heading + Math.PI;
  arrow.userData.yaw = dampAngle(arrow.userData.yaw, heading + Math.PI, 10, dt);
  arrow.rotation.y = arrow.userData.yaw;
}
