'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  distance3d,
  triangleSides,
  angleAtFirstPoint,
  isDegenerateTriangle,
} = require('../src/geometry');

test('calculates 3d distance for simple points', () => {
  assert.equal(distance3d([0, 0, 0], [3, 4, 12]), 13);
  assert.equal(distance3d([0, 0, 0], [3000000, 4000000, 0]), 5000000);
});

test('calculates triangle side lengths deterministically', () => {
  assert.deepEqual(triangleSides([0, 0, 0], [3, 0, 0], [0, 4, 0]), {
    ab: 3,
    bc: 5,
    ca: 4,
  });
});

test('calculates angle at first point for a right angle', () => {
  assert.equal(angleAtFirstPoint([0, 0, 0], [1, 0, 0], [0, 1, 0]), 90);
});

test('detects degenerate triangles', () => {
  assert.equal(isDegenerateTriangle([0, 0, 0], [0, 0, 0], [1, 0, 0]), true);
  assert.equal(isDegenerateTriangle([0, 0, 0], [1, 1, 1], [2, 2, 2]), true);
  assert.equal(isDegenerateTriangle([0, 0, 0], [1, 0, 0], [0, 1, 0]), false);
});

test('degenerate angle returns a finite fallback instead of NaN', () => {
  const angle = angleAtFirstPoint([0, 0, 0], [0, 0, 0], [1, 0, 0]);

  assert.equal(angle, 0);
  assert.equal(Number.isNaN(angle), false);
});

test('geometry helpers reject malformed points', () => {
  assert.throws(() => distance3d([0, 0], [1, 0, 0]), /point/);
  assert.throws(() => angleAtFirstPoint([0, 0, 0], ['1', 0, 0], [0, 1, 0]), /number/);
  assert.equal(isDegenerateTriangle([0, 0, 0], [Number.NaN, 0, 0], [0, 1, 0]), true);
});
