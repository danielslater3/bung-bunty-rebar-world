// Public geography is fixed; interior plans are game layouts, not hotel plans.
export const HOTEL_ENTRY = { x: -137.77, z: 171.89 };
export const COURT_ENTRY = { x: -136, z: -99 };
export const HOTEL_FLOORS = [
  { n: 0, name: 'WELCOME · Living Room Bar' },
  { n: 3, name: 'THE LEX · Restaurant' },
  { n: 4, name: 'WET · Pool & deck' },
  { n: 5, name: 'AWAY · Spa' },
  { n: 6, name: 'FIT · Gym' },
  ...[9, 12, 18, 24].map((n) => ({
    n,
    name:
      n === 9
        ? 'ROOM 901 · Wonderful King'
        : n === 24
          ? 'Fantastic suites'
          : 'Guest rooms & corner rooms',
  })),
];
export const HOTEL_STOPS = [
  'hotel-bar',
  'hotel-pool',
  'hotel-spa',
  'hotel-gym',
];
export function venueBuilding(b) {
  if (Math.abs(b.r?.[0] + 128.7) < 0.15 && Math.abs(b.r?.[1] - 204.6) < 0.15)
    return 'hotel';
  if (Math.abs(b.r?.[0] + 219.4) < 0.15 && Math.abs(b.r?.[1] + 82.1) < 0.15)
    return 'court';
  return null;
}
export function hotelTarget(id) {
  return {
    'hotel-reception': 0,
    'hotel-bar': 0,
    'hotel-room-door': 9,
    'hotel-room': 9,
    'hotel-mixbar': 9,
    'hotel-bed': 9,
    'hotel-pool': 4,
    'hotel-spa': 5,
    'hotel-gym': 6,
    'hotel-meal': 3,
    'hotel-dance': 3,
    newphone: 3,
    'hotel-night': 3,
  }[id];
}
export function migrateVenues(s, chapters) {
  if (s.venueVersion === 1) return false;
  if (s.chapter === 9) {
    const legacy = ['invite', 'dance', 'newphone', 'toast'];
    s.hotel ||= { key: true, roomOpen: true, visited: {} };
    const id = legacy[s.step] || 'toast';
    s.step = s.done?.includes('ch10')
      ? chapters[9].steps.length
      : chapters[9].steps.findIndex((v) => v.id === id);
    s.venue = ['dance', 'newphone'].includes(id)
      ? { kind: 'hotel', floor: 3 }
      : null;
  }
  s.venueVersion = 1;
  return true;
}
