// Hand-built facade detail over the existing mapped outlines, no new map data.
import * as THREE from 'three';
import { mat } from '../../core/utils.js';
import {
  venueBuilding,
  HOTEL_ENTRY,
  COURT_ENTRY,
} from '../../story/venueData.js';

export function buildVenueExteriors(Z, geo) {
  const result = {};
  const glass = mat(0x6094ad, {
    metalness: 0.08,
    roughness: 0.55,
    emissive: 0x153142,
    emissiveIntensity: 0.3,
  });
  const stone = mat(0xe2ddd3, { roughness: 0.78 });
  const gold = mat(0xf7d59e, { emissive: 0xdca74b, emissiveIntensity: 0.38 });
  const dark = mat(0x253541, { roughness: 0.75 });
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const round = new THREE.CylinderGeometry(1, 1, 1, 12),
    entranceGlass = mat(0x8cc5d6, {
      transparent: true,
      opacity: 0.45,
      roughness: 0.25,
    });
  Z.cleanups.push(() => {
    for (const v of Object.values(result))
      v.root.traverse((o) => {
        if (Array.isArray(o.material))
          for (const m of new Set(o.material)) {
            m.map?.dispose?.();
            m.dispose();
          }
      });
    round.dispose();
    entranceGlass.dispose();
    unit.dispose();
    for (const m of [glass, stone, gold, dark]) m.dispose();
  });
  for (const b of geo.buildings) {
    const kind = venueBuilding(b);
    if (!kind) continue;
    const root = new THREE.Group();
    root.name =
      kind === 'hotel'
        ? 'W Brisbane · mapped Brisbane Quarter'
        : '363 George Street · Magistrates Court';
    root.userData.abs = true;
    Z.group.add(root);
    const box = (x, y, z, w, h, d, m) => {
      const o = new THREE.Mesh(unit, m);
      o.position.set(x, y + h / 2, z);
      o.scale.set(w, h, d);
      root.add(o);
      return o;
    };
    const shape = new THREE.Shape();
    for (let i = 0; i < b.r.length; i += 2) {
      if (i) shape.lineTo(b.r[i], -b.r[i + 1]);
      else shape.moveTo(b.r[i], -b.r[i + 1]);
    }
    shape.closePath();
    const geoShape = new THREE.ExtrudeGeometry(shape, {
      depth: b.h,
      bevelEnabled: false,
    });
    geoShape.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geoShape, glass);
    mesh.position.y = b.g;
    root.add(mesh);
    if (kind === 'hotel') {
      // 35 horizontal storeys, pale river-side blades, scalloped glass bays.
      // The mapped long river wing runs NW–SE, not along the world axes.
      const ux = 0.655,
        uz = 0.756,
        vx = 0.756,
        vz = -0.655;
      const at = (u, v, y, w, h, d, m) => {
        const o = box(
          -136 + u * ux + v * vx,
          y,
          217 + u * uz + v * vz,
          w,
          h,
          d,
          m,
        );
        o.rotation.y = -Math.atan2(uz, ux);
        return o;
      };
      for (let f = 0; f < 35; f++)
        at(31, -1.15, b.g + (f * b.h) / 35, 68, 0.12, 0.22, gold);
      for (const u of [0, 65]) at(u, 0, b.g, 3.8, b.h, 1.4, stone);
      for (let i = 0; i < 10; i++) {
        const u = i * 6.2 + 4;
        at(
          u,
          -0.4 - Math.sin(i * 0.8) * 0.55,
          b.g + 16,
          1.25,
          b.h - 19,
          1.5,
          glass,
        );
        for (let f = 5; f < 33; f += 2)
          if ((f + i) % 3)
            at(u, -1.3, b.g + (f * b.h) / 35, 2.6, 2, 0.13, gold);
      }
      for (let i = 0; i < 10; i++) {
        const u = i * 6.2 + 4,
          v = -0.6 - Math.sin(i * 0.8) * 0.5;
        const o = new THREE.Mesh(round, glass);
        o.position.set(
          -136 + u * 0.655 + v * 0.756,
          b.g + 16 + (b.h - 19) / 2,
          217 + u * 0.756 - v * 0.655,
        );
        o.scale.set(1.25, b.h - 19, 1.25);
        root.add(o);
      }
      at(31, -1, b.g + 13, 69, 1, 2.2, stone);
      const p = HOTEL_ENTRY,
        y = Z.terrain.walkAt(p.x, p.z);
      box(p.x, y + 4, p.z, 9, 0.35, 5, stone); // covered arrival
      const arrivalDoors = [-0.8, 0.8].map((dx) => {
        const o = box(p.x + dx, y, p.z + 1, 1.55, 2.9, 0.12, entranceGlass);
        o.userData.dynamic = true;
        o.userData.homeX = o.position.x;
        return o;
      });
      let open = 0;
      Z.updaters.push((dt) => {
        const player = Z.game.player.pos,
          want = Math.hypot(player.x - p.x, player.z - p.z) < 5 ? 1 : 0;
        open += (want - open) * (1 - Math.exp(-7 * dt));
        arrivalDoors.forEach(
          (o, i) =>
            (o.position.x = o.userData.homeX + (i ? 1 : -1) * open * 1.4),
        );
      });
      for (const dx of [-3.8, 3.8])
        box(p.x + dx, y, p.z + 1, 0.25, 4, 0.25, gold);
      for (let i = 0; i < 6; i++)
        box(p.x - 4 + i * 1.6, y, p.z - 2, 0.14, 0.85, 0.14, dark);
      root.add(
        Z.textSign(p.x, y + 3.1, p.z - 1.8, 0, 'W BRISBANE\n81 NORTH QUAY', {
          w: 5,
          h: 1.1,
          bg: '#222c42',
          fg: '#ffe6c0',
        }),
      );
      root.add(
        Z.textSign(-135.4, b.g + b.h - 8, 220.4, -0.857, 'W', {
          w: 4,
          h: 4,
          bg: '#263f55',
          fg: '#fff2d8',
        }),
      );
    } else {
      for (let i = 0; i < 9; i++)
        box(-142, b.g, -121 + i * 5, 0.4, b.h, 1.1, stone);
      root.add(
        Z.textSign(
          COURT_ENTRY.x,
          b.g + 3,
          COURT_ENTRY.z,
          Math.PI / 2,
          '363 GEORGE STREET\nMAGISTRATES COURT',
          { w: 5, h: 1.2, bg: '#263541', fg: '#fff3d4' },
        ),
      );
    }
    // Facade ribs/windows are static: instance each shared material, avoiding
    // a draw call for every storey and window.
    const batches = new Map();
    for (const o of [...root.children])
      if (
        (o.geometry === unit || o.geometry === round) &&
        !o.userData.dynamic
      ) {
        const key = o.geometry === round ? 'round' : 'box';
        let by = batches.get(o.material);
        if (!by) batches.set(o.material, (by = new Map()));
        let list = by.get(key);
        if (!list) by.set(key, (list = []));
        list.push(o);
      }
    for (const [material, by] of batches)
      for (const [key, list] of by) {
        const batch = new THREE.InstancedMesh(
          key === 'round' ? round : unit,
          material,
          list.length,
        );
        list.forEach((o, i) => {
          o.updateMatrix();
          batch.setMatrixAt(i, o.matrix);
          root.remove(o);
        });
        batch.instanceMatrix.needsUpdate = true;
        root.add(batch);
      }
    result[kind] = {
      root,
      building: b,
      entry: kind === 'hotel' ? HOTEL_ENTRY : COURT_ENTRY,
    };
  }
  return result;
}
