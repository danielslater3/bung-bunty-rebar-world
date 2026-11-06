import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  buildCityVehicle,
  buildStreetTree,
  buildCityPedestrian,
} from '../../src/world/geo/cityModels.js';
import {
  streetCircuits,
  circuitPoint,
  prepareCircuit,
  advanceService,
} from '../../src/world/geo/cityRoutes.js';
import {
  groundVehicle,
  routeAccessible,
} from '../../src/world/geo/cityLife.js';
import { createTerrain, easeKerbs } from '../../src/world/geo/terrain.js';
import { indexFootprints } from '../../src/world/geo/footprints.js';
import { BRISBANE_GEO as geo } from '../../src/world/geo/brisbane.data.js';
const square = prepareCircuit([
  { x: 0, z: 0 },
  { x: 0, z: 100 },
  { x: 100, z: 100 },
  { x: 100, z: 0 },
  { x: 0, z: 0 },
]);

test('city models have finite geometry, bounded mesh counts and actual ground-contact bases', () => {
  for (const [name, model, cap] of [
    ['car', buildCityVehicle(), 25],
    ['bus', buildCityVehicle({ bus: true }), 30],
    ['tree', buildStreetTree(), 5],
    ['palm', buildStreetTree(1, true), 5],
    ['pedestrian', buildCityPedestrian(3), 25],
  ]) {
    let meshes = 0,
      triangles = 0;
    model.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      const a = o.geometry.attributes.position.array;
      triangles += a.length / 9;
      for (const n of a) assert.ok(Number.isFinite(n), name);
    });
    assert.ok(meshes <= cap, `${name}: ${meshes} draw meshes`);
    assert.ok(triangles < 20000, `${name}: ${triangles} triangles`);
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    assert.ok(Math.abs(bounds.min.y) < 0.025, `${name}: base ${bounds.min.y}`);
  }
});
test('all ambient traffic circuits close on actual mapped vehicle-road segments', () => {
  const routes = streetCircuits(geo.roads);
  assert.ok(routes.length >= 8);
  const edges = new Set(),
    key = (a, b, c, d) => [a, b, c, d].map((v) => Math.round(v * 10)).join(',');
  for (const road of geo.roads) {
    if (road.py || road.k > 1 || road.w < 7) continue;
    for (let i = 2; i < road.p.length; i += 2) {
      const [a, b, c, d] = road.p.slice(i - 2, i + 2);
      edges.add(key(a, b, c, d));
      edges.add(key(c, d, a, b));
    }
  }
  for (const r of routes) {
    assert.deepEqual(r.points[0], r.points.at(-1));
    for (let i = 1; i < r.points.length; i++)
      assert.ok(
        edges.has(
          key(
            r.points[i - 1].x,
            r.points[i - 1].z,
            r.points[i].x,
            r.points[i].z,
          ),
        ),
      );
    const a = circuitPoint(r, r.length - 0.01),
      b = circuitPoint(r, r.length + 0.01);
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.021);
  }
});
test('real-map car and full-length bus sweeps avoid solid building footprints and water', () => {
  const terrain = createTerrain(
    geo.grid,
    Uint8Array.from(atob(geo.grid.ground), (c) => c.charCodeAt(0)),
  );
  easeKerbs(terrain, geo.roads);
  const feet = indexFootprints(geo.buildings, 48, (x, z) =>
      terrain.walkAt(x, z),
    ),
    zone = {
      terrain,
      colliders: [],
      footBuckets: feet.buckets,
      footCell: feet.cell,
    };
  const cars = streetCircuits(geo.roads).filter((r) =>
    routeAccessible(r, zone),
  );
  assert.ok(cars.length >= 8);
  assert.ok(cars.filter((r) => routeAccessible(r, zone, true)).length >= 3);
});
test('bus service brakes, dwells and revisits stops without teleporting at loop boundaries', () => {
  for (const fps of [30, 60, 120]) {
    const s = {
      route: square,
      bus: true,
      distance: 0,
      speed: 0,
      dwell: 0,
      visits: 0,
      nextStop: 0,
      stopDistance: 25,
      stops: [25, 125, 225, 325],
    };
    for (let i = 0; i < 180 * fps; i++) {
      const old = s.distance;
      advanceService(s, 1 / fps, 8);
      const delta = (s.distance - old + square.length) % square.length;
      assert.ok(delta <= 8 / fps + 0.151);
      assert.ok(s.speed >= 0 && s.speed <= 8);
      if (s.dwell) assert.equal(s.speed, 0);
    }
    assert.ok(s.visits >= 7, `${fps}: ${s.visits}`);
  }
});
test('wheel contact follows both longitudinal and transverse ground slopes', () => {
  for (const bus of [false, true]) {
    const model = buildCityVehicle({ bus }),
      s = {
        model,
        bus,
        route: square,
        distance: 40,
        pose: {},
        contacts: [0, 0, 0, 0],
        dwell: 0,
        dt: 1 / 60,
      };
    const terrain = { walkAt: (x, z) => 0.06 * x + 0.12 * z };
    groundVehicle(s, { terrain });
    model.updateMatrixWorld(true);
    for (const wheel of model.userData.wheels) {
      const p = wheel.getWorldPosition(new THREE.Vector3()),
        error = Math.abs(
          p.y - model.userData.wheelRadius - (terrain.walkAt(p.x, p.z) + 0.045),
        );
      assert.ok(error < 0.035, `${bus ? 'bus' : 'car'} wheel ${error}`);
    }
  }
});

test('grounded foundations collide down to repaired terrain while elevated structures keep their clearance', async () => {
  const { pushFootprints } = await import('../../src/world/geo/footprints.js');
  const ring = [0, 0, 10, 0, 10, 10, 0, 10];
  const feet = indexFootprints(
    [{ r: ring, g: 3, gm: 2, h: 10, b: 0 }],
    48,
    () => -4,
  );
  const zone = { footBuckets: feet.buckets, footCell: feet.cell },
    p = { x: 1, y: -4, z: 1 };
  pushFootprints(p, 0.5, -4, zone);
  assert.ok(p.x < 0 || p.z < 0);
  const raised = indexFootprints(
      [{ r: ring, g: 3, gm: 2, h: 10, b: 4 }],
      48,
      () => -4,
    ),
    under = { x: 1, y: 0, z: 1 };
  pushFootprints(under, 0.5, 0, {
    footBuckets: raised.buckets,
    footCell: raised.cell,
  });
  assert.deepEqual(under, { x: 1, y: 0, z: 1 });
});

test('the complete traffic controller keeps all services progressing through shared junctions', async () => {
  const { installCityLife } = await import('../../src/world/geo/cityLife.js');
  const previous = globalThis.document,
    context = { fillRect() {}, fillText() {} };
  globalThis.document = {
    createElement: () => ({ getContext: () => context }),
  };
  try {
    const terrain = createTerrain(
      geo.grid,
      Uint8Array.from(atob(geo.grid.ground), (c) => c.charCodeAt(0)),
    );
    easeKerbs(terrain, geo.roads);
    const feet = indexFootprints(geo.buildings, 48, (x, z) =>
      terrain.walkAt(x, z),
    );
    const zone = {
      group: new THREE.Group(),
      terrain,
      footBuckets: feet.buckets,
      footCell: feet.cell,
      colliders: [],
      interact() {},
      updaters: [],
      cleanups: [],
      game: { player: { pos: new THREE.Vector3(9000, 100, 9000) } },
    };
    const life = installCityLife(zone, geo);
    let maximumQueue = 0;
    for (let i = 0; i < 10000; i++) {
      life.update(0.1, i * 0.1);
      for (const s of life.services)
        maximumQueue = Math.max(maximumQueue, s.blockedFor || 0);
    }
    assert.ok(maximumQueue < 30, `permanent queue: ${maximumQueue}`);
    for (const bus of life.services.filter((s) => s.bus))
      assert.ok(bus.visits >= 12, `${bus.label}: ${bus.visits}`);
    for (const cleanup of zone.cleanups) cleanup();
    zone.group.traverse((o) => {
      o.geometry?.dispose();
      if (o.isInstancedMesh) o.dispose();
    });
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});

test('distant pedestrian silhouettes also have grounded feet', async () => {
  const { ZoneKit } = await import('../../src/world/ZoneKit.js');
  const zone = new ZoneKit(
    {
      player: { pos: new THREE.Vector3(80, 12, 0) },
      trolley: { riding: false },
    },
    'check',
    'none',
  );
  zone.groundAt = () => 12;
  zone.pedestrians(0, 0, 2, 2, 1, 42);
  zone.update(1 / 60, 0);
  const p = zone.cityPedestrians[0];
  assert.equal(p.low.visible, true);
  p.g.updateMatrixWorld(true);
  assert.ok(Math.abs(new THREE.Box3().setFromObject(p.low).min.y - 12) < 0.001);
  for (const cleanup of zone.cleanups) cleanup();
});

test('vehicle side windows are visible outside the painted body rather than buried in it', () => {
  for (const bus of [false, true]) {
    const model = buildCityVehicle({ bus });
    model.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(
      new THREE.Vector3(4, bus ? 2.2 : 1.27, bus ? 0 : 0.25),
      new THREE.Vector3(-1, 0, 0),
    );
    const hit = ray.intersectObject(model, true)[0];
    assert.equal(
      hit.object.material.color.getHex(),
      0x264652,
      bus ? 'bus glazing' : 'car glazing',
    );
  }
});
