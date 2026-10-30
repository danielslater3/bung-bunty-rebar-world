// One waypoint presentation for every saga objective, including moving actors.
import * as THREE from 'three';
import { state } from '../core/state.js';
import { PLACE } from './sagaData.js';
import { pushFootprints } from '../world/geo/footprints.js';
import {
  NavigationController,
  RoadNetwork,
  localRoute,
  nearestOnPath,
  atDistance,
  distance,
} from '../systems/Navigation.js';

export function segmentClear(zone, a, b, radius = 0.6) {
  const n = Math.max(1, Math.ceil(distance(a, b) / 0.6));
  const p = { x: 0, z: 0 };
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      x = a.x + (b.x - a.x) * t,
      z = a.z + (b.z - a.z) * t;
    const y =
      (a.y ?? zone.groundAt(x, z)) + ((b.y ?? a.y ?? zone.groundAt(x, z)) - (a.y ?? zone.groundAt(x, z))) * t;
    p.x = x;
    p.z = z;
    pushFootprints(p, radius, y, zone);
    if (Math.hypot(p.x - x, p.z - z) > 0.04) return false;
    for (const box of zone.colliders) {
      if (y + 0.15 >= box.max.y || y + 1.8 <= box.min.y) continue;
      const dx = x - Math.max(box.min.x, Math.min(box.max.x, x)),
        dz = z - Math.max(box.min.z, Math.min(box.max.z, z));
      if (dx * dx + dz * dz < radius * radius) return false;
    }
  }
  return true;
}
export function buildGuide(group) {
  const g = new THREE.Group();
  g.name = 'Golden route guide';
  // Rounded silhouette plus a true bevel, extruded as one chunky arrow.
  const shape = new THREE.Shape();
  shape.moveTo(-0.23, -0.85);
  shape.quadraticCurveTo(-0.23, -0.98, 0, -0.98);
  shape.quadraticCurveTo(0.23, -0.98, 0.23, -0.85);
  shape.lineTo(0.23, 0.05);
  shape.lineTo(0.57, 0.05);
  shape.quadraticCurveTo(0.76, 0.05, 0.62, 0.24);
  shape.lineTo(0.13, 0.92);
  shape.quadraticCurveTo(0, 1.09, -0.13, 0.92);
  shape.lineTo(-0.62, 0.24);
  shape.quadraticCurveTo(-0.76, 0.05, -0.57, 0.05);
  shape.lineTo(-0.23, 0.05);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.09,
    bevelThickness: 0.09,
    curveSegments: 10,
  });
  geo.rotateX(Math.PI / 2);
  geo.computeVertexNormals();
  const gold = new THREE.MeshStandardMaterial({
    color: 0xffce36,
    emissive: 0xa65b00,
    emissiveIntensity: 0.48,
    metalness: 0.35,
    roughness: 0.28,
    depthTest: false,
  });
  const arrow = new THREE.Mesh(geo, gold);
  arrow.renderOrder = 20;
  g.add(arrow);
  g.visible = false;
  group.add(g);
  // Bounded, instanced trail: one draw call, individual opacity via an attribute.
  const trailGeo = new THREE.RingGeometry(0.12, 0.24, 12);
  trailGeo.rotateX(-Math.PI / 2);
  const opacity = new THREE.InstancedBufferAttribute(new Float32Array(32), 1);
  trailGeo.setAttribute('trailAlpha', opacity);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffca42,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float trailAlpha; varying float vTrailAlpha;',
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTrailAlpha=trailAlpha;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vTrailAlpha;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vTrailAlpha;');
  };
  const trail = new THREE.InstancedMesh(trailGeo, material, 32);
  trail.frustumCulled = false;
  trail.visible = false;
  group.add(trail);
  g.userData.dispose = () => {
    gold.dispose();
    material.dispose();
    document.getElementById('route-hud')?.remove();
  };
  g.userData.trail = trail;
  g.userData.matrix = new THREE.Matrix4();
  g.userData.alpha = opacity;
  return g;
}
function planner(saga) {
  const zone = saga.game.zone,
    clear = (a, b) => segmentClear(zone, a, b);
  const network = new RoadNetwork(saga.game.geoBrisbane.roads, (x, z) => zone.terrain.walkAt(x, z), clear);
  const plan = (from, to) => {
    // Interactable origins can sit inside a wardrobe/counter. Navigate to a
    // clear standing point within reach, not into the furniture's collider.
    if (!clear(to, to)) {
      const candidates = [];
      for (const r of [0.8, 1.3, 1.8, 2.2])
        for (let i = 0; i < 16; i++) {
          const a = (i * Math.PI) / 8,
            q = { x: to.x + Math.sin(a) * r, y: to.y, z: to.z + Math.cos(a) * r };
          const room = saga.game.indoorRoom(to.x, to.y + 1, to.z);
          const candidateRoom = saga.game.indoorRoom(q.x, q.y + 1, q.z);
          if (
            clear(q, q) &&
            (!room || candidateRoom === room || (room.kind === 'bar' && candidateRoom?.kind === 'bar'))
          )
            candidates.push(q);
        }
      candidates.sort((a, b) => distance(a, from) - distance(b, from));
      if (!candidates.length) return [];
      to = candidates[0];
    }
    if (distance(from, to) < 60 && Math.abs(from.y - to.y) < 2) {
      const route = localRoute(from, to, clear);
      if (route.length) return route;
    }
    let start = from,
      end = to,
      prefix = [],
      suffix = [];
    const bar = saga.actors.bar,
      house = saga.actors.house;
    const inBar = (p) => bar.inside(p.x, p.z) && Math.abs(p.y - bar.y) < 2;
    const inHouse = (p) =>
      house.rooms.some(
        (r) => p.x > r.minX && p.x < r.maxX && p.z > r.minZ && p.z < r.maxZ && Math.abs(p.y - r.floor) < 2,
      );
    const access = (p) => {
      if (inBar(p)) return bar.navRoute;
      if (inHouse(p)) {
        const garage = house.garage;
        return p.x > garage.minX - 0.5 ? house.garageRoute : house.frontRoute;
      }
      return null;
    };
    const out = access(from),
      into = access(to);
    if (out?.length) {
      const local = localRoute(from, out[0], clear);
      if (!local.length) return [];
      prefix = [...local, ...out.slice(1)];
      start = out[out.length - 1];
    }
    if (into?.length) {
      const local = localRoute(into[0], to, clear);
      if (!local.length) return [];
      suffix = [...into.slice().reverse(), ...local.slice(1)];
      end = into[into.length - 1];
    }
    const middle = network.route(start, end, clear);
    return middle.length ? [...prefix, ...middle, ...suffix] : [];
  };
  return new NavigationController(plan, clear);
}
function objective(saga, step) {
  if (step.kind === 'follow' || step.kind === 'catch') {
    const pts = saga.chasePts().map(([x, z]) => ({ x, z, y: saga.ground(x, z) }));
    const here = saga.here(),
      on = nearestOnPath(pts, here),
      g = Math.min(saga.chaseLength(), saga.gaborDist || 0);
    const end = atDistance(pts, g),
      dir = g >= on.along ? 1 : -1,
      route = [on.point];
    if (dir > 0) {
      for (let i = on.index + 1; i < pts.length; i++) {
        const at = nearestOnPath(pts, pts[i]).along;
        if (at >= g) break;
        route.push(pts[i]);
      }
    } else {
      for (let i = on.index; i >= 0; i--) {
        const at = nearestOnPath(pts, pts[i]).along;
        if (at <= g) break;
        route.push(pts[i]);
      }
    }
    route.push(end);
    const bar = saga.actors.bar;
    const inside = bar.inside(here.x, here.z) && Math.abs(here.y - bar.y) < 2;
    return { target: end, route: inside || on.off > 14 ? null : route, label: 'GABOR' };
  }
  let id = step.at;
  if (step.kind === 'parts') id = step.parts.find((p) => !state.saga.stepState.parts?.[p]);
  if (step.kind === 'rings') id = step.rings.find((p) => !state.saga.stepState.rings?.[p]);
  if (step.kind === 'choice') id = step.correct;
  if (step.kind === 'escape')
    return { target: saga.pointXY(PLACE.event.x - 28, PLACE.event.z), label: 'LEAVE THE LAWN' };
  const it = saga.game.zone.interactables.find((it) => it.id === id);
  const target = it
    ? { x: it.pos.x, y: it.pos.y - 0.8, z: it.pos.z }
    : id && PLACE[id]
      ? saga.point(id)
      : saga.markerPoint();
  return { target, label: step.text || 'OBJECTIVE' };
}
export function hideGuide(saga) {
  const guide = saga.actors?.guide;
  if (guide) {
    guide.visible = false;
    guide.userData.trail.visible = false;
  }
  document.getElementById('route-hud')?.classList.add('hidden');
}
export function updateGuide(saga) {
  const arrow = saga.actors?.guide,
    step = saga.currentStep();
  if (!arrow) return;
  if (saga.game.mode !== 'playing' || state.saga?.intermission || !step || step.kind === 'scene') {
    hideGuide(saga);
    return;
  }
  const data = arrow.userData;
  if (!data.controller) data.controller = planner(saga);
  const { target, route, label } = objective(saga, step),
    here = saga.here(),
    dt = saga.game._dt || 0.016;
  const result = data.controller.update({
    key: `${state.saga.chapter}:${step.id}`,
    from: here,
    target,
    route,
    dt,
  });
  if (!result) {
    hideGuide(saga);
    return;
  }
  let hud = document.getElementById('route-hud');
  if (!hud) {
    hud = document.createElement('div');
    hud.id = 'route-hud';
    document.getElementById('hud').appendChild(hud);
  }
  hud.classList.remove('hidden');
  const detail = result.unavailable
    ? 'FIND THE STREET / ENTRANCE'
    : `${Math.ceil(result.distance)} m${result.vertical > 2 ? ' · UPSTAIRS' : result.vertical < -2 ? ' · DOWNSTAIRS' : ''}`;
  const text = `${label} · ${detail}`;
  if (hud.textContent !== text) hud.textContent = text;
  arrow.visible = !result.unavailable && result.distance > 1.6;
  if (arrow.visible) {
    const yaw = result.yaw;
    arrow.rotation.set(0, yaw, 0);
    arrow.position.set(
      here.x + Math.sin(yaw) * 1.6,
      here.y + 2.45 + Math.sin(saga.game.elapsed * 3) * 0.09,
      here.z + Math.cos(yaw) * 1.6,
    );
    arrow.scale.setScalar(
      Math.max(0.22, Math.min(1.05, saga.game.camera.position.distanceTo(arrow.position) * 0.12)),
    );
  }
  data.trail.visible = arrow.visible;
  if (!arrow.visible) return;
  data.trailTimer = (data.trailTimer || 0) - dt;
  if (data.trailTimer > 0) return;
  data.trailTimer = 0.1;
  for (let i = 0; i < 32; i++) {
    const d = 2 + i * 1.8,
      left = result.on.length - result.on.along;
    const p = atDistance(result.path, result.on.along + Math.min(d, left));
    // Route height handles stairs/bridges. Terrain prevents ground-level dots
    // clipping on the tiny pavement lift; no floating metres above the road.
    const y = Math.max(p.y ?? 0, saga.game.zone.groundAt(p.x, p.z, (p.y ?? here.y) + 0.4));
    data.matrix.makeTranslation(p.x, y + 0.11, p.z);
    data.trail.setMatrixAt(i, data.matrix);
    data.alpha.array[i] = d > left ? 0 : 0.65 * Math.min(1, d / 5) * Math.max(0, 1 - d / 60);
  }
  data.alpha.needsUpdate = true;
  data.trail.instanceMatrix.needsUpdate = true;
}
