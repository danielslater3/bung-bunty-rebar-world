// ZoneKit — the toolkit every zone is built with. Owns the zone's scene
// group, colliders, grounds, portals, pickups, enemies, NPCs, triggers,
// interactables, grapple points, lighting, weather, and per-frame updates.
import * as THREE from 'three';
import {
  mat, box as mkBox, cyl, sphere, rng, pick,
  texMat, pavingTexture, terminalFloorTexture, skylightTexture, ledTexture, hazardTexture,
} from '../core/utils.js';
import { Portal } from '../entities/Portal.js';
import { Collectible } from '../entities/Collectible.js';
import { Spawner } from '../entities/Enemies.js';
import { NPC } from '../entities/NPC.js';
import { state } from '../core/state.js';

export class ZoneKit {
  constructor(game, name, music) {
    this.game = game;
    // Register immediately so entities created during construction
    // (collectibles, spawners, bosses) attach to this zone's group.
    game.zone = this;
    this.name = name;
    this.music = music;
    this.group = new THREE.Group();
    this.colliders = [];
    this.grounds = [];
    this.portals = [];
    this.pickups = [];
    this.interactables = [];
    this.grapplePoints = [];
    this.spawners = [];
    this.triggers = [];
    this.npcs = [];
    this.updaters = [];
    this.spawn = new THREE.Vector3(0, 1, 0);
    this.spawnYaw = 0; // camera yaw at spawn (0 = camera at +z looking toward -z)
    this.rain = null;
    this.bounds = 400;
  }

  // ---------- Environment ----------
  sky(bgColor, fogColor, fogNear, fogFar, hemiSky, hemiGround, hemiInt, sunColor, sunInt, sunPos) {
    const g = this.game;
    g.scene.background = new THREE.Color(bgColor);
    g.scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
    const hemi = new THREE.HemisphereLight(hemiSky, hemiGround, hemiInt);
    this.group.add(hemi);
    const sun = new THREE.DirectionalLight(sunColor, sunInt);
    sun.position.copy(sunPos);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
    sun.shadow.camera.far = 300;
    this.group.add(sun);
    this.sun = sun;
  }

  enableRain(count = 900, color = 0x9fd4ff, area = 120) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * area;
      pos[i * 3 + 1] = Math.random() * 60;
      pos[i * 3 + 2] = (Math.random() - 0.5) * area;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({
      color, size: 0.12, transparent: true, opacity: 0.55,
    }));
    points.frustumCulled = false;
    this.group.add(points);
    this.rain = { points, pos, count, area };
  }

  // ---------- Geometry ----------
  // Solid box: walkable top + wall collider.
  box(x, y, z, w, h, d, material, opts = {}) {
    const m = mkBox(w, h, d, material);
    m.position.set(x, y + h / 2, z);
    if (opts.ry) m.rotation.y = opts.ry;
    if (opts.rx) m.rotation.x = opts.rx;
    if (opts.rz) m.rotation.z = opts.rz;
    m.receiveShadow = true;
    m.castShadow = opts.castShadow ?? h > 0.5;
    this.group.add(m);
    if (opts.ground !== false) this.grounds.push(m);
    // Low boxes (steps, plinths) are walk-over-able rather than walls.
    if (opts.collide !== false && h > 1.0 && !opts.rx && !opts.rz) {
      m.updateMatrixWorld();
      const b = new THREE.Box3().setFromObject(m);
      this.colliders.push(b);
    }
    return m;
  }

  ground(w, d, material, y = 0) {
    const m = mkBox(w, 1, d, material);
    m.position.y = y - 0.5;
    m.receiveShadow = true;
    this.group.add(m);
    this.grounds.push(m);
    return m;
  }

  // Decorative plate (road, rug) — flat, no collision needed beyond ground.
  plate(x, y, z, w, d, material, ry = 0) {
    const m = mkBox(w, 0.08, d, material);
    m.position.set(x, y + 0.04, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    this.group.add(m);
    this.grounds.push(m);
    return m;
  }

  // Building with emissive windows.
  building(x, z, w, h, d, color, opts = {}) {
    const b = this.box(x, opts.baseY ?? 0, z, w, h, d, mat(color, { roughness: 0.85 }));
    // Windows
    const winMat = mat(opts.windowColor ?? 0xbfe3ff, {
      emissive: opts.windowColor ?? 0x86c8f0,
      emissiveIntensity: opts.windowGlow ?? 0.5,
    });
    const rows = Math.max(1, Math.floor(h / 4));
    const cols = Math.max(1, Math.floor(w / 4));
    const baseY = opts.baseY ?? 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() < 0.35) continue;
        const win = mkBox(1.2, 1.6, 0.1, winMat);
        win.position.set(
          x - w / 2 + (c + 0.5) * (w / cols),
          baseY + (r + 0.5) * (h / rows),
          z + d / 2 + 0.06
        );
        this.group.add(win);
      }
    }
    if (opts.grapple) this.grapple(x, (opts.baseY ?? 0) + h + 0.5, z);
    return b;
  }

  // Sloped ramp (drivable + walkable via raycast). Optional launch trigger.
  ramp(x, y, z, len, w, rise, ry = 0, material, launch = true) {
    const angle = Math.atan2(rise, len);
    const m = mkBox(w, 0.35, Math.hypot(len, rise), material || mat(0x8a8f99, { roughness: 0.7 }));
    m.position.set(x, y + rise / 2, z);
    m.rotation.order = 'YXZ'; // yaw first, then pitch along local Z
    m.rotation.y = ry;
    m.rotation.x = -angle;
    m.receiveShadow = true;
    this.group.add(m);
    this.grounds.push(m);
    if (launch) {
      // Launch trigger at the top lip
      const dir = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
      const top = new THREE.Vector3(x, y + rise, z).addScaledVector(dir, len / 2);
      this.trigger(top, 2.5, () => {
        if (this.game.trolley.riding) this.game.trolley.launch();
      }, false, 1.2);
    }
    return m;
  }

  neonSign(x, y, z, w, h, color, ry = 0) {
    const sign = mkBox(w, h, 0.15, mat(color, { emissive: color, emissiveIntensity: 1.6 }));
    sign.position.set(x, y, z);
    sign.rotation.y = ry;
    this.group.add(sign);
    return sign;
  }

  // ---------- Prop kit (2.0): clutter that makes zones feel alive ----------
  // Traffic cone — pure decoration, never blocks movement.
  cone(x, z, y = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 8),
      mat(0xff7a1f, { roughness: 0.7, emissive: 0x331100, emissiveIntensity: 0.2 }));
    c.position.y = 0.35;
    g.add(c);
    const base = mkBox(0.55, 0.07, 0.55, mat(0xff7a1f, { roughness: 0.8 }));
    base.position.y = 0.035;
    g.add(base);
    const stripe = new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.18, 8), mat(0xffffff, { roughness: 0.6 }));
    stripe.position.y = 0.42;
    g.add(stripe);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.group.add(g);
    return g;
  }

  // Stack of crossed rebars — Bung's favourite landmark.
  rebarStack(x, y, z, ry = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    const rb = mat(0xb35c2a, { metalness: 0.75, roughness: 0.45 });
    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < 3 - layer; i++) {
        const bar = cyl(0.06, 0.06, 3.2, rb, 6);
        bar.rotation.z = Math.PI / 2;
        bar.position.set(0, 0.08 + layer * 0.13, -0.3 + i * 0.16 + layer * 0.08);
        bar.castShadow = true;
        g.add(bar);
      }
    }
    this.group.add(g);
    return g;
  }

  // Parody warning sign on a post (text drawn as stripes — no real brands).
  warnSign(x, z, ry = 0, color = 0xffc23d) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    const post = cyl(0.05, 0.05, 1.6, mat(0x4a4f58, { metalness: 0.7, roughness: 0.4 }), 6);
    post.position.y = 0.8;
    g.add(post);
    const panel = mkBox(1.5, 0.9, 0.08, mat(0x14181f, { roughness: 0.5 }));
    panel.position.y = 1.9;
    g.add(panel);
    for (let i = 0; i < 4; i++) { // hazard stripes
      const s = mkBox(0.22, 0.9, 0.02, mat(color, { emissive: color, emissiveIntensity: 0.6 }));
      s.position.set(-0.55 + i * 0.36, 1.9, 0.05);
      s.rotation.z = 0.5;
      g.add(s);
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.group.add(g);
    return g;
  }

  // Pulsing neon chevron arrow — points the way along portal routes.
  neonArrow(x, y, z, ry = 0, color = 0x2ee6ff) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    const m = mat(color, { emissive: color, emissiveIntensity: 2 });
    const l = mkBox(0.9, 0.16, 0.16, m);
    l.position.set(-0.32, 0, 0); l.rotation.y = 0.7; g.add(l);
    const r = mkBox(0.9, 0.16, 0.16, m);
    r.position.set(0.32, 0, 0); r.rotation.y = -0.7; g.add(r);
    this.group.add(g);
    this.updaters.push((dt, t) => {
      const s = 1 + Math.sin(t * 4 + x) * 0.12;
      g.scale.setScalar(s);
    });
    return g;
  }

  // Pulsing red warning light on a pole (Red Mode atmosphere).
  warnLight(x, y, z) {
    const pole = cyl(0.05, 0.05, y, mat(0x3a3f48, { metalness: 0.7 }), 6);
    pole.position.set(x, y / 2, z);
    this.group.add(pole);
    const lamp = sphere(0.22, mat(0xff2e2e, { emissive: 0xff2e2e, emissiveIntensity: 2 }), 8, 6);
    lamp.position.set(x, y + 0.2, z);
    this.group.add(lamp);
    this.updaters.push((dt, t) => {
      lamp.material.emissiveIntensity = 1 + Math.max(0, Math.sin(t * 3 + x)) * 2;
    });
    return lamp;
  }

  // Trolley Fuel Station — proximity trigger refills Trolley Fuel for free
  // (with a cooldown). Works on foot AND riding through it on the trolley.
  fuelStation(x, z, ry = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    const body = mkBox(1.2, 2, 0.9, mat(0xd92f2f, { roughness: 0.5, metalness: 0.3 }));
    body.position.y = 1;
    body.castShadow = true;
    g.add(body);
    const screen = mkBox(0.8, 0.5, 0.08, mat(0xffc23d, { emissive: 0xffaa00, emissiveIntensity: 1.4 }));
    screen.position.set(0, 1.5, 0.49);
    g.add(screen);
    const hose = cyl(0.05, 0.05, 1.1, mat(0x222222, { roughness: 0.9 }), 6);
    hose.position.set(0.7, 1, 0);
    hose.rotation.z = 0.5;
    g.add(hose);
    const sign = mkBox(1.6, 0.4, 0.12, mat(0xffc23d, { emissive: 0xcc8800, emissiveIntensity: 1 }));
    sign.position.set(0, 2.4, 0);
    g.add(sign);
    this.group.add(g);
    g.updateMatrixWorld();
    this.colliders.push(new THREE.Box3().setFromObject(body));
    this.trigger(new THREE.Vector3(x, 1, z), 3.4, () => {
      const game = this.game;
      if (!state.flags.trolleyUnlocked) return;
      if (state.fuel >= game.trolley.fuelMax - 1) return;
      game.trolley.refuel();
      game.audio.sfx('refuel');
      game.fx.burst(new THREE.Vector3(x, 1.4, z), 0xffc23d, 14);
      game.toast('TROLLEY FUEL: TOPPED UP. DO NOT QUESTION THE TROLLEY.');
    }, false, 12);
    return g;
  }

  // ============================================================
  // 3.0 TEXT SIGNS — canvas-drawn fictional signage (the funny ones)
  // ============================================================
  textSign(x, y, z, ry, text, opts = {}) {
    const fg = opts.fg ?? '#1a1d26';
    const bg = opts.bg ?? '#ffc23d';
    const w = opts.w ?? 4;
    const h = opts.h ?? 1;
    const c = document.createElement('canvas');
    c.width = 512; c.height = Math.round(512 * (h / w));
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = fg; ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, c.width - 16, c.height - 16);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = String(text).split('\n');
    let size = Math.min(c.height / (lines.length * 1.4), (c.width * 1.38) / Math.max(...lines.map((l) => l.length)));
    ctx.font = `900 ${Math.floor(size)}px 'Fredoka', 'Arial Black', sans-serif`;
    lines.forEach((l, i) => ctx.fillText(l, c.width / 2, c.height / 2 + (i - (lines.length - 1) / 2) * size * 1.25));
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: opts.glow ? new THREE.Color(bg) : 0x000000, emissiveMap: opts.glow ? tex : null, emissiveIntensity: opts.glow ? 0.5 : 1 }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    this.group.add(m);
    if (opts.post) {
      const post = cyl(0.06, 0.06, y, mat(0x4a4f58, { metalness: 0.7, roughness: 0.4 }), 6);
      post.position.set(x, y / 2, z);
      this.group.add(post);
    }
    return m;
  }

  // ============================================================
  // 3.0 MALL KIT — Queen Street Mall-inspired pedestrian props
  // ============================================================
  // Shopfront: facade + display window + awning + hanging sign.
  shopfront(x, z, ry, w = 10, color = 0xc9b8a0, signColor = 0xffc23d, h = 7) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    const body = mkBox(w, h, 4, mat(color, { roughness: 0.85 }));
    body.position.set(0, h / 2, -2);
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    // Display window (glowing interior)
    const win = mkBox(w * 0.7, 2.2, 0.15, mat(0xfff3cf, { emissive: 0xffe9b0, emissiveIntensity: 0.55 }));
    win.position.set(0, 1.6, 0.02);
    g.add(win);
    const frame = mkBox(w * 0.74, 2.5, 0.1, mat(0x2a2e36, { roughness: 0.5 }));
    frame.position.set(0, 1.6, -0.05);
    g.add(frame);
    // Door
    const door = mkBox(1.3, 2.5, 0.12, mat(0x39414d, { roughness: 0.5, metalness: 0.4 }));
    door.position.set(w * 0.38 - 0.8, 1.25, 0.02);
    g.add(door);
    // Awning — striped cartoon canopy
    const awn = mkBox(w * 0.86, 0.12, 1.6, mat(signColor, { roughness: 0.75 }));
    awn.position.set(0, 3.1, 0.8);
    awn.rotation.x = 0.18;
    awn.castShadow = true;
    g.add(awn);
    // Sign board above the awning
    const sign = mkBox(w * 0.6, 0.9, 0.18, mat(0x16181d, { roughness: 0.5 }));
    sign.position.set(0, 4.1, 0.1);
    g.add(sign);
    const signGlow = mkBox(w * 0.52, 0.55, 0.06, mat(signColor, { emissive: signColor, emissiveIntensity: 1.3 }));
    signGlow.position.set(0, 4.1, 0.22);
    g.add(signGlow);
    // Hanging side sign
    const hang = mkBox(0.7, 1.1, 0.1, mat(signColor, { emissive: signColor, emissiveIntensity: 0.8 }));
    hang.position.set(-w * 0.42, 3.0, 0.5);
    g.add(hang);
    this.group.add(g);
    // Collider on the facade body only
    g.updateMatrixWorld(true);
    this.colliders.push(new THREE.Box3().setFromObject(body));
    this.grounds.push(body);
    return g;
  }

  // Modern shade sail — mast + tilted stretched triangular canopies
  // (the Queen Street Mall signature structure, fictionalised).
  shadeSail(x, z, h = 11) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const mastM = mat(0x9aa3ad, { metalness: 0.8, roughness: 0.35 });
    const mast = cyl(0.22, 0.3, h, mastM, 8);
    mast.position.y = h / 2;
    mast.castShadow = true;
    g.add(mast);
    const sailM = mat(0xeef0f2, { roughness: 0.6, side: THREE.DoubleSide });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      // Sail = squashed cone shell, tilted off the mast top
      const sail = new THREE.Mesh(new THREE.ConeGeometry(4.6, 1.6, 3, 1, true), sailM);
      sail.position.set(Math.cos(a) * 3.4, h - 1 - i * 0.7, Math.sin(a) * 3.4);
      sail.rotation.set(0.25, a, 0.15);
      sail.scale.y = 0.5;
      sail.castShadow = true;
      g.add(sail);
      // Tension cable
      const cable = cyl(0.025, 0.025, 4.6, mastM, 4);
      cable.position.set(Math.cos(a) * 1.9, h - 0.6 - i * 0.4, Math.sin(a) * 1.9);
      cable.rotation.z = Math.cos(a) * 1.1;
      cable.rotation.x = -Math.sin(a) * 1.1;
      g.add(cable);
    }
    this.group.add(g);
    return g;
  }

  bench(x, z, ry = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = ry;
    const seat = mkBox(2.2, 0.12, 0.6, mat(0x8a6a48, { roughness: 0.85 }));
    seat.position.y = 0.5; seat.castShadow = true;
    g.add(seat);
    const back = mkBox(2.2, 0.5, 0.1, mat(0x8a6a48, { roughness: 0.85 }));
    back.position.set(0, 0.85, -0.27); back.rotation.x = -0.15;
    g.add(back);
    for (const sx of [-1, 1]) {
      const legM = mkBox(0.1, 0.5, 0.55, mat(0x3a3f48, { metalness: 0.7, roughness: 0.4 }));
      legM.position.set(sx * 0.95, 0.25, 0);
      g.add(legM);
    }
    this.group.add(g);
    return g;
  }

  planterBox(x, z, w = 2.4, d = 1.2) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const tub = mkBox(w, 0.7, d, mat(0x6b7280, { roughness: 0.8 }));
    tub.position.y = 0.35; tub.castShadow = true;
    g.add(tub);
    const soil = mkBox(w - 0.2, 0.1, d - 0.2, mat(0x3a2c1d, { roughness: 1 }));
    soil.position.y = 0.7;
    g.add(soil);
    for (let i = 0; i < 3; i++) {
      const bush = sphere(0.45, mat(0x3f9b4f, { roughness: 0.95 }), 8, 6);
      bush.position.set((i - 1) * (w / 3.2), 0.95, 0);
      bush.scale.y = 0.85;
      bush.castShadow = true;
      g.add(bush);
    }
    this.group.add(g);
    return g;
  }

  bollard(x, z) {
    const b = cyl(0.12, 0.14, 0.85, mat(0x39414d, { metalness: 0.6, roughness: 0.4 }), 8);
    b.position.set(x, 0.42, z);
    b.castShadow = true;
    this.group.add(b);
    const cap = sphere(0.12, mat(0xffc23d, { metalness: 0.7, roughness: 0.35 }), 8, 6);
    cap.position.set(x, 0.88, z);
    this.group.add(cap);
    return b;
  }

  streetLamp(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const pole = cyl(0.08, 0.11, 5.2, mat(0x2e333b, { metalness: 0.7, roughness: 0.4 }), 7);
    pole.position.y = 2.6; pole.castShadow = true;
    g.add(pole);
    const arm = mkBox(1.2, 0.08, 0.08, mat(0x2e333b, { metalness: 0.7 }));
    arm.position.set(0.55, 5.1, 0);
    g.add(arm);
    const lamp = sphere(0.18, mat(0xfff2cf, { emissive: 0xffe9b0, emissiveIntensity: 1.2 }), 8, 6);
    lamp.position.set(1.1, 5.0, 0);
    g.add(lamp);
    this.group.add(g);
    return g;
  }

  // Mall kiosk — little hexagonal coffee/news stand.
  mallKiosk(x, z, color = 0x44b04a) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const body = cyl(1.5, 1.6, 2.6, mat(0x2b3140, { roughness: 0.7 }), 6);
    body.position.y = 1.3; body.castShadow = true;
    g.add(body);
    const roof = cyl(2.1, 1.6, 0.5, mat(color, { roughness: 0.7 }), 6);
    roof.position.y = 2.85;
    g.add(roof);
    const counter = cyl(1.62, 1.62, 0.18, mat(0xd9d4c4, { roughness: 0.6 }), 6);
    counter.position.y = 1.1;
    g.add(counter);
    const sign = mkBox(1.5, 0.45, 0.1, mat(color, { emissive: color, emissiveIntensity: 0.9 }));
    sign.position.set(0, 3.3, 0);
    g.add(sign);
    this.group.add(g);
    g.updateMatrixWorld(true);
    this.colliders.push(new THREE.Box3().setFromObject(body));
    return g;
  }

  // Banner pair strung across the mall.
  mallBanner(x, z, ry, color = 0x2ee6ff, span = 14) {
    const g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = ry;
    for (const sx of [-1, 1]) {
      const pole = cyl(0.07, 0.09, 6.5, mat(0x2e333b, { metalness: 0.7 }), 6);
      pole.position.set(sx * span / 2, 3.25, 0);
      g.add(pole);
    }
    const wire = cyl(0.02, 0.02, span, mat(0x44484f, { metalness: 0.8 }), 4);
    wire.position.y = 6.2; wire.rotation.z = Math.PI / 2;
    g.add(wire);
    for (let i = 0; i < 4; i++) {
      const flag = mkBox(1.6, 1.0, 0.04, mat(i % 2 ? color : 0xffc23d, { emissive: i % 2 ? color : 0xffc23d, emissiveIntensity: 0.5, side: THREE.DoubleSide }));
      flag.position.set(-span / 2 + (i + 0.75) * (span / 4.5), 5.6, 0);
      g.add(flag);
    }
    this.group.add(g);
    return g;
  }

  fountain(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const basin = cyl(3.2, 3.5, 0.7, mat(0x9aa3ad, { roughness: 0.5, metalness: 0.3 }), 18);
    basin.position.y = 0.35; basin.castShadow = true;
    g.add(basin);
    const water = cyl(2.9, 2.9, 0.12, mat(0x4db8e8, { roughness: 0.1, metalness: 0.4, emissive: 0x0a3a55, transparent: true, opacity: 0.85 }), 18);
    water.position.y = 0.72;
    g.add(water);
    const pillar = cyl(0.3, 0.45, 1.6, mat(0x9aa3ad, { roughness: 0.5 }), 10);
    pillar.position.y = 1.3;
    g.add(pillar);
    // Golden rebar sculpture on top (Brisbane public art, Bung edition)
    const art = cyl(0.07, 0.07, 2.0, mat(0xffc94d, { metalness: 0.95, roughness: 0.25, emissive: 0x5a3c08 }), 7);
    art.position.y = 3.0; art.rotation.z = 0.5;
    g.add(art);
    const spray = sphere(0.5, mat(0xbfe8ff, { transparent: true, opacity: 0.35, roughness: 0.2 }), 8, 6);
    spray.position.y = 2.2;
    g.add(spray);
    this.updaters.push((dt, t) => { spray.scale.setScalar(1 + Math.sin(t * 3) * 0.15); art.rotation.y = t * 0.6; });
    this.group.add(g);
    g.updateMatrixWorld(true);
    this.colliders.push(new THREE.Box3().setFromObject(basin));
    this.grounds.push(basin);
    return g;
  }

  directoryBoard(x, z, ry = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = ry;
    const frame = mkBox(1.6, 2.6, 0.25, mat(0x2e333b, { metalness: 0.5, roughness: 0.5 }));
    frame.position.y = 1.5; frame.castShadow = true;
    g.add(frame);
    const screen = mkBox(1.3, 2.0, 0.06, mat(0x2ee6ff, { emissive: 0x1787c9, emissiveIntensity: 1.1 }));
    screen.position.set(0, 1.55, 0.14);
    g.add(screen);
    this.group.add(g);
    return g;
  }

  // Simple wandering pedestrian NPCs — colourful capsule people who stroll
  // between waypoints inside a rectangle. Pure set dressing, no collision.
  pedestrians(cx, cz, w, d, count = 8, seed = 11) {
    const rand = rng(seed);
    const palette = [0xe06a5a, 0x5aa0e0, 0x6ec46e, 0xd9a13d, 0xb07ad9, 0x4dc6c6];
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      const c = pick(rand, palette);
      const body = cyl(0.16, 0.21, 0.75, mat(c, { roughness: 0.85 }), 8);
      body.position.y = 0.75; body.castShadow = true;
      g.add(body);
      const head = sphere(0.16, mat(0xe8b88a, { roughness: 0.8 }), 8, 6);
      head.position.y = 1.32;
      g.add(head);
      const hat = Math.random() < 0.4 ? cyl(0.17, 0.17, 0.08, mat(pick(rand, palette), { roughness: 0.9 }), 8) : null;
      if (hat) { hat.position.y = 1.46; g.add(hat); }
      const px = cx + (rand() - 0.5) * w, pz = cz + (rand() - 0.5) * d;
      g.position.set(px, 0, pz);
      this.group.add(g);
      const ped = { g, tx: px, tz: pz, speed: 1 + rand() * 0.8, wait: rand() * 3 };
      this.updaters.push((dt, t) => {
        const dx = ped.tx - ped.g.position.x, dz = ped.tz - ped.g.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.3) {
          ped.wait -= dt;
          if (ped.wait <= 0) {
            ped.tx = cx + (Math.random() - 0.5) * w;
            ped.tz = cz + (Math.random() - 0.5) * d;
            ped.wait = 1 + Math.random() * 4;
          }
        } else {
          ped.g.position.x += (dx / dist) * ped.speed * dt;
          ped.g.position.z += (dz / dist) * ped.speed * dt;
          ped.g.rotation.y = Math.atan2(dx, dz);
          ped.g.position.y = Math.abs(Math.sin(t * 8 + ped.speed * 9)) * 0.05; // little walk bob
        }
      });
    }
  }

  // ============================================================
  // 3.0 AIRPORT KIT — terminal furniture (Reference Images B + C)
  // ============================================================
  checkInCounter(x, z, ry = 0, color = 0x2ee6ff) {
    const g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = ry;
    const desk = mkBox(3.4, 1.15, 1.0, mat(0xf0f2f4, { roughness: 0.45 }));
    desk.position.y = 0.57; desk.castShadow = true;
    g.add(desk);
    const top = mkBox(3.5, 0.08, 1.1, mat(0x2b3140, { roughness: 0.4, metalness: 0.3 }));
    top.position.y = 1.18;
    g.add(top);
    // Back screen pillar with airline-ish glow
    const pillar = mkBox(0.5, 3.4, 0.4, mat(0x39414d, { roughness: 0.5 }));
    pillar.position.set(0, 1.7, -0.9);
    g.add(pillar);
    const screen = mkBox(1.4, 0.8, 0.08, mat(color, { emissive: color, emissiveIntensity: 1.2 }));
    screen.position.set(0, 2.9, -0.85);
    g.add(screen);
    this.group.add(g);
    g.updateMatrixWorld(true);
    this.colliders.push(new THREE.Box3().setFromObject(desk));
    this.grounds.push(desk);
    return g;
  }

  seatRow(x, z, ry = 0, n = 5) {
    const g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = ry;
    const beam = mkBox(n * 0.72, 0.08, 0.5, mat(0x6b7280, { metalness: 0.7, roughness: 0.35 }));
    beam.position.y = 0.42;
    g.add(beam);
    for (let i = 0; i < n; i++) {
      const seat = mkBox(0.6, 0.1, 0.55, mat(0x35588a, { roughness: 0.6 }));
      seat.position.set((i - (n - 1) / 2) * 0.72, 0.5, 0);
      g.add(seat);
      const back = mkBox(0.6, 0.55, 0.1, mat(0x35588a, { roughness: 0.6 }));
      back.position.set((i - (n - 1) / 2) * 0.72, 0.78, -0.24);
      back.rotation.x = -0.12;
      g.add(back);
    }
    for (const sx of [-1, 1]) {
      const leg = mkBox(0.1, 0.42, 0.45, mat(0x4a4f58, { metalness: 0.7 }));
      leg.position.set(sx * (n * 0.33), 0.21, 0);
      g.add(leg);
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.group.add(g);
    return g;
  }

  flightBoard(x, y, z, ry = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z); g.rotation.y = ry;
    const frame = mkBox(5.4, 2.4, 0.25, mat(0x16181d, { roughness: 0.5 }));
    g.add(frame);
    // Rows of fake departures: alternating gold/blue/red text bars
    for (let r = 0; r < 5; r++) {
      for (let c2 = 0; c2 < 3; c2++) {
        const w2 = c2 === 0 ? 1.7 : c2 === 1 ? 1.1 : 0.7;
        const bar = mkBox(w2, 0.16, 0.04, mat(c2 === 2 && r % 3 === 0 ? 0xff2e5f : c2 === 1 ? 0x2ee6ff : 0xffc23d,
          { emissive: c2 === 2 && r % 3 === 0 ? 0xff2e5f : c2 === 1 ? 0x2ee6ff : 0xffc23d, emissiveIntensity: 1.2 }));
        bar.position.set(-1.7 + c2 * 1.8, 0.85 - r * 0.4, 0.15);
        g.add(bar);
      }
    }
    this.group.add(g);
    return g;
  }

  gateSign(x, y, z, ry = 0, color = 0xffc23d) {
    const g = new THREE.Group();
    g.position.set(x, y, z); g.rotation.y = ry;
    const panel = mkBox(2.4, 0.8, 0.12, mat(0x14305a, { roughness: 0.5 }));
    g.add(panel);
    const glow = mkBox(2.0, 0.45, 0.05, mat(color, { emissive: color, emissiveIntensity: 1.3 }));
    glow.position.z = 0.09;
    g.add(glow);
    this.group.add(g);
    return g;
  }

  securityScanner(x, z, ry = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = ry;
    for (const sx of [-1, 1]) {
      const post = mkBox(0.3, 2.6, 0.7, mat(0xd9dde2, { roughness: 0.5 }));
      post.position.set(sx * 1.0, 1.3, 0);
      post.castShadow = true;
      g.add(post);
    }
    const lintel = mkBox(2.3, 0.4, 0.7, mat(0xd9dde2, { roughness: 0.5 }));
    lintel.position.y = 2.75;
    g.add(lintel);
    const lamp = sphere(0.1, mat(0x43d96b, { emissive: 0x43d96b, emissiveIntensity: 2 }), 6, 5);
    lamp.position.y = 3.05;
    g.add(lamp);
    this.updaters.push((dt, t) => { lamp.material.emissiveIntensity = 1.2 + Math.sin(t * 4) * 0.8; });
    this.group.add(g);
    return g;
  }

  queueBarrier(x, z, ry, len = 4) {
    const g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = ry;
    const n = Math.max(2, Math.round(len / 2));
    for (let i = 0; i < n; i++) {
      const post = cyl(0.06, 0.1, 1.0, mat(0x9aa3ad, { metalness: 0.85, roughness: 0.25 }), 8);
      post.position.set(i * (len / (n - 1)) - len / 2, 0.5, 0);
      g.add(post);
    }
    const belt = mkBox(len, 0.08, 0.03, mat(0xd92f2f, { roughness: 0.7 }));
    belt.position.y = 0.85;
    g.add(belt);
    this.group.add(g);
    return g;
  }

  vendingMachine(x, z, ry = 0, color = 0xff2e5f) {
    const g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = ry;
    const body = mkBox(1.1, 2.1, 0.9, mat(color, { roughness: 0.5 }));
    body.position.y = 1.05; body.castShadow = true;
    g.add(body);
    const glass = mkBox(0.7, 1.3, 0.06, mat(0xbfe3ff, { emissive: 0x86c8f0, emissiveIntensity: 0.7, transparent: true, opacity: 0.9 }));
    glass.position.set(-0.12, 1.3, 0.46);
    g.add(glass);
    this.group.add(g);
    g.updateMatrixWorld(true);
    this.colliders.push(new THREE.Box3().setFromObject(body));
    return g;
  }

  binProp(x, z) {
    const b = cyl(0.32, 0.28, 0.9, mat(0x4a5560, { metalness: 0.5, roughness: 0.5 }), 10);
    b.position.set(x, 0.45, z);
    b.castShadow = true;
    this.group.add(b);
    const lid = cyl(0.36, 0.36, 0.08, mat(0x2e333b, { metalness: 0.6 }), 10);
    lid.position.set(x, 0.94, z);
    this.group.add(lid);
    return b;
  }

  baggageCart(x, z, ry = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = ry;
    const bed = mkBox(1.0, 0.1, 1.8, mat(0x9aa3ad, { metalness: 0.8, roughness: 0.3 }));
    bed.position.y = 0.4;
    g.add(bed);
    for (const [sx, sz] of [[-0.4, 0.7], [0.4, 0.7], [-0.4, -0.7], [0.4, -0.7]]) {
      const wl = cyl(0.12, 0.12, 0.08, mat(0x26262c, { roughness: 0.9 }), 8);
      wl.rotation.z = Math.PI / 2;
      wl.position.set(sx, 0.12, sz);
      g.add(wl);
    }
    const rand = rng(Math.floor(x * 7 + z * 13));
    for (let i = 0; i < 3; i++) {
      const bag = mkBox(0.5 + rand() * 0.3, 0.35, 0.7, mat(pick(rand, [0xc0392b, 0x35588a, 0x6b4a8a, 0x3a7d52]), { roughness: 0.85 }));
      bag.position.set((rand() - 0.5) * 0.3, 0.62 + i * 0.32, (rand() - 0.5) * 0.7);
      bag.rotation.y = (rand() - 0.5) * 0.4;
      bag.castShadow = true;
      g.add(bag);
    }
    this.group.add(g);
    return g;
  }

  // Parked jet seen through the terminal glass — fuselage, wings, tail.
  plane(x, z, ry = 0, scale = 1) {
    const g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = ry; g.scale.setScalar(scale);
    const body = cyl(1.6, 1.6, 18, mat(0xf0f2f4, { roughness: 0.35, metalness: 0.3 }), 12);
    body.rotation.z = Math.PI / 2;
    body.position.y = 3.4;
    g.add(body);
    const nose = sphere(1.6, mat(0xf0f2f4, { roughness: 0.35, metalness: 0.3 }), 10, 8);
    nose.position.set(9, 3.4, 0); nose.scale.x = 1.6;
    g.add(nose);
    const tailFin = mkBox(0.3, 4.2, 2.6, mat(0xffc23d, { roughness: 0.5 }));
    tailFin.position.set(-8.6, 5.8, 0);
    tailFin.rotation.z = -0.25;
    g.add(tailFin);
    for (const sz of [-1, 1]) {
      const wing = mkBox(2.6, 0.25, 7.5, mat(0xd9dde2, { roughness: 0.4, metalness: 0.4 }));
      wing.position.set(0.5, 3.1, sz * 4.6);
      wing.rotation.y = sz * -0.35;
      g.add(wing);
      const engine = cyl(0.7, 0.7, 1.8, mat(0x39414d, { metalness: 0.7, roughness: 0.3 }), 10);
      engine.rotation.z = Math.PI / 2;
      engine.position.set(1.6, 2.4, sz * 3.6);
      g.add(engine);
    }
    // Blue cabin window stripe
    const stripe = cyl(1.62, 1.62, 10, mat(0x35588a, { roughness: 0.4 }), 12, true);
    stripe.rotation.z = Math.PI / 2;
    stripe.position.y = 3.7;
    stripe.scale.set(0.25, 1, 0.25);
    g.add(stripe);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.group.add(g);
    return g;
  }

  // Glass curtain wall with mullions — see the planes outside.
  glassWall(x, z, len, ry = 0, h = 10) {
    const g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = ry;
    const glass = mkBox(len, h, 0.15, mat(0xa8d4ee, { roughness: 0.05, metalness: 0.55, transparent: true, opacity: 0.32 }));
    glass.position.y = h / 2;
    g.add(glass);
    const mullM = mat(0x4a4f58, { metalness: 0.7, roughness: 0.35 });
    for (let i = 0; i <= Math.round(len / 4); i++) {
      const mull = mkBox(0.18, h, 0.3, mullM);
      mull.position.set(-len / 2 + i * (len / Math.round(len / 4)), h / 2, 0);
      g.add(mull);
    }
    const beam = mkBox(len, 0.3, 0.3, mullM);
    beam.position.y = h - 0.2;
    g.add(beam);
    this.group.add(g);
    // Invisible wall collider so the player can't walk through glass
    g.updateMatrixWorld(true);
    this.colliders.push(new THREE.Box3().setFromObject(glass));
    return g;
  }

  // Triangular-skylight terminal ceiling (Reference Image C).
  skylightCeiling(cx, cz, w, d, y = 12) {
    const ceil = mkBox(w, 0.4, d, texMat('skylight', skylightTexture(Math.round(w / 12)), { roughness: 0.8, emissive: 0x9fc8e8, emissiveIntensity: 0.22 }));
    ceil.position.set(cx, y, cz);
    this.group.add(ceil);
    return ceil;
  }

  // ============================================================
  // 3.0 CYBER KIT — Red Mode mega-city dressing
  // ============================================================
  // Animated LED billboard with scrolling fictional glyphs.
  ledBillboard(x, y, z, ry = 0, w = 3, h = 6, seed = 1, fg = '#ff2e5f') {
    const tex = ledTexture(seed, fg);
    const m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 1.1, color: 0x222222, roughness: 0.6 });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.18), m);
    panel.position.set(x, y, z);
    panel.rotation.y = ry;
    this.group.add(panel);
    this.updaters.push((dt) => { tex.offset.y -= dt * 0.12; }); // slow glyph scroll
    return panel;
  }

  steamVent(x, z) {
    const grate = cyl(0.5, 0.55, 0.18, mat(0x3a3f48, { metalness: 0.6, roughness: 0.6 }), 10);
    grate.position.set(x, 0.09, z);
    this.group.add(grate);
    const puffs = [];
    for (let i = 0; i < 3; i++) {
      const p = sphere(0.3, mat(0xbfc8d4, { transparent: true, opacity: 0.25, roughness: 1 }), 7, 5);
      p.position.set(x, 0.4, z);
      this.group.add(p);
      puffs.push({ p, off: i * 0.8 });
    }
    this.updaters.push((dt, t) => {
      for (const { p, off } of puffs) {
        const k = ((t * 0.7 + off) % 2.4) / 2.4;
        p.position.y = 0.3 + k * 3.2;
        p.scale.setScalar(0.5 + k * 1.6);
        p.material.opacity = 0.3 * (1 - k);
      }
    });
  }

  // Sagging power/sign cables strung between two points.
  cableSpan(x1, y1, z1, x2, y2, z2, segs = 6) {
    const m = mat(0x16181d, { roughness: 0.9 });
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs, t1 = (i + 1) / segs;
      const sag = (t) => Math.sin(t * Math.PI) * -1.2;
      const a = new THREE.Vector3(x1 + (x2 - x1) * t0, y1 + (y2 - y1) * t0 + sag(t0), z1 + (z2 - z1) * t0);
      const b = new THREE.Vector3(x1 + (x2 - x1) * t1, y1 + (y2 - y1) * t1 + sag(t1), z1 + (z2 - z1) * t1);
      const len = a.distanceTo(b);
      const seg = cyl(0.03, 0.03, len, m, 4);
      seg.position.copy(a).lerp(b, 0.5);
      seg.lookAt(b);
      seg.rotateX(Math.PI / 2);
      this.group.add(seg);
    }
  }

  // Street food stall with steam + lantern glow.
  foodStall(x, z, ry = 0, color = 0xd92f2f) {
    const g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = ry;
    const counter = mkBox(2.6, 1.1, 1.2, mat(0x4a3a2a, { roughness: 0.85 }));
    counter.position.y = 0.55; counter.castShadow = true;
    g.add(counter);
    for (const sx of [-1, 1]) {
      const pole = cyl(0.04, 0.04, 2.3, mat(0x2e333b, { roughness: 0.7 }), 5);
      pole.position.set(sx * 1.15, 1.15, -0.4);
      g.add(pole);
    }
    const roof = mkBox(3.0, 0.1, 1.6, mat(color, { roughness: 0.7 }));
    roof.position.set(0, 2.35, -0.1);
    roof.rotation.x = -0.12;
    g.add(roof);
    // Hanging lantern
    const lantern = sphere(0.18, mat(0xff8a3d, { emissive: 0xff6a1f, emissiveIntensity: 1.6 }), 8, 6);
    lantern.position.set(0.9, 1.9, 0.4);
    g.add(lantern);
    // Food trays glow
    const tray = mkBox(1.8, 0.08, 0.5, mat(0xffc23d, { emissive: 0xcc8800, emissiveIntensity: 0.7 }));
    tray.position.set(0, 1.14, 0.1);
    g.add(tray);
    this.group.add(g);
    g.updateMatrixWorld(true);
    this.colliders.push(new THREE.Box3().setFromObject(counter));
    this.grounds.push(counter);
    return g;
  }

  // Elevated walkway slab between rooftops/sections (walkable).
  walkway(x1, z1, x2, z2, y, w = 3, color = 0x2a2f3a) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const m = mkBox(w, 0.35, len, mat(color, { roughness: 0.6, metalness: 0.3 }));
    m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
    m.rotation.y = Math.atan2(x2 - x1, z2 - z1);
    m.receiveShadow = true;
    this.group.add(m);
    this.grounds.push(m);
    // Neon edge rails
    for (const sx of [-1, 1]) {
      const rail = mkBox(0.08, 0.08, len, mat(0x2ee6ff, { emissive: 0x2ee6ff, emissiveIntensity: 1.2 }));
      rail.position.set((x1 + x2) / 2 + Math.cos(m.rotation.y) * sx * (w / 2), y + 0.3, (z1 + z2) / 2 - Math.sin(m.rotation.y) * sx * (w / 2));
      rail.rotation.y = m.rotation.y;
      this.group.add(rail);
    }
    return m;
  }

  // Floating holographic rebar data bits (Shenzhen core ambience).
  holoBits(cx, cy, cz, r = 6, n = 10, color = 0xff2e5f) {
    const bits = [];
    for (let i = 0; i < n; i++) {
      const b = mkBox(0.12, 0.5, 0.12, mat(color, { emissive: color, emissiveIntensity: 1.8, transparent: true, opacity: 0.75 }));
      const a = (i / n) * Math.PI * 2;
      b.position.set(cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r);
      this.group.add(b);
      bits.push({ b, a, ro: r * (0.7 + Math.random() * 0.5), yo: Math.random() * 2 });
    }
    this.updaters.push((dt, t) => {
      for (const { b, a, ro, yo } of bits) {
        b.position.x = cx + Math.cos(a + t * 0.4) * ro;
        b.position.z = cz + Math.sin(a + t * 0.4) * ro;
        b.position.y = cy + Math.sin(t * 1.5 + yo * 4) * 1.2;
        b.rotation.y = t * 2;
      }
    });
  }

  // ---------- Bung Test Paddock ----------
  // A compact verification lane: walk portal, jump portal, grapple portal,
  // trolley boost lane with ramp ring, a 5-portal chain, and a rebar line.
  // Used by humans AND the headless test suite.
  testPaddock(cx, cz) {
    const deck = mat(0x3d4450, { roughness: 0.8 });
    this.plate(cx, 0, cz, 46, 26, deck);
    this.neonSign(cx, 5, cz - 12.5, 10, 1.2, 0xffc23d);
    this.warnSign(cx - 20, cz - 11, 0.4);
    this.warnSign(cx + 20, cz - 11, -0.4);

    // 1) Slow-walk portal at ground level
    this.portal('bronze', cx - 18, 2.2, cz - 6);
    // 2) Jump portal — clearable with a single jump
    this.portal('bronze', cx - 10, 3.6, cz - 6);
    // 3) Grapple portal — high, with a grapple point above it
    this.portal('silver', cx - 1, 7.5, cz - 6);
    this.grapple(cx - 1, 11, cz - 6);
    // 4) Trolley boost lane: ramp into a gold ring
    this.ramp(cx + 8, 0, cz + 6, 7, 4, 2.4, Math.PI / 2);
    this.portal('gold', cx + 16, 4.5, cz + 6, Math.PI / 2);
    // 5) Chain of 5 portals for combo testing
    for (let i = 0; i < 5; i++) this.portal('bronze', cx - 16 + i * 8, 2.2, cz + 11, 0);
    // Rebar line for pickup/chain testing
    for (let i = 0; i < 8; i++) this.rebar(cx - 14 + i * 4, 0, cz - 11);
    this.fuelStation(cx + 21, cz + 1, -Math.PI / 2);
    for (let i = 0; i < 4; i++) this.cone(cx - 21 + i * 1.2, cz + 4);
  }

  // ---------- Gameplay objects ----------
  portal(tier, x, y, z, ry = 0, rx = 0) {
    const p = new Portal(this.game, tier, new THREE.Vector3(x, y, z), ry, rx);
    this.group.add(p.group);
    this.portals.push(p);
    return p;
  }

  addCollectible(kind, pos) {
    const c = new Collectible(this.game, kind, pos instanceof THREE.Vector3 ? pos : new THREE.Vector3(...pos));
    this.pickups.push(c);
    return c;
  }
  rebar(x, y, z) { return this.addCollectible('rebar', new THREE.Vector3(x, y + 0.7, z)); }
  coin(x, y, z) { return this.addCollectible('coin', new THREE.Vector3(x, y + 0.8, z)); }

  grapple(x, y, z) {
    const p = new THREE.Vector3(x, y, z);
    this.grapplePoints.push(p);
    // Visible glowing rebar knot marker
    const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.35),
      mat(0xffc23d, { emissive: 0xffaa00, emissiveIntensity: 1.4, metalness: 0.8, roughness: 0.3 }));
    marker.position.copy(p);
    this.group.add(marker);
    this.updaters.push((dt, t) => { marker.rotation.y = t * 1.5; });
    return p;
  }

  interact(x, y, z, label, fn, dist = 3.2) {
    this.interactables.push({ pos: new THREE.Vector3(x, y, z), label, fn, dist });
  }

  trigger(pos, radius, fn, once = true, cooldown = 0) {
    this.triggers.push({ pos: pos.clone(), radius, fn, once, fired: false, cd: 0, cooldown });
  }

  spawner(kind, x, y, z, radius, count, respawn = 12) {
    const s = new Spawner(this.game, kind, new THREE.Vector3(x, y, z), radius, count, respawn);
    this.spawners.push(s);
    return s;
  }

  npc(kind, x, y, z, ry = 0) {
    const n = new NPC(this.game, kind, new THREE.Vector3(x, y, z), ry);
    this.npcs.push(n);
    return n;
  }

  // Rebar Exchange kiosk (sell score + open shop)
  exchangeKiosk(x, y, z, ry = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    const body = mkBox(2.4, 2.6, 1.4, mat(0x39414d, { metalness: 0.8, roughness: 0.3 }));
    body.position.y = 1.3;
    body.castShadow = true;
    g.add(body);
    const screen = mkBox(1.8, 1, 0.1, mat(0x2ee6ff, { emissive: 0x2ee6ff, emissiveIntensity: 1.2 }));
    screen.position.set(0, 1.7, 0.75);
    g.add(screen);
    const sign = mkBox(2.8, 0.6, 0.2, mat(0xffc23d, { emissive: 0xcc8800, emissiveIntensity: 0.9 }));
    sign.position.set(0, 2.9, 0);
    g.add(sign);
    this.group.add(g);
    g.updateMatrixWorld();
    this.colliders.push(new THREE.Box3().setFromObject(body));
    this.interact(x, y, z, '<b>[E]</b> REBAR EXCHANGE — sell score / buy upgrades', () => {
      this.game.menus.openShop();
    }, 3.6);
    return g;
  }

  // Deployment Board (map travel)
  deploymentBoard(x, y, z, ry = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    const board = mkBox(3.6, 2.2, 0.25, mat(0x10141c, { metalness: 0.6, roughness: 0.4 }));
    board.position.y = 2;
    g.add(board);
    const frame = mkBox(3.9, 2.5, 0.18, mat(0xffc23d, { metalness: 0.9, roughness: 0.3 }));
    frame.position.y = 2;
    frame.position.z = -0.05;
    g.add(frame);
    // Glowing map dots
    for (let i = 0; i < 6; i++) {
      const dot = sphere(0.09, mat(i < 3 ? 0x2ee6ff : 0xff2e5f, { emissive: i < 3 ? 0x2ee6ff : 0xff2e5f, emissiveIntensity: 2 }), 6, 4);
      dot.position.set(-1.3 + (i % 3) * 1.3, 1.7 + Math.floor(i / 3) * 0.8, 0.18);
      g.add(dot);
    }
    const legL = cyl(0.08, 0.08, 1, mat(0x39414d, { metalness: 0.8 }), 6);
    legL.position.set(-1.2, 0.5, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = 1.2; g.add(legR);
    this.group.add(g);
    this.interact(x, y, z, '<b>[E]</b> DEPLOYMENT BOARD — travel', () => {
      this.game.menus.openDeploy();
    }, 3.6);
    return g;
  }

  // ---------- Per-frame ----------
  update(dt, t) {
    for (const p of this.portals) p.update(dt);
    for (const c of this.pickups) c.update(dt);
    for (const s of this.spawners) s.update(dt);
    for (const n of this.npcs) n.update(dt);
    for (const u of this.updaters) u(dt, t);

    // Triggers
    const playerPos = this.game.trolley.riding ? this.game.trolley.pos : this.game.player.pos;
    for (const tr of this.triggers) {
      tr.cd = Math.max(0, tr.cd - dt);
      if (tr.once && tr.fired) continue;
      if (tr.cd > 0) continue;
      if (playerPos.distanceTo(tr.pos) < tr.radius) {
        tr.fired = true;
        tr.cd = tr.cooldown || 0;
        tr.fn();
      }
    }

    // Rain
    if (this.rain) {
      const { pos, count, area, points } = this.rain;
      const px = playerPos.x, pz = playerPos.z;
      for (let i = 0; i < count; i++) {
        pos[i * 3 + 1] -= dt * 38;
        if (pos[i * 3 + 1] < 0) {
          pos[i * 3] = px + (Math.random() - 0.5) * area;
          pos[i * 3 + 1] = 45 + Math.random() * 15;
          pos[i * 3 + 2] = pz + (Math.random() - 0.5) * area;
        }
      }
      points.geometry.attributes.position.needsUpdate = true;
    }
  }

  // Find the closest interactable in range (HUD prompt + E key)
  nearestInteract(playerPos) {
    let best = null, bestD = Infinity;
    for (const it of this.interactables) {
      const d = playerPos.distanceTo(it.pos);
      if (d < it.dist && d < bestD) { bestD = d; best = it; }
    }
    return best;
  }

  dispose() {
    this.game.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose?.();
      }
    });
  }
}
