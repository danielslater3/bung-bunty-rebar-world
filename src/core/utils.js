// Shared math/material helpers for Bung Bunty: Rebar World.
import * as THREE from 'three';

export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }

// Shortest-path angle lerp so Bung doesn't spin the long way around.
export function dampAngle(a, b, lambda, dt) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * (1 - Math.exp(-lambda * dt));
}

// Deterministic RNG for zone layouts (mulberry32).
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.8,
    metalness: opts.metalness ?? 0.1,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    flatShading: opts.flat ?? false,
    side: opts.side ?? THREE.FrontSide,
  });
  matCache.set(key, m);
  return m;
}

// Textured material (not cached by mat() since textures aren't stringifiable).
const texMatCache = new Map();
export function texMat(key, map, opts = {}) {
  if (texMatCache.has(key)) return texMatCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    map,
    roughness: opts.roughness ?? 0.8,
    metalness: opts.metalness ?? 0.1,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    emissiveMap: opts.emissiveMap ?? null,
    color: opts.color ?? 0xffffff,
  });
  texMatCache.set(key, m);
  return m;
}

// Premium gold: high metalness, tight roughness, warm emissive undertone —
// the trolley should read as iconic from any distance and lighting.
export function goldMat() { return mat(0xffc94d, { metalness: 0.98, roughness: 0.22, emissive: 0x5a3c08, emissiveIntensity: 1.2 }); }
export function rebarMat() { return mat(0xb35c2a, { metalness: 0.7, roughness: 0.45, emissive: 0x301505 }); }

export function box(w, h, d, material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}
export function sphere(r, material, ws = 14, hs = 10) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), material);
}
export function cyl(rt, rb, h, material, seg = 12) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
}

// Returns a yaw-facing quaternion helper.
export function yawQuat(ry) {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0));
}

export function pick(rand, arr) { return arr[Math.floor(rand() * arr.length)]; }

// ============================================================
// 3.0 CARTOON OUTLINES — inverted hull technique.
// For each mesh in the group, add a slightly inflated back-face black shell.
// Cheap, no postprocessing, and reads perfectly at the game's camera distance.
// Apply ONLY to hero objects (characters, trolley, collectibles) — not whole
// zones — to keep draw calls sane.
// ============================================================
const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: 0x101018, side: THREE.BackSide });
export function addOutline(group, thickness = 0.045) {
  const shells = [];
  group.traverse((o) => {
    if (o.isMesh && !o.userData.isOutline && !o.material?.transparent) shells.push(o);
  });
  for (const m of shells) {
    const shell = new THREE.Mesh(m.geometry, OUTLINE_MAT);
    shell.userData.isOutline = true;
    // Inflate relative to the mesh's own scale so small parts get thin lines
    const s = 1 + thickness;
    shell.scale.setScalar(s);
    shell.castShadow = false;
    shell.receiveShadow = false;
    m.add(shell);
  }
  return group;
}

// ============================================================
// 3.0 CANVAS TEXTURES — procedural texture painting (no asset files).
// ============================================================
const texCache = new Map();
function canvasTex(key, w, h, draw, repeat = [1, 1]) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

// Mall paving: light herringbone-ish tile pattern (Queen St Mall vibes).
export function pavingTexture(repeat = 18) {
  return canvasTex('paving' + repeat, 128, 128, (x) => {
    x.fillStyle = '#b9b2a4'; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = '#9a9284'; x.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      x.beginPath(); x.moveTo(0, i * 32); x.lineTo(128, i * 32); x.stroke();
      x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32, 128); x.stroke();
    }
    x.fillStyle = '#c4bdaf';
    for (let i = 0; i < 8; i++) x.fillRect((i * 53) % 128, (i * 37) % 128, 30, 30);
    x.strokeStyle = '#8d8576'; x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(0, 64); x.lineTo(128, 64); x.stroke();
  }, [repeat, repeat]);
}

// Polished terminal floor: big pale tiles with subtle sheen lines.
export function terminalFloorTexture(repeat = 22) {
  return canvasTex('terminal' + repeat, 128, 128, (x) => {
    x.fillStyle = '#dcdfe2'; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = '#c2c6cc'; x.lineWidth = 2;
    x.strokeRect(2, 2, 124, 124);
    x.fillStyle = '#e6e9ec'; x.fillRect(8, 8, 50, 50);
  }, [repeat, repeat]);
}

// Airport ceiling: white triangular panels with sky-blue skylight cutouts
// (Reference Image C — Sydney Airport's triangular skylight grid).
export function skylightTexture(repeat = 8) {
  return canvasTex('skylight' + repeat, 256, 256, (x) => {
    x.fillStyle = '#eef0f2'; x.fillRect(0, 0, 256, 256);
    const cell = 64;
    for (let gy = 0; gy < 4; gy++) {
      for (let gx = 0; gx < 4; gx++) {
        const ox = gx * cell, oy = gy * cell;
        x.strokeStyle = '#cdd2d8'; x.lineWidth = 3;
        // triangle grid lines
        x.beginPath(); x.moveTo(ox, oy + cell); x.lineTo(ox + cell / 2, oy); x.lineTo(ox + cell, oy + cell); x.closePath(); x.stroke();
        // some triangles are skylights
        if ((gx * 7 + gy * 13) % 3 === 0) {
          x.fillStyle = '#7ec3ea';
          x.beginPath(); x.moveTo(ox + 10, oy + cell - 8); x.lineTo(ox + cell / 2, oy + 12); x.lineTo(ox + cell - 10, oy + cell - 8); x.closePath(); x.fill();
        }
      }
    }
  }, [repeat, repeat]);
}

// Animated LED billboard texture: blocky abstract cyber glyphs (fictional —
// resembles dense CJK-style signage without being real characters).
export function ledTexture(seed = 1, fg = '#ff2e5f', bg = '#14060c') {
  return canvasTex('led' + seed + fg, 128, 256, (x) => {
    x.fillStyle = bg; x.fillRect(0, 0, 128, 256);
    let s = seed * 7919;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    x.fillStyle = fg;
    for (let row = 0; row < 7; row++) {
      const gy = 12 + row * 34;
      // each "glyph" = small cluster of bars/boxes
      for (let col = 0; col < 3; col++) {
        const gx = 12 + col * 40;
        for (let k = 0; k < 5; k++) {
          if (rnd() < 0.3) continue;
          if (rnd() < 0.5) x.fillRect(gx + rnd() * 18, gy + rnd() * 18, 4 + rnd() * 16, 3);
          else x.fillRect(gx + rnd() * 18, gy + rnd() * 18, 3, 4 + rnd() * 16);
        }
      }
    }
  });
}

// Hazard stripe texture (signage, barriers).
export function hazardTexture() {
  return canvasTex('hazard', 64, 64, (x) => {
    x.fillStyle = '#16181d'; x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#ffc23d';
    for (let i = -2; i < 6; i++) {
      x.save(); x.translate(i * 18, 0); x.rotate(0.5);
      x.fillRect(0, -20, 9, 100); x.restore();
    }
  }, [3, 1]);
}
