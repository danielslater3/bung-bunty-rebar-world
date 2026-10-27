// Rebars, Rebar Coins, Cyber Rebar Shards, Trolley Fuel, burger ingredients,
// and one Titanium Samsung S24 parody phone.
//
// 2.0 pickup detection: SWEPT CAPSULE. Each frame we measure the distance
// from the collectible to the SEGMENT the actor travelled this frame
// (prev position → current position), not just the endpoint. A boosting
// trolley moving 0.5m+ per frame can therefore never skip a pickup — the
// whole travel path is checked. Trigger radii are generous, the trolley
// gets an even bigger one (it's a big golden basket), and the Rebar Magnet
// upgrade extends the pull range on top.
//
// Collection logic NEVER depends on effects: state/UI updates run first and
// the audio/particle/voice flourishes are isolated in try/catch — a broken
// effect can't eat a rebar.
import * as THREE from 'three';
import { state, bus, addCoins, addRebars, addShards, addEnergy, upgLevel } from '../core/state.js';
import { buildRebar, buildCoin, buildShard, buildBurger, buildFuelCan, buildPhone } from './models.js';
import { dlog } from '../core/Debug.js';
import { REBAR_TYPES, unlockArchive } from '../lore/universe.js';

function tintedRebar(kind) {
  const spec = REBAR_TYPES[kind];
  const g = buildRebar();
  const color = new THREE.Color(spec.color);
  g.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline) return;
    o.material = o.material.clone();
    o.material.color = color;
    o.material.emissive = color;
    o.material.emissiveIntensity = kind === 'radioactive' || kind === 'forbidden' || kind === 'obsidian' ? 0.7 : 0.25;
  });
  if (kind === 'bent') g.rotation.z = 0.7;
  return g;
}

const BUILDERS = {
  rebar: buildRebar,
  coin: buildCoin,
  shard: () => buildShard(false),
  redshard: () => buildShard(true),
  fuel: buildFuelCan,
  burger: buildBurger,
  phone: buildPhone,
};
for (const kind of Object.keys(REBAR_TYPES)) {
  if (kind !== 'rebar') BUILDERS[kind] = () => tintedRebar(kind);
}

const PICKUP_RADIUS_WALK = 1.7;     // generous on-foot trigger
const PICKUP_RADIUS_TROLLEY = 2.4;  // the basket counts

// Closest distance from point P to segment AB.
function distToSegment(p, a, b) {
  const ab = b.clone().sub(a);
  const len2 = ab.lengthSq();
  if (len2 < 1e-8) return p.distanceTo(a);
  const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / len2));
  return p.distanceTo(a.clone().addScaledVector(ab, t));
}

export class Collectible {
  constructor(game, kind, pos) {
    this.game = game;
    this.kind = kind;
    this.pos = pos.clone();
    this.mesh = BUILDERS[kind]();
    this.mesh.position.copy(pos);
    this.t = Math.random() * 10;
    this.key = `${game.zone?.name || 'world'}|${kind}|${this.pos.x.toFixed(1)}|${this.pos.y.toFixed(1)}|${this.pos.z.toFixed(1)}`;
    this.collected = !!state.picked?.[this.key];
    this.mesh.visible = !this.collected;
    game.zone.group.add(this.mesh);
  }

  update(dt) {
    if (this.collected) return;
    this.t += dt;
    this.mesh.rotation.y += dt * 1.8;
    this.mesh.position.y = this.pos.y + Math.sin(this.t * 2.4) * 0.18 + 0.1;

    const g = this.game;
    const riding = g.trolley.riding;
    const offset = new THREE.Vector3(0, riding ? 0.7 : 0.9, 0);
    const cur = (riding ? g.trolley.pos : g.player.pos).clone().add(offset);
    const prev = (riding ? g.actorPrev.trolley : g.actorPrev.player).clone().add(offset);

    // Rebar Magnet: smooth pull toward the actor, then normal pickup collects.
    const magnetR = 2.2 + upgLevel('magnet') * 1.6;
    const dNow = this.mesh.position.distanceTo(cur);
    if (dNow < magnetR && dNow > 1.0) {
      const dir = cur.clone().sub(this.mesh.position).normalize();
      this.pos.addScaledVector(dir, dt * (6 + upgLevel('magnet') * 4));
      this.mesh.position.x = this.pos.x;
      this.mesh.position.z = this.pos.z;
    }

    // Swept pickup: distance from this pickup to the actor's travel segment.
    const pickR = riding ? PICKUP_RADIUS_TROLLEY : PICKUP_RADIUS_WALK;
    if (prev.distanceToSquared(cur) < 400 /* teleport guard */ &&
        distToSegment(this.mesh.position, prev, cur) < pickR) {
      this.collect();
    }
  }

  collect() {
    if (this.collected) return;          // each collectible collects exactly once
    this.collected = true;
    this.mesh.visible = false;
    if (!state.picked) state.picked = {};
    state.picked[this.key] = true;
    const g = this.game;
    dlog('pickup', `collected ${this.kind} at ${this.pos.x.toFixed(1)},${this.pos.y.toFixed(1)},${this.pos.z.toFixed(1)}`);

    // ---- 1) STATE + UI first (must never fail) ----
    if (!state.stock) state.stock = {};
    switch (this.kind) {
      case 'rebar':
        addRebars(1); addEnergy(4);
        state.stock.rebar = (state.stock.rebar || 0) + 1;
        g.chain.addChain('rebar');                       // rebars feed the Rebar Chain
        g.chain.addScore(10, 'rebar');
        unlockArchive('rebar-rebar');
        break;
      case 'coin': addCoins(5); break;
      case 'shard': case 'redshard': addShards(1); break;
      case 'fuel':
        state.fuel = Math.min(g.trolley.fuelMax, state.fuel + 25);
        bus.emit('hud');
        bus.emit('qe', { type: 'collect', target: 'fuel', n: 1 });
        break;
      case 'burger':
        state.stability = Math.min(state.maxStability, state.stability + 20);
        bus.emit('hud');
        bus.emit('qe', { type: 'collect', target: 'burger', n: 1 });
        break;
      case 'phone':
        addCoins(150);
        state.flags.foundPhone = true;
        unlockArchive('tour');
        break;
      default:
        if (REBAR_TYPES[this.kind]) {
          const spec = REBAR_TYPES[this.kind];
          state.stock[this.kind] = (state.stock[this.kind] || 0) + 1;
          addCoins(spec.value);
          addEnergy(3);
          g.chain.addChain(this.kind);
          g.chain.addScore(spec.value, this.kind);
          unlockArchive(spec.archive);
          bus.emit('qe', { type: 'collect', target: this.kind, n: 1 });
        }
        break;
    }

    // ---- 2) Effects second — isolated so they can never block collection ----
    try {
      switch (this.kind) {
        case 'rebar':
          g.audio.sfx('rebar');
          g.fx.burst(this.mesh.position, 0xd9763a, 10);
          g.fx.scorePopup(this.mesh.position, '+1 REBAR', 0xd9763a);
          if (Math.random() < 0.12) g.say('bung', ['OIIII REBAR DETECTED!', 'Nearby rebars respect Bung\'s authority.'][Math.floor(Math.random() * 2)]);
          break;
        case 'coin':
          g.audio.sfx('coin');
          g.fx.burst(this.mesh.position, 0xffc23d, 8);
          break;
        case 'shard': case 'redshard':
          g.audio.sfx('shard');
          g.fx.burst(this.mesh.position, this.kind === 'shard' ? 0x2ee6ff : 0xff2e5f, 18);
          g.toast('CYBER REBAR SHARD RECOVERED', 'blue');
          if (this.kind === 'redshard') g.say('bung', 'Shenzhen cyber rebar detected.');
          break;
        case 'fuel':
          g.audio.sfx('refuel');
          g.fx.burst(this.mesh.position, 0xff9a1f, 10);
          break;
        case 'burger':
          g.audio.sfx('eat');
          g.fx.burst(this.mesh.position, 0xe8a755, 12);
          g.say('bung', 'I require one Rebar Deluxe immediately. Cheers.');
          break;
        case 'phone':
          g.audio.sfx('unlock');
          g.toast('TITANIUM PHONE RECOVERED! +150 BUNGBUCKS', 'blue');
          g.say('bung', 'The Titanium phone! Bung-approved engineering!');
          break;
        default:
          if (REBAR_TYPES[this.kind]) {
            g.audio.sfx('rebar');
            g.fx.burst(this.mesh.position, REBAR_TYPES[this.kind].color, 12);
            g.fx.scorePopup(this.mesh.position, REBAR_TYPES[this.kind].name.toUpperCase(), REBAR_TYPES[this.kind].color);
            g.toast(`${REBAR_TYPES[this.kind].name.toUpperCase()} — YARD UPDATED`, 'blue');
          }
          break;
      }
    } catch (e) {
      dlog('pickup', 'effect error (collection unaffected):', e);
    }
  }
}
