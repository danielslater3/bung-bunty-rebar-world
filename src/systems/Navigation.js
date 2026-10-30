// Reusable navigation math and road routing. No DOM/render state; tested in Node.
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const validPoint = (p) =>
  p && Number.isFinite(p.x) && Number.isFinite(p.z) && (p.y == null || Number.isFinite(p.y));
export function turnToward(a, b, dt, rate = 8) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * (1 - Math.exp(-rate * Math.max(0, dt)));
}
export function nearestOnPath(path, p) {
  let best = { off: Infinity, along: 0, index: 0, point: path[0] },
    acc = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      dx = b.x - a.x,
      dz = b.z - a.z,
      len = Math.hypot(dx, dz);
    if (len < 1e-6) continue;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (len * len)));
    const q = { x: a.x + dx * t, z: a.z + dz * t, y: (a.y || 0) + ((b.y || 0) - (a.y || 0)) * t };
    const off = distance(p, q);
    if (off < best.off) best = { off, along: acc + len * t, index: i - 1, point: q };
    acc += len;
  }
  if (!Number.isFinite(best.off) && path.length)
    best = { off: distance(p, path[0]), along: 0, index: 0, point: path[0] };
  best.length = acc;
  return best;
}
export function atDistance(path, d) {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      len = distance(a, b);
    if (d <= len && len > 1e-6) {
      const t = Math.max(0, d / len);
      return {
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
        y: (a.y || 0) + ((b.y || 0) - (a.y || 0)) * t,
      };
    }
    d -= len;
  }
  return path[path.length - 1];
}
class Heap {
  constructor() {
    this.a = [];
  }
  push(v) {
    let i = this.a.length;
    this.a.push(v);
    while (i) {
      let p = (i - 1) >> 1;
      if (this.a[p].f <= v.f) break;
      this.a[i] = this.a[p];
      i = p;
    }
    this.a[i] = v;
  }
  pop() {
    const a = this.a,
      top = a[0],
      v = a.pop();
    if (a.length) {
      let i = 0;
      while (i * 2 + 1 < a.length) {
        let c = i * 2 + 1;
        if (c + 1 < a.length && a[c + 1].f < a[c].f) c++;
        if (a[c].f >= v.f) break;
        a[i] = a[c];
        i = c;
      }
      a[i] = v;
    }
    return top;
  }
}
export class RoadNetwork {
  constructor(roads, heightAt, clear = () => true) {
    this.nodes = [];
    this.cells = new Map();
    this.clear = clear;
    this.edgeChecks = new Map();
    const keys = new Map();
    const node = (p) => {
      const key = `${Math.round(p.x * 10)},${Math.round(p.z * 10)}`;
      let ids = keys.get(key);
      if (!ids) {
        ids = [];
        keys.set(key, ids);
      }
      for (const id of ids) if (Math.abs(this.nodes[id].y - p.y) < 0.8) return id;
      const id = this.nodes.length;
      this.nodes.push({ ...p, edges: [] });
      ids.push(id);
      const cell = `${Math.floor(p.x / 32)},${Math.floor(p.z / 32)}`;
      if (!this.cells.has(cell)) this.cells.set(cell, []);
      this.cells.get(cell).push(id);
      return id;
    };
    for (const road of roads) {
      const step = road.py ? 3 : 2,
        p = road.p;
      let prev = null;
      for (let i = 0; i < p.length; i += step) {
        const q = { x: p[i], z: p[i + 1], y: road.py ? p[i + 2] : heightAt(p[i], p[i + 1]) };
        if (prev) {
          const n = Math.max(1, Math.ceil(distance(prev, q) / 10));
          let last = node(prev);
          for (let k = 1; k <= n; k++) {
            const t = k / n,
              id = node({
                x: prev.x + (q.x - prev.x) * t,
                z: prev.z + (q.z - prev.z) * t,
                y: prev.y + (q.y - prev.y) * t,
              });
            if (id !== last) {
              this.nodes[last].edges.push(id);
              this.nodes[id].edges.push(last);
            }
            last = id;
          }
        }
        prev = q;
      }
    }
  }
  nearby(p) {
    const cx = Math.floor(p.x / 32),
      cz = Math.floor(p.z / 32),
      ids = [];
    for (let r = 0; r <= 4; r++) {
      for (let z = -r; z <= r; z++)
        for (let x = -r; x <= r; x++) {
          if (r && Math.max(Math.abs(x), Math.abs(z)) !== r) continue;
          for (const id of this.cells.get(`${cx + x},${cz + z}`) || []) ids.push(id);
        }
      if (ids.length >= 24) break;
    }
    return ids.sort((a, b) => distance(this.nodes[a], p) - distance(this.nodes[b], p)).slice(0, 32);
  }
  route(from, to, connectorClear = this.clear) {
    if (!validPoint(from) || !validPoint(to)) return [];
    const starts = this.nearby(from).filter((id) => connectorClear(from, this.nodes[id]));
    const ends = this.nearby(to).filter((id) => connectorClear(this.nodes[id], to));
    if (!starts.length || !ends.length) return [];
    const goals = new Set(ends),
      cost = new Map(),
      parent = new Map(),
      open = new Heap();
    for (const id of starts) {
      const g = distance(from, this.nodes[id]);
      cost.set(id, g);
      open.push({ id, g, f: g + distance(this.nodes[id], to) });
    }
    let visits = 0;
    while (open.a.length && visits++ < 100000) {
      const { id, g } = open.pop();
      if (g !== cost.get(id)) continue;
      if (goals.has(id)) {
        const result = [to];
        let at = id;
        while (at != null) {
          result.push(this.nodes[at]);
          at = parent.get(at);
        }
        result.push(from);
        return result.reverse();
      }
      for (const next of this.nodes[id].edges) {
        const key = id < next ? `${id}:${next}` : `${next}:${id}`;
        let ok = this.edgeChecks.get(key);
        if (ok == null) {
          ok = this.clear(this.nodes[id], this.nodes[next]);
          this.edgeChecks.set(key, ok);
        }
        if (!ok) continue;
        const n = g + distance(this.nodes[id], this.nodes[next]);
        if (n >= (cost.get(next) ?? Infinity)) continue;
        cost.set(next, n);
        parent.set(next, id);
        open.push({ id: next, g: n, f: n + distance(this.nodes[next], to) });
      }
    }
    return [];
  }
}
// Small collision-aware grid for room/plaza connections. Never joins different
// streets through a building. Only used at a route's ends, not over the whole city.
export function localRoute(from, to, clear, spacing = 1) {
  if (clear(from, to)) return [from, to];
  if (distance(from, to) > 70) return [];
  const open = new Heap(),
    cost = new Map(),
    parent = new Map(),
    points = new Map();
  const key = (x, z) => `${x},${z}`,
    start = key(0, 0);
  points.set(start, from);
  cost.set(start, 0);
  open.push({ id: start, g: 0, f: distance(from, to) });
  let visits = 0;
  while (open.a.length && visits++ < 9000) {
    const { id, g } = open.pop();
    if (g !== cost.get(id)) continue;
    const p = points.get(id),
      [ix, iz] = id.split(',').map(Number);
    if (distance(p, to) < spacing * 2 && clear(p, to)) {
      const out = [to];
      let at = id;
      while (at != null) {
        out.push(points.get(at));
        at = parent.get(at);
      }
      return out.reverse();
    }
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const x = ix + dx,
          z = iz + dz;
        if (Math.abs(x) > 80 || Math.abs(z) > 80) continue;
        const q = { x: from.x + x * spacing, z: from.z + z * spacing, y: from.y },
          k = key(x, z),
          n = g + spacing * Math.hypot(dx, dz);
        if (n >= (cost.get(k) ?? Infinity) || !clear(p, q)) continue;
        cost.set(k, n);
        parent.set(k, id);
        points.set(k, q);
        open.push({ id: k, g: n, f: n + distance(q, to) });
      }
  }
  return [];
}
export class NavigationController {
  constructor(plan, clear = () => true) {
    this.plan = plan;
    this.clear = clear;
    this.reset();
  }
  reset() {
    this.path = [];
    this.key = null;
    this.target = null;
    this.yaw = null;
    this.timer = 0;
    this.failed = false;
  }
  update({ key, from, target, route = null, dt }) {
    if (!validPoint(from) || !validPoint(target)) {
      this.reset();
      return null;
    }
    this.timer -= dt;
    const changed = key !== this.key;
    const moved = !this.target || distance(this.target, target) > 2;
    const off = this.path.length > 1 ? nearestOnPath(this.path, from).off : Infinity;
    if (changed || (this.timer <= 0 && (moved || off > 5 || !this.path.length))) {
      this.key = key;
      this.target = { ...target };
      this.timer = 1.2;
      this.path =
        route || this.plan({ x: from.x, y: from.y, z: from.z }, { x: target.x, y: target.y, z: target.z });
      this.failed = this.path.length < 2;
    } else if (route) this.path = route;
    if (this.failed || this.path.length < 2) return { unavailable: true, distance: distance(from, target) };
    const on = nearestOnPath(this.path, from);
    // Look ahead only while the shortcut is clear; at a bend keep the next
    // real corner instead of pointing across its building footprint.
    let aim = on.off > 3 ? on.point : atDistance(this.path, Math.min(on.length, on.along + 7));
    if (!this.clear(from, aim)) aim = this.path[Math.min(on.index + 1, this.path.length - 1)];
    const dx = aim.x - from.x,
      dz = aim.z - from.z;
    if (Math.hypot(dx, dz) > 0.15) {
      const wanted = Math.atan2(dx, dz);
      this.yaw = this.yaw == null ? wanted : turnToward(this.yaw, wanted, dt);
    }
    return {
      yaw: this.yaw ?? 0,
      aim,
      distance: on.off + Math.max(0, on.length - on.along),
      vertical: (target.y || 0) - (from.y || 0),
      path: this.path,
      on,
    };
  }
}
