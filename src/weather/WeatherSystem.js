import * as THREE from 'three';
import { moveHorizontal, positionClear } from '../core/motion.js';
import { rng } from '../core/utils.js';
import { state } from '../core/state.js';
import { conditionsAt, hashWeather, vortexAt, weatherAt } from './model.js';
import { createFunnel, createStormSky } from './stormSky.js';
import { StormDamage } from './stormDamage.js';

const UP = new THREE.Vector3(0, 1, 0);
const ceiling = 156;
const SOLO_SEED = hashWeather('brisbane-rebar-campaign-v1');
const damageSites = [
  [-1914, 1040], [-195, 790], [-239, 385], [50, 95], [173, 81.5],
  [458, 121], [614, 886], [937, 277], [1434, 1306],
];
const mix = THREE.MathUtils.lerp;

function cloudOpacityTexture() {
  // Upload opacity only. Canvas gradients can introduce RGB dithering on
  // upload, which becomes visible inside translucent clouds on some GPUs.
  const size = 256, mask = new Float32Array(size * size), random = rng(7401);
  for (let i = 0; i < 66; i++) {
    const a = random() * Math.PI * 2, d = Math.sqrt(random());
    const cx = size / 2 + Math.cos(a) * d * 88, cy = size / 2 + Math.sin(a) * d * 61;
    const r = 17 + random() * 43;
    for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(size, Math.ceil(cy + r)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(size, Math.ceil(cx + r)); x++) {
        const t = Math.max(0, 1 - Math.hypot(x + .5 - cx, y + .5 - cy) / r);
        const at = y * size + x;
        mask[at] += (1 - mask[at]) * .36 * t * t * (3 - 2 * t);
      }
    }
  }
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const at = y * size + x;
    const edge = Math.min(1, x / 12, y / 12, (size - 1 - x) / 12, (size - 1 - y) / 12);
    const opacity = Math.round(mask[at] * edge * 255);
    pixels[at * 4] = pixels[at * 4 + 1] = pixels[at * 4 + 2] = opacity;
    pixels[at * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export class WeatherSystem {
  constructor(game) {
    this.game = game;
    this.seed = SOLO_SEED;
    this.time = 0;
    this.frame = weatherAt(this.seed, 0);
    this.conditions = conditionsAt(this.frame, 0, 0);
    this.reduceFlash = matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      const saved = localStorage.getItem('bung-s24-flashes');
      if (saved != null) this.reduceFlash = saved === 'true';
    } catch {}
    this.up = new THREE.Vector3();
    this.launchOrigin = new THREE.Vector3();
    this.launchDirection = new THREE.Vector3();
    this.sampleIn = 0;
  }

  attach(zone) {
    this.detach();
    if (!zone.terrain || zone.name !== 'brisbane') return;
    if (!Number.isFinite(state.brisbaneWeatherTime) || state.brisbaneWeatherTime < 0) state.brisbaneWeatherTime = 0;
    this.zone = zone;
    this.root = new THREE.Group();
    this.root.name = 'Brisbane weather';
    zone.group.add(this.root);
    const scene = this.game.scene;
    this.hemi = zone.group.children.find(child => child.isHemisphereLight);
    this.base = { sky: scene.background.clone(), fog: scene.fog.clone(), sun: zone.sun.intensity, hemi: this.hemi?.intensity };
    this.sky = createStormSky();
    this.root.add(this.sky);
    this.stormDamage = new StormDamage(zone);
    this.cloudOpacity = cloudOpacityTexture();
    this.clouds = Array.from({ length: 5 }, (_, i) => {
      const m = new THREE.SpriteMaterial({ alphaMap: this.cloudOpacity, depthWrite: false, transparent: true, fog: false });
      const cloud = new THREE.Sprite(m);
      cloud.renderOrder = -2 - i * .001;
      this.root.add(cloud);
      return cloud;
    });
    this.funnel = createFunnel();
    this.funnel.frustumCulled = false;
    this.funnel.renderOrder = 3;
    this.root.add(this.funnel);
    this.dust = new THREE.Sprite(new THREE.SpriteMaterial({ alphaMap: this.cloudOpacity, color: 0x938373, transparent: true, depthWrite: false, fog: false }));
    this.dust.renderOrder = 4;
    this.root.add(this.dust);
    this.vortexMist = Array.from({ length: 7 }, () => {
      const mist = new THREE.Sprite(new THREE.SpriteMaterial({
        alphaMap: this.cloudOpacity, color: 0x8b969f, transparent: true, depthWrite: false, fog: false,
      }));
      mist.renderOrder = 4;
      this.root.add(mist);
      return mist;
    });

    const rain = new THREE.BufferGeometry(), random = rng(9057);
    this.drops = Array.from({ length: 1350 }, () => [random() * 2 - 1, random(), random() * 2 - 1]);
    this.streaks = new Float32Array(this.drops.length * 6);
    rain.setAttribute('position', new THREE.BufferAttribute(this.streaks, 3).setUsage(THREE.DynamicDrawUsage));
    this.rain = new THREE.LineSegments(rain, new THREE.LineBasicMaterial({
      color: 0xc5e7fb, transparent: true, opacity: 0, depthWrite: false,
    }));
    this.rain.frustumCulled = false;
    this.rain.renderOrder = 5;
    this.root.add(this.rain);
    this.splashSeeds = Array.from({ length: 52 }, () => [random() * 2 - 1, random() * 2 - 1, random()]);
    const splashGeo = new THREE.RingGeometry(.67, 1, 9);
    splashGeo.rotateX(-Math.PI / 2);
    this.splashes = new THREE.InstancedMesh(splashGeo, new THREE.MeshBasicMaterial({
      color: 0xc1dcec, transparent: true, depthWrite: false, opacity: .3,
    }), this.splashSeeds.length);
    this.splashes.frustumCulled = false;
    this.root.add(this.splashes);
    this.hailstones = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial({ color: 0xdce9ef }), this.splashSeeds.length);
    this.hailstones.frustumCulled = false;
    this.root.add(this.hailstones);

    const bolt = new THREE.BufferGeometry();
    bolt.setAttribute('position', new THREE.BufferAttribute(new Float32Array(32 * 6), 3));
    this.bolt = new THREE.LineSegments(bolt, new THREE.LineBasicMaterial({ color: 0xe4ebff, transparent: true, depthWrite: false, fog: false }));
    this.bolt.frustumCulled = false;
    this.root.add(this.bolt);
    this.light = new THREE.PointLight(0xbad9ff, 0, 470, 1.5);
    this.root.add(this.light);
    this.fragments = new THREE.InstancedMesh(new THREE.BoxGeometry(.78, .06, .38),
      new THREE.MeshStandardMaterial({ color: 0xc1c5c7, roughness: .92 }), 320);
    this.fragments.frustumCulled = false;
    this.root.add(this.fragments);
    this.dummy = new THREE.Object3D();
    const steel = new THREE.MeshStandardMaterial({ color: 0x485e66, roughness: .74, metalness: .35 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0xeca03f, roughness: .87, side: THREE.DoubleSide });
    const poleGeo = new THREE.CylinderGeometry(.035, .07, 2.8, 7);
    const flagGeo = new THREE.PlaneGeometry(.93, .49, 5, 1);
    this.damage = [];
    for (const [x0,z0] of damageSites) {
      const place = [[5,3],[-5,3],[3,-6],[-3,-6],[7,-1]].map(([dx,dz]) => ({
        x:x0+dx, z:z0+dz, y: zone.terrain.walkAt(x0+dx,z0+dz),
      })).find(p => !zone.terrain.isWater(p.x,p.z) && positionClear(p, .8, zone));
      if (!place) continue;
      const mast = new THREE.Group();
      const pole = new THREE.Mesh(poleGeo, steel);
      pole.position.y = 1.4;
      const flag = new THREE.Mesh(flagGeo, cloth);
      flag.position.set(.49, 2.48, 0);
      mast.add(pole, flag);
      mast.position.set(place.x, place.y, place.z);
      this.root.add(mast);
      this.damage.push({ ...place, mast, flag, until: 0 });
    }
    this.damageAssets = [steel, cloth, poleGeo, flagGeo];
    const palette = [0x674534, 0x9c724c, 0x697b88, 0xc18e54, 0x837060, 0x756358];
    for (let i = 0; i < this.fragments.instanceMatrix.count; i++)
      this.fragments.setColorAt(i, new THREE.Color(palette[i % palette.length]));
    this.damageKey = null;
    this.damageTime = -Infinity;
    this.caughtSince = null;
    this.throwUntil = -Infinity;
    this.throwDuration = 1;
    this.throwX = 0;
    this.throwZ = 0;
    this.flash = 0;
    this.thunder = [];
    this.strikeId = null;
    this.exposed = true;
  }

  detach() {
    if (this.root) {
      this.stormDamage.clear();
      this.root.removeFromParent();
      this.root.traverse(object => {
        object.userData.dispose?.();
        object.geometry?.dispose();
        object.material?.dispose();
        if (object.isInstancedMesh) object.dispose();
      });
      this.cloudOpacity.dispose();
      this.damageAssets.forEach(asset => asset.dispose());
      this.game.scene.background.copy(this.base.sky);
      const fog = this.game.scene.fog;
      fog.color.copy(this.base.fog.color);
      fog.near = this.base.fog.near;
      fog.far = this.base.fog.far;
      this.zone.sun.intensity = this.base.sun;
      if (this.hemi) this.hemi.intensity = this.base.hemi;
    }
    this.root = null;
    this.zone = null;
    this.exercise = null;
    this.stopWind();
  }

  stopWind() {
    if (!this.wind) return;
    this.wind.source.stop();
    this.wind.source.disconnect();
    this.wind.filter.disconnect();
    this.wind.gain.disconnect();
    this.wind = null;
  }

  audio(dt, strength) {
    const audio = this.game.audio, ctx = audio.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (!this.wind && strength > .03) {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buf.getChannelData(0), r = rng(923);
      let value = 0;
      for (let i = 0; i < data.length; i++) { value = value * .87 + (r() * 2 - 1) * .13; data[i] = value; }
      const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
      source.buffer = buf;
      source.loop = true;
      filter.type = 'lowpass';
      gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(audio.sfxGain);
      source.start();
      this.wind = { source, filter, gain };
    }
    if (this.wind) {
      this.wind.filter.frequency.value = 360 + strength * 2300;
      this.wind.gain.gain.value = mix(this.wind.gain.gain.value, strength * .24, 1 - Math.exp(-dt * 3));
    }
  }

  update(dt) {
    if (!this.zone) return;
    const g = this.game, p = g.player.pos, room = g.multiplayer.active && g.multiplayer.room;
    const running = g.mode === 'playing' || g.mode === 'cutscene';
    if (!room && running && !this.exercise) state.brisbaneWeatherTime += dt;
    this.seed = room ? hashWeather(room.code) : SOLO_SEED;
    this.time = this.exercise ? this.exercise.time += running ? dt : 0 : room
      ? Math.max(0, (g.multiplayer.client.now() - room.created) / 1000) : state.brisbaneWeatherTime;
    const f = this.frame = weatherAt(this.seed, this.time, this.exercise);
    const c = this.conditions = conditionsAt(f, p.x, p.z);
    this.sampleIn -= dt;
    if (this.sampleIn <= 0) {
      this.up.copy(p);
      this.up.y += 1.55;
      this.exposed = !g.indoorCeiling(p.x, p.y + 1, p.z) && g.cameraClearance(this.up, UP, 7) >= 6.95;
      this.sampleIn = .25;
    }
    this.drawAtmosphere(f, c, p);
    if (running) this.drawLightning(dt, f, p);
    this.stormDamage.update(f, this.seed, this.exercise);
    if (running) this.stormDamage.vehicles(dt, f, p);
    this.drawVortex(f, c, p);
    this.audio(dt, running ? (c.rain * .55 + (f.tornado?.ground && Math.hypot(f.tornado.x - p.x, f.tornado.z - p.z) < 250 ? .4 : 0)) * (this.exposed ? 1 : .20) : 0);
    const arena = room?.arena, fighting = arena?.players.includes(g.multiplayer.client.id) &&
      ['playing', 'countdown'].includes(arena.phase);
    const barkKey = this.seed + '/' + f.cycle + '/' + !!this.exercise;
    if (g.mode === 'playing' && !g.phone.opened && !g.dialogue.current && !fighting && this.exposed &&
      c.rain > .5 && (f.mode === 'supercell' || f.mode === 'storm') && this.singletBark !== barkKey) {
      this.singletBark = barkKey;
      g.say('bung', 'OIII! The singlet is not weatherproof!');
    }
    if (running && !fighting && !g.saga.freeze && !g.saga.scenePlaying && !g.dialogue.cinematic && this.exposed)
      this.applyWind(dt, f, c, p);
    else this.caughtSince = null;
  }

  renderSky(renderer, camera) {
    if (this.zone && this.sky.visible) this.sky.userData.renderVolume(renderer, camera);
  }

  drawAtmosphere(f, c, p) {
    const scene = this.game.scene;
    const storm = f.mode === 'storm' || f.mode === 'supercell';
    const overcast = THREE.MathUtils.clamp(f.core * (storm ? .7 : .52) + c.rain * .39, 0, .96);
    const night = !!this.game.saga.venues?.nightBackup;
    if (!night) {
      const sky = this.stormSky ||= new THREE.Color(0x374352);
      scene.background.copy(this.base.sky).lerp(sky, overcast);
      scene.fog.color.copy(this.base.fog.color).lerp(sky, overcast);
      scene.fog.near = mix(this.base.fog.near, 45, c.rain);
      scene.fog.far = mix(this.base.fog.far, 530, Math.min(.95, c.rain));
      this.zone.sun.intensity = this.base.sun * (1 - overcast * .69) + this.flash * (this.reduceFlash ? .04 : .3);
      if (this.hemi) this.hemi.intensity = this.base.hemi * (1 - overcast * .46);
    }
    this.sky.visible = !night && storm && f.core > .025;
    if (this.sky.visible) {
      const u = this.sky.userData.storm;
      u.centre.value.set(f.x, f.z);
      u.heading.value.set(f.vx, f.vz).normalize();
      u.skyColor.value.copy(this.base.sky).lerp(scene.background, .38);
      u.supercell.value = f.mode === 'supercell' ? 1 : 0;
      u.shape.value = f.shape;
      u.coverage.value = Math.min(1, f.core * (u.supercell.value ? 1.34 : 1.17));
      u.clock.value = f.time % 3600;
      u.flash.value = this.reduceFlash ? 0 : this.flash * .40;
      u.strike.value.copy(this.light.position);
      u.strike.value.y += 270;
      const t = f.tornado;
      u.wall.value.set(t?.x ?? f.x - f.vx * 11, t ? Math.max(ceiling, t.height) + 126 : 420,
        t?.z ?? f.z - f.vz * 11);
    }
    for (const [i, cloud] of this.clouds.entries()) {
      cloud.position.set(p.x + Math.sin(i * 1.26 + f.time * .006) * 1250, 510 + 45 * i, p.z + Math.cos(i * 1.26 + f.time * .006) * 1250);
      cloud.scale.set(540 + i * 74, 205 + 11 * i, 1);
      const fade = this.sky.visible ? Math.max(0, 1 - f.core / .24) : 1;
      cloud.material.opacity = (.55 - overcast * .36) * fade;
      cloud.visible = !night && fade > 0;
    }
    const visible = this.exposed && c.rain > .055;
    const hail = visible && f.hail > 0 && c.rain > .42;
    this.rain.visible = visible;
    this.splashes.visible = visible;
    this.hailstones.visible = hail;
    if (!visible) return;
    const count = Math.floor(130 + c.rain * 1220);
    const ox = this.game.camera.position.x, oz = this.game.camera.position.z;
    const oy = this.game.camera.position.y;
    for (let i = 0; i < count; i++) {
      const d = this.drops[i], k = i * 6;
      const ice = hail && i % 4 === 0;
      const fall = (d[1] + f.time * (ice ? .97 : .59)) % 1, y = oy + 22 - fall * 38;
      const x = ox + d[0] * 26 + c.windX * fall * .4, z = oz + d[2] * 26 + c.windZ * fall * .4;
      this.streaks[k] = x;
      this.streaks[k+1] = y;
      this.streaks[k+2] = z;
      this.streaks[k+3] = x - c.windX * (ice ? .013 : .038);
      this.streaks[k+4] = y + (ice ? .12 + f.hail * .0025 : .58 + d[1] * .55);
      this.streaks[k+5] = z - c.windZ * (ice ? .013 : .038);
    }
    this.rain.geometry.setDrawRange(0, count * 2);
    this.rain.geometry.attributes.position.needsUpdate = true;
    this.rain.material.opacity = Math.min(.54, c.rain * .8);
    let splashes = 0, hailstones = 0;
    const area = Math.floor(8 + c.rain * 40);
    for (let i = 0; i < area; i++) {
      const [sx, sz, seed] = this.splashSeeds[i];
      const phase = (f.time * 1.75 + seed) % 1;
      if (phase > .64) continue;
      const x = p.x + sx * 14, z = p.z + sz * 14;
      const y = this.zone.groundAt(x, z, p.y);
      if (Math.abs(y - p.y) > 3) continue;
      this.dummy.position.set(x, y + .075, z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.setScalar(.035 + phase * .27);
      this.dummy.updateMatrix();
      this.splashes.setMatrixAt(splashes++, this.dummy.matrix);
      if (hail && phase < .39) {
        const bounce = Math.sin(phase / .39 * Math.PI) * (.15 + f.hail * .004);
        this.dummy.position.set(x + phase * .9, y + .04 + bounce, z);
        this.dummy.scale.setScalar(.023 + f.hail * .00073);
        this.dummy.updateMatrix();
        this.hailstones.setMatrixAt(hailstones++, this.dummy.matrix);
      }
    }
    this.splashes.count = splashes;
    this.splashes.material.opacity = .27 + c.rain * .27;
    this.splashes.instanceMatrix.needsUpdate = true;
    if (hail) {
      this.hailstones.count = hailstones;
      this.hailstones.instanceMatrix.needsUpdate = true;
    }
  }

  drawLightning(dt, f, p) {
    const strike = f.lightning;
    if (strike && f.time >= strike.time && f.time - strike.time < .8 && this.strikeId !== strike.id) {
      this.strikeId = strike.id;
      this.flash = 1;
      const y = this.zone.groundAt(strike.x, strike.z);
      const r = rng(strike.id + this.seed);
      const array = this.bolt.geometry.attributes.position.array;
      let k = 0, ax = strike.x, az = strike.z, ay = y;
      for (let i = 1; i <= 13; i++) {
        const x = strike.x + (r() - .5) * i * 5, z = strike.z + (r() - .5) * i * 5, h = y + i * 19;
        array.set([ax, ay, az, x, h, z], k);
        k += 6;
        if (i % 3 === 0) { array.set([x, h, z, x + (r() - .5) * 100, h - 38, z + (r() - .5) * 70], k); k += 6; }
        ax = x; ay = h; az = z;
      }
      this.bolt.geometry.setDrawRange(0, k / 3);
      this.bolt.geometry.attributes.position.needsUpdate = true;
      this.light.position.set(strike.x, y + 43, strike.z);
      const distance = Math.hypot(p.x - strike.x, p.z - strike.z);
      this.thunder.push({ at: f.time + Math.min(10, distance / 343), level: Math.max(.15, 1 - distance / 2300) });
    }
    this.flash *= Math.exp(-dt * 9);
    this.bolt.visible = !this.reduceFlash && this.flash > .13;
    this.bolt.material.opacity = this.flash;
    this.light.intensity = this.reduceFlash ? 0 : this.flash * 2200;
    for (let i = this.thunder.length - 1; i >= 0; i--) {
      const hit = this.thunder[i];
      if (f.time < hit.at) continue;
      const audio = this.game.audio;
      if (audio.ctx) {
        const t = audio.ctx.currentTime, volume = hit.level * (this.exposed ? 1 : .35);
        audio._noise(audio.sfxGain, t, 2.35, 83, .24 * volume);
        audio._note(audio.sfxGain, 68, t, 1.25, 'sine', .09 * volume, -23);
      }
      this.thunder.splice(i, 1);
    }
  }

  drawVortex(f, c, p) {
    const t = f.tornado;
    this.funnel.visible = !!t;
    this.dust.visible = !!t?.ground;
    for (const mist of this.vortexMist) mist.visible = !!t;
    let count = 0;
    if (t) {
      const ground = this.zone.terrain.walkAt(t.x, t.z);
      const h = Math.max(ceiling, t.height);
      this.funnel.position.set(t.x, ground + 1, t.z);
      const width = t.core * (t.tier === 5 ? 1.08 : .72);
      this.funnel.scale.set(width, h, width);
      const u = this.funnel.material.uniforms;
      u.time.value = f.time % 3600;
      u.reach.value = Math.min(1, .10 + 1.08 * t.touchdown);
      u.density.value = Math.min(1, .20 + t.strength * (.66 + t.tier * .04));
      u.wedge.value = Math.max(0, (t.tier - 1) / 4);
      u.flash.value = this.reduceFlash ? 0 : this.flash;
      this.dust.position.set(t.x, ground + 7 + t.tier * 3, t.z);
      this.dust.scale.set(t.core * (2.9 + t.tier * .28), t.core * (1 + t.tier * .13), 1);
      this.dust.material.color.setHex(this.zone.terrain.isWater(t.x, t.z) ? 0xa5b7bf : 0x938373);
      this.dust.material.opacity = t.strength * .88;
      for (const [i, mist] of this.vortexMist.entries()) {
        const fraction = (f.time * .135 + i / this.vortexMist.length) % 1;
        const angle = f.time * (1.5 - fraction * .75) + i * 2.39996;
        const radius = t.core * (.31 + fraction * .79);
        const y = ground + h * (1 - u.reach.value * (1 - fraction));
        mist.position.set(t.x + Math.cos(angle) * radius, y, t.z + Math.sin(angle) * radius);
        mist.scale.set(t.core * (.7 + fraction * 1.9), t.core * (.3 + fraction * .46), 1);
        mist.material.opacity = f.strength * Math.sin(fraction * Math.PI) * .28;
      }
      if (t.ground && Math.hypot(t.x - p.x, t.z - p.z) < 650) {
        const total = 21 + t.tier * 22;
        for (let i = 0; i < total; i++) {
          const life = (f.time * (.25 + i % 4 * .025) + i * .398) % 1;
          const a = i * 2.39996 + f.time * (2.1 + 2.7 * (1 - life));
          const r = t.core * (.37 + life * 1.5 + (i % 7) * .045);
          this.addFragment(count++, t.x + Math.cos(a) * r, ground + 1 + life ** 1.32 * h * .76,
            t.z + Math.sin(a) * r, a, .42 + (i % 4) * (.29 + t.tier * .13));
        }
      }
    }
    if (this.exposed && c.gust > 36 && c.rain > .30) {
      const gustCount = Math.min(20, Math.floor((c.gust - 36) * 1.2));
      for (let i = 0; i < gustCount; i++) {
        const phase = (f.time * .32 + i * .39) % 1;
        const x = p.x + Math.cos(i * 2.4) * 28 + (phase - .5) * c.windX * 2.7;
        const z = p.z + Math.sin(i * 2.4) * 28 + (phase - .5) * c.windZ * 2.7;
        const y = this.zone.groundAt(x, z, p.y) + .5 + Math.sin(phase * Math.PI) * (1.4 + i % 5);
        this.addFragment(count++, x, y, z, f.time * 5.4 + i, .46 + (i % 3) * .3);
      }
    }
    this.restoreDamage(f);
    for (const site of this.damage) {
      const close = Math.hypot(site.x - p.x, site.z - p.z) < 340;
      site.mast.visible = close;
      if (!close) continue;
      const damaged = site.until > f.time;
      const wind = conditionsAt(f, site.x, site.z);
      site.mast.rotation.set(damaged ? .66 : .05 * Math.sin(f.time * 2 + site.z), Math.atan2(wind.windX, wind.windZ), damaged ? 1.12 : .035);
      site.flag.rotation.y = Math.sin(f.time * (4 + wind.gust / 7) + site.x) * .35;
      if (!damaged) continue;
      for (let i = 0; i < 6; i++) {
        const angle = i * 2.39996, radius = 2 + i * 1.35;
        const x = site.x + Math.cos(angle) * radius, z = site.z + Math.sin(angle) * radius;
        this.addFragment(count++, x, this.zone.groundAt(x, z) + .15, z, angle, 1.7, true);
      }
    }
    for (const { building, amount, hit } of this.stormDamage.active.values()) {
      if (count >= this.fragments.instanceMatrix.count - 5) break;
      if (amount < .15 || Math.hypot(p.x - building.x, p.z - building.z) > 400) continue;
      const fall = Math.max(0, 1 - (f.time - hit) / 3.4);
      for (let i = 0; i < 5; i++) {
        const a = i * 2.39996 + building.x * .018;
        const r = 2 + (i % 3) * 2.2;
        const x = building.x + Math.cos(a) * r, z = building.z + Math.sin(a) * r;
        const y = building.ground + .5 + fall * fall * (building.top - building.ground) * (.18 + i * .13);
        this.addFragment(count++, x, y, z, a + fall * 9, 1 + i * amount * 2, !fall);
      }
    }
    this.fragments.count = count;
    this.fragments.visible = count > 0;
    this.fragments.instanceMatrix.needsUpdate = true;
  }

  restoreDamage(f) {
    const key = this.seed + '/' + (this.exercise?.tier ?? 'natural');
    const time = Math.floor(f.time);
    if (key === this.damageKey && time === this.damageTime) return;
    const backfill = key !== this.damageKey || time < this.damageTime || time - this.damageTime > 4;
    const start = backfill ? Math.max(0, time - 116) : this.damageTime + 1;
    if (backfill) for (const site of this.damage) site.until = 0;
    this.damageKey = key;
    this.damageTime = time;
    for (let i = start; i <= time; i++) {
      const t = weatherAt(this.seed, i, this.exercise).tornado;
      if (!t?.ground) continue;
      for (const site of this.damage) {
        if (Math.hypot(t.x - site.x, t.z - site.z) < t.core * 1.55)
          site.until = i + 75 + t.tier * 8;
      }
    }
  }

  drill(enabled, tier = 2) {
    if (this.game.multiplayer.active || !this.zone) return;
    this.exercise = enabled ? { tier, track: 0, time: 96 } : null;
    this.thunder.length = 0;
    this.strikeId = null;
    this.flash = 0;
    this.throwUntil = -Infinity;
    this.caughtSince = null;
    this.singletBark = null;
    this.update(0);
  }

  addFragment(i, x, y, z, angle, scale, down = false) {
    if (i >= this.fragments.instanceMatrix.count) return;
    this.dummy.position.set(x, y, z);
    this.dummy.rotation.set(down ? 0 : angle * .72, angle, down ? .10 : angle * 1.4);
    this.dummy.scale.setScalar(scale);
    this.dummy.updateMatrix();
    this.fragments.setMatrixAt(i, this.dummy.matrix);
  }

  launchAngle(p, t) {
    const tangent = Math.atan2(p.z - t.z, p.x - t.x) - .82;
    if (t.tier < 4) return tangent;
    this.launchOrigin.copy(p);
    this.launchOrigin.y += 1.4;
    let best = 0, heading = tangent;
    const range = t.tier === 5 ? 230 : 110;
    for (const offset of [0, .35, -.35, .73, -.73, 1.12, -1.12]) {
      const angle = tangent + offset;
      this.launchDirection.set(Math.cos(angle), .14, Math.sin(angle)).normalize();
      const clear = this.game.cameraClearance(this.launchOrigin, this.launchDirection, range);
      const score = clear - Math.abs(offset) * 13;
      if (score > best) { best = score; heading = angle; }
      if (clear === range) break;
    }
    return heading;
  }

  applyWind(dt, f, c, p) {
    const g = this.game, actor = g.player, trolley = g.trolley;
    const ground = this.zone.groundAt(p.x, p.z, p.y);
    const t = f.tornado, v = vortexAt(t, p.x, p.z, p.y - ground);
    const push = Math.max(0, (c.gust - 37) / 31);
    const caught = v?.caught && f.time >= this.throwUntil;
    if (!caught) this.caughtSince = null;
    if (caught) {
      if (g.phone.opened) g.phone.close();
      if (trolley.riding) trolley.dismount();
      if (this.caughtSince == null) {
        this.caughtSince = f.time;
        if (g.multiplayer.active) g.multiplayer.error('VORTEX · you’ve been caught');
        else g.toast('VORTEX · you’ve been caught', 'red');
      }
    }

    if (caught && !trolley.riding) {
      actor.grappling = false;
      actor.grappleLine.visible = false;
      if (p.y - ground < 24 + 11 * t.tier)
        actor.vel.y = Math.min(10 + 5 * t.tier, Math.max(-2, actor.vel.y) + (25 + v.lift) * dt);
      actor.grounded = false;
      if (state.stability > 18) state.stability = Math.max(18, state.stability - dt * (2 + t.tier));
      if (f.time - this.caughtSince > 1.45 + t.tier * .22) {
        const a = this.launchAngle(p, t);
        const speed = g.multiplayer.active ? Math.min(34, t.toss) : t.toss;
        this.throwDuration = t.duration;
        this.throwX = Math.cos(a) * speed;
        this.throwZ = Math.sin(a) * speed;
        this.throwUntil = f.time + this.throwDuration;
        actor.vel.y = Math.max(actor.vel.y, 6 + t.tier * 5);
        if (!this.reduceFlash) g.shake(.18, .32);
      }
    }

    const throwing = Math.max(0, (this.throwUntil - f.time) / this.throwDuration);
    if (!v && !push && !throwing) return;
    const target = trolley.riding ? trolley.pos : p;
    const vortexWeight = throwing ? .20 : 1;
    // Airborne players orbit the moving column as well as its local centre.
    const carry = caught && !trolley.riding && p.y > ground + .8 ? 1 : 0;
    let vx = (v?.x || 0) * vortexWeight + f.vx * carry + c.windX * push * .13 + this.throwX * throwing;
    let vz = (v?.z || 0) * vortexWeight + f.vz * carry + c.windZ * push * .13 + this.throwZ * throwing;
    if (g.multiplayer.active) {
      const cap = Math.min(1, 36 / Math.max(1, Math.hypot(vx, vz)));
      vx *= cap;
      vz *= cap;
    }
    const grid = g.geoBrisbane.grid;
    const dx = THREE.MathUtils.clamp(target.x + vx * dt, grid.minX + 3, grid.minX + grid.w * grid.cell - 3) - target.x;
    const dz = THREE.MathUtils.clamp(target.z + vz * dt, grid.minZ + 3, grid.minZ + grid.h * grid.cell - 3) - target.z;
    if (dx || dz) moveHorizontal(target, dx, dz, trolley.riding ? .8 : actor.radius, this.zone);
    if (trolley.riding) { trolley.mesh.position.copy(target); actor.pos.copy(target); }
    actor.mesh.position.copy(actor.pos);
  }
}
