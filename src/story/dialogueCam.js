// Cinematic camera for scripted conversations only. Gameplay barks never
// set DialogueSystem line.cinematic, so they leave this alone.
import * as THREE from 'three';
import { damp, dampAngle } from '../core/utils.js';
import { clampMcRebar } from './mcrebar.js';

const UP = new THREE.Vector3(0, 1, 0);
const CAST = { bung: 1, gabor: 1, ching: 1, seb: 1 };

function meshOf(saga, name) {
  if (name === 'bung') return saga.game.player.mesh;
  return saga.actors?.[name] || null;
}

function facePoint(mesh, out) {
  const head = mesh.userData.head || mesh.userData.parts?.head;
  const hy = head ? head.position.y - 0.04 : 1.55;
  const yaw = mesh.rotation.y;
  out.set(
    mesh.position.x + Math.sin(yaw) * 0.12,
    mesh.position.y + hy,
    mesh.position.z + Math.cos(yaw) * 0.12,
  );
  return out;
}

function present(saga, name) {
  const mesh = meshOf(saga, name);
  if (!mesh || name === 'bung') return mesh;
  const bung = saga.game.player;
  const d = Math.hypot(mesh.position.x - bung.pos.x, mesh.position.z - bung.pos.z);
  const step = saga.currentStep();
  const chasing = step && (step.kind === 'follow' || step.kind === 'catch');
  if (mesh.visible && d < 18) return mesh;
  if (chasing && name === 'gabor' && mesh.visible) return mesh;
  if (mesh.visible && d >= 18) return null;
  const yaw = bung.mesh.rotation.y;
  let x = bung.pos.x + Math.sin(yaw) * 1.4;
  let z = bung.pos.z + Math.cos(yaw) * 1.4;
  const room = saga.game.indoorRoom(bung.pos.x, bung.pos.y + 1, bung.pos.z);
  if (room?.kind === 'bar') {
    const p = clampMcRebar(x, z, 0.8);
    x = p.x;
    z = p.z;
  } else if (room) {
    x = Math.max(room.minX + 0.5, Math.min(room.maxX - 0.5, x));
    z = Math.max(room.minZ + 0.5, Math.min(room.maxZ - 0.5, z));
  }
  mesh.position.set(x, bung.pos.y, z);
  mesh.visible = true;
  mesh.userData.camBrought = true;
  return mesh;
}

function partnerOf(saga, speakerName, speaker) {
  const names = ['gabor', 'ching', 'bung', 'seb'];
  let best = null;
  let bestD = 12;
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    if (name === speakerName) continue;
    const mesh = meshOf(saga, name);
    if (!mesh || !mesh.visible || mesh === speaker) continue;
    const d = Math.hypot(mesh.position.x - speaker.position.x, mesh.position.z - speaker.position.z);
    if (d < bestD) {
      bestD = d;
      best = mesh;
    }
  }
  return best;
}

function contain(pos, room) {
  if (!room) return pos;
  if (room.kind === 'bar') {
    const p = clampMcRebar(pos.x, pos.z, 0.55);
    pos.x = p.x;
    pos.z = p.z;
  } else {
    pos.x = Math.max(room.minX + 0.4, Math.min(room.maxX - 0.4, pos.x));
    pos.z = Math.max(room.minZ + 0.4, Math.min(room.maxZ - 0.4, pos.z));
  }
  pos.y = Math.max(room.floor + 1.2, Math.min(room.ceil - 0.22, pos.y));
  return pos;
}

function insideRoom(pos, room) {
  if (!room) return true;
  if (pos.y < room.floor + 0.8 || pos.y > room.ceil - 0.12) return false;
  if (room.kind === 'bar') {
    const p = clampMcRebar(pos.x, pos.z, 0);
    return Math.hypot(p.x - pos.x, p.z - pos.z) < 0.2;
  }
  return pos.x > room.minX + 0.15 && pos.x < room.maxX - 0.15 && pos.z > room.minZ + 0.15 && pos.z < room.maxZ - 0.15;
}

function cameraBlocked(game, pos) {
  const list = game.zone?.colliders;
  if (!list) return false;
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (pos.x <= b.min.x || pos.x >= b.max.x || pos.z <= b.min.z || pos.z >= b.max.z) continue;
    if (pos.y <= b.min.y || pos.y >= b.max.y) continue;
    return true;
  }
  return false;
}

function sees(game, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 0.75) return false;
  const dir = game._dialDir || (game._dialDir = new THREE.Vector3());
  dir.set(dx, dy, dz);
  const hit = game.cameraClearance(from, dir, dist);
  return hit > dist - 0.4;
}

function consider(game, face, pos, room, look, bag, other, frontYaw) {
  contain(pos, room);
  if (!insideRoom(pos, room)) return;
  if (cameraBlocked(game, pos)) return;
  if (other && pos.distanceTo(other) < 0.95) return;
  if (frontYaw != null) {
    const fx = Math.sin(frontYaw);
    const fz = Math.cos(frontYaw);
    if ((pos.x - face.x) * fx + (pos.z - face.z) * fz < 0.4) return;
  }
  if (!sees(game, face, pos)) return;
  const dist = pos.distanceTo(face);
  if (dist < 0.8 || dist > 6.5) return;
  bag.push({ pos: pos.clone(), look: look.clone(), dist });
}

function pickShot(game, face, other, room, wide, narrate) {
  const bag = [];
  const look = face.clone();
  if (other && wide) {
    look.copy(face).lerp(other, 0.5);
    look.y = (face.y + other.y) * 0.5;
    const axis = new THREE.Vector3().subVectors(other, face);
    axis.y = 0;
    if (axis.lengthSq() < 0.01) axis.set(1, 0, 0);
    axis.normalize();
    const side = new THREE.Vector3(-axis.z, 0, axis.x);
    for (const dist of [3.4, 4.4, 2.5]) {
      consider(game, face, look.clone().addScaledVector(side, dist), room, look, bag, other);
      consider(game, face, look.clone().addScaledVector(side, -dist), room, look, bag, other);
      if (bag.length) return bag[0];
    }
  }
  look.copy(face);
  let back = new THREE.Vector3();
  // Sit the camera on the speaker's face side, toward the person they are
  // talking to. The opposite vector frames the back of the head.
  if (other) back.subVectors(other, face);
  else back.set(Math.sin(game._dialYaw || 0), 0, Math.cos(game._dialYaw || 0));
  back.y = 0;
  if (back.lengthSq() < 0.01) back.set(0, 0, 1);
  back.normalize();
  const dists = narrate ? [3.3, 2.6, 4.1, 1.8] : [2.15, 2.8, 1.6, 3.5];
  const angles = [1.05, -1.05, 1.45, -1.45, 0.62, -0.62];
  for (let d = 0; d < dists.length; d++) {
    for (let a = 0; a < angles.length; a++) {
      const dir = back.clone().applyAxisAngle(UP, angles[a]);
      const pos = face.clone().addScaledVector(dir, dists[d]);
      pos.y = face.y + (wide ? 0.15 : 0.02);
      consider(game, face, pos, room, look, bag, other, game._dialYaw);
      if (bag.length) return bag[0];
    }
  }
  let best = null;
  let bestHit = -1;
  const yaw = game._dialYaw || 0;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  for (let k = 0; k < 10; k++) {
    const ang = (k / 10) * Math.PI * 2;
    const dir = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));
    const pos = face.clone().addScaledVector(dir, 1.7);
    pos.y = face.y;
    contain(pos, room);
    const front = (pos.x - face.x) * fx + (pos.z - face.z) * fz;
    const hit = game.cameraClearance(face, pos.clone().sub(face), 2.4) + (front > 0.3 ? 2 : 0);
    if (hit > bestHit && insideRoom(pos, room) && !cameraBlocked(game, pos) && sees(game, face, pos)) {
      bestHit = hit;
      best = pos;
    }
  }
  if (!best) {
    best = face.clone();
    const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const reach = game.cameraClearance(face, dir, 1.2);
    best.addScaledVector(dir, Math.max(.12, reach - .2));
    contain(best, room);
  }
  return { pos: best, look, dist: best.distanceTo(face) };
}

function talk(mesh, speaking, t, dt) {
  const head = mesh.userData.head || mesh.userData.parts?.head;
  const mouth = mesh.userData.mouth || mesh.userData.parts?.mouth;
  const arm = mesh.userData.armR || mesh.userData.parts?.armR;
  if (head) {
    const nx = speaking ? Math.sin(t * 6.5) * 0.07 : 0;
    const ny = speaking ? Math.sin(t * 2.1) * 0.14 : 0;
    head.rotation.x = damp(head.rotation.x, nx, 8, dt);
    head.rotation.y = damp(head.rotation.y, ny, 8, dt);
  }
  if (mouth) {
    const s = speaking ? 0.35 + Math.abs(Math.sin(t * 13)) * 1.35 : 1;
    mouth.scale.y = damp(mouth.scale.y, s, 14, dt);
  }
  if (arm && speaking && !mesh.userData.parts) {
    arm.rotation.x = damp(arm.rotation.x, -0.45 + Math.sin(t * 3.2) * 0.35, 6, dt);
  } else if (arm && mesh.userData.parts && speaking) {
    arm.rotation.x = -0.55 + Math.sin(t * 3.2) * 0.45;
  } else if (arm && !mesh.userData.parts) {
    arm.rotation.x = damp(arm.rotation.x, 0, 6, dt);
  }
}

function faceToward(mesh, target, dt, player, allow) {
  if (!allow) return;
  const dx = target.position.x - mesh.position.x;
  const dz = target.position.z - mesh.position.z;
  if (dx * dx + dz * dz < 0.25) return;
  const yaw = Math.atan2(dx, dz);
  if (player) {
    player.facing = dampAngle(player.facing, yaw, 7, dt);
    mesh.rotation.y = player.facing;
  } else {
    mesh.rotation.y = dampAngle(mesh.rotation.y, yaw, 7, dt);
  }
}

export function frameDialogue(saga, dt) {
  const game = saga.game;
  const line = game.dialogue.current;
  if (!line?.cinematic) return;
  if (!game.trolley.riding) game.player.mesh.position.copy(game.player.pos);
  const named = CAST[line.speaker] ? line.speaker : 'bung';
  const speaker = present(saga, named) || game.player.mesh;
  const otherName = named === 'bung' ? 'gabor' : 'bung';
  let partner = partnerOf(saga, named, speaker);
  if (!partner && named !== 'bung') partner = game.player.mesh;
  if (!partner && otherName !== named) {
    const maybe = meshOf(saga, otherName);
    if (maybe?.visible) partner = maybe;
  }
  const narrate = !CAST[line.speaker];
  const wide = !!(partner && line.i % 4 === 0);
  const moving = Math.hypot(game.input.axis().x, game.input.axis().y) > 0.1;
  const riding = game.trolley.riding;
  if (partner && speaker !== partner) {
    faceToward(speaker, partner, dt, speaker === game.player.mesh ? game.player : null, !(speaker === game.player.mesh && (riding || (moving && game.mode !== 'cutscene'))));
    faceToward(partner, speaker, dt, partner === game.player.mesh ? game.player : null, !(partner === game.player.mesh && (riding || (moving && game.mode !== 'cutscene'))));
  }
  const t = game.elapsed;
  talk(speaker, true, t, dt);
  if (partner && partner !== speaker) talk(partner, false, t, dt);

  const face = facePoint(speaker, game._dialFace || (game._dialFace = new THREE.Vector3()));
  const other = partner ? facePoint(partner, game._dialOther || (game._dialOther = new THREE.Vector3())) : null;
  game._dialYaw = speaker.rotation.y;
  const room = game.indoorRoom(speaker.position.x, speaker.position.y + 1.2, speaker.position.z);
  // Keep a chosen angle for the line; head animation must not reselect a
  // different side every frame. Re-evaluate if the actor actually moves.
  let cache = saga._dialogueShot;
  if (!cache || cache.line !== line || cache.face.distanceTo(face) > .6) {
    cache = saga._dialogueShot = { line, face: face.clone(), shot: pickShot(game, face, other, room, wide, narrate) };
  }
  const shot = cache.shot;
  const pull = 4.2;
  game.camPos.x = damp(game.camPos.x, shot.pos.x, pull, dt);
  game.camPos.y = damp(game.camPos.y, shot.pos.y, pull, dt);
  game.camPos.z = damp(game.camPos.z, shot.pos.z, pull, dt);
  if (room) contain(game.camPos, room);
  const span = game._dialSpan || (game._dialSpan = new THREE.Vector3());
  span.copy(game.camPos).sub(shot.look);
  const spanLen = span.length();
  if (spanLen > 0.5) {
    const hit = game.cameraClearance(shot.look, span, spanLen);
    if (hit < spanLen - 0.25) {
      game.camPos.copy(shot.look).addScaledVector(span, Math.max(.12, hit - .2) / spanLen);
      if (room) contain(game.camPos, room);
    }
  }
  // A smooth transition can cross furniture even when both shots are clear.
  // Room clamping can also push the ray-shortened position back into a wall.
  // Validate the final position, including the first frame of a new scene.
  if (cameraBlocked(game, game.camPos) || !insideRoom(game.camPos, room)) {
    game.camPos.copy(shot.pos);
  }
  game.camera.position.copy(game.camPos);
  const look = game._dialLook || (game._dialLook = shot.look.clone());
  look.x = damp(look.x, shot.look.x, 6, dt);
  look.y = damp(look.y, shot.look.y, 6, dt);
  look.z = damp(look.z, shot.look.z, 6, dt);
  game.camera.lookAt(look);
  const fov = wide ? 50 : (narrate ? 46 : 40);
  game._fovCurrent = damp(game._fovCurrent, fov, 5, dt);
  if (Math.abs(game.camera.fov - game._fovCurrent) > 0.05) {
    game.camera.fov = game._fovCurrent;
    game.camera.updateProjectionMatrix();
  }
}

export function resetTalk(saga) {
  const meshes = [saga.game.player.mesh, saga.actors?.gabor, saga.actors?.ching, saga.actors?.seb];
  for (let i = 0; i < meshes.length; i++) {
    const mesh = meshes[i];
    if (!mesh) continue;
    const head = mesh.userData.head || mesh.userData.parts?.head;
    const mouth = mesh.userData.mouth || mesh.userData.parts?.mouth;
    if (head) { head.rotation.x = 0; head.rotation.y = 0; }
    if (mouth) mouth.scale.y = 1;
    if (mesh.userData.camBrought) {
      mesh.visible = false;
      mesh.userData.camBrought = false;
    }
  }
  saga.game._dialLook = null;
  saga._dialogueShot = null;
}
