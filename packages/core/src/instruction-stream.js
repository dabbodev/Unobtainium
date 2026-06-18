'use strict';

const { generateMaskInstruction } = require('./instruction');

function assertCount(count) {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError('count must be a non-negative integer');
  }
}

function cloneState(state) {
  if (state === null || typeof state !== 'object') {
    throw new TypeError('state must be an object');
  }

  return { ...state };
}

function generateInstructionStream({
  mesh,
  state,
  count,
  windowSize,
  minShift = 0,
  mode = 'permissive',
  buckets,
  rules,
}) {
  assertCount(count);

  const stateBefore = cloneState(state);
  const instructions = [];
  let nextState = cloneState(stateBefore);

  for (let index = 0; index < count; index += 1) {
    const instruction = generateMaskInstruction({
      mesh,
      state: nextState,
      windowSize,
      minShift,
      mode,
      buckets,
      rules,
    });

    instructions.push(instruction);
    nextState = cloneState(instruction.stateAfter);
  }

  return {
    instructions,
    stateBefore,
    stateAfter: count === 0 ? cloneState(stateBefore) : cloneState(nextState),
  };
}

module.exports = {
  generateInstructionStream,
};
