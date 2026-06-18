'use strict';

const DEFAULT_RULES = Object.freeze({
  definitions: Object.freeze({
    'floor-x-plus-y-plus-z': Object.freeze({
      id: 'floor-x-plus-y-plus-z',
      round: 'floor',
      signs: Object.freeze([1, 1, 1]),
    }),
    'floor-x-plus-y-minus-z': Object.freeze({
      id: 'floor-x-plus-y-minus-z',
      round: 'floor',
      signs: Object.freeze([1, 1, -1]),
    }),
    'floor-x-minus-y-minus-z': Object.freeze({
      id: 'floor-x-minus-y-minus-z',
      round: 'floor',
      signs: Object.freeze([1, -1, -1]),
    }),
    'floor-x-minus-y-plus-z': Object.freeze({
      id: 'floor-x-minus-y-plus-z',
      round: 'floor',
      signs: Object.freeze([1, -1, 1]),
    }),
    'ceil-x-plus-y-plus-z': Object.freeze({
      id: 'ceil-x-plus-y-plus-z',
      round: 'ceil',
      signs: Object.freeze([1, 1, 1]),
    }),
    'ceil-x-plus-y-minus-z': Object.freeze({
      id: 'ceil-x-plus-y-minus-z',
      round: 'ceil',
      signs: Object.freeze([1, 1, -1]),
    }),
    'ceil-x-minus-y-minus-z': Object.freeze({
      id: 'ceil-x-minus-y-minus-z',
      round: 'ceil',
      signs: Object.freeze([1, -1, -1]),
    }),
    'ceil-x-minus-y-plus-z': Object.freeze({
      id: 'ceil-x-minus-y-plus-z',
      round: 'ceil',
      signs: Object.freeze([1, -1, 1]),
    }),
  }),
  byBucket: Object.freeze({
    degenerate: 'floor-x-plus-y-plus-z',
    'lt-15': 'floor-x-plus-y-plus-z',
    'lt-30': 'floor-x-plus-y-minus-z',
    'lt-45': 'floor-x-minus-y-minus-z',
    'lt-60': 'floor-x-minus-y-plus-z',
    'lt-75': 'ceil-x-plus-y-plus-z',
    'lt-90': 'ceil-x-plus-y-minus-z',
    'lt-105': 'ceil-x-minus-y-minus-z',
    'gte-105': 'ceil-x-minus-y-plus-z',
  }),
});

function defaultCoordinateRules() {
  return DEFAULT_RULES;
}

function ruleForBucket(bucketId, rules = defaultCoordinateRules()) {
  if (typeof bucketId !== 'string' || bucketId.length === 0) {
    throw new TypeError('bucketId must be a non-empty string');
  }
  if (rules === null || typeof rules !== 'object') {
    throw new TypeError('rules must be an object');
  }
  if (rules.byBucket === null || typeof rules.byBucket !== 'object') {
    throw new TypeError('rules.byBucket must be an object');
  }
  if (rules.definitions === null || typeof rules.definitions !== 'object') {
    throw new TypeError('rules.definitions must be an object');
  }

  const ruleId = rules.byBucket[bucketId];
  if (typeof ruleId !== 'string') {
    throw new RangeError(`no coordinate rule for bucket "${bucketId}"`);
  }

  const rule = rules.definitions[ruleId];
  if (rule === null || typeof rule !== 'object') {
    throw new RangeError(`coordinate rule "${ruleId}" is not defined`);
  }

  return rule;
}

function assertPoint(point) {
  if (!Array.isArray(point) || point.length !== 3) {
    throw new TypeError('point must be a [x, y, z] array');
  }

  point.forEach((coordinate, index) => {
    if (typeof coordinate !== 'number' || !Number.isFinite(coordinate)) {
      throw new TypeError(`point[${index}] must be a finite number`);
    }
  });
}

function applyCoordinateRule(point, rule) {
  assertPoint(point);

  if (rule === null || typeof rule !== 'object') {
    throw new TypeError('rule must be an object');
  }
  if (rule.round !== 'floor' && rule.round !== 'ceil') {
    throw new RangeError('rule.round must be "floor" or "ceil"');
  }
  if (!Array.isArray(rule.signs) || rule.signs.length !== 3) {
    throw new TypeError('rule.signs must be a three-item array');
  }

  rule.signs.forEach((sign, index) => {
    if (sign !== 1 && sign !== -1) {
      throw new RangeError(`rule.signs[${index}] must be 1 or -1`);
    }
  });

  const value = (point[0] * rule.signs[0])
    + (point[1] * rule.signs[1])
    + (point[2] * rule.signs[2]);
  const raw = rule.round === 'floor' ? Math.floor(value) : Math.ceil(value);

  if (!Number.isSafeInteger(raw)) {
    throw new RangeError('raw coordinate rule value must be a safe integer');
  }

  return raw;
}

module.exports = {
  defaultCoordinateRules,
  ruleForBucket,
  applyCoordinateRule,
};
