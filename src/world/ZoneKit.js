// ZoneKit — the toolkit every zone is built with. Owns the zone's scene
// group, colliders, grounds, portals, pickups, enemies, NPCs, triggers,
// interactables, grapple points, lighting, weather, and per-frame updates.
import * as THREE from 'three';
import { mat, box as mkBox, cyl, sphere } from '../core/utils.js';
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
