// Shared grounded actor placement and locomotion; no city-mesh raycasts.
import { positionClear, moveHorizontal } from '../core/motion.js';
import { segmentClear } from './guide.js';
import { turnToward, localRoute, distance } from '../systems/Navigation.js';

export function floorAt(saga, p) {
  const room = saga.game.indoorRoom(p.x, p.y + 1, p.z);
  return room && Math.abs(room.floor - p.y) < 2 ? room.floor : saga.game.zone.groundAt(p.x, p.z, p.y + 0.55);
}
export function placeActor(saga, actor, target, others = [], radius = 0.5) {
  const zone = saga.game.zone;
  for (const r of [0, 0.8, 1.6, 2.4, 3.2, 4.8])
    for (let i = 0; i < (r ? 16 : 1); i++) {
      const a = (i * Math.PI) / 8,
        p = { x: target.x + Math.sin(a) * r, y: target.y, z: target.z + Math.cos(a) * r };
      p.y = floorAt(saga, p);
      const room = saga.game.indoorRoom(target.x, target.y + 1, target.z);
      const candidate = saga.game.indoorRoom(p.x, p.y + 1, p.z);
      if (room && candidate !== room && !(room.kind === 'bar' && candidate?.kind === 'bar')) continue;
      if (!positionClear(p, radius, zone)) continue;
      if (
        others.some(
          (o) =>
            o?.visible &&
            Math.abs(o.position.y - p.y) < 2 &&
            distance(o.position, p) < (o === saga.game.player.mesh ? 1.65 : 1.4),
        )
      )
        continue;
      actor.position.set(p.x, p.y, p.z);
      return true;
    }
  return false;
}
export function stageCast(saga, step) {
  const p = saga.game.player.pos,
    used = [saga.game.player.mesh];
  for (const [i, name] of (step.cast || ['ching', 'gabor']).entries()) {
    const a = saga.actors[name];
    if (!a) continue;
    const target = { x: p.x + (i ? -2.5 : 2.5), y: p.y, z: p.z + 1.5 };
    if (placeActor(saga, a, target, used)) a.visible = true;
    a.rotation.y = Math.atan2(p.x - a.position.x, p.z - a.position.z);
    used.push(a);
    if (step.id === 'landed' && name === 'ching') {
      const destination = a.position.clone(),
        start = destination.clone();
      start.z += 3;
      if (positionClear(start, 0.5, saga.game.zone) && segmentClear(saga.game.zone, start, destination)) {
        a.position.copy(start);
        a.userData.arrival = destination;
      }
    }
  }
}
export function animateActor(actor, speed, time) {
  const walk = Math.min(1, speed / 2),
    phase = time * 8;
  for (const [i, pivot] of (actor.userData.walkLegs || []).entries())
    pivot.rotation.x = Math.sin(phase + i * Math.PI) * 0.45 * walk;
  for (const [i, pivot] of (actor.userData.walkArms || []).entries())
    pivot.rotation.x = -Math.sin(phase + i * Math.PI) * 0.3 * walk;
  const head = actor.userData.head;
  if (head) head.rotation.z = Math.sin(time * 1.7) * 0.025 * (1 - walk);
}
export function followActor(saga, actor, dt) {
  const p = saga.here(),
    zone = saga.game.zone;
  let m = actor.userData.follow;
  if (!m) {
    placeActor(saga, actor, { x: p.x + 2.3, y: p.y, z: p.z }, [saga.game.player.mesh, saga.actors.gabor]);
    m = actor.userData.follow = { timer: 0, path: [], index: 1 };
  }
  m.timer -= dt;
  if (m.timer <= 0) {
    m.timer = 2;
    const target = {
      x: p.x + Math.cos(saga.game.player.facing) * 2.3,
      y: p.y,
      z: p.z - Math.sin(saga.game.player.facing) * 2.3,
    };
    m.path = localRoute(
      { ...actor.position },
      target,
      (a, b) => saga.actors.guide.userData.controller?.clear(a, b) ?? false,
    );
    if (!m.path.length && distance(actor.position, target) > 10)
      m.path = saga.actors.guide.userData.controller?.plan({ ...actor.position }, target) || [];
    m.index = 1;
  }
  const target = m.path[m.index];
  let speed = 0;
  if (target && distance(actor.position, p) > 2.2) {
    const d = distance(actor.position, target);
    if (d < 0.35) m.index++;
    else {
      speed = Math.min(saga.game.trolley.riding ? 8 : 4.8, d / Math.max(dt, 0.001));
      const dx = (target.x - actor.position.x) / d,
        dz = (target.z - actor.position.z) / d;
      const previous = actor.position.clone();
      moveHorizontal(actor.position, dx * speed * dt, dz * speed * dt, 0.48, zone);
      if (
        [saga.game.player.mesh, saga.actors.gabor].some(
          (o) => o?.visible && distance(o.position, actor.position) < 1.5,
        )
      )
        actor.position.copy(previous);
      actor.rotation.y = turnToward(actor.rotation.y, Math.atan2(dx, dz), dt, 7);
    }
  }
  actor.position.y = floorAt(saga, actor.position);
  animateActor(actor, speed, saga.game.elapsed);
  actor.visible = true;
}

export function tickSceneActors(saga, dt) {
  for (const actor of [saga.actors.ching, saga.actors.gabor]) {
    const target = actor?.userData.arrival;
    if (!target) continue;
    const d = distance(actor.position, target),
      step = Math.min(d, Math.min(dt, 0.1) * 1.6);
    if (d > 0.03) {
      moveHorizontal(
        actor.position,
        ((target.x - actor.position.x) / d) * step,
        ((target.z - actor.position.z) / d) * step,
        0.5,
        saga.game.zone,
      );
      actor.position.y = floorAt(saga, actor.position);
      animateActor(actor, 1.6, saga.game.elapsed);
    } else {
      delete actor.userData.arrival;
      animateActor(actor, 0, saga.game.elapsed);
    }
  }
}
