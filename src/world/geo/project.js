// WGS84 local east-north-up tangent plane.
// x = east metres, y = up, z = -north metres.
// The origin is a real point stored with the dataset (Brisbane: City Hall),
// not a constant degrees-to-metres factor.

const A = 6378137;
const F = 1 / 298.257223563;
const E2 = F * (2 - F);

export function radii(lat0) {
  const s = Math.sin(lat0 * Math.PI / 180);
  const N = A / Math.sqrt(1 - E2 * s * s);
  const M = A * (1 - E2) / Math.pow(1 - E2 * s * s, 1.5);
  return { N, M };
}

export function enu(lat, lon, lat0, lon0) {
  const { N, M } = radii(lat0);
  const lat0r = lat0 * Math.PI / 180;
  const x = (lon - lon0) * Math.PI / 180 * N * Math.cos(lat0r);
  const north = (lat - lat0) * Math.PI / 180 * M;
  return { x, z: -north };
}

// Inverse Vincenty on the WGS84 ellipsoid. Returns metres.
export function vincenty(lat1, lon1, lat2, lon2) {
  const a = A;
  const f = F;
  const b = (1 - f) * a;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const L = (lon2 - lon1) * Math.PI / 180;
  const U1 = Math.atan((1 - f) * Math.tan(phi1));
  const U2 = Math.atan((1 - f) * Math.tan(phi2));
  let lam = L;
  let sinSigma = 0, cosSigma = 0, sigma = 0, sinA = 0, cos2A = 0, cos2Sm = 0;
  for (let i = 0; i < 80; i++) {
    const sinU1 = Math.sin(U1), cosU1 = Math.cos(U1);
    const sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);
    const sinL = Math.sin(lam), cosL = Math.cos(lam);
    sinSigma = Math.sqrt((cosU2 * sinL) ** 2 + (cosU1 * sinU2 - sinU1 * cosU2 * cosL) ** 2);
    if (sinSigma === 0) return 0;
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosL;
    sigma = Math.atan2(sinSigma, cosSigma);
    sinA = cosU1 * cosU2 * sinL / sinSigma;
    cos2A = 1 - sinA * sinA;
    cos2Sm = cos2A ? cosSigma - 2 * sinU1 * sinU2 / cos2A : 0;
    const C = f / 16 * cos2A * (2 + f * (4 - 3 * cos2A));
    const prev = lam;
    lam = L + (1 - C) * f * sinA * (sigma + C * sinSigma * (cos2Sm + C * cosSigma * (-1 + 2 * cos2Sm * cos2Sm)));
    if (Math.abs(lam - prev) < 1e-12) break;
  }
  const u2 = cos2A * (a * a - b * b) / (b * b);
  const AA = 1 + u2 / 16384 * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)));
  const B = u2 / 1024 * (256 + u2 * (-128 + u2 * (74 - 47 * u2)));
  const dSigma = B * sinSigma * (cos2Sm + B / 4 * (cosSigma * (-1 + 2 * cos2Sm * cos2Sm)
    - B / 6 * cos2Sm * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2Sm * cos2Sm)));
  return b * AA * (sigma - dSigma);
}

export function verifyGeo(geo) {
  const o = geo.origin;
  const issues = [];
  for (const [key, L] of Object.entries(geo.landmarks)) {
    const p = enu(L.lat, L.lon, o.lat, o.lon);
    const tx = L.cx != null ? L.cx : L.x;
    const tz = L.cz != null ? L.cz : L.z;
    const err = Math.hypot(p.x - tx, p.z - tz);
    if (err > 0.05) issues.push(`${key} reprojects ${err.toFixed(3)} m off the stored coordinate`);
  }
  for (const c of geo.checks) {
    const A = geo.landmarks[c.a];
    const B = geo.landmarks[c.b];
    const ax = A.cx ?? A.x, az = A.cz ?? A.z;
    const bx = B.cx ?? B.x, bz = B.cz ?? B.z;
    const d = Math.hypot(ax - bx, az - bz);
    const v = vincenty(A.lat, A.lon, B.lat, B.lon);
    if (Math.abs(d - v) > 0.75) issues.push(`${c.a}→${c.b} map ${d.toFixed(2)} m, Vincenty ${v.toFixed(2)} m`);
    if (Math.abs(d - c.enu) > 0.05) issues.push(`${c.a}→${c.b} stored enu ${c.enu} disagrees with landmarks`);
  }
  return issues;
}

// Highest walkable surface at (x, z) that the feet can actually use.
// Deck cells far above the feet are ignored so a bridge does not teleport you onto it.
export function surfaceY(zone, x, z, feetY, rayHits) {
  let y = -Infinity;
  if (rayHits && rayHits.length) y = rayHits[0].point.y;
  if (typeof zone.sampleGround === 'function') {
    const s = zone.sampleGround(x, z, feetY);
    if (s != null && s > y) y = s;
  }
  return y;
}
