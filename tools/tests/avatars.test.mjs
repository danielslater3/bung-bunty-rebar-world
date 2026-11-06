import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  CHARACTERS,
  normalizeAppearance,
} from '../../src/multiplayer/catalog.js';
import {
  buildAvatar,
  animateAvatar,
  disposeAvatar,
} from '../../src/multiplayer/Avatar.js';
import { buildBung } from '../../src/entities/models.js';

test('every multiplayer character builds finite geometry, animates and exposes four colour channels', () => {
  for (const c of CHARACTERS) {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ff00ff'];
    const a = buildAvatar({ character: c.id, colors });
    const channels = new Set();
    a.traverse((o) => {
      if (!o.isMesh) return;
      const positions = o.geometry.getAttribute('position');
      for (const v of positions.array) assert.ok(Number.isFinite(v), c.id);
      if (o.userData.clothing !== undefined) {
        channels.add(o.userData.clothing);
        assert.equal(
          '#' + o.material.color.getHexString(),
          colors[o.userData.clothing],
          c.id,
        );
      }
    });
    assert.deepEqual(
      [...channels].sort(),
      [0, 1, 2, 3],
      c.id + ' colour slots',
    );
    animateAvatar(a, 6, 1.2);
    animateAvatar(a, 0, 1.3, true);
    a.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(a);
    assert.ok(Number.isFinite(bounds.max.y), c.id);
    assert.ok(a.userData.parts.legL.isObject3D, c.id);
    disposeAvatar(a);
  }
});
test('per-player clothes never mutate canonical or other-player materials', () => {
  const story = buildBung(),
    before = [];
  story.traverse((o) => {
    if (o.isMesh) before.push([o.material, o.material.color.getHex()]);
  });
  const red = buildAvatar({
    character: 'bung',
    colors: ['#ff0000', '#ff0000', '#ff0000', '#ff0000'],
  });
  const blue = buildAvatar({
    character: 'bung',
    colors: ['#0000ff', '#0000ff', '#0000ff', '#0000ff'],
  });
  for (const [m, hex] of before) assert.equal(m.color.getHex(), hex);
  red.traverse((o) => {
    if (o.userData.clothing !== undefined)
      assert.equal(o.material.color.getHex(), 0xff0000);
  });
  blue.traverse((o) => {
    if (o.userData.clothing !== undefined)
      assert.equal(o.material.color.getHex(), 0x0000ff);
  });
  disposeAvatar(red);
  disposeAvatar(blue);
});
test('appearance input rejects unknown identities and malformed colour values', () => {
  assert.equal(
    normalizeAppearance({ character: 'not-a-character' }).character,
    'bung',
  );
  assert.deepEqual(
    normalizeAppearance({
      character: 'gabor',
      colors: ['url(evil)', null, {}, '#AbCdEf'],
    }).colors,
    ['#3d2a52', '#2a1d3a', '#242834', '#abcdef'],
  );
});
