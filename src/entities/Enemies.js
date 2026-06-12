// Goofy non-gory enemy roster. Every enemy is built from primitives and
// pops in a shower of harmless confetti when bonked.
import * as THREE from 'three';
import { mat, sphere, box, cyl, clamp, damp, addOutline } from '../core/utils.js';
import { state, bus } from '../core/state.js';

export const ENEMY_DEFS = {
  drone: {       // Gabor Drones — small flying pests
    hp: 2, speed: 6.5, damage: 10, fly: true, hover: 2.6, color: 0x8f1fff, score: 30,
  },
  gremlin: {     // Scooter Gremlins — fast ground chasers
    hp: 2, speed: 8.5, damage: 8, fly: false, hover: 0, color: 0x44b04a, score: 25,
  },
  leech: {       // Portal Leeches — drain your Rebar Chain on touch
    hp: 1, speed: 5, damage: 4, fly: true, hover: 2.2, color: 0xd14fd1, score: 20, drainsCombo: true,
  },
  blob: {        // Typhoon Blobs — bouncing rain blobs
    hp: 3, speed: 4, damage: 12, fly: false, hover: 0, color: 0x3fa7d9, score: 35, bounces: true,
  },
  bug: {         // Cyber Rebar Bugs — fast Red Mode fliers
    hp: 3, speed: 9.5, damage: 14, fly: true, hover: 2.0, color: 0xff2e5f, score: 50,
  },
  bandit: {      // Burger Bandits — steal coins on touch
    hp: 2, speed: 7, damage: 6, fly: false, hover: 0, color: 0xe8a755, score: 30, stealsCoins: true,
  },
};

function buildEnemyMesh(kind) {
  const def = ENEMY_DEFS[kind];
  const g = new THREE.Group();
  if (kind === 'drone' || kind === 'bug') {
    const body = sphere(0.38, mat(def.color, { emissive: def.color, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.4 }), 10, 8);
    body.scale.y = 0.7; g.add(body);
    // Rotors
    for (const sx of [-1, 1]) {
      const rotor = box(0.5, 0.03, 0.1, mat(0x2a2a30, { roughness: 0.6 }));
      rotor.position.set(sx * 0.42, 0.22, 0);
      g.add(rotor);
      g.userData['rotor' + (sx > 0 ? 'R' : 'L')] = rotor;
    }
    // Angry eye — also used as the attack telegraph (pulses when closing in)
    const eye = sphere(0.12, mat(0xff2e2e, { emissive: 0xff2e2e, emissiveIntensity: 2 }), 8, 6);
    eye.position.set(0, 0, 0.32); g.add(eye);
    g.userData.eye = eye;
    if (kind === 'bug') { // antennae
      for (const sx of [-1, 1]) {
        const ant = cyl(0.01, 0.02, 0.4, mat(0xff2e5f, { emissive: 0xff2e5f }), 4);
        ant.position.set(sx * 0.15, 0.4, 0.1); ant.rotation.z = sx * -0.4; g.add(ant);
      }
    }
    // Glowing hover ring under the chassis (readable flier silhouette)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 6, 18),
      mat(kind === 'bug' ? 0xff2e5f : 0x8f1fff, { emissive: kind === 'bug' ? 0xff2e5f : 0x8f1fff, emissiveIntensity: 1.6 }));
    ring.position.y = -0.22;
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    g.userData.hoverRing = ring;
  } else if (kind === 'blob') {
    const body = sphere(0.55, mat(def.color, { transparent: true, opacity: 0.85, roughness: 0.2, emissive: 0x0a2a3a }), 12, 10);
    g.add(body); g.userData.body = body;
    for (const sx of [-1, 1]) {
      const eye = sphere(0.09, mat(0xffffff), 6, 4);
      eye.position.set(sx * 0.18, 0.15, 0.45); g.add(eye);
      const pupil = sphere(0.045, mat(0x111111), 5, 4);
      pupil.position.set(sx * 0.18, 0.15, 0.52); g.add(pupil);
    }
  } else {
    // Ground gremlins / bandits — little goblin dudes
    const body = sphere(0.32, mat(def.color, { roughness: 0.8 }), 10, 8);
    body.position.y = 0.45; body.scale.y = 1.2; g.add(body);
    const head = sphere(0.2, mat(def.color, { roughness: 0.8 }), 8, 6);
    head.position.y = 0.92; g.add(head);
    for (const sx of [-1, 1]) {
      const ear = cyl(0.02, 0.07, 0.22, mat(def.color, { roughness: 0.8 }), 5);
      ear.position.set(sx * 0.18, 1.08, 0); ear.rotation.z = sx * -0.6; g.add(ear);
      const eye = sphere(0.05, mat(0xffe53d, { emissive: 0xffe53d, emissiveIntensity: 1.5 }), 5, 4);
      eye.position.set(sx * 0.08, 0.95, 0.17); g.add(eye);
      const leg = cyl(0.05, 0.06, 0.3, mat(def.color, { roughness: 0.9 }), 5);
      leg.position.set(sx * 0.12, 0.15, 0); g.add(leg);
      g.userData['leg' + (sx > 0 ? 'R' : 'L')] = leg;
    }
    if (kind === 'bandit') { // tiny burger hat
      const hat = cyl(0.12, 0.12, 0.08, mat(0xe8a755, { roughness: 0.9 }), 8);
      hat.position.y = 1.14; g.add(hat);
      const patty = cyl(0.13, 0.13, 0.03, mat(0x6b3a1f), 8);
      patty.position.y = 1.1; g.add(patty);
    }
    if (kind === 'gremlin') { // mini scooter board under feet
      const deck = box(0.3, 0.04, 0.5, mat(0x6c1fb8, { metalness: 0.5 }));
      deck.position.y = 0.02; g.add(deck);
    }
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  addOutline(g, 0.07); // cartoon ink — enemies must read instantly
  return g;
}

export class Enemy {
  constructor(game, kind, pos) {
    this.game = game;
    this.kind = kind;
    this.def = ENEMY_DEFS[kind];
    this.hp = this.def.hp;
    this.pos = pos.clone();
    this.home = pos.clone();
    this.vel = new THREE.Vector3();
    this.mesh = buildEnemyMesh(kind);
    this.mesh.position.copy(pos);
    this.t = Math.random() * 10;
    this.hitCD = 0;
    this.stunT = 0;
    this.dead = false;
    this.bounceVy = 0;
    game.zone.group.add(this.mesh);
    game.allEnemies.push(this);
  }

  update(dt) {
    if (this.dead) return;
    this.t += dt;
    this.hitCD = Math.max(0, this.hitCD - dt);
    this.stunT = Math.max(0, this.stunT - dt);

    const g = this.game;
    const target = g.trolley.riding ? g.trolley.pos : g.player.pos;
    const toPlayer = target.clone().sub(this.pos);
    const distXZ = Math.hypot(toPlayer.x, toPlayer.z);

    // Difficulty scales with score: faster + more aggressive aggro range
    const aggro = 22 + Math.min(20, state.score / 800);
    const speedMul = 1 + Math.min(0.6, state.score / 12000) + (state.buffs.cyber > 0 && this.kind === 'bug' ? -0.3 : 0);

    if (this.stunT <= 0 && distXZ < aggro) {
      const dir = toPlayer.clone();
      if (this.def.fly) dir.y = (target.y + this.def.hover) - this.pos.y;
      else dir.y = 0;
      dir.normalize();
      this.vel.x = damp(this.vel.x, dir.x * this.def.speed * speedMul, 4, dt);
      this.vel.z = damp(this.vel.z, dir.z * this.def.speed * speedMul, 4, dt);
      if (this.def.fly) this.vel.y = damp(this.vel.y, dir.y * this.def.speed * 0.8, 4, dt);
    } else {
      // Idle drift back toward home
      const home = this.home.clone().sub(this.pos); home.y = 0;
      if (home.length() > 3) home.normalize().multiplyScalar(this.def.speed * 0.3);
      this.vel.x = damp(this.vel.x, home.x, 2, dt);
      this.vel.z = damp(this.vel.z, home.z, 2, dt);
      if (this.def.fly) this.vel.y = damp(this.vel.y, Math.sin(this.t * 2) * 0.5, 2, dt);
    }

    // Typhoon blobs bounce
    if (this.def.bounces) {
      this.bounceVy -= 22 * dt;
      this.pos.y += this.bounceVy * dt;
      const floor = this.home.y;
      if (this.pos.y <= floor) { this.pos.y = floor; this.bounceVy = 8 + Math.random() * 3; }
    } else if (!this.def.fly) {
      this.pos.y = damp(this.pos.y, this.home.y, 6, dt);
    }

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    if (this.def.fly) this.pos.y += this.vel.y * dt;

    // Touch the player → bonk
    const pdist = this.pos.distanceTo(target.clone().add(new THREE.Vector3(0, this.def.fly ? 1.2 : 0.4, 0)));
    if (pdist < 1.45 && this.hitCD <= 0) {
      this.hitCD = 1.2;
      g.damagePlayer(this.def.damage, this.pos);
      if (this.def.drainsCombo && state.combo > 0) {
        g.breakCombo('PORTAL LEECH DRAINED YOUR CHAIN!');
      }
      if (this.def.stealsCoins && state.coins > 0) {
        const steal = Math.min(10, state.coins);
        state.coins -= steal;
        g.toast(`BURGER BANDIT NICKED ${steal} COINS!`, 'red');
        bus.emit('hud');
      }
      // Knock the enemy back a bit too
      const kb = this.pos.clone().sub(target).setY(0).normalize();
      this.vel.addScaledVector(kb, 6);
      this.stunT = 0.6;
    }

    // ---- Animate ----
    this.mesh.position.copy(this.pos);
    if (this.mesh.userData.rotorL) {
      this.mesh.userData.rotorL.rotation.y += dt * 30;
      this.mesh.userData.rotorR.rotation.y -= dt * 30;
    }
    if (this.mesh.userData.hoverRing) this.mesh.userData.hoverRing.rotation.z = this.t * 2;
    if (this.mesh.userData.legL) {
      const s = Math.sin(this.t * 12);
      this.mesh.userData.legL.rotation.x = s * 0.8;
      this.mesh.userData.legR.rotation.x = -s * 0.8;
    }
    if (this.mesh.userData.body) {
      const squash = this.pos.y <= this.home.y + 0.1 ? 0.75 : 1.05;
      this.mesh.userData.body.scale.y = damp(this.mesh.userData.body.scale.y, squash, 10, dt);
    }
    // Telegraph: flier eyes pulse hard when they're about to reach you,
    // so incoming damage is always readable.
    if (this.mesh.userData.eye) {
      const threat = distXZ < 7 && this.stunT <= 0;
      const s = threat ? 1.5 + Math.sin(this.t * 18) * 0.5 : 1;
      this.mesh.userData.eye.scale.setScalar(s);
    }
    const speed2 = Math.hypot(this.vel.x, this.vel.z);
    if (speed2 > 0.5) this.mesh.rotation.y = Math.atan2(this.vel.x, this.vel.z);
  }

  hit(dmg, sourcePos) {
    if (this.dead) return;
    this.hp -= dmg;
    this.stunT = 0.7;
    const g = this.game;
    g.audio.sfx('bonk');
    const kb = this.pos.clone().sub(sourcePos).setY(0).normalize();
    this.vel.addScaledVector(kb, 11);
    if (this.def.fly) this.vel.y = 4;
    g.fx.burst(this.pos, this.def.color, 8);
    if (this.hp <= 0) this.die();
  }

  die() {
    this.dead = true;
    const g = this.game;
    g.audio.sfx('explode');
    g.fx.burst(this.pos, this.def.color, 26);
    g.fx.burst(this.pos, 0xffc23d, 12);
    // Score routes through the ChainManager (chain multiplier applies)
    const gained = g.chain.addScore(this.def.score, 'enemy:' + this.kind);
    g.fx.scorePopup(this.pos, `+${gained}`, this.def.color);
    bus.emit('hud');
    bus.emit('qe', { type: 'defeat', target: this.kind });
    bus.emit('qe', { type: 'defeat', target: 'any' });
    this.mesh.visible = false;
  }
}

// Spawner: keeps `count` enemies of a kind alive within a radius.
export class Spawner {
  constructor(game, kind, center, radius, count, respawnDelay = 12) {
    this.game = game;
    this.kind = kind;
    this.center = center.clone();
    this.radius = radius;
    this.count = count;
    this.respawnDelay = respawnDelay;
    this.enemies = [];
    this.timer = 0;
    for (let i = 0; i < count; i++) this.spawn();
  }

  spawn() {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * this.radius;
    const def = ENEMY_DEFS[this.kind];
    const pos = this.center.clone().add(new THREE.Vector3(Math.cos(a) * r, def.fly ? def.hover + 1 : 0, Math.sin(a) * r));
    const e = new Enemy(this.game, this.kind, pos);
    this.enemies.push(e);
    return e;
  }

  update(dt) {
    for (const e of this.enemies) e.update(dt);
    // Respawn dead enemies (scales slightly with score)
    this.timer += dt;
    const interval = Math.max(5, this.respawnDelay - state.score / 4000);
    if (this.timer > interval) {
      this.timer = 0;
      const alive = this.enemies.filter((e) => !e.dead).length;
      const cap = this.count + Math.floor(Math.min(3, state.score / 5000));
      if (alive < cap) this.spawn();
    }
    this.enemies = this.enemies.filter((e) => !e.dead || e.mesh.visible);
  }
}
