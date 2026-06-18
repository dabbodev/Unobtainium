'use strict';

const crypto = require('node:crypto');

const { generateInstructionStream } = require('./instruction-stream');
const { stableStringify } = require('./stack-canonical');

function assertLength(length) {
  if (!Number.isInteger(length) || length < 1) {
    throw new RangeError('length must be a positive integer');
  }
}

function assertSwapCount(swapCount) {
  if (!Number.isInteger(swapCount) || swapCount < 0) {
    throw new RangeError('swapCount must be a non-negative integer');
  }
}

function cloneState(state) {
  if (state === null || typeof state !== 'object') {
    throw new TypeError('state must be an object');
  }

  return { ...state };
}

function instructionValue(instruction) {
  if (Number.isInteger(instruction.rawShift)) {
    return instruction.rawShift;
  }
  if (Number.isInteger(instruction.shift)) {
    return instruction.shift;
  }

  throw new TypeError('instruction must contain an integer rawShift or shift');
}

function indexFromInstruction(instruction, length) {
  return Math.abs(instructionValue(instruction)) % length;
}

function generateSwapPlan({
  mesh,
  state,
  length,
  swapCount,
  windowSize,
  minShift = 0,
  mode = 'permissive',
  buckets,
  rules,
}) {
  assertLength(length);
  assertSwapCount(swapCount);

  if (swapCount === 0) {
    const stateBefore = cloneState(state);
    return {
      format: 'UN-SWAP-PLAN',
      version: 1,
      length,
      swapCount,
      windowSize,
      minShift,
      mode,
      swaps: [],
      stateBefore,
      stateAfter: cloneState(stateBefore),
    };
  }

  const stream = generateInstructionStream({
    mesh,
    state,
    count: swapCount * 2,
    windowSize,
    minShift,
    mode,
    buckets,
    rules,
  });

  const swaps = [];
  for (let swapIndex = 0; swapIndex < swapCount; swapIndex += 1) {
    const first = stream.instructions[swapIndex * 2];
    const second = stream.instructions[(swapIndex * 2) + 1];
    swaps.push([
      indexFromInstruction(first, length),
      indexFromInstruction(second, length),
    ]);
  }

  return {
    format: 'UN-SWAP-PLAN',
    version: 1,
    length,
    swapCount,
    windowSize,
    minShift,
    mode,
    swaps,
    stateBefore: cloneState(stream.stateBefore),
    stateAfter: cloneState(stream.stateAfter),
  };
}

function swapPlanCommitment(plan) {
  return crypto
    .createHash('sha256')
    .update(stableStringify(plan))
    .digest('hex');
}

module.exports = {
  generateSwapPlan,
  swapPlanCommitment,
};
