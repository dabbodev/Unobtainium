'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { generateMaskInstruction } = require('../src/instruction');

test('generates a deterministic instruction from a small mesh', () => {
  const instruction = generateMaskInstruction({
    mesh: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ],
    state: { point: 0, shift: 1, gap: 1 },
    windowSize: 16,
  });

  assert.deepEqual(instruction.indices, [0, 1, 2]);
  assert.deepEqual(instruction.points, [[0, 0, 0], [1, 0, 0], [0, 1, 0]]);
  assert.equal(instruction.angle, 90);
  assert.equal(instruction.bucketId, 'lt-105');
  assert.equal(instruction.ruleId, 'ceil-x-minus-y-minus-z');
  assert.equal(instruction.rawShift, 0);
  assert.equal(instruction.shift, 0);
  assert.equal(instruction.windowSize, 16);
  assert.equal(instruction.minShift, 0);
  assert.equal(instruction.mode, 'permissive');
  assert.equal(instruction.degenerate, false);
  assert.deepEqual(instruction.stateBefore, { point: 0, shift: 1, gap: 1 });
  assert.deepEqual(instruction.stateAfter, { point: 1, shift: 1, gap: 1 });
});

test('does not mutate input state or mesh', () => {
  const mesh = {
    points: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ],
  };
  const state = { point: 0, shift: 1, gap: 1 };
  const meshBefore = JSON.stringify(mesh);
  const stateBefore = JSON.stringify(state);
  const instruction = generateMaskInstruction({ mesh, state, windowSize: 16 });

  instruction.points[0][0] = 99;

  assert.equal(JSON.stringify(mesh), meshBefore);
  assert.equal(JSON.stringify(state), stateBefore);
});

test('minShift zero can allow a zero shift for suitable raw values', () => {
  const instruction = generateMaskInstruction({
    mesh: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
    state: { point: 0, shift: 1, gap: 1 },
    windowSize: 16,
    minShift: 0,
  });

  assert.equal(instruction.rawShift, 0);
  assert.equal(instruction.shift, 0);
});

test('minShift one prevents zero shift', () => {
  const instruction = generateMaskInstruction({
    mesh: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
    state: { point: 0, shift: 1, gap: 1 },
    windowSize: 16,
    minShift: 1,
  });

  assert.equal(instruction.rawShift, 0);
  assert.equal(instruction.shift, 1);
});

test('distinct mode instruction uses three distinct indices when possible', () => {
  const instruction = generateMaskInstruction({
    mesh: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]],
    state: { point: 0, shift: 0, gap: 0 },
    windowSize: 16,
    mode: 'distinct',
  });

  assert.equal(new Set(instruction.indices).size, 3);
  assert.deepEqual(instruction.indices, [0, 1, 2]);
  assert.equal(instruction.degenerate, false);
});

test('degenerate permissive triples produce deterministic instructions without NaN', () => {
  const instruction = generateMaskInstruction({
    mesh: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
    state: { point: 0, shift: 0, gap: 0 },
    windowSize: 16,
    mode: 'permissive',
  });

  assert.deepEqual(instruction.indices, [0, 0, 0]);
  assert.equal(instruction.angle, null);
  assert.equal(instruction.bucketId, 'degenerate');
  assert.equal(instruction.ruleId, 'floor-x-plus-y-plus-z');
  assert.equal(Number.isNaN(instruction.rawShift), false);
  assert.equal(Number.isNaN(instruction.shift), false);
  assert.equal(instruction.degenerate, true);
});

test('instruction generation validates inputs through existing walk and ring rules', () => {
  assert.throws(() => generateMaskInstruction({
    mesh: [],
    state: { point: 0, shift: 0, gap: 0 },
    windowSize: 16,
  }), /mesh/);
  assert.throws(() => generateMaskInstruction({
    mesh: [[0, 0, 0]],
    state: { point: 0, shift: 0, gap: 0 },
    windowSize: 1,
  }), /windowSize/);
  assert.throws(() => generateMaskInstruction({
    mesh: [[0, 0, 0], [1, 0, 0]],
    state: { point: 0, shift: 0, gap: 0 },
    windowSize: 16,
    mode: 'distinct',
  }), /at least 3/);
});
