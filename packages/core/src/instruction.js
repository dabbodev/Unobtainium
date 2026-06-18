'use strict';

const { shiftFromRaw } = require('./ring');
const { selectTriple, advanceWalk } = require('./walk');
const { angleAtFirstPoint, isDegenerateTriangle } = require('./geometry');
const { bucketForAngle } = require('./buckets');
const { ruleForBucket, applyCoordinateRule } = require('./rules');

function pointsFromMesh(mesh) {
  const points = Array.isArray(mesh) ? mesh : mesh && mesh.points;

  if (!Array.isArray(points) || points.length === 0) {
    throw new TypeError('mesh must be an array of points or an object with points');
  }

  points.forEach((point, pointIndex) => {
    if (!Array.isArray(point) || point.length !== 3) {
      throw new TypeError(`mesh point ${pointIndex} must be a [x, y, z] array`);
    }
    point.forEach((coordinate, coordinateIndex) => {
      if (typeof coordinate !== 'number') {
        throw new TypeError(`mesh point ${pointIndex}[${coordinateIndex}] must be a number`);
      }
    });
  });

  return points;
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

function clonePoint(point) {
  return point.slice();
}

function generateMaskInstruction({
  mesh,
  state,
  windowSize,
  minShift = 0,
  mode = 'permissive',
  buckets,
  rules,
}) {
  const points = pointsFromMesh(mesh);
  const stateBefore = normalizeState(state, points.length);
  const indices = selectTriple(stateBefore, points.length, mode);
  const selectedPoints = indices.map((index) => points[index]);
  const degenerate = isDegenerateTriangle(selectedPoints[0], selectedPoints[1], selectedPoints[2]);
  const angle = degenerate
    ? null
    : angleAtFirstPoint(selectedPoints[0], selectedPoints[1], selectedPoints[2]);
  const bucket = bucketForAngle(degenerate ? null : angle, buckets);
  const rule = ruleForBucket(bucket.id, rules);
  const rawShift = applyCoordinateRule(selectedPoints[0], rule);
  const shift = shiftFromRaw(rawShift, windowSize, minShift);
  const stateAfter = advanceWalk(stateBefore, points.length, mode);

  return {
    indices: indices.slice(),
    points: selectedPoints.map(clonePoint),
    angle,
    bucketId: bucket.id,
    ruleId: rule.id,
    rawShift,
    shift,
    windowSize,
    minShift,
    mode,
    degenerate,
    stateBefore,
    stateAfter,
  };
}

module.exports = {
  generateMaskInstruction,
};
