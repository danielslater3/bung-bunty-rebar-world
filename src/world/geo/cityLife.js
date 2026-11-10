import * as THREE from 'three';
import { rng } from '../../core/utils.js';
import { positionClear } from '../../core/motion.js';
import { VenueFrame } from '../../core/colliderSpace.js';
import { PLACE } from '../../story/sagaData.js';
import { buildCityVehicle, buildStreetTree } from './cityModels.js';
import {
  streetCircuits,
  circuitPoint,
  advanceService,
  angleDelta,
} from './cityRoutes.js';

const anchors = Object.values(PLACE);
const nearMission = (x, z, r = 7) =>
  anchors.some((p) => Math.hypot(p.x - x, p.z - z) < r);
function inside(r, x, z) {
  let result = false;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2)
    if (
      r[i + 1] > z !== r[j + 1] > z &&
      x < ((r[j] - r[i]) * (z - r[i + 1])) / (r[j + 1] - r[i + 1]) + r[i]
    )
      result = !result;
  return result;
}
const tangentBefore = {},
  tangentAfter = {};
export function vehiclePosition(route, distance, out = {}) {
  circuitPoint(route, distance, out);
  const before = circuitPoint(route, distance - 2, tangentBefore),
    after = circuitPoint(route, distance + 3, tangentAfter);
  out.yaw = Math.atan2(after.x - before.x, after.z - before.z);
  // Left-hand lane, still inside the mapped width even on a 7 m local road.
  out.x -= Math.cos(out.yaw) * 0.7;
  out.z += Math.sin(out.yaw) * 0.7;
  return out;
}
export function routeAccessible(route, zone, bus = false) {
  const width = bus ? 2.4 : 1.78,
    length = bus ? 9.6 : 4.15,
    p = {};
  for (let d = 0; d < route.length; d += 3) {
    vehiclePosition(route, d, p);
    const s = Math.sin(p.yaw),
      c = Math.cos(p.yaw);
    for (const a of [-1, 1])
      for (const b of [-1, 1]) {
        const x = p.x + c * a * width * 0.5 + s * b * length * 0.5,
          z = p.z - s * a * width * 0.5 + c * b * length * 0.5;
        if (
          zone.terrain.isWater(x, z) ||
          !positionClear(
            { x, y: zone.terrain.walkAt(x, z) + 0.05, z },
            0.12,
            zone,
          )
        )
          return false;
      }
  }
  return true;
}
export function groundVehicle(service, zone) {
  const g = service.model,
    p = vehiclePosition(service.route, service.distance, service.pose),
    s = Math.sin(p.yaw),
    c = Math.cos(p.yaw),
    r = g.userData.wheelRadius,
    wheels = g.userData.wheels;
  let front = 0,
    rear = 0,
    left = 0,
    right = 0;
  for (let i = 0; i < 4; i++) {
    const wheel = wheels[i],
      x = p.x + c * wheel.position.x + s * wheel.position.z,
      z = p.z - s * wheel.position.x + c * wheel.position.z;
    const y = zone.terrain.walkAt(x, z) + 0.045;
    service.contacts[i] = y;
    if (wheel.position.z > 0) front += y / 2;
    else rear += y / 2;
    if (wheel.position.x > 0) right += y / 2;
    else left += y / 2;
  }
  const ground = (front + rear) / 2,
    axles = service.bus ? 5.6 : 2.5,
    track = service.bus ? 2.36 : 1.74;
  const pitch = -Math.atan2(front - rear, axles),
    roll = Math.atan2(right - left, track);
  g.position.set(p.x, ground, p.z);
  g.rotation.set(pitch, p.yaw, roll, 'YXZ');
  if (service.collider) {
    const b = service.collider,
      halfW = g.userData.width / 2,
      halfL = g.userData.length / 2,
      hx = Math.abs(c) * halfW + Math.abs(s) * halfL,
      hz = Math.abs(s) * halfW + Math.abs(c) * halfL;
    b.frame.x = p.x;
    b.frame.z = p.z;
    b.frame.c = c;
    b.frame.s = s;
    b.localBox.min.set(-halfW, ground + 0.25, -halfL);
    b.localBox.max.set(halfW, ground + (service.bus ? 3.1 : 1.6), halfL);
    b.min.set(p.x - hx, ground + 0.25, p.z - hz);
    b.max.set(p.x + hx, ground + (service.bus ? 3.1 : 1.6), p.z + hz);
  }
  for (let i = 0; i < 4; i++) {
    const wheel = wheels[i],
      predicted =
        ground -
        wheel.position.z * Math.sin(pitch) +
        wheel.position.x * Math.sin(roll);
    wheel.position.y = r + (service.contacts[i] - predicted);
  }
  // Correct each suspension point against the actual draped road, including
  // non-planar DEM cells, instead of leaving the low-side tyres in the air.
  g.updateMatrix();
  const e = g.matrix.elements,
    sideGrade = (right - left) / track,
    forwardGrade = (front - rear) / axles;
  const gx = c * sideGrade + s * forwardGrade,
    gz = -s * sideGrade + c * forwardGrade;
  const vertical = Math.max(0.3, e[5] - gx * e[4] - gz * e[6]);
  for (const wheel of wheels)
    for (let pass = 0; pass < 3; pass++) {
      const x =
        e[0] * wheel.position.x +
        e[4] * wheel.position.y +
        e[8] * wheel.position.z +
        e[12];
      const y =
        e[1] * wheel.position.x +
        e[5] * wheel.position.y +
        e[9] * wheel.position.z +
        e[13];
      const z =
        e[2] * wheel.position.x +
        e[6] * wheel.position.y +
        e[10] * wheel.position.z +
        e[14];
      wheel.position.y +=
        (zone.terrain.walkAt(x, z) + 0.045 + r - y) / vertical;
    }
  if (g.userData.doors)
    g.userData.doors.rotation.y = THREE.MathUtils.damp(
      g.userData.doors.rotation.y,
      service.dwell > 0 ? -1.1 : 0,
      5,
      service.dt || 0,
    );
}
function populateTrees(root, zone, geo) {
  const random = rng(7443),
    locations = [];
  // Sparse clusters on actual park polygons, with paths and mission pads clear.
  const roads = geo.roads.filter((r) => !r.py),
    cells = new Map(),
    cell = 32;
  for (const road of roads)
    for (let i = 2; i < road.p.length; i += 2) {
      const [ax, az, bx, bz] = road.p.slice(i - 2, i + 2),
        pad = road.w * 0.5 + 3;
      for (
        let z = Math.floor((Math.min(az, bz) - pad) / cell);
        z <= Math.floor((Math.max(az, bz) + pad) / cell);
        z++
      )
        for (
          let x = Math.floor((Math.min(ax, bx) - pad) / cell);
          x <= Math.floor((Math.max(ax, bx) + pad) / cell);
          x++
        ) {
          const key = x + ',' + z;
          if (!cells.has(key)) cells.set(key, []);
          cells.get(key).push({ ax, az, bx, bz, pad });
        }
    }
  const roadClear = (x, z) =>
    (cells.get(Math.floor(x / cell) + ',' + Math.floor(z / cell)) || []).every(
      (e) => {
        const dx = e.bx - e.ax,
          dz = e.bz - e.az,
          t = Math.max(
            0,
            Math.min(
              1,
              ((x - e.ax) * dx + (z - e.az) * dz) / (dx * dx + dz * dz || 1),
            ),
          );
        return Math.hypot(x - e.ax - dx * t, z - e.az - dz * t) > e.pad;
      },
    );
  for (const park of geo.parks
    .filter((p) => p.ring?.length >= 6)
    .slice(0, 80)) {
    const r = park.ring,
      xs = r.filter((_, i) => i % 2 === 0),
      zs = r.filter((_, i) => i % 2 === 1),
      x0 = Math.min(...xs),
      x1 = Math.max(...xs),
      z0 = Math.min(...zs),
      z1 = Math.max(...zs);
    const desired = Math.min(
      28,
      Math.max(2, Math.floor(((x1 - x0) * (z1 - z0)) / 1800)),
    );
    let added = 0;
    for (
      let attempt = 0;
      attempt < desired * 35 && added < desired && locations.length < 220;
      attempt++
    ) {
      const x = x0 + random() * (x1 - x0),
        z = z0 + random() * (z1 - z0),
        y = zone.terrain.walkAt(x, z);
      if (
        !inside(r, x, z) ||
        zone.terrain.isWater(x, z) ||
        nearMission(x, z, 9) ||
        !roadClear(x, z) ||
        !positionClear({ x, y, z }, 1.8, zone)
      )
        continue;
      if (locations.some((p) => Math.hypot(p.x - x, p.z - z) < 7)) continue;
      const grade =
        Math.abs(
          zone.terrain.walkAt(x + 1, z) - zone.terrain.walkAt(x - 1, z),
        ) +
        Math.abs(zone.terrain.walkAt(x, z + 1) - zone.terrain.walkAt(x, z - 1));
      if (grade > 1.2) continue;
      locations.push({
        x,
        y,
        z,
        scale: 0.8 + random() * 0.6,
        yaw: random() * Math.PI * 2,
        palm: locations.length % 4 === 0,
      });
      added++;
    }
  }
  const batches = [];
  for (const palm of [false, true]) {
    const model = buildStreetTree(0, palm),
      list = locations.filter((p) => p.palm === palm);
    for (const source of model.children) {
      if (!source.isMesh) continue;
      const mesh = new THREE.InstancedMesh(
        source.geometry,
        source.material,
        list.length,
      );
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
      batches.push({ mesh, list });
    }
  }
  const dummy = new THREE.Object3D();
  const update = (p) => {
    for (const { mesh, list } of batches) {
      let n = 0;
      for (const at of list) {
        if (Math.hypot(at.x - p.x, at.z - p.z) > 420) continue;
        dummy.position.set(at.x, at.y, at.z);
        dummy.scale.setScalar(at.scale);
        dummy.rotation.set(0, at.yaw, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(n++, dummy.matrix);
      }
      mesh.count = n;
      mesh.visible = n > 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (n) mesh.computeBoundingSphere();
    }
  };
  // Trunks have narrow, rooted collisions; canopies remain safely overhead.
  for (const p of locations) {
    const b = new THREE.Box3(
      new THREE.Vector3(p.x - 0.2, p.y, p.z - 0.2),
      new THREE.Vector3(p.x + 0.2, p.y + 2.5 * p.scale, p.z + 0.2),
    );
    zone.colliders.push(b);
  }
  return { locations, update, batches };
}
function stopModel(root, zone, service, distance, index) {
  const p = circuitPoint(service.route, distance),
    edge = service.route.edges[p.edge],
    side = edge.width * 0.5 + 0.85,
    x = p.x - Math.cos(p.yaw) * side,
    z = p.z + Math.sin(p.yaw) * side,
    y = zone.terrain.walkAt(x, z);
  if (
    nearMission(x, z, 10) ||
    zone.terrain.isWater(x, z) ||
    !positionClear({ x, y, z }, 1, zone)
  )
    return null;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = p.yaw;
  g.name = 'Rebar shuttle stop';
  root.add(g);
  const metal = new THREE.MeshStandardMaterial({
      color: 0x34535b,
      roughness: 0.55,
      metalness: 0.3,
    }),
    gold = new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.65 });
  const add = (w, h, d, m, px, py, pz) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(px, py, pz);
    o.castShadow = true;
    g.add(o);
    return o;
  };
  add(0.1, 2.8, 0.1, metal, 0, 1.4, 0);
  add(1.65, 0.85, 0.09, metal, 0, 2.6, 0);
  add(1.75, 0.12, 0.16, gold, 0, 3.06, 0);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext('2d'),
    texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const display = new THREE.Mesh(
    new THREE.PlaneGeometry(1.52, 0.75),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
  );
  display.position.set(0, 2.6, 0.06);
  g.add(display);
  zone.colliders.push(
    new THREE.Box3(
      new THREE.Vector3(x - 0.08, y, z - 0.08),
      new THREE.Vector3(x + 0.08, y + 2.8, z + 0.08),
    ),
  );
  const stop = {
    service,
    distance,
    index,
    x,
    y,
    z,
    g,
    context,
    texture,
    lastText: '',
  };
  zone.interact(
    x,
    y + 0.4,
    z,
    '<b>[E]</b> Rebar shuttle arrivals',
    () => announceStop(zone, stop),
    4,
  );
  return stop;
}
function announceStop(zone, stop) {
  const eta = stopEta(stop),
    text = `REBAR SHUTTLE ${stop.service.label} · ${eta <= 1 ? 'BUS AT STOP' : `about ${eta} s away`} · Fictional city loop`;
  if (zone.game.multiplayer?.active) zone.game.multiplayer.error(text);
  else zone.game.toast(text, 'blue');
}
function stopEta(stop) {
  const s = stop.service,
    d = (stop.distance - s.distance + s.route.length) % s.route.length;
  return s.dwell > 0 && Math.min(d, s.route.length - d) < 1
    ? 0
    : Math.ceil(d / Math.max(3, s.speed) + s.dwell);
}
export function installCityLife(zone, geo) {
  const root = new THREE.Group();
  root.name = 'Brisbane city life';
  root.userData.abs = true;
  zone.group.add(root);
  const candidates = streetCircuits(geo.roads),
    carRoutes = candidates.filter((r) => routeAccessible(r, zone)),
    busRoutes = carRoutes.filter((r) => routeAccessible(r, zone, true));
  const services = [],
    stops = [],
    colors = [0xc15343, 0xf2e9d4, 0x397c91, 0xd5ae4e, 0x41585e, 0x639b79];
  const create = (route, bus, index) => {
    const model = buildCityVehicle({
      bus,
      color: bus ? 0x3f9290 : colors[index % colors.length],
      variant: index % 2,
      label: `B${index + 1}  REBAR LOOP`,
    });
    root.add(model);
    const service = {
      model,
      route,
      bus,
      id: (bus ? 'bus-' : 'car-') + index,
      label: 'B' + (index + 1),
      distance: (((index + 0.3) * route.length) / 3) % route.length,
      speed: 0,
      dwell: 0,
      visits: 0,
      nextStop: 0,
      stopDistance: 0,
      stops: [],
      contacts: [0, 0, 0, 0],
      pose: {},
      ahead: {},
      here: {},
      dt: 0,
    };
    // Shared sections of different circuits still need distinct spawn bays.
    for (let trial = 0; trial < 80; trial++) {
      const p = vehiclePosition(route, service.distance);
      if (
        services.every(
          (other) =>
            Math.hypot(other.pose.x - p.x, other.pose.z - p.z) >
            (other.model.userData.length + model.userData.length) / 2 + 3,
        )
      )
        break;
      service.distance = (service.distance + 11) % route.length;
    }
    if (bus) {
      for (let i = 0; i < 4; i++) {
        for (let trial = 0; trial < 12; trial++) {
          const d =
              ((route.length * (i + 0.15)) / 4 + trial * 7) % route.length,
            a = circuitPoint(route, d - 8),
            b = circuitPoint(route, d + 8);
          if (Math.abs(angleDelta(a.yaw, b.yaw)) > 0.15) continue;
          const stop = stopModel(root, zone, service, d, i);
          if (stop) {
            service.stops.push(d);
            stops.push(stop);
            break;
          }
        }
      }
      if (!service.stops.length) {
        model.removeFromParent();
        return;
      }
      service.stops.sort((a, b) => a - b);
      service.nextStop = service.stops.findIndex((d) => d > service.distance);
      if (service.nextStop < 0) service.nextStop = 0;
      service.stopDistance = service.stops[service.nextStop];
    }
    service.collider = new THREE.Box3();
    service.collider.localBox = new THREE.Box3();
    service.collider.frame = new VenueFrame(0, 0, 0);
    service.collider.transient = true;
    services.push(service);
    groundVehicle(service, zone);
    zone.colliders.push(service.collider);
  };
  for (let i = 0; i < Math.min(12, carRoutes.length * 2); i++)
    create(carRoutes[i % carRoutes.length], false, i);
  for (let i = 0; i < Math.min(3, busRoutes.length); i++)
    create(busRoutes[i], true, i);
  const trees = populateTrees(root, zone, geo);
  let foliageClock = 0,
    signClock = 0;
  const junctions = new Map();
  const update = (dt, t) => {
    const player = zone.game.player.pos;
    foliageClock -= dt;
    if (foliageClock <= 0) {
      trees.update(player);
      foliageClock = 0.5;
    }
    for (const [key, lock] of junctions) {
      const passed =
        (lock.owner.distance - lock.along + lock.owner.route.length) %
        lock.owner.route.length;
      if (
        lock.owner.stormFlight ||
        (passed < lock.owner.route.length / 2 &&
          passed > lock.owner.model.userData.length / 2 + 2) ||
        Math.hypot(lock.owner.pose.x - lock.x, lock.owner.pose.z - lock.z) > 25
      )
        junctions.delete(key);
    }
    for (const s of services) {
      if (s.stormFlight) continue;
      const next = circuitPoint(s.route, s.distance + 10, s.ahead),
        here = circuitPoint(s.route, s.distance, s.here),
        bend = Math.abs(angleDelta(here.yaw, next.yaw));
      let speed = (s.bus ? 8 : 7.5) / (1 + bend * 3);
      s.blockedReason = null;
      for (const other of services) {
        if (other.stormFlight) continue;
        if (other === s || other.route !== s.route) continue;
        const gap =
          (other.distance - s.distance + s.route.length) % s.route.length;
        if (gap < other.model.userData.length + 4) {
          speed = 0;
          s.blockedReason = 'headway:' + other.id;
        }
      }
      // Reserve only the next junction, and release it once the rear clears.
      // Reserving several nearby nodes can otherwise deadlock a city block.
      let nearest = -1,
        nearestGap = 15;
      for (let j = 0; j < s.route.points.length - 1; j++) {
        if (!s.route.points[j].junction) continue;
        const gap =
          (s.route.along[j] - s.distance + s.route.length) % s.route.length;
        if (gap < nearestGap) {
          nearestGap = gap;
          nearest = j;
        }
      }
      if (nearest >= 0) {
        const node = s.route.points[nearest],
          key = Math.round(node.x) + ',' + Math.round(node.z),
          lock = junctions.get(key);
        // A leading vehicle must not queue behind a reservation held by the
        // car following it on a shared approach from another circuit.
        if (
          lock &&
          lock.owner !== s &&
          Math.abs(angleDelta(lock.owner.pose.yaw, s.pose.yaw)) < 0.8 &&
          nearestGap + 2 <
            Math.hypot(lock.owner.pose.x - node.x, lock.owner.pose.z - node.z)
        ) {
          lock.owner = s;
          lock.along = s.route.along[nearest];
        }
        if (lock && lock.owner !== s) {
          speed = Math.min(speed, Math.sqrt(Math.max(0, 5 * (nearestGap - 7))));
          s.blockedReason = 'junction:' + lock.owner.id;
        } else if (!lock)
          junctions.set(key, {
            owner: s,
            x: node.x,
            z: node.z,
            along: s.route.along[nearest],
          });
      }
      for (const other of services) {
        if (other.stormFlight) continue;
        if (
          other === s ||
          Math.abs(other.model.position.y - s.model.position.y) > 3
        )
          continue;
        const dx = other.pose.x - s.pose.x,
          dz = other.pose.z - s.pose.z,
          forward = dx * Math.sin(s.pose.yaw) + dz * Math.cos(s.pose.yaw),
          lateral = Math.abs(
            dx * Math.cos(s.pose.yaw) - dz * Math.sin(s.pose.yaw),
          );
        if (
          forward > 0 &&
          lateral < 1.9 &&
          Math.abs(angleDelta(s.pose.yaw, other.pose.yaw)) < 0.7
        ) {
          s.blockedReason = 'following:' + other.id;
          const clearance =
            forward -
            (s.model.userData.length + other.model.userData.length) / 2;
          speed = Math.min(
            speed,
            Math.sqrt(Math.max(0, 5 * (clearance - 2.5))),
          );
        }
      }
      const dx = player.x - s.model.position.x,
        dz = player.z - s.model.position.z;
      if (
        Math.abs(player.y - s.model.position.y) < 3 &&
        dx * Math.sin(s.pose.yaw) + dz * Math.cos(s.pose.yaw) > 0 &&
        Math.hypot(dx, dz) < s.model.userData.length * 0.5 + 4 &&
        Math.abs(dx * Math.cos(s.pose.yaw) - dz * Math.sin(s.pose.yaw)) < 2
      )
        speed = 0;
      s.dt = dt;
      const previousSpeed = s.speed;
      advanceService(s, dt, speed);
      s.blockedFor =
        s.speed < 0.05 && s.dwell <= 0 ? (s.blockedFor || 0) + dt : 0;
      groundVehicle(s, zone);
      s.model.visible =
        Math.hypot(s.pose.x - player.x, s.pose.z - player.z) < 260;
      if (s.model.visible) {
        const braking = s.dwell > 0 || s.speed < .08 || previousSpeed - s.speed > dt * .6;
        s.model.userData.brakeLights.emissiveIntensity = braking ? 1.35 : .25;
        for (const wheel of s.model.userData.wheels)
          wheel.rotation.x += (s.speed * dt) / s.model.userData.wheelRadius;
      }
    }
    signClock -= dt;
    if (signClock <= 0) {
      signClock = 1;
      for (const stop of stops) {
        const eta = stopEta(stop),
          text = eta <= 1 ? 'AT STOP' : `~ ${eta} SEC`;
        if (text === stop.lastText) continue;
        stop.lastText = text;
        const c = stop.context;
        c.fillStyle = '#17353d';
        c.fillRect(0, 0, 512, 256);
        c.fillStyle = '#ffe196';
        c.font = 'bold 42px Arial';
        c.textAlign = 'center';
        c.fillText('REBAR SHUTTLE ' + stop.service.label, 256, 59);
        c.fillStyle = 'white';
        c.font = 'bold 56px Arial';
        c.fillText(text, 256, 142);
        c.font = '24px Arial';
        c.fillStyle = '#a8d6cb';
        c.fillText('FICTIONAL CITY LOOP', 256, 207);
        stop.texture.needsUpdate = true;
      }
    }
  };
  const life = {
    root,
    services,
    stops,
    trees,
    routes: carRoutes,
    busRoutes,
    update,
    junctions,
    hintAt(p) {
      const stop = stops.find(
        (s) => Math.hypot(p.x - s.x, p.z - s.z) < 4 && Math.abs(p.y - s.y) < 2,
      );
      return stop
        ? 'E · REBAR SHUTTLE ' + stop.service.label + ' ARRIVALS'
        : null;
    },
    interactAt(p) {
      const stop = stops.find(
        (s) => Math.hypot(p.x - s.x, p.z - s.z) < 4 && Math.abs(p.y - s.y) < 2,
      );
      if (!stop) return false;
      announceStop(zone, stop);
      return true;
    },
  };
  zone.updaters.push(update);
  update(0, 0);
  zone.cleanups.push(() => {
    const materials = new Set();
    root.traverse((o) => {
      if (o.material)
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          materials.add(m);
    });
    for (const stop of stops) stop.texture.dispose();
    for (const m of materials) m.dispose();
  });
  console.log('[brisbane city life]', {
    cars: services.filter((s) => !s.bus).length,
    buses: services.filter((s) => s.bus).length,
    stops: stops.length,
    trees: trees.locations.length,
    circuits: carRoutes.length,
  });
  return life;
}
