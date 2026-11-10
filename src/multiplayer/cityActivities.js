// Measured on the compiled Brisbane walk surface. The gates follow Queen Street's
// established pedestrian route and can be crossed by foot or trolley.
export const RING_GATES = [
  [162.3, 11.07, 90.3, 2.29],
  [189.7, 10.02, 73.4, 2.21],
  [217.5, 8.81, 47.9, 2.40],
  [245.9, 7.57, 14.4, 2.28],
  [276.4, 6.78, -11.9, 2.28],
  [307.6, 6.50, -38.8, 2.28],
  [336, 6.74, -62.7, 2.00],
  [358.4, 7.44, -64.7, 1.66],
].map(([x, y, z, yaw]) => ({ x, y, z, yaw, nx: Math.sin(yaw), nz: Math.cos(yaw) }));

export const RING_WIDTH = 2.8;

export function crossesGate(a, b, gate) {
  const ax = a.x - gate.x, az = a.z - gate.z;
  const bx = b.x - gate.x, bz = b.z - gate.z;
  const before = ax * gate.nx + az * gate.nz;
  const after = bx * gate.nx + bz * gate.nz;
  if (before >= 0 || after < 0) return false;
  const t = before / (before - after);
  const across = (ax + (bx - ax) * t) * gate.nz - (az + (bz - az) * t) * gate.nx;
  const height = a.y + (b.y - a.y) * t - gate.y - .6;
  return Math.hypot(across, height) <= RING_WIDTH;
}

export const EXCHANGE = { x: 0, y: 10.76, z: 77, label: 'CITY HALL REBAR EXCHANGE' };
export const SOCIAL_CLUB = { x: 12, z: 80 };
export const PICKUPS = [
  ['hall-steel', 'rebar', 'City Hall offcut', 9, 10.49, 75, 6],
  ['hall-stamp', 'stamp', 'City Hall stamp', -3, 10.89, 80, 8],
  ['queen-burger', 'burger', 'Mall burger token', 155.6, 11.64, 95.9, 8],
  ['queen-steel', 'rebar', 'Queen Street offcut', 259, 7.06, 3, 6],
  ['edward-shipment', 'rare', 'Questionable Shipment', 321, 6.56, -50, 22],
  ['bank-steel', 'rebar', 'South Bank salvage', -196, 5.01, 789, 6],
  ['bank-burger', 'burger', 'South Bank burger token', -181, 4.30, 798, 8],
  ['bank-stamp', 'stamp', 'South Bank stamp', -202, 5.94, 800, 8],
  ['garden-steel', 'rebar', 'Garden offcut', 602, 11.19, 878, 6],
  ['garden-burger', 'burger', 'Botanic burger token', 630, 10.04, 891, 8],
  ['garden-stamp', 'stamp', 'Botanic Gardens stamp', 612, 11.06, 886, 8],
].map(([id, kind, label, x, y, z, rebar]) => ({ id, kind, label, x, y, z, rebar }));

export const EXCHANGE_ITEMS = [
  { id: 'handling', label: 'Seb’s Steering Kit', price: 12, detail: 'Quicker turns on the trolley.' },
  { id: 'tank', label: 'Big Bung Tank', price: 16, detail: 'More boost fuel per fill.' },
  { id: 'paint', label: 'River Mint Paint', price: 10, detail: 'Mint-green basket, visible to the room.', swatch: 0x46dfbe },
  { id: 'horn', label: 'Burger Buzzer Horn', price: 8, detail: 'Press H while riding. Nearby mates hear it.' },
  { id: 'trail', label: 'Hot Chips Trail', price: 10, detail: 'A pink spark trail other players can see.', swatch: 0xff6fa9 },
];
function huntTarget(room, player, item, now) {
  const hunt = room.events?.hunt;
  return hunt?.status === 'running' && hunt.deadline > now && Number.isFinite(hunt.entries[player.id]) &&
    hunt.targets.includes(item.id);
}
export const huntOpen = (room, player, item, now) =>
  huntTarget(room, player, item, now) && !room.events.hunt.found[item.id];
export function availablePickup(pickup, player, room, now, ignoreHunt = false) {
  if (!ignoreHunt && huntTarget(room, player, pickup, now)) return !room.events.hunt.found[pickup.id];
  return pickup.kind === 'rare'
    ? (room.rareUntil?.[pickup.id] || 0) <= now
    : (player.claims?.[pickup.id] || 0) <= now;
}

// A level section of Raymond Park, Kangaroo Point. Cover sits off the centre
// lane and leaves a route around both sides.
export const ARENA = { x: 1434, y: 8.26, z: 1306, halfX: 17, halfZ: 10, label: 'RAYMOND PARK BURGER HEIST' };
export const ARENA_COVER = [
  { dx: -6, dz: -4.8, w: 3.2, d: 1.8 },
  { dx: -3.5, dz: 5.0, w: 2.8, d: 2.2 },
  { dx: 3.5, dz: -5.0, w: 2.8, d: 2.2 },
  { dx: 6, dz: 4.8, w: 3.2, d: 1.8 },
];
export const ARENA_STAND = { x: 1434, y: 8.36, z: 1292, label: 'BURGER HEIST VIEWING AREA' };
export const ARENA_DOCK = [-1, 1].map(side => ({ x: ARENA.x + side * 14, y: ARENA.y, z: ARENA.z }));
export const arenaContains = p => Math.abs(p.x - ARENA.x) <= ARENA.halfX &&
  Math.abs(p.z - ARENA.z) <= ARENA.halfZ && Math.abs(p.y - ARENA.y) <= 4;
export const arenaLive = arena => arena?.phase === 'playing' || arena?.phase === 'countdown';
