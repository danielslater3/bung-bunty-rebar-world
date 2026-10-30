import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SurfaceIndex } from '../../src/world/geo/surfaces.js';
import { drapePolygon, drapeRibbon, deckProfile, ribbon3d } from '../../src/world/geo/drape.js';
import { createTerrain, easeKerbs } from '../../src/world/geo/terrain.js';
import { BRISBANE_GEO as SOURCE_GEO } from '../../src/world/geo/brisbane.data.js';
import { CHASE_PATH } from '../../src/story/sagaData.js';
import { indexFootprints, pushFootprints } from '../../src/world/geo/footprints.js';
import { prepareGeography, smoothProfile } from '../../src/world/geo/stability.js';
const GEO = prepareGeography(SOURCE_GEO);
const ground = Uint8Array.from(atob(GEO.grid.ground), (c) => c.charCodeAt(0));
const terrain = createTerrain(GEO.grid, ground);
easeKerbs(terrain, GEO.roads);
test('road surfaces face upward with no degenerate triangles, including turns', () => {
  const p = [];
  drapeRibbon(
    p,
    [
      [0, 0],
      [20, 0],
      [20, 20],
      [10, 20],
    ],
    4,
    (x, z) => x * 0.05 + z * 0.03,
  );
  ribbon3d(
    p,
    [
      [0, 0, 0],
      [10, 1, 0],
      [10, 2, 10],
    ],
    3,
    () => 0,
    0.04,
  );
  drapePolygon(p, [0, 0, 10, 0, 10, 10, 0, 10], () => 2);
  assert.ok(p.length > 0);
  for (let i = 0; i < p.length; i += 9) {
    const ny = (p[i + 5] - p[i + 2]) * (p[i + 6] - p[i]) - (p[i + 3] - p[i]) * (p[i + 8] - p[i + 2]);
    assert.ok(ny > 1e-7, 'surface points down or has no area');
  }
});
test('continuous triangle heights, edges, stacked decks and underpasses', () => {
  const s = new SurfaceIndex(2);
  s.add([0, 0, 0, 10, 2, 0, 0, 0, 10, 10, 2, 0, 10, 2, 10, 0, 0, 10]);
  s.add([0, 8, 0, 10, 8, 0, 0, 8, 10]);
  assert.equal(s.heightAt(5, 2, 1), 1);
  assert.equal(s.heightAt(5, 2, 8), 8);
  assert.equal(s.heightAt(10, 5, 2), 2);
  assert.equal(s.heightAt(10.01, 5, 2), -Infinity);
  for (let x = 0; x <= 10; x += 0.1) assert.ok(Math.abs(s.heightAt(x, 8, 2) - x * 0.2) < 1e-6);
});
test('every bridge polygon produces finite traversable triangles matching its profile', () => {
  let samples = 0;
  for (const b of GEO.bridges) {
    const p = [],
      y = deckProfile(b),
      s = new SurfaceIndex();
    assert.ok(
      drapePolygon(p, b.ring, (x, z) => y(x, z) + 0.06, 8),
      b.name,
    );
    s.add(p);
    assert.ok(s.count > 0, b.name);
    for (let i = 0; i < p.length; i += 9) {
      const x = (p[i] + p[i + 3] + p[i + 6]) / 3,
        z = (p[i + 2] + p[i + 5] + p[i + 8]) / 3;
      const avg = (p[i + 1] + p[i + 4] + p[i + 7]) / 3;
      assert.ok(Number.isFinite(avg), b.name);
      assert.ok(
        Math.abs(s.heightAt(x, z) - avg) < 0.001,
        `${b.name || b.osm}: ${x},${z} expected ${avg} got ${s.heightAt(x, z)}`,
      );
      // Linear triangle interpolation approximates the sampled deck profile.
      assert.ok(Math.abs(avg - y(x, z) - 0.06) < 0.35, `${b.name} profile error`);
      samples++;
    }
  }
  console.log(`Validated ${GEO.bridges.length} bridge polygons / ${samples} surface samples`);
});
test('all elevated roads yield finite, nonempty continuous ribbons', () => {
  let count = 0;
  for (const road of GEO.roads.filter((r) => r.py)) {
    const pts = [];
    for (let i = 0; i < road.p.length; i += 3) pts.push([road.p[i], road.p[i + 2], road.p[i + 1]]);
    const out = [];
    ribbon3d(out, pts, road.w / 2, (x, z) => Math.max(terrain.heightAt(x, z), -0.2), 0.04);
    assert.ok(out.length > 0);
    assert.ok(out.every(Number.isFinite));
    count++;
  }
  console.log(`Validated ${count} elevated road ribbons`);
});
test('Queen Street route clears building footprints at 0.5 metre intervals', () => {
  const feet = indexFootprints(GEO.buildings),
    zone = { footBuckets: feet.buckets, footCell: feet.cell };
  const problems = [];
  for (let i = 1; i < CHASE_PATH.length; i++) {
    const a = CHASE_PATH[i - 1],
      b = CHASE_PATH[i],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5);
    for (let j = 0; j <= n; j++) {
      const x = a[0] + ((b[0] - a[0]) * j) / n,
        z = a[1] + ((b[1] - a[1]) * j) / n,
        p = { x, z };
      pushFootprints(p, 0.85, terrain.walkAt(x, z), zone);
      if (Math.hypot(p.x - x, p.z - z) > 0.05) problems.push({ i, x, z, dx: p.x - x, dz: p.z - z });
    }
  }
  assert.deepEqual(problems.slice(0, 12), []);
});

test('deck repairs preserve endpoints and bound intermediate grade', () => {
  assert.ok(GEO.repairs.length > 0);
  for (let i = 0; i < GEO.bridges.length; i++) {
    const b = GEO.bridges[i],
      old = SOURCE_GEO.bridges[i];
    if (!b.ys) continue;
    assert.equal(b.ys[0], old.ys[0]);
    assert.equal(b.ys.at(-1), old.ys.at(-1));
    const length = Math.hypot(b.bx - b.ax, b.bz - b.az),
      limit = Math.max(0.18, Math.abs(b.ys.at(-1) - b.ys[0]) / length);
    for (let k = 1; k < b.ys.length; k++)
      assert.ok(Math.abs(b.ys[k] - b.ys[k - 1]) / (length / (b.ys.length - 1)) <= limit + 1e-7);
  }
  console.log(`Repaired ${GEO.repairs.length} noisy deck profiles without moving endpoints`);
});
