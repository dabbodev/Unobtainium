'use strict';

const DEFAULT_SCALE = 1000000;

function assertScale(scale) {
  if (!Number.isInteger(scale) || scale <= 0) {
    throw new TypeError('scale must be a positive integer');
  }
}

function assertFiniteNumber(name, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
}

function assertFixedInteger(name, value) {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${name} must be a safe integer`);
  }
}

function toFixedPoint(value, scale = DEFAULT_SCALE) {
  assertScale(scale);
  assertFiniteNumber('value', value);

  const fixed = Math.round(value * scale);
  assertFixedInteger('fixed-point value', fixed);
  return fixed;
}

function fromFixedPoint(value, scale = DEFAULT_SCALE) {
  assertScale(scale);
  assertFixedInteger('value', value);

  return value / scale;
}

function normalizePoint(point, scale = DEFAULT_SCALE) {
  assertScale(scale);

  if (!Array.isArray(point) || point.length !== 3) {
    throw new TypeError('point must be a [x, y, z] array');
  }

  return point.map((coordinate, index) => toFixedPoint(coordinate, scale));
}

function serializePoint(point) {
  if (!Array.isArray(point) || point.length !== 3) {
    throw new TypeError('point must be a normalized [x, y, z] array');
  }

  point.forEach((coordinate, index) => {
    assertFixedInteger(`point[${index}]`, coordinate);
  });

  return JSON.stringify(point);
}

function serializeMesh(points) {
  if (!Array.isArray(points)) {
    throw new TypeError('points must be an array');
  }

  return JSON.stringify(points.map((point) => {
    if (!Array.isArray(point) || point.length !== 3) {
      throw new TypeError('points must contain normalized [x, y, z] arrays');
    }

    point.forEach((coordinate, index) => {
      assertFixedInteger(`point[${index}]`, coordinate);
    });

    return point.slice();
  }));
}

module.exports = {
  toFixedPoint,
  fromFixedPoint,
  normalizePoint,
  serializePoint,
  serializeMesh,
};
