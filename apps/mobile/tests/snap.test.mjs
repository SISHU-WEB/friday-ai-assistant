import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clamp,
  focusedIndex,
  projectedSnapIndex,
  resistBeyondBounds,
} from '../src/archive/logic/snap.ts';

const count = 7;

test('first frame selects exactly the centered Compliance folder', () => {
  assert.equal(focusedIndex(3, count), 3);
  assert.equal(
    Array.from({ length: count }, (_, index) => index === focusedIndex(3, count))
      .filter(Boolean).length,
    1,
  );
});

test('slow drag in either direction follows position and snaps nearest', () => {
  assert.equal(projectedSnapIndex(3.65, 0, count), 4);
  assert.equal(projectedSnapIndex(2.35, 0, count), 2);
  assert.equal(projectedSnapIndex(3.49, 0, count), 3);
  assert.equal(projectedSnapIndex(3.5, 0, count), 4);
});

test('fast swipes project velocity before choosing the snap target', () => {
  assert.equal(projectedSnapIndex(3.1, -250, count), 4);
  assert.equal(projectedSnapIndex(2.9, 250, count), 2);
});

test('selection stays unique through a continuous drag', () => {
  for (let position = 0; position <= 6; position += 0.01) {
    const active = Array.from({ length: count }, (_, index) => index === focusedIndex(position, count));
    assert.equal(active.filter(Boolean).length, 1);
  }
});

test('finite ends resist drag and never wrap to the opposite folder', () => {
  assert.equal(resistBeyondBounds(-1, 6), -0.18);
  assert.equal(resistBeyondBounds(7, 6), 6.18);
  assert.equal(projectedSnapIndex(-0.18, 1200, count), 0);
  assert.equal(projectedSnapIndex(6.18, -1200, count), 6);
  assert.equal(focusedIndex(-100, count), 0);
  assert.equal(focusedIndex(100, count), 6);
  assert.equal(clamp(3, 0, 6), 3);
});

test('rapid successive drags resolve to the final in-range folder', () => {
  const successive = [3.2, 4.45, 5.75, 3.8, 1.15];
  const selected = successive.map((position) => projectedSnapIndex(position, 0, count));
  assert.deepEqual(selected, [3, 4, 6, 4, 1]);
});
