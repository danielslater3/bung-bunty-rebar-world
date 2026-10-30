import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NavigationController,
  RoadNetwork,
  turnToward,
  localRoute,
  nearestOnPath,
} from '../../src/systems/Navigation.js';
const p = (x, z, y = 0) => ({ x, z, y });
test('shortest-angle rotation is frame independent across +/- pi', () => {
  const target = -Math.PI + 0.1;
  let a = Math.PI - 0.1,
    b = a;
  for (let i = 0; i < 30; i++) a = turnToward(a, target, 1 / 30);
  for (let i = 0; i < 120; i++) b = turnToward(b, target, 1 / 120);
  assert.ok(Math.abs(a - b) < 1e-10);
  assert.ok(a > Math.PI);
});
test('target changes, moving targets, missing target, load recreation', () => {
  let plans = 0;
  const nav = new NavigationController((a, b) => {
    plans++;
    return [a, b];
  });
  const tick = (target, key = 'one', dt = 0.1) => nav.update({ key, from: p(0, 0), target, dt });
  assert.equal(tick(p(0, 20)).distance, 20);
  assert.equal(plans, 1);
  tick(p(0, 30), 'two');
  assert.equal(plans, 2);
  tick(p(0, 40), 'two', 2);
  assert.equal(plans, 3);
  assert.equal(tick(null), null);
  assert.equal(nav.path.length, 0);
  assert.equal(tick(p(0, 20)).distance, 20);
  const loaded = new NavigationController((a, b) => [a, b]);
  assert.equal(loaded.update({ key: 'two', from: p(0, 0), target: p(0, 20), dt: 0.1 }).distance, 20);
});
test('routes follow graph corners; overpasses do not connect vertically', () => {
  const roads = [
    { p: [0, 0, 0, 20, 20, 20], w: 4 },
    { p: [0, 10, 10, 20, 10, 10], py: 1, w: 4 },
  ];
  const net = new RoadNetwork(
    roads,
    () => 0,
    (a, b) => Math.abs(a.y - b.y) < 1 && Math.hypot(a.x - b.x, a.z - b.z) < 1,
  );
  // Connections from endpoints only; edge validation separate for this synthetic graph.
  net.clear = (a, b) => Math.abs(a.y - b.y) < 1 && (a.x === b.x || a.z === b.z);
  const route = net.route(p(0, 0), p(20, 20));
  assert.ok(route.length > 2);
  assert.ok(route.some((q) => q.x === 0 && q.z === 20));
  assert.equal(net.route(p(0, 0), p(20, 10, 10)).length, 0);
});
test('local route goes around a wall, cannot cross a sealed room', () => {
  const clear = (a, b) => {
    for (let t = 0; t <= 1; t += 0.1) {
      const x = a.x + (b.x - a.x) * t,
        z = a.z + (b.z - a.z) * t;
      if (x > 3 && x < 5 && z > -3 && z < 3) return false;
    }
    return true;
  };
  const route = localRoute(p(0, 0), p(8, 0), clear);
  assert.ok(route.some((q) => Math.abs(q.z) >= 3));
  for (let i = 1; i < route.length; i++) assert.ok(clear(route[i - 1], route[i]));
  assert.equal(localRoute(p(0, 0), p(8, 0), () => false).length, 0);
});
test('vertical objectives maintain a stable horizontal heading', () => {
  const n = new NavigationController((a, b) => [a, b]);
  const r = n.update({ key: 'up', from: p(0, 0), target: p(0, 0, 4), dt: 0.016 });
  assert.ok(Number.isFinite(r.yaw));
  assert.equal(r.vertical, 4);
});
test('duplicate waypoints and arrival never produce infinite distance', () => {
  const a = p(1, 2),
    n = new NavigationController(() => [a, { ...a }]);
  const r = n.update({ key: 'arrived', from: a, target: a, dt: 1 / 60 });
  assert.equal(r.distance, 0);
  assert.ok(Number.isFinite(r.yaw));
  assert.equal(nearestOnPath([a], p(4, 6)).off, 5);
});
