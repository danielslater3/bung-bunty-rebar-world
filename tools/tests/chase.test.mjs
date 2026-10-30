import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChaseController } from '../../src/story/ChaseController.js';
import { CHASE_PATH, CHAPTERS, createSaga } from '../../src/story/sagaData.js';
import { awardChapter, repairProgress } from '../../src/story/progression.js';
import { atDistance } from '../../src/systems/Navigation.js';
const path = CHASE_PATH.map(([x, z]) => ({ x, z, y: 0 }));
test('follow and trolley chase complete once at 30, 60 and 120 Hz', () => {
  for (const fps of [30, 60, 120])
    for (const catching of [false, true]) {
      let c = new ChaseController(path),
        player = atDistance(path, 0),
        travel = 0,
        completions = 0;
      for (let frame = 0; frame < fps * 200; frame++) {
        const dt = 1 / fps;
        travel = Math.min(c.length, travel + (catching ? 14 : 5.5) * dt);
        player = atDistance(path, travel);
        const r = c.update(dt, player, { catching, riding: catching });
        if (r.finished) completions++;
        if (frame === fps * 15) c = new ChaseController(path, JSON.parse(JSON.stringify(c.snapshot())));
      }
      assert.equal(completions, 1, `${fps} Hz catch=${catching}`);
    }
});
test('falling behind, stopping, taking a shortcut and reloading remain recoverable', () => {
  let c = new ChaseController(path);
  for (let i = 0; i < 6000; i++) c.update(1 / 60, path[0]);
  assert.ok(c.dist < 50);
  assert.ok(c.speed < 0.1);
  c = new ChaseController(path, c.snapshot());
  let done = 0;
  for (let i = 0; i < 20000; i++)
    if (c.update(1 / 60, path.at(-1), { catching: true, riding: true }).finished) done++;
  assert.equal(done, 1);
  assert.ok(c.dist >= c.length * 0.82);
});
test('obstruction stops movement instead of jumping waypoints', () => {
  const c = new ChaseController(path);
  for (let i = 0; i < 300; i++) c.update(1 / 60, path[0], { clear: () => false });
  assert.equal(c.dist, 0);
  assert.equal(c.blocked, true);
  assert.equal(c.speed, 0);
});
test('persistent obstruction allows a nearby catch without teleporting; it still requires a trolley', () => {
  const c = new ChaseController(path);
  let completions = 0;
  for (let i = 0; i < 600; i++)
    assert.equal(c.update(1 / 60, path[0], { catching: true, clear: () => false }).finished, false);
  for (let i = 0; i < 600; i++)
    if (c.update(1 / 60, path[0], { catching: true, riding: true, clear: () => false }).finished)
      completions++;
  assert.equal(completions, 1);
  assert.equal(c.dist, 0);
  const loaded = new ChaseController(path, c.snapshot());
  assert.equal(loaded.update(0.1, path[0], { catching: true, riding: true }).finished, false);
});
test('chapter-clear rewards are idempotent and old clear saves migrate', () => {
  for (const chapter of CHAPTERS) {
    const state = { coins: 0, saga: createSaga() };
    state.saga.chapter = CHAPTERS.indexOf(chapter);
    state.saga.step = chapter.steps.length;
    assert.equal(awardChapter(state, chapter), true);
    assert.equal(awardChapter(state, chapter), false);
    assert.equal(state.coins, chapter.reward?.coins || 0);
    state.saga.intermission = false;
    assert.equal(repairProgress(state.saga, CHAPTERS), false);
    assert.equal(state.saga.intermission, true);
  }
});
test('incomplete terminal save gets its clear transition, not an out-of-range step', () => {
  const saga = createSaga();
  saga.step = 999;
  assert.equal(repairProgress(saga, CHAPTERS), true);
  assert.equal(saga.step, CHAPTERS[0].steps.length);
});
