'use strict';

const { rotateUp } = require('./ring');

function assertPointCount(pointCount) {
  if (!Number.isInteger(pointCount) || pointCount < 1) {
    throw new RangeError('pointCount must be a positive integer');
  }
}

function normalizeState(state, pointCount) {
  if (state === null || typeof state !== 'object') {
    throw new TypeError('state must be an object');
  }

  for (const field of ['point', 'shift', 'gap']) {
    if (!Number.isInteger(state[field])) {
      throw new TypeError(`state.${field} must be an integer`);
    }
  }

  return {
    point: ((state.point % pointCount) + pointCount) % pointCount,
    shift: ((state.shift % pointCount) + pointCount) % pointCount,
    gap: ((state.gap % pointCount) + pointCount) % pointCount,
  };
}

function assertMode(mode) {
  if (mode !== 'permissive' && mode !== 'distinct') {
    throw new RangeError('mode must be "permissive" or "distinct"');
  }
}

function selectTriple(state, pointCount, mode = 'permissive') {
  assertPointCount(pointCount);
  assertMode(mode);

  const normalized = normalizeState(state, pointCount);

  if (mode === 'distinct') {
    if (pointCount < 3) {
      throw new RangeError('distinct mode requires at least 3 points');
    }

    const secondOffset = 1 + (normalized.shift % (pointCount - 1));
    let thirdOffset = 1 + ((normalized.shift + normalized.gap + 1) % (pointCount - 1));

    if (thirdOffset === secondOffset) {
      thirdOffset = (thirdOffset % (pointCount - 1)) + 1;
    }

    return [
      normalized.point,
      rotateUp(normalized.point, secondOffset, pointCount),
      rotateUp(normalized.point, thirdOffset, pointCount),
    ];
  }

  return [
    normalized.point,
    rotateUp(normalized.point, normalized.shift, pointCount),
    rotateUp(normalized.point, normalized.shift + normalized.gap, pointCount),
  ];
}

function advanceWalk(state, pointCount, mode = 'permissive') {
  assertPointCount(pointCount);
  assertMode(mode);

  const normalized = normalizeState(state, pointCount);
  const next = {
    point: rotateUp(normalized.point, 1, pointCount),
    shift: normalized.shift,
    gap: normalized.gap,
  };

  if (next.point === 0) {
    next.shift = rotateUp(next.shift, 1, pointCount);
    if (next.shift === 0) {
      next.gap = rotateUp(next.gap, 1, pointCount);
    }
  }

  return next;
}

module.exports = {
  selectTriple,
  advanceWalk,
};
