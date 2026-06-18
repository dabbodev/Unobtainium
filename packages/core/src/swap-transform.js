'use strict';

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

function assertSwapPlan(swapPlan, dataLength) {
  if (swapPlan === null || typeof swapPlan !== 'object') {
    throw new TypeError('swapPlan must be an object');
  }
  if (swapPlan.length !== dataLength) {
    throw new RangeError('swapPlan length must match data length');
  }
  if (!Array.isArray(swapPlan.swaps)) {
    throw new TypeError('swapPlan swaps must be an array');
  }

  swapPlan.swaps.forEach((swap, swapIndex) => {
    if (!Array.isArray(swap) || swap.length !== 2) {
      throw new TypeError(`swap ${swapIndex} must be a pair`);
    }

    swap.forEach((index, pairIndex) => {
      if (!Number.isInteger(index)) {
        throw new TypeError(`swap ${swapIndex}[${pairIndex}] must be an integer`);
      }
      if (index < 0 || index >= dataLength) {
        throw new RangeError(`swap ${swapIndex}[${pairIndex}] index out of range`);
      }
    });
  });
}

function swapValues(output, a, b) {
  const value = output[a];
  output[a] = output[b];
  output[b] = value;
}

function applyInOrder(data, swapPlan, mutate, reverse) {
  const output = outputFor(data, mutate);
  assertSwapPlan(swapPlan, output.length);
  const { swaps } = swapPlan;

  if (reverse) {
    for (let index = swaps.length - 1; index >= 0; index -= 1) {
      swapValues(output, swaps[index][0], swaps[index][1]);
    }
  } else {
    for (let index = 0; index < swaps.length; index += 1) {
      swapValues(output, swaps[index][0], swaps[index][1]);
    }
  }

  return output;
}

function applySwapTransform(data, swapPlan, options = {}) {
  return applyInOrder(data, swapPlan, options.mutate === true, false);
}

function reverseSwapTransform(data, swapPlan, options = {}) {
  return applyInOrder(data, swapPlan, options.mutate === true, true);
}

module.exports = {
  applySwapTransform,
  reverseSwapTransform,
};
