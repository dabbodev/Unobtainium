'use strict';

const EPSILON = 1e-12;

function assertPoint(point) {
  if (!Array.isArray(point) || point.length !== 3) {
    throw new TypeError('point must be a [x, y, z] array');
  }

  point.forEach((coordinate, index) => {
    if (typeof coordinate !== 'number') {
      throw new TypeError(`point[${index}] must be a number`);
    }
  });

  return point;
}

function isFinitePoint(point) {
  return point.every((coordinate) => Number.isFinite(coordinate));
}

function assertFinitePoint(point) {
  const normalized = assertPoint(point);

  normalized.forEach((coordinate, index) => {
    if (!Number.isFinite(coordinate)) {
      throw new TypeError(`point[${index}] must be finite`);
    }
  });

  return normalized;
}

function distance3d(a, b) {
  const left = assertFinitePoint(a);
  const right = assertFinitePoint(b);

  const distance = Math.hypot(
    left[0] - right[0],
    left[1] - right[1],
    left[2] - right[2],
  );

  if (!Number.isFinite(distance)) {
    throw new RangeError('distance must be finite');
  }

  return distance;
}

function triangleSides(p1, p2, p3) {
  return {
    ab: distance3d(p1, p2),
    bc: distance3d(p2, p3),
    ca: distance3d(p3, p1),
  };
}

function subtract(a, b) {
  return [
    a[0] - b[0],
    a[1] - b[1],
    a[2] - b[2],
  ];
}

function dot(a, b) {
  return (a[0] * b[0]) + (a[1] * b[1]) + (a[2] * b[2]);
}

function cross(a, b) {
  return [
    (a[1] * b[2]) - (a[2] * b[1]),
    (a[2] * b[0]) - (a[0] * b[2]),
    (a[0] * b[1]) - (a[1] * b[0]),
  ];
}

function vectorLength(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function isDegenerateTriangle(p1, p2, p3) {
  const first = assertPoint(p1);
  const second = assertPoint(p2);
  const third = assertPoint(p3);

  if (!isFinitePoint(first) || !isFinitePoint(second) || !isFinitePoint(third)) {
    return true;
  }

  const sideA = distance3d(first, second);
  const sideB = distance3d(second, third);
  const sideC = distance3d(third, first);

  if (sideA <= EPSILON || sideB <= EPSILON || sideC <= EPSILON) {
    return true;
  }

  if (
    sideA + sideB <= sideC + EPSILON
    || sideB + sideC <= sideA + EPSILON
    || sideC + sideA <= sideB + EPSILON
  ) {
    return true;
  }

  const firstToSecond = subtract(second, first);
  const firstToThird = subtract(third, first);
  return vectorLength(cross(firstToSecond, firstToThird)) <= EPSILON;
}

function angleAtFirstPoint(p1, p2, p3) {
  const first = assertPoint(p1);
  const second = assertPoint(p2);
  const third = assertPoint(p3);

  if (isDegenerateTriangle(first, second, third)) {
    return 0;
  }

  const firstToSecond = subtract(second, first);
  const firstToThird = subtract(third, first);
  const denominator = vectorLength(firstToSecond) * vectorLength(firstToThird);

  if (!Number.isFinite(denominator) || denominator <= EPSILON) {
    return 0;
  }

  const cosine = dot(firstToSecond, firstToThird) / denominator;
  const clampedCosine = Math.max(-1, Math.min(1, cosine));
  const angle = Math.acos(clampedCosine) * (180 / Math.PI);

  return Number.isFinite(angle) ? angle : 0;
}

module.exports = {
  distance3d,
  triangleSides,
  angleAtFirstPoint,
  isDegenerateTriangle,
};
