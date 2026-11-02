import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RhythmBattle } from '../../src/story/RhythmBattle.js';
test('three rounds finish once at 30/60/120 Hz with score and combos', () => {
  for (const fps of [30, 60, 120]) {
    const b = new RhythmBattle();
    let completed = 0;
    for (let n = 0; n < fps * 40; n++) {
      const event = b.update(1 / fps, b.index < 8 && b.time + 1 / fps >= b.due);
      if (event === 'complete') completed++;
    }
    assert.equal(completed, 1);
    assert.equal(b.complete, true);
    assert.equal(b.best, 8);
    assert.ok(b.total > 2400);
  }
});
test('missed rounds retry; checkpoint restarts only current round without score farming', () => {
  const b = new RhythmBattle();
  let retry = false;
  for (let n = 0; n < 1000 && !retry; n++) retry = b.update(1 / 60) === 'retry';
  assert.equal(retry, true);
  assert.equal(b.round, 0);
  assert.equal(b.total, 0);
  while (b.round === 0) b.update(1 / 60, b.index < 8 && b.time + 1 / 60 >= b.due);
  const checkpoint = b.snapshot();
  for (let n = 0; n < 150; n++) b.update(1 / 60, b.index < 8 && b.time + 1 / 60 >= b.due);
  const loaded = new RhythmBattle(b.snapshot());
  assert.equal(loaded.round, 1);
  assert.equal(loaded.total, checkpoint.total);
});
