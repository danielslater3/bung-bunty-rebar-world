import { conditionsAt, rainAt, vortexAt, weatherAt } from '../weather/model.js';

const W = 420, H = 386;
const PINS = [
  ['West End', -1330, 1170], ['South Bank', -330, 785], ['City Hall', 1.7, 0],
  ['Queen St', 173, 81.5], ['Gardens', 605, 886], ['Story Bridge', 1217, -74], ['Kangaroo Point', 1434, 1306],
];
const PALETTE = [[55,156,149], [81,197,115], [236,215,94], [245,155,75], [250,87,99], [239,123,216]];
const RAIN = new Uint8ClampedArray(84 * 77 * 4);

export class PhoneRadar {
  constructor(canvas) {
    this.canvas = canvas;
    canvas.width = W;
    canvas.height = H;
    this.ctx = canvas.getContext('2d');
    const off = (w, h) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      return c.getContext('2d');
    };
    this.base = off(W, H);
    this.field = off(84, 77);
    this.pixels = this.field.createImageData(84, 77);
    this.key = '';
    this.layer = 'rain';
    this.zoom = 1;
    this.age = 0;
  }

  draw(g) {
    const w = g.weather, p = g.player.pos;
    const zoom = this.zoom;
    const cx = zoom === 1 ? 10 : Math.round(p.x / 100) * 100;
    const cz = zoom === 1 ? 390 : Math.round(p.z / 100) * 100;
    const m = zoom / 13;
    const sx = x => W / 2 + (x - cx) * m, sy = z => H / 2 + (z - cz) * m;
    const terrain = g.weather.zone?.terrain, geo = g.geoBrisbane;
    const key = [!!terrain, cx, cz, zoom].join('/');
    const base = this.base;
    if (key !== this.key) {
      this.key = key;
      base.fillStyle = '#101f2b';
      base.fillRect(0, 0, W, H);
      if (terrain && geo) {
        base.fillStyle = '#2f4550';
        for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) {
          if (terrain.isWater(cx + (x + 1.5 - W / 2) / m, cz + (y + 1.5 - H / 2) / m)) base.fillRect(x, y, 3, 3);
        }
        base.strokeStyle = '#30404d';
        base.lineWidth = .65;
        for (const road of geo.roads) {
          if (road.py || road.k > 2) continue;
          base.beginPath();
          for (let i = 0; i < road.p.length; i += 2) {
            const x = sx(road.p[i]), y = sy(road.p[i+1]);
            if (i) base.lineTo(x, y); else base.moveTo(x, y);
          }
          base.stroke();
        }
      }
      base.strokeStyle = '#63828b55';
      for (let r = 45; r < 330; r += 45) {
        base.beginPath();
        base.arc(W / 2, H / 2, r, 0, Math.PI * 2);
        base.stroke();
      }
    }

    const ctx = this.ctx;
    ctx.drawImage(base.canvas, 0, 0);
    const now = Math.max(0, w.time - this.age);
    const f = this.age ? weatherAt(w.seed, now, w.exercise) : w.frame;
    if (terrain && this.layer !== 'map') {
      for (let iy = 0; iy < 77; iy++) for (let ix = 0; ix < 84; ix++) {
        const x = cx + (ix * 5 - W / 2) / m, z = cz + (iy * 5 - H / 2) / m;
        const value = rainAt(f, x, z), i = (iy * 84 + ix) * 4;
        let color = PALETTE[Math.min(5, Math.floor(value * 7.1))];
        let alpha = value > .043 ? Math.min(231, 85 + value * 230) : 0;
        if (this.layer === 'wind') {
          const c = conditionsAt(f, x, z), v = vortexAt(f.tornado, x, z, 0);
          const dx = x - cx, dz = z - cz;
          const radial = ((c.windX + (v?.x || 0)) * dx + (c.windZ + (v?.z || 0)) * dz) / Math.max(1, Math.hypot(dx, dz));
          color = radial < 0 ? [84,215,194] : [245,112,107];
          alpha = value > .08 || v ? Math.min(225, 26 + Math.abs(radial) * 12) : 0;
        }
        RAIN[i] = color[0]; RAIN[i+1] = color[1]; RAIN[i+2] = color[2]; RAIN[i+3] = alpha;
      }
      this.pixels.data.set(RAIN);
      this.field.putImageData(this.pixels, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.field.canvas, 0, 0, W, H);
      ctx.imageSmoothingEnabled = true;

      if (f.core > .34) {
        ctx.save();
        const v = Math.atan2(f.vz, f.vx);
        ctx.strokeStyle = f.warned ? '#ff9fb2' : '#f8d783';
        ctx.fillStyle = f.warned ? '#e97b991d' : '#f9ce5f13';
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.ellipse(sx(f.x), sy(f.z), 890 * m, 610 * m, v, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx(f.x), sy(f.z));
        ctx.lineTo(sx(f.x + f.vx * 48), sy(f.z + f.vz * 48));
        ctx.stroke();
        ctx.restore();
      }
      if (f.tornado) {
        const t = f.tornado;
        ctx.save();
        ctx.strokeStyle = '#ffb2c5b5';
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(sx(t.x), sy(t.z));
        for (let seconds = 5; seconds <= 35; seconds += 5) {
          const next = weatherAt(w.seed, now + seconds, w.exercise).tornado;
          if (!next) break;
          ctx.lineTo(sx(next.x), sy(next.z));
        }
        ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = '#ffb2c5';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(sx(t.x), sy(t.z), Math.max(6, t.core * 1.6 * m), 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
        this.label(t.ground ? 'TORNADO' : 'FUNNEL', sx(t.x) + 10, sy(t.z), '#ffb2c5');
      }
    }
    for (const [label, x, z] of PINS) this.label(label, sx(x), sy(z), '#c1d2dd');
    if (terrain) {
      ctx.fillStyle = '#7ee7ff';
      ctx.beginPath();
      ctx.arc(sx(p.x), sy(p.z), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e7faff';
      ctx.stroke();
    }
    this.label('N ↑', W - 36, 18, '#e8f8ff');
    this.label(zoom === 1 ? '5.5 km across' : zoom === 1.6 ? '3.4 km across' : '2.2 km across', 12, H - 12, '#e8f8ff');
  }

  label(text, x, y, color) {
    const ctx = this.ctx;
    ctx.font = '600 11px system-ui';
    ctx.strokeStyle = '#102032';
    ctx.lineWidth = 3;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.lineWidth = 1;
  }
}
