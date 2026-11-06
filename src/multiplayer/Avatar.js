// Isolated cosmetic models. Never recolour cached story materials or replace
// the player controller's physics rig: the selected visual rides on that rig.
import * as THREE from 'three';
import {
  buildBung,
  buildChung,
  buildGabor,
  buildTrolley,
} from '../entities/models.js';
import { makePerson, makeGirder } from '../entities/castModels.js';
import { buildEnemyMesh, ENEMY_DEFS } from '../entities/Enemies.js';
import { characterDefinition, normalizeAppearance } from './catalog.js';

const piece = (g, geometry, color, channel, x, y, z) => {
  const m = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, roughness: 0.65 }),
  );
  m.position.set(x, y, z);
  m.userData.clothing = channel;
  m.castShadow = true;
  g.add(m);
  return m;
};
function pivot(root, objects, x, y, z) {
  const p = new THREE.Group();
  p.position.set(x, y, z);
  root.add(p);
  root.updateMatrixWorld(true);
  for (const o of objects) p.attach(o);
  return p;
}
export function buildAvatar(value) {
  const appearance = normalizeAppearance(value),
    def = characterDefinition(appearance.character);
  const visual =
    def.model === 'bung'
      ? buildBung()
      : def.model === 'chung'
        ? buildChung()
        : def.model === 'gabor'
          ? buildGabor()
          : def.model === 'girder'
            ? makeGirder()
            : def.model === 'person'
              ? makePerson(parseInt(def.colors[0].slice(1), 16))
              : def.model === 'trolley'
                ? buildTrolley()
                : buildEnemyMesh(def.id);
  const palette =
    def.model === 'bung'
      ? ['f4f1ea', '7a5230', '2266cc', 'd9d4c4']
      : def.model === 'chung'
        ? ['1fb8c9', '23262e', 'eeeeee', '2ee6ff']
        : def.model === 'gabor'
          ? ['3d2a52', '2a1d3a', '242834', '8f1fff']
          : def.model === 'girder'
            ? ['3a404c', '2a3038', '242834', 'ff8936']
            : def.model === 'enemy'
              ? [
                  new THREE.Color(ENEMY_DEFS[def.id].color).getHexString(),
                  '343b49',
                  '242834',
                  def.id === 'gremlin'
                    ? '6c1fb8'
                    : def.id === 'bandit'
                      ? 'e8a755'
                      : '8f1fff',
                ]
              : def.model === 'trolley'
                ? ['ffc94d', 'c0392b', '242834', 'ff2e5f']
                : def.colors.map((c) => c.slice(1));
  // Tag only clothes / shell panels. Skin, eyes and hair remain canonical.
  visual.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline) return;
    const i = palette.indexOf(o.material?.color?.getHexString());
    if (i >= 0) o.userData.clothing = i;
  });
  const legs = visual.userData.parts
    ? [visual.userData.parts.legL, visual.userData.parts.legR]
    : [...(visual.userData.walkLegs || [])];
  const arms = visual.userData.parts
    ? [visual.userData.parts.armL, visual.userData.parts.armR]
    : [...(visual.userData.walkArms || [])];
  if (def.model === 'person' || def.model === 'girder') {
    for (const side of [-1, 1]) {
      const x = side * (def.model === 'girder' ? 0.43 : 0.14),
        height = def.model === 'girder' ? 0.55 : 0.6;
      const leg = piece(
        visual,
        new THREE.CylinderGeometry(0.09, 0.11, height, 8),
        def.colors[1],
        1,
        x,
        0.32,
        0,
      );
      const shoe = piece(
        visual,
        new THREE.BoxGeometry(0.22, 0.12, 0.32),
        def.colors[2],
        2,
        x,
        0.06,
        0.06,
      );
      legs.push(pivot(visual, [leg, shoe], x, height, 0));
      const ax = side * (def.model === 'girder' ? 0.85 : 0.39);
      const arm = piece(
        visual,
        new THREE.CylinderGeometry(0.075, 0.085, 0.6, 8),
        def.colors[0],
        0,
        ax,
        1,
        0,
      );
      arms.push(pivot(visual, [arm], ax, 1.3, 0));
    }
    piece(
      visual,
      new THREE.BoxGeometry(0.12, 0.24, 0.035),
      def.colors[3],
      3,
      0,
      1.16,
      def.model === 'girder' ? 0.42 : 0.3,
    );
  } else if (def.model === 'gabor') {
    // Existing Gabor's limbs gain shoulder / hip pivots for player locomotion.
    const raw = visual.children.filter(
      (o) => o.isMesh && o.geometry.type === 'CylinderGeometry',
    );
    for (const side of [-1, 1]) {
      const leg = raw.find(
        (o) =>
          Math.abs(o.position.x - side * 0.09) < 0.01 && o.position.y < 0.5,
      );
      const arm = raw.find((o) => Math.abs(o.position.x - side * 0.24) < 0.01);
      const shoe = piece(
        visual,
        new THREE.BoxGeometry(0.15, 0.09, 0.25),
        def.colors[2],
        2,
        side * 0.09,
        0.06,
        0.03,
      );
      if (leg) legs.push(pivot(visual, [leg, shoe], side * 0.09, 0.66, 0));
      if (arm) arms.push(pivot(visual, [arm], side * 0.24, 1.3, 0));
    }
  } else if (def.model === 'enemy') {
    // Shell palettes substitute for clothes on creatures. Add readable accent
    // and foot bands so all four colour controls have a visible effect.
    piece(
      visual,
      new THREE.BoxGeometry(0.24, 0.045, 0.08),
      def.colors[3],
      3,
      0,
      0.52,
      0.36,
    );
    for (const side of [-1, 1]) {
      piece(
        visual,
        new THREE.BoxGeometry(0.15, 0.08, 0.2),
        def.colors[2],
        2,
        side * 0.13,
        -0.03,
        0.02,
      );
      piece(
        visual,
        new THREE.BoxGeometry(0.13, 0.1, 0.15),
        def.colors[1],
        1,
        side * 0.13,
        0.08,
        0,
      );
    }
  } else if (def.model === 'trolley') {
    piece(
      visual,
      new THREE.BoxGeometry(0.5, 0.06, 0.1),
      def.colors[2],
      2,
      0,
      0.4,
      0.4,
    );
  }
  if (def.model === 'person') {
    const hairColor =
      def.id === 'judge'
        ? '#d6d5d0'
        : def.id.startsWith('chung-')
          ? '#252630'
          : '#685044';
    for (const side of [-1, 1]) {
      piece(
        visual,
        new THREE.SphereGeometry(0.043, 8, 6),
        '#ffffff',
        undefined,
        side * 0.073,
        1.61,
        0.174,
      );
      piece(
        visual,
        new THREE.SphereGeometry(0.022, 8, 6),
        '#20232a',
        undefined,
        side * 0.073,
        1.61,
        0.213,
      );
      const brow = piece(
        visual,
        new THREE.BoxGeometry(0.075, 0.018, 0.025),
        hairColor,
        undefined,
        side * 0.073,
        1.673,
        0.178,
      );
      brow.rotation.z = side * -0.1;
    }
    piece(
      visual,
      new THREE.SphereGeometry(0.035, 8, 6),
      '#dfae83',
      undefined,
      0,
      1.55,
      0.205,
    );
    const smile = piece(
      visual,
      new THREE.TorusGeometry(0.055, 0.009, 5, 12, Math.PI),
      '#88483f',
      undefined,
      0,
      1.51,
      0.185,
    );
    smile.rotation.z = Math.PI;
    const hair = piece(
      visual,
      new THREE.SphereGeometry(0.21, 12, 8),
      hairColor,
      undefined,
      0,
      1.73,
      -0.025,
    );
    hair.scale.y = 0.43;
    if (def.id.endsWith('-mum'))
      piece(
        visual,
        new THREE.SphereGeometry(0.1, 10, 8),
        hairColor,
        undefined,
        0,
        1.79,
        -0.15,
      );
  }
  if (def.model === 'girder') {
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 5; col++) {
        const eye = piece(
          visual,
          new THREE.SphereGeometry(0.055, 8, 6),
          def.colors[3],
          3,
          (col - 2) * 0.15,
          2.15 + row * 0.2,
          0.37,
        );
        eye.material.emissive.set(def.colors[3]);
        eye.material.emissiveIntensity = 0.5;
      }
  }
  if (visual.userData.luggage) visual.userData.luggage.visible = false;
  if (def.id === 'rebar-man') {
    piece(
      visual,
      new THREE.BoxGeometry(0.9, 0.5, 0.12),
      def.colors[0],
      0,
      0,
      1.05,
      0.58,
    );
    piece(
      visual,
      new THREE.BoxGeometry(0.07, 0.45, 0.14),
      def.colors[3],
      3,
      0,
      1.05,
      0.66,
    );
  }
  // Builders share materials with the campaign. Clone once per unique material
  // before recolouring; no per-frame allocation and no cross-player mutation.
  const materials = new Map();
  visual.traverse((o) => {
    if (!o.isMesh) return;
    const channel = o.userData.clothing;
    const copy = (m) => {
      const key = m.uuid + ':' + channel;
      if (!materials.has(key)) materials.set(key, m.clone());
      const result = materials.get(key);
      if (channel !== undefined) result.color.set(appearance.colors[channel]);
      return result;
    };
    o.material = Array.isArray(o.material)
      ? o.material.map(copy)
      : copy(o.material);
  });
  visual.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(visual),
    height = bounds.max.y - bounds.min.y;
  const scale = 2.15 / height;
  visual.scale.multiplyScalar(scale);
  visual.position.y = -bounds.min.y * scale;
  const root = new THREE.Group();
  root.add(visual);
  root.userData.appearance = appearance;
  root.userData.visual = visual;
  root.userData.walkLegs = legs;
  root.userData.walkArms = arms;
  root.userData.head = visual.userData.parts?.head || visual.userData.head;
  root.userData.parts = {
    legL: legs[0] || new THREE.Group(),
    legR: legs[1] || new THREE.Group(),
  };
  root.name = def.name;
  return root;
}
export function animateAvatar(root, speed, time, riding = false) {
  const stride = riding ? 0 : Math.min(0.6, speed * 0.1);
  for (const [i, p] of root.userData.walkLegs.entries())
    p.rotation.x = riding ? -1.1 : Math.sin(time * 9 + i * Math.PI) * stride;
  for (const [i, p] of root.userData.walkArms.entries())
    p.rotation.x = riding
      ? -0.7
      : -Math.sin(time * 9 + i * Math.PI) * stride * 0.8;
  if (root.userData.head)
    root.userData.head.rotation.z = Math.sin(time * 2) * 0.025;
}
export function disposeAvatar(root) {
  const geometry = new Set(),
    materials = new Set();
  root.traverse((o) => {
    if (!o.isMesh) return;
    geometry.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material])
      materials.add(m);
  });
  geometry.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  root.removeFromParent();
}
