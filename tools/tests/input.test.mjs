import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Input } from '../../src/core/Input.js';
function fixture() {
  const handlers = {};
  let exits = 0;
  globalThis.window = { addEventListener: () => {} };
  globalThis.document = {
    pointerLockElement: null,
    addEventListener: (name, fn) => (handlers[name] = fn),
    exitPointerLock: () => {
      exits++;
    },
  };
  const canvas = { addEventListener: () => {}, requestPointerLock: () => Promise.resolve() };
  const input = new Input(canvas);
  input.enabled = true;
  return { input, canvas, handlers, exits: () => exits };
}
test('late pointer-lock grant cannot capture a menu or cinematic', () => {
  const { input, canvas, handlers, exits } = fixture();
  input.lock();
  input.unlock();
  document.pointerLockElement = canvas;
  handlers.pointerlockchange();
  assert.equal(exits(), 1);
  assert.equal(input.expectedUnlock, true);
});
test('intentional release is distinguished from player Escape', () => {
  const { input, canvas, handlers } = fixture();
  input.lock();
  document.pointerLockElement = canvas;
  handlers.pointerlockchange();
  assert.equal(input.expectedUnlock, false);
  input.unlock();
  assert.equal(input.expectedUnlock, true);
  input.lock();
  handlers.pointerlockchange();
  document.pointerLockElement = null;
  handlers.pointerlockchange();
  assert.equal(input.expectedUnlock, false);
});
