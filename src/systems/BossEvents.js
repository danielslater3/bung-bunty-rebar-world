// Boss events: the Gabor Scooter Chase (Brisbane) and the
// MEGA FOREHEAD REBAR MACHINE (Shenzhen final boss).
import * as THREE from 'three';
import { mat, sphere, box, cyl, damp } from '../core/utils.js';
import { state, bus } from '../core/state.js';
import { buildGabor, buildScooter } from '../entities/models.js';
import { Enemy } from '../entities/Enemies.js';

// ============================================================
// BOSS 1: GABOR SCOOTER CHASE
// ============================================================
export class GaborChase {
  constructor(game, waypoints) {
    this.game = game;
    this.waypoints = waypoints;
    this.active = false;
    this.done = state.flags.chaseDone || false;
    this.hits = 0;
    this.wpIndex = 0;
    this.taunts = [
      'You cannot stop the Gabor Scooter!',
      'My forehead contains unlimited strategy!',
      'I have bought every McRebar meal in Brisbane!',
      'Behold, my scooter-based genius!',
    ];
    this.tauntT = 0;

    this.group = new THREE.Group();
    this.gabor = buildGabor();
    this.gabor.position.y = 0.15;
    this.gabor.rotation.y = Math.PI;
    this.scooter = buildScooter();
    this.group.add(this.scooter);
    this.group.add(this.gabor);
    this.group.visible = false;
    this.kit = game.zone;
    game.zone.group.add(this.group);
    this.pos = new THREE.Vector3();

    bus.on('pulse', (e) => { if (this.game.zone === this.kit) this.onPulse(e); });
  }

  shouldActivate() {
    const q = this.game.quests.active;
    if (!q || q.id !== 'q4' || this.done || this.active) return false;
    // Objective 0 (defeat drones) must be done
    return this.game.quests.getProgress(0) >= q.objectives[0].count;
  }

  activate() {
    this.active = true;
    this.hits = 0;
    this.pos.copy(this.waypoints[0]);
    this.wpIndex = 1;
    this.group.visible = true;
    const g = this.game;
    g.audio.sfx('scooter');
    g.audio.sfx('evil');
    g.audio.playMusic('boss');
    g.bossBanner('GABOR SCOOTER CHASE');
    g.shake(0.25, 0.5);
    g.say('ching', 'Warning: Gabor scooter activity detected.');
    g.say('gabor', 'You cannot stop the Gabor Scooter! WHEEEEE!');
    g.toast('CHASE GABOR! HIT HIM 3x WITH REBAR PULSE (G)', 'red');
  }

  onPulse(e) {
    if (!this.active) return;
    if (e.pos.distanceTo(this.pos) < e.radius + 1.5) {
      this.hits++;
      const g = this.game;
      g.audio.sfx('bonk');
      g.fx.burst(this.pos.clone().add(new THREE.Vector3(0, 1, 0)), 0xff2e5f, 20);
      g.toast(`SCOOTER HIT ${this.hits}/3!`, 'red');
      if (this.hits === 1) g.say('gabor', 'OW! That was part of my plan!');
      if (this.hits === 2) g.say('gabor', 'STOP HITTING MY GENIUS!');
      if (this.hits >= 3) this.crash();
    }
  }

  crash() {
    this.active = false;
    this.done = true;
    state.flags.chaseDone = true;
    const g = this.game;
    g.audio.sfx('explode');
    g.fx.burst(this.pos, 0xffc23d, 40);
    g.fx.burst(this.pos, 0x8f1fff, 30);
    g.bossBanner('');
    g.audio.playMusic(g.zone.music);
    g.say('gabor', 'I meant to crash into those fake rebar boxes! It was... strategic!');
    setTimeout(() => g.say('bung', 'Gabor, you absolute pest. Hand over the shard.'), 3200);
    this.group.visible = false;
    // Drop the stolen Cyber Rebar Shard
    g.zone.addCollectible('shard', this.pos.clone().add(new THREE.Vector3(0, 1, 0)));
    bus.emit('qe', { type: 'boss', target: 'chase' });
  }

  update(dt) {
    if (this.shouldActivate()) this.activate();
    if (!this.active) return;

    // Follow waypoints — speed scales so the player can catch up with boost
    const target = this.waypoints[this.wpIndex];
    const to = target.clone().sub(this.pos);
    to.y = 0;
    const dist = to.length();
    if (dist < 4) {
      this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
    } else {
      to.normalize();
      const playerDist = this.pos.distanceTo(this.game.trolley.riding ? this.game.trolley.pos : this.game.player.pos);
      // Rubber-banding: slows when far ahead, speeds when player is close
      const speed = playerDist > 30 ? 8 : playerDist > 12 ? 13 : 17;
      this.pos.addScaledVector(to, speed * dt);
      this.group.rotation.y = Math.atan2(to.x, to.z);
    }
    this.group.position.copy(this.pos);
    this.group.position.y = this.pos.y + Math.abs(Math.sin(performance.now() * 0.01)) * 0.08;

    // Taunts
    this.tauntT -= dt;
    if (this.tauntT <= 0) {
      this.tauntT = 7;
      this.game.say('gabor', this.taunts[Math.floor(Math.random() * this.taunts.length)]);
      this.game.audio.sfx('scooter');
    }
  }
}

// ============================================================
// FINAL BOSS: MEGA FOREHEAD REBAR MACHINE
// ============================================================
export class MegaForeheadMachine {
  constructor(game, center) {
    this.game = game;
    this.center = center.clone();
    this.phase = 'idle'; // idle -> nodes -> core -> dead
    this.coreHits = 0;
    this.shockT = 3;
    this.shockwaves = [];
    this.droneT = 8;
    this.drones = [];

    const g = new THREE.Group();
    g.position.copy(center);

    // The machine: a giant tower with a colossal forehead dome on top
    const base = cyl(6, 8, 4, mat(0x23262e, { metalness: 0.8, roughness: 0.35 }), 12);
    base.position.y = 2; g.add(base);
    const column = cyl(3.4, 4.5, 10, mat(0x2e3340, { metalness: 0.7, roughness: 0.4, emissive: 0x33060f }), 10);
    column.position.y = 9; g.add(column);
    // THE FOREHEAD — giant skin-tone dome with the shine of unlimited strategy
    const forehead = sphere(5, mat(0xf0c9a0, { roughness: 0.55 }), 18, 14);
    forehead.scale.y = 1.3;
    forehead.position.y = 18;
    g.add(forehead);
    this.forehead = forehead;
    const shine = sphere(1.1, mat(0xfff2d9, { emissive: 0xffe9b0, emissiveIntensity: 1.2 }), 10, 8);
    shine.position.set(1.6, 20.5, 3.6);
    shine.scale.z = 0.4;
    g.add(shine);
    // Angry eyes on the column
    for (const sx of [-1, 1]) {
      const eye = sphere(0.7, mat(0xff2e5f, { emissive: 0xff2e5f, emissiveIntensity: 2.2 }), 8, 6);
      eye.position.set(sx * 1.6, 12.5, 3.4);
      g.add(eye);
    }
    // Core (hidden until node phase done)
    this.core = sphere(1.6, mat(0x2ee6ff, { emissive: 0x2ee6ff, emissiveIntensity: 2 }), 12, 10);
    this.core.position.y = 12.5;
    this.core.position.z = 4.2;
    this.core.visible = false;
    g.add(this.core);

    // 4 corruption nodes on pillars around the machine
    this.nodes = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const nx = Math.cos(a) * 14, nz = Math.sin(a) * 14;
      const pillar = cyl(0.6, 0.8, 5, mat(0x2e3340, { metalness: 0.7, roughness: 0.4 }), 8);
      pillar.position.set(nx, 2.5, nz);
      g.add(pillar);
      const node = new THREE.Mesh(new THREE.OctahedronGeometry(1.1),
        mat(0xff2e5f, { emissive: 0xff2e5f, emissiveIntensity: 1.8, metalness: 0.5, roughness: 0.3 }));
      node.position.set(nx, 6, nz);
      g.add(node);
      this.nodes.push({ mesh: node, alive: true, worldPos: center.clone().add(new THREE.Vector3(nx, 6, nz)) });
    }

    this.group = g;
    this.kit = game.zone;
    game.zone.group.add(g);
    bus.on('pulse', (e) => { if (this.game.zone === this.kit) this.onPulse(e); });
  }

  get arenaActive() { return this.phase === 'nodes' || this.phase === 'core'; }

  start() {
    if (this.phase !== 'idle') return;
    this.phase = 'nodes';
    const g = this.game;
    g.audio.playMusic('boss');
    g.audio.sfx('evil');
    g.bossBanner('MEGA FOREHEAD REBAR MACHINE');
    g.shake(0.28, 0.6);
    g.toast('DESTROY THE 4 CORRUPTION NODES! PULSE (G) OR TROLLEY RAM!', 'red');
  }

  onPulse(e) {
    if (this.phase === 'nodes') {
      for (const n of this.nodes) {
        if (n.alive && e.pos.distanceTo(n.worldPos) < e.radius + 3.5) this.killNode(n);
      }
    } else if (this.phase === 'core') {
      const corePos = this.center.clone().add(new THREE.Vector3(0, 12.5, 4.2));
      // Core is high up — pulse near the machine base counts (Bung tech)
      if (e.pos.distanceTo(this.center) < e.radius + 9) {
        this.coreHits++;
        const g = this.game;
        g.audio.sfx('bonk');
        g.fx.burst(corePos, 0x2ee6ff, 30);
        g.toast(`CORE HIT ${this.coreHits}/3!`, 'blue');
        g.say('gabor', ['NO! MY STRATEGY!', 'THE FOREHEAD WEAKENS!', 'IMPOSSIBLE!!'][Math.min(2, this.coreHits - 1)]);
        if (this.coreHits >= 3) this.die();
      }
    }
  }

  killNode(n) {
    n.alive = false;
    n.mesh.visible = false;
    const g = this.game;
    g.audio.sfx('explode');
    g.fx.burst(n.worldPos, 0xff2e5f, 30);
    bus.emit('qe', { type: 'tower', target: 'any' });
    const left = this.nodes.filter((x) => x.alive).length;
    if (left > 0) {
      g.toast(`CORRUPTION NODE DOWN — ${left} REMAINING`, 'red');
      g.say('gabor', 'Stop touching my nodes!');
    } else {
      this.phase = 'core';
      this.core.visible = true;
      g.toast('CORE EXPOSED! PULSE THE MACHINE 3x!', 'blue');
      g.say('ching', 'The core is exposed! Hit it with everything, Bung!');
      g.audio.sfx('unlock');
    }
  }

  die() {
    this.phase = 'dead';
    const g = this.game;
    g.bossBanner('');
    // Cinematic chain of explosions
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        g.audio.sfx('explode');
        g.fx.burst(this.center.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 12, 4 + Math.random() * 16, (Math.random() - 0.5) * 12)), 0xffc23d, 30);
      }, i * 350);
    }
    setTimeout(() => {
      this.group.visible = false;
      g.audio.playMusic(g.zone.music);
      g.say('gabor', 'This changes nothing! I will return with an even BIGGER forehead!');
      bus.emit('qe', { type: 'boss', target: 'final' });
    }, 3000);
    for (const d of this.drones) if (!d.dead) d.die();
  }

  update(dt) {
    if (this.phase === 'dead') return;
    this.forehead.rotation.y += dt * 0.4;

    if (!this.arenaActive) return;
    const g = this.game;

    // Trolley ram on nodes
    if (this.phase === 'nodes' && g.trolley.riding && Math.abs(g.trolley.speed) > 14) {
      for (const n of this.nodes) {
        if (n.alive && g.trolley.pos.distanceTo(n.worldPos.clone().setY(g.trolley.pos.y)) < 3) {
          this.killNode(n);
          g.trolley.speed *= -0.4;
          g.say('bung', 'TROLLEY RAM! Do not question the trolley!');
        }
      }
    }

    // Shockwave attack — jump to dodge
    this.shockT -= dt;
    if (this.shockT <= 0) {
      this.shockT = this.phase === 'core' ? 4.5 : 6.5;
      this.shockwaves.push({ r: 2, speed: 11 });
      g.audio.sfx('pulse');
      g.fx.ring(this.center.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xff2e5f, 6);
    }
    for (const sw of this.shockwaves) {
      sw.r += sw.speed * dt;
      if (Math.floor(sw.r) % 4 === 0) g.fx.ring(this.center.clone().add(new THREE.Vector3(0, 0.4, 0)), 0xff2e5f, sw.r);
      const playerPos = g.trolley.riding ? g.trolley.pos : g.player.pos;
      const pd = Math.hypot(playerPos.x - this.center.x, playerPos.z - this.center.z);
      const grounded = g.trolley.riding ? g.trolley.grounded : g.player.grounded;
      if (Math.abs(pd - sw.r) < 1.4 && grounded && playerPos.y < this.center.y + 2 && !sw.hit) {
        sw.hit = true;
        g.damagePlayer(16, this.center);
        g.say('bung', 'OI! Rude shockwave!');
      }
    }
    this.shockwaves = this.shockwaves.filter((sw) => sw.r < 45);

    // Drone reinforcements
    this.droneT -= dt;
    if (this.droneT <= 0 && this.drones.filter((d) => !d.dead).length < 3) {
      this.droneT = 9;
      const a = Math.random() * Math.PI * 2;
      const e = new Enemy(g, 'drone', this.center.clone().add(new THREE.Vector3(Math.cos(a) * 10, 5, Math.sin(a) * 10)));
      this.drones.push(e);
    }
    for (const d of this.drones) d.update(dt);
  }
}
