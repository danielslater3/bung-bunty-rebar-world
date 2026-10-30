// The Golden James Rebar Trolley — summonable motorised shopping trolley.
// Arcade vehicle physics: heading + speed model with a proper boost state
// machine, drift mini-boosts, ramp launches, correctly-axled spinning wheels
// and a golden particle trail. The trolley never lies.
import * as THREE from 'three';
import { moveHorizontal, positionClear, resolveHorizontal } from '../core/motion.js';
import { clamp, damp } from '../core/utils.js';
import { surfaceY } from '../world/geo/project.js';
import { pushFootprints } from '../world/geo/footprints.js';
import { state, bus, upgLevel } from '../core/state.js';
import { buildTrolley, trolleySpec } from './models.js';
import { dlog } from '../core/Debug.js';

const GRAVITY = 26;
// Minimum fuel required to START a boost. Boost may continue down to 0,
// but cannot begin again until fuel climbs back above this. Combined with
// the Shift "latch" below this kills the old bug where trickle fuel regen
// restarted the boost loop every few frames while Shift was held at ~0 fuel.
const BOOST_MIN_START_FUEL = 8;

export class Trolley {
  constructor(game) {
    this.game = game;
    this.mesh = buildTrolley(state.trolley || 'james');
    this.mesh.visible = false;
    game.scene.add(this.mesh);
    this.head = new THREE.SpotLight(0xfff1c9, 0, 18, 0.55, 0.45, 1.2);
    this.head.castShadow = false;
    this.headTarget = new THREE.Object3D();
    game.scene.add(this.head);
    game.scene.add(this.headTarget);
    this.head.target = this.headTarget;
    this.wheels = this.mesh.userData.wheels;          // [{steer, spin, front}]
    this.wheelRadius = this.mesh.userData.wheelRadius;
    this.wheelSpinAxis = this.mesh.userData.wheelSpinAxis;

    this.pos = new THREE.Vector3(0, 0, 0);
    this.heading = 0;
    this.speed = 0;
    this.vy = 0;
    this.grounded = true;
    this.riding = false;
    this.summoned = false;
    this.drifting = false;
    this.driftCharge = 0;
    this.engineT = 0;
    this.airT = 0;
    this.steerVisual = 0;
    this.wheelOmega = 0;       // current wheel angular velocity (rad/s)

    // ---- BOOST STATE (see setBoosting for the transition rules) ----
    this.boosting = false;     // is_boosting — the ONE flag everything reads
    this.boostLockout = false; // true after fuel ran dry while Shift was held

    this._ray = new THREE.Raycaster();
    this._down = new THREE.Vector3(0, -1, 0);

    // Golden particle trail
    const COUNT = 110;
    this.trailPositions = new Float32Array(COUNT * 3);
    this.trailLife = new Float32Array(COUNT).fill(0);
    this.trailIdx = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));
    this.trail = new THREE.Points(geo, new THREE.PointsMaterial({
      color: trolleySpec(state.trolley).trail, size: 0.35, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.trail.frustumCulled = false;
    game.scene.add(this.trail);
  }

  get spec() { return trolleySpec(state.trolley); }
  get maxSpeed() {
    let m = (18 + upgLevel('turbo') * 2.5) * this.spec.speed * (this.boosting ? 1.55 : 1);
    if (state.saga?.trolleyDamage) m *= 0.42;
    if (state.saga?.bigBoy) m *= 1.32;
    return m;
  }
  get accel() {
    let a = (16 + upgLevel('turbo') * 2) * this.spec.accel;
    if (state.saga?.trolleyDamage) a *= 0.45;
    if (state.saga?.bigBoy) a *= 1.35;
    return a;
  }
  get turnRate() { return (1.9 + upgLevel('handling') * 0.35) * this.spec.turn; }
  get fuelMax() { return (60 + upgLevel('tank') * 30) * this.spec.fuel; }

  // ============ BOOST STATE MACHINE ============
  // Transitions (the ONLY place boost audio/FX start or stop):
  //   OFF → ON : riding && Shift held && throttle > 0 && fuel >= MIN_START
  //              && !boostLockout
  //   ON → OFF : Shift released | fuel hits 0 | dismount/dismiss | pause
  // When fuel hits 0 while Shift is still held we engage boostLockout, which
  // only clears when Shift is RELEASED. So: hold Shift at 0 fuel → silence,
  // even if passive regen pushes fuel above 0 again. A fresh Shift press
  // with fuel >= MIN_START boosts normally.
  setBoosting(on, reason = '') {
    if (on === this.boosting) return;
    this.boosting = on;
    const g = this.game;
    if (on) {
      dlog('boost', 'START', reason);
      g.audio.sfx('boost');             // one-shot ignition blip
      g.audio.startLoop('boost');       // loop starts ONCE here
      g.shake(0.18, 0.25);
      bus.emit('qe', { type: 'boost', target: 'trolley' });
    } else {
      dlog('boost', 'END', reason);
      g.audio.stopLoop('boost');        // loop stops ONCE here
      // FOV recovery + camera shake decay are handled by Game.updateCamera,
      // which reads this.boosting — nothing else to reset manually.
    }
  }

  applyFleet(id) {
    const spec = trolleySpec(id);
    state.trolley = spec.id;
    const next = buildTrolley(spec.id);
    next.visible = this.summoned;
    next.position.copy(this.mesh.position);
    next.rotation.copy(this.mesh.rotation);
    this.game.scene.remove(this.mesh);
    this.mesh = next;
    this.wheels = next.userData.wheels;
    this.wheelRadius = next.userData.wheelRadius;
    this.wheelSpinAxis = next.userData.wheelSpinAxis;
    this.game.scene.add(this.mesh);
    this.trail.material.color.setHex(spec.trail);
    this.head.color.setHex(spec.glow);
    bus.emit('hud');
    this.game.toast(spec.name);
    if (this.game.mode === 'playing') this.game.say('bung', spec.blurb);
  }

  cycle() {
    if (!state.flags.trolleyUnlocked) {
      this.game.toast('TROLLEY NOT UNLOCKED — VISIT THE GARAGE', 'red');
      this.game.audio.sfx('denied');
      return;
    }
    const order = ['james', 'ferry', 'night', 'bun', 'iron'];
    const i = order.indexOf(this.spec.id);
    this.applyFleet(order[(i + 1) % order.length]);
    this.game.audio.sfx('trolleyStart');
  }

  summon() {
    const g = this.game;
    if (!state.flags.trolleyUnlocked) {
      g.toast('TROLLEY NOT UNLOCKED — VISIT THE GARAGE', 'red');
      g.audio.sfx('denied');
      return;
    }
    const p = g.player;
    const bay = g.saga?.actors?.house?.garage;
    const inside = bay && p.pos.x > bay.minX && p.pos.x < bay.maxX && p.pos.z > bay.minZ && p.pos.z < bay.maxZ;
    if (inside) {
      this.pos.set(bay.cx, p.pos.y + 0.15, bay.cz);
      this.heading = bay.heading;
      g.saga.openGarage?.();
    } else {
      const dir = new THREE.Vector3(Math.sin(p.facing), 0, Math.cos(p.facing));
      this.pos.copy(p.pos).addScaledVector(dir, 2.2);
      this.pos.y = p.pos.y + 0.5;
      this.heading = p.facing;
    }
    this.speed = 0; this.vy = 0;
    this.summoned = true;
    this.mesh.visible = true;
    g.audio.sfx('trolleyStart');
    g.fx.burst(this.pos.clone().add(new THREE.Vector3(0, 0.6, 0)), 0xffc23d, 22);
    g.say('bung', 'Golden trolley mode engaged!');
  }

  dismiss() {
    this.setBoosting(false, 'dismissed');
    this.summoned = false;
    this.riding = false;
    this.mesh.visible = false;
  }

  mount() {
    const g = this.game;
    this.riding = true;
    g.audio.sfx('trolleyStart');
    bus.emit('qe', { type: 'mount', target: 'trolley' });
    g.player.mesh.position.copy(this.pos);
    if (Math.random() < 0.25) g.say('bung', 'Golden trolley mode is not legally recognised aviation.');
  }

  dismount() {
    const g = this.game;
    let landing = null;
    for(const angle of [Math.PI/2,-Math.PI/2,Math.PI,0,Math.PI/4,-Math.PI/4]) {
      const a=this.heading+angle;
      const p=this.pos.clone().add(new THREE.Vector3(Math.sin(a)*1.6,.15,Math.cos(a)*1.6));
      if(positionClear(p,g.player.radius,g.zone)) {landing=p;break;}
    }
    if(!landing){g.toast('NO ROOM TO HOP OFF — ROLL INTO THE CLEAR', 'gold');return;}
    this.setBoosting(false, 'dismounted'); this.riding=false;
    g.player.teleport(landing);
    this.speed=0;
  }

  overWater() {
    const zone = this.game.zone;
    if (!zone?.swimInfo) return null;
    const swim = zone.swimInfo(this.pos.x, this.pos.z, this.pos.y);
    if (!swim) return null;
    const deck = surfaceY(zone, this.pos.x, this.pos.z, this.pos.y);
    if (deck > swim.surface + 0.45) return null;
    return swim;
  }

  update(dt) {
    if (!this.summoned) return;
    const g = this.game, input = g.input;
    let steer = 0;
    const afloat = this.overWater();

    if (this.riding) {
      // ---- Driving input ----
      const ax = g.saga?.freeze ? { x: 0, y: 0 } : input.axis();
      const throttle = afloat ? 0 : ax.y;
      steer = -ax.x * (afloat ? 0.25 : 1);

      // ---- Boost evaluation (state transitions only — no per-frame audio) ----
      const shiftHeld = input.keys['ShiftLeft'] || input.keys['ShiftRight'];
      if (!shiftHeld) this.boostLockout = false;   // releasing Shift clears the latch
      if (this.boosting) {
        // Drain fuel; the instant it hits 0, boost ends and locks out.
        state.fuel = Math.max(0, state.fuel - dt * (6 - upgLevel('tank') * 0.5));
        bus.emit('hud');
        if (!shiftHeld) this.setBoosting(false, 'shift released');
        else if (state.fuel <= 0) {
          this.boostLockout = true;
          this.setBoosting(false, 'fuel empty');
          g.toast('TROLLEY FUEL DEPLETED', 'red');
        } else if (throttle <= 0) this.setBoosting(false, 'no throttle');
      } else if (!afloat && shiftHeld && !this.boostLockout && throttle > 0 && state.fuel >= BOOST_MIN_START_FUEL) {
        this.setBoosting(true, 'shift pressed with fuel');
      }

      // ---- Drift (Space while turning at speed) ----
      const wantDrift = input.keys['Space'] && Math.abs(steer) > 0.1 && Math.abs(this.speed) > 8 && this.grounded;
      if (wantDrift && !this.drifting) g.audio.sfx('drift');
      this.drifting = wantDrift;
      if (this.drifting) {
        steer *= 1.9 + upgLevel('drift') * 0.4;
        this.driftCharge = Math.min(1.5, this.driftCharge + dt);
        if (Math.random() < 0.6) g.fx.spark(this.pos.clone().add(new THREE.Vector3(0, 0.15, 0)), 0xffc23d);
      } else if (this.driftCharge > 0.4) {
        // Mini-boost on drift release
        this.speed += this.driftCharge * 4 * (1 + upgLevel('drift') * 0.3);
        g.fx.burst(this.pos.clone(), 0xffe9a8, 10);
        g.shake(0.1, 0.15);
        this.driftCharge = 0;
      } else this.driftCharge = 0;

      // ---- Speed model ----
      const accel = throttle > 0 ? this.accel * (this.boosting ? 1.8 : 1) : this.accel * 1.4;
      this.speed += throttle * accel * dt;
      this.speed = clamp(this.speed, -7, this.maxSpeed);
      this.speed = damp(this.speed, 0, throttle === 0 ? 1.2 : 0.08, dt);

      // Steering scales with speed
      const steerScale = clamp(Math.abs(this.speed) / 8, 0.2, 1) * Math.sign(this.speed || 1);
      this.heading += steer * this.turnRate * steerScale * dt;

      // Engine putter
      this.engineT += dt * (1 + Math.abs(this.speed) / 6);
      if (this.engineT > 0.6) { this.engineT = 0; if (Math.abs(this.speed) > 2) g.audio.sfx('tick'); }

      // Dismount (consume the key so the same press can't re-mount)
      if (input.pressed['KeyE'] && !g.saga?.objectiveInteraction(true)) {
        input.pressed['KeyE'] = false;
        this.dismount();
        return;
      }
    } else {
      this.speed = damp(this.speed, 0, 3, dt);
      // Safety: never boost while unmounted
      if (this.boosting) this.setBoosting(false, 'not riding');
    }

    // ---- Integrate position ----
    const fwd = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const hitWall = moveHorizontal(this.pos, fwd.x * this.speed * dt, fwd.z * this.speed * dt, .8, g.zone, 1.2);
    if (hitWall) this.speed *= Math.exp(-12 * dt);

    // Vertical: raycast ground follow + ballistic air
    this._ray.set(this.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), this._down);
    this._ray.far = 30;
    const hits = this._ray.intersectObjects(this.game.zone.grounds, false);
    const groundY = surfaceY(this.game.zone, this.pos.x, this.pos.z, this.pos.y, hits);
    const wet = this.overWater();

    if (wet) {
      if (!this.inWater) {
        this.inWater = true;
        g.fx.burst(new THREE.Vector3(this.pos.x, wet.surface, this.pos.z), 0x8ea36a, 24, 4.2);
        g.audio.sfx('splash');
      }
      if (this.boosting) this.setBoosting(false, 'water');
      const floatY = wet.surface - 0.5;
      this.vy += (floatY - this.pos.y) * 10 * dt;
      this.vy *= Math.exp(-2.6 * dt);
      this.pos.y += this.vy * dt;
      this.pos.x += 0.65 * dt;
      this.pos.z += 0.2 * dt;
      this.speed *= Math.exp(-4.8 * dt);
      this.grounded = false;
      this.drifting = false;
    } else {
      this.inWater = false;
    if (this.grounded) {
      if (this.pos.y - groundY > 0.6 || groundY === -Infinity) {
        this.grounded = false; // drove off an edge
        this.vy = 0;
      } else {
        this.pos.y = damp(this.pos.y, groundY, 20, dt);
        this.vy = 0;
      }
    }
    if (!this.grounded) {
      this.vy -= GRAVITY * dt;
      this.pos.y += this.vy * dt;
      this.airT += dt;
      if (this.pos.y <= groundY + 0.05 && this.vy <= 0) {
        this.pos.y = groundY;
        this.grounded = true;
        if (this.airT > 0.5) {
          this.game.audio.sfx('land');
          this.game.fx.ring(this.pos, 0xffc23d, 2);
          this.game.shake(0.12, 0.18);
        }
        this.airT = 0;
        this.vy = 0;
      }
    }
    }

    // Wall collisions — soft bounce
    for (const b of this.game.zone.colliders) {
      if (this.pos.y > b.max.y - 0.3 || this.pos.y + 1.2 < b.min.y) continue;
      const cx = clamp(this.pos.x, b.min.x, b.max.x);
      const cz = clamp(this.pos.z, b.min.z, b.max.z);
      const dx = this.pos.x - cx, dz = this.pos.z - cz;
      const d2 = dx * dx + dz * dz;
      const r = 0.8;
      if (d2 <= 1e-6 && this.pos.x >= b.min.x && this.pos.x <= b.max.x && this.pos.z >= b.min.z && this.pos.z <= b.max.z) {
        resolveHorizontal(this.pos, r, this.game.zone, 1.2); this.speed = 0;
      } else if (d2 < r * r && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        this.pos.x += (dx / d) * (r - d);
        this.pos.z += (dz / d) * (r - d);
        if (Math.abs(this.speed) > 10) {
          this.game.audio.sfx('bonk');
          this.game.shake(0.2, 0.2);
          this.game.say('bung', 'This is not a crash. This is tactical parking.');
        }
        this.speed *= -0.25;
      }
    }
    const trolleyPos = { x: this.pos.x, z: this.pos.z };
    pushFootprints(trolleyPos, 0.8, this.pos.y, this.game.zone);
    this.pos.x = trolleyPos.x;
    this.pos.z = trolleyPos.z;

    // Fell off the world
    if (this.pos.y < -40) {
      this.setBoosting(false, 'fell off world');
      this.pos.copy(this.game.zone.spawn).add(new THREE.Vector3(2, 1, 0));
      this.speed = 0; this.vy = 0; this.grounded = true;
      if (this.riding) this.game.damagePlayer(10, null, true);
    }

    // ============ VISUALS ============
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    this.mesh.rotation.z = damp(this.mesh.rotation.z, this.drifting ? -Math.sign(this.speed) * 0.12 : 0, 8, dt);

    // ---- Wheel rolling (correct axle = local X, see models.js) ----
    // omega = forward velocity / wheel radius. Reverse speed spins wheels
    // backward automatically (signed). Airborne: keep spinning on momentum,
    // decaying slowly. Stopped: omega is 0, wheels rest.
    if (this.grounded) this.wheelOmega = this.speed / this.wheelRadius;
    else this.wheelOmega = damp(this.wheelOmega, 0, 0.7, dt);
    const steerAngle = this.riding ? clamp(steer, -1, 1) * 0.45 : 0;
    this.steerVisual = damp(this.steerVisual, steerAngle, 10, dt);
    for (const w of this.wheels) {
      w.spin.rotation[this.wheelSpinAxis] += this.wheelOmega * dt;
      // Front wheels swivel on the steer pivot; rolling stays on the axle.
      if (w.front) w.steer.rotation.y = this.steerVisual;
    }

    // Trail particles — denser while boosting
    if (Math.abs(this.speed) > 6 || this.boosting) {
      const emit = this.boosting ? 2 : 1;
      for (let e = 0; e < emit; e++) {
        this.trailIdx = (this.trailIdx + 1) % this.trailLife.length;
        const i = this.trailIdx;
        this.trailPositions[i * 3] = this.pos.x + (Math.random() - 0.5) * 0.5;
        this.trailPositions[i * 3 + 1] = this.pos.y + 0.2 + Math.random() * 0.3;
        this.trailPositions[i * 3 + 2] = this.pos.z + (Math.random() - 0.5) * 0.5;
        this.trailLife[i] = 1;
      }
    }
    for (let i = 0; i < this.trailLife.length; i++) {
      if (this.trailLife[i] > 0) {
        this.trailLife[i] -= dt * 1.4;
        if (this.trailLife[i] <= 0) this.trailPositions[i * 3 + 1] = -999;
      }
    }
    this.trail.geometry.attributes.position.needsUpdate = true;

    if (!this._fwd) {
      this._fwd = new THREE.Vector3();
      this._headPos = new THREE.Vector3();
    }
    this._fwd.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    const lit = this.summoned && (this.riding || this.boosting);
    this.head.intensity = lit ? (this.boosting ? 6 : 2.4) : 0;
    this.head.position.copy(this.pos).add(this._headPos.set(0, 0.9, 0)).addScaledVector(this._fwd, 0.7);
    this.headTarget.position.copy(this.pos).add(this._headPos.set(0, 0.4, 0)).addScaledVector(this._fwd, 8);

    // Riding Bung pose
    if (this.riding) {
      const p = this.game.player;
      p.mesh.position.copy(this.pos).add(new THREE.Vector3(0, 0.55, 0));
      p.mesh.rotation.y = this.heading;
      p.mesh.rotation.z = 0;
      const parts = p.parts;
      parts.armL.rotation.x = -1.1; parts.armR.rotation.x = -1.1;
      parts.legL.rotation.x = 1.3; parts.legR.rotation.x = 1.3;
      p.facing = this.heading;
    }
  }

  // Called by ramp launch triggers
  launch(power = 1) {
    if (Math.abs(this.speed) < 6) return;
    this.grounded = false;
    this.vy = Math.max(this.vy, (7 + Math.abs(this.speed) * 0.35) * power * (1 + upgLevel('ramp') * 0.25));
    this.game.audio.sfx('ramp');
    this.game.shake(0.15, 0.2);
    this.game.say('bung', 'MAXIMUM REBAR VELOCITY!');
    bus.emit('qe', { type: 'ramp', target: 'trolley' });
  }

  refuel() {
    state.fuel = this.fuelMax;
    this.boostLockout = false; // a fresh tank deserves a fresh boost
    bus.emit('hud');
  }
}
