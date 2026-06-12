// Procedural stylised character & vehicle models, built entirely from
// primitives so the game needs zero external assets. Each builder returns a
// THREE.Group with named parts stashed in .userData for animation.
import * as THREE from 'three';
import { mat, box, sphere, cyl, goldMat, rebarMat } from '../core/utils.js';

const SKIN = () => mat(0xe8b88a, { roughness: 0.75 });
const SKIN_D = () => mat(0xd6a173, { roughness: 0.75 });

// ============================================================
// BUNG BUNTY — large round chaotic Aussie legend
// ============================================================
export function buildBung() {
  const g = new THREE.Group();
  const parts = {};

  // Belly / singlet (stained white)
  const belly = sphere(0.62, mat(0xf2efe6, { roughness: 0.9 }), 18, 14);
  belly.scale.set(1, 1.12, 0.92);
  belly.position.y = 0.95;
  g.add(belly);
  // Singlet stains
  for (const [x, y, z] of [[0.2, 1.05, 0.52], [-0.25, 0.85, 0.5], [0.05, 0.7, 0.55]]) {
    const stain = sphere(0.09, mat(0xc9bd9c, { roughness: 1 }), 8, 6);
    stain.position.set(x, y, z); stain.scale.z = 0.25;
    g.add(stain);
  }
  parts.belly = belly;

  // Dodgy brown boxer shorts
  const shorts = cyl(0.5, 0.55, 0.42, mat(0x7a5230, { roughness: 1 }), 14);
  shorts.position.y = 0.42;
  g.add(shorts);

  // Legs (stubby)
  const legGeoMat = SKIN();
  parts.legL = new THREE.Group(); parts.legR = new THREE.Group();
  for (const [grp, sx] of [[parts.legL, -1], [parts.legR, 1]]) {
    grp.position.set(sx * 0.22, 0.34, 0);
    const leg = cyl(0.11, 0.13, 0.42, legGeoMat, 8);
    leg.position.y = -0.18;
    grp.add(leg);
    // Thong (flip-flop)
    const thong = box(0.22, 0.06, 0.34, mat(0x2266cc, { roughness: 0.9 }));
    thong.position.set(0, -0.4, 0.06);
    grp.add(thong);
    g.add(grp);
  }

  // Arms
  parts.armL = new THREE.Group(); parts.armR = new THREE.Group();
  for (const [grp, sx] of [[parts.armL, -1], [parts.armR, 1]]) {
    grp.position.set(sx * 0.62, 1.28, 0);
    const arm = cyl(0.09, 0.11, 0.52, legGeoMat, 8);
    arm.position.y = -0.26;
    arm.rotation.z = sx * 0.25;
    grp.add(arm);
    const hand = sphere(0.12, SKIN_D(), 8, 6);
    hand.position.set(sx * 0.13, -0.52, 0);
    grp.add(hand);
    g.add(grp);
  }

  // Head
  const headG = new THREE.Group();
  headG.position.y = 1.78;
  const head = sphere(0.34, SKIN(), 16, 12);
  head.scale.set(1, 1.05, 0.95);
  headG.add(head);
  parts.head = headG;

  // Eyes — big and expressive
  for (const sx of [-1, 1]) {
    const eye = sphere(0.085, mat(0xffffff, { roughness: 0.3 }), 8, 6);
    eye.position.set(sx * 0.13, 0.06, 0.29);
    headG.add(eye);
    const pupil = sphere(0.04, mat(0x191919, { roughness: 0.2 }), 6, 4);
    pupil.position.set(sx * 0.13, 0.06, 0.36);
    headG.add(pupil);
    // bushy brow
    const brow = box(0.13, 0.035, 0.04, mat(0x4a3220, { roughness: 1 }));
    brow.position.set(sx * 0.13, 0.17, 0.3);
    brow.rotation.z = sx * -0.15;
    headG.add(brow);
  }
  // Nose
  const nose = sphere(0.07, SKIN_D(), 8, 6);
  nose.position.set(0, -0.03, 0.33);
  headG.add(nose);
  // Mouth (cheeky grin)
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 6, 10, Math.PI), mat(0x7a3b2e, { roughness: 0.8 }));
  mouth.position.set(0, -0.13, 0.3);
  mouth.rotation.set(0, 0, Math.PI);
  headG.add(mouth);

  // FOUR THIN SPIKY REBAR HAIRS
  for (let i = 0; i < 4; i++) {
    const hair = cyl(0.012, 0.02, 0.3, rebarMat(), 5);
    const a = (i / 3 - 0.5) * 0.9;
    hair.position.set(Math.sin(a) * 0.16, 0.4, -0.05 + Math.cos(a) * 0.04);
    hair.rotation.z = -a * 0.7;
    hair.rotation.x = (Math.random() - 0.5) * 0.3;
    headG.add(hair);
  }
  // Scraggly spiky goatee
  for (let i = 0; i < 5; i++) {
    const spike = cyl(0.004, 0.022, 0.16, mat(0x5a4028, { roughness: 1 }), 4);
    spike.position.set((i - 2) * 0.05, -0.3, 0.22);
    spike.rotation.x = 0.5 + (i % 2) * 0.25;
    headG.add(spike);
  }
  g.add(headG);

  g.userData.parts = parts;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}

// ============================================================
// CHING — organised, strategic, futuristic travel outfit
// ============================================================
export function buildChing() {
  const g = new THREE.Group();
  // Body — sleek futuristic jacket
  const torso = cyl(0.22, 0.27, 0.7, mat(0x1fb8c9, { metalness: 0.4, roughness: 0.4, emissive: 0x052a30 }), 12);
  torso.position.y = 1.0;
  g.add(torso);
  // Neon trim
  const trim = cyl(0.235, 0.235, 0.05, mat(0x2ee6ff, { emissive: 0x2ee6ff, emissiveIntensity: 1.4 }), 12);
  trim.position.y = 1.28;
  g.add(trim);
  // Legs — dark techwear pants
  for (const sx of [-1, 1]) {
    const leg = cyl(0.085, 0.1, 0.62, mat(0x23262e, { roughness: 0.8 }), 8);
    leg.position.set(sx * 0.12, 0.34, 0);
    g.add(leg);
    const boot = box(0.16, 0.1, 0.26, mat(0xeeeeee, { roughness: 0.4 }));
    boot.position.set(sx * 0.12, 0.06, 0.04);
    g.add(boot);
  }
  // Arms
  for (const sx of [-1, 1]) {
    const arm = cyl(0.06, 0.075, 0.55, mat(0x1fb8c9, { metalness: 0.4, roughness: 0.4 }), 8);
    arm.position.set(sx * 0.32, 1.05, 0);
    arm.rotation.z = sx * 0.18;
    g.add(arm);
    const hand = sphere(0.075, SKIN(), 8, 6);
    hand.position.set(sx * 0.38, 0.74, 0);
    g.add(hand);
  }
  // Head
  const headG = new THREE.Group();
  headG.position.y = 1.62;
  const head = sphere(0.23, mat(0xf0c9a0, { roughness: 0.75 }), 14, 10);
  headG.add(head);
  // Sleek dark hair + ponytail
  const hair = sphere(0.245, mat(0x14151c, { roughness: 0.5 }), 14, 10);
  hair.position.set(0, 0.045, -0.045);
  hair.scale.set(1, 0.95, 0.95);
  headG.add(hair);
  const pony = cyl(0.05, 0.018, 0.5, mat(0x14151c, { roughness: 0.5 }), 6);
  pony.position.set(0, -0.1, -0.26);
  pony.rotation.x = 0.45;
  headG.add(pony);
  // Eyes
  for (const sx of [-1, 1]) {
    const eye = sphere(0.045, mat(0x191919, { roughness: 0.2 }), 6, 4);
    eye.position.set(sx * 0.09, 0.03, 0.2);
    headG.add(eye);
  }
  // Visor — mission controller vibes
  const visor = box(0.3, 0.05, 0.04, mat(0x2ee6ff, { emissive: 0x2ee6ff, emissiveIntensity: 1.5, transparent: true, opacity: 0.85 }));
  visor.position.set(0, 0.13, 0.2);
  headG.add(visor);
  g.add(headG);
  g.userData.head = headG;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ============================================================
// GABOR MIHALA — wiry, big forehead, orange beard, goofy villain
// ============================================================
export function buildGabor() {
  const g = new THREE.Group();
  // Wiry body — villain tracksuit
  const torso = cyl(0.16, 0.19, 0.66, mat(0x3d2a52, { roughness: 0.7 }), 10);
  torso.position.y = 1.02;
  g.add(torso);
  for (const sx of [-1, 1]) {
    const leg = cyl(0.06, 0.07, 0.6, mat(0x2a1d3a, { roughness: 0.8 }), 7);
    leg.position.set(sx * 0.09, 0.38, 0);
    g.add(leg);
    const arm = cyl(0.045, 0.055, 0.55, mat(0x3d2a52, { roughness: 0.7 }), 7);
    arm.position.set(sx * 0.24, 1.05, 0);
    arm.rotation.z = sx * 0.3;
    g.add(arm);
  }
  // Head — THE FOREHEAD
  const headG = new THREE.Group();
  headG.position.y = 1.66;
  const skull = sphere(0.24, mat(0xf0c9a0, { roughness: 0.75 }), 14, 10);
  skull.scale.set(0.9, 1.45, 0.9); // tall forehead dome
  skull.position.y = 0.1;
  headG.add(skull);
  // Forehead shine — "unlimited strategy"
  const shine = sphere(0.06, mat(0xfff2d9, { emissive: 0xffe9b0, emissiveIntensity: 0.6 }), 8, 6);
  shine.position.set(0.07, 0.32, 0.16);
  shine.scale.z = 0.4;
  headG.add(shine);
  // Small angry eyes (low on the face thanks to forehead)
  for (const sx of [-1, 1]) {
    const eye = sphere(0.035, mat(0x191919, { roughness: 0.2 }), 6, 4);
    eye.position.set(sx * 0.08, -0.06, 0.2);
    headG.add(eye);
    const brow = box(0.09, 0.025, 0.03, mat(0xb35a1f, { roughness: 1 }));
    brow.position.set(sx * 0.08, 0.0, 0.21);
    brow.rotation.z = sx * 0.4;
    headG.add(brow);
  }
  // Small orange beard
  const beard = cyl(0.02, 0.085, 0.18, mat(0xd97722, { roughness: 1 }), 6);
  beard.position.set(0, -0.27, 0.13);
  beard.rotation.x = 0.25;
  headG.add(beard);
  g.add(headG);
  g.userData.head = headG;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ============================================================
// THE GABOR SCOOTER — cursed kick scooter
// ============================================================
export function buildScooter() {
  const g = new THREE.Group();
  const deck = box(0.18, 0.05, 0.85, mat(0x6c1fb8, { metalness: 0.6, roughness: 0.4, emissive: 0x1d0833 }));
  deck.position.y = 0.18;
  g.add(deck);
  const stem = cyl(0.025, 0.025, 0.85, mat(0x9a9aa5, { metalness: 0.8, roughness: 0.3 }), 8);
  stem.position.set(0, 0.6, 0.38);
  stem.rotation.x = -0.15;
  g.add(stem);
  const bars = cyl(0.02, 0.02, 0.4, mat(0x9a9aa5, { metalness: 0.8, roughness: 0.3 }), 8);
  bars.position.set(0, 1.02, 0.32);
  bars.rotation.z = Math.PI / 2;
  g.add(bars);
  const wheels = [];
  for (const z of [-0.38, 0.42]) {
    // Same axle logic as the trolley: ring into the YZ plane (axle = local X)
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.045, 8, 14), mat(0x202024, { roughness: 0.9 }));
    w.rotation.y = Math.PI / 2;
    w.position.set(0, 0.1, z);
    g.add(w); wheels.push(w);
  }
  // Evil red headlight
  const light = sphere(0.04, mat(0xff2e5f, { emissive: 0xff2e5f, emissiveIntensity: 2 }), 6, 4);
  light.position.set(0, 0.95, 0.45);
  g.add(light);
  g.userData.wheels = wheels;
  return g;
}

// ============================================================
// GOLDEN JAMES REBAR TROLLEY — humanity's greatest invention
// ============================================================
export function buildTrolley() {
  const g = new THREE.Group();
  const gold = goldMat();

  // Basket — flared open box made of slats
  const basket = new THREE.Group();
  basket.position.y = 0.62;
  const bottom = box(0.78, 0.05, 1.15, gold);
  basket.add(bottom);
  // Slatted sides
  for (let i = 0; i < 3; i++) {
    const y = 0.12 + i * 0.16;
    const flare = 1 + i * 0.08;
    for (const sx of [-1, 1]) {
      const side = box(0.04, 0.05, 1.15 + i * 0.08, gold);
      side.position.set(sx * 0.39 * flare, y, 0);
      basket.add(side);
    }
    const front = box(0.78 * flare, 0.05, 0.04, gold);
    front.position.set(0, y, (1.15 + i * 0.08) / 2);
    basket.add(front);
    const back = box(0.78 * flare, 0.05, 0.04, gold);
    back.position.set(0, y, -(1.15 + i * 0.08) / 2);
    basket.add(back);
  }
  // Vertical slats
  for (let i = -2; i <= 2; i++) {
    for (const sx of [-1, 1]) {
      const slat = box(0.03, 0.46, 0.03, gold);
      slat.position.set(sx * 0.42, 0.26, i * 0.26);
      slat.rotation.z = sx * -0.12;
      basket.add(slat);
    }
  }
  g.add(basket);

  // Handle bar
  const handleStemL = cyl(0.025, 0.025, 0.5, gold, 8);
  handleStemL.position.set(-0.32, 1.2, -0.62);
  handleStemL.rotation.x = 0.3;
  g.add(handleStemL);
  const handleStemR = handleStemL.clone();
  handleStemR.position.x = 0.32;
  g.add(handleStemR);
  const handle = cyl(0.035, 0.035, 0.72, mat(0xc0392b, { roughness: 0.5 }), 8);
  handle.position.set(0, 1.42, -0.7);
  handle.rotation.z = Math.PI / 2;
  g.add(handle);

  // Frame legs
  for (const [x, z] of [[-0.3, 0.45], [0.3, 0.45], [-0.3, -0.45], [0.3, -0.45]]) {
    const leg = cyl(0.022, 0.022, 0.45, gold, 6);
    leg.position.set(x, 0.32, z);
    g.add(leg);
  }

  // ---- WHEELS ----
  // Axis verification: the trolley drives along its LOCAL +Z (Trolley.update
  // moves it along (sin(heading), 0, cos(heading)) and sets mesh.rotation.y
  // = heading, which is local +Z). A rolling wheel therefore needs its AXLE
  // on local X (lateral). THREE.TorusGeometry builds its ring in the XY
  // plane with the hole axis on local Z — so each tyre is rotated 90° about
  // Y to put the ring in the YZ plane, moving the hole axis (the axle) onto
  // local X. Rolling spin is then applied on the spin group's local X:
  // +rotation.x moves the top of the wheel toward +Z = rolling forward.
  //
  // Hierarchy per wheel (per the recommended structure):
  //   steer (WheelSteerPivot)  — yaw for front-wheel steering only
  //     └─ spin (WheelMesh)    — rolling rotation on WHEEL_SPIN_AXIS only
  //          ├─ tyre, hub, 3 spokes (spokes make the spin visible)
  const WHEEL_SPIN_AXIS = 'x';  // exposed: change if mesh orientation changes
  const WHEEL_RADIUS = 0.14;    // torus radius + tube ≈ visual contact radius
  const wheels = [];
  for (const [x, z, front] of [[-0.32, 0.48, true], [0.32, 0.48, true], [-0.32, -0.48, false], [0.32, -0.48, false]]) {
    const steer = new THREE.Group();      // WheelSteerPivot
    steer.position.set(x, 0.12, z);
    const spin = new THREE.Group();       // WheelMesh (rolling spin only)
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.04, 8, 16), mat(0x26262c, { roughness: 0.85 }));
    tyre.rotation.y = Math.PI / 2;        // ring into YZ plane → axle = local X
    spin.add(tyre);
    const hub = cyl(0.035, 0.035, 0.1, gold, 8);
    hub.rotation.z = Math.PI / 2;         // cylinder axis (Y) onto X = axle
    spin.add(hub);
    for (let s = 0; s < 3; s++) {         // spokes so rotation reads visually
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.17), gold);
      spoke.rotation.x = (s / 3) * Math.PI; // spokes fan out in the YZ wheel plane
      spin.add(spoke);
    }
    steer.add(spin);
    g.add(steer);
    wheels.push({ steer, spin, front });
  }
  g.userData.wheelSpinAxis = WHEEL_SPIN_AXIS;
  g.userData.wheelRadius = WHEEL_RADIUS;

  // ENGINE — ridiculous strapped-on motor with exhaust
  const engine = box(0.4, 0.28, 0.3, mat(0x2e2e35, { metalness: 0.7, roughness: 0.35 }));
  engine.position.set(0, 0.42, -0.68);
  g.add(engine);
  const exhaust = cyl(0.05, 0.07, 0.3, mat(0x8b8b95, { metalness: 0.9, roughness: 0.3 }), 8);
  exhaust.position.set(0.18, 0.5, -0.85);
  exhaust.rotation.x = 1.2;
  g.add(exhaust);
  // Headlight
  const lamp = sphere(0.07, mat(0xfff6c9, { emissive: 0xffeaa0, emissiveIntensity: 1.6 }), 8, 6);
  lamp.position.set(0, 0.75, 0.66);
  g.add(lamp);
  // Little flag: "JAMES REBAR"
  const flagPole = cyl(0.012, 0.012, 0.7, mat(0x9a9aa5, { metalness: 0.8 }), 5);
  flagPole.position.set(0.36, 1.3, -0.5);
  g.add(flagPole);
  const flag = box(0.32, 0.18, 0.01, mat(0xff2e5f, { emissive: 0x661226, roughness: 0.6 }));
  flag.position.set(0.52, 1.55, -0.5);
  g.add(flag);

  g.userData.wheels = wheels;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ============================================================
// Small props
// ============================================================
export function buildRebar() {
  // Ribbed steel bar, assembled upright then tilted for that "just dropped
  // off the truck" look.
  const inner = new THREE.Group();
  const bar = cyl(0.045, 0.045, 1.3, rebarMat(), 8);
  inner.add(bar);
  for (let i = -2; i <= 2; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.013, 5, 10), rebarMat());
    rib.position.y = i * 0.24;
    rib.rotation.x = Math.PI / 2;
    inner.add(rib);
  }
  inner.rotation.z = 0.5;
  const g = new THREE.Group();
  g.add(inner);
  return g;
}

export function buildCoin() {
  const c = cyl(0.28, 0.28, 0.07, goldMat(), 16);
  c.rotation.x = Math.PI / 2;
  const g = new THREE.Group();
  g.add(c);
  return g;
}

export function buildShard(red = false) {
  const color = red ? 0xff2e5f : 0x2ee6ff;
  const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), mat(color, { emissive: color, emissiveIntensity: 1.2, metalness: 0.6, roughness: 0.2 }));
  s.scale.y = 1.6;
  const g = new THREE.Group();
  g.add(s);
  return g;
}

export function buildBurger() {
  const g = new THREE.Group();
  const bunBottom = cyl(0.26, 0.3, 0.1, mat(0xe8a755, { roughness: 0.85 }), 12);
  g.add(bunBottom);
  const patty = cyl(0.29, 0.29, 0.08, mat(0x6b3a1f, { roughness: 1 }), 12);
  patty.position.y = 0.09; g.add(patty);
  const cheese = box(0.52, 0.03, 0.52, mat(0xffc23d, { roughness: 0.7 }));
  cheese.position.y = 0.145; cheese.rotation.y = 0.4; g.add(cheese);
  const lettuce = cyl(0.31, 0.29, 0.04, mat(0x6fcf4f, { roughness: 1 }), 12);
  lettuce.position.y = 0.18; g.add(lettuce);
  const bunTop = sphere(0.3, mat(0xe8a755, { roughness: 0.85 }), 12, 8);
  bunTop.scale.y = 0.6; bunTop.position.y = 0.28; g.add(bunTop);
  // Tiny rebar skewer through the top — it's a Rebar Deluxe
  const skewer = cyl(0.015, 0.015, 0.4, rebarMat(), 5);
  skewer.position.y = 0.42; g.add(skewer);
  return g;
}

export function buildFuelCan() {
  const g = new THREE.Group();
  const can = box(0.32, 0.42, 0.2, mat(0xd93a2b, { metalness: 0.4, roughness: 0.5 }));
  can.position.y = 0.21; g.add(can);
  const spout = cyl(0.04, 0.05, 0.16, mat(0x8b8b95, { metalness: 0.8 }), 6);
  spout.position.set(0.1, 0.48, 0); spout.rotation.z = -0.5; g.add(spout);
  return g;
}

export function buildPhone() {
  const g = new THREE.Group();
  const body = box(0.26, 0.5, 0.05, mat(0x9aa3ad, { metalness: 0.95, roughness: 0.2 }));
  body.position.y = 0.3; g.add(body);
  const screen = box(0.22, 0.42, 0.01, mat(0x2ee6ff, { emissive: 0x2ee6ff, emissiveIntensity: 1.3 }));
  screen.position.set(0, 0.3, 0.03); g.add(screen);
  return g;
}
