import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { placeActor, animateActor } from '../../src/story/actors.js';
import { ChaseController } from '../../src/story/ChaseController.js';
test('actor placement respects ground, solids and personal spacing', () => {
  const player = new THREE.Group();
  player.position.set(0, 2, 0);
  const actor = new THREE.Group(),
    other = new THREE.Group();
  other.position.set(2, 2, 0);
  const zone = {
    colliders: [new THREE.Box3(new THREE.Vector3(-1, 0, 2), new THREE.Vector3(1, 5, 4))],
    groundAt: () => 2,
  };
  const saga = { game: { zone, player: { mesh: player }, indoorRoom: () => null } };
  assert.ok(placeActor(saga, actor, { x: 0, y: 2, z: 0 }, [player, other]));
  assert.equal(actor.position.y, 2);
  assert.ok(actor.position.distanceTo(player.position) >= 1.65);
  assert.ok(actor.position.distanceTo(other.position) >= 1.4);
  const base = actor.position.clone();
  animateActor(actor, 4, 10);
  assert.deepEqual(actor.position, base);
});
test('journey race reaches destination before finishing and resumes checkpoint', () => {
  const path = [
    { x: 0, y: 0, z: 0 },
    { x: 100, y: 0, z: 0 },
  ];
  let c = new ChaseController(path, { dist: 85 });
  assert.equal(
    c.update(0.016, { x: 85, y: 0, z: 0 }, { catching: true, riding: true, finishAtEnd: true }).finished,
    false,
  );
  c = new ChaseController(path, c.snapshot());
  let count = 0;
  for (let i = 0; i < 2000; i++)
    if (
      c.update(
        1 / 60,
        { x: Math.min(100, c.dist + 2), y: 0, z: 0 },
        { catching: true, riding: true, finishAtEnd: true },
      ).finished
    )
      count++;
  assert.equal(count, 1);
  assert.ok(c.dist >= 99);
});
