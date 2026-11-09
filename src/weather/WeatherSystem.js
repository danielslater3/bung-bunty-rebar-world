import * as THREE from 'three';
import { moveHorizontal, positionClear } from '../core/motion.js';
import { rng } from '../core/utils.js';
import { state } from '../core/state.js';
import { conditionsAt, hashWeather, vortexAt, weatherAt } from './model.js';

const UP = new THREE.Vector3(0, 1, 0);
const ceiling = 156;
const SOLO_SEED = hashWeather('brisbane-rebar-campaign-v1');
const damageSites = [
  [-1914, 1040], [-195, 790], [-239, 385], [50, 95], [173, 81.5],
  [458, 121], [614, 886], [937, 277], [1434, 1306],
];
const CLOUDS = [
  [-500, -180, 197, 675], [-260, -340, 202, 760], [-70, 30, 188, 810],
  [180, -190, 224, 950], [460, 135, 238, 1000], [22, 335, 192, 710],
  [-460, 275, 166, 790], [-125, -25, 320, 930], [195, 65, 375, 1030],
  [368, -65, 443, 1250], [700, -270, 480, 1200], [1020, 60, 486, 1390],
];
const mix = THREE.MathUtils.lerp;

function cloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d'), random = rng(7401);
  for (let i = 0; i < 66; i++) {
    const a = random() * Math.PI * 2, d = Math.sqrt(random());
    const x = 128 + Math.cos(a) * d * 88, y = 128 + Math.sin(a) * d * 61;
    const r = 17 + random() * 43;
    const grad = ctx.createRadialGradient(x, y, r * .10, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,.36)');
    grad.addColorStop(.49, 'rgba(255,255,255,.19)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  return new THREE.CanvasTexture(canvas);
}

function funnelMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      time: { value: 0 }, reach: { value: 0 }, density: { value: 0 }, flash: { value: 0 },
    },
    vertexShader: `
      uniform float time, reach;
      varying vec2 vUv;
      varying vec3 vNorm, vView;
      void main() {
        vUv=uv;
        vec3 p=position;
        float h=uv.y;
        float swirl=sin(uv.x*37.699+time*2.0-h*15.);
        float width=(.28+pow(h,.82)*1.5)*(.96+.07*swirl+.07*sin(time*.83+h*20.));
        p.xz*=width;
        p.x+=sin(h*6.4+time*.45)*h*.52;
        p.z+=cos(h*5.2+time*.37)*h*.37;
        p.y=mix(1.-reach,1.,h);
        vec4 view=modelViewMatrix*vec4(p,1.);
        vNorm=normalize(normalMatrix*normal);
        vView=normalize(-view.xyz);
        gl_Position=projectionMatrix*view;
      }
    `,
    fragmentShader: `
      uniform float time,density,flash;
      varying vec2 vUv;
      varying vec3 vNorm,vView;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){
        vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
      }
      void main(){
        float a=vUv.x*6.28318-time*(1.42+.8*(1.-vUv.y));
        vec2 p=vec2(cos(a),sin(a))*3.9+vec2(vUv.y*4.4,-vUv.y*11.);
        float n=.65*noise(p)+.25*noise(p*2.1+time*.35)+.10*noise(p*4.2);
        float ribbon=.5+.5*sin(a*3.+vUv.y*23.+n*4.);
        float edge=pow(abs(dot(normalize(vNorm),normalize(vView))),.54);
        float ends=smoothstep(.0,.06,vUv.y)*(1.-smoothstep(.86,1.,vUv.y));
        vec3 col=mix(vec3(.09,.10,.12),vec3(.29,.34,.38),smoothstep(.19,.8,n)*.86+ribbon*.11);
        col=mix(col,vec3(.52,.44,.33),.44*(1.-smoothstep(.02,.32,vUv.y)));
        gl_FragColor=vec4(col+flash*.23,edge*ends*density*(.65+.34*n));
        #include <colorspace_fragment>
      }
    `,
  });
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
    this.base = { sky: scene.background.clone(), fog: scene.fog.clone(), sun: zone.sun.intensity };
    this.cloudMap = cloudTexture();
    this.clouds = Array.from({ length: CLOUDS.length + 5 }, (_, i) => {
      const m = new THREE.SpriteMaterial({ map: this.cloudMap, depthWrite: false, transparent: true, fog: false });
      const cloud = new THREE.Sprite(m);
      cloud.renderOrder = -2 - i * .001;
      this.root.add(cloud);
      return cloud;
    });
    this.funnel = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 52, 28, true).translate(0, .5, 0), funnelMaterial());
    this.funnel.frustumCulled = false;
    this.funnel.renderOrder = 3;
    this.root.add(this.funnel);
    this.dust = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.cloudMap, color: 0x938373, transparent: true, depthWrite: false, fog: false }));
    this.dust.renderOrder = 4;
    this.root.add(this.dust);
    this.vortexMist = Array.from({ length: 7 }, () => {
      const mist = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.cloudMap, color: 0x8b969f, transparent: true, depthWrite: false, fog: false,
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

    const bolt = new THREE.BufferGeometry();
    bolt.setAttribute('position', new THREE.BufferAttribute(new Float32Array(32 * 6), 3));
    this.bolt = new THREE.LineSegments(bolt, new THREE.LineBasicMaterial({ color: 0xe4ebff, transparent: true, depthWrite: false, fog: false }));
    this.bolt.frustumCulled = false;
    this.root.add(this.bolt);
    this.light = new THREE.PointLight(0xbad9ff, 0, 470, 1.5);
    this.root.add(this.light);
    this.fragments = new THREE.InstancedMesh(new THREE.BoxGeometry(.78, .06, .38),
      new THREE.MeshStandardMaterial({ color: 0xc1c5c7, roughness: .92 }), 180);
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
    this.throwX = 0;
    this.throwZ = 0;
    this.flash = 0;
    this.thunder = [];
    this.strikeId = null;
    this.exposed = true;
  }

  detach() {
    if (this.root) {
      this.root.removeFromParent();
      this.root.traverse(object => {
        object.geometry?.dispose();
        object.material?.dispose();
        if (object.isInstancedMesh) object.dispose();
      });
      this.cloudMap.dispose();
      this.damageAssets.forEach(asset => asset.dispose());
      this.game.scene.background.copy(this.base.sky);
      const fog = this.game.scene.fog;
      fog.color.copy(this.base.fog.color);
      fog.near = this.base.fog.near;
      fog.far = this.base.fog.far;
      this.zone.sun.intensity = this.base.sun;
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
    this.drawVortex(f, c, p);
    this.audio(dt, running ? (c.rain * .55 + (f.tornado?.ground && Math.hypot(f.tornado.x - p.x, f.tornado.z - p.z) < 250 ? .4 : 0)) * (this.exposed ? 1 : .20) : 0);
    const arena = room?.arena, fighting = arena?.players.includes(g.multiplayer.client.id) &&
      ['playing', 'countdown'].includes(arena.phase);
    if (running && !fighting && !g.saga.freeze && !g.saga.scenePlaying && !g.dialogue.cinematic && this.exposed)
      this.applyWind(dt, f, c, p);
  }

  drawAtmosphere(f, c, p) {
    const scene = this.game.scene;
    const overcast = THREE.MathUtils.clamp(f.core * .52 + c.rain * .44, 0, .96);
    const night = !!this.game.saga.venues?.nightBackup;
    if (!night) {
      const sky = this.stormSky ||= new THREE.Color(0x374352);
      scene.background.copy(this.base.sky).lerp(sky, overcast);
      scene.fog.color.copy(this.base.fog.color).lerp(sky, overcast);
      scene.fog.near = mix(this.base.fog.near, 45, c.rain);
      scene.fog.far = mix(this.base.fog.far, 530, Math.min(.95, c.rain));
      this.zone.sun.intensity = this.base.sun * (1 - overcast * .69) + this.flash * (this.reduceFlash ? .04 : .3);
    }
    for (const [i, cloud] of this.clouds.entries()) {
      const storm = i < CLOUDS.length;
      if (storm) {
        const [x, z, y, w] = CLOUDS[i];
        cloud.position.set(f.x + x, y - f.core * 28, f.z + z);
        cloud.scale.set(w, w * (i < 7 ? .30 : .49), 1);
        cloud.material.color.setHex(i < 7 ? 0x475360 : 0x96a3ad);
        cloud.material.opacity = f.core * (i < 7 ? .87 : .73);
      } else {
        const j = i - CLOUDS.length;
        cloud.position.set(p.x + Math.sin(j * 1.26 + f.time * .006) * 1250, 510 + 45 * j, p.z + Math.cos(j * 1.26 + f.time * .006) * 1250);
        cloud.scale.set(540 + j * 74, 205 + 11 * j, 1);
        cloud.material.color.setHex(0xffffff);
        cloud.material.opacity = .72 - overcast * .61;
      }
      cloud.visible = !night && cloud.material.opacity > .015;
    }
    const visible = this.exposed && c.rain > .055;
    this.rain.visible = visible;
    this.splashes.visible = visible;
    if (!visible) return;
    const count = Math.floor(130 + c.rain * 1220);
    const ox = this.game.camera.position.x, oz = this.game.camera.position.z;
    const oy = this.game.camera.position.y;
    for (let i = 0; i < count; i++) {
      const d = this.drops[i], k = i * 6;
      const fall = (d[1] + f.time * .59) % 1, y = oy + 22 - fall * 38;
      const x = ox + d[0] * 26 + c.windX * fall * .4, z = oz + d[2] * 26 + c.windZ * fall * .4;
      this.streaks[k] = x;
      this.streaks[k+1] = y;
      this.streaks[k+2] = z;
      this.streaks[k+3] = x - c.windX * .038;
      this.streaks[k+4] = y + .58 + d[1] * .55;
      this.streaks[k+5] = z - c.windZ * .038;
    }
    this.rain.geometry.setDrawRange(0, count * 2);
    this.rain.geometry.attributes.position.needsUpdate = true;
    this.rain.material.opacity = Math.min(.54, c.rain * .8);
    let splashes = 0;
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
    }
    this.splashes.count = splashes;
    this.splashes.material.opacity = .27 + c.rain * .27;
    this.splashes.instanceMatrix.needsUpdate = true;
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
      this.funnel.scale.set(t.core * .64, h, t.core * .64);
      const u = this.funnel.material.uniforms;
      u.time.value = f.time;
      u.reach.value = .10 + .9 * t.touchdown;
      u.density.value = Math.min(.94, .30 + t.strength * .62);
      u.flash.value = this.reduceFlash ? 0 : this.flash;
      this.dust.position.set(t.x, ground + 11, t.z);
      this.dust.scale.set(t.core * 3.7, t.core * 1.18, 1);
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
        const total = 42 + t.tier * 11;
        for (let i = 0; i < total; i++) {
          const life = (f.time * (.25 + i % 4 * .025) + i * .398) % 1;
          const a = i * 2.39996 + f.time * (2.1 + 2.7 * (1 - life));
          const r = t.core * (.37 + life * 1.5 + (i % 7) * .045);
          this.addFragment(count++, t.x + Math.cos(a) * r, ground + 1 + life ** 1.32 * h * .76,
            t.z + Math.sin(a) * r, a, .65 + (i % 4) * .47);
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

  drill(enabled) {
    if (this.game.multiplayer.active || !this.zone) return;
    this.exercise = enabled ? { tier: 2, track: 0, time: 96 } : null;
    this.thunder.length = 0;
    this.strikeId = null;
    this.flash = 0;
  }

  addFragment(i, x, y, z, angle, scale, down = false) {
    if (i >= this.fragments.instanceMatrix.count) return;
    this.dummy.position.set(x, y, z);
    this.dummy.rotation.set(down ? 0 : angle * .72, angle, down ? .10 : angle * 1.4);
    this.dummy.scale.setScalar(scale);
    this.dummy.updateMatrix();
    this.fragments.setMatrixAt(i, this.dummy.matrix);
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
      if (p.y - ground < 45) actor.vel.y = Math.min(23, Math.max(-2, actor.vel.y) + (23 + v.lift) * dt);
      actor.grounded = false;
      state.stability = Math.max(18, state.stability - dt * (2 + t.tier));
      if (f.time - this.caughtSince > 2.1 + t.tier * .11) {
        const a = Math.atan2(p.z - t.z, p.x - t.x) - .8;
        const speed = 18 + t.tier * 2.1;
        this.throwX = Math.cos(a) * speed;
        this.throwZ = Math.sin(a) * speed;
        this.throwUntil = f.time + 3.6;
        actor.vel.y = Math.max(actor.vel.y, 8 + t.tier);
        if (!this.reduceFlash) g.shake(.18, .32);
      }
    }

    const throwing = Math.max(0, (this.throwUntil - f.time) / 3.6);
    if (!v && !push && !throwing) return;
    const target = trolley.riding ? trolley.pos : p;
    const vortexWeight = throwing ? .20 : 1;
    // Airborne players orbit the moving column as well as its local centre.
    const carry = caught && !trolley.riding && p.y > ground + .8 ? 1 : 0;
    moveHorizontal(target, ((v?.x || 0) * vortexWeight + f.vx * carry + c.windX * push * .13 + this.throwX * throwing) * dt,
      ((v?.z || 0) * vortexWeight + f.vz * carry + c.windZ * push * .13 + this.throwZ * throwing) * dt,
      trolley.riding ? .8 : actor.radius, this.zone);
    if (trolley.riding) { trolley.mesh.position.copy(target); actor.pos.copy(target); }
    actor.mesh.position.copy(actor.pos);
  }
}
