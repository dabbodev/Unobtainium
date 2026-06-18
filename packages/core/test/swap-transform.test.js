'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { generateInstructionStream } = require('../src/instruction-stream');
const {
  applyRotateTransform,
  reverseRotateTransform,
} = require('../src/rotate-transform');
const { generateSwapPlan } = require('../src/swap-plan');
const {
  applySwapTransform,
  reverseSwapTransform,
} = require('../src/swap-transform');

function swapPlan(overrides = {}) {
  return {
    format: 'UN-SWAP-PLAN',
    version: 1,
    length: 4,
    swapCount: 2,
    windowSize: 16,
    minShift: 0,
    mode: 'permissive',
    swaps: [[0, 2], [1, 3]],
    stateBefore: { point: 0, shift: 1, gap: 1 },
    stateAfter: { point: 0, shift: 1, gap: 1 },
    ...overrides,
  };
}

test('array input roundtrips with apply then reverse', () => {
  const data = [10, 20, 30, 40];
  const plan = swapPlan();
  const transformed = applySwapTransform(data, plan);
  const restored = reverseSwapTransform(transformed, plan);

  assert.deepEqual(restored, data);
  assert.equal(Array.isArray(transformed), true);
});

test('Buffer input roundtrips', () => {
  const data = Buffer.from([10, 20, 30, 40]);
  const plan = swapPlan();
  const transformed = applySwapTransform(data, plan);
  const restored = reverseSwapTransform(transformed, plan);

  assert.equal(Buffer.isBuffer(transformed), true);
  assert.deepEqual([...restored], [...data]);
});

test('Uint8Array input roundtrips', () => {
  const data = new Uint8Array([10, 20, 30, 40]);
  const plan = swapPlan();
  const transformed = applySwapTransform(data, plan);
  const restored = reverseSwapTransform(transformed, plan);

  assert.equal(transformed instanceof Uint8Array, true);
  assert.equal(Buffer.isBuffer(transformed), false);
  assert.deepEqual([...restored], [...data]);
});

test('input is not mutated by default', () => {
  const data = [10, 20, 30, 40];

  applySwapTransform(data, swapPlan());

  assert.deepEqual(data, [10, 20, 30, 40]);
});

test('input mutates when mutate is true', () => {
  const data = [10, 20, 30, 40];
  const transformed = applySwapTransform(data, swapPlan(), { mutate: true });

  assert.equal(transformed, data);
  assert.deepEqual(data, [30, 40, 10, 20]);
});

test('self-swaps are handled as no-ops', () => {
  const data = [10, 20, 30, 40];
  const plan = swapPlan({ swaps: [[0, 0], [2, 2]] });

  assert.deepEqual(applySwapTransform(data, plan), data);
});

test('empty swap plan leaves data unchanged', () => {
  const data = [10, 20, 30, 40];
  const plan = swapPlan({ swapCount: 0, swaps: [] });

  assert.deepEqual(applySwapTransform(data, plan), data);
});

test('invalid swap index throws', () => {
  assert.throws(() => applySwapTransform([10, 20, 30, 40], swapPlan({
    swaps: [[0, 4]],
  })), /out of range/);
});

test('plan length mismatch throws', () => {
  assert.throws(() => applySwapTransform([10, 20, 30], swapPlan()), /length/);
});

test('applying the same non-empty plan twice is not assumed to restore original', () => {
  const data = [10, 20, 30];
  const plan = swapPlan({
    length: 3,
    swaps: [[0, 1], [1, 2]],
  });
  const once = applySwapTransform(data, plan);
  const twice = applySwapTransform(once, plan);

  assert.notDeepEqual(twice, data);
  assert.deepEqual(reverseSwapTransform(once, plan), data);
});

test('position changes occur for a known simple plan', () => {
  assert.deepEqual(
    applySwapTransform(['a', 'b', 'c', 'd'], swapPlan()),
    ['c', 'd', 'a', 'b'],
  );
});

test('direct UN-SWAP and UN-ROTATE composition roundtrips without UNSTACK', () => {
  const mesh = [
    [0, 0, 0],
    [2, 0, 0],
    [0, 3, 0],
    [0, 0, 5],
    [7, 11, 13],
  ];
  const state = { point: 0, shift: 1, gap: 1 };
  const data = [0, 1, 2, 3, 4, 5];
  const unSwap = generateSwapPlan({
    mesh,
    state,
    length: data.length,
    swapCount: 4,
    windowSize: 16,
    minShift: 0,
  });
  const rotateInstructions = generateInstructionStream({
    mesh,
    state: unSwap.stateAfter,
    count: data.length,
    windowSize: 16,
    minShift: 1,
  }).instructions;

  const swapped = applySwapTransform(data, unSwap);
  const rotated = applyRotateTransform(swapped, rotateInstructions);
  const unrotated = reverseRotateTransform(rotated, rotateInstructions);
  const restored = reverseSwapTransform(unrotated, unSwap);

  assert.deepEqual(restored, data);
});
