// Shared renderer for a compiled OpenStreetMap district.
// One metre in the file is one metre in the scene. Estimated heights stay estimates.
import * as THREE from 'three';
import { mat } from '../../core/utils.js';
import { ZoneKit } from '../ZoneKit.js';
import { verifyGeo } from './project.js';
import { indexFootprints } from './footprints.js';
import { aerialBounds, aerialTexture, photoMaterial, worldUvMesh } from './aerial.js';

const CHUNK = 240;

function b64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
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

function pushRibbon(positions, pts, halfW, yLift = 0) {
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
    const a = left[i], b = right[i], c = left[i + 1], d = right[i + 1];
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    positions.push(b[0], b[1], b[2], d[0], d[1], d[2], c[0], c[1], c[2]);
  }
}

function greedyCells(grid, ground, value, y, maxCells = 1e9) {
  const { w, h, minX, minZ, cell } = grid;
  const used = new Uint8Array(ground.length);
  const positions = [];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const id = j * w + i;
      if (used[id] || ground[id] !== value) continue;
      let ww = 1;
      while (i + ww < w && ww < maxCells && !used[id + ww] && ground[id + ww] === value) ww++;
      let hh = 1;
      outer: while (j + hh < h && hh < maxCells) {
        for (let k = 0; k < ww; k++) {
          const id2 = (j + hh) * w + i + k;
          if (used[id2] || ground[id2] !== value) break outer;
        }
        hh++;
      }
      for (let yy = 0; yy < hh; yy++) for (let x = 0; x < ww; x++) used[(j + yy) * w + i + x] = 1;
      const x0 = minX + i * cell, z0 = minZ + j * cell;
      const x1 = x0 + ww * cell, z1 = z0 + hh * cell;
      positions.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z0, x1, y, z1, x0, y, z1);
    }
  }
  return positions;
}

function extrude(wall, roof, ring, y0, y1, color, bounds) {
  const contour = toContour(ring);
  if (contour.length < 3) return;
  let faces = THREE.ShapeUtils.triangulateShape(contour, []);
  if (!faces.length) {
    contour.reverse();
    faces = THREE.ShapeUtils.triangulateShape(contour, []);
  }
  const cr = color.r, cg = color.g, cb = color.b;
  for (const f of faces) {
    for (const idx of f) {
      const v = contour[idx];
      if (bounds) {
        roof.push(
          v.x, y1, v.y,
          (v.x - bounds.minX) / bounds.spanX,
          (bounds.maxZ - v.y) / bounds.spanZ,
          1, 1, 1,
        );
      } else {
        roof.push(v.x, y1, v.y, cr * 0.72, cg * 0.72, cb * 0.72);
      }
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

function facadeMaterial(night) {
  const wall = document.createElement('canvas');
  wall.width = 64; wall.height = 64;
  const g = wall.getContext('2d');
  g.fillStyle = night ? '#1a2030' : '#ffffff';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = night ? '#8fd4ff' : '#c5c8cc';
  for (let y = 8; y < 60; y += 16) {
    for (let x = 6; x < 60; x += 14) {
      if (night && ((x + y) % 28 === 0)) g.fillStyle = '#ff4d8a';
      else g.fillStyle = night ? '#8fd4ff' : '#c5c8cc';
      g.fillRect(x, y, 8, 10);
    }
  }
  const tex = new THREE.CanvasTexture(wall);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const opts = { map: tex, roughness: night ? 0.55 : 0.82, vertexColors: true, side: THREE.DoubleSide };
  if (night) {
    const glow = document.createElement('canvas');
    glow.width = 64; glow.height = 64;
    const e = glow.getContext('2d');
    e.fillStyle = '#000';
    e.fillRect(0, 0, 64, 64);
    for (let y = 8; y < 60; y += 16) {
      for (let x = 6; x < 60; x += 14) {
        e.fillStyle = ((x + y) % 28 === 0) ? '#ff4d8a' : '#d8f4ff';
        e.fillRect(x, y, 8, 10);
      }
    }
    const em = new THREE.CanvasTexture(glow);
    em.wrapS = em.wrapT = THREE.RepeatWrapping;
    em.colorSpace = THREE.SRGBColorSpace;
    opts.emissiveMap = em;
    opts.emissive = new THREE.Color(0xffffff);
    opts.emissiveIntensity = 0.7;
  }
  return new THREE.MeshStandardMaterial(opts);
}

function polylineLength(pts) {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return n;
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

export function mountOsmDistrict(game, zoneName, GEO, opts) {
  const t0 = performance.now();
  const issues = verifyGeo(GEO);
  const tag = opts.log || zoneName;
  if (issues.length) console.warn(`[${tag} geo] ` + issues.join(' | '));
  else console.log(`[${tag} geo] landmark distances match the WGS84 geodesic`);

  const Z = new ZoneKit(game, zoneName, zoneName);
  Z.stepHeight = 0.62;
  const sky = opts.sky;
  const sun = opts.sun || new THREE.Vector3(80, 140, 40);
  Z.sky(sky[0], sky[1], sky[2], sky[3], sky[4], sky[5], sky[6], sky[7], sky[8], sun);
  game.camera.near = opts.near || 0.3;
  game.camera.far = opts.far || 8000;
  game.camera.updateProjectionMatrix();
  if (Z.sun) {
    Z.group.add(Z.sun.target);
    const cam = Z.sun.shadow.camera;
    cam.left = -70; cam.right = 70; cam.top = 70; cam.bottom = -70; cam.far = 280;
    cam.updateProjectionMatrix();
  }
  if (opts.rain) Z.enableRain(opts.rain[0], opts.rain[1], opts.rain[2]);

  const grid = GEO.grid;
  const ground = b64(grid.ground);
  const deck = b64(grid.deck);
  Z.sampleGround = (x, z, feetY) => {
    const ix = Math.floor((x - grid.minX) / grid.cell);
    const iz = Math.floor((z - grid.minZ) / grid.cell);
    if (ix < 0 || iz < 0 || ix >= grid.w || iz >= grid.h) return null;
    const id = iz * grid.w + ix;
    let h = ground[id] === 1 ? grid.waterY : 0;
    const d = deck[id];
    if (d > 0) {
      const dh = d * grid.step;
      if (dh <= feetY + 0.9) h = Math.max(h, dh);
    }
    return h;
  };

  const photoTex = GEO.aerial
    ? aerialTexture(new URL(`./${GEO.aerial.file}`, import.meta.url).href)
    : null;
  const photo = photoTex ? photoMaterial(photoTex) : null;
  const photoBounds = photo ? aerialBounds(grid) : null;

  const tile = photo ? 6 : 1e9;
  const landPos = greedyCells(grid, ground, 0, 0, tile);
  if (photo) Z.group.add(worldUvMesh(landPos, photo, photoBounds));
  else {
    Z.group.add(meshFromPositions(
      landPos,
      mat(opts.land, { roughness: opts.night ? 0.7 : 0.95, metalness: opts.night ? 0.18 : 0, side: THREE.DoubleSide }),
    ));
  }

  let waterOk = 0;
  if (GEO.meta.waterFromGrid) {
    const waterPos = greedyCells(grid, ground, 1, -0.62, tile);
    if (waterPos.length) {
      waterOk = GEO.meta.counts.waterCells;
      const waterMat = photo || mat(opts.water, {
        roughness: 0.16, metalness: 0.4, transparent: true, opacity: 0.94,
        emissive: opts.night ? 0x0a4a78 : 0x083048, emissiveIntensity: opts.night ? 0.85 : 0.35,
        side: THREE.DoubleSide,
      });
      Z.group.add(photo ? worldUvMesh(waterPos, waterMat, photoBounds) : meshFromPositions(waterPos, waterMat));
    }
  } else {
    const waterPos = [];
    for (const w of GEO.water || []) {
      try {
        if (addPolygon(waterPos, w.outer, -0.62, w.holes)) waterOk++;
      } catch (err) {
        console.warn(`[${tag} geo] water polygon failed`, w.osm, err);
      }
    }
    if (waterPos.length) {
      const waterMat = photo || mat(opts.water, {
        roughness: 0.18, metalness: 0.35, transparent: true, opacity: 0.92,
        emissive: 0x083048, emissiveIntensity: 0.35, side: THREE.DoubleSide,
      });
      Z.group.add(photo ? worldUvMesh(waterPos, waterMat, photoBounds) : meshFromPositions(waterPos, waterMat));
    }
  }

  if (!photo) {
    const parkPos = [];
    for (const p of GEO.parks || []) {
      try { addPolygon(parkPos, p.ring, 0.045); } catch (err) { console.warn(`[${tag} geo] park failed`, p.osm, err); }
    }
    if (parkPos.length) Z.group.add(meshFromPositions(parkPos, mat(opts.park, { roughness: 1, side: THREE.DoubleSide })));

    const apronPos = [];
    for (const p of GEO.aprons || []) {
      try { addPolygon(apronPos, p.ring, 0.03); } catch (err) { console.warn(`[${tag} geo] apron failed`, p.osm, err); }
    }
    if (apronPos.length) Z.group.add(meshFromPositions(apronPos, mat(opts.apron || 0x5a6168, { roughness: 0.92, side: THREE.DoubleSide })));
  }

  const curbs = [], asphalt = [], paving = [], paths = [], cycle = [], bus = [], marks = [];
  const runway = [], taxi = [], rail = [];
  const walkPos = new Map();
  const bucket = { 0: asphalt, 1: asphalt, 2: paving, 3: paths, 4: cycle, 5: bus, 6: runway, 7: taxi, 8: rail };
  for (const road of GEO.roads) {
    const pts = roadPoints(road);
    if (road.py) {
      const buf = [];
      pushRibbon(buf, pts, road.w * 0.5, 0.02);
      if (!buf.length) continue;
      const key = `${Math.floor(pts[0][0] / CHUNK)},${Math.floor(pts[0][2] / CHUNK)}`;
      const list = walkPos.get(key) || [];
      list.push(buf);
      walkPos.set(key, list);
      continue;
    }
    if (photo) continue;
    const dest = bucket[road.k] || paths;
    if (road.k <= 1) pushRibbon(curbs, pts, road.w * 0.5 + 0.7, -0.03);
    pushRibbon(dest, pts, road.w * 0.5, 0);
    if (road.k === 0 || road.k === 6) pushRibbon(marks, pts, road.k === 6 ? 0.35 : 0.08, 0.025);
  }
  const side = THREE.DoubleSide;
  const addRoad = (positions, material) => {
    if (!positions.length) return;
    Z.group.add(meshFromPositions(positions, material));
  };
  addRoad(curbs, mat(opts.curb || 0x9a948a, { roughness: 0.95, side }));
  addRoad(asphalt, mat(opts.road, { roughness: opts.night ? 0.45 : 0.92, metalness: opts.night ? 0.35 : 0, side }));
  addRoad(paving, mat(opts.pave, { roughness: 0.8, side }));
  addRoad(paths, mat(opts.path || 0xd2c6b4, { roughness: 0.9, side }));
  addRoad(cycle, mat(0x3f7d62, { roughness: 0.85, side }));
  addRoad(bus, mat(0x6a4038, { roughness: 0.9, side }));
  addRoad(runway, mat(opts.runway || 0x3e444c, { roughness: 0.88, side }));
  addRoad(taxi, mat(opts.taxi || 0x4a5158, { roughness: 0.9, side }));
  addRoad(rail, mat(0x6a5a48, { roughness: 0.7, metalness: 0.3, side }));
  addRoad(marks, mat(opts.night ? 0xffe08a : 0xf4f1e8, { roughness: 0.5, emissive: opts.night ? 0xffc23d : 0x000000, emissiveIntensity: opts.night ? 0.35 : 0, side }));

  const bridgePos = [];
  for (const b of GEO.bridges || []) {
    if (!addPolygon(bridgePos, b.ring, b.y)) continue;
    addPolygon(bridgePos, b.ring, b.y - 0.35);
  }
  const bridgeMat = mat(0x8a9098, { roughness: 0.55, metalness: 0.35, side });
  if (bridgePos.length) walkPos.set('bridges', [bridgePos]);

  const wallChunks = new Map();
  const color = new THREE.Color();
  const nightTint = new THREE.Color(0x121722);
  for (const b of GEO.buildings) {
    if (!b.r || b.r.length < 6) continue;
    let cx = 0, cz = 0, n = 0;
    for (let i = 0; i < b.r.length; i += 2) { cx += b.r[i]; cz += b.r[i + 1]; n++; }
    cx /= n; cz /= n;
    const key = `${Math.floor(cx / CHUNK)},${Math.floor(cz / CHUNK)}`;
    let chunk = wallChunks.get(key);
    if (!chunk) {
      chunk = { wall: [], roof: [] };
      wallChunks.set(key, chunk);
    }
    color.setHex(b.wc != null ? b.wc : b.c);
    if (opts.night && !photo) color.lerp(nightTint, 0.35);
    extrude(chunk.wall, chunk.roof, b.r, b.b || 0, (b.b || 0) + b.h, color, photo ? photoBounds : null);
  }
  const wallMat = photo
    ? new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })
    : facadeMaterial(!!opts.night && !photo);
  const roofMat = photo || new THREE.MeshStandardMaterial({ roughness: 0.9, vertexColors: true, side });
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
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    return mesh;
  }
  for (const chunk of wallChunks.values()) {
    const wall = coloredMesh(chunk.wall, wallMat, true);
    const roof = photo ? coloredMesh(chunk.roof, photo, true, 1) : coloredMesh(chunk.roof, roofMat, false);
    if (wall) Z.group.add(wall);
    if (roof) Z.group.add(roof);
  }

  const feet = indexFootprints(GEO.buildings);
  Z.footBuckets = feet.buckets;
  Z.footCell = feet.cell;

  const walkMeshes = [];
  let bridgeAnchor = null;
  for (const L of Object.values(GEO.landmarks)) {
    if (L.y > 2) { bridgeAnchor = L; break; }
  }
  for (const [key, buffers] of walkPos) {
    const positions = buffers.flat();
    if (!positions.length) continue;
    const mesh = photo
      ? worldUvMesh(positions, photo, photoBounds)
      : meshFromPositions(positions, key === 'bridges' ? bridgeMat : mat(opts.road, { roughness: 0.9, side }));
    mesh.userData.walk = true;
    let sx = 0, sz = 0;
    if (key === 'bridges' && bridgeAnchor) {
      sx = bridgeAnchor.x; sz = bridgeAnchor.z;
    } else if (key !== 'bridges') {
      const [a, b] = key.split(',');
      sx = (+a + 0.5) * CHUNK; sz = (+b + 0.5) * CHUNK;
    }
    Z.group.add(mesh);
    walkMeshes.push({ mesh, x: sx, z: sz });
  }

  const lampSpots = [];
  const cap = opts.lampCap || 420;
  for (const road of GEO.roads) {
    if (road.k !== 0 && road.k !== 2 && road.k !== 7) continue;
    if (road.py) continue;
    const flat = road.p;
    let acc = 20;
    for (let i = 2; i < flat.length; i += 2) {
      acc += Math.hypot(flat[i] - flat[i - 2], flat[i + 1] - flat[i - 1]);
      if (acc >= 38) {
        acc = 0;
        lampSpots.push([flat[i], flat[i + 1]]);
        if (lampSpots.length >= cap) break;
      }
    }
    if (lampSpots.length >= cap) break;
  }
  if (lampSpots.length) {
    const pole = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.07, 0.09, 5.2, 6),
      mat(0x2c3138, { metalness: 0.6, roughness: 0.4 }),
      lampSpots.length,
    );
    const head = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      mat(opts.night ? 0xff4d8a : 0xfff1c4, { emissive: opts.night ? 0xff2e5f : 0xffe2a0, emissiveIntensity: opts.night ? 1.4 : 0.8 }),
      lampSpots.length,
    );
    const dummy = new THREE.Object3D();
    lampSpots.forEach(([x, z], i) => {
      dummy.position.set(x, 2.6, z);
      dummy.updateMatrix();
      pole.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, 5.15, z);
      dummy.updateMatrix();
      head.setMatrixAt(i, dummy.matrix);
    });
    pole.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;
    Z.group.add(pole);
    Z.group.add(head);
  }

  const traffic = [];
  for (let i = 0; i < (GEO.traffic || []).length; i += 2) traffic.push([GEO.traffic[i], GEO.traffic[i + 1]]);
  const trafficLen = polylineLength(traffic);
  if (trafficLen > 40) {
    const colors = opts.night
      ? [0xff2e5f, 0x2ee6ff, 0xffc23d, 0xe8eef4, 0x22262e, 0xd14fd1]
      : [0xd94a3a, 0xf4f1e8, 0x35588a, 0xe0a030, 0x22262e, 0x2f9d62];
    const cars = colors.map((c) => {
      const car = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.15, 4.1), mat(c, { roughness: 0.45, metalness: 0.25 }));
      car.castShadow = true;
      Z.group.add(car);
      return car;
    });
    Z.updaters.push((dt, t) => {
      cars.forEach((car, i) => {
        const at = pointOnPolyline(traffic, (t * (8 + i * 1.4) + i * trafficLen / cars.length) % trafficLen);
        car.position.set(at[0], 0.7, at[1]);
        car.rotation.y = at[2];
      });
    });
  }

  Z._baseGrounds = Z.grounds.slice();
  const seed = (x, z) => walkMeshes.filter((w) => (w.x - x) ** 2 + (w.z - z) ** 2 < 220 * 220).map((w) => w.mesh);
  Z.grounds = Z._baseGrounds.concat(seed(0, 0));
  Z.updaters.push(() => {
    const p = game.trolley.riding ? game.trolley.pos : game.player.pos;
    Z.grounds = Z._baseGrounds.concat(seed(p.x, p.z));
    if (Z.sun) {
      Z.sun.position.set(p.x + 46, 96, p.z + 26);
      Z.sun.target.position.set(p.x, p.y, p.z);
      Z.sun.target.updateMatrixWorld();
    }
  });

  const ms = Math.round(performance.now() - t0);
  console.log(`[${tag} geo] ${GEO.meta.counts.buildings} buildings, ${GEO.meta.counts.roads} roads, water ${waterOk}, footprints ${feet.kept}, ${ms} ms. ${GEO.meta.attribution}`);
  if (opts.toast && game.mode === 'playing') game.toast(opts.toast, opts.toastTone || 'blue');
  return Z;
}
