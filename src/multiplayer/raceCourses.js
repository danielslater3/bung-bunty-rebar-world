import { RACE_PATHS } from './racePaths.js';
import { atDistance, distance } from '../systems/Navigation.js';

export const RACE_COURSES = RACE_PATHS.map(({ points, ...course }) => {
  const path = points.map(([x,y,z]) => ({ x,y,z }));
  let length = 0, last = 0;
  const spans = [15];
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1], at = path[i], next = path[i + 1];
    length += distance(from, at);
    const turn = next && Math.abs(Math.atan2(
      (at.x - from.x) * (next.z - at.z) - (at.z - from.z) * (next.x - at.x),
      (at.x - from.x) * (next.x - at.x) + (at.z - from.z) * (next.z - at.z),
    ));
    if (next && ((turn > .55 && length - last > 37) || length - last > 106)) {
      spans.push(length);
      last = length;
    }
  }
  if (length - spans.at(-1) < 19) spans.pop();
  spans.push(length);
  const gates = spans.map((along, index) => {
    const a = atDistance(path, Math.max(0, along - 4)), b = atDistance(path, Math.min(length, along + 4));
    return { ...atDistance(path, along), along, yaw: Math.atan2(b.x - a.x, b.z - a.z),
      power: index > 0 && index < spans.length - 1 && index % 4 === 0 ? (index % 8 ? 'boost' : 'refuel') : null };
  });
  const first = atDistance(path, 9), start = { ...path[0],
    yaw: Math.atan2(first.x - path[0].x, first.z - path[0].z) };
  return { ...course, path, length, gates, start };
});
export const raceCourse = id => RACE_COURSES.find(course => course.id === id);

export function crossesCheckpoint(a, b, gate) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const len = dx * dx + dz * dz;
  const t = len ? Math.max(0, Math.min(1, ((gate.x - a.x) * dx + (gate.z - a.z) * dz) / len)) : 0;
  return Math.hypot(a.x + dx * t - gate.x, a.z + dz * t - gate.z) <= 7.5 &&
    Math.abs(a.y + (b.y - a.y) * t - gate.y) <= 4;
}
