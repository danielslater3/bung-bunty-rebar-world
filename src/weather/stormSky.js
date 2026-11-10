import * as THREE from 'three';
import { rng } from '../core/utils.js';

// Render the moving cell into a bounded-resolution buffer and composite it
// behind opaque city geometry. Camera motion changes the rays through the
// world-space volume, including when the camera is directly under the cell.
export function createStormSky() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1,-1,0, 3,-1,0, -1,3,0], 3));
  const target = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
  });
  const noise = volumeNoise(64, 51319);
  const uniforms = {
    noiseMap: { value: noise },
    inverseProjection: { value: new THREE.Matrix4() },
    cameraWorld: { value: new THREE.Matrix4() },
    eye: { value: new THREE.Vector3() },
    centre: { value: new THREE.Vector2() },
    heading: { value: new THREE.Vector2(1, 0) },
    wall: { value: new THREE.Vector3() },
    skyColor: { value: new THREE.Color() },
    strike: { value: new THREE.Vector3() },
    coverage: { value: 0 },
    supercell: { value: 0 },
    shape: { value: 0 },
    clock: { value: 0 },
    flash: { value: 0 },
  };
  const volume = new THREE.ShaderMaterial({
    uniforms, depthWrite: false, depthTest: false, toneMapped: false,
    vertexShader: `
      uniform mat4 inverseProjection, cameraWorld;
      varying vec3 worldRay;
      void main() {
        vec4 view = inverseProjection * vec4(position.xy, 1., 1.);
        worldRay = mat3(cameraWorld) * view.xyz;
        gl_Position = vec4(position.xy, 0., 1.);
      }
    `,
    fragmentShader: `
      uniform highp sampler3D noiseMap;
      uniform vec3 eye, skyColor, wall, strike;
      uniform vec2 centre, heading;
      uniform float coverage, supercell, shape, clock, flash;
      varying vec3 worldRay;

      vec3 stormSpace(vec3 world) {
        vec2 p = world.xz - centre;
        return vec3(dot(p, heading), world.y, dot(p, vec2(-heading.y, heading.x)));
      }

      float lobe(vec3 p, vec3 center, vec3 radii) {
        return 1. - length((p - center) / radii);
      }

      float join(float a, float b) {
        return max(a, b) + .09 * pow(max(0., 1. - abs(a - b) / .36), 2.);
      }

      float envelope(vec3 p, vec3 wallCentre) {
        float breadth = mix(.88, 1.2, shape);
        float height = mix(.72, 1. + shape * .25, supercell);
        vec3 tower = vec3(p.x - max(0., p.y - 420.) * .24, p.y, p.z);
        float body = lobe(tower, vec3(-280., 1350. * height, 0.), vec3(1800., 1140. * height, 1540. * breadth));
        float crown = lobe(tower, vec3(-550., 2250. * height, -180.), vec3(1020., 730. * height, 1000. * breadth));
        float anvil = lobe(p, vec3(1120., 2480. * height, -120.), vec3(4650., 420. * height, 2110. * breadth));
        float flank = lobe(p, vec3(-1690., 760., -310.), vec3(1780., 590., 850. * breadth));
        float apron = lobe(p, vec3(560., 570., 20.), vec3(2190., 400., 1370. * breadth));

        // Bowed leading shelf, with its ends swept back and distinct rolls.
        float across = p.z / (2020. * breadth);
        float front = 1720. - 1170. * across * across;
        float shelf = lobe(vec3(p.x - front, p.y, p.z),
          vec3(0., 398. + across * across * 90., 0.), vec3(870., 335., 2210. * breadth));
        float roll = lobe(vec3(p.x - front, p.y, p.z),
          vec3(260., 620., 0.), vec3(640., 263., 1960. * breadth));
        float lip = lobe(vec3(p.x - front, p.y, p.z),
          vec3(345., 790., 0.), vec3(460., 200., 1810. * breadth));

        float wallCloud = lobe(p, wallCentre, vec3(630., 245., 560.));
        float collar = lobe(p, wallCentre + vec3(-190., 190., 80.), vec3(930., 335., 770.));
        float base = join(join(join(shelf, roll), lip), join(apron, flank));
        return join(join(join(body, crown), anvil), join(base, join(wallCloud, collar) - (1. - supercell) * .68));
      }

      vec2 volumeDensity(vec3 p, vec3 wallCentre) {
        float form = envelope(p, wallCentre);
        float cloud = 0.;
        if (form > -.31) {
          // Advect noise in all three axes. Lower condensation rotates
          // around the wall cloud while the anvil streams downwind.
          vec3 q = p;
          vec2 rel = p.xz - wallCentre.xz;
          float spin = clock * .023 * (1. - smoothstep(250., 1500., length(rel)))
                       * (1. - smoothstep(340., 950., p.y)) * supercell;
          q.xz = wallCentre.xz + mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * rel;
          vec3 uv = q / vec3(2900., 2150., 2710.) + vec3(shape * 2.9 - clock * .0033, -clock * .0014, shape * 4.2);
          float broad = textureLod(noiseMap, uv, 0.).r;
          float billows = textureLod(noiseMap, uv * 2.17 + .27, 0.).r;
          float detail = textureLod(noiseMap, uv * 4.11 - .31, 0.).r;
          float boundary = form + (broad - .48) * .58 + (billows - .48) * .25 + (detail - .5) * .09;
          cloud = smoothstep(-.09, .54, boundary - (1. - coverage) * .56)
                * coverage * smoothstep(76., 140., p.y);
        }

        // Precipitation hangs below the forward flank and leaves a gap
        // under the rotating base. Vertical stretch gives a rain curtain.
        vec3 rain = (p - vec3(720. + p.y * .22, 250., -560.)) / vec3(1170., 460., 1010.);
        float shaft = max(0., 1. - length(rain));
        float rainVeil = 0.;
        if (shaft > 0.) {
          float streaks = textureLod(noiseMap, vec3(p.x * .0011 - clock * .011, p.y * .00007, p.z * .0016 + shape), 0.).r;
          rainVeil = shaft * shaft * (.32 + streaks * .73) * coverage;
        }
        return vec2(cloud, rainVeil);
      }

      void main() {
        vec3 view = normalize(worldRay);
        vec3 origin = stormSpace(eye);
        vec3 ray = stormSpace(eye + view) - origin;
        vec3 wallCentre = stormSpace(wall);
        vec3 light = normalize(vec3(.73, .49, -.46));
        vec3 inv = 1. / (ray + vec3(.000001));
        vec3 a = (vec3(-4750., -85., -3450.) - origin) * inv;
        vec3 b = (vec3( 6600., 4000., 3450.) - origin) * inv;
        vec3 enter = min(a, b), leave = max(a, b);
        float start = max(0., max(enter.x, max(enter.y, enter.z)));
        float end = min(15000., min(leave.x, min(leave.y, leave.z)));

        float elevation = max(view.y, 0.);
        vec3 horizon = mix(skyColor, vec3(.54,.63,.68), smoothstep(.03, .40, coverage));
        vec3 sky = mix(horizon, skyColor, smoothstep(-.10, .78, elevation));
        vec3 integrated = vec3(0.);
        float transmittance = 1.;
        if (end > start) {
          float distance = start;
          // Steps are short around the low shelf and lengthen on far rays.
          for (int i = 0; i < 48; i++) {
            float stepSize = min(end - distance, 53. + (distance - start) * .073);
            if (stepSize <= 0. || transmittance < .014) break;
            vec3 p = origin + ray * (distance + stepSize * .5);
            vec2 d = volumeDensity(p, wallCentre);
            if (d.x + d.y > .001) {
              float extinction = d.x * .0079 + d.y * .0018;
              float alpha = 1. - exp(-extinction * stepSize);
              float lit = 0., bounce = 0.;
              if (d.x > .025) {
                float shade = volumeDensity(p + light * 230., wallCentre).x;
                lit = exp(-(d.x * .61 + shade) * 4.1);
                // Diffuse light entering from the bright side of the shelf
                // keeps the rotating underside legible even in deep shade.
                float pattern = textureLod(noiseMap, p / vec3(2150., 1230., 1880.) +
                  vec3(-clock * .0041, clock * .0009, shape * 3.), 0.).r;
                bounce = smoothstep(.23, .81, pattern) * (.17 + .13 * (1. - shade));
              }
              float high = smoothstep(230., 2950., p.y);
              float edge = clamp(lit * (1. - .34 * d.x) + high * .20 + bounce, 0., 1.);
              vec3 cloudLight = mix(vec3(.045,.054,.071), vec3(.68,.69,.70), edge);
              cloudLight *= mix(.57, 1.06, high);
              vec3 rainLight = vec3(.24,.285,.33) * (1. - .30 * coverage);
              vec3 lightAt = mix(rainLight, cloudLight, d.x / max(.001, d.x + d.y * .36));
              if (flash > .001) {
                float range = length(p - strike);
                lightAt += vec3(.34,.42,.66) * flash * exp(-range / 660.);
              }
              float aerial = 1. - exp(-max(0., distance - 450.) / 13000.);
              lightAt = mix(lightAt, sky, aerial * .55);
              integrated += lightAt * (alpha * transmittance);
              transmittance *= 1. - alpha;
            }
            distance += stepSize;
          }
        }
        // Use more of the 8-bit buffer's precision in the storm's shadows.
        gl_FragColor = vec4(sqrt(max(vec3(0.), integrated + sky * transmittance)), 1.);
      }
    `,
  });
  const pass = new THREE.Mesh(geometry, volume);
  pass.frustumCulled = false;
  const volumeScene = new THREE.Scene();
  volumeScene.add(pass);
  const passCamera = new THREE.Camera();
  const material = new THREE.ShaderMaterial({
    depthWrite: false, toneMapped: false,
    uniforms: { cloudFrame: { value: target.texture } },
    vertexShader: `
      varying vec2 screenUv;
      void main() {
        screenUv = position.xy * .5 + .5;
        gl_Position = vec4(position.xy, 1., 1.);
      }
    `,
    fragmentShader: `
      uniform sampler2D cloudFrame;
      varying vec2 screenUv;
      void main() {
        vec3 cloud = texture2D(cloudFrame, screenUv).rgb;
        gl_FragColor = vec4(cloud * cloud, 1.);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 1000;
  mesh.frustumCulled = false;
  const size = new THREE.Vector2();
  mesh.userData.storm = uniforms;
  mesh.userData.renderVolume = (renderer, camera) => {
    const previous = renderer.getRenderTarget();
    const cubeFace = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
    if (previous) size.set(previous.width, previous.height);
    else renderer.getDrawingBufferSize(size);
    const scale = Math.min(.53, 690 / size.x, 410 / size.y);
    target.setSize(Math.max(1, Math.round(size.x * scale)), Math.max(1, Math.round(size.y * scale)));
    uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
    uniforms.cameraWorld.value.copy(camera.matrixWorld);
    uniforms.eye.value.setFromMatrixPosition(camera.matrixWorld);
    try {
      renderer.setRenderTarget(target);
      renderer.render(volumeScene, passCamera);
    } finally {
      renderer.setRenderTarget(previous, cubeFace, mip);
    }
  };
  mesh.userData.dispose = () => { target.dispose(); noise.dispose(); volume.dispose(); };
  return mesh;
}

function volumeNoise(size, seed) {
  const cellSize = 4, cells = size / cellSize, rand = rng(seed);
  const lattice = Float32Array.from({ length: cells ** 3 }, () => rand());
  const data = new Uint8Array(size ** 3);
  const sample = (x, y, z) => lattice[((z % cells) * cells + y % cells) * cells + x % cells];
  const mix = THREE.MathUtils.lerp;
  const ease = t => t * t * (3 - 2 * t);
  for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const ix = Math.floor(x / cellSize), iy = Math.floor(y / cellSize), iz = Math.floor(z / cellSize);
    const u = ease(x % cellSize / cellSize), v = ease(y % cellSize / cellSize), w = ease(z % cellSize / cellSize);
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
  const noise = volumeNoise(32, 927134);
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
