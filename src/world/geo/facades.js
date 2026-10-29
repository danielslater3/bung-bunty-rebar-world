// Building shells on the LiDAR ground. Footprints are the OSM rings; heights and styles
// come from tools/enrich_brisbane.py (LiDAR edge heights, levels, BCC overlays, roof shapes).
// Each wall is split into a ground floor, upper floors and a parapet, and the facade
// texture repeats once per floor and once per window bay, so a 40-storey tower shows
// 40 rows of windows. The window patterns are generic per style: they are not a survey
// of each facade. Roofs carry the Queensland orthophoto; it never goes on a wall.
import * as THREE from 'three';
import { triangulateRing } from './drape.js';

export const ST = {
  modern: 0, glass: 1, residential: 2, heritage: 3, queenslander: 4, house: 5,
  industrial: 6, shopfront: 7, church: 8, office: 9, parking: 10, shed: 11,
};

const TILE = 256;
const LAYER_DEFS = [
  ['glassBlue', 1.5, 3.7], ['glassSilver', 1.5, 3.7], ['glassDark', 1.5, 3.7], ['office', 3.0, 3.6],
  ['balcony', 4.0, 3.1], ['punched', 3.0, 3.3], ['heritageWin', 3.2, 4.0], ['heritageGround', 3.2, 4.4],
  ['weatherboard', 2.4, 3.0], ['weatherboardPlain', 2.4, 3.0], ['brickHouse', 3.0, 2.7], ['industrial', 6.0, 6.0],
  ['shopGround', 4.0, 4.2], ['lobby', 3.0, 4.5], ['church', 4.0, 8.0], ['parking', 6.0, 3.0],
  ['shed', 4.0, 4.0], ['plain', 4.0, 4.0], ['brickPunched', 3.2, 3.6], ['battens', 1.2, 1.2],
  ['glassGreen', 1.5, 3.7],
];
const L = {};
const BAY = [];
LAYER_DEFS.forEach(([name, bay], i) => { L[name] = i; BAY[i] = bay; });
const PLAIN_OF = {
  [L.weatherboard]: L.weatherboardPlain, [L.punched]: L.plain, [L.brickHouse]: L.plain,
  [L.heritageWin]: L.plain, [L.brickPunched]: L.plain, [L.office]: L.plain, [L.balcony]: L.plain,
  [L.shopGround]: L.plain, [L.industrial]: L.shed, [L.church]: L.plain, [L.heritageGround]: L.plain,
};

// ---------------------------------------------------------------- facade tiles

function tilePainter(bw, fh) {
  const mk = () => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = TILE;
    return cv;
  };
  const cv = mk(), mv = mk();
  const c = cv.getContext('2d'), m = mv.getContext('2d');
  m.fillStyle = '#000';
  m.fillRect(0, 0, TILE, TILE);
  const X = (x) => (x / bw) * TILE;
  const Y = (y) => (1 - y / fh) * TILE;
  let seed = Math.round(bw * 1000 + fh * 37);
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rect = (x0, y0, x1, y1, color, paint) => {
    const px = X(x0), py = Y(y1), pw = X(x1) - px, ph = Y(y0) - py;
    c.fillStyle = color;
    c.fillRect(px, py, pw, ph);
    m.fillStyle = paint ? '#fff' : '#000';
    m.fillRect(px, py, pw, ph);
  };
  const grad = (x0, y0, x1, y1, bottom, top) => {
    const px = X(x0), py = Y(y1), pw = X(x1) - px, ph = Y(y0) - py;
    const gr = c.createLinearGradient(0, py + ph, 0, py);
    gr.addColorStop(0, bottom);
    gr.addColorStop(1, top);
    c.fillStyle = gr;
    c.fillRect(px, py, pw, ph);
    m.fillStyle = '#000';
    m.fillRect(px, py, pw, ph);
  };
  const path = (draw, color, paint) => {
    c.fillStyle = color;
    c.beginPath(); draw(c); c.fill();
    m.fillStyle = paint ? '#fff' : '#000';
    m.beginPath(); draw(m); m.fill();
  };
  const speckle = (x0, y0, x1, y1, colors, n) => {
    for (let i = 0; i < n; i++) {
      c.fillStyle = colors[i % colors.length];
      const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0);
      c.fillRect(X(x), Y(y), 1 + rnd() * 2, 1 + rnd() * 2);
    }
  };
  return { c, m, cv, mv, rect, grad, path, speckle, X, Y, bw, fh, rnd };
}

function arch(P, cx, y0, w, top, pointed) {
  // window with a round or pointed head; y0..top in metres
  const r = w / 2;
  const spring = top - (pointed ? w * 0.85 : r);
  return (g) => {
    g.moveTo(P.X(cx - r), P.Y(y0));
    g.lineTo(P.X(cx - r), P.Y(spring));
    if (pointed) {
      g.quadraticCurveTo(P.X(cx - r), P.Y(top - w * 0.2), P.X(cx), P.Y(top));
      g.quadraticCurveTo(P.X(cx + r), P.Y(top - w * 0.2), P.X(cx + r), P.Y(spring));
    } else {
      const k = 0.5523;
      g.bezierCurveTo(P.X(cx - r), P.Y(spring + r * k), P.X(cx - r * k), P.Y(top), P.X(cx), P.Y(top));
      g.bezierCurveTo(P.X(cx + r * k), P.Y(top), P.X(cx + r), P.Y(spring + r * k), P.X(cx + r), P.Y(spring));
    }
    g.lineTo(P.X(cx + r), P.Y(y0));
    g.closePath();
  };
}

function bricks(P, x0, y0, x1, y1) {
  P.rect(x0, y0, x1, y1, '#f0efee', true);
  const course = 0.086;
  let row = 0;
  for (let y = y0; y < y1; y += course, row++) {
    P.rect(x0, y, x1, y + 0.012, '#c9c4bf', true);
    const off = row % 2 ? 0.115 : 0;
    for (let x = x0 + off; x < x1; x += 0.23) P.rect(x, y, x + 0.012, y + course, '#c9c4bf', true);
  }
}

function boards(P, x0, y0, x1, y1) {
  P.rect(x0, y0, x1, y1, '#fbfbfb', true);
  for (let y = y0 + 0.18; y < y1; y += 0.18) {
    P.rect(x0, y - 0.03, x1, y, '#d2d2d2', true);
    P.rect(x0, y, x1, y + 0.012, '#ffffff', true);
  }
}

function glassWall(P, pane, spandrel, top) {
  P.grad(0, 0.95, 1.5, 3.65, pane, top);
  P.rect(0, 0, 1.5, 0.9, spandrel, false);
  P.rect(0, 0, 0.05, 3.7, '#ffffff', true);
  P.rect(1.45, 0, 1.5, 3.7, '#ffffff', true);
  P.rect(0, 0.9, 1.5, 0.95, '#ffffff', true);
  P.rect(0, 3.65, 1.5, 3.7, '#ffffff', true);
}

const PAINTERS = {
  glassBlue: (P) => glassWall(P, '#3f6275', '#33505f', '#7fa3b8'),
  glassSilver: (P) => glassWall(P, '#6f7f89', '#5e6b73', '#b3c2cb'),
  glassDark: (P) => glassWall(P, '#2c363d', '#232b30', '#5d6d77'),
  glassGreen: (P) => glassWall(P, '#3d6b64', '#325750', '#7fa7a0'),
  office: (P) => {
    P.rect(0, 0, 3, 3.6, '#f2f2f2', true);
    P.speckle(0, 0, 3, 3.6, ['#e4e4e4', '#fafafa'], 140);
    P.rect(0, 0.98, 3, 1.05, '#d4d4d4', true);
    P.grad(0.06, 1.05, 2.94, 3.0, '#33444f', '#62798a');
    P.rect(1.47, 1.05, 1.53, 3.0, '#e6e6e6', true);
    P.rect(0, 2.98, 3, 3.04, '#dcdcdc', true);
  },
  balcony: (P) => {
    P.rect(0, 0, 4, 3.1, '#eeeeee', true);
    P.grad(0.35, 0.25, 3.65, 2.95, '#26323a', '#4d6170');
    P.rect(1.98, 0.25, 2.02, 2.95, '#c8cdd0', false);
    P.rect(0.35, 2.95, 3.65, 3.1, '#2b2f33', false);
    P.rect(0, 0, 4, 0.25, '#ffffff', true);
    P.rect(0, 0.25, 4, 1.25, '#7d939e', false);
    P.rect(0, 1.2, 4, 1.26, '#e2e2e2', true);
    for (let x = 0.5; x < 4; x += 1) P.rect(x, 0.25, x + 0.03, 1.2, '#9fb1ba', false);
  },
  punched: (P) => {
    P.rect(0, 0, 3, 3.3, '#f4f4f4', true);
    P.speckle(0, 0, 3, 3.3, ['#e7e7e7', '#fbfbfb'], 160);
    P.rect(0.66, 0.86, 2.34, 0.95, '#d5d5d5', true);
    P.rect(0.75, 0.95, 2.25, 2.45, '#c9cdd0', false);
    P.grad(0.82, 1.02, 2.18, 2.38, '#2f3e48', '#5b7181');
    P.rect(1.48, 1.02, 1.52, 2.38, '#c9cdd0', false);
  },
  heritageWin: (P) => {
    P.rect(0, 0, 3.2, 4.0, '#f2f2f2', true);
    for (let y = 0.45; y < 4; y += 0.45) P.rect(0, y, 3.2, y + 0.015, '#dedede', true);
    P.rect(0, 0, 3.2, 0.2, '#d8d8d8', true);
    P.rect(0.88, 0.78, 2.32, 0.9, '#dadada', true);
    P.path(arch(P, 1.6, 0.9, 1.36, 3.72, false), '#e4e4e4', true);
    P.path(arch(P, 1.6, 0.9, 1.2, 3.6, false), '#efece4', false);
    P.path(arch(P, 1.6, 0.98, 1.04, 3.5, false), '#2b363d', false);
    P.rect(1.57, 0.98, 1.63, 3.4, '#efece4', false);
    P.rect(1.08, 2.15, 2.12, 2.21, '#efece4', false);
  },
  heritageGround: (P) => {
    P.rect(0, 0, 3.2, 4.4, '#ececec', true);
    for (let y = 0.35; y < 4.4; y += 0.35) P.rect(0, y, 3.2, y + 0.03, '#c7c7c7', true);
    P.path(arch(P, 1.6, 0, 2.1, 3.9, false), '#2a2a2a', false);
    P.path(arch(P, 1.6, 0.25, 1.86, 3.7, false), '#4b5c66', false);
    P.rect(0.67, 0, 2.53, 0.25, '#3a3634', false);
    P.rect(1.57, 0.25, 1.63, 3.6, '#2a2a2a', false);
  },
  weatherboard: (P) => {
    boards(P, 0, 0, 2.4, 3.0);
    P.rect(0.7, 0.82, 1.7, 2.5, '#f3f1ea', false);
    P.grad(0.78, 0.9, 1.62, 2.42, '#26323a', '#4e6270');
    P.rect(0.78, 1.63, 1.62, 1.69, '#f3f1ea', false);
    P.rect(1.17, 0.9, 1.23, 2.42, '#f3f1ea', false);
    P.rect(0.6, 2.5, 1.8, 2.62, '#c9c9c9', true);
  },
  weatherboardPlain: (P) => boards(P, 0, 0, 2.4, 3.0),
  brickHouse: (P) => {
    bricks(P, 0, 0, 3, 2.7);
    P.rect(0.72, 0.86, 2.28, 2.14, '#b9bfc3', false);
    P.grad(0.78, 0.92, 2.22, 2.08, '#2c3a43', '#566b78');
    P.rect(1.48, 0.92, 1.52, 2.08, '#b9bfc3', false);
    P.rect(0.66, 0.78, 2.34, 0.86, '#bdbdbd', true);
  },
  industrial: (P) => {
    for (let x = 0; x < 6; x += 0.2) {
      P.rect(x, 0, x + 0.1, 6, '#f4f4f4', true);
      P.rect(x + 0.1, 0, x + 0.2, 6, '#d6d6d6', true);
    }
    P.rect(0, 0, 6, 0.45, '#bdbdbd', true);
    P.rect(0, 4.6, 6, 5.3, '#43535d', false);
    for (let x = 0; x < 6; x += 1.5) P.rect(x, 4.6, x + 0.05, 5.3, '#9aa3a8', false);
  },
  shopGround: (P) => {
    P.rect(0, 0, 4, 4.2, '#f2f2f2', true);
    P.rect(0, 0, 4, 0.35, '#34373a', false);
    P.grad(0.1, 0.35, 3.9, 3.0, '#4d626d', '#7d97a5');
    const goods = ['#8d7a60', '#a5634e', '#6f7f58', '#c8b48e', '#59677a'];
    for (let i = 0; i < 9; i++) {
      const x = 0.25 + (i % 5) * 0.72, y = 0.45 + Math.floor(i / 5) * 0.62;
      P.rect(x, y, x + 0.45, y + 0.42, goods[i % goods.length], false);
    }
    P.rect(0, 0, 0.1, 3.1, '#2e3134', false);
    P.rect(3.9, 0, 4, 3.1, '#2e3134', false);
    P.rect(1.95, 0.35, 2.05, 3.1, '#2e3134', false);
    P.rect(0, 3.0, 4, 3.1, '#2e3134', false);
    P.rect(0, 3.1, 4, 4.2, '#f0f0f0', true);
  },
  lobby: (P) => {
    P.grad(0, 0, 3, 4.2, '#3c4e59', '#7e98a8');
    P.rect(0, 0, 0.09, 4.2, '#c9ced1', false);
    P.rect(1.46, 0, 1.54, 4.2, '#c9ced1', false);
    P.rect(2.91, 0, 3, 4.2, '#c9ced1', false);
    P.rect(0, 2.6, 3, 2.66, '#c9ced1', false);
    P.rect(0, 4.2, 3, 4.5, '#f2f2f2', true);
  },
  church: (P) => {
    P.rect(0, 0, 4, 8, '#f0f0f0', true);
    for (let y = 0.4; y < 8; y += 0.4) P.rect(0, y, 4, y + 0.02, '#dddddd', true);
    P.rect(0, 0, 0.32, 8, '#e1e1e1', true);
    P.path(arch(P, 2, 1.4, 1.4, 6.9, true), '#d8d1c2', false);
    P.path(arch(P, 2, 1.5, 1.2, 6.7, true), '#3b4058', false);
    const stain = ['#7b3c3c', '#3c5a7b', '#8a7a3c', '#3c6b52'];
    for (let i = 0; i < 12; i++) {
      const y = 1.7 + i * 0.36;
      P.rect(1.5, y, 2.5, y + 0.12, stain[i % stain.length], false);
    }
    P.rect(1.97, 1.5, 2.03, 6.1, '#d8d1c2', false);
  },
  parking: (P) => {
    P.rect(0, 0, 6, 3, '#efefef', true);
    P.rect(0.4, 1.1, 6, 2.75, '#1c1f21', false);
    P.rect(0.4, 1.1, 6, 1.18, '#2e3236', false);
    P.rect(0, 2.75, 6, 3, '#dedede', true);
  },
  shed: (P) => {
    for (let x = 0; x < 4; x += 0.2) {
      P.rect(x, 0, x + 0.1, 4, '#f4f4f4', true);
      P.rect(x + 0.1, 0, x + 0.2, 4, '#d4d4d4', true);
    }
  },
  plain: (P) => {
    P.rect(0, 0, 4, 4, '#f3f3f3', true);
    P.speckle(0, 0, 4, 4, ['#e6e6e6', '#fafafa', '#ececec'], 240);
  },
  brickPunched: (P) => {
    bricks(P, 0, 0, 3.2, 3.6);
    P.rect(0.95, 2.62, 2.25, 2.86, '#bdbdbd', true);
    P.rect(1.0, 0.86, 2.2, 2.62, '#efece4', false);
    P.grad(1.08, 0.94, 2.12, 2.54, '#28333a', '#4f6370');
    P.rect(1.08, 1.72, 2.12, 1.78, '#efece4', false);
    P.rect(0.9, 0.78, 2.3, 0.88, '#d0d0d0', true);
  },
  battens: (P) => {
    P.rect(0, 0, 1.2, 1.2, '#1b1d1e', false);
    for (let x = 0.02; x < 1.2; x += 0.12) P.rect(x, 0, x + 0.07, 1.2, '#f2f2f2', true);
  },
};

let atlasCache = null;
export function facadeAtlas() {
  if (atlasCache) return atlasCache;
  const n = LAYER_DEFS.length;
  const data = new Uint8Array(TILE * TILE * 4 * n);
  LAYER_DEFS.forEach(([name, bw, fh], li) => {
    const P = tilePainter(bw, fh);
    PAINTERS[name](P);
    const cd = P.c.getImageData(0, 0, TILE, TILE).data;
    const md = P.m.getImageData(0, 0, TILE, TILE).data;
    const layer = li * TILE * TILE * 4;
    for (let y = 0; y < TILE; y++) {
      const src = (TILE - 1 - y) * TILE * 4;
      const dst = layer + y * TILE * 4;
      for (let x = 0; x < TILE * 4; x += 4) {
        data[dst + x] = cd[src + x];
        data[dst + x + 1] = cd[src + x + 1];
        data[dst + x + 2] = cd[src + x + 2];
        data[dst + x + 3] = md[src + x];
      }
    }
  });
  const tex = new THREE.DataArrayTexture(data, TILE, TILE, n);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  atlasCache = tex;
  return tex;
}

// Paint (alpha 1 in the tile) takes the building's colour; glass and frames keep their own.
export function facadeMaterial(atlas) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.84, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uFacade = { value: atlas };
    shader.uniforms.uSkyTint = { value: new THREE.Color(0x9ec3dc) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 aFac;
attribute vec2 aUv;
varying vec3 vPaint;
varying float vLayer;
varying vec2 vFacUv;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vPaint = pow(aFac.rgb / 255.0, vec3(2.2));
vLayer = aFac.a;
vFacUv = aUv;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
precision highp sampler2DArray;
uniform sampler2DArray uFacade;
uniform vec3 uSkyTint;
varying vec3 vPaint;
varying float vLayer;
varying vec2 vFacUv;`)
      .replace('#include <map_fragment>', `
vec4 facTex = texture(uFacade, vec3(vFacUv, floor(vLayer + 0.5)));
float facA = facTex.a;
diffuseColor.rgb *= mix(facTex.rgb, facTex.rgb * vPaint, facA);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(0.18, roughnessFactor, facA);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float facFres = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.0);
totalEmissiveRadiance += (1.0 - facA) * uSkyTint * (0.04 + 0.3 * facFres);`);
  };
  mat.customProgramCacheKey = () => 'bne-facade-1';
  return mat;
}

// ---------------------------------------------------------------- colours

const PAL = {
  [ST.modern]: [0xe9e4da, 0xddd6ca, 0xf1ede6, 0xcfc9be, 0xe4dccd, 0xd3d8da],
  [ST.office]: [0xd9d4ca, 0xc8c3b9, 0xbfbab0, 0xe3ded4, 0xb5b8ba],
  [ST.residential]: [0xf2efe8, 0xe9e4da, 0xdcd6cb, 0xf5f3ee, 0xe6e8e6],
  [ST.heritage]: [0xe2c79c, 0xe8dcc2, 0xb46a4e, 0xd9c3a0, 0xa95f45, 0xeee5d3],
  [ST.queenslander]: [0xf6f4ee, 0xf1ead8, 0xe8efe6, 0xf3ecdc, 0xe1e9ee, 0xf2f2ef, 0xe9e1cb],
  [ST.house]: [0xb87a5c, 0xc9a07a, 0xd8c9ad, 0xa5644c, 0xe7e2d6, 0xcbb593],
  [ST.industrial]: [0xc8ccd0, 0xb9bec3, 0xd7d9db, 0xa3abb2, 0xc9c1b2],
  [ST.shopfront]: [0xe9dcc6, 0xdac6a6, 0xf0e8d8, 0xc9b598, 0xe3d5bf, 0xd8cbbb],
  [ST.church]: [0xe6cfa6, 0xb5694d, 0xd9c7a6],
  [ST.parking]: [0xcac7c0, 0xbdbab3],
  [ST.shed]: [0xc6cace, 0xb6bbc0, 0x9fa7ae, 0xd5d7d8, 0x8a959e],
  [ST.glass]: [0xe3e7ea, 0xc9cfd3, 0x50575e, 0xf2f2f0],
};
const GLASS_LAYERS = [L.glassBlue, L.glassSilver, L.glassDark, L.glassGreen, L.glassBlue, L.glassSilver];
// Swatches written by tools/bake_aerial.py when an OSM building:material tag matched.
const MAT_BRICK = (168 << 16) | (90 << 8) | 69;
const MAT_METAL = (181 << 16) | (188 << 8) | 196;
const MAT_GLASS = (158 << 16) | (186 << 8) | 204;
const MAT_SAND = (214 << 16) | (196 << 8) | 164;
const RETAIL = 0xc45a4a;
const COMMERCIAL = 0xb7b1a4;

// Footprint centroids of buildings whose finish is known from public photographs.
const NAMED = [
  { x: -634, z: 188, st: ST.modern, paint: 0xf4f1ea, upper: L.plain, ground: L.lobby }, // Gallery of Modern Art, white
  { x: -539, z: 251, st: ST.modern, paint: 0xf7f4ee, upper: L.plain, ground: L.lobby }, // State Library of Queensland
  { x: -379, z: 644, st: ST.modern, paint: 0x8a8e92, upper: L.plain, ground: L.lobby }, // QPAC, grey concrete
  { x: 159.3, z: 179.1, st: ST.glass, paint: 0x50575e, glass: L.glassDark }, // Uptown
  { x: 243.1, z: -72.5, st: ST.glass, paint: 0x50575e, glass: L.glassDark }, // QueensPlaza
  { x: 294.6, z: 46.6, st: ST.modern, paint: 0xefe6d4 }, // Wintergarden
  { x: 76.4, z: 115.5, st: ST.modern, paint: 0xf3ead8 }, // Queen Adelaide Building
  { x: 76.2, z: 95.8, st: ST.modern, paint: 0xf3ead8 },
  { x: 173.2, z: -1.4, st: ST.heritage, paint: 0xe7eee4 }, // Brisbane Arcade
  { x: 228.0, z: 693.9, st: ST.glass, paint: 0xe7f1f8, glass: L.glassBlue }, // 1 William Street, glazed
  { x: 752.9, z: -390.8, st: ST.heritage, paint: 0xe9c99a }, // Customs House, sandstone
  { x: 292.9, z: 606.8, st: ST.heritage, paint: 0xa85a45, upper: L.brickPunched }, // The Mansions, brick
  { x: 133.67, z: 69.17, st: ST.glass, paint: 0xe3e7ea, glass: L.glassSilver }, // 130 Queen Street, glazed mall front
];

function hash2(x, z) {
  let h = (Math.round(x * 10) * 73856093) ^ (Math.round(z * 10) * 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

function hsl(c) {
  const r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let hh;
  if (mx === r) hh = (g - b) / d + (g < b ? 6 : 0);
  else if (mx === g) hh = (b - r) / d + 2;
  else hh = (r - g) / d + 4;
  return [hh * 60, s, l];
}

function glassForColour(c) {
  const [hh, s, l] = hsl(c);
  if (l < 0.3) return L.glassDark;
  if (s < 0.18) return L.glassSilver;
  if (hh >= 75 && hh < 185) return L.glassGreen;
  return L.glassBlue;
}

function shade(c, k) {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * k));
  const b = Math.min(255, Math.round((c & 255) * k));
  return (r << 16) | (g << 8) | b;
}

// ---------------------------------------------------------------- geometry buffers

class WallBuf {
  constructor() { this.p = []; this.n = []; this.uv = []; this.f = []; this.i = []; this.v = 0; }
  // Quad on the edge a->b from y0 to y1, outward normal (nx, nz).
  quad(ax, az, bx, bz, y0, y1, nx, nz, u1, v0, v1, paint, layer) {
    const v = this.v;
    this.p.push(ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y1, az);
    for (let k = 0; k < 4; k++) this.n.push(nx, 0, nz);
    this.uv.push(0, v0, u1, v0, u1, v1, 0, v1);
    const r = (paint >> 16) & 255, g = (paint >> 8) & 255, b = paint & 255;
    for (let k = 0; k < 4; k++) this.f.push(r, g, b, layer);
    // (v1 - v0) x (v2 - v0) points along (-dz, 0, dx); keep it on the outward side
    const cross = (bx - ax) * nz - (bz - az) * nx;
    if (cross > 0) this.i.push(v, v + 1, v + 2, v, v + 2, v + 3);
    else this.i.push(v, v + 2, v + 1, v, v + 3, v + 2);
    this.v += 4;
  }
  tri(a, b, c, nx, ny, nz, uvs, paint, layer) {
    const v = this.v;
    this.p.push(...a, ...b, ...c);
    for (let k = 0; k < 3; k++) this.n.push(nx, ny, nz);
    this.uv.push(...uvs);
    const r = (paint >> 16) & 255, g = (paint >> 8) & 255, bl = paint & 255;
    for (let k = 0; k < 3; k++) this.f.push(r, g, bl, layer);
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
    if (cx * nx + cy * ny + cz * nz >= 0) this.i.push(v, v + 1, v + 2);
    else this.i.push(v, v + 2, v + 1);
    this.v += 3;
  }
  mesh(material) {
    if (!this.v) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    const nn = new Int8Array(this.n.length);
    for (let k = 0; k < this.n.length; k++) nn[k] = Math.round(this.n[k] * 127);
    geo.setAttribute('normal', new THREE.BufferAttribute(nn, 3, true));
    geo.setAttribute('aUv', new THREE.Float32BufferAttribute(this.uv, 2));
    geo.setAttribute('aFac', new THREE.BufferAttribute(new Uint8Array(this.f), 4, false));
    geo.setIndex(this.v > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.abs = true;
    return mesh;
  }
}

const linCache = new Map();
function linear(hex) {
  let c = linCache.get(hex);
  if (!c) linCache.set(hex, c = new THREE.Color(hex));
  return c;
}

// Coloured boxes for verandah posts, rails, decks, awnings and canopy posts.
class TrimBuf {
  constructor() { this.p = []; this.c = []; }
  box(cx, cy, cz, sx, sy, sz, yaw, color) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const co = Math.cos(yaw), si = Math.sin(yaw);
    const P = (x, y, z) => [cx + x * co + z * si, cy + y, cz - x * si + z * co];
    const v = [
      P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(-hx, hy, -hz),
      P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz),
    ];
    const tris = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 6, 2, 3, 7, 6, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
    const lin = linear(color);
    for (const k of tris) {
      this.p.push(...v[k]);
      this.c.push(lin.r, lin.g, lin.b);
    }
  }
  // Box spanning a->b (horizontal), centred on height y, with depth d pushed outward along (nx, nz).
  span(ax, az, bx, bz, y, sy, d, nx, nz, off, color) {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.2) return;
    const yaw = Math.atan2(bx - ax, bz - az);
    const mx = (ax + bx) / 2 + nx * (off + d / 2), mz = (az + bz) / 2 + nz * (off + d / 2);
    this.box(mx, y, mz, d, sy, len, yaw, color);
  }
  mesh(material) {
    if (!this.p.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    const col = new THREE.Float32BufferAttribute(this.c, 3);
    geo.setAttribute('color', col);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.abs = true;
    return mesh;
  }
}

// ---------------------------------------------------------------- shapes

function ringOf(flat) {
  const pts = [];
  for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
  if (pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.4) pts.pop();
  return pts;
}

function area2(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s;
}

function convex(pts) {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], c = pts[(i + 2) % pts.length];
    const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cr) < 1e-6) continue;
    const s = cr > 0 ? 1 : -1;
    if (!sign) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

// Oriented box of a ring: long axis from the longest edge direction.
function obb(pts) {
  let best = 0, ux = 1, uz = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > best) { best = l; ux = (b[0] - a[0]) / l; uz = (b[1] - a[1]) / l; }
  }
  const vx = -uz, vz = ux;
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const p of pts) {
    const u = p[0] * ux + p[1] * uz, v = p[0] * vx + p[1] * vz;
    if (u < u0) u0 = u; if (u > u1) u1 = u;
    if (v < v0) v0 = v; if (v > v1) v1 = v;
  }
  let L = (u1 - u0) / 2, W = (v1 - v0) / 2;
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
  const cx = cu * ux + cv * vx, cz = cu * uz + cv * vz;
  if (W > L) {
    // keep u as the long axis
    return { cx, cz, ux: vx, uz: vz, vx: -ux, vz: -uz, L: W, W: L };
  }
  return { cx, cz, ux, uz, vx, vz, L, W };
}

function offsetRing(pts, d, ccw) {
  const n = pts.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = pts[(i - 1 + n) % n], c = pts[i], q = pts[(i + 1) % n];
    const n1 = edgeNormal(p, c, ccw), n2 = edgeNormal(c, q, ccw);
    let mx = n1[0] + n2[0], mz = n1[1] + n2[1];
    const dot = 1 + n1[0] * n2[0] + n1[1] * n2[1];
    const k = d / Math.max(0.35, dot);
    out.push([c[0] + mx * k, c[1] + mz * k]);
  }
  return out;
}

function edgeNormal(a, b, ccw) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const l = Math.hypot(dx, dz) || 1;
  return ccw ? [dz / l, -dx / l] : [-dz / l, dx / l];
}

// ---------------------------------------------------------------- shells

const HOUSE_PITCH = Math.tan(24 * Math.PI / 180);

export function buildShells(buildings, opts) {
  const { chunk = 240, skip, nearMall, roofOut } = opts;
  const atlas = facadeAtlas();
  const wallMat = facadeMaterial(atlas);
  const trimMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05 });
  const walls = new Map();
  const trims = new Map();
  const stats = { buildings: 0, pitched: 0, verandahs: 0, awnings: 0, canopies: 0, stumps: 0 };
  const bufFor = (map, Cls, cx, cz) => {
    const key = `${Math.floor(cx / chunk)},${Math.floor(cz / chunk)}`;
    let b = map.get(key);
    if (!b) map.set(key, b = new Cls());
    return b;
  };

  for (const b of buildings) {
    if (!b.r || b.r.length < 6) continue;
    const pts = ringOf(b.r);
    const n = pts.length;
    if (n < 3) continue;
    let cx = 0, cz = 0;
    for (const p of pts) { cx += p[0]; cz += p[1]; }
    cx /= n; cz /= n;
    if (skip && skip(b, cx, cz)) continue;
    const a2 = area2(pts);
    const ccw = a2 > 0;
    const area = Math.abs(a2) / 2;
    const h0 = hash2(cx, cz);
    const g = b.g ?? 0;
    const gm = b.gm ?? g;
    const base = b.b || 0;
    let st = b.st ?? ST.modern;
    let top = g + base + b.h;
    const retailish = b.c === RETAIL || b.c === COMMERCIAL;
    // Mall ways tagged building:levels=1 are the shop tenancy, not a 3 m kiosk.
    if (b.s === 1 && b.h < 8 && retailish && area > 200 && nearMall && nearMall(cx, cz) < 42) top = g + base + 11;
    const elevated = base > 0.5;
    const yb = elevated ? g + base : gm - 1.5;
    const ys = g + base;
    const W = bufFor(walls, WallBuf, cx, cz);
    const T = bufFor(trims, TrimBuf, cx, cz);
    stats.buildings++;

    // ---- paint and layers
    const pal = PAL[st] || PAL[ST.modern];
    let paint = pal[h0 % pal.length];
    let glassLayer = GLASS_LAYERS[(h0 >>> 8) % GLASS_LAYERS.length];
    let upper = null, groundL = null;
    let brick = false;
    if (b.ws === 1 && b.wc) {
      if (b.wc === MAT_BRICK) { brick = true; paint = b.wc; }
      else if (b.wc === MAT_GLASS && b.h >= 16) { st = st === ST.residential ? st : ST.glass; }
      else if (b.wc === MAT_METAL) { paint = b.wc; if (st === ST.modern) st = b.h > 9 ? ST.industrial : ST.shed; }
      else if (b.wc === MAT_SAND) { paint = b.wc; }
      else paint = b.wc;
    } else if (b.ws === 2 && b.wc) {
      if (st === ST.glass) glassLayer = glassForColour(b.wc);
      else paint = b.wc;
    }
    for (const nm of NAMED) {
      if ((cx - nm.x) ** 2 + (cz - nm.z) ** 2 < 144) {
        st = nm.st;
        paint = nm.paint;
        if (nm.glass != null) glassLayer = nm.glass;
        if (nm.upper != null) upper = nm.upper;
        if (nm.ground != null) groundL = nm.ground;
        break;
      }
    }
    if (st === ST.heritage && (paint === 0xb46a4e || paint === 0xa95f45)) brick = true;

    if (b.ro) {
      // Roof on posts: slab, fascia and columns. Walking under it stays open.
      const slab = 0.35;
      const posts = [];
      for (let i = 0; i < n; i++) posts.push(pts[i]);
      for (const [px, pz] of posts) {
        const gy = opts.groundAt(px, pz);
        T.box(px, (gy + top - slab) / 2, pz, 0.3, Math.max(0.2, top - slab - gy), 0.3, 0, 0x8d9296);
      }
      for (let i = 0; i < n; i++) {
        const a = pts[i], c = pts[(i + 1) % n];
        const [nx, nz] = edgeNormal(a, c, ccw);
        W.quad(a[0], a[1], c[0], c[1], top - slab, top, nx, nz, 1, 0, 0.1, 0xd9dcde, L.plain);
      }
      roofOut.flat(b.r, top, top - slab);
      stats.canopies++;
      continue;
    }

    // ---- houses
    if (st === ST.queenslander || st === ST.house) {
      const hill = b.hx ?? g;
      let floorY = st === ST.queenslander ? hill + (b.hs ? 2.4 : 0.75) : hill + 0.25;
      if (top - floorY < 2.4) floorY = top - 2.6;
      if (floorY < yb + 0.2) floorY = yb + 0.2;
      const wallL = st === ST.queenslander ? L.weatherboard : (brick || paint === 0xb87a5c || paint === 0xa5644c || paint === 0xc9a07a ? L.brickHouse : L.punched);
      const floors = top - floorY > 5.2 ? 2 : 1;
      const lowPaint = st === ST.queenslander ? shade(paint, 0.78) : shade(paint, 0.82);
      const lowL = st === ST.queenslander ? L.battens : L.plain;
      let ring = pts;
      let veranda = null;
      if (st === ST.queenslander && n === 4 && b.fe != null && b.fe < 4) {
        const i0 = b.fe, i1 = (b.fe + 1) % 4;
        const a = pts[i0], c = pts[i1];
        const [nx, nz] = edgeNormal(a, c, ccw);
        // depth of the house measured back from the front edge
        let depth = 0;
        for (const p of pts) depth = Math.max(depth, -((p[0] - a[0]) * nx + (p[1] - a[1]) * nz));
        const d = Math.min(2.4, depth * 0.28);
        if (d > 1.2 && Math.hypot(c[0] - a[0], c[1] - a[1]) > 5) {
          ring = pts.map((p, k) => (k === i0 || k === i1 ? [p[0] - nx * d, p[1] - nz * d] : p));
          veranda = { a, c, nx, nz, d };
        }
      }
      const m = ring.length;
      for (let i = 0; i < m; i++) {
        const a = ring[i], c = ring[(i + 1) % m];
        const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
        if (len < 0.05) continue;
        const [nx, nz] = edgeNormal(a, c, ccw);
        const layer = len < BAY[wallL] * 0.7 ? PLAIN_OF[wallL] ?? wallL : wallL;
        const bays = Math.max(1, Math.round(len / BAY[layer]));
        W.quad(a[0], a[1], c[0], c[1], yb, floorY, nx, nz, Math.max(1, Math.round(len / BAY[lowL])), (yb - floorY) / 1.2, 0, lowPaint, lowL);
        W.quad(a[0], a[1], c[0], c[1], floorY, top, nx, nz, bays, 0, floors, paint, layer);
      }
      if (st === ST.queenslander && floorY - yb > 1.6) stats.stumps++;
      if (veranda) {
        const { a, c, nx, nz, d } = veranda;
        const trim = (h0 >>> 4) % 3 === 0 ? 0x3f5f4a : 0xf3f1ea;
        const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
        const yaw = Math.atan2(c[0] - a[0], c[1] - a[1]);
        const posts = Math.max(2, Math.round(len / 2.4) + 1);
        for (let k = 0; k < posts; k++) {
          const t = k / (posts - 1);
          const px = a[0] + (c[0] - a[0]) * t - nx * 0.12, pz = a[1] + (c[1] - a[1]) * t - nz * 0.12;
          const gy = opts.groundAt(px, pz);
          T.box(px, (gy + top) / 2, pz, 0.14, top - gy, 0.14, yaw, trim);
        }
        // deck, handrail and a slatted balustrade panel on both faces
        T.span(a[0], a[1], c[0], c[1], floorY - 0.08, 0.16, d, -nx, -nz, 0, 0x8b7b66);
        T.span(a[0], a[1], c[0], c[1], floorY + 0.95, 0.07, 0.09, -nx, -nz, 0.08, trim);
        const ix = -nx * 0.12, iz = -nz * 0.12;
        const slats = Math.max(1, Math.round(len / 1.2));
        W.quad(a[0] + ix, a[1] + iz, c[0] + ix, c[1] + iz, floorY, floorY + 0.92, nx, nz, slats, 0, 0.77, trim, L.battens);
        W.quad(c[0] + ix * 1.2, c[1] + iz * 1.2, a[0] + ix * 1.2, a[1] + iz * 1.2, floorY, floorY + 0.92, -nx, -nz, slats, 0, 0.77, trim, L.battens);
        stats.verandahs++;
      }
      roofOut.house(pts, top, b.rf ?? 2, ccw, st === ST.queenslander ? 0.5 : 0.4, HOUSE_PITCH, W, paint);
      stats.pitched++;
      continue;
    }

    // ---- everything else: ground floor, upper floors, parapet
    const tall = top - ys;
    let groundH = 4.2, parapet = 0.9, floorH = 3.4;
    let up = L.punched, gr = L.punched, front = null;
    switch (st) {
      case ST.glass:
        up = glassLayer; gr = L.lobby; front = L.lobby; groundH = 5.0; parapet = 0.7; floorH = 3.7; paint = paint || 0xe3e7ea;
        break;
      case ST.office:
        up = brick ? L.brickPunched : L.office; gr = L.lobby; front = L.lobby; groundH = 4.5; parapet = 1.0; floorH = 3.6;
        break;
      case ST.residential:
        if (tall >= 22) { up = L.balcony; gr = L.lobby; front = L.lobby; floorH = 3.1; }
        else { up = brick ? L.brickPunched : L.punched; gr = up; floorH = 3.1; }
        groundH = tall >= 22 ? 4.2 : 3.1; parapet = 0.9;
        break;
      case ST.heritage:
        up = brick ? L.brickPunched : L.heritageWin; gr = up; front = L.heritageGround; groundH = 4.4; parapet = 1.2; floorH = 4.0;
        break;
      case ST.shopfront:
        up = brick ? L.brickPunched : L.punched; gr = L.plain; front = L.shopGround; groundH = 4.2; parapet = 1.0; floorH = 3.4;
        break;
      case ST.industrial:
        up = L.industrial; gr = L.industrial; groundH = tall; parapet = 0.4; floorH = tall;
        break;
      case ST.church:
        up = L.church; gr = L.church; groundH = tall; parapet = 0; floorH = tall;
        break;
      case ST.parking:
        up = L.parking; gr = L.parking; groundH = 3.0; parapet = 0; floorH = 3.0;
        break;
      case ST.shed:
        up = L.shed; gr = L.shed; groundH = tall; parapet = 0; floorH = 4.0;
        break;
      default:
        up = brick ? L.brickPunched : L.punched; gr = up; front = retailish ? L.shopGround : null; groundH = 3.6; parapet = 0.8; floorH = 3.3;
    }
    if (upper != null) up = upper;
    if (groundL != null) { gr = groundL; front = groundL; }
    if (b.lv >= 2 && st !== ST.industrial && st !== ST.church && st !== ST.shed) {
      const span = top - parapet - (ys + groundH);
      if (span > 2) floorH = Math.min(5, Math.max(2.6, span / Math.max(1, b.lv - 1)));
    }
    const bands = [];
    const yG = ys + groundH;
    const yP = top - parapet;
    if (st === ST.church || st === ST.shed || st === ST.industrial) {
      bands.push([yb, yP, up, ys, Math.max(3, yP - ys)]);
    } else if (yP - yG < 1.5) {
      bands.push([yb, Math.max(yb + 0.5, yP), gr, ys, Math.max(2.6, yP - ys), true]);
    } else {
      bands.push([yb, yG, gr, ys, groundH, true]);
      const nf = Math.max(1, Math.round((yP - yG) / floorH));
      bands.push([yG, yP, up, yG, (yP - yG) / nf]);
    }
    if (parapet > 0.05 && top > yP + 0.05) bands.push([Math.max(yb, yP), top, L.plain, yP, 4]);
    const fe = b.fe;
    // 130 Queen Street. The level-1 burger tenancy opens onto the mall edge.
    // The street-level glass under it stays. The door is only the upper opening.
    const queenTenancy = Math.hypot(cx - 133.67, cz - 69.17) < 2;
    const doorLow = ys + 3.35;
    const doorHigh = ys + 6.25;
    const piece = (ax, az, bx, bz, y0, y1, nx, nz, layer) => {
      if (y1 - y0 < 0.04) return;
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.08) return;
      const bays = Math.max(1, Math.round(len / BAY[layer]));
      W.quad(ax, az, bx, bz, y0, y1, nx, nz, bays, 0, 1, paint, layer);
    };
    for (let i = 0; i < n; i++) {
      const a = pts[i], c = pts[(i + 1) % n];
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (len < 0.05) continue;
      const [nx, nz] = edgeNormal(a, c, ccw);
      const midX = (a[0] + c[0]) / 2, midZ = (a[1] + c[1]) / 2;
      const queenDoor = queenTenancy && len > 16 && len < 21 && Math.hypot(midX - 144.3, midZ - 87.55) < 1.4;
      for (const [y0, y1, layer0, vOrg, vH, isGround] of bands) {
        if (y1 - y0 < 0.02) continue;
        let layer = isGround && front != null && i === fe ? front : layer0;
        if (len < BAY[layer] * 0.7 && PLAIN_OF[layer] != null) layer = PLAIN_OF[layer];
        if (!queenDoor) {
          const bays = Math.max(1, Math.round(len / BAY[layer]));
          W.quad(a[0], a[1], c[0], c[1], y0, y1, nx, nz, bays, (y0 - vOrg) / vH, (y1 - vOrg) / vH, paint, layer);
          continue;
        }
        const gap = 2.7;
        const t0 = 0.5 - gap / (2 * len);
        const t1 = 0.5 + gap / (2 * len);
        const lx = a[0] + (c[0] - a[0]) * t0, lz = a[1] + (c[1] - a[1]) * t0;
        const rx = a[0] + (c[0] - a[0]) * t1, rz = a[1] + (c[1] - a[1]) * t1;
        const lo = Math.max(y0, doorLow);
        const hi = Math.min(y1, doorHigh);
        if (y0 < lo - 0.02) piece(a[0], a[1], c[0], c[1], y0, Math.min(y1, lo), nx, nz, layer);
        if (hi - lo > 0.05) {
          piece(a[0], a[1], lx, lz, lo, hi, nx, nz, layer);
          piece(rx, rz, c[0], c[1], lo, hi, nx, nz, layer);
        }
        if (y1 > hi + 0.02) piece(a[0], a[1], c[0], c[1], Math.max(y0, hi), y1, nx, nz, layer);
      }
    }
    // Shop awning over the footpath on the street front. The mall has its own fronts.
    if ((st === ST.shopfront || (st === ST.heritage && retailish)) && fe != null && fe < n && !(nearMall && nearMall(cx, cz) < 18)) {
      const a = pts[fe], c = pts[(fe + 1) % n];
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (len > 3 && top - ys > 4) {
        const [nx, nz] = edgeNormal(a, c, ccw);
        const ay = ys + 3.55;
        T.span(a[0], a[1], c[0], c[1], ay, 0.16, 2.7, nx, nz, 0.02, 0xdcdedf);
        T.span(a[0], a[1], c[0], c[1], ay + 0.05, 0.42, 0.08, nx, nz, 2.7, (h0 >>> 6) % 2 ? 0x3c4247 : 0xf0efe9);
        stats.awnings++;
      }
    }
    const rf = b.rf ?? 0;
    if (rf && rf !== 5 && (n === 4 || (convex(pts) && n <= 8)) && st !== ST.glass && st !== ST.office) {
      roofOut.house(pts, top, rf, ccw, st === ST.church ? 0.25 : 0.3, st === ST.church ? Math.tan(40 * Math.PI / 180) : Math.tan(18 * Math.PI / 180), W, paint);
      stats.pitched++;
    } else {
      roofOut.flat(b.r, top + 0.01);
    }
  }

  const group = new THREE.Group();
  group.userData.abs = true;
  for (const buf of walls.values()) {
    const m = buf.mesh(wallMat);
    if (m) group.add(m);
  }
  for (const buf of trims.values()) {
    const m = buf.mesh(trimMat);
    if (m) group.add(m);
  }
  return { group, stats, wallMat };
}

// Roof surfaces in world coordinates; the caller drapes the orthophoto over them.
export function roofCollector() {
  const photo = [];
  const plain = [];
  function flat(flatRing, y, under) {
    const tri = triangulateRing(flatRing);
    if (!tri) return;
    for (const f of tri.faces) {
      for (const k of f) photo.push(tri.contour[k].x, y + 0.02, tri.contour[k].y);
      if (under != null) for (let q = 2; q >= 0; q--) plain.push(tri.contour[f[q]].x, under, tri.contour[f[q]].y);
    }
  }
  // Hip, gable, pyramid and skillion roofs over the footprint with an eave overhang.
  function house(pts, top, rf, ccw, eave, pitch, W, paint) {
    const n = pts.length;
    if (n === 4 && rf !== 3) {
      const o = obb(pts);
      const Lx = o.L + eave, Wz = o.W + eave;
      const rise = Math.min(4.5, Math.max(0.8, o.W * pitch));
      const P = (u, v, y) => [o.cx + o.ux * u + o.vx * v, y, o.cz + o.uz * u + o.vz * v];
      const y0 = top - 0.05;
      const yr = top + rise;
      const c00 = P(-Lx, -Wz, y0), c10 = P(Lx, -Wz, y0), c11 = P(Lx, Wz, y0), c01 = P(-Lx, Wz, y0);
      const push = (...tris) => { for (const t of tris) photo.push(...t); };
      if (rf === 4) {
        const hi0 = P(-Lx, Wz, top + Math.max(0.5, o.W * 2 * Math.tan(8 * Math.PI / 180)));
        const hi1 = P(Lx, Wz, hi0[1]);
        push(c00, c10, hi1, c00, hi1, hi0);
        // the raised side and the two triangular ends are wall
        W.quad(c01[0], c01[2], c11[0], c11[2], y0, hi0[1], o.vx, o.vz, 1, 0, 0.2, paint, L.plain);
        W.tri(c00, c01, hi0, -o.ux, 0, -o.uz, [0, 0, 1, 0, 1, 0.2], paint, L.plain);
        W.tri(c10, c11, hi1, o.ux, 0, o.uz, [0, 0, 1, 0, 1, 0.2], paint, L.plain);
        return;
      }
      if (rf === 1) {
        const r0 = P(-Lx, 0, yr), r1 = P(Lx, 0, yr);
        push(c00, c10, r1, c00, r1, r0, c01, r0, r1, c01, r1, c11);
        const g0 = P(-o.L, -o.W, y0), g1 = P(-o.L, o.W, y0), gr0 = P(-o.L, 0, yr - 0.02);
        const g2 = P(o.L, -o.W, y0), g3 = P(o.L, o.W, y0), gr1 = P(o.L, 0, yr - 0.02);
        W.tri(g0, g1, gr0, -o.ux, 0, -o.uz, [0, 0, 1, 0, 0.5, 0.4], paint, L.plain);
        W.tri(g2, g3, gr1, o.ux, 0, o.uz, [0, 0, 1, 0, 0.5, 0.4], paint, L.plain);
        return;
      }
      const ridge = Math.max(0, Lx - Wz);
      const r0 = P(-ridge, 0, yr), r1 = P(ridge, 0, yr);
      push(c00, c10, r1, c00, r1, r0, c01, r0, r1, c01, r1, c11, c00, r0, c01, c10, c11, r1);
      return;
    }
    // pyramid to the centroid over the offset ring
    const ring = offsetRing(pts, eave, ccw);
    let cx = 0, cz = 0;
    for (const p of pts) { cx += p[0]; cz += p[1]; }
    cx /= n; cz /= n;
    const o = obb(pts);
    const rise = Math.min(4, Math.max(0.9, o.W * pitch));
    const y0 = top - 0.05;
    for (let i = 0; i < n; i++) {
      const a = ring[i], c = ring[(i + 1) % n];
      photo.push(a[0], y0, a[1], c[0], y0, c[1], cx, top + rise, cz);
    }
  }
  return { flat, house, photo, plain };
}
