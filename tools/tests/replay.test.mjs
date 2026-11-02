import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chapterFrontier, chapterReplay } from '../../src/story/progression.js';
import { CHAPTERS, createSaga } from '../../src/story/sagaData.js';
import { state, SaveSystem, DEFAULT_STATE } from '../../src/core/state.js';
const saved = () => ({
  ...DEFAULT_STATE(),
  coins: 12345,
  saga: { ...createSaga(), chapter: 7, step: 2, done: CHAPTERS.slice(0, 7).map((ch) => ch.id) },
});
test('dashboard unlocks and legacy completion are bounded, locked replay rejected', () => {
  assert.equal(chapterFrontier(null, CHAPTERS), -1);
  assert.equal(chapterFrontier(saved().saga, CHAPTERS), 7);
  const s = saved();
  s.saga.chapter = 0;
  assert.equal(chapterFrontier(s.saga, CHAPTERS), 7);
  s.saga.legend = true;
  assert.equal(chapterFrontier(s.saga, CHAPTERS), 23);
  for (const i of [-1, 8, 24, NaN, 1.5]) assert.throws(() => chapterReplay(saved(), i, CHAPTERS, createSaga));
});
test('each unlocked replay reconstructs prerequisites without mutating the campaign', () => {
  const source = saved(),
    before = JSON.stringify(source);
  for (let i = 0; i < 8; i++) {
    const copy = chapterReplay(source, i, CHAPTERS, createSaga);
    assert.equal(copy.saga.step, 0);
    assert.equal(copy.saga.chapter, i);
    assert.equal(copy.saga.legend, false);
    assert.equal(copy.saga.companion, i >= 5);
    assert.equal(copy.saga.mansion, false);
    assert.equal(copy.saga.bigBoy, i >= 3);
    assert.deepEqual(copy.places, {});
    assert.equal(copy.coins, source.coins);
  }
  assert.equal(JSON.stringify(source), before);
});
test('replay autosaves, reload and rewards cannot alter main campaign; reset clears both slots', () => {
  const memory = new Map();
  globalThis.localStorage = {
    getItem: (k) => memory.get(k) || null,
    setItem: (k, v) => memory.set(k, v),
    removeItem: (k) => memory.delete(k),
  };
  Object.assign(state, saved());
  assert.equal(SaveSystem.save(), true);
  const original = JSON.stringify(SaveSystem.peek());
  SaveSystem.beginReplay(chapterReplay(SaveSystem.peek(), 1, CHAPTERS, createSaga));
  state.coins += 9000;
  state.saga.step = 2;
  SaveSystem.save();
  assert.equal(JSON.stringify(SaveSystem.peek()), original);
  assert.equal(SaveSystem.peekReplay().saga.step, 2);
  assert.equal(SaveSystem.load(true), true);
  assert.equal(state._replay.chapter, 1);
  assert.equal(SaveSystem.load(), true);
  assert.equal(state._replay, null);
  assert.equal(state.coins, 12345);
  assert.equal(state.saga.step, 2);
  const before = JSON.stringify(state);
  localStorage.setItem = () => {
    throw Error('quota');
  };
  assert.throws(() => SaveSystem.beginReplay(chapterReplay(SaveSystem.peek(), 0, CHAPTERS, createSaga)));
  assert.equal(JSON.stringify(state), before);
  SaveSystem.reset();
  assert.equal(SaveSystem.peek(), null);
  assert.equal(SaveSystem.peekReplay(), null);
});
