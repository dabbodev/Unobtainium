'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { selectTriple, advanceWalk } = require('../src/walk');

test('selects permissive triples with repeated indices allowed', () => {
  assert.deepEqual(selectTriple({ point: 0, shift: 0, gap: 0 }, 4), [0, 0, 0]);
  assert.deepEqual(selectTriple({ point: 3, shift: 1, gap: 2 }, 4), [3, 0, 2]);
});

test('selects distinct triples without repeated indices', () => {
  const triple = selectTriple({ point: 0, shift: 0, gap: 0 }, 4, 'distinct');

  assert.deepEqual(triple, [0, 1, 2]);
  assert.equal(new Set(triple).size, 3);

  for (let point = 0; point < 5; point += 1) {
    for (let shift = 0; shift < 5; shift += 1) {
      for (let gap = 0; gap < 5; gap += 1) {
        const selected = selectTriple({ point, shift, gap }, 5, 'distinct');
        assert.equal(new Set(selected).size, 3);
      }
    }
  }
});

test('advances walk state deterministically', () => {
  assert.deepEqual(advanceWalk({ point: 0, shift: 0, gap: 0 }, 4), { point: 1, shift: 0, gap: 0 });
  assert.deepEqual(advanceWalk({ point: 3, shift: 0, gap: 0 }, 4), { point: 0, shift: 1, gap: 0 });
  assert.deepEqual(advanceWalk({ point: 3, shift: 3, gap: 0 }, 4), { point: 0, shift: 0, gap: 1 });
});

test('walk helpers validate mode and point counts', () => {
  assert.throws(() => selectTriple({ point: 0, shift: 0, gap: 0 }, 2, 'distinct'), /at least 3/);
  assert.throws(() => selectTriple({ point: 0, shift: 0, gap: 0 }, 0), /pointCount/);
  assert.throws(() => selectTriple({ point: 0, shift: 0, gap: 0 }, 3, 'unknown'), /mode/);
  assert.throws(() => advanceWalk({ point: 0, shift: 0 }, 3), /state.gap/);
});
