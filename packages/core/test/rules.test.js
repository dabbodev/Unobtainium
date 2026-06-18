'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  defaultCoordinateRules,
  ruleForBucket,
  applyCoordinateRule,
} = require('../src/rules');

test('maps angle buckets to stable coordinate rule IDs', () => {
  assert.equal(ruleForBucket('degenerate').id, 'floor-x-plus-y-plus-z');
  assert.equal(ruleForBucket('lt-15').id, 'floor-x-plus-y-plus-z');
  assert.equal(ruleForBucket('lt-30').id, 'floor-x-plus-y-minus-z');
  assert.equal(ruleForBucket('lt-105').id, 'ceil-x-minus-y-minus-z');
  assert.equal(ruleForBucket('gte-105').id, 'ceil-x-minus-y-plus-z');
});

test('applies coordinate rules to known points', () => {
  const rules = defaultCoordinateRules();

  assert.equal(
    applyCoordinateRule([1.25, 2.25, 3.75], rules.definitions['floor-x-plus-y-minus-z']),
    -1,
  );
  assert.equal(
    applyCoordinateRule([1.25, 2.25, 3.75], rules.definitions['ceil-x-minus-y-minus-z']),
    -4,
  );
  assert.equal(
    applyCoordinateRule([1.25, 2.25, 3.75], rules.definitions['ceil-x-minus-y-plus-z']),
    3,
  );
});

test('supports simple custom coordinate rule tables', () => {
  const custom = {
    definitions: {
      only: { id: 'only', round: 'floor', signs: [1, -1, 1] },
    },
    byBucket: {
      custom: 'only',
    },
  };

  const rule = ruleForBucket('custom', custom);
  assert.equal(rule.id, 'only');
  assert.equal(applyCoordinateRule([5, 2.5, 1.25], rule), 3);
});

test('rejects malformed coordinate rules', () => {
  assert.throws(() => ruleForBucket('missing'), /no coordinate rule/);
  assert.throws(() => applyCoordinateRule([1, 2], ruleForBucket('lt-15')), /point/);
  assert.throws(() => applyCoordinateRule([1, Number.NaN, 2], ruleForBucket('lt-15')), /finite/);
  assert.throws(() => applyCoordinateRule([1, 2, 3], { id: 'bad', round: 'round', signs: [1, 1, 1] }), /round/);
  assert.throws(() => applyCoordinateRule([1, 2, 3], { id: 'bad', round: 'floor', signs: [1, 0, 1] }), /signs/);
});
