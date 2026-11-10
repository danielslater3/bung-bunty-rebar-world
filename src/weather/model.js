// A repeatable forecast. Positions and velocities are Brisbane world metres,
// and time is measured in seconds. Room clients share the room's server clock.
export const WEATHER_PERIOD = 360;
export const TIERS = [
  { rating: 'EF0', gust: 122, core: 14, height: 142, capture: 14, reach: 48, toss: 8, duration: 1.7 },
  { rating: 'EF1', gust: 158, core: 23, height: 156, capture: 24, reach: 78, toss: 14, duration: 2.3 },
  { rating: 'EF2', gust: 196, core: 37, height: 174, capture: 48, reach: 118, toss: 22, duration: 3.1 },
  { rating: 'EF3', gust: 242, core: 53, height: 195, capture: 80, reach: 185, toss: 34, duration: 4.2 },
  { rating: 'EF4', gust: 291, core: 78, height: 223, capture: 135, reach: 290, toss: 48, duration: 5.5 },
  { rating: 'EF5', gust: 345, core: 126, height: 250, capture: 315, reach: 525, toss: 94, duration: 9 },
];
export const TRACKS = [
  [-1490, 900, 1480, -360],  // West End, CBD, Fortitude Valley
  [-1170, 1570, 1280, 250],  // South Brisbane, Gardens, Kangaroo Point
  [-1360, 235, 1250, -500],  // Inner west, CBD and north bank
  [-1100, 1220, 1630, 1090], // South Bank towards Raymond Park
];
export function hashWeather(input) {
  let n = 2166136261;
  for (const c of String(input)) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0;
}
function random(seed, cycle, channel) {
  let n = (seed ^ Math.imul(cycle + 917, 0x85ebca6b) ^ Math.imul(channel + 1, 0xc2b2ae35)) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
const clamp = x => Math.max(0, Math.min(1, x));
const mix = (a, b, t) => a + (b - a) * t;
function smooth(a, b, x) {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
export function tornadoTier(roll) {
  return roll < .41 ? 0 : roll < .72 ? 1 : roll < .89 ? 2 :
    roll < .967 ? 3 : roll < .997 ? 4 : 5;
}
export function weatherAt(seed, time, exercise = null) {
  time = Math.max(0, time);
  const cycle = Math.floor(time / WEATHER_PERIOD), phase = time % WEATHER_PERIOD;
  const pick = n => random(seed, cycle, n);
  const roll = exercise ? .99 : pick(0);
  const mode = roll < .13 ? 'fair' : roll < .42 ? 'showers' : roll < .79 ? 'storm' : 'supercell';
  const track = TRACKS[exercise?.track ?? Math.floor(pick(1) * TRACKS.length)];
  const strength = exercise ? .96 : .58 + .41 * pick(2);
  const envelope = smooth(20, 90, phase) * (1 - smooth(239, 330, phase));
  const progress = clamp((phase - 25) / 258);
  const startX = track[0] + (exercise ? 0 : (pick(14) - .5) * 420);
  const startZ = track[1] + (exercise ? 0 : (pick(15) - .5) * 420);
  const endX = track[2] + (exercise ? 0 : (pick(16) - .5) * 480);
  const endZ = track[3] + (exercise ? 0 : (pick(17) - .5) * 480);
  const vx = (endX - startX) / 258, vz = (endZ - startZ) / 258;
  const x = mix(startX, endX, progress), z = mix(startZ, endZ, progress);
  const core = mode === 'fair' ? 0 : envelope * strength;
  const shape = pick(12);
  const scale = mode === 'supercell' ? 1.38 + shape * .36 : mode === 'storm' ? 1.23 : 1;
  const hail = (mode === 'supercell' || mode === 'storm') && core > .38 && (exercise || pick(13) > .29)
    ? Math.round((exercise ? 25 + exercise.tier * 12 : 8 + shape ** 1.9 * (mode === 'supercell' ? 86 : 47)) * Math.min(1, core / .63))
    : 0;
  const tier = exercise?.tier ?? tornadoTier(pick(5));
  const possible = mode === 'supercell' && (exercise || pick(4) < .45);
  const contact = 115 + 23 * pick(6), retreat = contact + 42 + 40 * pick(7);
  const formed = possible && phase > contact - 29 && phase < retreat + 29;
  const touchdown = smooth(contact - 28, contact + 3, phase) * (1 - smooth(retreat - 2, retreat + 28, phase));
  const v = TIERS[tier];
  const tornado = formed ? {
    ...v, tier, x: x - vx * 11 + Math.sin(time / 14) * 27, z: z - vz * 11 + Math.cos(time / 17) * 27,
    touchdown, ground: touchdown > .83, strength: touchdown * strength,
  } : null;
  const slot = Math.floor(time / 7.1), strikeAt = slot * 7.1 + 1 + random(seed, slot, 8) * 4.2;
  const lightning = (mode === 'storm' || mode === 'supercell') && core > .45 && random(seed, slot, 9) < strength
    ? { id: slot, time: strikeAt, x: x + (random(seed, slot, 10) - .5) * 570, z: z + (random(seed, slot, 11) - .5) * 510 } : null;
  return { time, cycle, phase, mode, x, z, vx, vz, core, envelope, strength, shape, scale, hail, lightning, tornado,
    warned: possible && phase >= contact - 44 && phase < retreat + 26 };
}
export function rainAt(frame, x, z) {
  const dx = x - frame.x, dz = z - frame.z;
  const speed = Math.hypot(frame.vx, frame.vz) || 1;
  const along = (dx * frame.vx + dz * frame.vz) / speed;
  const cross = (dz * frame.vx - dx * frame.vz) / speed;
  const scale = frame.scale;
  const main = Math.exp(-((along / (710 * scale)) ** 2) - ((cross / (510 * scale)) ** 2));
  const flank = .44 * Math.exp(-(((along + 490) / 470) ** 2) - (((cross - 310) / 300) ** 2));
  const angle = Math.atan2(cross, along + 175), radius = Math.hypot(along + 175, cross);
  const hook = frame.mode === 'supercell' && angle > .1 && angle < 3
    ? .46 * Math.exp(-(((radius - 410 + 66 * angle) / 105) ** 2)) * Math.sin(angle) : 0;
  const grain = .87 + .10 * Math.sin(x / 97 + Math.cos(z / 93)) + .07 * Math.cos(z / 47 + x / 124);
  return clamp((main + flank + hook) * grain * frame.core);
}
export function conditionsAt(frame, x, z) {
  const rain = rainAt(frame, x, z);
  const speed = Math.hypot(frame.vx, frame.vz) || 1;
  const gust = 6 + 8 * frame.strength + rain * (frame.mode === 'showers' ? 18 : 70) +
    rain * 7 * Math.sin(frame.time * .72 + (x + z) / 160);
  const temp = Math.round(29 + 2 * Math.sin(frame.time / 250) - frame.envelope * 3 - rain * 6);
  return { rain, gust, temp, windX: frame.vx / speed * gust / 3.6, windZ: frame.vz / speed * gust / 3.6,
    label: rain > .40 ? (frame.mode === 'showers' ? 'Heavy showers' : 'Thunderstorm') :
      rain > .13 ? 'Rain showers' : frame.core > .22 ? 'Storm clouds nearby' : frame.envelope > .25 ? 'Partly cloudy' : 'Mostly clear' };
}
export function vortexAt(tornado, x, z, height) {
  if (!tornado?.ground) return null;
  const dx = tornado.x - x, dz = tornado.z - z, distance = Math.hypot(dx, dz);
  const reach = tornado.reach;
  if (distance >= reach || height > 80) return null;
  const falloff = (1 - distance / reach) ** 1.65 * tornado.strength;
  const len = Math.max(distance, 1);
  const tangential = (14 + tornado.tier * 6) * falloff;
  const inflow = (8 + tornado.tier * 6) * falloff;
  return { x: (dx * inflow - dz * tangential) / len, z: (dz * inflow + dx * tangential) / len,
    lift: (13 + tornado.tier * 8) * falloff, caught: distance < tornado.capture };
}

export function weatherWarning(frame, x, z, localOnly = false) {
  const t = frame.tornado;
  const distance = Math.round(Math.hypot(x - (t?.x ?? frame.x), z - (t?.z ?? frame.z)));
  if (localOnly && distance > 2200) return null;
  const storm = frame.mode === 'supercell' ? 'Supercell' : 'Thunderstorm';
  const hail = frame.hail >= 50 ? 'Very large hail' : frame.hail >= 20 ? 'Large hail' : frame.hail ? 'Small hail' : 'No hail';
  if (frame.warned) return {
    title: t?.ground ? t.rating + ' tornado on ground' : t ? t.rating + ' funnel forming' : 'Tornado watch',
    detail: storm + ' · ' + hail + (frame.hail ? ' (' + frame.hail + ' mm)' : ''),
    severity: t?.ground ? (t.tier === 5 ? 'extreme' : 'high') : 'watch',
    distance,
  };
  if (frame.core < .33 || !['storm', 'supercell'].includes(frame.mode)) return null;
  return {
    title: frame.hail >= 20 || frame.mode === 'supercell' ? 'Severe ' + storm.toLowerCase() : storm,
    detail: hail + (frame.hail ? ' (' + frame.hail + ' mm)' : '') + ' · No tornado',
    severity: 'watch', distance,
  };
}
