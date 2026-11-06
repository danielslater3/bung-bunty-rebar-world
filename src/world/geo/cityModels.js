// Bounded, procedural city models. Static pieces merge by material; animation
// pivots remain separate. Feet / tyre contact are always model-local y=0.
import * as THREE from 'three';
const material = (color, options = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.65, ...options });
function part(g, geometry, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geometry, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  g.add(o);
  return o;
}
const cube = (g, w, h, d, m, x, y, z) =>
  part(g, new THREE.BoxGeometry(w, h, d), m, x, y, z);
function rounded(w, h, d, r = 0.07) {
  const s = new THREE.Shape(),
    x = -w / 2,
    y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: d - 2 * r,
    bevelEnabled: true,
    bevelThickness: r,
    bevelSize: r / 2,
    bevelSegments: 2,
    steps: 1,
    curveSegments: 3,
  });
  g.translate(0, 0, -d / 2 + r);
  return g;
}
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const groups = new Map(),
    remove = [];
  root.traverse((o) => {
    if (!o.isMesh || o.userData.dynamic) return;
    const m = o.material;
    if (Array.isArray(m)) return;
    const geo = o.geometry.index
      ? o.geometry.toNonIndexed()
      : o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld);
    if (!groups.has(m)) groups.set(m, { p: [], n: [] });
    const b = groups.get(m);
    b.p.push(...geo.attributes.position.array);
    b.n.push(...geo.attributes.normal.array);
    geo.dispose();
    remove.push(o);
  });
  for (const o of remove) {
    o.removeFromParent();
    o.geometry.dispose();
  }
  for (const [m, b] of groups) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
    part(root, geo, m);
  }
  return root;
}
function wheels(g, width, axles, radius, materials) {
  const result = [];
  for (const z of axles)
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * width, radius, z);
      g.add(pivot);
      const tyre = part(
        pivot,
        new THREE.CylinderGeometry(radius, radius, 0.22, 14),
        materials.tyre,
      );
      tyre.rotation.z = Math.PI / 2;
      const rim = part(
        pivot,
        new THREE.CylinderGeometry(radius * 0.57, radius * 0.57, 0.235, 10),
        materials.rim,
      );
      rim.rotation.z = Math.PI / 2;
      const hub = part(
        pivot,
        new THREE.BoxGeometry(0.25, radius * 0.65, 0.055),
        materials.dark,
      );
      hub.position.x = side * 0.02;
      result.push(pivot);
    }
  g.userData.wheels = result;
  g.userData.wheelRadius = radius;
}
export function buildCityVehicle({
  bus = false,
  color = 0x258e9d,
  variant = 0,
  label = 'REBAR CITY LOOP',
} = {}) {
  const g = new THREE.Group();
  g.name = bus ? 'Rebar city shuttle' : 'Brisbane street car';
  const m = {
    paint: material(color, { roughness: 0.34, metalness: 0.25 }),
    glass: material(0x264652, { roughness: 0.22, metalness: 0.25 }),
    dark: material(0x253039),
    tyre: material(0x242628, { roughness: 0.95 }),
    rim: material(0xc7d1d4, { metalness: 0.65, roughness: 0.35 }),
    light: material(0xfff1b8, { emissive: 0xffdf91, emissiveIntensity: 0.55 }),
    red: material(0xe75b4a, { emissive: 0xaa2111, emissiveIntensity: 0.25 }),
    trim: material(0xffd366),
  };
  const length = bus ? 9.6 : variant === 1 ? 4.7 : 4.15,
    width = bus ? 2.4 : 1.78;
  part(
    g,
    rounded(width, bus ? 2.55 : 0.56, length, bus ? 0.1 : 0.07),
    m.paint,
    0,
    bus ? 1.77 : 0.73,
    0,
  );
  cube(g, width + 0.04, 0.15, length * 0.91, m.dark, 0, bus ? 0.62 : 0.46, 0);
  if (bus) {
    // Continuous glazing, separated window posts, roof equipment and driver cab.
    for (const side of [-1, 1]) {
      cube(g, 0.035, 0.94, 7.5, m.glass, side * 1.28, 2.2, -0.3);
      for (let i = 0; i < 8; i++)
        cube(g, 0.06, 1.04, 0.06, m.paint, side * 1.31, 2.18, -3.55 + i * 0.95);
      cube(g, 0.06, 0.16, 8.7, m.trim, side * 1.25, 1.45, 0);
      for (const z of [-3.4, 1.2])
        cube(g, 0.06, 0.27, 0.72, m.dark, side * 1.25, 0.95, z);
    }
    cube(g, 2.08, 1.03, 0.035, m.glass, 0, 2.2, 4.82);
    cube(g, 2.12, 0.45, 0.035, m.dark, 0, 2.92, 4.83);
    cube(g, 1.75, 0.24, 3, m.paint, 0, 3.15, -0.8);
    for (const side of [-1, 1]) {
      cube(g, 0.2, 0.32, 0.3, m.dark, side * 1.4, 2.35, 4.1);
      cube(g, 0.35, 0.15, 0.035, m.light, side * 0.85, 0.92, 4.84);
      cube(g, 0.22, 0.44, 0.035, m.red, side * 0.93, 1.12, -4.84);
    }
    for (let i = 0; i < 10; i++)
      cube(g, 0.8, 0.05, 0.025, m.dark, 0, 0.95 + i * 0.09, -4.85);
    mergeStatic(g);
    const doors = new THREE.Group();
    doors.position.set(-1.32, 1.5, 2.9);
    g.add(doors);
    for (const z of [-0.39, 0.39]) {
      cube(doors, 0.045, 1.85, 0.73, m.dark, 0, 0, z);
      cube(doors, 0.05, 1.3, 0.6, m.glass, -0.025, 0.18, z);
      cube(doors, 0.06, 0.08, 0.6, m.trim, -0.03, -0.5, z);
    }
    g.userData.doors = doors;
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 96;
      const c = canvas.getContext('2d');
      c.fillStyle = '#142d32';
      c.fillRect(0, 0, 512, 96);
      c.fillStyle = '#ffe681';
      c.font = 'bold 34px Arial';
      c.textAlign = 'center';
      c.fillText(label, 256, 58, 490);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const screen = part(
        g,
        new THREE.PlaneGeometry(1.95, 0.36),
        new THREE.MeshBasicMaterial({ map: texture }),
        0,
        2.93,
        4.86,
      );
      screen.userData.dynamic = true;
      g.userData.dispose = () => {
        texture.dispose();
        screen.material.dispose();
      };
    }
    wheels(g, 1.18, [-2.8, 2.8], 0.43, m);
  } else {
    part(
      g,
      rounded(1.48, 0.66, variant === 1 ? 2.7 : 2.25, 0.06),
      m.paint,
      0,
      1.24,
      -0.14,
    );
    cube(g, 1.34, 0.49, 0.035, m.glass, 0, 1.26, variant === 1 ? 1.23 : 1.02);
    cube(g, 1.35, 0.46, 0.035, m.glass, 0, 1.26, variant === 1 ? -1.5 : -1.3);
    for (const side of [-1, 1]) {
      cube(
        g,
        0.035,
        0.46,
        variant === 1 ? 2.44 : 1.96,
        m.glass,
        side * 0.8,
        1.27,
        -0.14,
      );
      cube(g, 0.045, 0.55, 0.075, m.paint, side * 0.83, 1.27, -0.12);
      cube(g, 0.2, 0.1, 0.15, m.glass, side * 0.97, 1.14, 0.75);
      for (const z of [-0.65, 0.35])
        cube(g, 0.04, 0.035, 0.17, m.rim, side * 0.91, 0.91, z);
      cube(g, 0.45, 0.17, 0.055, m.light, side * 0.58, 0.81, length / 2 + 0.03);
      cube(g, 0.35, 0.18, 0.055, m.red, side * 0.62, 0.8, -length / 2 - 0.03);
    }
    cube(g, 0.66, 0.14, 0.055, m.dark, 0, 0.65, length / 2 + 0.05);
    cube(g, 0.36, 0.12, 0.06, m.trim, 0, 0.61, -length / 2 - 0.05);
    mergeStatic(g);
    wheels(g, 0.87, [-1.25, 1.25], 0.31, m);
  }
  g.userData.length = length;
  g.userData.width = width;
  return g;
}
export function buildStreetTree(seed = 0, palm = false) {
  const g = new THREE.Group();
  g.name = palm ? 'Brisbane palm' : 'Layered street tree';
  const bark = material(palm ? 0x8b7352 : 0x70543e, { roughness: 0.95 }),
    leaves = [0x367b49, 0x438956, 0x559968].map((c) =>
      material(c, { roughness: 0.9 }),
    );
  const height = palm ? 5.4 : 2.7,
    radius = palm ? 0.17 : 0.19;
  part(
    g,
    new THREE.CylinderGeometry(radius * 0.66, radius, height, 9),
    bark,
    0,
    height / 2,
    0,
  );
  if (palm) {
    for (let i = 0; i < 7; i++) {
      const ring = part(
        g,
        new THREE.TorusGeometry(0.17 - i * 0.004, 0.025, 4, 10),
        bark,
        0,
        0.5 + i * 0.65,
        0,
      );
      ring.rotation.x = Math.PI / 2;
    }
    for (let i = 0; i < 9; i++) {
      const a = (i * Math.PI * 2) / 9 + seed,
        leaf = part(
          g,
          new THREE.SphereGeometry(1, 8, 6),
          leaves[i % 3],
          Math.sin(a) * 1.1,
          5.4,
          Math.cos(a) * 1.1,
        );
      leaf.scale.set(0.32, 0.18, 1.6);
      leaf.rotation.set(0.35, a, 0);
    }
  } else {
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + seed;
      const branch = part(
        g,
        new THREE.CylinderGeometry(0.04, 0.085, 1.25, 6),
        bark,
        Math.sin(a) * 0.34,
        2.15,
        Math.cos(a) * 0.34,
      );
      branch.rotation.set(Math.cos(a) * 0.65, 0, -Math.sin(a) * 0.65);
    }
    for (let i = 0; i < 7; i++) {
      const a = i * 2.399 + seed,
        r = i ? 1.05 : 0;
      const crown = part(
        g,
        new THREE.IcosahedronGeometry(1, 1),
        leaves[i % 3],
        Math.sin(a) * r,
        3.1 + (i % 3) * 0.33,
        Math.cos(a) * r,
      );
      crown.scale.set(1.16, 1.1, 1.05);
    }
  }
  mergeStatic(g);
  const materials = new Set(
    g.children.filter((o) => o.isMesh).map((o) => o.material),
  );
  g.userData.dispose = () => materials.forEach((m) => m.dispose());
  return g;
}
export function buildCityPedestrian(seed = 0) {
  const g = new THREE.Group();
  g.name = 'Brisbane pedestrian';
  const shirts = [0xb55c51, 0x418b9c, 0xe6c466, 0x647d59, 0x7f72a3, 0xe8e0cd];
  const skin = material([0xe8b88a, 0xc3916b, 0x936344][seed % 3]),
    shirt = material(shirts[seed % shirts.length]),
    pants = material(seed % 2 ? 0x334353 : 0x5b5551),
    dark = material(0x292b31),
    white = material(0xf2eee3),
    hair = material(seed % 4 ? 0x3e332e : 0xa4a29a);
  part(g, rounded(0.45, 0.66, 0.29, 0.055), shirt, 0, 1.02, 0);
  part(g, new THREE.SphereGeometry(0.2, 12, 10), skin, 0, 1.58, 0);
  const cap = part(
    g,
    new THREE.SphereGeometry(0.208, 10, 8),
    hair,
    0,
    1.66,
    -0.025,
  );
  cap.scale.y = 0.55;
  for (const side of [-1, 1]) {
    part(
      g,
      new THREE.SphereGeometry(0.04, 8, 6),
      white,
      side * 0.075,
      1.61,
      0.172,
    );
    part(
      g,
      new THREE.SphereGeometry(0.021, 8, 6),
      dark,
      side * 0.075,
      1.61,
      0.21,
    );
  }
  part(g, new THREE.SphereGeometry(0.032, 8, 6), skin, 0, 1.55, 0.21);
  const smile = part(
    g,
    new THREE.TorusGeometry(0.05, 0.009, 4, 10, Math.PI),
    dark,
    0,
    1.51,
    0.185,
  );
  smile.rotation.z = Math.PI;
  if (seed % 3 === 0) {
    part(
      g,
      new THREE.CylinderGeometry(0.23, 0.23, 0.08, 10),
      shirt,
      0,
      1.78,
      0,
    );
    cube(g, 0.23, 0.03, 0.18, shirt, 0, 1.75, 0.14);
  }
  if (seed % 4 === 0) {
    cube(g, 0.36, 0.47, 0.15, pants, 0, 1.03, -0.23);
    cube(g, 0.035, 0.5, 0.035, dark, -0.16, 1.1, 0.16);
  }
  mergeStatic(g);
  const legs = [],
    arms = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.12, 0.67, 0);
    g.add(leg);
    part(
      leg,
      new THREE.CylinderGeometry(0.075, 0.085, 0.54, 7),
      pants,
      0,
      -0.26,
      0,
    );
    cube(leg, 0.17, 0.12, 0.29, dark, 0, -0.61, 0.045);
    legs.push(leg);
    const arm = new THREE.Group();
    arm.position.set(side * 0.29, 1.3, 0);
    g.add(arm);
    part(
      arm,
      new THREE.CylinderGeometry(0.06, 0.07, 0.38, 7),
      shirt,
      0,
      -0.18,
      0,
    );
    part(arm, new THREE.SphereGeometry(0.075, 8, 6), skin, 0, -0.44, 0);
    arms.push(arm);
  }
  g.userData.pantsMaterial = pants;
  g.userData.skinMaterial = skin;
  g.userData.shirtMaterial = shirt;
  g.userData.legs = legs;
  g.userData.arms = arms;
  return g;
}
