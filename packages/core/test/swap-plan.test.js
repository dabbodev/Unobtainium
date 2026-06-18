'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  generateSwapPlan,
  swapPlanCommitment,
} = require('../src/swap-plan');

function mesh() {
  return [
    [0, 0, 0],
    [2, 0, 0],
    [0, 3, 0],
    [0, 0, 5],
    [7, 11, 13],
    [17, 19, 23],
  ];
}

function planOptions(overrides = {}) {
  return {
    mesh: mesh(),
    state: { point: 0, shift: 1, gap: 1 },
    length: 8,
    swapCount: 4,
    windowSize: 16,
    minShift: 0,
    mode: 'permissive',
    ...overrides,
  };
}

test('generates deterministic plan for same mesh, state, and options', () => {
  const options = planOptions();

  assert.deepEqual(generateSwapPlan(options), generateSwapPlan(options));
});

test('different state produces different plan where possible', () => {
  const first = generateSwapPlan(planOptions({
    state: { point: 0, shift: 1, gap: 1 },
  }));
  const second = generateSwapPlan(planOptions({
    state: { point: 1, shift: 1, gap: 1 },
  }));

  assert.notDeepEqual(first.swaps, second.swaps);
  assert.notEqual(swapPlanCommitment(first), swapPlanCommitment(second));
});

test('different swapCount changes plan and commitment', () => {
  const first = generateSwapPlan(planOptions({ swapCount: 3 }));
  const second = generateSwapPlan(planOptions({ swapCount: 4 }));

  assert.equal(first.swaps.length, 3);
  assert.equal(second.swaps.length, 4);
  assert.notDeepEqual(first.swaps, second.swaps);
  assert.notEqual(swapPlanCommitment(first), swapPlanCommitment(second));
});

test('swapCount zero returns empty swaps and unchanged state', () => {
  const state = { point: 0, shift: 1, gap: 1 };
  const plan = generateSwapPlan(planOptions({ state, swapCount: 0 }));

  assert.deepEqual(plan.swaps, []);
  assert.deepEqual(plan.stateBefore, state);
  assert.deepEqual(plan.stateAfter, state);
  assert.notEqual(plan.stateBefore, state);
  assert.notEqual(plan.stateAfter, state);
});

test('does not mutate input state', () => {
  const state = { point: 0, shift: 1, gap: 1 };
  const before = JSON.stringify(state);

  generateSwapPlan(planOptions({ state }));

  assert.equal(JSON.stringify(state), before);
});

test('does not mutate input mesh', () => {
  const localMesh = mesh();
  const before = JSON.stringify(localMesh);

  generateSwapPlan(planOptions({ mesh: localMesh }));

  assert.equal(JSON.stringify(localMesh), before);
});

test('all swap indices are within range', () => {
  const plan = generateSwapPlan(planOptions({ length: 5, swapCount: 12 }));

  for (const [a, b] of plan.swaps) {
    assert.equal(a >= 0 && a < plan.length, true);
    assert.equal(b >= 0 && b < plan.length, true);
  }
});

test('self-swaps are allowed in generated plans', () => {
  const plan = generateSwapPlan(planOptions({
    mesh: [
      [3, 0, 0],
      [3, 0, 0],
      [3, 0, 0],
    ],
    length: 8,
    swapCount: 2,
  }));

  assert.deepEqual(plan.swaps, [[3, 3], [3, 3]]);
});

test('swapPlanCommitment is deterministic hex', () => {
  const plan = generateSwapPlan(planOptions());
  const commitment = swapPlanCommitment(plan);

  assert.match(commitment, /^[0-9a-f]{64}$/);
  assert.equal(commitment, swapPlanCommitment(plan));
});

test('reordering swaps changes commitment', () => {
  const plan = generateSwapPlan(planOptions());
  const reordered = {
    ...plan,
    swaps: plan.swaps.slice().reverse(),
  };

  assert.notEqual(swapPlanCommitment(plan), swapPlanCommitment(reordered));
});

test('changing metadata changes commitment', () => {
  const plan = generateSwapPlan(planOptions());

  assert.notEqual(swapPlanCommitment(plan), swapPlanCommitment({ ...plan, length: 9 }));
  assert.notEqual(swapPlanCommitment(plan), swapPlanCommitment({ ...plan, swapCount: 5 }));
  assert.notEqual(swapPlanCommitment(plan), swapPlanCommitment({ ...plan, mode: 'distinct' }));
  assert.notEqual(swapPlanCommitment(plan), swapPlanCommitment({ ...plan, minShift: 1 }));
  assert.notEqual(swapPlanCommitment(plan), swapPlanCommitment({
    ...plan,
    swaps: plan.swaps.map((swap, index) => (index === 0 ? [swap[1], swap[0]] : swap)),
  }));
});

test('invalid length throws', () => {
  for (const length of [0, -1, 1.5, Number.NaN, '8']) {
    assert.throws(() => generateSwapPlan(planOptions({ length })), /length/);
  }
});

test('invalid swapCount throws', () => {
  for (const swapCount of [-1, 1.5, Number.NaN, '3']) {
    assert.throws(() => generateSwapPlan(planOptions({ swapCount })), /swapCount/);
  }
});
