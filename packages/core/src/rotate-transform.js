'use strict';

const { rotateUp, rotateDown } = require('./ring');

function assertInstructions(instructions, dataLength) {
  if (!Array.isArray(instructions)) {
    throw new TypeError('instructions must be an array');
  }
  if (instructions.length < dataLength) {
    throw new RangeError('instructions length must be at least data length');
  }
}

function assertDirection(direction) {
  if (direction !== 'up' && direction !== 'down') {
    throw new RangeError('direction must be "up" or "down"');
  }
}

function assertTurns(turns) {
  if (!Number.isInteger(turns)) {
    throw new TypeError('turns must be an integer');
  }
}

function outputFor(data, mutate) {
  if (Array.isArray(data)) {
    return mutate ? data : data.slice();
  }
  if (Buffer.isBuffer(data)) {
    return mutate ? data : Buffer.from(data);
  }
  if (data instanceof Uint8Array) {
    return mutate ? data : new Uint8Array(data);
  }

  throw new TypeError('data must be an Array, Uint8Array, or Buffer');
}

function assertTypedArrayValue(typeName, value) {
  if (value < 0 || value > 255) {
    throw new RangeError(`${typeName} transform result must fit in one byte`);
  }
}

function applyWithDirection(data, instructions, options, direction) {
  const turns = options.turns === undefined ? 1 : options.turns;
  const mutate = options.mutate === true;

  assertDirection(direction);
  assertTurns(turns);
  assertInstructions(instructions, data.length);

  const output = outputFor(data, mutate);
  const isByteArray = Buffer.isBuffer(output) || output instanceof Uint8Array;

  for (let index = 0; index < output.length; index += 1) {
    const instruction = instructions[index];
    if (instruction === null || typeof instruction !== 'object') {
      throw new TypeError(`instruction ${index} must be an object`);
    }

    const effectiveShift = instruction.shift * turns;
    const nextValue = direction === 'up'
      ? rotateUp(output[index], effectiveShift, instruction.windowSize)
      : rotateDown(output[index], effectiveShift, instruction.windowSize);

    if (isByteArray) {
      assertTypedArrayValue(Buffer.isBuffer(output) ? 'Buffer' : 'Uint8Array', nextValue);
    }

    output[index] = nextValue;
  }

  return output;
}

function applyRotateTransform(data, instructions, options = {}) {
  const direction = options.direction === undefined ? 'up' : options.direction;
  return applyWithDirection(data, instructions, options, direction);
}

function reverseRotateTransform(data, instructions, options = {}) {
  const direction = options.direction === undefined ? 'up' : options.direction;
  assertDirection(direction);

  const reverseDirection = direction === 'up' ? 'down' : 'up';
  return applyWithDirection(data, instructions, options, reverseDirection);
}

module.exports = {
  applyRotateTransform,
  reverseRotateTransform,
};
