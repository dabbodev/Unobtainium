'use strict';

const crypto = require('node:crypto');

const RUNTIME_ONLY_KEYS = new Set([
  '_runtime',
  'instructionStream',
  'instructions',
  'randomBytes',
  'rawRandomBytes',
  'rawRandomSource',
  'runtime',
  'runtimeOnly',
  'sourceBytes',
  'stateAfter',
  'stateBefore',
]);

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function stableStringify(value) {
  const seen = new Set();

  function stringify(item) {
    if (item === null) {
      return 'null';
    }

    if (Array.isArray(item)) {
      if (seen.has(item)) {
        throw new TypeError('canonical values must not contain cycles');
      }

      seen.add(item);
      const serialized = item.map((entry) => {
        if (entry === undefined) {
          throw new TypeError('canonical arrays must not contain undefined');
        }
        return stringify(entry);
      });
      seen.delete(item);
      return `[${serialized.join(',')}]`;
    }

    const valueType = typeof item;
    if (valueType === 'string') {
      return JSON.stringify(item);
    }
    if (valueType === 'number') {
      if (!Number.isFinite(item)) {
        throw new TypeError('canonical numbers must be finite');
      }
      return JSON.stringify(item);
    }
    if (valueType === 'boolean') {
      return item ? 'true' : 'false';
    }
    if (valueType === 'object') {
      if (!isPlainObject(item)) {
        throw new TypeError('canonical objects must be plain objects');
      }
      if (seen.has(item)) {
        throw new TypeError('canonical values must not contain cycles');
      }

      seen.add(item);
      const keys = Object.keys(item).sort();
      const serialized = keys.map((key) => {
        const entry = item[key];
        const entryType = typeof entry;
        if (entry === undefined || entryType === 'function' || entryType === 'symbol') {
          throw new TypeError('canonical objects must not contain unsupported fields');
        }
        return `${JSON.stringify(key)}:${stringify(entry)}`;
      });
      seen.delete(item);
      return `{${serialized.join(',')}}`;
    }

    throw new TypeError('canonical value type is unsupported');
  }

  return stringify(value);
}

function stripRuntimeFields(value, seen = new Set()) {
  if (value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new TypeError('stack canonicalization must not contain cycles');
    }
    seen.add(value);
    const stripped = value.map((entry) => stripRuntimeFields(entry, seen));
    seen.delete(value);
    return stripped;
  }

  const valueType = typeof value;
  if (valueType !== 'object') {
    return value;
  }
  if (!isPlainObject(value)) {
    throw new TypeError('stack canonicalization only supports plain objects and arrays');
  }
  if (seen.has(value)) {
    throw new TypeError('stack canonicalization must not contain cycles');
  }

  seen.add(value);
  const stripped = {};
  for (const key of Object.keys(value)) {
    if (RUNTIME_ONLY_KEYS.has(key) || key.startsWith('_')) {
      continue;
    }
    stripped[key] = stripRuntimeFields(value[key], seen);
  }
  seen.delete(value);
  return stripped;
}

function canonicalizeStack(stack) {
  if (stack === null || typeof stack !== 'object' || Array.isArray(stack)) {
    throw new TypeError('stack must be an object');
  }

  return stableStringify(stripRuntimeFields(stack));
}

function stackCommitment(stack) {
  return crypto
    .createHash('sha256')
    .update(canonicalizeStack(stack))
    .digest('hex');
}

module.exports = {
  stableStringify,
  canonicalizeStack,
  stackCommitment,
};
