'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  distinctTripleHorizon,
  permissiveTripleHorizon,
} = require('../src/horizon');

test('calculates ordered distinct triple horizons', () => {
  assert.equal(distinctTripleHorizon(0), 0);
  assert.equal(distinctTripleHorizon(2), 0);
  assert.equal(distinctTripleHorizon(3), 6);
  assert.equal(distinctTripleHorizon(5), 60);
});

test('calculates permissive triple horizons with repeated triples allowed', () => {
  assert.equal(permissiveTripleHorizon(0), 0);
  assert.equal(permissiveTripleHorizon(1), 1);
  assert.equal(permissiveTripleHorizon(3), 27);
  assert.equal(permissiveTripleHorizon(5), 125);
});

test('horizon helpers reject non-integer point counts', () => {
  assert.throws(() => distinctTripleHorizon(3.5), /pointCount/);
  assert.throws(() => permissiveTripleHorizon('3'), /pointCount/);
});
