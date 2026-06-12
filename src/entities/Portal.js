// Floating score portals/rings — the core score mechanic of Rebar World.
//
// 2.0 detection: SWEPT SEGMENT CROSSING. Every frame we take the actor's
// previous position and current position (provided by Game.actorPrev) and
// test whether that segment crosses the portal plane. If it does, we compute
// the exact crossing point by interpolation and check its radial distance
// against a generous trigger radius. This is immune to tunnelling: no matter
// how fast Bung walks, jumps, grapples, or boosts the trolley through a
// portal, the crossing segment is always evaluated at the true intersection
// point. Works identically for every portal tier — one base logic, no
// duplicated per-type code.
import * as THREE from 'three';
import { mat } from '../core/utils.js';
import { state, bus, addEnergy } from '../core/state.js';
import { DEBUG, dlog } from '../core/Debug.js';

export const PORTAL_TIERS = {
  ring:   { color: 0xffc23d, score: 25,  radius: 2.6, name: 'TROLLEY RING' },
  bronze: { color: 0xc77b3f, score: 50,  radius: 2.4, name: 'BRONZE REBAR PORTAL' },
  silver: { color: 0xc9d6e3, score: 100, radius: 2.2, name: 'SILVER REBAR PORTAL' },
  gold:   { color: 0xffc23d, score: 200, radius: 2.0, name: 'GOLD REBAR PORTAL' },
  cyber:  { color: 0xff2e5f, score: 300, radius: 2.0, name: 'RED CYBER PORTAL' },
  glitch: { color: 0x8f1fff, score: 0,   radius: 2.2, name: 'GLITCHED GABOR PORTAL' },
};

// Cooldown long enough to stop double-trigger spam on a single pass, short
// enough to never block a genuine re-entry (you physically can't loop back
// through a ring in under half a second).
const PASS_COOLDOWN = 0.6;
// Trigger is deliberately more generous than the visible ring: clipping the
// rim should count. Feels fair; never feels cheated.
const TRIGGER_SLACK = 1.18;     // multiplier on visual radius
const TRIGGER_PAD = 0.35;       // flat extra metres
// Voice lines on portal passes are rate-limited so Bung doesn't narrate
// every single ring (shared across all portals).
let lastPortalVoice = -99;

export class Portal {
  constructor(game, tier, pos, ry = 0, rx = 0) {
    this.game = game;
    this.tier = tier;
    this.def = PORTAL_TIERS[tier];
    this.pos = pos.clone();
    this.cooldown = 0;

    const grp = new THREE.Group();
    grp.position.copy(pos);
    grp.rotation.y = ry;
    grp.rotation.x = rx;

    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(this.def.radius, 0.16, 10, 36),
      mat(this.def.color, { emissive: this.def.color, emissiveIntensity: 1.6, metalness: 0.6, roughness: 0.3 })
    );
    grp.add(torus);
    this.torus = torus;

    // Second inner ring for depth/premium feel
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(this.def.radius * 0.82, 0.05, 8, 30),
      mat(0xffffff, { emissive: this.def.color, emissiveIntensity: 2.2, metalness: 0.4, roughness: 0.2 })
    );
    grp.add(innerRing);
    this.innerRing = innerRing;

    // Shimmering disc
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(this.def.radius * 0.95, 28),
      new THREE.MeshBasicMaterial({ color: this.def.color, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false })
    );
    grp.add(disc);
    this.disc = disc;

    // Rebar studs around the rim
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const stud = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12),
        mat(0xb35c2a, { metalness: 0.7, roughness: 0.45 }));
      stud.position.set(Math.cos(a) * this.def.radius, Math.sin(a) * this.def.radius, 0);
      stud.rotation.z = a;
      grp.add(stud);
    }

    // Debug: visualise the actual trigger area
    if (DEBUG) {
      const trigger = new THREE.Mesh(
        new THREE.CircleGeometry(this.def.radius * TRIGGER_SLACK + TRIGGER_PAD, 24),
        new THREE.MeshBasicMaterial({ color: 0x00ff66, wireframe: true, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
      );
      grp.add(trigger);
    }

    this.group = grp;
    this.normal = new THREE.Vector3(0, 0, 1).applyEuler(grp.rotation);
    this.t = Math.random() * 10;
  }

  get triggerRadius() { return this.def.radius * TRIGGER_SLACK + TRIGGER_PAD; }

  update(dt) {
    this.t += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    const pulse = 1 + Math.sin(this.t * 3) * 0.04;
    this.torus.scale.setScalar(pulse);
    this.innerRing.rotation.z = this.t * 0.8;
    this.disc.material.opacity = 0.1 + Math.sin(this.t * 2.5) * 0.06;
    if (this.tier === 'glitch') {
      this.group.position.x = this.pos.x + (Math.random() - 0.5) * 0.07;
      this.group.position.y = this.pos.y + (Math.random() - 0.5) * 0.07;
    }

    if (this.cooldown > 0) return;
    const g = this.game;
    // Both Bung and the mounted trolley are valid portal actors. When riding,
    // the trolley IS the actor (Bung's position mirrors it).
    if (g.trolley.riding) {
      this.sweepCheck(g.actorPrev.trolley, g.trolley.pos, new THREE.Vector3(0, 0.7, 0), true);
    } else {
      this.sweepCheck(g.actorPrev.player, g.player.pos, new THREE.Vector3(0, 1.0, 0), false);
    }
  }

  // Segment-vs-plane crossing with exact intersection point.
  sweepCheck(prevPos, curPos, offset, riding) {
    const prev = prevPos.clone().add(offset);
    const cur = curPos.clone().add(offset);
    // Teleport guard: zone loads / respawns produce huge jumps — ignore them.
    if (prev.distanceToSquared(cur) > 400) return;

    const dPrev = prev.clone().sub(this.pos).dot(this.normal);
    const dNow = cur.clone().sub(this.pos).dot(this.normal);
    if ((dPrev > 0) === (dNow > 0)) return;          // no plane crossing
    if (Math.abs(dPrev - dNow) < 1e-7) return;

    const t = dPrev / (dPrev - dNow);
    const cross = prev.clone().lerp(cur, t);          // exact point on the plane
    const radial = cross.sub(this.pos).length();
    if (radial <= this.triggerRadius) {
      dlog('portal', `${this.def.name} ACCEPTED by ${riding ? 'trolley' : 'bung'} (radial ${radial.toFixed(2)}/${this.triggerRadius.toFixed(2)})`);
      this.pass(riding);
    } else {
      dlog('portal', `${this.def.name} rejected: radial ${radial.toFixed(2)} > ${this.triggerRadius.toFixed(2)}`);
    }
  }

  pass(riding) {
    const g = this.game;
    this.cooldown = PASS_COOLDOWN;

    if (this.tier === 'glitch') {
      g.audio.sfx('portalBad');
      g.fx.burst(this.pos, 0x8f1fff, 24);
      g.damagePlayer(12, this.pos);
      g.chain.resetChain('GLITCHED PORTAL! GABOR\'S FAKE TECH!');
      g.say('gabor', 'You have fallen for my fake rebar technology!');
      return;
    }

    // All score/combo flows through the ChainManager — portals just report.
    const chain = g.chain.addChain('portal');
    const gained = g.chain.addScore(this.def.score, 'portal:' + this.tier);
    addEnergy(this.tier === 'cyber' ? 12 : 6);

    g.audio.sfx(this.tier === 'gold' || this.tier === 'cyber' ? 'portalGold' : 'portal');
    g.fx.burst(this.pos, this.def.color, 22);
    g.fx.ring(this.pos.clone(), this.def.color, this.def.radius * 1.4);
    g.fx.scorePopup(this.pos, `+${gained}`, this.def.color);
    g.shake(0.08, 0.12);

    bus.emit('qe', { type: 'portal', target: 'any', tier: this.tier });
    if (riding) bus.emit('qe', { type: 'ring', target: 'trolley' });

    // Occasional bark, never every portal (8s shared cooldown)
    if (this.game.elapsed - lastPortalVoice > 8 && chain >= 3 && Math.random() < 0.4) {
      lastPortalVoice = this.game.elapsed;
      g.say('bung', ['That portal was absolutely Bung-approved!', 'Rebar Chain unstable. Keep sending it!', 'Maximum rebar velocity!'][Math.floor(Math.random() * 3)]);
    }
  }
}
