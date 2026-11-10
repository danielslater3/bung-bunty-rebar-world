import { vortexAt, weatherAt } from './model.js';
import { moveHorizontal } from '../core/motion.js';

const MAX_BUILDINGS = 160;
const REPAIR_SECONDS = 80;

export function buildingDamage(tornado, building) {
  if (!tornado?.ground || tornado.tier < 2) return 0;
  const radius = tornado.core * [0, 0, .45, .75, 1.3, 1.85][tornado.tier];
  const dx = building.x - tornado.x, dz = building.z - tornado.z;
  const distanceSquared = dx * dx + dz * dz;
  if (distanceSquared >= radius * radius) return 0;
  const pressure = (1 - Math.sqrt(distanceSquared) / radius) * tornado.strength;
  return Math.min(.94, (.14 + pressure * .86) * [0, 0, .32, .55, .84, 1.18][tornado.tier]);
}

function deform(record, amount) {
  const { building: b } = record;
  for (let part = 0; part < b.ranges.length; part++) {
    const [attr, start, end] = b.ranges[part];
    const src = record.original[part], dest = attr.array;
    for (let i = start; i < end; i += 3) {
      const height = src[i - start + 1] - b.ground;
      const chip = .93 + .07 * Math.sin(dest[i] * .37 + dest[i + 2] * .51);
      dest[i + 1] = b.ground + height * (height > 0 ? 1 - amount * chip : 1);
    }
    if (attr.updateRanges.length === 512) {
      attr.clearUpdateRanges();
      attr.addUpdateRange(0, attr.array.length);
    } else if (attr.updateRanges[0]?.count !== attr.array.length) attr.addUpdateRange(start, end - start);
    attr.needsUpdate = true;
  }
  if (b.footprint) b.footprint.h = b.ground + (record.height - b.ground) * (1 - .92 * amount);
}

export class StormDamage {
  constructor(zone) {
    this.zone = zone;
    this.active = new Map();
    this.clock = -Infinity;
  }

  clear() {
    for (const record of this.active.values()) deform(record, 0);
    this.active.clear();
    for (const s of this.zone.cityLife?.services || []) {
      if (s.stormFlight) s.model.rotation.set(0, s.pose.yaw, 0);
      s.stormFlight = null;
      s.stormCooldown = 0;
    }
  }

  update(frame, seed, exercise) {
    const key = seed + '/' + (exercise ? exercise.track + ':' + exercise.tier : 'natural');
    const second = Math.floor(frame.time);
    const rebuild = key !== this.key || second < this.clock || second - this.clock > 4;
    if (rebuild) this.clear();
    if (second !== this.clock || rebuild) {
      const start = rebuild ? Math.max(0, second - REPAIR_SECONDS - 5) : this.clock + 1;
      this.key = key;
      this.clock = second;
      for (let time = start; time <= second; time++) {
        const tornado = weatherAt(seed, time, exercise).tornado;
        if (!tornado?.ground || tornado.tier < 2) continue;
        for (const b of this.zone.stormBuildings || []) {
          const damage = buildingDamage(tornado, b);
          if (!damage) continue;
          let record = this.active.get(b);
          if (!record) {
            if (this.active.size >= MAX_BUILDINGS) continue;
            record = {
              building: b, original: b.ranges.map(([attr, start, end]) => attr.array.slice(start, end)),
              height: b.footprint?.h, hit: time, damage: 0, amount: 0,
            };
            this.active.set(b, record);
          }
          record.damage = Math.max(record.damage, damage);
          record.until = time + REPAIR_SECONDS;
        }
      }
    }
    for (const [b, record] of this.active) {
      const progress = Math.max(0, Math.min(1, (frame.time - record.hit) / 1.15, (record.until + 3 - frame.time) / 3));
      const amount = record.damage * progress * progress * (3 - 2 * progress);
      if (Math.abs(amount - record.amount) > .009 || amount === 0 && record.amount !== 0) {
        deform(record, amount);
        record.amount = amount;
      }
      if (frame.time >= record.until + 3) this.active.delete(b);
    }
  }

  vehicles(dt, frame, player) {
    const t = frame.tornado;
    for (const s of this.zone.cityLife?.services || []) {
      const model = s.model, p = model.position;
      let fly = s.stormFlight;
      if (!fly) {
        if (!t?.ground || t.tier < (s.bus ? 3 : 2) || frame.time < (s.stormCooldown || 0)) continue;
        const wind = vortexAt(t, p.x, p.z, 0);
        if (!wind?.caught || Math.hypot(p.x - player.x, p.z - player.z) > 550) continue;
        const angle = Math.atan2(p.z - t.z, p.x - t.x) + .9;
        const speed = t.toss * (s.bus ? .38 : .63);
        fly = s.stormFlight = { vx: Math.cos(angle) * speed, vz: Math.sin(angle) * speed,
          vy: (12 + t.tier * 6) * (s.bus ? .7 : 1), start: frame.time, landed: 0 };
        if (s.collider) {
          // Airborne and overturned traffic should leave its road lane open.
          s.collider.localBox.min.y = s.collider.min.y = -120;
          s.collider.localBox.max.y = s.collider.max.y = -118;
        }
      }
      model.visible = Math.hypot(p.x - player.x, p.z - player.z) < 550;
      if (!fly.landed) {
        if (moveHorizontal(p, fly.vx * dt, fly.vz * dt, s.bus ? 1.3 : .95, this.zone)) {
          fly.vx *= -.34;
          fly.vz *= -.34;
        }
        p.y += fly.vy * dt;
        fly.vy -= 13 * dt;
        model.rotation.x += dt * (s.bus ? 1 : 2.2);
        model.rotation.z += dt * (s.bus ? .7 : 1.6);
        model.rotation.y += dt * .85;
        const floor = this.zone.groundAt(p.x, p.z, p.y);
        if ((p.y <= floor + .7 && fly.vy < 0) || frame.time - fly.start > 11) {
          p.y = floor + .65;
          fly.landed = frame.time;
          model.rotation.z = Math.PI * .54;
        }
      } else if (frame.time - fly.landed > 17) {
        s.stormFlight = null;
        s.stormCooldown = frame.time + 12;
        model.rotation.set(0, s.pose.yaw, 0);
      }
    }
  }
}
