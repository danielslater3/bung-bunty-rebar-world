// The Brisbane chronicle. Act I and Acts II–VI play on the existing map.
import * as THREE from 'three';
import { state, bus, SaveSystem } from '../core/state.js';
import { mat } from '../core/utils.js';
import { unlockArchive } from '../lore/universe.js?v=20261029a';
import { buildChing, buildGabor, buildScooter, setBungKit } from '../entities/models.js?v=20261029b';
import { ACTS, CHAPTERS, PLACE, CHASE_PATH, createSaga } from './sagaData.js?v=20261029b';
import { buildHouse } from './house.js?v=20261029v';
import { buildMcRebar, buildCollectorLawn } from './mcrebar.js?v=20261029q';
import { buildGuide, updateGuide } from './guide.js?v=20261029r';
import {
  bootMission, tickMission, poseMission, missionMarker, missionLabel, onInteract,
  closePlay, prepSnow, driftSnow,
} from './missions.js?v=20261029b';

export { createSaga, CHAPTERS, ACTS };

export class Saga {
  constructor(game) {
    this.game = game;
    this.scenePlaying = false;
    this.sceneLook = null;
    this._ui = 0;
    this._caughtLine = 0;
    this.gaborT = 0;
    this.guardAng = 0;
    this.dressed = false;
    this.mission = null;
    this.freeze = false;
    this._booted = '';
  }

  get on() { return !!state.saga?.active; }
  chapter() { return CHAPTERS[state.saga?.chapter] || null; }
  currentStep() {
    const ch = this.chapter();
    if (!ch?.playable || state.saga?.intermission) return null;
    return ch.steps[state.saga.step] || null;
  }

  onZone() {
    this.dressed = false;
    this.actors = null;
    this._groundWrapped = false;
    this._mansionBuilt = false;
    this._floors = null;
    this._snowPoints = null;
    this._booted = '';
    if (!this.on || this.game.zone?.name !== 'brisbane') return;
    this.dress();
  }

  normalize() {
    const s = state.saga;
    if (!s) return;
    if (!Array.isArray(s.evidence)) s.evidence = [];
    if (!Array.isArray(s.relics)) s.relics = [];
    if (!Array.isArray(s.done)) s.done = [];
    if (!s.stepState) s.stepState = {};
    if (s.fortune == null) s.fortune = 0;
    if (s.saves == null) s.saves = 0;
    if (s.phone == null) s.phone = 'intact';
    if (s.companion == null) s.companion = s.done.includes('ch5') || s.chapter > 4;
    if (s.mansion == null) s.mansion = s.done.includes('ch16') || s.chapter > 15;
    if (s.legend == null) s.legend = false;
  }

  resume(atStart) {
    if (!this.on || this.game.zone?.name !== 'brisbane') return;
    if (!this.dressed) this.dress();
    this.normalize();
    let jumped = false;
    if (state.saga.intermission && !state.saga.legend) {
      const ch = this.chapter();
      const next = CHAPTERS[state.saga.chapter + 1];
      if (next?.playable && state.saga.done.includes(ch?.id)) {
        state.saga.intermission = false;
        state.saga.chapter += 1;
        state.saga.step = 0;
        state.saga.stepState = {};
        jumped = true;
      }
    }
    this.syncDamage();
    if ((state.saga.mansion || state.saga.chapter >= 15) && !state.saga.intermission) this.ensureMansion();
    if ((atStart || jumped) && !state.saga.intermission) this.go(this.chapter()?.start || 'home');
    const step = this.currentStep();
    if (step?.kind === 'scene') this.beginScene(step);
    else {
      this.game.mode = 'playing';
      this.game.input.enabled = true;
      this.ensureStep();
    }
    this.syncKit();
    this.refresh();
    SaveSystem.save(this.game);
  }

  update(dt) {
    if (!this.on || this.game.zone?.name !== 'brisbane') return;
    driftSnow(this, dt);
    if (this.game.mode === 'cutscene') {
      if (this.actors?.guide) this.actors.guide.visible = false;
      this.aimCamera(dt);
      if (this.game.input.pressed['Escape']) this.game.dialogue.skip();
      return;
    }
    if (this.game.mode !== 'playing') return;
    this.syncKit();
    updateGuide(this);
    this.tickGarage(dt);
    this.tickPose(dt);
    if (state.saga.intermission) {
      this.poseActors();
      this.followCompanion(dt);
      return;
    }
    const step = this.currentStep();
    if (!step) return;
    if (step.kind === 'scene') { this.beginScene(step); return; }
    this.ensureStep();
    const before = state.saga.step;
    tickMission(this, dt);
    if (state.saga.step !== before || this.game.mode !== 'playing') {
      this.poseActors();
      this.followCompanion(dt);
      return;
    }
    const live = this.currentStep();
    if (!live) return;
    if (live.kind === 'follow' || live.kind === 'catch') this.moveGabor(dt, live);
    this.moveGuard(dt, live);
    this.check(live);
    this.poseActors();
    this.followCompanion(dt);
    this._ui += dt;
    if (this._ui > 0.45) { this._ui = 0; this.refresh(); }
  }

  ensureStep() {
    const step = this.currentStep();
    if (!step || step.kind === 'scene') return;
    const key = `${state.saga.chapter}:${state.saga.step}`;
    if (this._booted === key) return;
    this._booted = key;
    if (state.saga.chapter >= 15 || state.saga.mansion) this.ensureMansion();
    bootMission(this, step);
  }

  // ---------- world dressing ----------
  ground(x, z) {
    const h = this.game.zone.sampleGround?.(x, z, 40);
    return Number.isFinite(h) ? h : 6;
  }

  point(id) {
    const p = PLACE[id];
    if (!p) return this.game.player.pos.clone();
    return new THREE.Vector3(p.x, this.ground(p.x, p.z), p.z);
  }

  dress() {
    const Z = this.game.zone;
    const gy = (x, z) => this.ground(x, z);
    const home = PLACE.home;
    const house = buildHouse(this);
    const bar = buildMcRebar(this);
    buildCollectorLawn(this);
    const hy = house.y;
    const my = bar.y;
    const ey = gy(PLACE.event.x, PLACE.event.z);

    const rings = [];
    for (const id of ['ring1', 'ring2', 'ring3']) {
      const p = this.point(id);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.7, 0.1, 8, 18),
        mat(0xffc94d, { emissive: 0xffaa00, emissiveIntensity: 0.8, metalness: 0.7 })
      );
      ring.position.set(p.x, p.y + 1.6, p.z);
      ring.visible = false;
      Z.group.add(ring);
      rings.push(ring);
    }

    for (const n of Z.npcs) {
      if (n.kind === 'ching') {
        n.mesh.visible = false;
        if (n.marker) n.marker.visible = false;
      }
    }
    Z.interactables = Z.interactables.filter((it) => !String(it.label).includes('Talk to Chung'));

    const gabor = buildGabor();
    const scooter = buildScooter();
    Z.group.add(gabor);
    Z.group.add(scooter);
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 0.45), mat(0xc45a2a, { roughness: 0.6 }));
    Z.group.add(bag);
    const guard = buildGabor();
    guard.scale.setScalar(0.92);
    Z.group.add(guard);
    const marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28),
      new THREE.MeshBasicMaterial({ color: 0xffc02e })
    );
    Z.group.add(marker);
    const guide = buildGuide(Z.group);
    this.actors = { gabor, scooter, bag, guard, marker, guide, house, bar, rings };
    this.dressed = true;
    this.syncKit();
    this.poseActors();

    this.interact('bed', PLACE.bed, hy, '<b>[E]</b> The bed', () => this.onBed());
    this.interact('wardrobe', PLACE.wardrobe, hy, '<b>[E]</b> Wardrobe', () => this.onWardrobe());
    this.interact('shelf', PLACE.shelf, hy, '<b>[E]</b> Rebar shelf', () => this.onShelf());
    this.interact('garage', PLACE.garage, hy, '<b>[E]</b> Trolley pad', () => this.onGarage());
    if (house.garage) {
      this.interact('garage-door', { x: house.garage.doorX, z: house.garage.doorZ }, hy, '<b>[E]</b> Garage door', () => this.toggleGarage());
    }
    this.interact('mcrebar', PLACE.mcrebar, my, '<b>[E]</b> McRebar counter', () => this.onCounter());
    this.interact('gabor', { x: 0, z: 0 }, 0, '<b>[E]</b> Gabor', () => this.onGabor(), 3.4);
    this.interact('bag', { x: 0, z: 0 }, 0, '<b>[E]</b> The scanned meal', () => this.onBag(), 3.2);
    this.interact('scanner', { x: PLACE.event.x + 3.4, z: PLACE.event.z - 1 }, ey, '<b>[E]</b> Gabor\'s scanner', () => this.onScanner());
    this.interact('mop', { x: PLACE.event.x - 3.2, z: PLACE.event.z - 1.4 }, ey, '<b>[E]</b> Janitor mop', () => this.onMop());
    this.interact('ped-left', { x: PLACE.event.x - 2.4, z: PLACE.event.z + 1.2 }, ey, '<b>[E]</b> Left pedestal', () => this.onPed('ped-left'));
    this.interact('ped-mid', { x: PLACE.event.x, z: PLACE.event.z + 1.2 }, ey, '<b>[E]</b> Middle pedestal', () => this.onPed('ped-mid'));
    this.interact('ped-right', { x: PLACE.event.x + 2.4, z: PLACE.event.z + 1.2 }, ey, '<b>[E]</b> Right pedestal', () => this.onPed('ped-right'));
    const partPrompt = {
      hall: ['<b>[E]</b> Axle bolt in King George Square', 'A bolt. King George Square did not ask to help.'],
      bank: ['<b>[E]</b> Spare wheel at South Bank', 'South Bank is donating a wheel. The wheel has consented.'],
      mallBolt: ['<b>[E]</b> Decorative spoon, removed', 'The spoon is out. The trolley may forgive you.'],
    };
    const partMesh = {
      hall: () => {
        const g = new THREE.Group();
        const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.28, 8), mat(0xc9ccd4, { metalness: 0.8, roughness: 0.25 }));
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 6), mat(0xe0b15a, { metalness: 0.75, roughness: 0.3 }));
        head.position.y = 0.16;
        g.add(shank, head);
        return g;
      },
      bank: () => {
        const g = new THREE.Group();
        const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 8, 16), mat(0x22262e, { roughness: 0.85 }));
        tyre.rotation.x = Math.PI / 2;
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 8), mat(0xc9ccd4, { metalness: 0.7, roughness: 0.3 }));
        g.add(tyre, hub);
        return g;
      },
      mallBolt: () => {
        const g = new THREE.Group();
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.34, 6), mat(0xc9ccd4, { metalness: 0.7, roughness: 0.3 }));
        handle.rotation.z = 0.4;
        const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(0xe7e4dc, { metalness: 0.5, roughness: 0.35 }));
        bowl.scale.y = 0.4;
        bowl.position.set(0.08, -0.12, 0);
        g.add(handle, bowl);
        return g;
      },
    };
    for (const id of ['hall', 'bank', 'mallBolt']) {
      const p = PLACE[id];
      const y = gy(p.x, p.z);
      const mesh = partMesh[id]();
      mesh.position.set(p.x, y + 0.35, p.z);
      if (state.saga.stepState?.parts?.[id]) mesh.visible = false;
      Z.group.add(mesh);
      this.actors.parts = this.actors.parts || {};
      this.actors.parts[id] = mesh;
      this.interact(id, p, y, partPrompt[id][0], () => this.onPart(id, partPrompt[id][1]));
    }
    this.dressChronicle();
  }

  onStory(id) {
    if (onInteract(this, id)) return;
    this.game.say('bung', 'Not this minute. The chronicle is looking somewhere else.');
  }

  followCompanion(dt) {
    if (!state.saga?.companion || !this.actors?.ching) return;
    if (this.currentStep()?.kind === 'escort') return;
    const a = this.actors.ching;
    a.visible = true;
    const p = this.here();
    const destY = (state.saga.mansion && Math.abs(p.y - this.ground(p.x, p.z)) > 1.2) ? p.y : this.ground(p.x + 1.15, p.z + 0.7);
    const dest = new THREE.Vector3(p.x + 1.15, destY, p.z + 0.7);
    if (!this._chingSnapped) {
      a.position.copy(dest);
      this._chingSnapped = true;
    } else a.position.lerp(dest, 1 - Math.exp(-4 * dt));
    a.rotation.y = Math.atan2(p.x - a.position.x, p.z - a.position.z);
  }

  floorY(level) {
    const floors = this._floors || [this.ground(PLACE.home.x, PLACE.home.z)];
    return floors[level] ?? floors[0];
  }

  mansionY(x, z, feetY) {
    if (!state.saga?.mansion || !this._floors) return null;
    if (x < -826.2 || x > -813.8 || z < 896 || z > 906.6) return null;
    const [a, b, c] = this._floors;
    const t = Math.max(0, Math.min(1, (z - 896.3) / 3.2));
    if (x < -823.3 && z < 899.6 && feetY < b + 0.55) return a + (b - a) * t;
    if (x > -816.7 && z < 899.6 && feetY > b - 0.8) return b + (c - b) * t;
    let y = a;
    if (b <= feetY + 0.9) y = b;
    if (c <= feetY + 0.9) y = c;
    return y;
  }

  ensureMansion() {
    // Chapters 1–4 keep the West End house. The later mansion waits.
    if ((state.saga?.chapter ?? 0) < 4) return;
    if (this._mansionBuilt || !this.game.zone) return;
    state.saga.mansion = true;
    this._mansionBuilt = true;
    const Z = this.game.zone;
    const hy = this.ground(PLACE.home.x, PLACE.home.z);
    const a = hy + 0.22;
    const b = hy + 3.62;
    const c = hy + 7.02;
    this._floors = [a, b, c];
    const floor = mat(0xcbb89a, { roughness: 0.85 });
    const wall = mat(0xe4d7c4, { roughness: 0.9 });
    const home = PLACE.home;
    const skirt = b - (hy + 2.8);
    if (skirt > 0.05) {
      Z.box(home.x, hy + 2.8, home.z + 6.1, 12, skirt, 0.35, wall);
      Z.box(home.x - 6.05, hy + 2.8, home.z + 1.2, 0.35, skirt, 10, wall);
      Z.box(home.x + 6.05, hy + 2.8, home.z + 1.2, 0.35, skirt, 10, wall);
    }
    const glass = mat(0x9fd4ea, { roughness: 0.12, metalness: 0.25, emissive: 0x143044, emissiveIntensity: 0.35 });
    for (const [level, next] of [[b, c], [c, c + 2.7]]) {
      const h = next - level;
      Z.box(home.x, level - 0.2, home.z + 1.2, 12, 0.2, 10, floor, { collide: false });
      Z.box(home.x, level, home.z + 6.1, 12, h, 0.3, wall);
      Z.box(home.x - 6.05, level, home.z + 1.2, 0.3, h, 10, wall);
      Z.box(home.x + 6.05, level, home.z + 1.2, 0.3, h, 10, wall);
      Z.box(home.x, level, home.z - 3.55, 7.2, 1.05, 0.28, wall);
      for (const side of [-1, 1]) {
        for (const zOff of [-1.5, 1.6, 4.4]) {
          Z.box(home.x + side * 6.28, level + h * 0.42, home.z + zOff, 0.08, 1.05, 0.85, glass, { collide: false, ground: false });
        }
      }
    }
    const roof = mat(0x6e4b32, { roughness: 0.75 });
    Z.box(home.x, c + 2.7, home.z + 1.2, 12.6, 0.28, 10.6, roof, { collide: false, ground: false });
    const stepMat = mat(0xb7a48c, { roughness: 0.8 });
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const z = 896.5 + t * 2.9;
      Z.box(-824.7, a + (b - a) * t - 0.16, z, 2.1, 0.16, 0.5, stepMat, { collide: false, ground: false });
      Z.box(-815.3, b + (c - b) * t - 0.16, z, 2.1, 0.16, 0.5, stepMat, { collide: false, ground: false });
    }
    Z.textSign(home.x, c + 3.2, home.z + 6.4, 0, 'REBAR MANSION\nTHREE STOREYS', { w: 5.2, h: 1.3, bg: '#004e92', fg: '#f2c14b' });
    const labels = ['CHING\'S FAMILY', 'BUNG AND CHING', 'BUNG\'S FAMILY'];
    this._floors.forEach((y, i) => {
      Z.textSign(home.x + 2.2, y + 1.6, home.z + 4.6, 0, labels[i], { w: 3.4, h: 0.55, bg: '#1a1d26', fg: '#fff6e8' });
    });
    const family = [
      ['f-cmum', 'fcmum', 0, 0x1fb8c9, 0.92],
      ['f-cdad', 'fcdad', 0, 0x39414d, 1],
      ['f-bmum', 'fbmum', 2, 0xf2c14b, 0.94],
      ['f-bdad', 'fbdad', 2, 0x6d543c, 1.05],
    ];
    this.actors.family = family.map(([id, at, floor, color, scale]) => {
      const mesh = makePerson(color, scale);
      const p = PLACE[at];
      mesh.position.set(p.x, this._floors[floor], p.z);
      Z.group.add(mesh);
      this.interact(id, p, this._floors[floor], '<b>[E]</b> Family', () => this.onStory(id));
      return { id, mesh };
    });
    const bed = PLACE.fbed;
    this.interact('f-bed', bed, this._floors[1], '<b>[E]</b> Your floor', () => this.onStory('f-bed'));
    if (!this._groundWrapped) {
      this._groundWrapped = true;
      const orig = Z.sampleGround.bind(Z);
      const saga = this;
      Z.sampleGround = (x, z, feetY) => {
        const m = saga.mansionY(x, z, feetY);
        if (m != null) return m;
        return orig(x, z, feetY);
      };
    }
  }

  dressChronicle() {
    const Z = this.game.zone;
    const gy = (id) => {
      const p = PLACE[id];
      return this.ground(p.x, p.z);
    };
    const prop = (id, w, h, d, color, label) => {
      const p = PLACE[id];
      const y = gy(id);
      Z.box(p.x, y, p.z, w, h, d, mat(color, { roughness: 0.75 }), { collide: h > 1 });
      if (label) {
        const sz = p.z - d * 0.5 - 0.2;
        const post = mat(0x4a4f58, { metalness: 0.45, roughness: 0.45 });
        Z.box(p.x, y, sz, 0.14, 2.2, 0.14, post, { collide: false, ground: false });
        Z.textSign(p.x, y + 2.45, sz, 0, label, { w: Math.min(4.2, Math.max(2.6, w * 0.62)), h: 1.05, bg: '#1a1d26', fg: '#fff6e8' });
      }
      return y;
    };
    prop('court', 7, 0.16, 4, 0xf7f1e4, 'BRISBANE CITY COURT\nPARLIAMENT LAWN');
    prop('wlawn', 8, 0.12, 8, 0xf2efe6, 'W BRISBANE\nVICTORY LAWN');
    prop('pitch', 10, 0.08, 6, 0x3e8f45, 'DAVIES PARK\nREBAR CRICKET');
    prop('expo', 6, 0.1, 6, 0xffc94d, 'BRISBANE REBAR EXPO');
    prop('yard', 5, 0.16, 4, 0xe07a12, 'SEB DALY\nTHE YARD');
    prop('workshop', 3.4, 0.16, 3, 0x39414d, 'HIDDEN WORKSHOP');
    prop('river', 5, 0.08, 5, 0x1a1d26, 'THE OFFERING');
    const spots = {
      join: ['arrival', '<b>[E]</b> Ching'],
      phone: ['phone', '<b>[E]</b> The blue phone'],
      newphone: ['wlawn', '<b>[E]</b> The new phone'],
      receipt: ['receipt', '<b>[E]</b> Take the receipt'],
      witness: ['witness', '<b>[E]</b> The witness'],
      goggles: ['gogbox', '<b>[E]</b> The goggles box'],
      cheque: ['cheque', '<b>[E]</b> The city cheque'],
      suitcase: ['suitcase', '<b>[E]</b> The suitcase'],
      crate: ['crate', '<b>[E]</b> Seb\'s rebar crate'],
      seb: ['yard', '<b>[E]</b> Seb Daly'],
      drop1: ['drop1', '<b>[E]</b> Drop the rebar'],
      drop2: ['drop2', '<b>[E]</b> Drop the rebar'],
      drop3: ['drop3', '<b>[E]</b> Drop the rebar'],
      clue1: ['clue1', '<b>[E]</b> Read the scrap'],
      clue2: ['clue2', '<b>[E]</b> Read the scrap'],
      clue3: ['clue3', '<b>[E]</b> Read the scrap'],
      snow1: ['snow1', '<b>[E]</b> Clear the snow'],
      snow2: ['snow2', '<b>[E]</b> Clear the snow'],
      snow3: ['snow3', '<b>[E]</b> Clear the snow'],
      snow4: ['snow4', '<b>[E]</b> Clear the snow'],
      switch: ['event', '<b>[E]</b> Tornado switch'],
      offer: ['river', '<b>[E]</b> Leave the offering'],
      'square-name': ['plaza', '<b>[E]</b> The square'],
      'mall-name': ['smash', '<b>[E]</b> Queen Street'],
      'bank-name': ['bank', '<b>[E]</b> South Bank'],
    };
    for (const [id, [at, label]] of Object.entries(spots)) {
      const p = PLACE[at];
      this.interact(id, p, gy(at), label, () => this.onStory(id));
    }
    const ching = buildChing();
    const bike = makeBike();
    const drone = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.55), mat(0x22262e, { emissive: 0x2ee6ff, emissiveIntensity: 0.6 }));
    const meteor = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), mat(0x8a5a32, { roughness: 0.8 }));
    const bomb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), mat(0x22262e, { emissive: 0xff4d6a, emissiveIntensity: 0.45 }));
    const sat = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), mat(0xb9c4d4, { metalness: 0.7, roughness: 0.3 }));
    const hazard = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.3, 7), mat(0xff4d6a, { emissive: 0x5a1020 }));
    const girder = makeGirder();
    const seb = makePerson(0xe07a12, 1.18);
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, 0.35), mat(0xb35c2a, { metalness: 0.45, roughness: 0.45 }));
    const shards = [0, 1, 2].map(() => new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.08), mat(0x35c5f0, { emissive: 0x1787c9, emissiveIntensity: 0.5 })));
    const eyes = [];
    for (let i = 0; i < 10; i++) {
      eyes.push(new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), mat(0xf2c14b, { emissive: 0xffc02e, emissiveIntensity: 0.8 })));
    }
    const piles = {};
    for (const id of ['snow1', 'snow2', 'snow3', 'snow4']) {
      const p = PLACE[id];
      const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.1, 7), mat(0xf4f7ff, { roughness: 0.95 }));
      mesh.position.set(p.x, gy(id) + 0.5, p.z);
      piles[id] = mesh;
      Z.group.add(mesh);
    }
    for (const mesh of [ching, bike, drone, meteor, bomb, sat, hazard, girder, seb, cargo, ...shards, ...eyes]) {
      mesh.visible = false;
      Z.group.add(mesh);
    }
    Object.assign(this.actors, { ching, bike, drone, meteor, bomb, sat, hazard, girder, seb, cargo, shards, eyes, piles, family: [] });
    prepSnow(this, THREE);
    if (!this._groundWrapped) {
      this._groundWrapped = true;
      const orig = Z.sampleGround.bind(Z);
      const saga = this;
      Z.sampleGround = (x, z, feetY) => {
        const m = saga.mansionY(x, z, feetY);
        if (m != null) return m;
        return orig(x, z, feetY);
      };
    }
    if (state.saga.mansion || state.saga.chapter >= 15) this.ensureMansion();
    this.poseActors();
  }

  interact(id, p, y, label, fn, dist = 2.8) {
    const pos = new THREE.Vector3(p.x, y + 0.8, p.z);
    this.game.zone.interactables.push({ id, pos, label, fn, dist });
  }

  actorPos(id) {
    if (id === 'gabor' || id === 'bag') return this.actors.gabor.position;
    return null;
  }

  poseActors() {
    const a = this.actors;
    if (!a) return;
    const hide = (m) => { m.visible = false; };
    const show = (m, x, y, z) => { m.visible = true; m.position.set(x, y, z); };
    hide(a.gabor); hide(a.scooter); hide(a.bag); hide(a.guard); hide(a.marker);
    for (const mesh of [a.ching, a.bike, a.drone, a.meteor, a.bomb, a.sat, a.hazard, a.girder, a.seb, a.cargo]) {
      if (mesh) hide(mesh);
    }
    for (const mesh of a.shards || []) hide(mesh);
    for (const mesh of a.eyes || []) hide(mesh);
    for (const member of a.family || []) hide(member.mesh);
    if (a.piles) for (const mesh of Object.values(a.piles)) hide(mesh);
    const step = this.currentStep();
    const showRings = step?.kind === 'rings';
    for (const ring of a.rings || []) ring.visible = !!showRings;
    const needGabor = step && ['goggles', 'follow', 'bag', 'confront', 'catch', 'relic', 'watched', 'promo', 'announce', 'sabotage'].includes(step.id);
    const chase = step && (step.kind === 'follow' || step.kind === 'catch' || step.id === 'bag' || step.id === 'relic' || step.id === 'confront');
    if (needGabor) {
      let at;
      let y;
      if (step.id === 'sabotage') {
        at = this.point('garage').add(new THREE.Vector3(2.2, 0, 1.4));
        y = this.ground(at.x, at.z);
      } else if (chase) {
        at = this.pathAt(this.gaborT);
        y = at.y;
      } else if (a.bar) {
        at = new THREE.Vector3(a.bar.spot.x, a.bar.y, a.bar.spot.z);
        y = a.bar.y;
      } else {
        at = this.point('mcrebar');
        y = this.ground(at.x, at.z);
      }
      show(a.gabor, at.x, y, at.z);
      show(a.scooter, at.x + 1.1, y, at.z + 0.4);
      if (chase || step?.id === 'bag' || step?.id === 'relic') show(a.bag, at.x - 0.8, y + 0.4, at.z);
    }
    if (step?.kind === 'escape' || step?.id === 'swap' || step?.id === 'disguise' || step?.id === 'scan') {
      const c = PLACE.event;
      const y = this.ground(c.x, c.z);
      const ang = this.guardAng;
      show(a.guard, c.x + Math.cos(ang) * 7.5, y, c.z + Math.sin(ang) * 7.5);
    }
    this.stickInteract('gabor', a.gabor.position);
    this.stickInteract('bag', a.bag.position);
    poseMission(this);
    const mark = this.markerPoint();
    const here = this.here();
    const markFar = mark && Math.hypot(here.x - mark.x, here.z - mark.z) > 16 && (state.saga?.chapter ?? 0) > 3;
    if (markFar) show(a.marker, mark.x, mark.y + 2.2, mark.z);
    else if (a.marker) a.marker.visible = false;
  }

  stickInteract(id, pos) {
    const it = this.game.zone.interactables.find((x) => x.id === id);
    if (it) it.pos.set(pos.x, pos.y + 0.8, pos.z);
  }

  pathAt(t) { return this.pathOn(CHASE_PATH, t); }

  pathOn(pts, t) {
    const world = pts.map(([x, z]) => this.pointXY(x, z));
    const span = world.length - 1;
    const f = Math.max(0, Math.min(0.999, t)) * span;
    const i = Math.floor(f);
    const u = f - i;
    return world[i].clone().lerp(world[Math.min(span, i + 1)], u);
  }

  pointXY(x, z) { return new THREE.Vector3(x, this.ground(x, z), z); }

  markerPoint() {
    const step = this.currentStep();
    if (!step) return null;
    const marked = missionMarker(this, step);
    if (marked !== undefined) return marked;
    if (step.at && PLACE[step.at]) return this.point(step.at);
    if (step.kind === 'follow' || step.kind === 'catch') return this.pathAt(Math.min(0.98, this.gaborT + 0.08));
    if (step.kind === 'parts') {
      const have = state.saga.stepState.parts || {};
      const id = step.parts.find((p) => !have[p]);
      return id ? this.point(id) : this.point('garage');
    }
    if (step.kind === 'rings') {
      const have = state.saga.stepState.rings || {};
      const id = step.rings.find((p) => !have[p]);
      return id ? this.point(id) : null;
    }
    if (step.kind === 'choice' || step.kind === 'escape') return this.point('event');
    return null;
  }

  // ---------- flow ----------
  beginScene(step) {
    if (this.scenePlaying) return;
    this.scenePlaying = true;
    if (step.go) this.go(step.go);
    this.sceneLook = step.look ? this.point(step.look) : this.game.player.pos.clone();
    if (step.look === 'mcrebar' && this.actors?.bar) this.sceneLook.y = this.actors.bar.y;
    this.game.mode = 'cutscene';
    this.game.input.enabled = false;
    this.game.input.unlock();
    this.poseActors();
    this.game.dialogue.conversation(step.lines, () => this.endScene());
  }

  endScene() {
    if (!this.scenePlaying) return;
    this.scenePlaying = false;
    if (this.game.mode === 'cutscene') {
      this.game.mode = 'playing';
      this.game.input.enabled = true;
      this.snapCamera();
    }
    if (this.currentStep()?.kind === 'scene') this.advance();
  }

  aimCamera(dt) {
    const look = this.sceneLook || this.game.player.pos;
    const dest = look.clone().add(new THREE.Vector3(9, 6, 12));
    this.game.camera.position.lerp(dest, 1 - Math.exp(-1.5 * dt));
    this.game.camera.lookAt(look.x, look.y + 1.2, look.z);
  }

  snapCamera() {
    const p = this.game.player.pos;
    const yaw = 0.35;
    const pitch = 0.38;
    const dist = 7.2;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    this.game.camYaw = yaw;
    this.game.camPitch = pitch;
    this.game.camPos.set(p.x + Math.sin(yaw) * cp * dist, p.y + sp * dist + 0.6, p.z + Math.cos(yaw) * cp * dist);
    this.game.camera.position.copy(this.game.camPos);
    this.game.camera.lookAt(p.x, p.y + 1.5, p.z);
  }

  go(id) {
    const p = this.point(id);
    if (id === 'mcrebar' && this.actors?.bar) p.y = this.actors.bar.y;
    if (['home', 'bed', 'wardrobe', 'shelf', 'garage'].includes(id) && this.actors?.house) p.y = this.actors.house.y;
    this.game.trolley.dismiss();
    this.game.player.teleport(new THREE.Vector3(p.x, p.y + 0.55, p.z));
    this.snapCamera();
  }

  here() {
    return this.game.trolley.riding ? this.game.trolley.pos : this.game.player.pos;
  }

  check(step) {
    const here = this.here();
    if (step.kind === 'reach') {
      const p = this.point(step.at);
      const floor = step.at === 'mcrebar' && this.actors?.bar ? this.actors.bar.y : p.y;
      const flat = Math.hypot(here.x - p.x, here.z - p.z);
      if (flat < (step.radius || 6) && Math.abs(here.y - floor) < 2.4) this.advance();
    } else if (step.kind === 'follow') {
      if (this.gaborT > 0.96 && here.distanceTo(this.actors.gabor.position) < 6) this.advance();
    } else if (step.kind === 'catch') {
      if (!this.game.trolley.riding) return;
      if (here.distanceTo(this.actors.gabor.position) < 4.2) this.advance();
    } else if (step.kind === 'rings') {
      const have = state.saga.stepState.rings || (state.saga.stepState.rings = {});
      if (!this.game.trolley.riding) return;
      for (const id of step.rings) {
        if (!have[id] && here.distanceTo(this.point(id)) < 2.4) {
          have[id] = true;
          this.game.audio.sfx('quest');
          this.game.toast(`RING ${Object.keys(have).length}/${step.rings.length}`, 'blue');
        }
      }
      if (step.rings.every((id) => have[id])) this.advance();
    } else if (step.kind === 'escape') {
      const c = this.point('event');
      const guard = this.actors.guard.position;
      const nearGuard = here.distanceTo(guard);
      const limit = state.saga.stepState.disguise ? 2.3 : 4.8;
      if (here.distanceTo(c) < 16 && nearGuard < limit) this.caught();
      else if (here.distanceTo(c) > 22 && nearGuard > 6) this.advance();
    }
  }

  moveGabor(dt, step) {
    if (!this.actors) return;
    if (step.kind !== 'follow' && step.kind !== 'catch') return;
    const pos = this.actors.gabor.position;
    const player = this.here();
    const lead = step.kind === 'catch' ? 22 : 16;
    if (player.distanceTo(pos) < lead) {
      const rate = step.kind === 'catch' ? 0.16 : 0.07;
      this.gaborT = Math.min(0.99, this.gaborT + dt * rate);
    }
    const at = this.pathAt(this.gaborT);
    this.actors.gabor.position.lerp(at, 1 - Math.exp(-6 * dt));
    this.actors.scooter.position.set(pos.x + 1.1, pos.y, pos.z + 0.4);
    this.actors.bag.position.set(pos.x - 0.8, pos.y + 0.45, pos.z);
    this.actors.gabor.visible = true;
    this.actors.scooter.visible = true;
    this.actors.bag.visible = step.kind !== 'follow';
    this.stickInteract('gabor', pos);
    this.stickInteract('bag', this.actors.bag.position);
    const mark = this.markerPoint();
    if (mark) {
      this.actors.marker.visible = true;
      this.actors.marker.position.set(mark.x, mark.y + 2.4 + Math.sin(this.game.elapsed * 3) * 0.15, mark.z);
    }
  }

  moveGuard(dt) {
    const step = this.currentStep();
    const watching = step && (step.kind === 'escape' || step.kind === 'choice' || ['scan', 'disguise'].includes(step.id));
    if (!this.actors || !watching) return;
    this.guardAng += dt * 0.55;
    const c = PLACE.event;
    const y = this.ground(c.x, c.z);
    this.actors.guard.visible = true;
    this.actors.guard.position.set(c.x + Math.cos(this.guardAng) * 7.5, y, c.z + Math.sin(this.guardAng) * 7.5);
  }

  caught() {
    const now = this.game.elapsed;
    if (now - this._caughtLine < 1.2) return;
    this._caughtLine = now;
    this.go('event');
    this.game.audio.sfx('denied');
    this.game.dialogue.conversation([
      ['gabor', 'That singlet is not on the guest list. Back to the lawn, janitor.'],
      ['bung', 'The mop and I will try a quieter lap.'],
    ]);
  }

  // ---------- interactions ----------
  stepIs(id) { return this.currentStep()?.id === id; }

  held() { return this._pose || this.game.dialogue.busy; }

  playPose(kind, dur, done) {
    if (this._pose) return;
    this.freeze = true;
    this._pose = { kind, t: 0, dur, done };
  }

  tickPose(dt) {
    const pose = this._pose;
    if (!pose) return;
    pose.t += dt;
    const u = Math.min(1, pose.t / pose.dur);
    const player = this.game.player;
    const parts = player.parts;
    const house = this.actors?.house;
    if (pose.kind === 'rise') {
      player.mesh.rotation.x = (1 - u) * 1.05;
      player.mesh.position.y = player.pos.y - (1 - u) * 0.42;
      if (parts) {
        parts.armL.rotation.x = -0.9 * (1 - u);
        parts.armR.rotation.x = -0.6 * (1 - u);
      }
    } else if (pose.kind === 'dress' && parts) {
      const lift = Math.sin(u * Math.PI);
      parts.armL.rotation.x = -2.35 * lift;
      parts.armR.rotation.x = -2.35 * lift;
      if (house) {
        house.wardL.rotation.y = Math.min(1.15, u * 1.5);
        house.wardR.rotation.y = -Math.min(1.15, u * 1.5);
        if (u > 0.45) {
          house.hanging.visible = false;
          state.saga.stepState.uniform = true;
          this.syncKit();
        }
      }
    } else if (pose.kind === 'cupboard' && house) {
      const ang = Math.min(1.25, u * 1.5);
      house.cupL.rotation.y = -ang;
      house.cupR.rotation.y = ang;
      if (u > 0.7) state.saga.stepState.shelfOpen = true;
    } else if (pose.kind === 'mop' && parts) {
      const lift = Math.sin(u * Math.PI);
      parts.armL.rotation.x = -1.7 * lift;
      parts.armR.rotation.x = -1.7 * lift;
      if (u > 0.45) {
        state.saga.stepState.disguise = true;
        this.syncKit();
      }
    }
    if (u < 1) return;
    this._pose = null;
    this.freeze = false;
    player.mesh.rotation.x = 0;
    player.mesh.position.y = player.pos.y;
    pose.done?.();
  }

  syncKit() {
    const s = state.saga;
    const mesh = this.game.player?.mesh;
    if (!s || !mesh) return;
    const dressed = s.chapter > 0 || s.step > 2 || !!s.stepState?.uniform;
    setBungKit(mesh, { uniform: dressed, disguise: !!s.stepState?.disguise && s.chapter === 3 });
    const house = this.actors?.house;
    if (!house || this._pose) return;
    if (dressed) {
      house.hanging.visible = false;
      if (house.wardL.rotation.y < 0.2) {
        house.wardL.rotation.y = 1.15;
        house.wardR.rotation.y = -1.15;
      }
    }
    const open = s.chapter > 0 || s.step > 3 || !!s.stepState?.shelfOpen;
    if (open && Math.abs(house.cupL.rotation.y) < 0.2) {
      house.cupL.rotation.y = -1.25;
      house.cupR.rotation.y = 1.25;
    }
    house.emerald.visible = (s.relics || []).includes('Emerald Rebar');
    if (this.actors?.bar) this.actors.bar.meal.visible = !!s.stepState?.meal;
  }

  onBed() {
    if (!this.stepIs('bed')) { this.game.say('bung', 'The bed has done its job. I have not.'); return; }
    if (this.held()) return;
    this.playPose('rise', 0.95, () => {
      this.game.audio.sfx('land');
      this.game.dialogue.conversation([['bung', 'I am awake. The singlet is still in the wardrobe, which is a problem I can walk to.']], () => this.advance());
    });
  }

  onWardrobe() {
    if (!this.stepIs('clothes')) { this.game.say('bung', 'Already uniformed. The city can cope.'); return; }
    if (this.held()) return;
    this.game.audio.sfx('unlock');
    this.playPose('dress', 1.15, () => {
      this.game.dialogue.conversation([['bung', 'Singlet on. Boxers on. The hairs are at attention.']], () => this.advance());
    });
  }

  onShelf() {
    if (this.stepIs('shelf')) {
      if (this.held()) return;
      this.game.audio.sfx('unlock');
      this.playPose('cupboard', 0.7, () => {
        const owned = (state.saga.relics || []).join(', ');
        this.game.dialogue.conversation([['bung', owned ? `Look at them. ${owned}.` : 'Five bars and one empty clip. The empty clip is ambitious.']], () => this.advance());
      });
      return;
    }
    if (this.stepIs('home')) {
      if (this.held()) return;
      if (!state.saga.relics.includes('Emerald Rebar')) state.saga.relics.push('Emerald Rebar');
      this.game.audio.sfx('quest');
      this.playPose('cupboard', 0.7, () => {
        this.syncKit();
        this.game.dialogue.conversation([['bung', 'The Emerald is on the clip. Gabor\'s drone can file a complaint.']], () => this.advance());
      });
      return;
    }
    const list = (state.saga.relics || []);
    this.game.say('bung', list.length ? `On the shelf: ${list.join(', ')}.` : 'The shelf is ready for a legend and is currently ready for dust.');
  }

  openGarage() {
    const g = this.actors?.house?.garage;
    if (!g || g.target > 0.4) return;
    g.target = 1.2;
    g.moving = true;
    this.game.audio.sfx('unlock');
  }

  closeGarage() {
    const g = this.actors?.house?.garage;
    if (!g || g.target < 0.4) return;
    g.target = 0;
    g.moving = true;
    this.game.audio.sfx('unlock');
  }

  toggleGarage() {
    const g = this.actors?.house?.garage;
    if (!g) return;
    if (g.target > 0.4) this.closeGarage();
    else this.openGarage();
  }

  tickGarage(dt) {
    const g = this.actors?.house?.garage;
    if (!g?.moving) return;
    const cur = g.hinge.rotation.x;
    g.hinge.rotation.x = cur + (g.target - cur) * Math.min(1, dt * 3);
    if (g.hinge.rotation.x > 0.75) {
      const list = this.game.zone.colliders;
      const i = list.indexOf(g.blocker);
      if (i >= 0) list.splice(i, 1);
    }
    if (Math.abs(g.hinge.rotation.x - g.target) < 0.02) {
      g.hinge.rotation.x = g.target;
      g.moving = false;
      g.open = g.target > 0.4;
      if (!g.open && !this.game.zone.colliders.includes(g.blocker)) this.game.zone.colliders.push(g.blocker);
    }
  }

  onGarage() {
    if (this.stepIs('garage')) {
      state.flags.trolleyUnlocked = true;
      this.game.hud.refresh();
      this.openGarage();
      this.game.trolley.summon();
      this.game.dialogue.conversation([['bung', 'Golden trolley, online. Queen Street is that way, and so is dinner.']], () => this.advance());
      return;
    }
    if (this.stepIs('install')) {
      const have = state.saga.stepState.parts || {};
      if (!['hall', 'bank', 'mallBolt'].every((id) => have[id])) {
        this.game.say('bung', 'I have installed confidence. The axle wants the actual parts.');
        return;
      }
      state.saga.bigBoy = true;
      state.saga.trolleyDamage = false;
      state.saga.stepState.installed = true;
      this.game.audio.sfx('unlock');
      this.game.toast('BIG BOY MODE', 'blue');
      this.game.shake(0.2, 0.45);
      this.game.dialogue.conversation([['bung', 'Big Boy Mode. The spoon has been defeated.']], () => this.advance());
      return;
    }
    if (!state.flags.trolleyUnlocked) this.game.say('bung', 'The trolley is asleep. I am not, which is unusual.');
    else this.game.say('bung', state.saga.bigBoy ? 'Big Boy Mode is still on. The street can hear it.' : 'The trolley never lies.');
  }

  onCounter() {
    if (this.stepIs('meal') || this.stepIs('order')) {
      if (this.held()) return;
      state.saga.stepState.meal = true;
      if (this.actors?.bar) this.actors.bar.meal.visible = true;
      this.game.audio.sfx('buy');
      const lines = this.stepIs('meal')
        ? [
          ['bung', 'One Rebar Deluxe. No onions. Extra destiny.'],
          ['doc', 'The tray hits the counter. Across the mall, a wiry silhouette does not order. He watches.'],
        ]
        : [['bung', 'Another one. The fries are a research grant.']];
      this.game.dialogue.conversation(lines, () => this.advance());
      return;
    }
    this.game.say('bung', 'McRebar. The counter is real. The arches are rebar.');
  }

  onGabor() {
    if (!this.stepIs('goggles')) { this.game.say('gabor', 'Do not perceive me. I am conducting science.'); return; }
    this.game.dialogue.conversation([
      ['bung', 'Those goggles are seeing through my lunch.'],
      ['gabor', 'They are fashion. The X-ray is a bonus feature.'],
      ['bung', 'Walk. I am walking behind you. This is a pursuit.'],
    ], () => this.advance());
  }

  onBag() {
    if (this.stepIs('bag')) {
      this.game.dialogue.conversation([['bung', 'That meal is glowing in a way meals should not.']], () => this.advance());
      return;
    }
    if (this.stepIs('relic')) {
      const relic = this.chapter().reward.relic;
      if (relic && !state.saga.relics.includes(relic)) state.saga.relics.push(relic);
      this.game.audio.sfx('quest');
      this.game.dialogue.conversation([['bung', `${relic}. Mine. The odds can complain to someone else.`]], () => this.advance());
      return;
    }
    this.game.say('gabor', 'Do not touch the research burger.');
  }

  onScanner() {
    if (!this.stepIs('scan')) { this.game.say('gabor', 'The drone is off-duty and still judging you.'); return; }
    this.game.dialogue.conversation([
      ['bung', 'A scanner, a drone, and no shame.'],
      ['gabor', 'The Emerald is on the left pedestal. I mean it is not. Forget I gestured.'],
    ], () => this.advance());
  }

  onMop() {
    if (!this.stepIs('disguise')) { this.game.say('bung', 'The mop and I are already professionally involved.'); return; }
    if (this.held()) return;
    this.game.audio.sfx('unlock');
    this.playPose('mop', 0.8, () => {
      this.game.dialogue.conversation([
        ['bung', 'High-vis on. Cap on. I am a janitor with a trolley licence.'],
        ['doc', 'A collector looks at the vest, then at the belly, and decides not to be paid enough to ask.'],
      ], () => this.advance());
    });
  }

  onPed(id) {
    const step = this.currentStep();
    if (!step || step.kind !== 'choice') {
      this.game.say('bung', 'Lovely rebar. Not today\'s crime.');
      return;
    }
    if (!state.saga.stepState.disguise) {
      this.game.say('gabor', 'Guests do not fondle the pedestals. Janitors might. You are neither, yet.');
      return;
    }
    if (id !== step.correct) {
      this.game.audio.sfx('denied');
      this.game.dialogue.conversation([
        ['bung', 'This one is shiny. Shiny is how fakes introduce themselves.'],
        ['gabor', 'Wrong pedestal. My drone is laughing in binary.'],
      ]);
      return;
    }
    this.game.dialogue.conversation([
      ['bung', 'Left one. The decoy goes up. The Emerald goes into the singlet, which is a pocket if you believe.'],
      ['gabor', 'Why is the janitor sweating gold. Janitors do not sweat gold.'],
    ], () => this.advance());
  }

  onPart(id, line) {
    const step = this.currentStep();
    if (!step || step.kind !== 'parts' || !step.parts.includes(id)) {
      this.game.say('bung', 'A fine bolt. I am not collecting bolts socially.');
      return;
    }
    const have = state.saga.stepState.parts || (state.saga.stepState.parts = {});
    if (have[id]) { this.game.say('bung', 'Already got that one.'); return; }
    have[id] = true;
    if (this.actors?.parts?.[id]) this.actors.parts[id].visible = false;
    this.game.audio.sfx('quest');
    this.game.say('bung', line);
    this.refresh();
    if (step.parts.every((p) => have[p])) this.advance();
  }

  advance() {
    if (this._lock) return;
    this._lock = true;
    this.freeze = false;
    closePlay();
    const ch = this.chapter();
    state.saga.step += 1;
    this.gaborT = 0;
    this._booted = '';
    if (state.saga.step >= ch.steps.length) this.finishChapter();
    else {
      this.syncDamage();
      this.poseActors();
      this.refresh();
      SaveSystem.save(this.game);
      const next = this.currentStep();
      if (next?.kind === 'scene') this.beginScene(next);
      else this.ensureStep();
    }
    this._lock = false;
  }

  finishChapter() {
    this.freeze = false;
    closePlay();
    const ch = this.chapter();
    if (!state.saga.done.includes(ch.id)) state.saga.done.push(ch.id);
    if (ch.reward?.coins) {
      state.coins += ch.reward.coins;
      this.game.toast(`+${ch.reward.coins} BUNGBUCKS`, 'blue');
    }
    if (ch.reward?.relic && !state.saga.relics.includes(ch.reward.relic)) state.saga.relics.push(ch.reward.relic);
    if (ch.reward?.archive) unlockArchive(ch.reward.archive);
    state.saga.trolleyDamage = false;
    this.game.audio.sfx('questDone');
    this.game.hud.questBanner(ch.title);
    SaveSystem.save(this.game);
    this.game.pauseForMenu();
    this.game.menus.showSagaClear(ch);
  }

  nextChapter() {
    const next = CHAPTERS[state.saga.chapter + 1];
    if (!next?.playable) {
      state.saga.legend = true;
      state.saga.intermission = true;
      state.saga.step = 0;
      this.freeze = false;
      closePlay();
      this.game.resume();
      this.followCompanion(0.2);
      this.refresh();
      this.game.dialogue.conversation([
        ['doc', 'The Brisbane chronicle is on the shelf. The suitcase stays closed.'],
        ['bung', 'Queen Street is still a street. That is enough world for today.'],
        ['ching', 'I am not a quest marker. I am staying anyway.'],
      ]);
      SaveSystem.save(this.game);
      return;
    }
    state.saga.chapter += 1;
    state.saga.step = 0;
    state.saga.stepState = {};
    state.saga.intermission = false;
    this.gaborT = 0;
    this._booted = '';
    this.syncDamage();
    if (state.saga.chapter >= 15) this.ensureMansion();
    this.game.resume();
    this.go(this.chapter().start || 'home');
    this.poseActors();
    this.refresh();
    const step = this.currentStep();
    if (step?.kind === 'scene') this.beginScene(step);
    else this.ensureStep();
    SaveSystem.save(this.game);
  }

  syncDamage() {
    if (!state.saga) return;
    const step = this.currentStep();
    const fixing = state.saga.chapter === 2 && step && ['sabotage', 'parts', 'install'].includes(step.id) && !state.saga.stepState.installed;
    state.saga.trolleyDamage = !!fixing;
  }

  refresh() {
    bus.emit('quest-ui');
    bus.emit('hud');
    if (this.dressed && this.game.mode !== 'cutscene') this.poseActors();
  }

  tracker() {
    if (!this.on) return null;
    const ch = this.chapter();
    const act = ACTS.find((a) => a.id === ch?.act);
    if (state.saga.intermission) {
      const lines = [{ text: 'Brisbane is open. Ching stays if she has arrived.', done: !!state.saga.companion }];
      if (state.saga.fortune) lines.push({ text: 'The cheque reads three billion dollars.', done: true });
      return {
        title: state.saga.legend ? 'THE LEGEND OF BUNG BUNTY' : `ACT ${act?.id || ''} — ${act?.title || ''}`,
        name: state.saga.legend ? 'BRISBANE, STILL' : 'BETWEEN CHAPTERS',
        lines,
      };
    }
    const step = this.currentStep();
    const lines = [];
    if (step) {
      let text = missionLabel(this, step) || step.text || 'Watch';
      if (step.kind === 'parts') {
        const have = Object.keys(state.saga.stepState.parts || {}).length;
        text = `${text} (${have}/${step.parts.length})`;
      }
      if (step.kind === 'rings') {
        const have = Object.keys(state.saga.stepState.rings || {}).length;
        text = `${text} (${have}/${step.rings.length})`;
      }
      const mark = this.markerPoint();
      if (mark && ['interact', 'reach', 'parts', 'evidence', 'snow', 'sequence', 'deliver', 'visits', 'escort', 'race', 'dodge', 'shards', 'eyes'].includes(step.kind)) {
        text += ` — ${this.bearing(mark)}`;
      }
      lines.push({ text, done: false });
    }
    return {
      title: `ACT ${act?.id || ''} — ${act?.title || ''}`,
      name: `CHAPTER ${ch.n} — ${ch.title}`,
      lines,
    };
  }

  bearing(mark) {
    const p = this.here();
    const dx = mark.x - p.x;
    const dz = mark.z - p.z;
    const m = Math.round(Math.hypot(dx, dz));
    const east = dx > 8 ? 'east' : dx < -8 ? 'west' : '';
    const south = dz > 8 ? 'south' : dz < -8 ? 'north' : '';
    const dir = `${south}${east ? (south ? '-' : '') + east : ''}` || 'here';
    return `${m} m ${dir}`;
  }
}

function makePerson(color, scale = 1) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.86, 8), mat(color, { roughness: 0.7 }));
  body.position.y = 0.95;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat(0xf0c9a0, { roughness: 0.75 }));
  head.position.y = 1.58;
  g.add(head);
  g.scale.setScalar(scale);
  return g;
}

function makeBike() {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.38, 1.05), mat(0x22262e, { roughness: 0.6 }));
  frame.position.y = 0.48;
  g.add(frame);
  for (const z of [-0.42, 0.42]) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 6, 12), mat(0x111111, { metalness: 0.4 }));
    w.position.set(0, 0.26, z);
    g.add(w);
  }
  return g;
}

function makeGirder() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, 0.8), mat(0x3a404c, { metalness: 0.65, roughness: 0.35 }));
  body.position.y = 1.1;
  g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.7), mat(0x2a3038, { metalness: 0.7, roughness: 0.3 }));
  head.position.y = 2.25;
  g.add(head);
  return g;
}
