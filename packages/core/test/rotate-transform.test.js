'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { generateInstructionStream } = require('../src/instruction-stream');
const {
  applyRotateTransform,
  reverseRotateTransform,
} = require('../src/rotate-transform');

function instructionsFor(count, options = {}) {
  return generateInstructionStream({
    mesh: options.mesh || [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]],
    state: options.state || { point: 0, shift: 1, gap: 1 },
    count,
    windowSize: options.windowSize || 16,
    minShift: options.minShift === undefined ? 1 : options.minShift,
    mode: options.mode || 'permissive',
  }).instructions;
}

test('array input roundtrips apply up then reverse', () => {
  const data = [0, 1, 2, 3, 4, 5];
  const instructions = instructionsFor(data.length);
  const transformed = applyRotateTransform(data, instructions, { direction: 'up', turns: 3 });
  const restored = reverseRotateTransform(transformed, instructions, { direction: 'up', turns: 3 });

  assert.deepEqual(restored, data);
  assert.equal(Array.isArray(transformed), true);
});

test('Buffer input roundtrips', () => {
  const data = Buffer.from([0, 1, 2, 3, 4, 5]);
  const instructions = instructionsFor(data.length);
  const transformed = applyRotateTransform(data, instructions, { turns: 2 });
  const restored = reverseRotateTransform(transformed, instructions, { turns: 2 });

  assert.equal(Buffer.isBuffer(transformed), true);
  assert.deepEqual([...restored], [...data]);
});

test('Uint8Array input roundtrips', () => {
  const data = new Uint8Array([0, 1, 2, 3, 4, 5]);
  const instructions = instructionsFor(data.length);
  const transformed = applyRotateTransform(data, instructions, { turns: 4 });
  const restored = reverseRotateTransform(transformed, instructions, { turns: 4 });

  assert.equal(transformed instanceof Uint8Array, true);
  assert.equal(Buffer.isBuffer(transformed), false);
  assert.deepEqual([...restored], [...data]);
});

test('input is not mutated by default', () => {
  const data = [0, 1, 2, 3];
  const before = data.slice();

  applyRotateTransform(data, instructionsFor(data.length));

  assert.deepEqual(data, before);
});

test('input is mutated when mutate is true', () => {
  const data = [0, 1, 2, 3];
  const instructions = instructionsFor(data.length);
  const transformed = applyRotateTransform(data, instructions, { mutate: true });

  assert.equal(transformed, data);
  assert.notDeepEqual(data, [0, 1, 2, 3]);
});

test('throws if instruction count is shorter than data length', () => {
  assert.throws(() => applyRotateTransform([0, 1, 2], instructionsFor(2)), /instructions length/);
});

test('ring16 turns 16 is identity', () => {
  const data = [0, 1, 2, 3, 4, 5];
  const transformed = applyRotateTransform(data, instructionsFor(data.length), { turns: 16 });

  assert.deepEqual(transformed, data);
});

test('ring16 turns 15 up equals turns 1 down', () => {
  const data = [0, 1, 2, 3, 4, 5];
  const instructions = instructionsFor(data.length);

  assert.deepEqual(
    applyRotateTransform(data, instructions, { direction: 'up', turns: 15 }),
    applyRotateTransform(data, instructions, { direction: 'down', turns: 1 }),
  );
});

test('ring16 turns 8 half-turn roundtrips after applying twice', () => {
  const data = [0, 1, 2, 3, 4, 5];
  const instructions = instructionsFor(data.length);
  const once = applyRotateTransform(data, instructions, { turns: 8 });
  const twice = applyRotateTransform(once, instructions, { turns: 8 });

  assert.deepEqual(twice, data);
});

test('works with minShift zero instructions including zero-shift positions', () => {
  const data = [0, 1, 2, 3];
  const instructions = instructionsFor(data.length, {
    mesh: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
    state: { point: 0, shift: 1, gap: 1 },
    minShift: 0,
  });

  assert.equal(instructions.some((instruction) => instruction.shift === 0), true);
  assert.deepEqual(
    reverseRotateTransform(applyRotateTransform(data, instructions), instructions),
    data,
  );
});

test('works with degenerate permissive instructions deterministically', () => {
  const data = [0, 1, 2, 3, 4];
  const instructions = instructionsFor(data.length, {
    mesh: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
    state: { point: 0, shift: 0, gap: 0 },
    minShift: 0,
    mode: 'permissive',
  });

  const first = applyRotateTransform(data, instructions);
  const second = applyRotateTransform(data, instructions);

  assert.equal(instructions[0].degenerate, true);
  assert.deepEqual(first, second);
  assert.deepEqual(reverseRotateTransform(first, instructions), data);
});
