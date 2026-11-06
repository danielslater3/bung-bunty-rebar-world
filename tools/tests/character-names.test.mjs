import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  canonicalCharacterId,
  migrateCharacterState,
} from '../../src/core/characterNames.js';
import { SaveSystem, state, DEFAULT_STATE } from '../../src/core/state.js';
import { normalizeAppearance } from '../../src/multiplayer/catalog.js';
const retired = 'ch\u0069ng';

test('retired partner identifiers migrate without modifying ordinary words or the input', () => {
  const source = {
    archive: [retired, retired + '-arrives'],
    flags: { [retired + 'WithYou']: true },
    saga: { stepState: { cast: { [retired]: { x: 2, y: 3, z: 4 } } } },
    sentence: 'Keep touching and catching the matching rebars.',
  };
  const result = migrateCharacterState(source);
  assert.deepEqual(result.archive, ['chung', 'chung-arrives']);
  assert.equal(result.flags.chungWithYou, true);
  assert.equal(result.saga.stepState.cast.chung.x, 2);
  assert.equal(result.sentence, source.sentence);
  assert.equal(source.archive[0], retired);
  assert.deepEqual(migrateCharacterState(result), result);
  assert.deepEqual(migrateCharacterState({ [retired]: 1, chung: 2 }), {
    chung: 2,
  });
});
test('campaign and replay retain chapter, progress and rewards when the character name migrates', () => {
  const memory = new Map(),
    key = 'bung-bunty-rebar-world-save-v1';
  globalThis.localStorage = {
    getItem: (k) => memory.get(k) || null,
    setItem: (k, v) => memory.set(k, v),
    removeItem: (k) => memory.delete(k),
  };
  const legacy = {
    ...DEFAULT_STATE(),
    coins: 12345,
    archive: [retired, retired + '-arrives'],
    flags: { [retired + 'WithYou']: true },
    saga: { active: true, chapter: 8, step: 3, done: ['ch1', 'ch2'] },
  };
  memory.set(key, JSON.stringify(legacy));
  memory.set(
    key + '-replay',
    JSON.stringify({ ...legacy, _replay: { chapter: 4 } }),
  );
  assert.deepEqual(SaveSystem.peek().archive, ['chung', 'chung-arrives']);
  assert.equal(SaveSystem.peekReplay().flags.chungWithYou, true);
  assert.equal(SaveSystem.load(), true);
  assert.equal(state.coins, 12345);
  assert.equal(state.saga.chapter, 8);
  assert.equal(state.saga.step, 3);
  assert.equal(state.flags.chungWithYou, true);
  assert.equal(SaveSystem.load(true), true);
  assert.equal(state._replay.chapter, 4);
  assert.equal(SaveSystem.save(), true);
  assert.ok(!memory.get(key + '-replay').includes(retired));
});
test('existing multiplayer outfits, including parents, keep their selected colours', () => {
  for (const suffix of ['', '-mum', '-dad']) {
    const colors = ['#123456', '#abcdef', '#445566', '#112233'];
    assert.equal(canonicalCharacterId(retired + suffix), 'chung' + suffix);
    assert.deepEqual(
      normalizeAppearance({ character: retired + suffix, colors }),
      { character: 'chung' + suffix, colors },
    );
  }
});
test('the retired character name cannot return in source, dialogue, lore, docs or tools', () => {
  const root = new URL('../../', import.meta.url);
  const pattern = new RegExp(
    '(?<![a-z])' +
      retired +
      '(?![a-z])|Ch' +
      'ing|(?<![A-Z])' +
      retired.toUpperCase() +
      '(?![A-Z])',
  );
  for (const dir of ['src', 'docs', 'tools']) {
    for (const f of readdirSync(new URL(dir + '/', root), {
      recursive: true,
    }).filter((f) => /\.(js|mjs|cjs|md|py)$/.test(f))) {
      assert.doesNotMatch(
        readFileSync(new URL(dir + '/' + f, root), 'utf8'),
        pattern,
        dir + '/' + f,
      );
    }
  }
});
