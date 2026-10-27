// Brisbane River. The walk grid is the same mask the swimmer uses, subdivided
// so the surface can actually rise and fall. Colour is a mix of silt brown,
// olive and blue-green. It is not a surveyed water sample.
import * as THREE from 'three';

export const RIVER_SURFACE = -0.32;

export function riverMaterial() {
  const mat = new THREE.ShaderMaterial({
    transparent: false,
    depthWrite: true,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x2f5c58) },
      uGreen: { value: new THREE.Color(0x6c8650) },
      uSilt: { value: new THREE.Color(0x8a6a3e) },
      uSun: { value: new THREE.Vector3(0.45, 0.82, 0.28).normalize() },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorld;
      varying float vH;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        float along = world.x * 0.2 + world.z * 0.055;
        float h = sin(along - uTime * 1.25) * 0.28;
        h += sin(along * 0.48 + 1.4 - uTime * 0.6) * 0.12;
        world.y += h;
        vH = h;
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uGreen;
      uniform vec3 uSilt;
      uniform vec3 uSun;
      varying vec3 vWorld;
      varying float vH;
      void main() {
        float along = vWorld.x * 0.2 + vWorld.z * 0.055;
        float dAx = cos(along - uTime * 1.25) * 0.28 * 0.2;
        dAx += cos(along * 0.48 + 1.4 - uTime * 0.6) * 0.12 * 0.096;
        float dAz = cos(along - uTime * 1.25) * 0.28 * 0.055;
        dAz += cos(along * 0.48 + 1.4 - uTime * 0.6) * 0.12 * 0.026;
        vec3 normal = normalize(vec3(-dAx, 1.0, -dAz));
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 2.4);
        vec3 halfDir = normalize(uSun + viewDir);
        float spec = pow(max(dot(normal, halfDir), 0.0), 24.0);
        float crest = clamp(vH * 2.4 + 0.5, 0.0, 1.0);
        float band = 0.5 + 0.5 * sin(along * 1.7 - uTime * 1.8);
        vec3 col = mix(uDeep, uGreen, crest);
        col = mix(col, uSilt, 0.22 + band * 0.16);
        col = mix(col, vec3(0.72, 0.84, 0.74), fres * 0.42);
        col += vec3(0.9, 0.96, 0.88) * spec * 0.55;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return mat;
}

export function attachRiverClock(zone, material) {
  zone.updaters.push((dt) => {
    material.uniforms.uTime.value += dt;
  });
}

// One sheet for every water cell, merged into rectangles and split so the
// wavelength has vertices to move. Step is metres.
export function waterSheet(grid, ground, y, step = 8) {
  const { w, h, minX, minZ, cell } = grid;
  const used = new Uint8Array(ground.length);
  const positions = [];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const id = j * w + i;
      if (used[id] || ground[id] !== 1) continue;
      let ww = 1;
      while (i + ww < w && !used[id + ww] && ground[id + ww] === 1) ww++;
      let hh = 1;
      outer: while (j + hh < h) {
        for (let k = 0; k < ww; k++) {
          const nid = (j + hh) * w + i + k;
          if (used[nid] || ground[nid] !== 1) break outer;
        }
        hh++;
      }
      for (let jj = 0; jj < hh; jj++) {
        for (let ii = 0; ii < ww; ii++) used[(j + jj) * w + i + ii] = 1;
      }
      const x0 = minX + i * cell;
      const z0 = minZ + j * cell;
      const x1 = x0 + ww * cell;
      const z1 = z0 + hh * cell;
      const nx = Math.max(1, Math.ceil((x1 - x0) / step));
      const nz = Math.max(1, Math.ceil((z1 - z0) / step));
      for (let gz = 0; gz < nz; gz++) {
        const za = z0 + (z1 - z0) * gz / nz;
        const zb = z0 + (z1 - z0) * (gz + 1) / nz;
        for (let gx = 0; gx < nx; gx++) {
          const xa = x0 + (x1 - x0) * gx / nx;
          const xb = x0 + (x1 - x0) * (gx + 1) / nx;
          positions.push(
            xa, y, za, xb, y, za, xa, y, zb,
            xb, y, za, xb, y, zb, xa, y, zb,
          );
        }
      }
    }
  }
  return positions;
}
