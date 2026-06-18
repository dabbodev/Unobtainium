'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { generateInstructionStream } = require('../src/instruction-stream');

const mesh = {
  points: [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
};

test('generates exactly count instructions', () => {
  const stream = generateInstructionStream({
    mesh,
    state: { point: 0, shift: 1, gap: 1 },
    count: 5,
    windowSize: 16,
  });

  assert.equal(stream.instructions.length, 5);
});

test('count zero returns an empty list and unchanged state', () => {
  const state = { point: 0, shift: 1, gap: 1 };
  const stream = generateInstructionStream({
    mesh,
    state,
    count: 0,
    windowSize: 16,
  });

  assert.deepEqual(stream.instructions, []);
  assert.deepEqual(stream.stateBefore, state);
  assert.deepEqual(stream.stateAfter, state);
});

test('does not mutate input state', () => {
  const state = { point: 0, shift: 1, gap: 1 };
  const before = JSON.stringify(state);

  generateInstructionStream({
    mesh,
    state,
    count: 6,
    windowSize: 16,
  });

  assert.equal(JSON.stringify(state), before);
});

test('does not mutate input mesh', () => {
  const localMesh = {
    points: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
  };
  const before = JSON.stringify(localMesh);

  generateInstructionStream({
    mesh: localMesh,
    state: { point: 0, shift: 1, gap: 1 },
    count: 6,
    windowSize: 16,
  });

  assert.equal(JSON.stringify(localMesh), before);
});

test('stateAfter matches the last instruction stateAfter', () => {
  const stream = generateInstructionStream({
    mesh,
    state: { point: 0, shift: 1, gap: 1 },
    count: 5,
    windowSize: 16,
  });

  assert.deepEqual(stream.stateAfter, stream.instructions.at(-1).stateAfter);
});

test('returns deterministic output for the same inputs', () => {
  const input = {
    mesh,
    state: { point: 0, shift: 1, gap: 1 },
    count: 7,
    windowSize: 16,
    minShift: 0,
  };

  assert.deepEqual(generateInstructionStream(input), generateInstructionStream(input));
});

test('throws on invalid count', () => {
  for (const count of [-1, 1.5, Number.NaN, '3']) {
    assert.throws(() => generateInstructionStream({
      mesh,
      state: { point: 0, shift: 1, gap: 1 },
      count,
      windowSize: 16,
    }), /count/);
  }
});
