// Chapter 7–8 props/actions reuse the existing characters, surfaces and cameras.
import * as THREE from 'three';
import { state } from '../core/state.js';
import { stageCast, floorAt } from './actors.js';
import { segmentClear } from './guide.js';
import { localRoute } from '../systems/Navigation.js';

export function makePhoneShards() {
  const material = new THREE.MeshStandardMaterial({
    color: 0x38bfe9,
    emissive: 0x12658e,
    emissiveIntensity: 0.3,
    roughness: 0.25,
    metalness: 0.25,
  });
  const outlines = [
    [
      [-0.12, -0.22],
      [0.12, -0.22],
      [0.025, 0.02],
    ],
    [
      [-0.12, -0.18],
      [0.09, 0.04],
      [-0.11, 0.22],
    ],
    [
      [0.11, -0.18],
      [0.1, 0.22],
      [-0.08, 0.2],
    ],
  ];
  return outlines.map((points) => {
    const shape = new THREE.Shape();
    shape.moveTo(...points[0]);
    for (const p of points.slice(1)) shape.lineTo(...p);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.025,
      bevelEnabled: true,
      bevelSize: 0.005,
      bevelThickness: 0.005,
      bevelSegments: 1,
      steps: 1,
    });
    return new THREE.Mesh(geometry, material);
  });
}

export function feud(saga) {
  const a = saga.actors;
  if (a.feud) return a.feud;
  const group = new THREE.Group();
  saga.game.zone.group.add(group);
  const blue = new THREE.MeshStandardMaterial({ color: 0x2388d0, metalness: 0.4, roughness: 0.25 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x182634, roughness: 0.7 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc745, roughness: 0.45, metalness: 0.35 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe6bf94, roughness: 0.8 });
  const screen = new THREE.MeshStandardMaterial({
    color: 0x62d8ff,
    emissive: 0x1268ae,
    emissiveIntensity: 0.5,
    roughness: 0.25,
  });
  const add = (parent, w, h, d, m, x, y, z) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };
  const phone = new THREE.Group();
  add(phone, 0.17, 0.33, 0.035, blue, 0, 0, 0);
  add(phone, 0.145, 0.28, 0.006, screen, 0, 0, 0.022);
  for (const x of [-0.045, 0.04]) add(phone, 0.025, 0.025, 0.012, dark, x, 0.1, -0.025);
  group.add(phone);
  const stage = new THREE.Group();
  const p = saga.point('plaza');
  stage.position.copy(p);
  // A removable performance setup on the square; no replacement map geometry.
  for (const x of [-4.5, 4.5]) {
    const ground = floorAt(saga, { x: p.x + x, y: p.y, z: p.z + 2.8 }) - p.y;
    add(stage, 0.7, 1.5, 0.65, dark, x, 0.75 + ground, 2.8);
    for (const y of [0.45, 1.05]) {
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 12), gold);
      cone.rotation.x = Math.PI / 2;
      cone.position.set(x, y + ground, 3.15);
      stage.add(cone);
    }
  }
  for (const x of [-1.5, 1.5]) {
    const ground = floorAt(saga, { x: p.x + x, y: p.y, z: p.z + 1.4 }) - p.y;
    add(stage, 0.035, 1.25, 0.035, dark, x, 0.625 + ground, 1.4);
    add(stage, 0.14, 0.08, 0.08, gold, x, 1.28 + ground, 1.4);
  }
  for (let i = 0; i < 8; i++) {
    const beam = add(stage, 0.6, 0.035, 0.14, gold, -3.5 + i, 0.03, 3.6);
    beam.userData.light = true;
  }
  const crowdPoints = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2,
      q = { x: p.x + Math.sin(angle) * 6, y: p.y, z: p.z + Math.cos(angle) * 6 };
    q.y = floorAt(saga, q);
    if (segmentClear(saga.game.zone, q, q, 0.4)) crowdPoints.push(q);
  }
  let crowdHeads = null;
  if (crowdPoints.length) {
    const bodies = new THREE.InstancedMesh(
      new THREE.CapsuleGeometry(0.2, 0.65, 3, 6),
      blue,
      crowdPoints.length,
    );
    const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 8, 6), skin, crowdPoints.length);
    const matrix = new THREE.Matrix4();
    crowdPoints.forEach((q, i) => {
      bodies.setMatrixAt(i, matrix.makeTranslation(q.x - p.x, q.y - p.y + 0.525, q.z - p.z));
      heads.setMatrixAt(i, matrix.makeTranslation(q.x - p.x, q.y - p.y + 1.15, q.z - p.z));
    });
    stage.add(bodies, heads);
    crowdHeads = heads;
  }
  group.add(stage);
  const rings = [0, 1, 2].map(() => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.055, 5, 16), gold);
    r.rotation.x = -Math.PI / 2;
    group.add(r);
    return r;
  });
  saga.game.zone.cleanups.push(() => {
    for (const m of [blue, dark, gold, screen, skin]) m.dispose();
  });
  const f = {
    group,
    phone,
    stage,
    rings,
    sceneTime: 0,
    key: null,
    cast: null,
    crowdHeads,
    crowdPoints,
    crowdMatrix: new THREE.Matrix4(),
  };
  a.feud = f;
  return f;
}
export function shardPoints(saga) {
  const ss = state.saga.stepState;
  if (ss.shardPoints?.length === 3) return ss.shardPoints;
  const origin = saga.point('smash'),
    clear = (a, b) => segmentClear(saga.game.zone, a, b, 0.65),
    points = [];
  for (const [dx, dz] of [
    [2.2, 1.1],
    [-2.4, 1.6],
    [0.8, -2.3],
  ]) {
    let chosen = null;
    for (let r = 0; r <= 4 && !chosen; r += 0.8)
      for (let k = 0; k < 16 && !chosen; k++) {
        const p = {
          x: origin.x + dx + Math.sin((k * Math.PI) / 8) * r,
          y: origin.y,
          z: origin.z + dz + Math.cos((k * Math.PI) / 8) * r,
        };
        p.y = floorAt(saga, p);
        if (clear(p, p) && localRoute(origin, p, clear).length) chosen = p;
      }
    if (!chosen) throw new Error('No safe phone evidence position');
    points.push(chosen);
  }
  ss.shardPoints = points;
  return points;
}
export function poseFeud(saga, step) {
  if (state.saga.chapter < 6 || state.saga.chapter > 7) return;
  const a = saga.actors,
    f = feud(saga),
    key = `${state.saga.chapter}:${step.id}`;
  if (f.key !== key) {
    f.key = key;
    f.sceneTime = 0;
    f.cast = null;
  }
  f.stage.visible = state.saga.chapter === 6;
  f.phone.visible = false;
  f.rings.forEach((r) => (r.visible = false));
  if (step.kind === 'rhythm') {
    const crowdBeat = saga.mission?.beat || 0;
    if (f.crowdHeads && f.crowdBeat !== crowdBeat) {
      f.crowdBeat = crowdBeat;
      f.crowdPoints.forEach((q, i) => {
        f.crowdHeads.setMatrixAt(
          i,
          f.crowdMatrix.makeTranslation(
            q.x - f.stage.position.x,
            q.y - f.stage.position.y + 1.15 + ((i + crowdBeat) % 2) * 0.025,
            q.z - f.stage.position.z,
          ),
        );
      });
      f.crowdHeads.instanceMatrix.needsUpdate = true;
    }
    if (!f.cast) {
      stageCast(saga, { cast: ['gabor', 'ching'] });
      f.cast = { gabor: a.gabor.position.clone(), ching: a.ching.position.clone() };
    }
    for (const name of ['gabor', 'ching']) {
      a[name].visible = true;
      a[name].position.copy(f.cast[name]);
      a[name].rotation.y = Math.atan2(
        saga.game.player.pos.x - a[name].position.x,
        saga.game.player.pos.z - a[name].position.z,
      );
    }
    const beat = Math.sin(saga.game.elapsed * 9),
      arm = saga.game.player.mesh.userData.parts?.armR;
    if (arm) arm.rotation.x = -0.7 + beat * 0.22;
    if (a.gabor.userData.armR) a.gabor.userData.armR.rotation.x = -0.6 - beat * 0.25;
    if (a.ching.userData.armR) a.ching.userData.armR.rotation.x = -1.1 + beat * 0.2;
  }
  if (state.saga.chapter === 7) {
    if (step.kind === 'photo' && !f.cast) {
      stageCast(saga, { cast: ['gabor', 'ching'] });
      f.cast = { gabor: a.gabor.position.clone(), ching: a.ching.position.clone() };
    }
    if (step.kind === 'photo' && f.cast)
      for (const name of ['gabor', 'ching']) {
        a[name].visible = true;
        a[name].position.copy(f.cast[name]);
        a[name].rotation.y = Math.atan2(
          saga.game.player.pos.x - a[name].position.x,
          saga.game.player.pos.z - a[name].position.z,
        );
      }
    const holder = ['snap', 'smash'].includes(step.id) ? a.gabor : a.ching;
    if (['gift', 'phone', 'snap', 'smash'].includes(step.id)) {
      f.phone.visible = true;
      const p =
        step.id === 'phone'
          ? saga.game.zone.interactables.find((i) => i.id === 'phone').pos
          : holder.visible
            ? holder.position
            : saga.point('phone');
      f.phone.position.set(p.x + 0.38, p.y + (step.id === 'phone' ? 0 : 1), p.z + 0.32);
      f.phone.rotation.set(0, holder.rotation.y, 0.1);
      if (step.id === 'smash') {
        state.saga.phone = 'broken';
        const t = Math.min(1, f.sceneTime / 1.1);
        f.phone.position.y = p.y + 1 - t;
        f.phone.rotation.z = t * 6;
        f.phone.visible = t < 1;
        if (t >= 1) {
          const origin = f.phone.position;
          a.shards.forEach((m, i) => {
            m.visible = true;
            m.position.set(origin.x + (i - 1) * 0.18, floorAt(saga, origin) + 0.1, origin.z);
            m.rotation.set(Math.PI / 2, 0, (i - 1) * 0.7);
          });
        }
      }
    }
    if (step.kind === 'shards') {
      const got = state.saga.stepState.shards || {};
      shardPoints(saga).forEach((p, i) => {
        const visible = !got[`s${i}`];
        a.shards[i].visible = visible;
        a.shards[i].position.set(p.x, p.y + 0.1, p.z);
        a.shards[i].rotation.x = Math.PI / 2;
        f.rings[i].visible = visible;
        f.rings[i].position.set(p.x, p.y + 0.1, p.z);
      });
    }
  }
}
export function tickFeudScene(saga, dt) {
  if (state.saga?.chapter !== 7) return;
  const f = feud(saga),
    step = saga.currentStep();
  if (step?.id !== 'smash') return;
  if (saga.game.dialogue.current?.speaker === 'doc') {
    f.sceneTime += Math.min(0.1, dt);
    saga.game.dialogue.current.focusPoint = f.phone.position;
  }
  poseFeud(saga, step);
}
