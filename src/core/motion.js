import { pushFootprints } from '../world/geo/footprints.js';
// Small swept steps prevent fast trolleys/grapples crossing thin walls.
// Uses the existing boxes/footprint hash, not a new physics engine.
export function resolveHorizontal(pos, radius, zone, height = 1.7) {
  for (const b of zone.colliders || []) {
    if (pos.y >= b.max.y - 0.18 || pos.y + height <= b.min.y) continue;
    const x = Math.max(b.min.x, Math.min(b.max.x, pos.x)),
      z = Math.max(b.min.z, Math.min(b.max.z, pos.z));
    const dx = pos.x - x,
      dz = pos.z - z,
      d = Math.hypot(dx, dz);
    if (d >= radius) continue;
    if (d > 1e-6) {
      pos.x += (dx / d) * (radius - d);
      pos.z += (dz / d) * (radius - d);
    } else {
      const sides = [pos.x - b.min.x, b.max.x - pos.x, pos.z - b.min.z, b.max.z - pos.z];
      const side = sides.indexOf(Math.min(...sides));
      if (side === 0) pos.x = b.min.x - radius;
      else if (side === 1) pos.x = b.max.x + radius;
      else if (side === 2) pos.z = b.min.z - radius;
      else pos.z = b.max.z + radius;
    }
  }
  pushFootprints(pos, radius, pos.y, zone);
}
export function moveHorizontal(pos, dx, dz, radius, zone, height = 1.7) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.3));
  let blocked = false;
  for (let i = 0; i < steps; i++) {
    pos.x += dx / steps;
    pos.z += dz / steps;
    const x = pos.x,
      z = pos.z;
    resolveHorizontal(pos, radius, zone, height);
    if (Math.hypot(pos.x - x, pos.z - z) > 0.001) blocked = true;
  }
  return blocked;
}
export function positionClear(pos, radius, zone, height = 1.7) {
  const p = { ...pos };
  resolveHorizontal(p, radius, zone, height);
  return Math.hypot(p.x - pos.x, p.z - pos.z) < 0.02;
}
