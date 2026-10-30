// Footprint collision for real building rings. Boxes would spill into Queen Street
// wherever a footprint is rotated. Nearby rings only; the rest stay in the hash.

function closestOnSeg(px, pz, ax, az, bx, bz) {
  const abx = bx - ax, abz = bz - az;
  const den = abx * abx + abz * abz;
  const t = den < 1e-8 ? 0 : Math.max(0, Math.min(1, ((px - ax) * abx + (pz - az) * abz) / den));
  return [ax + abx * t, az + abz * t];
}

function insideRing(x, z, ring) {
  let n = 0;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i], zi = ring[i + 1];
    const xj = ring[j], zj = ring[j + 1];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / ((zj - zi) || 1e-12) + xi) n++;
  }
  return n % 2 === 1;
}

function resolveOne(pos, radius, poly) {
  const ring = poly.r;
  const inside = insideRing(pos.x, pos.z, ring);
  let bestD = Infinity, cx = pos.x, cz = pos.z;
  for (let i = 0; i < ring.length; i += 2) {
    const j = (i + 2) % ring.length;
    const [qx, qz] = closestOnSeg(pos.x, pos.z, ring[i], ring[i + 1], ring[j], ring[j + 1]);
    const d = Math.hypot(pos.x - qx, pos.z - qz);
    if (d < bestD) { bestD = d; cx = qx; cz = qz; }
  }
  if (!inside && bestD >= radius) return;
  const dx = pos.x - cx, dz = pos.z - cz;
  const d = Math.hypot(dx, dz);
  if (inside) {
    if (d < 1e-4) {
      pos.x += radius;
      return;
    }
    // Move past the nearest edge, then out by the radius.
    pos.x = cx - (dx / d) * radius;
    pos.z = cz - (dz / d) * radius;
  } else {
    pos.x = cx + (dx / d) * radius;
    pos.z = cz + (dz / d) * radius;
  }
}

export function pushFootprints(pos, radius, feetY, zone) {
  const buckets = zone.footBuckets;
  if (!buckets) return;
  const cs = zone.footCell;
  const ix = Math.floor(pos.x / cs);
  const iz = Math.floor(pos.z / cs);
  for (let pass = 0; pass < 2; pass++) {
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const list = buckets.get(`${ix + dx},${iz + dz}`);
        if (!list) continue;
        for (const poly of list) {
          if (feetY > poly.h - 0.25 || feetY + 1.7 < poly.y0) continue;
          resolveOne(pos, radius, poly);
        }
      }
    }
  }
}

export function indexFootprints(buildings, cell = 48) {
  const buckets = new Map();
  let kept = 0;
  for (const b of buildings) {
    const r = b.r;
    if (!r || r.length < 6) continue;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    let area = 0;
    for (let i = 0; i < r.length; i += 2) {
      const x = r[i], z = r[i + 1];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      const j = (i + 2) % r.length;
      area += x * r[j + 1] - r[j] * z;
    }
    if (Math.abs(area) * 0.5 < 18) continue;
    const base = b.b || 0;
    const poly = b.g == null
      ? { r, h: base + b.h, y0: base }
      : { r, h: b.g + base + b.h, y0: base > 0.05 ? b.g + base : (b.gm ?? b.g) - 0.3 };
    const i0 = Math.floor(minX / cell), i1 = Math.floor(maxX / cell);
    const j0 = Math.floor(minZ / cell), j1 = Math.floor(maxZ / cell);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const key = `${i},${j}`;
        let list = buckets.get(key);
        if (!list) { list = []; buckets.set(key, list); }
        list.push(poly);
      }
    }
    kept++;
  }
  return { buckets, cell, kept };
}

// Analytic camera ray against nearby extruded footprint edges. This deliberately
// avoids raycasting the millions of rendered facade triangles.
export function footprintClearance(zone,origin,direction,far) {
  if(!zone.footBuckets)return far;
  const cell=zone.footCell,ex=origin.x+direction.x*far,ez=origin.z+direction.z*far;
  let best=far;const seen=new Set();
  for(let iz=Math.floor(Math.min(origin.z,ez)/cell);iz<=Math.floor(Math.max(origin.z,ez)/cell);iz++)
    for(let ix=Math.floor(Math.min(origin.x,ex)/cell);ix<=Math.floor(Math.max(origin.x,ex)/cell);ix++)
      for(const poly of zone.footBuckets.get(`${ix},${iz}`)||[]){
        if(seen.has(poly))continue;seen.add(poly);
        const r=poly.r;
        for(let i=0;i<r.length;i+=2){
          const j=(i+2)%r.length,sx=r[j]-r[i],sz=r[j+1]-r[i+1];
          const den=direction.x*sz-direction.z*sx;if(Math.abs(den)<1e-8)continue;
          const dx=r[i]-origin.x,dz=r[i+1]-origin.z;
          const t=(dx*sz-dz*sx)/den,u=(dx*direction.z-dz*direction.x)/den;
          if(t<.02||t>=best||u<0||u>1)continue;
          const y=origin.y+direction.y*t;
          if(y>poly.y0&&y<poly.h)best=t;
        }
      }
  return best;
}
