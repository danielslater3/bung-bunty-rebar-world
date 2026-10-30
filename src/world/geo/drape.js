// Surfaces laid on the LiDAR ground and on the bridge deck profiles. A straight ribbon
// edge between two map points can cut through a crest or float over a dip, so points
// are added until every edge stays within a few centimetres of the surface under it.
import * as THREE from 'three';

const MAX_ERR = 0.05;
const MIN_SEG = 0.8;

function pushUp(out, a, b, c) {
  const area = (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]);
  if (!Number.isFinite(area) || Math.abs(area) < 1e-7) return;
  // +Y is clockwise in the XZ plane. Double-sided materials flip the normal
  // on a back face, so forcing +Y normals on downward faces made roads black.
  if (area > 0) [b, c] = [c, b];
  out.push(...a, ...b, ...c);
}

function side(px, pz, nx, nz, halfW, s) {
  return [px + nx * halfW * s, pz + nz * halfW * s];
}

// pts: [[x, z], ...]. heightOf(x, z) gives the surface. Columns are spaced at most
// 4 m apart so a wide road can follow a cross-slope instead of one flat plane.
export function drapeRibbon(out, pts, halfW, heightOf, lift = 0, cols = 2, maxDelta = Infinity) {
  if (pts.length < 2) return 0;
  cols = Math.max(cols, Math.ceil((halfW * 2) / 4) + 1);
  const dense = [pts[0]];
  const split = (p, q, depth) => {
    const dx = q[0] - p[0], dz = q[1] - p[1];
    const len = Math.hypot(dx, dz);
    if (len < MIN_SEG || depth > 7) { dense.push(q); return; }
    const nx = -dz / len, nz = dx / len;
    let err = 0;
    const probes = len > 4 ? [0.25, 0.5, 0.75] : [0.5];
    for (const s of [-1, 0, 1]) {
      const [ax, az] = side(p[0], p[1], nx, nz, halfW, s);
      const [bx, bz] = side(q[0], q[1], nx, nz, halfW, s);
      const ya = heightOf(ax, az), yb = heightOf(bx, bz);
      for (const t of probes) {
        const e = Math.abs(heightOf(ax + (bx - ax) * t, az + (bz - az) * t) - (ya + (yb - ya) * t));
        if (e > err) err = e;
      }
    }
    if (err <= MAX_ERR) { dense.push(q); return; }
    const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    split(p, m, depth + 1);
    split(m, q, depth + 1);
  };
  for (let i = 1; i < pts.length; i++) {
    const p = dense[dense.length - 1], q = pts[i];
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.05) continue;
    split(p, q, 0);
  }
  if (dense.length < 2) return 0;
  const rows = [];
  for (let i = 0; i < dense.length; i++) {
    const prev = dense[Math.max(0, i - 1)];
    const next = dense[Math.min(dense.length - 1, i + 1)];
    let dx = next[0] - prev[0], dz = next[1] - prev[1];
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    const x = dense[i][0], z = dense[i][1];
    const row = [];
    for (let c = 0; c < cols; c++) {
      const t = cols === 1 ? 0.5 : c / (cols - 1);
      const s = (t - 0.5) * 2;
      const px = x + dz * halfW * s, pz = z - dx * halfW * s;
      row.push([px, heightOf(px, pz) + lift, pz]);
    }
    rows.push(row);
  }
  // A straight triangle across a bend or a kerb can still cut the surface.
  // Split until the middle of every edge sits on the ground.
  const yOn = (p, q) => {
    const mx = (p[0] + q[0]) * 0.5, mz = (p[2] + q[2]) * 0.5;
    return Math.abs(heightOf(mx, mz) + lift - (p[1] + q[1]) * 0.5);
  };
  const mid = (p, q) => {
    const mx = (p[0] + q[0]) * 0.5, mz = (p[2] + q[2]) * 0.5;
    return [mx, heightOf(mx, mz) + lift, mz];
  };
  const emit = (a, b, c, depth) => {
    const top = Math.max(a[1], b[1], c[1]), bot = Math.min(a[1], b[1], c[1]);
    if (top - bot > maxDelta) return;
    if (depth < 5 && (yOn(a, b) > 0.06 || yOn(b, c) > 0.06 || yOn(c, a) > 0.06)) {
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      emit(a, ab, ca, depth + 1);
      emit(ab, b, bc, depth + 1);
      emit(ca, bc, c, depth + 1);
      emit(ab, bc, ca, depth + 1);
      return;
    }
    pushUp(out, a, b, c);
  };
  for (let i = 0; i < rows.length - 1; i++) {
    const r0 = rows[i], r1 = rows[i + 1];
    for (let c = 0; c < r0.length - 1; c++) {
      const a = r0[c], b = r0[c + 1], cc = r1[c], d = r1[c + 1];
      emit(a, b, cc, 0);
      emit(b, d, cc, 0);
    }
  }
  return rows.length;
}

// A ribbon along 3D points (elevated roads). Between points the surface never drops
// under ground + lift; that is where a ramp meets the street.
export function ribbon3d(out, pts, halfW, groundOf, lift, keepSeg) {
  if (pts.length < 2) return;
  const dense = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i];
    const len = Math.hypot(q[0] - p[0], q[2] - p[2]);
    const n = Math.max(1, Math.ceil(len / 6));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      dense.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]);
    }
  }
  const left = [], right = [];
  for (let i = 0; i < dense.length; i++) {
    const prev = dense[Math.max(0, i - 1)];
    const next = dense[Math.min(dense.length - 1, i + 1)];
    let dx = next[0] - prev[0], dz = next[2] - prev[2];
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    const [x, y, z] = dense[i];
    const lx = x - dz * halfW, lz = z + dx * halfW;
    const rx = x + dz * halfW, rz = z - dx * halfW;
    left.push([lx, Math.max(y, groundOf(lx, lz)) + lift, lz]);
    right.push([rx, Math.max(y, groundOf(rx, rz)) + lift, rz]);
  }
  for (let i = 0; i < dense.length - 1; i++) {
    if (keepSeg && !keepSeg(dense[i], dense[i + 1])) continue;
    const a = left[i], b = right[i], c = left[i + 1], d = right[i + 1];
    pushUp(out, a, b, c);
    pushUp(out, b, d, c);
  }
}

function signedArea(flat) {
  let s = 0;
  for (let i = 0; i < flat.length; i += 2) {
    const j = (i + 2) % flat.length;
    s += flat[i] * flat[j + 1] - flat[j] * flat[i + 1];
  }
  return s * 0.5;
}

export function triangulateRing(flat) {
  const contour = [];
  for (let i = 0; i < flat.length; i += 2) contour.push(new THREE.Vector2(flat[i], flat[i + 1]));
  if (contour.length > 2 && contour[0].distanceToSquared(contour[contour.length - 1]) < 0.05) contour.pop();
  if (contour.length < 3) return null;
  if (signedArea(flat) < 0) contour.reverse();
  let faces = THREE.ShapeUtils.triangulateShape(contour, []);
  if (!faces.length) {
    contour.reverse();
    faces = THREE.ShapeUtils.triangulateShape(contour, []);
  }
  return faces.length ? { contour, faces } : null;
}

function pushSplit(out, a, b, c, yOf, maxEdge, depth) {
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (Math.abs(area) < 1e-7) return;
  const ab = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const bc = Math.hypot(c[0] - b[0], c[1] - b[1]);
  const ca = Math.hypot(a[0] - c[0], a[1] - c[1]);
  const ya = yOf(a[0], a[1]), yb = yOf(b[0], b[1]), yc = yOf(c[0], c[1]);
  const err = Math.abs(yOf((a[0]+b[0]+c[0])/3, (a[1]+b[1]+c[1])/3) - (ya+yb+yc)/3);
  if ((Math.max(ab, bc, ca) <= maxEdge && err <= 0.045) || depth >= 22) {
    pushUp(out, [a[0], ya, a[1]], [b[0], yb, b[1]], [c[0], yc, c[1]]);
    return;
  }
  // Longest-edge bisection avoids the exponential proliferation of tiny
  // triangles on the narrow, kilometre-long bridge/rail polygons.
  const m = (p, q) => [(p[0]+q[0])/2, (p[1]+q[1])/2];
  if (ab >= bc && ab >= ca) {
    const mid=m(a,b); pushSplit(out,a,mid,c,yOf,maxEdge,depth+1); pushSplit(out,mid,b,c,yOf,maxEdge,depth+1);
  } else if (bc >= ca) {
    const mid=m(b,c); pushSplit(out,a,b,mid,yOf,maxEdge,depth+1); pushSplit(out,a,mid,c,yOf,maxEdge,depth+1);
  } else {
    const mid=m(c,a); pushSplit(out,a,b,mid,yOf,maxEdge,depth+1); pushSplit(out,mid,b,c,yOf,maxEdge,depth+1);
  }
}

// Polygon laid on a height function, split until no edge is longer than maxEdge.
export function drapePolygon(out, flat, yOf, maxEdge = 6) {
  const tri = triangulateRing(flat);
  if (!tri) return false;
  for (const f of tri.faces) {
    const [a, b, c] = f.map((k) => [tri.contour[k].x, tri.contour[k].y]);
    pushSplit(out, a, b, c, yOf, maxEdge, 0);
  }
  return true;
}

// Split non-indexed triangles until every edge is at most maxEdge, so per-vertex lifting
// follows the ground under long flat props (plaza slabs, awnings, shop glass).
export function subdivideTriangles(pos, maxEdge = 6) {
  const out = [];
  const rec = (a, b, c, depth) => {
    const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[2] - q[2]) ** 2;
    const longest = Math.max(d2(a, b), d2(b, c), d2(c, a));
    if (longest <= maxEdge * maxEdge || depth > 5) {
      out.push(...a, ...b, ...c);
      return;
    }
    const m = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
    const mab = m(a, b), mbc = m(b, c), mca = m(c, a);
    rec(a, mab, mca, depth + 1);
    rec(mab, b, mbc, depth + 1);
    rec(mca, mbc, c, depth + 1);
    rec(mab, mbc, mca, depth + 1);
  };
  for (let i = 0; i < pos.length; i += 9) {
    rec([pos[i], pos[i + 1], pos[i + 2]], [pos[i + 3], pos[i + 4], pos[i + 5]], [pos[i + 6], pos[i + 7], pos[i + 8]], 0);
  }
  return out;
}

// Height along a bridge outline from its stored profile: ys sampled evenly from (ax, az) to (bx, bz).
export function deckProfile(bridge) {
  const { ax, az, bx, bz, ys } = bridge;
  if (!ys || ys.length < 2 || ax == null) return () => bridge.y;
  const dx = bx - ax, dz = bz - az;
  const L2 = dx * dx + dz * dz || 1;
  const n = ys.length - 1;
  return (x, z) => {
    let t = ((x - ax) * dx + (z - az) * dz) / L2;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const f = t * n;
    const k = Math.min(n - 1, Math.floor(f));
    return ys[k] + (ys[k + 1] - ys[k]) * (f - k);
  };
}
