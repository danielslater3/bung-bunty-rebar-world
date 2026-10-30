// Exact height queries over the SAME triangles used to render elevated surfaces.
// XZ hash: bridges remain walkable even when their render mesh is out of the
// nearby raycast set. Stacked decks are selected relative to the traveller's feet.
export class SurfaceIndex {
  constructor(cell = 24) {
    this.cell = cell;
    this.buckets = new Map();
    this.count = 0;
  }
  add(positions) {
    for (let i = 0; i + 8 < positions.length; i += 9) {
      const t = positions.slice(i, i + 9);
      if (!t.every(Number.isFinite)) throw new Error('Non-finite walk surface');
      const den = (t[5] - t[8]) * (t[0] - t[6]) + (t[6] - t[3]) * (t[2] - t[8]);
      if (Math.abs(den) < 1e-7) continue;
      t.push(den);
      const x0 = Math.floor(Math.min(t[0], t[3], t[6]) / this.cell);
      const x1 = Math.floor(Math.max(t[0], t[3], t[6]) / this.cell);
      const z0 = Math.floor(Math.min(t[2], t[5], t[8]) / this.cell);
      const z1 = Math.floor(Math.max(t[2], t[5], t[8]) / this.cell);
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) {
          const key = `${x},${z}`;
          if (!this.buckets.has(key)) this.buckets.set(key, []);
          this.buckets.get(key).push(t);
        }
      this.count++;
    }
  }
  heightAt(x, z, feetY = Infinity, step = 0.9) {
    let best = -Infinity;
    const list = this.buckets.get(`${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`);
    if (!list) return best;
    for (const t of list) {
      const a = ((t[5] - t[8]) * (x - t[6]) + (t[6] - t[3]) * (z - t[8])) / t[9];
      const b = ((t[8] - t[2]) * (x - t[6]) + (t[0] - t[6]) * (z - t[8])) / t[9];
      if (a < -1e-6 || b < -1e-6 || a + b > 1.000001) continue;
      const y = a * t[1] + b * t[4] + (1 - a - b) * t[7];
      if (y <= feetY + step && y > best) best = y;
    }
    return best;
  }
}
