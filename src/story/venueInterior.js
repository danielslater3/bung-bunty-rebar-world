// One resident floor at a time; shared geometry/materials across all room templates.
import * as THREE from 'three';
import { VenueFrame } from '../core/colliderSpace.js';
import { mat } from '../core/utils.js';

export function interiorKit(manager, kind, level) {
  const { Z, saga } = manager;
  const root = new THREE.Group();
  root.name = `${kind} · floor ${level}`;
  root.userData.abs = true;
  Z.group.add(root);
  const base =
    kind === 'hotel'
      ? { x: 0, z: 0, y: Z.venues.hotel.building.g + level * 3.9 }
      : { x: 0, z: 0, y: Z.venues.court.building.g };
  const width = kind === 'hotel' ? 32 : 24,
    depth = kind === 'hotel' ? 32 : 28;
  const room = {
    kind: 'venue',
    venue: kind,
    level,
    floor: base.y,
    ceil: base.y + 4.2,
    minX: base.x - width / 2,
    maxX: base.x + width / 2,
    minZ: base.z - depth / 2,
    maxZ: base.z + depth / 2,
  };
  const cols = [],
    grounds = [],
    interactions = [],
    doors = [],
    floorPoints = [];
  const palette = manager.palette;
  const box = (x, y, z, w, h, d, color = 'cream', solid = h > 0.35) => {
    const o = new THREE.Mesh(manager.unit, palette[color] || palette.cream);
    o.position.set(base.x + x, base.y + y + h / 2, base.z + z);
    o.scale.set(w, h, d);
    o.receiveShadow = true;
    root.add(o);
    if (solid) {
      o.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(o);
      cols.push(b);
      Z.colliders.push(b);
      o.userData.blocker = b;
    }
    return o;
  };
  const round = (x, y, z, r, h, color = 'gold') => {
    const o = new THREE.Mesh(manager.cylinder, palette[color]);
    o.position.set(base.x + x, base.y + y + h / 2, base.z + z);
    o.scale.set(r, h, r);
    root.add(o);
    return o;
  };
  const sign = (x, y, z, text, w = 3, h = 0.6, angle = 0) => {
    const o = Z.textSign(base.x + x, base.y + y, base.z + z, angle, text, {
      w,
      h,
      bg: '#253345',
      fg: '#ffdfaa',
    });
    root.add(o);
    return o;
  };
  const point = (id, x, z, label, fn, y = 0) => {
    const p = new THREE.Vector3(base.x + x, base.y + y, base.z + z);
    manager.points[id] = p;
    floorPoints.push(id);
    if (fn) {
      const it = {
        id,
        pos: p.clone().add(new THREE.Vector3(0, 0.8, 0)),
        dist: 2.5,
        label: `<b>[E]</b> ${label}`,
        fn,
      };
      Z.interactables.push(it);
      interactions.push(it);
    }
    return p;
  };
  const sofa = (x, z, color = 'rose') => {
    box(x, 0, z, 3, 0.5, 1, color);
    box(x, 0.45, z + 0.4, 3, 0.7, 0.2, color);
    box(x - 1.4, 0.4, z, 0.2, 0.5, 0.9, color);
    box(x + 1.4, 0.4, z, 0.2, 0.5, 0.9, color);
  };
  const chair = (x, z, angle = 0) => {
    const o = box(x, 0, z, 0.8, 0.5, 0.8, 'teal');
    box(x, 0.4, z + 0.32, 0.8, 0.8, 0.15, 'teal');
    return o;
  };
  const table = (x, z, w = 2, d = 1) => {
    box(x, 0, z, 0.18, 0.7, 0.18, 'gold');
    box(x, 0.7, z, w, 0.12, d, 'wood');
  };
  const plant = (x, z) => {
    round(x, 0, z, 0.38, 0.65, 'stone');
    for (let i = 0; i < 5; i++) {
      const a = i * 1.256;
      const o = new THREE.Mesh(manager.sphere, palette.leaf);
      o.position.set(
        base.x + x + Math.sin(a) * 0.32,
        base.y + 1.4,
        base.z + z + Math.cos(a) * 0.32,
      );
      o.scale.set(0.24, 0.8, 0.32);
      o.rotation.z = Math.sin(a) * 0.4;
      root.add(o);
    }
  };
  const lamp = (x, z) => {
    round(x, 0, z, 0.18, 1.7, 'gold');
    round(x, 1.7, z, 0.38, 0.5, 'light');
  };
  const art = (x, z) => {
    box(x, 1.2, z, 2.8, 1.7, 0.1, 'gold', false);
    for (let i = 0; i < 7; i++) {
      const o = round(x - 1.1 + i * 0.36, 1.3, z - 0.1, 0.12, 1.3, 'rose');
      o.rotation.z = Math.sin(i) * 0.5;
    }
  };
  const door = (id, x, z, number, fn) => {
    // Wide open doorway; the same solid door collider is removed on opening.
    box(x - 1.35, 0, z, 0.25, 3, 0.35, 'gold');
    box(x + 1.35, 0, z, 0.25, 3, 0.35, 'gold');
    box(x, 2.95, z, 2.9, 0.22, 0.35, 'gold');
    const pivot = new THREE.Group();
    pivot.position.set(base.x + x - 1.2, base.y, base.z + z);
    root.add(pivot);
    const panel = new THREE.Mesh(manager.unit, palette.wood);
    panel.position.set(1.2, 1.45, 0);
    panel.scale.set(2.4, 2.9, 0.16);
    pivot.add(panel);
    pivot.updateMatrixWorld(true);
    const blocker = new THREE.Box3().setFromObject(panel);
    cols.push(blocker);
    Z.colliders.push(blocker);
    const d = { id, pivot, blocker, target: 0, angle: 0 };
    doors.push(d);
    sign(x, 3.5, z - 0.2, number, 1.7, 0.4);
    point(id, x, z - 1.25, `Open ${number}`, () => {
      if (fn && !fn()) return;
      d.target = -Math.PI * 0.52;
      Z.colliders = Z.colliders.filter((b) => b !== blocker);
    });
    return d;
  };
  const ground = box(
    0,
    -0.18,
    0,
    width,
    0.18,
    depth,
    kind === 'court' ? 'wood' : 'stone',
    false,
  );
  grounds.push(ground);
  Z.grounds.push(ground);
  Z._baseGrounds?.push(ground);
  // Floor shells enclose cameras. River glazing provides actual city views.
  box(0, 0, -depth / 2, width, 4.3, 0.24, 'cream');
  box(0, 0, depth / 2, width, 4.3, 0.24, 'glass');
  box(-width / 2, 0, 0, 0.24, 4.3, depth, 'glass');
  box(width / 2, 0, 0, 0.24, 4.3, depth, 'cream');
  box(0, 4.25, 0, width, 0.14, depth, 'cream', false);
  for (let x = -width / 2 + 3; x < width / 2; x += 6)
    for (let z = -depth / 2 + 4; z < depth / 2; z += 8)
      box(x, 4.05, z, 2, 0.06, 0.22, 'light', false);
  const light = new THREE.PointLight(0xffe1b8, 35, 24, 1.5);
  light.position.set(base.x, base.y + 3.5, base.z);
  root.add(light);
  const floorMark =
    kind === 'hotel'
      ? `W · ${level === 0 ? 'WELCOME' : `LEVEL ${level}`}`
      : 'BRISBANE CITY COURT';
  sign(0, 3.4, -depth / 2 + 0.25, floorMark, 5, 0.65);
  if (kind === 'hotel') {
    // Lift alcove has animated paired doors and a physical floor panel.
    const left = box(-0.65, 0, -14.6, 1.25, 3, 0.18, 'gold', false),
      right = box(0.65, 0, -14.6, 1.25, 3, 0.18, 'gold', false);
    manager.liftDoors = [left, right];
    manager.liftDoorX = [left.position.x, right.position.x];
    point('hotel-lift', 0, -12, 'Choose a floor', () => manager.liftMenu());
    sign(3, 1.7, -14.8, 'E · LIFT\nG  3  4  5  6\n9  12  18  24', 2.2, 1.3);
    if (level === 0) {
      point('hotel-exit', 0, 13, 'Return to North Quay', () => manager.leave());
      point('hotel-arrival', 0, 12, 'Arrival', null);
      box(-8, 0, -6, 6, 1.1, 1.1, 'gold');
      box(-8, 1.1, -6, 6, 0.16, 1.3, 'wood');
      sign(-8, 2.8, -7.4, 'WHATEVER / WHENEVER\nRECEPTION', 5, 1);
      point('hotel-reception', -8, -8, 'Check in · room 901', () =>
        manager.action('hotel-reception'),
      );
      manager.person(-8, -4.5, 'staff', root, base, 0x305b62);
      for (let i = 0; i < 3; i++) {
        box(-13 + i * 0.65, 0, -1, 0.5, 0.85, 0.4, 'rose');
        round(-13 + i * 0.65, 0.85, -1, 0.025, 0.25, 'gold');
      }
      box(-8, 0.015, 4.5, 7, 0.025, 5, 'rose', false);
      box(8, 0.015, 4.5, 7, 0.025, 5, 'teal', false);
      for (let i = 0; i < 16; i++) {
        box(
          -14 + i * 1.8,
          3.55 + Math.sin(i * 0.5) * 0.18,
          0,
          0.12,
          0.14,
          17,
          'gold',
          false,
        );
      }
      for (let i = 0; i < 7; i++) {
        const o = round(-10 + i * 0.65, 1.7, -7.8, 0.08, 0.7, 'gold');
        o.rotation.z = Math.sin(i) * 0.45;
      }
      sofa(-8, 5);
      sofa(8, 5, 'teal');
      table(-8, 3);
      table(8, 3);
      lamp(-13, 7);
      lamp(13, 7);
      art(0, 15.7);
      box(8, 0, 11, 8, 1.15, 1.4, 'teal');
      sign(8, 2.8, 14, 'LIVING ROOM BAR', 6, 0.7);
      for (let i = 0; i < 7; i++) {
        round(5 + i, 1.15, 11, 0.1, 0.4, i % 2 ? 'rose' : 'gold');
        round(5 + i, 0, 8.8, 0.3, 0.65, 'rose');
      }
      point('hotel-bar', 8, 7, 'Take a seat · Living Room Bar', () =>
        manager.action('hotel-bar'),
      );
      manager.person(9, 12.5, 'bartender', root, base, 0xe8d1ac);
    } else if (level === 3) {
      for (let i = 0; i < 8; i++) {
        round(-13 + i * 3.6, 3.15, -2, 0.25, 0.45, 'light');
      }
      sign(-7, 3.3, 1, 'THE LEX\nRIVER GRILL', 6, 1);
      for (const x of [-10, 8])
        for (const z of [-5, 4, 11]) {
          table(x, z, 2.8, 1.8);
          chair(x - 1, z - 1.4);
          chair(x + 1, z + 1.4);
          round(x, 0.85, z, 0.26, 0.05, 'cream');
          round(x, 0.9, z, 0.12, 0.3, 'gold');
        }
      box(13, 0, -10, 3, 1.2, 6, 'wood');
      sign(12, 2.3, -10, 'SERVICE', 2, 0.6);
      point('hotel-meal', -10, -7.5, 'Order the victory dinner', () =>
        manager.action('hotel-meal'),
      );
      point('newphone', -8, -6.2, 'Pocket the replacement phone', () =>
        manager.action('newphone'),
      );
      const phone = box(-10, 0.86, -5, 0.25, 0.025, 0.5, 'phone', false);
      phone.name = 'Replacement blue S24 Ultra';
      point('hotel-dance', 0, 5, 'Celebration floor', null);
      for (let i = 0; i < 9; i++)
        box(
          ((i % 3) - 1) * 1.4,
          0.01,
          4 + Math.floor(i / 3) * 1.4,
          1.3,
          0.02,
          1.3,
          i % 2 ? 'rose' : 'gold',
          false,
        );
      point('hotel-night', -8, 13, 'Look out over Brisbane', () =>
        manager.action('hotel-night'),
      );
      manager.person(12, -7, 'waiter', root, base, 0x222c42);
    } else if (level === 4) {
      sign(-7, 3.4, 14, 'WET DECK', 6, 0.9);
      // Water is deliberately shallow, with collision-safe edge and walkable base.
      box(-6, 0.02, 2, 10, 0.04, 19, 'water', false);
      for (let z = -6; z < 12; z += 2)
        box(-6, 0.065, z, 9.8, 0.015, 0.035, 'light', false);
      for (const x of [-11.5, -0.5])
        box(x, 0, 2, 0.3, 0.28, 20, 'cream', false);
      for (const z of [-8, 12]) box(-6, 0, z, 11, 0.28, 0.3, 'cream', false);
      for (let z = -6; z <= 10; z += 4) {
        box(6, 0.1, z, 1.8, 0.35, 2.8, 'cream');
        box(6, 0.35, z + 1, 1.8, 0.45, 0.4, 'teal');
        plant(13, z);
      }
      box(10, 0, 13, 8, 1, 1.5, 'wood');
      point('hotel-pool', 0, -8.5, 'Enjoy WET Deck · poolside', () =>
        manager.action('hotel-pool'),
      );
    } else if (level === 5) {
      sign(-6, 3.2, -8, 'AWAY · EXHALE', 6, 0.8);
      for (const x of [-9, 9]) {
        box(x, 0.15, 5, 4, 0.4, 6, 'water', false);
        box(x, 0, 9.5, 5, 0.9, 1, 'wood');
        lamp(x, 12);
      }
      for (const x of [-9, 9]) {
        box(x, 0, -4, 2.2, 0.8, 4, 'cream');
        box(x, 0.8, -5.3, 1.4, 0.12, 0.7, 'rose');
      }
      box(0, 0, 7, 1, 2.4, 12, 'wood');
      plant(-13, 12);
      plant(13, 12);
      art(0, 15.7);
      point('hotel-spa', -6, -9, 'AWAY · relaxation treatment', () =>
        manager.action('hotel-spa'),
      );
    } else if (level === 6) {
      sign(0, 3, 14, 'FIT · STEEL IS A LIFESTYLE', 8, 0.8);
      for (const x of [-11, -6, -1]) {
        box(x, 0.1, 8, 2.1, 0.3, 4, 'dark');
        box(x, 0, 10, 1.8, 1.7, 0.18, 'dark');
        box(x, 1.7, 10, 1.8, 0.5, 0.22, 'glass');
        box(x - 1, 0.2, 8, 0.1, 1.3, 3, 'gold');
        box(x + 1, 0.2, 8, 0.1, 1.3, 3, 'gold');
      }
      for (const x of [-9, 8]) {
        box(x, 0, -3, 2, 0.65, 3, 'dark');
        box(x, 0, -1, 3.5, 2.5, 0.15, 'gold');
        for (let i = 0; i < 3; i++)
          round(x - 1 + i, 0.8 + i * 0.35, -1, 0.25, 0.25, 'dark');
      }
      box(11, 0, 6, 5, 0.7, 1, 'wood');
      for (let i = 0; i < 6; i++) round(9 + i * 0.7, 0.7, 6, 0.2, 0.22, 'dark');
      point('hotel-gym', 0, -5, 'FIT · Rebar rep challenge', () =>
        manager.action('hotel-gym'),
      );
    } else {
      // Four accessible rooms per guest floor, with category-dependent furnishings.
      box(0, 0, 0, 3.5, 0.025, 25, 'rose', false);
      for (const side of [-1, 1])
        for (let index = 0; index < 2; index++) {
          const x = side * 8.5,
            z = index ? 8 : -5,
            number = level * 100 + (side < 0 ? 1 : 3) + index;
          const reserved = number === 901;
          // Rooms connect through corridor-facing openings; side walls leave 2.4m doors.
          const wallX = side * 2.1;
          box(wallX, 0, z - 4.3, 0.18, 4, 3.2, 'cream');
          box(wallX, 0, z + 4.3, 0.18, 4, 3.2, 'cream');
          // Door faces the corridor via a short open vestibule (no hidden blocker).
          sign(
            wallX,
            2.6,
            z,
            `${number}\n${level === 24 ? 'FANTASTIC SUITE' : index ? 'COOL CORNER' : 'WONDERFUL KING'}`,
            2,
            0.65,
            side < 0 ? Math.PI / 2 : -Math.PI / 2,
          );
          const marker = reserved ? 'hotel-room-door' : `hotel-door-${number}`;
          // The visible door slides along the room wall, rather than through the aisle.
          const panel = box(wallX, 0, z, 0.16, 2.7, 2.4, 'wood');
          const d = {
            id: marker,
            panel,
            blocker: panel.userData.blocker,
            target: 0,
            slide: 0,
            initial: panel.position.z,
          };
          doors.push(d);
          point(marker, side * 0.6, z, `Room ${number}`, () => {
            if (reserved && !manager.hotel().key) {
              saga.game.say(
                'bung',
                'Reception has the key. The singlet does not pick locks.',
              );
              return;
            }
            d.target = 1;
            Z.colliders = Z.colliders.filter((b) => b !== d.blocker);
            if (reserved) {
              manager.hotel().roomOpen = true;
              manager.action(marker);
            }
          });
          if (reserved && manager.hotel().roomOpen) {
            d.target = 1;
            d.slide = 1;
            panel.position.z += 2.6;
            Z.colliders = Z.colliders.filter((b) => b !== d.blocker);
          }
          point(`hotel-inside-${number}`, side * 4, z, 'Room interior', null);
          box(x, 0, z + 6, 12, 4, 0.18, 'cream');
          box(x, 0, z, 3.3, 0.55, 4.2, 'wood');
          box(x, 0.55, z, 3.35, 0.3, 4.2, 'cream');
          box(x, 0.85, z + 1.5, 3.3, 0.12, 1, 'teal');
          box(x, 0.85, z - 1.3, 2.8, 0.2, 0.7, 'cream');
          box(x, 0, z - 2.2, 4, 1.6, 0.16, 'teal');
          for (const dx of [-2.5, 2.5]) {
            table(x + dx, z - 1, 1, 0.8);
            lamp(x + dx, z - 1);
          }
          table(x, z + 4.4, 3, 1);
          chair(x, z + 3.4);
          box(x, 0.85, z + 4.5, 0.8, 0.1, 0.6, 'gold', false);
          box(side * 14.3, 0, z - 1.5, 1, 2.8, 2.2, 'wood');
          sign(
            side * 14.1,
            2.2,
            z - 1.5,
            'MIXBAR',
            1.4,
            0.4,
            side < 0 ? Math.PI / 2 : -Math.PI / 2,
          );
          for (let i = 0; i < 3; i++) {
            round(
              side * 14.15,
              0.9 + i * 0.35,
              z - 1.5,
              0.08,
              0.24,
              i % 2 ? 'gold' : 'rose',
            );
          }
          box(x, 1.1, z - 2.3, 4.6, 0.08, 0.2, 'gold', false);
          // Bathroom, basin, mirror, rain shower and distinctive drum-style tub.
          const bx = side * 12.6,
            bz = z + 3.3;
          round(bx, 0, bz, 0.95, 0.85, level === 24 ? 'gold' : 'cream');
          round(bx, 0.86, bz, 0.8, 0.03, 'water');
          box(side * 5.5, 0, z + 4.7, 1.5, 0.9, 0.7, 'wood');
          round(side * 5.5, 0.9, z + 4.7, 0.4, 0.1, 'cream');
          box(side * 5.5, 1.3, z + 5.65, 1.4, 1.4, 0.05, 'glass', false);
          box(side * 11.8, 0, z + 1.8, 3.2, 2.6, 0.08, 'glass');
          box(side * 14, 0, z - 4, 2.2, 2.8, 0.05, 'glass');
          round(side * 14, 2.6, z - 4, 0.25, 0.1, 'gold');
          for (const dz of [-4, 5])
            box(side * 15, 0, z + dz, 0.3, 4, 0.6, 'rose', false);
          if (level === 24) {
            sofa(side * 7, z + 3.2, 'teal');
            art(side * 9, z + 5.8);
          }
          if (reserved) {
            point('hotel-room', -4, -5, 'Enter room 901', null);
            point(
              'hotel-mixbar',
              -12.8,
              -6.5,
              'Inspect the Mixbar & room',
              () => manager.action('hotel-mixbar'),
            );
            point('hotel-bed', -8, -1.8, 'Try the bed', () =>
              saga.game.say(
                'bung',
                'A mattress with no rebar in it. How do they keep it structurally honest?',
              ),
            );
          }
        }
    }
    for (const p of [
      [-13, -12],
      [13, -12],
      [-13, 13],
      [13, 13],
    ])
      plant(...p);
  } else {
    // Open central aisle; gallery and counsel tables are solid, reachable scenery.
    box(0, 0.02, -9, 15, 0.3, 5, 'wood', false);
    box(0, 0.32, -10, 9, 1.5, 1.8, 'wood');
    sign(0, 3.3, -13.7, 'QUEENSLAND\nFICTIONAL REBAR HEARING', 6, 1);
    box(0, 0, -6, 16, 0.9, 0.18, 'wood');
    box(0, 0, -6, 3, 0.95, 0.2, 'gold', false);
    for (let i = 0; i < 9; i++)
      box(-10.5 + i * 2.6, 0.8, -13.8, 0.12, 2.9, 0.1, 'gold', false);
    round(1, 0.32, -9.2, 0.08, 0.08, 'dark');
    box(1, 0.4, -9.2, 0.5, 0.1, 0.15, 'wood', false);
    sign(-6, 1.3, 1.1, 'BUNG / CHUNG', 2, 0.4);
    sign(6, 1.3, 1.1, 'GABOR', 2, 0.4);
    table(-6, 0, 4, 2);
    table(6, 0, 4, 2);
    chair(-6, 1.5);
    chair(6, 1.5);
    for (const x of [-7, 7])
      for (const z of [7, 10]) {
        box(x, 0, z, 6, 0.5, 1, 'wood');
        box(x, 0.45, z + 0.4, 6, 0.8, 0.2, 'wood');
      }
    box(8, 0, -7, 3, 1.1, 2.5, 'wood');
    sign(-6, 1.6, -0.2, 'EXHIBITS A–D', 2, 0.45);
    for (let i = 0; i < 4; i++)
      box(
        -7.2 + i * 0.8,
        0.84,
        0,
        0.55,
        0.05,
        0.7,
        ['cream', 'gold', 'glass', 'phone'][i],
        false,
      );
    manager.person(0, -11.2, 'judge', root, base, 0x29243d);
    manager.person(-8, -10, 'clerk', root, base, 0x34454e);
    manager.person(8, -8.2, 'witnessStand', root, base, 0xa77758);
    for (const [i, p] of [
      [0, [-8, 10]],
      [1, [8, 10]],
      [2, [-5, 7]],
      [3, [5, 7]],
    ])
      manager.person(
        ...p,
        `gallery${i}`,
        root,
        base,
        i % 2 ? 0x9271a6 : 0x497b7b,
      );
    point('court-return', 0, 11, 'Return to George Street', () =>
      manager.leave(),
    );
    point('court-stand', 0, 2, 'Counsel position', null);
  }
  // Align the entire floor with the mapped NW–SE wings. Its 28.8 m
  // square envelope fits the existing hotel polygon rather than the road.
  const frame = new VenueFrame(
    kind === 'hotel' ? -115.31 : -183,
    kind === 'hotel' ? 214.79 : -112,
    0.714,
    0.9,
  );
  root.position.set(frame.x, 0, frame.z);
  root.rotation.y = 0.714;
  root.scale.set(0.9, 1, 0.9);
  root.updateMatrixWorld(true);
  for (const b of cols) {
    b.localBox = b.clone();
    b.frame = frame;
    const corners = [];
    for (const x of [b.min.x, b.max.x])
      for (const y of [b.min.y, b.max.y])
        for (const z of [b.min.z, b.max.z]) {
          const p = frame.world({ x, y, z });
          corners.push(new THREE.Vector3(p.x, p.y, p.z));
        }
    b.setFromPoints(corners);
  }
  for (const it of interactions) frame.world(it.pos, it.pos);
  for (const id of Object.keys(manager.points))
    if (floorPoints.includes(id))
      frame.world(manager.points[id], manager.points[id]);
  room.contains = (p, pad = 0) => {
    const q = frame.local(p);
    return (
      q.x > -width / 2 + pad &&
      q.x < width / 2 - pad &&
      q.z > -depth / 2 + pad &&
      q.z < depth / 2 - pad
    );
  };
  room.clamp = (p, pad = 0) => {
    const q = frame.local(p);
    q.x = Math.max(-width / 2 + pad, Math.min(width / 2 - pad, q.x));
    q.z = Math.max(-depth / 2 + pad, Math.min(depth / 2 - pad, q.z));
    frame.world(q, p);
  };
  room.frame = frame;
  for (const [id, x, z] of [['judge', 0, -11.2]])
    if (kind === 'court') {
      const a = saga.actors[id];
      Z.group.attach(a);
      a.position.y += 0.6;
      root.userData.detachedJudge = a;
    }
  base.x = frame.x;
  base.z = frame.z;
  return {
    root,
    room,
    base,
    frame,
    cols,
    grounds,
    interactions,
    doors,
    floorPoints,
    box,
    point,
    sign,
  };
}

export function createPalette() {
  const colors = {
    cream: 0xf4eadd,
    stone: 0xd0c6bb,
    wood: 0x77513f,
    gold: 0xd9ad62,
    teal: 0x255c66,
    rose: 0xb86f82,
    dark: 0x202c3d,
    leaf: 0x32664e,
    water: 0x43bdcd,
    phone: 0x3689e7,
  };
  const p = Object.fromEntries(
    Object.entries(colors).map(([k, c]) => [
      k,
      mat(c, {
        roughness: k === 'gold' ? 0.38 : 0.7,
        metalness: k === 'gold' ? 0.4 : 0.04,
      }),
    ]),
  );
  p.glass = mat(0xb3d8de, {
    transparent: true,
    opacity: 0.15,
    roughness: 0.15,
    metalness: 0.1,
    depthWrite: false,
  });
  p.light = mat(0xffe9b4, { emissive: 0xffdb92, emissiveIntensity: 0.8 });
  return p;
}
