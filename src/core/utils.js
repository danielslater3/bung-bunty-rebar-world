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
