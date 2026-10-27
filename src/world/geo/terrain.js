// Ground from the Queensland Government LiDAR DEM (Elevation/QldDem, Brisbane 2019
// survey, CC BY-SA 4.0). tools/enrich_brisbane.py samples it onto the corners of the
// 4 m walk grid in metres AHD, clamps the river banks and fills deep construction pits.
// Each cell is split on the gentler diagonal, and heightAt() uses that same split.
import * as THREE from 'three';
import { RIVER_SURFACE } from './river.js';

export const BANK_Y = RIVER_SURFACE + 0.12;

export function createTerrain(grid, ground) {
  const [nw, nh] = grid.terrainNodes;
  const scale = grid.terrainScale || 0.01;
  const bin = atob(grid.terrain);
  const h = new Float32Array(nw * nh);
  for (let i = 0; i < h.length; i++) {
    let v = bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8);
    if (v >= 0x8000) v -= 0x10000;
    h[i] = v * scale;
  }
  const { minX, minZ, cell, w, h: gh } = grid;
  const spanX = w * cell, spanZ = gh * cell;

  function heightAt(x, z) {
    let fx = (x - minX) / cell, fz = (z - minZ) / cell;
    if (fx < 0) fx = 0; else if (fx > w) fx = w;
    if (fz < 0) fz = 0; else if (fz > gh) fz = gh;
    let i = Math.floor(fx), j = Math.floor(fz);
    if (i > w - 1) i = w - 1;
    if (j > gh - 1) j = gh - 1;
    const u = fx - i, v = fz - j;
    const k = j * nw + i;
    const h00 = h[k], h10 = h[k + 1], h01 = h[k + nw], h11 = h[k + nw + 1];
    return cornerHeight(h00, h10, h01, h11, u, v);
  }
  function isWater(x, z) {
    const i = Math.floor((x - minX) / cell), j = Math.floor((z - minZ) / cell);
    if (i < 0 || j < 0 || i >= w || j >= gh) return false;
    return ground[j * w + i] === 1;
  }
  // Feet: the river surface on water, otherwise the bank-clamped ground.
  const walkAt = (x, z) => (isWater(x, z) ? RIVER_SURFACE : Math.max(heightAt(x, z), BANK_Y));
  // Lift for things placed on the old flat sheet, where land was y = 0 and water kept its own y.
  const propAt = (x, z) => (isWater(x, z) ? 0 : Math.max(heightAt(x, z), BANK_Y));
  return { h, nw, nh, minX, minZ, cell, w, gh, spanX, spanZ, ground, heightAt, isWater, walkAt, propAt };
}

// Pick the diagonal that climbs less, so a steep kerb becomes two milder faces
// instead of one triangle slashed across the road. heightAt uses the same split.
function cornerHeight(h00, h10, h01, h11, u, v) {
  if (Math.abs(h10 - h01) <= Math.abs(h00 - h11)) {
    if (u + v <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
    return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  }
  if (u >= v) return h00 + (h10 - h00) * u + (h11 - h10) * v;
  return h00 + (h01 - h00) * v + (h11 - h01) * u;
}

// A 2–5 m step between one kerb node and the next becomes a shard that cuts
// through the asphalt. Lift just that low node. River cliffs are steeper than
// this and are left as surveyed.
export function easeKerbs(T, roads) {
  const { h, nw, nh, minX, minZ, cell } = T;
  const on = new Uint8Array(nw * nh);
  const stamp = (x0, z0, x1, z1, half) => {
    const dx = x1 - x0, dz = z1 - z0, l2 = dx * dx + dz * dz || 1;
    const pad = half + cell;
    const i0 = Math.max(0, Math.floor((Math.min(x0, x1) - pad - minX) / cell));
    const i1 = Math.min(nw - 1, Math.floor((Math.max(x0, x1) + pad - minX) / cell));
    const j0 = Math.max(0, Math.floor((Math.min(z0, z1) - pad - minZ) / cell));
    const j1 = Math.min(nh - 1, Math.floor((Math.max(z0, z1) + pad - minZ) / cell));
    const r2 = half * half;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const px = minX + i * cell - x0, pz = minZ + j * cell - z0;
        let t = (px * dx + pz * dz) / l2;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        const ex = px - dx * t, ez = pz - dz * t;
        if (ex * ex + ez * ez <= r2) on[j * nw + i] = 1;
      }
    }
  };
  for (const road of roads || []) {
    if (road.py || !road.p) continue;
    const half = road.w * 0.5 + 1.5;
    const p = road.p;
    for (let i = 2; i < p.length; i += 2) stamp(p[i - 2], p[i - 1], p[i], p[i + 1], half);
  }
  const next = h.slice();
  for (let j = 1; j < nh - 1; j++) {
    for (let i = 1; i < nw - 1; i++) {
      const k = j * nw + i;
      if (h[k] < 1.2) continue;
      let hi = h[k], road = false;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const m = (j + dj) * nw + (i + di);
          if (on[m] && h[m] > hi) { hi = h[m]; road = true; }
        }
      }
      if (!road) continue;
      const drop = hi - h[k];
      if (drop < 1.8 || drop > 4.8) continue;
      const y = hi - 0.85;
      if (y > next[k]) next[k] = y;
    }
  }
  h.set(next);
}

// Grass where the park polygons are, so lawns read as lawns even under tree shade in the photo.
export function parkMask(T, parks, metresPerPixel = 2) {
  const cw = Math.ceil(T.spanX / metresPerPixel);
  const ch = Math.ceil(T.spanZ / metresPerPixel);
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const g = canvas.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, cw, ch);
  g.fillStyle = '#fff';
  for (const p of parks || []) {
    const r = p.ring;
    if (!r || r.length < 6) continue;
    g.beginPath();
    for (let i = 0; i < r.length; i += 2) {
      const px = (r[i] - T.minX) / metresPerPixel;
      const pz = (r[i + 1] - T.minZ) / metresPerPixel;
      if (i === 0) g.moveTo(px, pz); else g.lineTo(px, pz);
    }
    g.closePath();
    g.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

function noiseTex(size, base, specks, n, seed) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    g.fillStyle = specks[i % specks.length];
    const w = 1 + rnd() * 3, hh = 1 + rnd() * 3;
    g.fillRect(rnd() * size, rnd() * size, w, hh);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// Ground colour: lawn where the orthophoto is green or a park polygon covers it, paving
// elsewhere, with the photo's brightness kept so car parks and bare ground differ.
// Rock on slopes steeper than about 50 degrees (the Kangaroo Point cliffs, cuttings),
// mud on the bank below 0.7 m AHD. The photo is never the wall colour.
export function terrainMaterial(T, mask, aerial) {
  const grass = noiseTex(128, '#5f7f41', ['#557539', '#6b8b4a', '#4d6b34', '#789652', '#5a7a3c'], 2600, 7);
  const paved = noiseTex(128, '#a7a39b', ['#9b978f', '#b2aea6', '#959189', '#aca89f', '#8f8b83'], 1800, 11);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uGrass = { value: grass };
    shader.uniforms.uPaved = { value: paved };
    shader.uniforms.uMask = { value: mask };
    shader.uniforms.uAerial = { value: aerial };
    shader.uniforms.uBox = { value: new THREE.Vector4(T.minX, T.minZ, 1 / T.spanX, 1 / T.spanZ) };
    shader.uniforms.uRock = { value: new THREE.Color(0x8c7d6e) };
    shader.uniforms.uMud = { value: new THREE.Color(0x6a5c4b) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTerrW;\nvarying float vTerrUp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTerrW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvTerrUp = normalize(mat3(modelMatrix) * objectNormal).y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D uGrass;
uniform sampler2D uPaved;
uniform sampler2D uMask;
uniform sampler2D uAerial;
uniform vec4 uBox;
uniform vec3 uRock;
uniform vec3 uMud;
varying vec3 vTerrW;
varying float vTerrUp;`)
      .replace('#include <map_fragment>', `
vec2 tw = vTerrW.xz;
vec2 boxUv = (tw - uBox.xy) * uBox.zw;
vec3 aer = texture2D(uAerial, vec2(boxUv.x, 1.0 - boxUv.y), 1.5).rgb;
float aSum = aer.r + aer.g + aer.b + 0.002;
float greenness = aer.g / aSum;
float veg = smoothstep(0.37, 0.43, greenness) * smoothstep(0.004, 0.02, aer.g - max(aer.r, aer.b));
float park = texture2D(uMask, boxUv).r;
veg = max(veg, park * 0.92);
float lum = dot(aer, vec3(0.2126, 0.7152, 0.0722));
vec3 pav = texture2D(uPaved, tw / 7.0).rgb * clamp(0.62 + lum * 2.4, 0.55, 1.18);
vec3 grs = texture2D(uGrass, tw / 5.0).rgb * clamp(0.78 + lum * 1.6, 0.7, 1.15);
vec3 tc = mix(pav, grs, veg);
float slope = 1.0 - clamp(vTerrUp, 0.0, 1.0);
float rock = smoothstep(0.30, 0.50, slope);
tc = mix(tc, uRock * (0.8 + 0.4 * texture2D(uPaved, tw / 3.0).r), rock);
float mud = 1.0 - smoothstep(-0.3, 0.7, vTerrW.y);
tc = mix(tc, uMud, mud * 0.85);
diffuseColor.rgb *= tc;
`);
  };
  mat.customProgramCacheKey = () => 'bne-terrain-1';
  return mat;
}

// Chunked ground mesh. Each chunk has four detail steps (4, 8, 16, 32 m). Coarse
// steps take the lowest height within one step of each corner, so a far hill never
// rises over a road or a building base drawn on the fine surface. Skirts hide the
// seams between chunks at different steps. Open river away from the banks is skipped:
// the water sheet is opaque.
export function terrainMeshes(T, material, opts = {}) {
  const CH = opts.chunk || 64;
  const LEVELS = [1, 2, 4, 8];
  const RANGES = opts.ranges || [320, 820, 1700];
  const { w, gh, nw, h, cell, minX, minZ, ground } = T;
  const need = new Uint8Array(w * gh);
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < w; i++) {
      if (ground[j * w + i] === 1) continue;
      for (let dj = -2; dj <= 2; dj++) {
        const jj = j + dj;
        if (jj < 0 || jj >= gh) continue;
        for (let di = -2; di <= 2; di++) {
          const ii = i + di;
          if (ii >= 0 && ii < w) need[jj * w + ii] = 1;
        }
      }
    }
  }
  const group = new THREE.Group();
  group.userData.abs = true;
  const chunks = [];
  for (let cj = 0; cj < gh; cj += CH) {
    for (let ci = 0; ci < w; ci += CH) {
      const cw = Math.min(CH, w - ci), chh = Math.min(CH, gh - cj);
      let any = false;
      for (let j = cj; j < cj + chh && !any; j++) {
        for (let i = ci; i < ci + cw; i++) if (need[j * w + i]) { any = true; break; }
      }
      if (!any) continue;
      chunks.push({
        ci, cj, cw, chh,
        x0: minX + ci * cell, z0: minZ + cj * cell,
        x1: minX + (ci + cw) * cell, z1: minZ + (cj + chh) * cell,
        meshes: [], level: -1,
      });
    }
  }

  const nodeH = (i, j) => h[j * nw + i];
  function lowH(i, j, s) {
    if (s === 1) return nodeH(i, j);
    let m = Infinity;
    const i0 = Math.max(0, i - s), i1 = Math.min(w, i + s);
    const j0 = Math.max(0, j - s), j1 = Math.min(gh, j + s);
    for (let jj = j0; jj <= j1; jj++) {
      for (let ii = i0; ii <= i1; ii++) {
        const v = nodeH(ii, jj);
        if (v < m) m = v;
      }
    }
    return m;
  }

  function build(chunk, level) {
    const s = LEVELS[level];
    const na = Math.ceil(chunk.cw / s) + 1;
    const nb = Math.ceil(chunk.chh / s) + 1;
    const nodeI = (a) => chunk.ci + Math.min(a * s, chunk.cw);
    const nodeJ = (b) => chunk.cj + Math.min(b * s, chunk.chh);
    const ys = new Float32Array(na * nb);
    for (let b = 0; b < nb; b++) for (let a = 0; a < na; a++) ys[b * na + a] = lowH(nodeI(a), nodeJ(b), s);
    const cellOn = (a, b) => {
      const i0 = nodeI(a), i1 = nodeI(a + 1), j0 = nodeJ(b), j1 = nodeJ(b + 1);
      for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) if (need[j * w + i]) return true;
      return false;
    };
    const pos = [];
    const nor = [];
    const idx = [];
    for (let b = 0; b < nb; b++) {
      for (let a = 0; a < na; a++) {
        const i = nodeI(a), j = nodeJ(b);
        pos.push(minX + i * cell, ys[b * na + a], minZ + j * cell);
        const il = Math.max(0, i - s), ir = Math.min(w, i + s);
        const jl = Math.max(0, j - s), jr = Math.min(gh, j + s);
        const dx = (nodeH(ir, j) - nodeH(il, j)) / ((ir - il) * cell);
        const dz = (nodeH(i, jr) - nodeH(i, jl)) / ((jr - jl) * cell);
        const inv = 1 / Math.hypot(dx, 1, dz);
        nor.push(-dx * inv, inv, -dz * inv);
      }
    }
    const on = new Uint8Array((na - 1) * (nb - 1));
    for (let b = 0; b < nb - 1; b++) {
      for (let a = 0; a < na - 1; a++) {
        if (!cellOn(a, b)) continue;
        on[b * (na - 1) + a] = 1;
        const k00 = b * na + a, k10 = k00 + 1, k01 = k00 + na, k11 = k01 + 1;
        const y00 = ys[k00], y10 = ys[k10], y01 = ys[k01], y11 = ys[k11];
        if (Math.abs(y10 - y01) <= Math.abs(y00 - y11)) idx.push(k00, k01, k10, k10, k01, k11);
        else idx.push(k00, k01, k11, k00, k11, k10);
      }
    }
    if (!idx.length) return null;
    // Skirts along the chunk border, hanging below the coarsest neighbour.
    const drop = 2 + s * 1.5;
    const skirt = (ka, kb) => {
      const base = pos.length / 3;
      for (const k of [ka, kb]) {
        pos.push(pos[k * 3], pos[k * 3 + 1] - drop, pos[k * 3 + 2]);
        nor.push(nor[k * 3], nor[k * 3 + 1], nor[k * 3 + 2]);
      }
      idx.push(ka, base, kb, kb, base, base + 1);
      idx.push(ka, kb, base, kb, base + 1, base);
    };
    for (let a = 0; a < na - 1; a++) {
      if (on[a]) skirt(a, a + 1);
      const bl = nb - 2;
      if (on[bl * (na - 1) + a]) skirt((nb - 1) * na + a, (nb - 1) * na + a + 1);
    }
    for (let b = 0; b < nb - 1; b++) {
      if (on[b * (na - 1)]) skirt(b * na, (b + 1) * na);
      if (on[b * (na - 1) + na - 2]) skirt(b * na + na - 1, (b + 1) * na + na - 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.userData.abs = true;
    return mesh;
  }

  const levelFor = (chunk, x, z) => {
    const dx = Math.max(chunk.x0 - x, 0, x - chunk.x1);
    const dz = Math.max(chunk.z0 - z, 0, z - chunk.z1);
    const d = Math.hypot(dx, dz);
    for (let l = 0; l < RANGES.length; l++) if (d < RANGES[l]) return l;
    return LEVELS.length - 1;
  };
  function show(chunk, level) {
    if (chunk.level === level) return;
    if (chunk.meshes[level] === undefined) {
      chunk.meshes[level] = build(chunk, level);
      if (chunk.meshes[level]) group.add(chunk.meshes[level]);
    }
    chunk.meshes.forEach((m, l) => { if (m) m.visible = l === level; });
    // Full detail is only kept near the player.
    if (chunk.level === 0 && level >= 2 && chunk.meshes[0]) {
      group.remove(chunk.meshes[0]);
      chunk.meshes[0].geometry.dispose();
      chunk.meshes[0] = undefined;
    }
    chunk.level = level;
  }
  // budget: chunk builds allowed per call (Infinity on the first call)
  function update(x, z, budget = 3) {
    const todo = [];
    for (const c of chunks) {
      const l = levelFor(c, x, z);
      if (l !== c.level) todo.push([c, l, l < c.level || c.level < 0 ? 0 : 1]);
    }
    todo.sort((p, q) => p[1] - q[1] || p[2] - q[2]);
    let built = 0;
    for (const [c, l] of todo) {
      const fresh = c.meshes[l] === undefined;
      if (fresh && built >= budget) continue;
      show(c, l);
      if (fresh) built++;
    }
  }
  return { group, update, chunks: chunks.length };
}
