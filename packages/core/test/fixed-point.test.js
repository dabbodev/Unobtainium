'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  toFixedPoint,
  fromFixedPoint,
  normalizePoint,
  serializePoint,
  serializeMesh,
} = require('../src/fixed-point');

test('converts finite numbers to deterministic fixed-point integers', () => {
  assert.equal(toFixedPoint(1.2345674), 1234567);
  assert.equal(toFixedPoint(-1.2345675), -1234567);
  assert.equal(fromFixedPoint(1234567), 1.234567);
});

test('normalizes points while preserving coordinate order', () => {
  assert.deepEqual(normalizePoint([1.25, 0, -2.5]), [1250000, 0, -2500000]);
});

test('serializes normalized points and meshes deterministically', () => {
  const points = [
    normalizePoint([1, 2, 3]),
    normalizePoint([0.5, -0.25, 9]),
  ];

  assert.equal(serializePoint(points[0]), '[1000000,2000000,3000000]');
  assert.equal(serializeMesh(points), '[[1000000,2000000,3000000],[500000,-250000,9000000]]');
  assert.notEqual(serializeMesh([points[1], points[0]]), serializeMesh(points));
});

test('rejects malformed or non-finite fixed-point input', () => {
  assert.throws(() => toFixedPoint(Number.NaN), /finite number/);
  assert.throws(() => toFixedPoint(Number.POSITIVE_INFINITY), /finite number/);
  assert.throws(() => toFixedPoint('1'), /finite number/);
  assert.throws(() => normalizePoint([1, 2]), /point/);
  assert.throws(() => normalizePoint([1, 2, Number.NaN]), /finite number/);
  assert.throws(() => serializePoint([1, 2, 3.5]), /safe integer/);
  assert.throws(() => serializeMesh([[1, 2]]), /points/);
});
