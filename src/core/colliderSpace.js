// Optional local coordinate frame for rotated venue boxes. City boxes retain
// their existing fast axis-aligned path; scales are uniform in the XZ plane.
export class VenueFrame {
  constructor(x, z, angle, scale = 1) {
    this.x = x;
    this.z = z;
    this.c = Math.cos(angle);
    this.s = Math.sin(angle);
    this.scale = scale;
  }
  local(p, out = {}) {
    const x = (p.x - this.x) / this.scale,
      z = (p.z - this.z) / this.scale;
    out.x = x * this.c - z * this.s;
    out.z = x * this.s + z * this.c;
    out.y = p.y;
    return out;
  }
  world(p, out = {}) {
    const x = p.x,
      z = p.z,
      y = p.y;
    out.x = this.x + (x * this.c + z * this.s) * this.scale;
    out.z = this.z + (-x * this.s + z * this.c) * this.scale;
    out.y = y;
    return out;
  }
}
export function colliderPoint(box, p, out = {}) {
  return box.frame ? box.frame.local(p, out) : Object.assign(out, p);
}
export function containsCollider(box, p, pad = 0) {
  const q = colliderPoint(box, p),
    b = box.localBox || box;
  return (
    q.x > b.min.x - pad &&
    q.x < b.max.x + pad &&
    q.z > b.min.z - pad &&
    q.z < b.max.z + pad &&
    q.y > b.min.y - pad &&
    q.y < b.max.y + pad
  );
}
