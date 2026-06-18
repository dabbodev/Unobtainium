'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeTurns,
  rotateValue,
  rotateUp,
  rotateDown,
  shiftFromRaw,
} = require('../src/ring');

test('normalizes ring turns with positive and negative values', () => {
  assert.equal(normalizeTurns(0, 16), 0);
  assert.equal(normalizeTurns(16, 16), 0);
  assert.equal(normalizeTurns(31, 16), 15);
  assert.equal(normalizeTurns(-1, 16), 15);
});

test('rotates values on ring16', () => {
  assert.equal(rotateUp(4, 16, 16), 4);
  assert.equal(rotateUp(4, 15, 16), rotateDown(4, 1, 16));
  assert.equal(rotateUp(4, 8, 16), 12);
  assert.equal(rotateValue(15, 1, 16), 0);
});

test('shiftFromRaw honors minShift ranges', () => {
  assert.deepEqual([0, 1, 15, 16, -1].map((raw) => shiftFromRaw(raw, 16, 0)), [0, 1, 15, 0, 15]);
  assert.deepEqual([0, 1, 14, 15, -1].map((raw) => shiftFromRaw(raw, 16, 1)), [1, 2, 15, 1, 15]);
});

test('ring helpers reject invalid windows and minShift values', () => {
  assert.throws(() => normalizeTurns(1, 1), /windowSize/);
  assert.throws(() => normalizeTurns(1.5, 16), /turns/);
  assert.throws(() => shiftFromRaw(0, 16, -1), /minShift/);
  assert.throws(() => shiftFromRaw(0, 16, 16), /minShift/);
});
