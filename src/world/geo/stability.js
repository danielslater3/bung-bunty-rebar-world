// Runtime repair of noisy DEM samples on elevated structures. Source OSM rings,
// endpoints, river clearance profiles and attribution remain in the compiled data.
// One prepared copy feeds rendering, structures, collision and navigation.
export function smoothProfile(values, length, maxGrade = 0.18) {
  if (values.length < 3 || length <= 0) return values.slice();
  const n = values.length,
    spacing = length / (n - 1),
    grade = Math.max(maxGrade, Math.abs(values[n - 1] - values[0]) / length);
  const step = grade * spacing,
    ys = values.slice();
  for (let i = 1; i < n - 1; i++) {
    const neighbours = values.slice(Math.max(0, i - 2), Math.min(n, i + 3)).sort((a, b) => a - b);
    const median = neighbours[Math.floor(neighbours.length / 2)];
    if (Math.abs(values[i] - median) > 1.2) ys[i] = median;
  }
  // Endpoint envelopes and two projections constrain all adjacent grades while
  // keeping the entry and exit heights exactly compatible with adjoining ways.
  for (let i = 1; i < n - 1; i++)
    ys[i] = Math.max(
      Math.max(ys[0] - step * i, ys[n - 1] - step * (n - 1 - i)),
      Math.min(Math.min(ys[0] + step * i, ys[n - 1] + step * (n - 1 - i)), ys[i]),
    );
  for (let i = 1; i < n - 1; i++) ys[i] = Math.max(ys[i - 1] - step, Math.min(ys[i - 1] + step, ys[i]));
  for (let i = n - 2; i > 0; i--) ys[i] = Math.max(ys[i + 1] - step, Math.min(ys[i + 1] + step, ys[i]));
  return ys;
}
function contains(r, x, z) {
  let inside = false;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    if (r[i + 1] > z !== r[j + 1] > z && x < ((r[j] - r[i]) * (z - r[i + 1])) / (r[j + 1] - r[i + 1]) + r[i])
      inside = !inside;
  }
  return inside;
}
function height(b, x, z) {
  const dx = b.bx - b.ax,
    dz = b.bz - b.az,
    t = Math.max(0, Math.min(1, ((x - b.ax) * dx + (z - b.az) * dz) / (dx * dx + dz * dz)));
  const f = t * (b.ys.length - 1),
    i = Math.min(b.ys.length - 2, Math.floor(f));
  return b.ys[i] + (b.ys[i + 1] - b.ys[i]) * (f - i);
}
export function prepareGeography(source) {
  const repairs = [];
  const bridges = source.bridges.map((b) => {
    if (!b.ys) return b;
    const length = Math.hypot(b.bx - b.ax, b.bz - b.az),
      ys = smoothProfile(b.ys, length);
    if (ys.every((v, i) => Math.abs(v - b.ys[i]) < 0.01)) return b;
    repairs.push({
      osm: b.osm,
      name: b.name || 'unnamed structure',
      maxAdjustment: Math.max(...ys.map((v, i) => Math.abs(v - b.ys[i]))),
    });
    return { ...b, ys };
  });
  const changed = bridges
    .map((b, i) => ({ b, original: source.bridges[i] }))
    .filter((x) => x.b !== x.original);
  const roads = source.roads.map((road) => {
    if (!road.py) return road;
    const p = road.p.slice();
    let altered = false;
    for (let i = 0; i < p.length; i += 3) {
      for (const { b, original } of changed) {
        if (!contains(b.ring, p[i], p[i + 1])) continue;
        // Do not snap an underpass onto a different deck above it.
        if (Math.abs(height(original, p[i], p[i + 1]) - p[i + 2]) > 1.8) continue;
        p[i + 2] = height(b, p[i], p[i + 1]);
        altered = true;
        break;
      }
    }
    return altered ? { ...road, p } : road;
  });
  return { ...source, bridges, roads, repairs };
}
