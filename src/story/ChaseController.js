import { distance, nearestOnPath, atDistance, turnToward } from '../systems/Navigation.js';
// Deterministic, resumable distance-along-route simulation. No teleport/reset
// when the player turns around: Gabor waits, then accelerates back up to pace.
export class ChaseController {
  constructor(path, saved = {}) {
    this.path = path;
    this.length = nearestOnPath(path, path[0]).length;
    this.dist = Math.max(0, Math.min(this.length, Number(saved.dist) || 0));
    this.speed = 0;
    this.heading = Number(saved.heading) || 0;
    this.completed = !!saved.completed;
    this.blocked = false;
    this.blockedTime = 0;
  }
  update(dt, player, { catching = false, riding = false, clear = () => true } = {}) {
    dt = Math.max(0, Math.min(dt, 0.1));
    const at = atDistance(this.path, this.dist),
      on = nearestOnPath(this.path, player);
    const gap = distance(player, at),
      lead = on.off > 15 ? gap : this.dist - on.along;
    const corner = atDistance(this.path, Math.min(this.length, this.dist + 5));
    const far = atDistance(this.path, Math.min(this.length, this.dist + 12));
    const h1 = Math.atan2(corner.x - at.x, corner.z - at.z),
      h2 = Math.atan2(far.x - corner.x, far.z - corner.z);
    const bend = Math.abs(Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1)));
    let wanted = (catching ? 10.8 : 4.1) / (1 + bend * 0.8);
    if (lead > 28) wanted *= Math.max(0, (42 - lead) / 14);
    wanted = Math.min(wanted, Math.sqrt(Math.max(0, 2 * 5 * (this.length - this.dist))));
    if (this.completed) wanted = 0;
    const accel = wanted > this.speed ? 4 : 7;
    this.speed += Math.max(-accel * dt, Math.min(accel * dt, wanted - this.speed));
    const nextDist = Math.min(this.length, this.dist + this.speed * dt),
      next = atDistance(this.path, nextDist);
    this.blocked = !clear(at, next);
    if (this.blocked) {
      this.speed = 0;
      this.blockedTime += dt;
    } else {
      this.dist = nextDist;
      this.blockedTime = 0;
    }
    const position = atDistance(this.path, this.dist),
      ahead = atDistance(this.path, Math.min(this.length, this.dist + 2));
    if (distance(position, ahead) > 0.01)
      this.heading = turnToward(this.heading, Math.atan2(ahead.x - position.x, ahead.z - position.z), dt, 8);
    const live = distance(player, position);
    // Stage the whole corridor before the payoff; a shortcut cannot skip Apple.
    const stoppedSafely = this.blockedTime >= 8;
    const ready = catching
      ? riding && (this.dist >= this.length * 0.82 || stoppedSafely) && live < 4.5
      : (this.dist >= this.length - 4 || stoppedSafely) && live < 6;
    const finished = !this.completed && ready && Math.abs((player.y || 0) - (position.y || 0)) < 2.5;
    if (finished) {
      this.completed = true;
      this.speed = 0;
    }
    return { position, finished, gap: live, waiting: wanted < 0.1, blocked: this.blocked };
  }
  snapshot() {
    return { dist: this.dist, heading: this.heading, completed: this.completed };
  }
}
