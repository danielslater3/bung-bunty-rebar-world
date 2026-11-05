import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { VenueFrame, containsCollider } from '../../src/core/colliderSpace.js';
import { moveHorizontal, positionClear } from '../../src/core/motion.js';
import { segmentClear } from '../../src/story/guide.js';
import { Game } from '../../src/core/Game.js';
import {
  venueBuilding,
  migrateVenues,
  HOTEL_FLOORS,
  hotelTarget,
} from '../../src/story/venueData.js';
import { CHAPTERS, createSaga } from '../../src/story/sagaData.js';
import { BRISBANE_GEO } from '../../src/world/geo/brisbane.data.js';
const inside = (p, r) => {
  let n = 0;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2)
    if (
      r[i + 1] > p.z !== r[j + 1] > p.z &&
      p.x < ((r[j] - r[i]) * (p.z - r[i + 1])) / (r[j + 1] - r[i + 1]) + r[i]
    )
      n++;
  return !!(n % 2);
};
test('both streamed venue floor envelopes stay inside their original mapped footprints', () => {
  const sites = [
    ['hotel', -115.31, 214.79, 32, 32],
    ['court', -183, -112, 24, 28],
  ];
  for (const [kind, x, z, w, d] of sites) {
    const bs = BRISBANE_GEO.buildings.filter((b) => venueBuilding(b) === kind);
    assert.equal(bs.length, 1);
    const frame = new VenueFrame(x, z, 0.714, 0.9);
    for (let xx = -w / 2; xx <= w / 2; xx += 0.5)
      for (let zz = -d / 2; zz <= d / 2; zz += 0.5)
        assert.ok(
          inside(frame.world({ x: xx, z: zz, y: 0 }), bs[0].r),
          `${kind} footprint ${xx},${zz}`,
        );
  }
});
test('rotated collider frames roundtrip in place and stop swept movement without AABB aisle obstructions', () => {
  const frame = new VenueFrame(75, 130, 0.714, 0.9),
    localBox = new THREE.Box3(
      new THREE.Vector3(2, 0, -4),
      new THREE.Vector3(2.15, 3, 4),
    );
  const b = localBox.clone();
  b.localBox = localBox;
  b.frame = frame;
  const zone = { colliders: [b] };
  const p = frame.world({ x: 0, y: 0, z: 0 });
  const initial = { ...p };
  frame.local(p, p);
  assert.ok(Math.abs(p.x) < 1e-9);
  frame.world(p, p);
  assert.ok(Math.hypot(initial.x - p.x, initial.z - p.z) < 1e-9);
  const end = frame.world({ x: 8, y: 0, z: 0 });
  moveHorizontal(p, end.x - p.x, end.z - p.z, 0.5, zone);
  assert.ok(frame.local(p).x < 1.5);
  assert.ok(positionClear(p, 0.5, zone));
  const a = frame.world({ x: 0, y: 0, z: 0 }),
    c = frame.world({ x: 0, y: 0, z: 3 });
  assert.ok(segmentClear(zone, a, c));
  assert.equal(segmentClear(zone, a, end), false);
  assert.ok(containsCollider(b, frame.world({ x: 2.1, y: 1, z: 0 })));
});
test('gameplay camera intersects rotated walls using true local planes', () => {
  const f = new VenueFrame(75, 130, 0.714, 0.9),
    box = new THREE.Box3(
      new THREE.Vector3(2, 0, -4),
      new THREE.Vector3(2.15, 3, 4),
    );
  box.localBox = box.clone();
  box.frame = f;
  const o = f.world({ x: 0, y: 1.5, z: 0 }),
    end = f.world({ x: 8, y: 1.5, z: 0 }),
    dir = new THREE.Vector3(end.x - o.x, 0, end.z - o.z);
  const game = { zone: { colliders: [box] } };
  const d = Game.prototype.cameraClearance.call(
    game,
    new THREE.Vector3(o.x, o.y, o.z),
    dir,
    10,
  );
  assert.ok(d > 1.5 && d < 1.9, d);
});
test('legacy hotel saves migrate by old story beat; migration is idempotent and preserves earned rewards', () => {
  for (const [old, id] of ['invite', 'dance', 'newphone', 'toast'].entries()) {
    const s = {
      chapter: 9,
      step: old,
      stepState: {},
      done: ['ch9'],
      evidence: ['photo'],
    };
    assert.equal(migrateVenues(s, CHAPTERS), true);
    assert.equal(CHAPTERS[9].steps[s.step].id, id);
    assert.deepEqual(s.evidence, ['photo']);
    const saved = JSON.stringify(s);
    assert.equal(migrateVenues(s, CHAPTERS), false);
    assert.equal(JSON.stringify(s), saved);
  }
  const completed = { chapter: 9, step: 4, done: ['ch10'] };
  migrateVenues(completed, CHAPTERS);
  assert.equal(completed.step, CHAPTERS[9].steps.length);
  assert.equal(migrateVenues(createSaga(), CHAPTERS), false);
});
test('every hotel mission floor is an accessible lift stop; all chapter beat ids remain unique', () => {
  const floors = new Set(HOTEL_FLOORS.map((f) => f.n));
  for (const step of CHAPTERS[9].steps) {
    const floor = hotelTarget(step.at);
    if (floor !== undefined) assert.ok(floors.has(floor), step.id);
  }
  for (const i of [8, 9])
    assert.equal(
      new Set(CHAPTERS[i].steps.map((s) => s.id)).size,
      CHAPTERS[i].steps.length,
    );
  assert.ok(
    CHAPTERS[8].steps
      .find((s) => s.id === 'trial')
      .questions.some((q) => q.answer === 'goggles'),
  );
  assert.equal(CHAPTERS[8].reward.coins, 10000);
});
