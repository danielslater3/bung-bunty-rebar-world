// Lightweight pooled particle effects: bursts, shock rings, drift sparks,
// and DOM score popups projected from world space.
import * as THREE from 'three';

const MAX_PARTICLES = 400;

export class FX {
  constructor(game) {
    this.game = game;
    this.particles = [];
    this.rings = [];

    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.28, vertexColors: true, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.points.frustumCulled = false;
    game.scene.add(this.points);
    this.free = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.free.push(i);
      this.positions[i * 3 + 1] = -9999;
    }
  }

  burst(pos, color, count = 12, speed = 6) {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const idx = this.free.pop();
      if (idx === undefined) return;
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize();
      this.particles.push({
        idx, pos: pos.clone(), vel: dir.multiplyScalar(speed * (0.4 + Math.random() * 0.8)),
        life: 0.5 + Math.random() * 0.5,
      });
      this.colors[idx * 3] = c.r; this.colors[idx * 3 + 1] = c.g; this.colors[idx * 3 + 2] = c.b;
    }
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  spark(pos, color) { this.burst(pos, color, 3, 3); }

  ring(pos, color, radius) {
    const geo = new THREE.TorusGeometry(0.5, 0.08, 6, 32);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    m.position.copy(pos);
    m.rotation.x = -Math.PI / 2;
    this.game.scene.add(m);
    this.rings.push({ mesh: m, target: radius, t: 0 });
  }

  scorePopup(pos, text, color = 0xffc23d) {
    const v = pos.clone().project(this.game.camera);
    if (v.z > 1) return;
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `position:fixed;left:${(v.x * 0.5 + 0.5) * innerWidth}px;top:${(-v.y * 0.5 + 0.5) * innerHeight}px;` +
      `color:#${new THREE.Color(color).getHexString()};font-family:"Arial Black";font-size:22px;font-style:italic;` +
      `text-shadow:0 0 10px rgba(255,255,255,.4),2px 2px 0 #000;pointer-events:none;z-index:15;` +
      `transition:transform 1s ease-out,opacity 1s;transform:translate(-50%,-50%);`;
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = 'translate(-50%,-130px) scale(1.15)';
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), 1100);
  }

  update(dt) {
    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.positions[p.idx * 3 + 1] = -9999;
        this.free.push(p.idx);
        this.particles.splice(i, 1);
        continue;
      }
      p.vel.y -= 9 * dt;
      p.pos.addScaledVector(p.vel, dt);
      this.positions[p.idx * 3] = p.pos.x;
      this.positions[p.idx * 3 + 1] = p.pos.y;
      this.positions[p.idx * 3 + 2] = p.pos.z;
    }
    this.points.geometry.attributes.position.needsUpdate = true;

    // Rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt * 2.5;
      const s = 0.5 + (r.target - 0.5) * Math.min(1, r.t);
      r.mesh.scale.setScalar(s * 2);
      r.mesh.material.opacity = 0.85 * (1 - r.t);
      if (r.t >= 1) {
        this.game.scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        this.rings.splice(i, 1);
      }
    }
  }
}
