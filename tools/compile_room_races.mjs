// Run with node --loader ./tools/tests/loader.mjs tools/compile_room_races.mjs.
import { writeFileSync } from 'node:fs';
import { BRISBANE_GEO as geo } from '../src/world/geo/brisbane.data.js';
import { RoadNetwork, distance } from '../src/systems/Navigation.js';
import { createTerrain, easeKerbs } from '../src/world/geo/terrain.js';
import { indexFootprints, pushFootprints } from '../src/world/geo/footprints.js';

const terrain = createTerrain(geo.grid, Uint8Array.from(atob(geo.grid.ground), c => c.charCodeAt(0)));
easeKerbs(terrain, geo.roads);
const feet = indexFootprints(geo.buildings, 48, terrain.walkAt);
const zone = { footBuckets: feet.buckets, footCell: feet.cell };
function clear(a, b) {
  const n = Math.max(1, Math.ceil(distance(a, b) / 3));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
    const y = a.y + (b.y - a.y) * t;
    if (terrain.isWater(x, z) && y < 3) return false;
    const pos = { x, y: y + .15, z };
    pushFootprints(pos, .85, pos.y, zone);
    if (Math.hypot(pos.x - x, pos.z - z) > .1) return false;
  }
  return Math.abs(a.y - b.y) < 2.6 + distance(a, b) * .19;
}
const graph = new RoadNetwork(geo.roads.filter(road => road.k <= 3 && road.w >= 4), terrain.walkAt, clear);
const pick = (x, z) => graph.nearby({ x, z }).map(i => graph.nodes[i])
  .find(p => clear(p, p) && !terrain.isWater(p.x, p.z));
const courses = [
  ['milton', 'Toowong-bound Dash', 'CBD → western Coronation corridor', [17, 187], [-2200, 390]],
  ['west-end', 'West End Rebar Run', 'South Brisbane → Davies Park', [-700, 840], [-1850, 1040]],
  ['valley', 'Valley Voltage', 'CBD → Fortitude Valley', [27, 204], [930, -540]],
  ['south-bank', 'South Bank Shuffle', 'South Brisbane → South Bank', [-718, 855], [-420, 660]],
  ['kangaroo', 'Kangaroo Point Kick', 'Kangaroo Point → Raymond Park', [1295, 520], [1415, 1275]],
];
const records = courses.map(([id, name, description, a, b]) => {
  const start = pick(...a), end = pick(...b);
  const path = graph.route(start, end, (p, q) => distance(p, q) < 22 && clear(p, q));
  if (!path.length) throw Error('No drivable route for ' + id);
  const points = path.filter((p, i) => !i || distance(p, path[i - 1]) > .01)
    .map(p => [p.x, p.y, p.z].map(n => Number(n.toFixed(2))));
  const chunks = [];
  for (let i = 0; i < points.length; i += 7)
    chunks.push('      ' + points.slice(i, i + 7).map(p => JSON.stringify(p)).join(', '));
  console.log(id, points.length, 'road samples');
  return `  { id: ${JSON.stringify(id)}, name: ${JSON.stringify(name)}, description: ${JSON.stringify(description)}, points: [\n${chunks.join(',\n')}\n  ] }`;
});
writeFileSync(new URL('../src/multiplayer/racePaths.js', import.meta.url),
  '// Generated from the Brisbane road graph by tools/compile_room_races.mjs.\nexport const RACE_PATHS = [\n' + records.join(',\n') + '\n];\n');
