'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { defaultAngleBuckets, bucketForAngle } = require('../src/buckets');

test('selects legacy-inspired angle buckets at representative angles', () => {
  assert.equal(bucketForAngle(0).id, 'lt-15');
  assert.equal(bucketForAngle(14.999).id, 'lt-15');
  assert.equal(bucketForAngle(15).id, 'lt-30');
  assert.equal(bucketForAngle(44.9).id, 'lt-45');
  assert.equal(bucketForAngle(60).id, 'lt-75');
  assert.equal(bucketForAngle(89.999).id, 'lt-90');
  assert.equal(bucketForAngle(90).id, 'lt-105');
  assert.equal(bucketForAngle(105).id, 'gte-105');
});

test('returns the explicit degenerate bucket for degenerate angles', () => {
  assert.equal(bucketForAngle(null).id, 'degenerate');
  assert.equal(bucketForAngle(Number.NaN).id, 'degenerate');
  assert.equal(bucketForAngle(Number.POSITIVE_INFINITY).id, 'degenerate');
});

test('default bucket table returns stable bucket objects', () => {
  const buckets = defaultAngleBuckets();

  assert.equal(Object.isFrozen(buckets), true);
  assert.equal(bucketForAngle(90), buckets.find((bucket) => bucket.id === 'lt-105'));
});

test('supports simple custom bucket tables', () => {
  const custom = [
    { id: 'degenerate', degenerate: true },
    { id: 'small', maxExclusive: 10 },
    { id: 'large', minInclusive: 10 },
  ];

  assert.equal(bucketForAngle(9, custom).id, 'small');
  assert.equal(bucketForAngle(10, custom).id, 'large');
});

test('rejects malformed bucket input', () => {
  assert.throws(() => bucketForAngle('90'), /angle/);
  assert.throws(() => bucketForAngle(-1), /angle/);
  assert.throws(() => bucketForAngle(181), /angle/);
  assert.throws(() => bucketForAngle(1, []), /buckets/);
});
