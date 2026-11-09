// A repeatable forecast. Positions and velocities are Brisbane world metres,
// and time is measured in seconds. Room clients share the room's server clock.
export const WEATHER_PERIOD = 360;
export const TIERS = [
  { rating: 'EF0', gust: 122, core: 21, height: 143 },
  { rating: 'EF1', gust: 158, core: 29, height: 163 },
  { rating: 'EF2', gust: 196, core: 37, height: 183 },
  { rating: 'EF3', gust: 242, core: 50, height: 207 },
  { rating: 'EF4', gust: 291, core: 66, height: 232 },
  { rating: 'EF5', gust: 345, core: 84, height: 258 },
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
  const vx = (track[2] - track[0]) / 258, vz = (track[3] - track[1]) / 258;
  const x = mix(track[0], track[2], progress), z = mix(track[1], track[3], progress);
  const core = mode === 'fair' ? 0 : envelope * strength;
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
  return { time, cycle, phase, mode, x, z, vx, vz, core, envelope, strength, lightning, tornado,
    warned: possible && phase >= contact - 44 && phase < retreat + 26 };
}
export function rainAt(frame, x, z) {
  const dx = x - frame.x, dz = z - frame.z;
  const speed = Math.hypot(frame.vx, frame.vz) || 1;
  const along = (dx * frame.vx + dz * frame.vz) / speed;
  const cross = (dz * frame.vx - dx * frame.vz) / speed;
  const main = Math.exp(-((along / 710) ** 2) - ((cross / 510) ** 2));
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
  const reach = tornado.core * 3.1;
  if (distance >= reach || height > 80) return null;
  const falloff = (1 - distance / reach) ** 1.65 * tornado.strength;
  const len = Math.max(distance, 1);
  const tangential = (14 + tornado.tier * 3) * falloff;
  const inflow = (8 + tornado.tier * 1.5) * falloff;
  return { x: (dx * inflow - dz * tangential) / len, z: (dz * inflow + dx * tangential) / len,
    lift: (15 + tornado.tier * 5) * falloff, caught: distance < tornado.core * 1.4 };
}
