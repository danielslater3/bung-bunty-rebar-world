// The Game: renderer, camera, main loop, zone loading, damage/score logic,
// and glue between every system. One instance runs the whole show.
import * as THREE from 'three';
import { clamp, damp } from './utils.js';
import { state, bus, SaveSystem } from './state.js';
import { Input } from './Input.js';
import { AudioManager } from './AudioManager.js';
import { FX } from './FX.js';
import { Player } from '../entities/Player.js';
import { Trolley } from '../entities/Trolley.js';
import { DialogueSystem } from '../systems/DialogueSystem.js';
import { QuestSystem } from '../systems/QuestSystem.js';
import { ShopSystem } from '../systems/ShopSystem.js';
import { ChainManager } from '../systems/ChainManager.js';
import { HUD } from '../ui/HUD.js';
import { Menus } from '../ui/Menus.js';
import { ZONE_BUILDERS, ZONE_INFO } from '../world/zones.js';

export class Game {
  constructor() {
    // ---- Renderer ----
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    document.getElementById('app').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 600);
    this.camera.position.set(0, 4, 10);
    this.camYaw = 0;
    this.camPitch = 0.32;
    this.camPos = new THREE.Vector3(0, 4, 10);

    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });

    // ---- Systems ----
    this.input = new Input(this.renderer.domElement);
    this.audio = new AudioManager();
    // Init audio on the very first user gesture so hover sounds work in menus
    document.addEventListener('pointerdown', () => { this.audio.init(); }, { once: true });
    this.fx = new FX(this);
    this.dialogue = new DialogueSystem(this);
    this.quests = new QuestSystem(this);
    this.shop = new ShopSystem(this);
    this.hud = new HUD(this);
    this.menus = new Menus(this);
    this.chain = new ChainManager(this); // central Rebar Chain manager

    // ---- World ----
    this.zone = null;
    this.allEnemies = [];
    this.player = new Player(this);
    this.trolley = new Trolley(this);
    this.player.mesh.visible = false;

    this.mode = 'menu'; // menu | playing | paused
    this.scoreAttack = null;
    this._wasLocked = false;
    this._lastSay = 0;

    // Previous-frame actor positions — consumed by portals & collectibles
    // for swept (tunnelling-proof) trigger detection.
    this.actorPrev = { player: new THREE.Vector3(), trolley: new THREE.Vector3() };

    // Camera shake + dynamic FOV state
    this.shakeAmp = 0;
    this.shakeT = 0;
    this.shakeDur = 1;
    this.baseFov = 68;
    this._fovCurrent = 68;

    bus.on('qe', (e) => {
      if (this.scoreAttack && e.type === 'portal') this.scoreAttack.portals += 1;
    });

    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ============ FLOW ============
  startGame(fresh) {
    this.audio.init();
    this.audio.resume();
    if (fresh) SaveSystem.reset();
    else SaveSystem.load();
    this.audio.applyVolumes();
    this.menus.close();
    this.hud.show();
    this.player.mesh.visible = true;
    this.mode = 'playing';
    this.input.enabled = true;
    this.input.lock();
    this.loadZone(state.currentZone, true);
    if (fresh) {
      setTimeout(() => {
        this.dialogue.conversation([
          ['bung', 'OIIII. Beautiful morning in Brisbane. Time to check on me rebars.'],
          ['ching', 'Bung — the Rebar Network is glitching. Portals everywhere. Gabor energy detected.'],
          ['bung', 'Say no more. OPERATION REBAR: BLUE TO RED IS OFFICIALLY DEPLOYED.'],
        ], () => this.quests.startActiveQuestBriefing());
      }, 1200);
    } else {
      setTimeout(() => this.quests.startActiveQuestBriefing(), 800);
    }
  }

  pauseForMenu() {
    if (this.mode === 'playing') this.mode = 'paused';
    this.input.enabled = false;
    this._wasLocked = false;
    this.input.unlock();
    // Looping audio must never keep playing into menus
    this.trolley.setBoosting(false, 'paused');
    this.audio.stopAllLoops();
  }

  resume() {
    this.menus.close();
    this.mode = 'playing';
    this.input.enabled = true;
    this._wasLocked = false;
    this.input.lock();
  }

  respawn() {
    state.stability = state.maxStability;
    this.chain.resetChain('respawn', true);
    this.player.teleport(this.zone.spawn.clone());
    this.trolley.dismiss();
    bus.emit('hud');
    this.resume();
  }

  gameOver() {
    this.pauseForMenu();
    this.audio.sfx('hurt');
    this.say('bung', 'Bung Stability: compromised. Initiating tactical nap.');
    this.menus.showGameOver();
  }

  // ============ ZONES ============
  loadZone(name, silent = false) {
    if (this.zone) this.zone.dispose();
    this.allEnemies = [];
    this.scoreAttack = null;
    this.trolley.dismiss();
    this.audio.stopAllLoops();

    const kit = ZONE_BUILDERS[name](this); // ZoneKit registers itself as game.zone
    this.scene.add(kit.group);

    state.currentZone = name;
    this.player.teleport(kit.spawn.clone());
    this.actorPrev.player.copy(kit.spawn);
    this.actorPrev.trolley.copy(kit.spawn);
    this.camYaw = kit.spawnYaw;
    this.player.facing = kit.spawnYaw + Math.PI;
    this.player.mesh.rotation.y = this.player.facing;

    this.audio.playMusic(kit.music);
    if (!silent || true) {
      const info = ZONE_INFO[name];
      this.hud.zoneBanner(info.mode, info.name);
    }
    bus.emit('qe', { type: 'enter', target: name });
    bus.emit('hud');
    if (this.mode === 'playing') SaveSystem.save();
  }

  // ============ COMBAT / SCORE ============
  damagePlayer(amount, fromPos = null, silent = false) {
    if (this.player.hurtCD > 0 || this.mode !== 'playing') return;
    this.player.hurtCD = 0.9;
    state.stability = Math.max(0, state.stability - amount);
    this.hud.hurtFlash();
    if (!silent) this.audio.sfx('hurt');
    if (fromPos) {
      const kb = this.player.pos.clone().sub(fromPos).setY(0).normalize();
      this.player.vel.addScaledVector(kb, 7);
      this.player.vel.y = Math.max(this.player.vel.y, 4);
    }
    this.chain.resetChain('REBAR CHAIN BROKEN!'); // damage breaks the chain (intended)
    if (!silent && Math.random() < 0.4) {
      this.say('bung', ['OI! Watch the singlet!', 'That was rude, mate.', 'Bung Stability compromised!'][Math.floor(Math.random() * 3)]);
    }
    bus.emit('hud');
    if (state.stability <= 0) this.gameOver();
  }

  // Legacy wrapper — all combo logic lives in ChainManager now
  breakCombo(msg) { this.chain.resetChain(msg || 'reset', !msg); }

  hitEnemies(pos, radius, dmg, source) {
    for (const e of this.allEnemies) {
      if (e.dead) continue;
      if (e.pos.distanceTo(pos) < radius + 0.6) e.hit(dmg, pos);
    }
  }

  startScoreAttack() {
    if (this.scoreAttack) return;
    this.scoreAttack = { t: 60, startScore: state.score, portals: 0 };
    this.audio.sfx('quest');
    this.toast('PORTAL RUSH! 60 SECONDS — 2x SCORE!', 'red');
    this.say('ching', 'Portal Rush engaged. Sixty seconds. Fly, Bung.');
  }

  // ============ HELPERS ============
  say(speaker, text) { this.dialogue.say(speaker, text); }
  toast(msg, cls) { this.hud.toast(msg, cls); }
  bossBanner(text) { this.hud.bossBanner(text); }

  // ============ MAIN LOOP ============
  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.elapsed += dt;

    if (this.mode === 'playing') {
      this.updatePlaying(dt);
    }
    // Subtle menu camera drift
    if (this.mode === 'menu' && this.zone) {
      this.camYaw += dt * 0.06;
    }

    this.updateCamera(dt);
    this.fx.update(dt);
    this.input.endFrame();
    this.renderer.render(this.scene, this.camera);
  }

  updatePlaying(dt) {
    const input = this.input;

    // Detect pointer-lock loss (Esc) → pause
    if (this._wasLocked && !input.locked && !this.menus.isOpen) {
      this._wasLocked = false;
      this.pauseForMenu();
      this.menus.showPause();
      return;
    }
    this._wasLocked = input.locked;

    if (input.pressed['Escape'] || input.pressed['KeyP']) {
      this.pauseForMenu();
      this.menus.showPause();
      return;
    }

    // Camera input
    const m = input.consumeMouse();
    const sens = 0.0024 * state.settings.sensitivity;
    this.camYaw -= m.dx * sens;
    this.camPitch = clamp(this.camPitch + m.dy * sens, -0.45, 1.25);

    // Capture previous actor positions BEFORE movement — portals and
    // collectibles sweep the prev→current segment for tunnelling-proof hits.
    this.actorPrev.player.copy(this.player.pos);
    this.actorPrev.trolley.copy(this.trolley.pos);

    // World updates
    this.player.update(dt);
    this.trolley.update(dt);
    if (this.zone) this.zone.update(dt, this.elapsed);
    this.dialogue.update(dt);
    this.hud.update(dt);

    // Rebar Chain timer (owned by the ChainManager)
    this.chain.update(dt);

    // Buff timers
    for (const k of Object.keys(state.buffs)) {
      if (state.buffs[k] > 0) state.buffs[k] = Math.max(0, state.buffs[k] - dt);
    }

    // Passive regen: a trickle of Rebar Energy + Trolley Fuel
    state.energy = Math.min(state.maxEnergy, state.energy + dt * 1.2);
    if (!this.trolley.boosting) state.fuel = Math.min(state.maxFuel, state.fuel + dt * 0.9);
    if (Math.floor(this.elapsed * 2) !== Math.floor((this.elapsed - dt) * 2)) bus.emit('hud');

    // Portal Rush countdown
    if (this.scoreAttack) {
      this.scoreAttack.t -= dt;
      if (Math.ceil(this.scoreAttack.t) !== Math.ceil(this.scoreAttack.t + dt) && this.scoreAttack.t < 10 && this.scoreAttack.t > 0) {
        this.audio.sfx('tick');
        this.toast(`PORTAL RUSH: ${Math.ceil(this.scoreAttack.t)}s`, 'red');
      }
      if (this.scoreAttack.t <= 0) {
        const gained = state.score - this.scoreAttack.startScore;
        const portals = Math.round(this.scoreAttack.portals);
        this.scoreAttack = null;
        this.audio.sfx('questDone');
        this.menus.showResults(gained, portals);
        return;
      }
    }

    // Trolley summon/dismiss (T)
    if (input.pressed['KeyT']) {
      if (this.trolley.riding) {
        // can't dismiss while riding
      } else if (this.trolley.summoned) this.trolley.dismiss();
      else this.trolley.summon();
    }

    // Interactions (E) — priority: dialogue advance > mount trolley > zone interactable
    const reticle = document.getElementById('reticle');
    reticle.classList.remove('hidden');
    // Reticle lights up gold when a grapple point is in range/aim
    reticle.classList.toggle('grapple-on', !!this.player.grappleTarget && !this.trolley.riding);
    if (!this.dialogue.busy) {
      let prompt = null, action = null;
      if (!this.trolley.riding && this.trolley.summoned &&
          this.player.pos.distanceTo(this.trolley.pos) < 3) {
        prompt = '<b>[E]</b> Mount the James Rebar Trolley';
        action = () => this.trolley.mount();
      } else if (!this.trolley.riding && this.zone) {
        const it = this.zone.nearestInteract(this.player.pos);
        if (it) { prompt = it.label; action = it.fn; }
      }
      this.hud.prompt(prompt);
      if (prompt && input.pressed['KeyE']) action();
    } else {
      this.hud.prompt(null);
    }

    // Ambient Bung barks
    if (this.elapsed - this._lastSay > 45 && !this.dialogue.busy && Math.random() < 0.005) {
      this._lastSay = this.elapsed;
      const barks = [
        'Real wealth is measured in rebars.',
        'I can smell the Rebar Coins.',
        'Operation Rebar is proceeding... operationally.',
        'The trolley never lies.',
      ];
      this.say('bung', barks[Math.floor(Math.random() * barks.length)]);
    }
  }

  updateCamera(dt) {
    const riding = this.trolley.riding;
    const targetPos = riding
      ? this.trolley.pos.clone().add(new THREE.Vector3(0, 1.8, 0))
      : this.player.pos.clone().add(new THREE.Vector3(0, 1.7, 0));

    // While riding, gently align the camera behind the trolley
    if (riding && Math.abs(this.input.mouseDX) < 1) {
      const targetYaw = this.trolley.heading + Math.PI;
      let d = ((targetYaw - this.camYaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      this.camYaw += d * (1 - Math.exp(-1.6 * dt));
    }

    let dist = riding ? 9.5 : 7.2;
    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    const offset = new THREE.Vector3(
      Math.sin(this.camYaw) * cp * dist,
      sp * dist + 0.5,
      Math.cos(this.camYaw) * cp * dist
    );

    // Camera wall collision: raycast from the focus point toward the desired
    // camera spot; if level geometry is in the way, pull the camera in.
    if (this.zone && this.zone.grounds.length) {
      const dir = offset.clone().normalize();
      this._camRay = this._camRay || new THREE.Raycaster();
      this._camRay.set(targetPos, dir);
      this._camRay.far = dist;
      const hits = this._camRay.intersectObjects(this.zone.grounds, false);
      if (hits.length) dist = Math.max(2.0, hits[0].distance * 0.92);
    }
    const desired = targetPos.clone().addScaledVector(offset.normalize(), dist);
    // Keep camera above the deck a little
    desired.y = Math.max(desired.y, targetPos.y - 1.5);

    this.camPos.x = damp(this.camPos.x, desired.x, 14, dt);
    this.camPos.y = damp(this.camPos.y, desired.y, 14, dt);
    this.camPos.z = damp(this.camPos.z, desired.z, 14, dt);
    this.camera.position.copy(this.camPos);

    // ---- Camera shake (subtle, decaying) ----
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmp * Math.max(0, this.shakeT / this.shakeDur);
      this.camera.position.x += (Math.random() - 0.5) * a;
      this.camera.position.y += (Math.random() - 0.5) * a;
      this.camera.position.z += (Math.random() - 0.5) * a;
    }
    this.camera.lookAt(targetPos);

    // ---- Dynamic FOV: sprint widens slightly, trolley boost widens more ----
    const targetFov = this.baseFov
      + (this.player.isSprinting && !riding ? 5 : 0)
      + (this.trolley.boosting ? 11 : 0);
    this._fovCurrent = damp(this._fovCurrent, targetFov, 6, dt);
    if (Math.abs(this.camera.fov - this._fovCurrent) > 0.02) {
      this.camera.fov = this._fovCurrent;
      this.camera.updateProjectionMatrix();
    }
  }

  // Request a camera shake: amp in world units (≤0.3 stays subtle), dur in s.
  shake(amp, dur) {
    if (amp >= this.shakeAmp * (this.shakeT / this.shakeDur || 0)) {
      this.shakeAmp = amp;
      this.shakeT = dur;
      this.shakeDur = dur;
    }
  }
}
