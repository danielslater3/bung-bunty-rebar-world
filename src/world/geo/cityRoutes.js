// Closed ambient circuits follow existing OSM edges. No coordinate joins,
// fictional street shortcuts, pedestrian roads or open-polyline teleport wraps.
export function streetCircuits(
  roads,
  {
    radius = 1800,
    minWidth = 7,
    minLength = 180,
    maxLength = 1800,
    limit = 12,
  } = {},
) {
  const nodes = new Map(),
    key = (x, z) => `${Math.round(x * 10)},${Math.round(z * 10)}`;
  for (const r of roads) {
    if (r.k > 1 || r.py || r.w < minWidth) continue;
    for (let i = 2; i < r.p.length; i += 2) {
      const [ax, az, bx, bz] = r.p.slice(i - 2, i + 2);
      if (
        Math.hypot(ax, az) > radius ||
        Math.hypot(bx, bz) > radius ||
        Math.hypot(ax - bx, az - bz) < 0.1
      )
        continue;
      const a = key(ax, az),
        b = key(bx, bz);
      if (!nodes.has(a)) nodes.set(a, { x: ax, z: az, edges: new Map() });
      if (!nodes.has(b)) nodes.set(b, { x: bx, z: bz, edges: new Map() });
      nodes.get(a).edges.set(b, { width: r.w, osm: r.o });
      nodes.get(b).edges.set(a, { width: r.w, osm: r.o });
    }
  }
  const seen = new Set(),
    stack = [],
    active = new Map(),
    found = [];
  const visit = (id, parent) => {
    seen.add(id);
    active.set(id, stack.length);
    stack.push(id);
    for (const next of nodes.get(id).edges.keys()) {
      if (next === parent) continue;
      if (active.has(next) && stack.length - active.get(next) >= 4) {
        const cycle = stack.slice(active.get(next));
        cycle.push(next);
        const points = cycle.map((k) => ({
          x: nodes.get(k).x,
          z: nodes.get(k).z,
          junction: nodes.get(k).edges.size > 2,
        }));
        const edges = cycle
          .slice(1)
          .map((k, i) => nodes.get(cycle[i]).edges.get(k));
        const route = prepareCircuit(points, edges);
        if (route.length >= minLength && route.length <= maxLength)
          found.push(route);
      } else if (!seen.has(next)) visit(next, id);
    }
    stack.pop();
    active.delete(id);
  };
  for (const id of nodes.keys()) if (!seen.has(id)) visit(id);
  found.sort((a, b) => a.near - b.near || a.length - b.length);
  return found.slice(0, limit);
}
export function prepareCircuit(points, edges = []) {
  const along = [0];
  for (let i = 1; i < points.length; i++)
    along.push(
      along.at(-1) +
        Math.hypot(
          points[i].x - points[i - 1].x,
          points[i].z - points[i - 1].z,
        ),
    );
  return {
    points,
    edges,
    along,
    length: along.at(-1),
    near: Math.min(...points.map((p) => Math.hypot(p.x, p.z))),
  };
}
export function circuitPoint(route, distance, out = {}) {
  const d = ((distance % route.length) + route.length) % route.length;
  let lo = 0,
    hi = route.along.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (route.along[mid] <= d) lo = mid;
    else hi = mid;
  }
  const a = route.points[lo],
    b = route.points[lo + 1],
    span = route.along[lo + 1] - route.along[lo],
    t = span ? (d - route.along[lo]) / span : 0;
  out.x = a.x + (b.x - a.x) * t;
  out.z = a.z + (b.z - a.z) * t;
  out.yaw = Math.atan2(b.x - a.x, b.z - a.z);
  out.edge = lo;
  return out;
}
export function angleDelta(a, b) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}
export function advanceService(service, dt, targetSpeed) {
  if (service.dwell > 0) {
    service.dwell = Math.max(0, service.dwell - dt);
    service.speed = 0;
    return;
  }
  const remaining = service.bus
    ? (((service.stopDistance - service.distance) % service.route.length) +
        service.route.length) %
      service.route.length
    : Infinity;
  const desired = Math.min(
    targetSpeed,
    Math.sqrt(Math.max(0, 2 * 2.5 * Math.max(0, remaining - 0.12))),
  );
  const acceleration = desired > service.speed ? 1.6 : 3;
  service.speed +=
    Math.sign(desired - service.speed) *
    Math.min(Math.abs(desired - service.speed), acceleration * dt);
  const travel = service.speed * dt;
  if (service.bus && remaining <= Math.max(0.15, travel)) {
    service.distance = service.stopDistance % service.route.length;
    service.speed = 0;
    service.dwell = 5;
    service.visits++;
    service.nextStop = (service.nextStop + 1) % service.stops.length;
    service.stopDistance = service.stops[service.nextStop];
  } else service.distance = (service.distance + travel) % service.route.length;
}
