'use strict';

function normalizeCount(pointCount) {
  if (!Number.isInteger(pointCount)) {
    throw new TypeError('pointCount must be an integer');
  }

  return pointCount;
}

function distinctTripleHorizon(pointCount) {
  const n = normalizeCount(pointCount);
  if (n < 3) {
    return 0;
  }

  // Distinct mode estimates ordered triples with no repeated point indices.
  return n * (n - 1) * (n - 2);
}

function permissiveTripleHorizon(pointCount) {
  const n = normalizeCount(pointCount);
  if (n < 1) {
    return 0;
  }

  // Permissive mode allows repeated or degenerate ordered triples.
  return n ** 3;
}

module.exports = {
  distinctTripleHorizon,
  permissiveTripleHorizon,
};
