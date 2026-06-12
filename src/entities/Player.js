// Bung Bunty player controller: waddle-running, jumping, grappling,
// belly-bouncing chaos. Position is at Bung's feet.
import * as THREE from 'three';
import { clamp, damp, dampAngle } from '../core/utils.js';
import { state, bus, upgLevel, addEnergy } from '../core/state.js';
import { buildBung } from './models.js';

const GRAVITY = 26;

export class Player {
  constructor(game) {
    this.game = game;
    this.mesh = buildBung();
    this.parts = this.mesh.userData.parts;
    // Soft follow light so Bung reads clearly in Red Mode zones
    const glow = new THREE.PointLight(0xfff2e0, 12, 14, 1.8);
    glow.position.set(0, 3, 1.5);
    this.mesh.add(glow);
    game.scene.add(this.mesh);

    this.pos = new THREE.Vector3(0, 2, 0);
    this.vel = new THREE.Vector3();
    this.facing = 0;
    this.grounded = false;
    this.coyote = 0;          // coyote time: grace period after leaving a ledge
    this.jumpBuffer = 0;      // jump buffering: press slightly before landing
    this.jumpsLeft = 1;
    this.isSprinting = false; // read by the camera for sprint FOV
    this.grappleTarget = null; // current aim-highlighted grapple point (reticle)
    this._targetScanT = 0;
    this.animT = 0;
    this.idleT = 0;
    this.attackCD = 0;
    this.pulseCD = 0;
    this.hurtCD = 0;
    this.fallPeak = 0;
    this.radius = 0.55;

    // Grapple state
    this.grappling = false;
    this.grapplePoint = new THREE.Vector3();
    this.grappleCD = 0;
    this.grappleLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: 0xffc23d, linewidth: 2 })
    );
    this.grappleLine.visible = false;
    this.grappleLine.frustumCulled = false;
    game.scene.add(this.grappleLine);

    this._ray = new THREE.Raycaster();
    this._down = new THREE.Vector3(0, -1, 0);
  }

  get sprintSpeed() { return 10 + upgLevel('sprint') * 1.5 + (state.buffs.speed > 0 ? 3 : 0); }
  get runSpeed() { return 6.2 + (state.buffs.speed > 0 ? 2 : 0); }
  get jumpVel() { return 9.5 + upgLevel('jumph') * 0.9; }
  get maxJumps() { return 1 + (upgLevel('jump2') ? 1 : 0); }
  get grappleRange() { return 26 + upgLevel('grange') * 8; }
  get pullSpeed() { return 19 + upgLevel('gpull') * 4; }

  teleport(v) {
    this.pos.copy(v);
    this.vel.set(0, 0, 0);
    this.grappling = false;
    this.grappleLine.visible = false;
  }

  update(dt) {
    const g = this.game, input = g.input;
    this.attackCD = Math.max(0, this.attackCD - dt);
    this.pulseCD = Math.max(0, this.pulseCD - dt);
    this.grappleCD = Math.max(0, this.grappleCD - dt);
    this.hurtCD = Math.max(0, this.hurtCD - dt);

    if (g.trolley.riding) {
      // Bung sits in the basket — trolley positions the mesh.
      this.pos.copy(g.trolley.pos);
      this.grappling = false;
      this.grappleLine.visible = false;
      // Rebar Pulse still works from the trolley (essential for the chase)
      if (input.pressed['KeyG'] && this.pulseCD <= 0) this.rebarPulse();
      return;
    }

    // ---- Movement input relative to camera yaw ----
    const ax = input.axis();
    const yaw = g.camYaw;
    const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const move = new THREE.Vector3()
      .addScaledVector(fwd, ax.y)
      .addScaledVector(right, ax.x);
    if (move.lengthSq() > 0) move.normalize();

    const sprinting = (input.keys['ShiftLeft'] || input.keys['ShiftRight']) && move.lengthSq() > 0;
    this.isSprinting = sprinting && this.grounded;
    const speed = sprinting ? this.sprintSpeed : this.runSpeed;
    const accel = this.grounded ? 38 : 14 + upgLevel('gair') * 6;
    // Snappier stop than start: feels weighty but responsive
    const lambda = move.lengthSq() > 0 ? accel / speed * 2.2 : accel / speed * 3.0;
    this.vel.x = damp(this.vel.x, move.x * speed, lambda, dt);
    this.vel.z = damp(this.vel.z, move.z * speed, lambda, dt);

    // ---- Jumping (coyote time + jump buffering) ----
    if (this.grounded) { this.coyote = 0.12; this.jumpsLeft = this.maxJumps; }
    else this.coyote = Math.max(0, this.coyote - dt);
    // Buffer the press: pressing Space up to 0.13s before landing still jumps.
    if (input.pressed['Space']) this.jumpBuffer = 0.13;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    if (this.jumpBuffer > 0 && !this.grappling) {
      // Walking off a ledge consumes the ground jump
      if (this.coyote <= 0 && this.jumpsLeft === this.maxJumps) this.jumpsLeft = this.maxJumps - 1;
      if (this.coyote > 0 || this.jumpsLeft > 0) {
        const isDouble = this.coyote <= 0;
        this.vel.y = this.jumpVel * (isDouble ? 0.92 : 1);
        if (isDouble) { g.audio.sfx('doubleJump'); g.fx.burst(this.pos, 0x2ee6ff, 10); }
        else g.audio.sfx('jump');
        this.jumpsLeft -= 1;
        this.coyote = 0;
        this.jumpBuffer = 0;
        this.grounded = false;
      }
    }

    // ---- Grapple ----
    this.updateGrapple(dt);

    // ---- Gravity ----
    if (!this.grappling) this.vel.y -= GRAVITY * dt;
    if (!this.grounded) this.fallPeak = Math.max(this.fallPeak, this.pos.y);

    // ---- Integrate ----
    this.pos.addScaledVector(this.vel, dt);

    // ---- Collisions ----
    this.collide(dt);

    // ---- Attacks ----
    if (input.pressed['KeyF'] && this.attackCD <= 0) this.bellyBounce();
    if (input.pressed['KeyG'] && this.pulseCD <= 0) this.rebarPulse();

    // ---- Fell off the world ----
    if (this.pos.y < -40) {
      g.say('bung', 'This is not a crash, this is tactical landing!');
      this.teleport(g.zone.spawn);
      g.damagePlayer(15, null, true);
    }

    // ---- Animate ----
    this.animate(dt, move.length() > 0, sprinting);

    this.mesh.position.copy(this.pos);
  }

  updateGrapple(dt) {
    const g = this.game, input = g.input;
    // Periodically scan for the aim-highlighted grapple point (HUD reticle)
    this._targetScanT -= dt;
    if (this._targetScanT <= 0) {
      this._targetScanT = 0.12;
      this.grappleTarget = this.grappleCD <= 0 && !this.grappling ? this.findGrapplePoint() : null;
    }

    if (input.pressed['KeyQ']) {
      if (this.grappling) {
        this.releaseGrapple(true);
      } else if (this.grappleCD <= 0) {
        const pt = this.findGrapplePoint();
        if (pt) {
          this.grappling = true;
          this.grapplePoint.copy(pt);
          g.audio.sfx('grappleFire');
          setTimeout(() => {
            g.audio.sfx('grappleHit');
            g.fx.burst(pt, 0xffc23d, 8, 3); // connect sparks
          }, 110);
        } else {
          g.audio.sfx('tick');
        }
      }
    }
    if (this.grappling) {
      const toPoint = this.grapplePoint.clone().sub(this.pos).sub(new THREE.Vector3(0, 1.2, 0));
      const dist = toPoint.length();
      toPoint.normalize();
      // Accelerate toward the point, keep some lateral momentum (swing feel)
      this.vel.addScaledVector(toPoint, this.pullSpeed * 2.6 * dt);
      const maxV = this.pullSpeed * 1.25;
      if (this.vel.length() > maxV) this.vel.setLength(maxV);
      if (dist < 2.2) this.releaseGrapple(false);
      // Update rope visual
      const pts = [this.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), this.grapplePoint];
      this.grappleLine.geometry.setFromPoints(pts);
      this.grappleLine.visible = true;
    } else {
      this.grappleLine.visible = false;
    }
  }

  releaseGrapple(manual) {
    this.grappling = false;
    this.grappleCD = 0.4;
    // Pop upward on release for flow
    this.vel.y = Math.max(this.vel.y, manual ? 6 : 8);
    this.jumpsLeft = Math.max(this.jumpsLeft, upgLevel('jump2') ? 1 : 0);
  }

  findGrapplePoint() {
    const g = this.game;
    const camDir = new THREE.Vector3();
    g.camera.getWorldDirection(camDir);
    let best = null, bestScore = Infinity;
    const head = this.pos.clone().add(new THREE.Vector3(0, 1.4, 0));
    for (const p of g.zone.grapplePoints) {
      const to = p.clone().sub(head);
      const dist = to.length();
      if (dist > this.grappleRange || dist < 3) continue;
      to.normalize();
      const dot = to.dot(camDir);
      if (dot < 0.55) continue; // must roughly aim at it
      const score = dist * (1.6 - dot);
      if (score < bestScore) { bestScore = score; best = p; }
    }
    return best;
  }

  bellyBounce() {
    const g = this.game;
    this.attackCD = 0.75;
    g.audio.sfx('belly');
    const radius = 3.6 + upgLevel('belly') * 0.8;
    const dmg = state.buffs.strength > 0 ? 3 : 2;
    // Lunge forward slightly
    const dir = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    this.vel.addScaledVector(dir, 5);
    g.fx.ring(this.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 0xffc23d, radius);
    g.hitEnemies(this.pos, radius, dmg, 'belly');
    // Belly squash animation kick
    this.parts.belly.scale.set(1.25, 0.9, 1.15);
  }

  rebarPulse() {
    const g = this.game;
    const cost = 25;
    if (state.energy < cost) { g.audio.sfx('denied'); g.toast('NOT ENOUGH REBAR ENERGY', 'red'); return; }
    state.energy -= cost;
    this.pulseCD = 1.2;
    g.audio.sfx('pulse');
    const radius = 7.5;
    g.fx.ring(this.pos.clone().add(new THREE.Vector3(0, 1, 0)), 0x2ee6ff, radius);
    g.fx.burst(this.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), 0x2ee6ff, 26);
    g.hitEnemies(this.pos, radius, 4, 'pulse');
    bus.emit('pulse', { pos: this.pos.clone(), radius });
    bus.emit('hud');
  }

  collide(dt) {
    const zone = this.game.zone;
    // Ground raycast from chest height downward
    this._ray.set(this.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), this._down);
    this._ray.far = 1.2 + Math.max(0.3, -this.vel.y * dt + 0.3);
    const hits = this._ray.intersectObjects(zone.grounds, false);
    let groundY = -Infinity;
    if (hits.length > 0) groundY = hits[0].point.y;

    const wasGrounded = this.grounded;
    if (this.vel.y <= 0 && this.pos.y <= groundY + 0.18) {
      this.pos.y = groundY;
      if (!wasGrounded) {
        const fall = this.fallPeak - this.pos.y;
        if (fall > 9) {
          this.game.audio.sfx('bigLand');
          this.game.fx.ring(this.pos, 0xffffff, 2.5);
          this.game.fx.burst(this.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), 0xbbb09a, 18, 4); // landing dust
          this.game.shake(0.22, 0.25);
          if (fall > 16) this.game.say('bung', 'This is not a crash, this is tactical landing.');
        } else if (fall > 2) {
          this.game.audio.sfx('land');
          this.game.fx.burst(this.pos.clone().add(new THREE.Vector3(0, 0.15, 0)), 0xbbb09a, 7, 2.5); // small dust puff
        }
        this.fallPeak = this.pos.y;
      }
      this.vel.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    // Wall push-out vs box colliders (XZ circle test)
    for (const b of zone.colliders) {
      if (this.pos.y > b.max.y - 0.25 || this.pos.y + 1.6 < b.min.y) continue;
      const cx = clamp(this.pos.x, b.min.x, b.max.x);
      const cz = clamp(this.pos.z, b.min.z, b.max.z);
      const dx = this.pos.x - cx, dz = this.pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < this.radius * this.radius) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (this.radius - d);
          this.pos.x += (dx / d) * push;
          this.pos.z += (dz / d) * push;
        } else {
          // Centre inside the box: push out along the smallest penetration axis
          const pens = [
            { v: this.pos.x - b.min.x + this.radius, axis: 'x', dir: -1 },
            { v: b.max.x - this.pos.x + this.radius, axis: 'x', dir: 1 },
            { v: this.pos.z - b.min.z + this.radius, axis: 'z', dir: -1 },
            { v: b.max.z - this.pos.z + this.radius, axis: 'z', dir: 1 },
          ].sort((a, c) => a.v - c.v)[0];
          if (pens.axis === 'x') this.pos.x += pens.dir * pens.v;
          else this.pos.z += pens.dir * pens.v;
        }
      }
    }
  }

  animate(dt, moving, sprinting) {
    const p = this.parts;
    // Recover belly squash
    p.belly.scale.x = damp(p.belly.scale.x, 1, 8, dt);
    p.belly.scale.y = damp(p.belly.scale.y, 1.12, 8, dt);
    p.belly.scale.z = damp(p.belly.scale.z, 0.92, 8, dt);

    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (moving && hSpeed > 0.5) {
      // Face movement direction
      const target = Math.atan2(this.vel.x, this.vel.z);
      this.facing = dampAngle(this.facing, target, 12, dt);
    }
    this.mesh.rotation.y = this.facing;

    if (!this.grounded) {
      // PANIC FLAIL
      this.animT += dt * 18;
      p.armL.rotation.x = Math.sin(this.animT) * 1.6;
      p.armR.rotation.x = Math.cos(this.animT) * 1.6;
      p.legL.rotation.x = Math.sin(this.animT + 1) * 0.9;
      p.legR.rotation.x = Math.cos(this.animT + 1) * 0.9;
      p.head.rotation.z = Math.sin(this.animT * 0.7) * 0.15;
    } else if (hSpeed > 0.8) {
      // WADDLE RUN — exaggerated side-to-side roll
      this.animT += dt * (sprinting ? 13 : 9);
      const s = Math.sin(this.animT);
      p.legL.rotation.x = s * 1.0;
      p.legR.rotation.x = -s * 1.0;
      p.armL.rotation.x = -s * 0.8;
      p.armR.rotation.x = s * 0.8;
      this.mesh.rotation.z = s * 0.09; // the waddle
      p.head.rotation.z = -s * 0.06;
      this.mesh.position.y = this.pos.y + Math.abs(Math.cos(this.animT)) * 0.08;
    } else {
      // IDLE — belly breathing + occasional singlet stretch
      this.idleT += dt;
      this.animT = 0;
      p.legL.rotation.x = damp(p.legL.rotation.x, 0, 10, dt);
      p.legR.rotation.x = damp(p.legR.rotation.x, 0, 10, dt);
      p.armL.rotation.x = damp(p.armL.rotation.x, 0, 10, dt);
      p.armR.rotation.x = damp(p.armR.rotation.x, 0, 10, dt);
      this.mesh.rotation.z = damp(this.mesh.rotation.z, 0, 10, dt);
      const breathe = Math.sin(this.idleT * 2.2) * 0.03;
      p.belly.scale.y = 1.12 + breathe;
      p.head.rotation.z = Math.sin(this.idleT * 0.8) * 0.05;
      // Singlet stretch idle every ~7s
      const phase = this.idleT % 7;
      if (phase > 6) {
        p.armL.rotation.x = -2.4 * Math.sin((phase - 6) * Math.PI);
        p.armR.rotation.x = -2.4 * Math.sin((phase - 6) * Math.PI);
      }
    }
  }
}
