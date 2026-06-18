'use strict';

function assertInteger(name, value) {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${name} must be an integer`);
  }
}

function assertWindowSize(windowSize) {
  assertInteger('windowSize', windowSize);
  if (windowSize <= 1) {
    throw new RangeError('windowSize must be greater than 1');
  }
}

function assertMinShift(minShift, windowSize) {
  assertInteger('minShift', minShift);
  if (minShift < 0 || minShift >= windowSize) {
    throw new RangeError('minShift must be 0 <= minShift < windowSize');
  }
}

function normalizeTurns(turns, windowSize) {
  assertInteger('turns', turns);
  assertWindowSize(windowSize);

  return ((turns % windowSize) + windowSize) % windowSize;
}

function rotateValue(value, shift, windowSize) {
  assertInteger('value', value);
  assertInteger('shift', shift);
  assertWindowSize(windowSize);

  return normalizeTurns(value + shift, windowSize);
}

function rotateUp(value, shift, windowSize) {
  return rotateValue(value, shift, windowSize);
}

function rotateDown(value, shift, windowSize) {
  return rotateValue(value, -shift, windowSize);
}

function shiftFromRaw(raw, windowSize, minShift) {
  assertInteger('raw', raw);
  assertWindowSize(windowSize);
  assertMinShift(minShift, windowSize);

  const span = windowSize - minShift;
  return minShift + (((raw % span) + span) % span);
}

module.exports = {
  normalizeTurns,
  rotateValue,
  rotateUp,
  rotateDown,
  shiftFromRaw,
};
