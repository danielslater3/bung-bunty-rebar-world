// Turns the compiled OpenStreetMap extract into a walkable Three.js district.
// 1 metre of geometry is 1 metre of Brisbane. Heights without an OSM height tag are estimates.
import * as THREE from 'three';
import { mat } from '../../core/utils.js';
import { ZoneKit } from '/src/world/ZoneKit.js';
import { BRISBANE_GEO as SOURCE_GEO } from './brisbane.data.js';
import { verifyGeo } from './project.js';
import { indexFootprints } from '/src/world/geo/footprints.js';
import { GaborChase } from '../../systems/BossEvents.js';
import { bus } from '../../core/state.js';
import { dressBrisbane } from '../rebirthZones.js';
import { aerialBounds, aerialTexture, worldUvMesh } from './aerial.js';
import { createStreetKit, tiledMesh, closestMall, addMallFronts, addDistrictFronts, addMallFurniture, addCityHall, addMallCanopy } from './brisbaneDetail.js';
import { dressCbd, signAnchors } from './cbdFronts.js';
import { dressShops } from './shopSigns.js';
import { RIVER_SURFACE, riverMaterial, attachRiverClock, waterSheet } from './river.js';
import { buildBridges } from './bridges.js';
import { createTerrain, easeKerbs, terrainMeshes, terrainMaterial, parkMask, BANK_Y } from '/src/world/geo/terrain.js';
import { drapeRibbon, ribbon3d, drapePolygon, deckProfile } from '/src/world/geo/drape.js';
import { buildShells, roofCollector } from '/src/world/geo/facades.js';

import { SurfaceIndex } from './surfaces.js';

import { prepareGeography } from './stability.js';
import { pushFootprints } from './footprints.js';
const GEO = prepareGeography(SOURCE_GEO);
const CHUNK = 240;

function b64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function shadeAsGround(mesh) {
  const count = mesh.geometry.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) arr[i * 3 + 1] = 1;
  mesh.geometry.setAttribute('normal', new THREE.BufferAttribute(arr, 3));
}

function meshFromPositions(positions, material) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, material);
  m.receiveShadow = true;
  return m;
}

function signedArea(flat) {
  let s = 0;
  for (let i = 0; i < flat.length; i += 2) {
    const j = (i + 2) % flat.length;
    s += flat[i] * flat[j + 1] - flat[j] * flat[i + 1];
  }
  return s * 0.5;
}

function toContour(flat) {
  const c = [];
  for (let i = 0; i < flat.length; i += 2) c.push(new THREE.Vector2(flat[i], flat[i + 1]));
  if (c.length > 2 && c[0].distanceToSquared(c[c.length - 1]) < 0.05) c.pop();
  return c;
}

function triangulate(flat, holes = []) {
  let contour = toContour(flat);
  if (contour.length < 3) return null;
  if (signedArea(flat) < 0) contour.reverse();
  const holeContours = holes.map((h) => {
    const c = toContour(h);
    if (signedArea(h) > 0) c.reverse();
    return c;
  }).filter((c) => c.length >= 3);
  let faces = THREE.ShapeUtils.triangulateShape(contour, holeContours);
  if (!faces.length) {
    contour.reverse();
    faces = THREE.ShapeUtils.triangulateShape(contour, holeContours);
  }
  if (!faces.length) return null;
  const all = contour.slice();
  for (const h of holeContours) all.push(...h);
  return { contour: all, faces };
}

function addPolygon(positions, flat, y, holes) {
  const tri = triangulate(flat, holes);
  if (!tri) return false;
  for (const f of tri.faces) {
    for (const idx of f) {
      const v = tri.contour[idx];
      positions.push(v.x, y, v.y);
    }
  }
  return true;
}

function roadPoints(road) {
  const p = road.p;
  const pts = [];
  if (road.py) {
    for (let i = 0; i < p.length; i += 3) pts.push([p[i], p[i + 2], p[i + 1]]);
  } else {
    for (let i = 0; i < p.length; i += 2) pts.push([p[i], 0.04, p[i + 1]]);
  }
  return pts;
}

function pushRibbon(positions, pts, halfW, yLift = 0, keepSeg = null) {
  if (pts.length < 2) return;
  const left = [];
  const right = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    let dx = next[0] - prev[0];
    let dz = next[2] - prev[2];
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    const y = pts[i][1] + yLift;
    left.push([pts[i][0] - dz * halfW, y, pts[i][2] + dx * halfW]);
    right.push([pts[i][0] + dz * halfW, y, pts[i][2] - dx * halfW]);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    if (keepSeg && !keepSeg(pts[i], pts[i + 1])) continue;
    const a = left[i], b = right[i], c = left[i + 1], d = right[i + 1];
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    positions.push(b[0], b[1], b[2], d[0], d[1], d[2], c[0], c[1], c[2]);
  }
}

function greedyLand(grid, ground, maxCells = 1e9) {
  const { w, h, minX, minZ, cell } = grid;
  const used = new Uint8Array(ground.length);
  const positions = [];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const id = j * w + i;
      if (used[id] || ground[id] !== 0) continue;
      let ww = 1;
      while (i + ww < w && ww < maxCells && !used[id + ww] && ground[id + ww] === 0) ww++;
      let hh = 1;
      outer: while (j + hh < h && hh < maxCells) {
        for (let k = 0; k < ww; k++) {
          const id2 = (j + hh) * w + i + k;
          if (used[id2] || ground[id2] !== 0) break outer;
        }
        hh++;
      }
      for (let y = 0; y < hh; y++) for (let x = 0; x < ww; x++) used[(j + y) * w + i + x] = 1;
      const x0 = minX + i * cell, z0 = minZ + j * cell;
      const x1 = x0 + ww * cell, z1 = z0 + hh * cell;
      positions.push(x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z0, x1, 0, z1, x0, 0, z1);
    }
  }
  return positions;
}

function extrude(wall, roof, ring, y0, y1, wallColor, roofColor, photo) {
  const contour = toContour(ring);
  if (contour.length < 3) return;
  let faces = THREE.ShapeUtils.triangulateShape(contour, []);
  if (!faces.length) {
    contour.reverse();
    faces = THREE.ShapeUtils.triangulateShape(contour, []);
  }
  const cr = wallColor.r, cg = wallColor.g, cb = wallColor.b;
  const rr = roofColor ? roofColor.r : 0, rg = roofColor ? roofColor.g : 0, rb = roofColor ? roofColor.b : 0;
  for (const f of faces) {
    for (const idx of f) {
      const v = contour[idx];
      if (photo) photo.push(v.x, y1 + 0.05, v.y);
      if (roof && roofColor) roof.push(v.x, y1, v.y, rr, rg, rb);
    }
  }
  const n = contour.length;
  let u = 0;
  for (let i = 0; i < n; i++) {
    const a = contour[i];
    const b = contour[(i + 1) % n];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const u2 = u + len;
    const quad = [
      [a.x, y0, a.y, u, 0], [b.x, y0, b.y, u2, 0], [b.x, y1, b.y, u2, y1 - y0],
      [a.x, y0, a.y, u, 0], [b.x, y1, b.y, u2, y1 - y0], [a.x, y1, a.y, u, y1 - y0],
    ];
    for (const q of quad) wall.push(q[0], q[1], q[2], q[3], q[4], cr, cg, cb);
    u = u2;
  }
}

function along(flat, spacing, fn) {
  const pts = [];
  for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
  if (pts.length < 2) return;
  let acc = spacing * 0.5;
  let n = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dz = pts[i][1] - pts[i - 1][1];
    const seg = Math.hypot(dx, dz);
    if (seg < 0.01) continue;
    while (acc <= seg) {
      const t = acc / seg;
      fn(pts[i - 1][0] + dx * t, pts[i - 1][1] + dz * t, Math.atan2(dx, dz), n++);
      acc += spacing;
    }
    acc -= seg;
  }
}

function pointOnPolyline(pts, dist) {
  let left = dist;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dz = pts[i][1] - pts[i - 1][1];
    const seg = Math.hypot(dx, dz);
    if (left <= seg) {
      const t = seg ? left / seg : 0;
      return [pts[i - 1][0] + dx * t, pts[i - 1][1] + dz * t, Math.atan2(dx, dz)];
    }
    left -= seg;
  }
  const last = pts[pts.length - 1];
  return [last[0], last[1], 0];
}

function polylineLength(pts) {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return n;
}

export function buildOsmBrisbane(game) {
  const t0 = performance.now();
  const issues = verifyGeo(GEO);
  if (issues.length) console.warn('[brisbane geo] ' + issues.join(' | '));
  else console.log('[brisbane geo] landmark distances match the WGS84 geodesic');

  const Z = new ZoneKit(game, 'brisbane', 'brisbane');
  Z.stepHeight = 0.62;
  Z.sky(0x8ec8ee, 0xd5e8f6, 420, 5200, 0xe7f3ff, 0xa08468, 0.82, 0xfff1d2, 1.05, new THREE.Vector3(70, 130, 36));
  game.camera.near = 0.3;
  game.camera.far = 5200;
  game.camera.updateProjectionMatrix();
  if (Z.sun) {
    Z.group.add(Z.sun.target);
    const cam = Z.sun.shadow.camera;
    cam.left = -70; cam.right = 70; cam.top = 70; cam.bottom = -70; cam.far = 280;
    cam.updateProjectionMatrix();
    Z.sun.shadow.bias = -0.00025;
    Z.sun.shadow.normalBias = 0.045;
  }
  const kit = createStreetKit();

  const grid = GEO.grid;
  const ground = b64(grid.ground);
  const surfaces = new SurfaceIndex();
  Z.walkSurfaces = surfaces;
  const T = createTerrain(grid, ground);
  easeKerbs(T, GEO.roads);
  Z.terrain = T;
  Z.sampleGround = (x, z, feetY) => {
    const ix = Math.floor((x - grid.minX) / grid.cell);
    const iz = Math.floor((z - grid.minZ) / grid.cell);
    if (ix < 0 || iz < 0 || ix >= grid.w || iz >= grid.h) return null;
    const id = iz * grid.w + ix;
    let h = T.walkAt(x, z);
    h = Math.max(h, surfaces.heightAt(x, z, feetY));
    return h;
  };
  Z.swimInfo = (x, z, feetY) => {
    const ix = Math.floor((x - grid.minX) / grid.cell);
    const iz = Math.floor((z - grid.minZ) / grid.cell);
    if (ix < 0 || iz < 0 || ix >= grid.w || iz >= grid.h) return null;
    const id = iz * grid.w + ix;
    if (ground[id] !== 1) return null;
    const dh = surfaces.heightAt(x, z, feetY, 1.4);
    if (dh > RIVER_SURFACE + 0.45) return null;
    return { surface: RIVER_SURFACE };
  };
  Z.groundAt = (x, z, refY = 1e6) => Z.sampleGround(x, z, refY) ?? 0;
  Z.slopeAt = (x, z) => {
    const d = 2;
    return Math.hypot(T.heightAt(x + d, z) - T.heightAt(x - d, z), T.heightAt(x, z + d) - T.heightAt(x, z - d)) / (2 * d);
  };

  // The Queensland orthophoto stays on disk as a geographic check. It is not the street
  // and it is not a wall colour. Pedestrian surfaces are meshes.
  const aerialTex = aerialTexture(new URL(`./${GEO.aerial.file}`, import.meta.url).href);
  const terr = terrainMeshes(T, terrainMaterial(T, parkMask(T, GEO.parks), aerialTex));
  Z.group.add(terr.group);
  terr.update(GEO.landmarks.queenMall.x, GEO.landmarks.queenMall.z, Infinity);
  Z.updaters.push(() => {
    const p = game.trolley.riding ? game.trolley.pos : game.player.pos;
    terr.update(p.x, p.z);
  });

  const waterPos = waterSheet(grid, ground, RIVER_SURFACE, 8);
  const waterOk = waterPos.length ? 1 : 0;
  const riverMat = riverMaterial();
  if (waterPos.length) {
    const waterMesh = meshFromPositions(waterPos, riverMat);
    waterMesh.castShadow = false;
    waterMesh.receiveShadow = false;
    waterMesh.renderOrder = 2;
    waterMesh.userData.abs = true;
    Z.group.add(waterMesh);
    attachRiverClock(Z, riverMat);
  }

  const curbs = [], asphalt = [], paving = [], paths = [], cycle = [], bus = [], marks = [];
  const walkPos = new Map();
  const bucket = { 0: asphalt, 1: asphalt, 2: paving, 3: paths, 4: cycle, 5: bus };
  const gH = (x, z) => Math.max(T.heightAt(x, z), BANK_Y);
  for (const road of GEO.roads) {
    if (road.py) {
      const pts = roadPoints(road);
      const buf = [];
      // Keep the complete approach ribbon. Midpoint rejection used to remove
      // whole triangles straddling a bridge outline, leaving holes at abutments.
      ribbon3d(buf, pts, road.w * 0.5, gH, 0.04);
      if (!buf.length) continue;
      const key = `${Math.floor(pts[0][0] / CHUNK)},${Math.floor(pts[0][2] / CHUNK)}`;
      const list = walkPos.get(key) || [];
      list.push(buf);
      walkPos.set(key, list);
      continue;
    }
    const flat2 = [];
    for (let i = 0; i < road.p.length; i += 2) flat2.push([road.p[i], road.p[i + 1]]);
    const dest = bucket[road.k] || paths;
    if (road.k <= 1) drapeRibbon(curbs, flat2, road.w * 0.5 + 0.22, gH, 0.02, 2, 0.9);
    drapeRibbon(dest, flat2, road.w * 0.5, gH, 0.04, road.w >= 7 ? 3 : 2);
    if (road.k === 0) drapeRibbon(marks, flat2, 0.08, gH, 0.06);
  }
  for (const [m, f] of [[kit.curb, -1], [kit.asphalt, -2], [kit.mall, -2], [kit.path, -2], [kit.cycle, -2], [kit.bus, -2], [kit.mark, -4]]) {
    m.polygonOffset = true;
    m.polygonOffsetFactor = f;
    m.polygonOffsetUnits = f;
  }
  const roadMat = kit.asphalt;
  const addRoad = (positions, material, tile) => {
    if (!positions.length) return;
    const m = tile ? tiledMesh(positions, material, tile) : meshFromPositions(positions, material);
    shadeAsGround(m);
    m.userData.abs = true;
    Z.group.add(m);
  };
  addRoad(curbs, kit.curb);
  addRoad(asphalt, roadMat, 4);
  addRoad(paving, kit.mall, 2.6);
  addRoad(paths, kit.path);
  addRoad(cycle, kit.cycle);
  addRoad(bus, kit.bus);
  addRoad(marks, kit.mark);
  // Queen Street Mall pavement fills out to the building edges.
  const mallFill = [];
  const mallPts = [];
  for (let i = 0; i < GEO.mall.length; i += 2) mallPts.push([GEO.mall[i], GEO.mall[i + 1]]);
  drapeRibbon(mallFill, mallPts, 10, gH, 0.05);
  addRoad(mallFill, kit.mall, 2.6);

  const bridgePos = [];
  const whiteBridgePos = [];
  const whiteDecks = new Set(['Neville Bonner Bridge', 'Kurilpa Bridge', 'Goodwill Bridge']);
  for (const b of GEO.bridges) {
    const dest = whiteDecks.has(b.name) ? whiteBridgePos : bridgePos;
    const yOf = deckProfile(b);
    if (!drapePolygon(dest, b.ring, (x, z) => yOf(x, z) + 0.06, 8)) continue;
  }
  const bridgeMat = kit.bridge.clone();
  bridgeMat.side = THREE.DoubleSide;
  bridgeMat.polygonOffset = true;
  bridgeMat.polygonOffsetFactor = 2;
  bridgeMat.polygonOffsetUnits = 2;
  const whiteDeckMat = mat(0xf3f5f7, { roughness: 0.42, metalness: 0.16, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 });
  if (bridgePos.length) walkPos.set('bridges', [bridgePos]);
  if (whiteBridgePos.length) walkPos.set('white-bridges', [whiteBridgePos]);

  const white = new THREE.Color(0xffffff);
  const roofMat = new THREE.MeshStandardMaterial({ map: aerialTex, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  const photoBounds = aerialBounds(GEO.grid);
  const hallL = GEO.landmarks.cityHall;
  let hall = null;
  const roofs = roofCollector();
  const shells = buildShells(GEO.buildings, {
    roofOut: roofs,
    groundAt: (x, z) => T.propAt(x, z),
    nearMall: (x, z) => closestMall(GEO.mall, x, z).d,
    skip: (b, cx, cz) => {
      if (Math.hypot(cx - hallL.cx, cz - hallL.cz) < 15 && b.r.length > 40) {
        if (!hall || b.r.length > hall.ring.length) hall = { ring: b.r, cx, cz };
        return true;
      }
      return false;
    },
  });
  Z.group.add(shells.group);
  // Keep the skyline, but do not submit distant facade batches to the moving
  // 140 m shadow camera. Bounds already exist on the static chunk geometry.
  let shadowTick=0;
  Z.updaters.push(dt => {
    shadowTick-=dt;if(shadowTick>0)return;shadowTick=.35;
    const p=game.trolley.riding?game.trolley.pos:game.player.pos;
    for(const m of shells.group.children){
      if (!m.geometry?.boundingSphere) m.geometry?.computeBoundingSphere();
      const sphere=m.geometry?.boundingSphere;if(!sphere)continue;
      m.castShadow=Math.hypot(sphere.center.x-p.x,sphere.center.z-p.z)<sphere.radius+120;
    }
  });
  Z.blockers = [shells.group];
  const hips = shells.stats.pitched;
  if (roofs.photo.length) {
    const roof = worldUvMesh(roofs.photo, roofMat, photoBounds);
    roof.receiveShadow = true;
    roof.userData.abs = true;
    Z.group.add(roof);
  }
  if (roofs.plain.length) {
    const under = meshFromPositions(roofs.plain, kit.curb);
    under.userData.abs = true;
    Z.group.add(under);
  }

  function coloredMesh(interleaved, material, strideUv, uvDiv = 8) {
    if (!interleaved.length) return null;
    const count = interleaved.length / (strideUv ? 8 : 6);
    const pos = new Float32Array(count * 3);
    const uv = strideUv ? new Float32Array(count * 2) : null;
    const col = new Float32Array(count * 3);
    for (let i = 0, v = 0; v < count; v++) {
      pos[v * 3] = interleaved[i++];
      pos[v * 3 + 1] = interleaved[i++];
      pos[v * 3 + 2] = interleaved[i++];
      if (strideUv) { uv[v * 2] = interleaved[i++] / uvDiv; uv[v * 2 + 1] = interleaved[i++] / uvDiv; }
      col[v * 3] = interleaved[i++];
      col[v * 3 + 1] = interleaved[i++];
      col[v * 3 + 2] = interleaved[i++];
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (uv) geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.abs = true;
    return mesh;
  }

  let hallInfo = null;
  if (hall) {
    const hw = [];
    const hr = [];
    const hallG = T.propAt(hall.cx, hall.cz);
    extrude(hw, hr, hall.ring, hallG - 3, hallG + 22, white, new THREE.Color(0x8d7358));
    const wall = coloredMesh(hw, kit.sandstone, true, 4);
    const roof = coloredMesh(hr, kit.roof, false);
    if (wall) { Z.group.add(wall); Z.blockers.push(wall); }
    if (roof) { Z.group.add(roof); Z.blockers.push(roof); }
    Z.withLift(hallG, () => { hallInfo = addCityHall(Z.group, hall.ring, hall.cx, hall.cz, GEO.buildings, kit); });
  } else {
    console.warn('[brisbane street] City Hall footprint was not matched');
  }
  const mallFronts = addMallFronts(Z.group, GEO.buildings, GEO.mall, hall, kit);
  const streetFronts = shells.stats.awnings;
  const cbd = dressCbd(Z.group, GEO.buildings, GEO.mall, hall);
  const shopSigns = dressShops(Z.group, GEO.buildings, signAnchors());

  const feet = indexFootprints(GEO.buildings);
  Z.footBuckets = feet.buckets;
  Z.footCell = feet.cell;

  const walkMeshes = [];
  for (const [key, buffers] of walkPos) {
    const positions = buffers.flat();
    if (!positions.length) continue;
    const mesh = meshFromPositions(
      positions,
      key === 'white-bridges' ? whiteDeckMat : key === 'bridges' ? bridgeMat : roadMat,
    );
    surfaces.add(positions);
    mesh.geometry.computeBoundingBox();
    mesh.userData.walk = true;
    mesh.userData.abs = true;
    Z.group.add(mesh);
    walkMeshes.push({ mesh, bounds: mesh.geometry.boundingBox });
  }

  // Streetlights at a regular spacing along major and pedestrian centrelines.
  // These are not surveyed pole positions.
  const lampSpots = [];
  for (const road of GEO.roads) {
    if (road.k !== 0 && road.k !== 2) continue;
    if (road.py) continue;
    const flat = road.p;
    let acc = 20;
    for (let i = 2; i < flat.length; i += 2) {
      const seg = Math.hypot(flat[i] - flat[i - 2], flat[i + 1] - flat[i - 1]);
      acc += seg;
      if (acc >= 38) {
        acc = 0;
        // Put lights at the mapped road edge, never on its centreline.
        const dx=flat[i]-flat[i-2], dz=flat[i+1]-flat[i-1], length=Math.hypot(dx,dz)||1;
        const side=road.w*.5+.7;
        const x=flat[i]-dz/length*side,z=flat[i+1]+dx/length*side,p={x,z};
        pushFootprints(p,.45,T.walkAt(x,z),Z);
        if(Math.hypot(p.x-x,p.z-z)<.01)lampSpots.push([x,z]);
        if (lampSpots.length >= 420) break;
      }
    }
    if (lampSpots.length >= 420) break;
  }
  if (lampSpots.length) {
    const pole = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.07, 0.09, 5.2, 6),
      mat(0x2c3138, { metalness: 0.6, roughness: 0.4 }),
      lampSpots.length,
    );
    const head = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      mat(0xfff1c4, { emissive: 0xffe2a0, emissiveIntensity: 0.8 }),
      lampSpots.length,
    );
    const dummy = new THREE.Object3D();
    lampSpots.forEach(([x, z], i) => {
      dummy.position.set(x, 2.6, z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      pole.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, 5.15, z);
      dummy.updateMatrix();
      head.setMatrixAt(i, dummy.matrix);
    });
    pole.castShadow = true;
    pole.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;
    Z.group.add(pole);
    Z.group.add(head);
  }

  const traffic = [];
  for (let i = 0; i < GEO.traffic.length; i += 2) traffic.push([GEO.traffic[i], GEO.traffic[i + 1]]);
  const trafficLen = polylineLength(traffic);
  if (trafficLen > 40) {
    const colors = [0xd94a3a, 0xf4f1e8, 0x35588a, 0xe0a030, 0x22262e, 0x2f9d62];
    const cars = colors.map((c) => {
      const car = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.15, 4.1), mat(c, { roughness: 0.55, metalness: 0.2 }));
      car.castShadow = true;
      car.userData.abs = true;
      Z.group.add(car);
      return car;
    });
    Z.updaters.push((dt, t) => {
      cars.forEach((car, i) => {
        const at = pointOnPolyline(traffic, (t * (8 + i * 1.4) + i * trafficLen / cars.length) % trafficLen);
        car.position.set(at[0], Z.groundAt(at[0], at[1], car.position.y + 0.8) + 0.7, at[1]);
        car.rotation.y = at[2];
      });
    });
  }

  const L = GEO.landmarks;
  const mall = L.queenMall;
  Z.spawn.set(mall.x, 0.5, mall.z);
  Z.spawnYaw = (mall.heading || 0) - Math.PI;
  const probe = { x: Z.spawn.x, z: Z.spawn.z };
  // indexFootprints push is available via the zone once buckets exist.
  // A direct containment nudge happens in the footprint resolver on the first frames.

  const hdg = mall.heading || 0;
  const rx = Math.cos(hdg), rz = -Math.sin(hdg);
  Z.exchangeKiosk(mall.x + rx * 9, 0.02, mall.z + rz * 9, hdg);
  Z.deploymentBoard(mall.x - rx * 9, 0.02, mall.z - rz * 9, hdg + Math.PI);
  Z.npc('ching', mall.x + rx * 6, 0, mall.z + rz * 6 + 4, hdg);
  Z.interact(mall.x + rx * 6, 0, mall.z + rz * 6 + 4, '<b>[E]</b> Talk to Chung', () => {
    bus.emit('qe', { type: 'talk', target: 'ching' });
    game.dialogue.conversation([
      ['ching', 'This is the real Queen Street. The portals are still your fault.'],
      ['bung', 'I can shop and save the rebar supply. I contain multitudes and very little trouser.'],
    ]);
  }, 3.5);
  Z.fuelStation(mall.x - rx * 14, mall.z - rz * 14, hdg);

  const tiers = ['bronze', 'bronze', 'bronze', 'bronze', 'silver', 'bronze', 'bronze', 'silver', 'bronze', 'bronze', 'gold', 'bronze'];
  along(GEO.mall, 36, (x, z, rot, i) => {
    if (i < tiers.length) Z.portal(tiers[i], x, 2.5, z, rot);
  });
  const onDeck = (P) => (P.ya != null ? P.ya - P.y : undefined);
  Z.withLift(onDeck(L.victoriaBridge), () => Z.portal('silver', L.victoriaBridge.x, L.victoriaBridge.y + 2.2, L.victoriaBridge.z, 0.4));
  Z.withLift(onDeck(L.storyBridge), () => Z.portal('gold', L.storyBridge.x, L.storyBridge.y + 2.4, L.storyBridge.z, 0.2));

  along(GEO.mall, 42, (x, z, rot, i) => {
    if (i % 2 === 0) Z.rebar(x + rx * 2, 0, z + rz * 2);
    else Z.coin(x - rx * 2, 0, z - rz * 2);
  });

  Z.spawner('drone', L.botanic.cx, 8, L.botanic.cz, 36, 3);
  Z.spawner('drone', mall.x + 40, 6, mall.z - 20, 22, 2);
  Z.pedestrians(mall.x, mall.z, 8, 28, 8, 11);
  Z.pedestrians(mall.x + Math.sin(hdg) * 70, mall.z + Math.cos(hdg) * 70, 8, 24, 6, 19);

  const chasePts = [];
  for (let i = 0; i < GEO.chase.length; i += 8) {
    chasePts.push(new THREE.Vector3(GEO.chase[i], T.walkAt(GEO.chase[i], GEO.chase[i + 1]) + 0.45, GEO.chase[i + 1]));
  }
  if (chasePts.length >= 3) {
    const chase = new GaborChase(game, chasePts);
    Z.updaters.push((dt) => chase.update(dt));
  }

  const sign = (P, text, y, bg, fg) => {
    Z.textSign(P.x, y, P.z, 0, text, { w: 5.2, h: 0.9, bg, fg, post: true });
  };
  sign(L.cityHall, 'BRISBANE CITY HALL', 3.2, '#f4f1e8', '#1a1d26');
  sign(mall, 'QUEEN STREET MALL', 3.2, '#35c5f0', '#1a1d26');
  sign(L.parliament, 'PARLIAMENT HOUSE', 3.4, '#f7f1e4', '#1a1d26');
  sign(L.southBank, 'SOUTH BANK PARKLANDS', 3.2, '#43d96b', '#1a1d26');
  if (L.daviesPark) {
    sign(L.daviesPark, 'DAVIES PARK · WEST END', 3.2, '#43d96b', '#1a1d26');
    Z.pedestrians(L.daviesPark.x, L.daviesPark.z, 6, 24, 5, 31);
    Z.rebar(L.daviesPark.x + 8, 0, L.daviesPark.z + 4);
  }
  if (L.raymondPark) {
    sign(L.raymondPark, 'RAYMOND PARK · KANGAROO POINT', 3.2, '#43d96b', '#1a1d26');
    Z.pedestrians(L.raymondPark.x, L.raymondPark.z, 5, 18, 4, 37);
  }
  if (L.kangarooBridge) {
    Z.withLift(L.kangarooBridge.ya, () => Z.textSign(L.kangarooBridge.x + 12, 3.6, L.kangarooBridge.z, 0.4, 'KANGAROO POINT BRIDGE', { w: 6.2, h: 0.9, bg: '#1a1d26', fg: '#ffc23d', post: true }));
  }
  Z.withLift(L.storyBridge.ya, () => Z.textSign(L.storyBridge.x + 16, 4.2, L.storyBridge.z + 6, 0.3, 'STORY BRIDGE', { w: 5.4, h: 0.9, bg: '#1a1d26', fg: '#ffc23d', post: true }));
  Z.withLift(L.victoriaBridge.ya, () => Z.textSign(L.victoriaBridge.x + 14, 3.6, L.victoriaBridge.z, 0.6, 'VICTORIA BRIDGE', { w: 5.4, h: 0.9, bg: '#1a1d26', fg: '#f4f1e8', post: true }));

  Z.interact(L.cityHall.x, 0.4, L.cityHall.z, '<b>[E]</b> Read the City Hall survey post', () => {
    const rows = GEO.checks.filter((c) => c.a === 'cityHall').slice(0, 4)
      .map((c) => `${c.b}: ${c.enu.toFixed(1)} m in this world, ${c.vincenty.toFixed(1)} m on the ellipsoid`);
    game.dialogue.conversation([
      ['ching', `OpenStreetMap, metre for metre. ${rows[0]}. ${rows[1]}.`],
      ['ching', `${rows[2]}. ${rows[3]}. Ground is the 2019 Queensland LiDAR survey. River spans use the published clearances.`],
      ['bung', 'So the river is real and the lawsuit is still personal. Perfect.'],
    ]);
  }, 4);

  dressBrisbane(Z, game, {
    mall, rx, rz,
    parliament: L.parliament,
    story: L.storyBridge,
    south: L.southBank,
    wheel: L.wheelOffice || L.southBank,
    botanic: L.botanic,
  });

  Z._baseGrounds = Z.grounds.slice();
  const seed = (x, z) => walkMeshes.filter(({ bounds: b }) => x >= b.min.x - 12 && x <= b.max.x + 12 && z >= b.min.z - 12 && z <= b.max.z + 12).map((w) => w.mesh);
  Z.grounds = Z._baseGrounds.concat(seed(Z.spawn.x, Z.spawn.z));
  Z.updaters.push(() => {
    const p = game.trolley.riding ? game.trolley.pos : game.player.pos;
    const nearTerrain = [];
    for (const m of terr.group.children) {
      if (!m.visible || !m.geometry?.boundingSphere) continue;
      const c = m.geometry.boundingSphere.center;
      if ((c.x - p.x) ** 2 + (c.z - p.z) ** 2 < 280 * 280) nearTerrain.push(m);
    }
    Z.grounds = Z._baseGrounds.concat(seed(p.x, p.z), nearTerrain);
    if (Z.sun) {
      Z.sun.position.set(p.x + 46, 96, p.z + 26);
      Z.sun.target.position.set(p.x, p.y, p.z);
      Z.sun.target.updateMatrixWorld();
    }
  });

  game.geoBrisbane = GEO;
  const ms = Math.round(performance.now() - t0);
  console.log(`[brisbane geo] ${GEO.meta.counts.buildings} buildings, ${GEO.meta.counts.roads} roads, ${waterOk} water polygons, ${feet.kept} footprint colliders, terrain chunks ${terr.chunks}, ${ms} ms. ${GEO.meta.attribution}`);
  const furniture = addMallFurniture(Z.group, GEO.mall, GEO.buildings, Z.spawn, kit);
  const canopies = addMallCanopy(Z.group, GEO.mall, GEO.buildings);
  Z.liftFlat((x, z) => T.propAt(x, z));
  Z.spawn.y = T.walkAt(Z.spawn.x, Z.spawn.z) + 0.5;
  const bridgeGroup = new THREE.Group();
  bridgeGroup.userData.abs = true;
  Z.group.add(bridgeGroup);
  const bridgeInfo = buildBridges(bridgeGroup, GEO, T);
  console.log(`[brisbane street] City Hall body ${hallInfo ? hallInfo.body : 'missing'} m estimated, tower ${hallInfo ? hallInfo.tower : 'missing'} m (Brisbane City Council). Mall shopfronts ${mallFronts}. Street shopfronts ${streetFronts}. Shop signs ${shopSigns}. Hipped roofs ${hips}. Named signs ${cbd.signs}. Verandahs ${cbd.verandahs}. Planters ${furniture}. Canopy bays ${canopies}. Bridge structures ${bridgeInfo.named}, raised roads dressed ${bridgeInfo.raised}.`);
  if (game.mode === 'playing') game.toast('BRISBANE · QUEEN STREET MALL · CITY HALL · © OSM · 1 m = 1 m', 'blue');
  return Z;
}

