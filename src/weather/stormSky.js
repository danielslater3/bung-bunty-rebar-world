import * as THREE from 'three';
import { rng } from '../core/utils.js';

// The sky and funnel share a filtered, seamless density field. No screen-space
// speckles or precision-sensitive sine hashes in either shader.
export function stormNoise() {
  const size = 128, data = new Uint8Array(size * size), rand = rng(51319);
  for (let y = 0; y < size; y += 8) for (let x = 0; x < size; x += 8)
    data[y * size + x] = 255 * rand();
  const smooth = t => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (x % 8 === 0 && y % 8 === 0) continue;
    const x0 = x - x % 8, y0 = y - y % 8, x1 = (x0 + 8) % size, y1 = (y0 + 8) % size;
    const a = smooth((x - x0) / 8), b = smooth((y - y0) / 8);
    const top = THREE.MathUtils.lerp(data[y0 * size + x0], data[y0 * size + x1], a);
    const bottom = THREE.MathUtils.lerp(data[y1 * size + x0], data[y1 * size + x1], a);
    data[y * size + x] = THREE.MathUtils.lerp(top, bottom, b);
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RedFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function createStormSky(noise) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1,-1,0, 3,-1,0, -1,3,0], 3));
  const material = new THREE.ShaderMaterial({
    depthWrite: false,
    extensions: { shaderTextureLOD: true },
    uniforms: {
      noiseMap: { value: noise },
      inverseProjection: { value: new THREE.Matrix4() },
      cameraWorld: { value: new THREE.Matrix4() },
      centre: { value: new THREE.Vector2() },
      heading: { value: new THREE.Vector2(1, 0) },
      skyColor: { value: new THREE.Color() },
      coverage: { value: 0 },
      shape: { value: 0 },
      clock: { value: 0 },
      flash: { value: 0 },
    },
    vertexShader: `
      uniform mat4 inverseProjection, cameraWorld;
      varying vec3 worldRay;
      void main() {
        vec4 view = inverseProjection * vec4(position.xy, 1., 1.);
        worldRay = mat3(cameraWorld) * view.xyz;
        gl_Position = vec4(position.xy, 1., 1.);
      }
    `,
    fragmentShader: `
      uniform sampler2D noiseMap;
      uniform vec2 centre, heading;
      uniform vec3 skyColor;
      uniform float coverage, shape, clock, flash;
      varying vec3 worldRay;
      float field(vec2 uv) {
        return .57 * texture2DLodEXT(noiseMap, uv, 0.).r
             + .29 * texture2DLodEXT(noiseMap, uv * 2.11 + .31, 0.).r
             + .14 * texture2DLodEXT(noiseMap, uv * 4.31 - .14, 1.).r;
      }
      vec4 cloud(vec3 p, float region) {
        vec2 rel = p.xz - centre;
        vec2 local = vec2(dot(rel, heading), dot(rel, vec2(-heading.y, heading.x)));
        float h = p.y;
        float wide = mix(790., 1310., shape);
        float cross = local.y / wide;
        // The leading edge bows outward and lifts into a broad anvil.
        float edge = local.x - (850. - cross * cross * 640.);
        float shelf = exp(-abs(edge + (h - 235.) * 1.2) / 295. - abs(cross) * 1.23);
        float turret = exp(-length(vec2((local.x + 125.) / 1260., cross)) * 1.29);
        float anvil = exp(-length(vec2((local.x - 400.) / 2150., local.y / 1500.)) * 1.39);
        vec2 drift = vec2(clock * .00021 + shape * 3.17, -clock * .00014);
        float n = field(local / 1740. + vec2(h * .00139, h * -.0008) + drift);
        float curls = field(vec2(edge * .00084 + h * .0021, cross * .48 + h * .0011) + drift);
        float lower = shelf * smoothstep(105., 225., h + (curls - .48) * 165.) * (1. - smoothstep(350., 580., h));
        float upper = anvil * smoothstep(450., 820., h) * (1. - smoothstep(1120., 1460., h + (n - .5) * 450.));
        float tower = turret * smoothstep(160., 340., h) * (1. - smoothstep(820., 1360., h + (n - .55) * 610.));
        float form = (lower * 1.19 + upper * .96 + tower * 1.25) * coverage;
        float density = smoothstep(.09, .54, form * (.48 + .91 * n + .42 * curls)) * region;
        float bright = clamp((h - 185.) / 1030. * .68 + (n - .39) * .65 + (curls - .40) * .43, 0., 1.);
        vec3 colour = mix(vec3(.018,.025,.035), vec3(.34,.40,.47), bright);
        return vec4(colour + vec3(.32,.36,.49) * flash, density);
      }
      void main() {
        vec3 ray = normalize(worldRay);
        float elevation = max(ray.y, 0.);
        vec3 base = mix(skyColor * .73 + vec3(.16,.17,.16), skyColor * .72, pow(elevation, .5));
        vec4 integrated = vec4(0.);
        if (ray.y > .008) {
          // The lowest layer forms the visible rolling shelf. Sample more
          // densely at its base and cap the ray before the distant city horizon.
          float start = max(0., (115. - cameraPosition.y) / ray.y);
          float end = min(4300., (1470. - cameraPosition.y) / ray.y);
          if (end > start) {
            for (int i = 0; i < 9; i++) {
              float t = (float(i) + .5) / 9.;
              float d = mix(start, end, t * t);
              vec3 p = cameraPosition + ray * d;
              float distanceFade = 1. - smoothstep(2550., 4300., d);
              vec4 layer = cloud(p, distanceFade);
              float a = layer.a * .76;
              integrated.rgb += layer.rgb * a * (1. - integrated.a);
              integrated.a += a * (1. - integrated.a);
              if (integrated.a > .985) break;
            }
          }
        }
        gl_FragColor = vec4(integrated.rgb + base * (1. - integrated.a), 1.);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  // Fill the uncovered background after opaque city geometry has written depth.
  mesh.renderOrder = 1000;
  mesh.frustumCulled = false;
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    material.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
    material.uniforms.cameraWorld.value.copy(camera.matrixWorld);
  };
  return mesh;
}

function funnelNoise() {
  const size = 32, cells = 8, rand = rng(927134);
  const lattice = Float32Array.from({ length: cells ** 3 }, () => rand());
  const data = new Uint8Array(size ** 3);
  const sample = (x, y, z) => lattice[((z % cells) * cells + y % cells) * cells + x % cells];
  const mix = THREE.MathUtils.lerp;
  const ease = t => t * t * (3 - 2 * t);
  for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const ix = x >> 2, iy = y >> 2, iz = z >> 2;
    const u = ease(x % 4 / 4), v = ease(y % 4 / 4), w = ease(z % 4 / 4);
    const slice = zz => mix(mix(sample(ix, iy, zz), sample(ix + 1, iy, zz), u),
      mix(sample(ix, iy + 1, zz), sample(ix + 1, iy + 1, zz), u), v);
    data[(z * size + y) * size + x] = Math.round(255 * mix(slice(iz), slice(iz + 1), w));
  }
  const map = new THREE.Data3DTexture(data, size, size, size);
  map.format = THREE.RedFormat;
  map.wrapS = map.wrapT = map.wrapR = THREE.RepeatWrapping;
  map.minFilter = map.magFilter = THREE.LinearFilter;
  map.needsUpdate = true;
  return map;
}

// Ray-integrated condensation inside a proxy box. The visible surface is the
// density field, so the funnel can be a rope or a wedge without mesh rings.
export function createFunnel() {
  const noise = funnelNoise();
  const material = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    extensions: { fragDepth: true, shaderTextureLOD: true },
    uniforms: {
      noiseMap: { value: noise }, eye: { value: new THREE.Vector3() },
      localToClip: { value: new THREE.Matrix4() },
      time: { value: 0 }, reach: { value: 0 }, density: { value: 0 },
      flash: { value: 0 }, wedge: { value: 0 },
    },
    vertexShader: `
      varying vec3 sampleRay;
      void main() {
        sampleRay = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }
    `,
    fragmentShader: `
      uniform highp sampler3D noiseMap;
      uniform vec3 eye;
      uniform mat4 localToClip;
      uniform float time, reach, density, flash, wedge;
      varying vec3 sampleRay;
      void main() {
        vec3 ray = normalize(sampleRay - eye);
        vec3 inverse = 1. / (ray + vec3(.000001));
        vec3 lo = (vec3(-2., 0., -2.) - eye) * inverse;
        vec3 hi = (vec3( 2., 1.,  2.) - eye) * inverse;
        vec3 enter = min(lo, hi), leave = max(lo, hi);
        float start = max(0., max(enter.x, max(enter.y, enter.z)));
        float end = min(leave.x, min(leave.y, leave.z));
        if (end <= start) discard;
        float stepSize = (end - start) / 18.;
        vec4 integrated = vec4(0.);
        float front = -1.;
        for (int i = 0; i < 18; i++) {
          float distance = start + (float(i) + .5) * stepSize;
          vec3 p = eye + ray * distance;
          float h = (p.y - (1. - reach)) / max(.04, reach);
          if (h < 0. || h > 1.) continue;
          vec2 bend = vec2(sin(h * 4.9 + time * .29), cos(h * 5.3 + time * .25)) * h * mix(.30,.14,wedge);
          vec2 rel = p.xz - bend;
          float angle = -time * (.41 + .18 * (1. - h)) + h * 2.2;
          float radius = mix(.16 + pow(h, 1.12) * 1.54, .76 + pow(h, .8) * .93, wedge);
          vec2 spin = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * rel;
          vec3 uv = vec3(spin.x * .39, h * .73 - time * .031, spin.y * .39);
          float n = .68 * texture(noiseMap, uv).r + .24 * texture(noiseMap, uv * 2.17 + .21).r
                  + .08 * texture(noiseMap, uv * 3.8 - .32).r;
          float wall = 1. - smoothstep(.49, 1.04, length(rel) / (radius * (.69 + n * .56)));
          float taper = smoothstep(0., .075, h) * (1. - smoothstep(.82, 1., h));
          float optical = wall * taper * smoothstep(.22, .77, n) * density;
          float a = 1. - exp(-optical * stepSize * (4.1 + wedge * 3.2));
          if (front < 0. && a > .035) front = distance;
          float daylight = clamp(n * .82 + rel.x / max(.2,radius) * .23 + h * .14, 0., 1.);
          vec3 base = mix(vec3(.018,.025,.032), vec3(.28,.32,.36), daylight * daylight);
          base = mix(base, vec3(.19,.15,.118), (1.-smoothstep(.04,.52,h)) * (.23 + wedge*.26));
          integrated.rgb += (base + flash * .24) * a * (1. - integrated.a);
          integrated.a += a * (1. - integrated.a);
          if (integrated.a > .98) break;
        }
        if (front < 0. || integrated.a < .025) discard;
        vec4 clip = localToClip * vec4(eye + ray * front, 1.);
        gl_FragDepthEXT = clamp(clip.z / clip.w * .5 + .5, 0., 1.);
        gl_FragColor = vec4(integrated.rgb / integrated.a, integrated.a);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 4).translate(0, .5, 0), material);
  mesh.renderOrder = 3;
  mesh.userData.dispose = () => noise.dispose();
  const inverse = new THREE.Matrix4();
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    material.uniforms.eye.value.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(inverse.copy(mesh.matrixWorld).invert());
    material.uniforms.localToClip.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(mesh.matrixWorld);
  };
  return mesh;
}
