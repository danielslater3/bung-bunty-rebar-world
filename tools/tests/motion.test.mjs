import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveHorizontal, resolveHorizontal, positionClear } from '../../src/core/motion.js';
import { footprintClearance, indexFootprints } from '../../src/world/geo/footprints.js';
const box = { min: { x: 2, y: 0, z: -3 }, max: { x: 2.12, y: 3, z: 3 } },
  zone = { colliders: [box] };
test('fast trolley and grapple motion cannot tunnel through a thin wall', () => {
  for (const radius of [0.55, 0.8]) {
    const p = { x: 0, y: 0, z: 0 };
    assert.equal(moveHorizontal(p, 15, 0, radius, zone), true);
    assert.ok(p.x <= 2 - radius + 0.001);
  }
});
test('vehicle centre inside a collider is pushed out; floor tops remain traversable', () => {
  const p = { x: 2.05, y: 0, z: 0 };
  resolveHorizontal(p, 0.8, zone);
  assert.ok(positionClear(p, 0.8, zone));
  const top = { x: 2.05, y: 3, z: 0 };
  resolveHorizontal(top, 0.8, zone);
  assert.equal(top.x, 2.05);
});
test('camera respects nearby footprint facades and height clearance', () => {
  const f = indexFootprints([{ r: [0, 0, 10, 0, 10, 10, 0, 10], b: 0, h: 10 }]);
  const z = { footBuckets: f.buckets, footCell: f.cell };
  assert.equal(footprintClearance(z, { x: -5, y: 2, z: 5 }, { x: 1, y: 0, z: 0 }, 12), 5);
  assert.equal(footprintClearance(z, { x: -5, y: 12, z: 5 }, { x: 1, y: 0, z: 0 }, 12), 12);
});
