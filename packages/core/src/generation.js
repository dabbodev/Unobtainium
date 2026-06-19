'use strict';

const { applyStack, normalizeStack } = require('./stack');
const { normalizeTurns } = require('./ring');

const DATA_TYPES = new Set(['array', 'uint8array', 'buffer']);

function assertWindowSize(windowSize) {
  if (!Number.isInteger(windowSize)) {
    throw new TypeError('windowSize must be an integer');
  }
  if (windowSize <= 1) {
    throw new RangeError('windowSize must be greater than 1');
  }
}

function assertLength(length) {
  if (!Number.isInteger(length)) {
    throw new TypeError('length must be an integer');
  }
  if (length < 0) {
    throw new RangeError('length must be a non-negative integer');
  }
}

function assertDataType(type) {
  if (!DATA_TYPES.has(type)) {
    throw new RangeError('type must be "array", "uint8array", or "buffer"');
  }
}

function assertInteger(name, value) {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${name} must be an integer`);
  }
}

function assertByteRepresentable(type, value) {
  if ((type === 'uint8array' || type === 'buffer') && (value < 0 || value > 255)) {
    throw new RangeError(`${type} value must fit in one byte`);
  }
}

function createOutput(type, values) {
  if (type === 'array') {
    return values;
  }
  if (type === 'uint8array') {
    return new Uint8Array(values);
  }
  if (type === 'buffer') {
    return Buffer.from(values);
  }

  throw new RangeError('type must be "array", "uint8array", or "buffer"');
}

function dataTypeFor(data, fieldName = 'data') {
  if (Array.isArray(data)) {
    return 'array';
  }
  if (Buffer.isBuffer(data)) {
    return 'buffer';
  }
  if (data instanceof Uint8Array) {
    return 'uint8array';
  }

  throw new TypeError(`${fieldName} must be an Array, Uint8Array, or Buffer`);
}

function assertRingValue(fieldName, value, index, windowSize) {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${fieldName}[${index}] must be an integer`);
  }
  if (value < 0 || value >= windowSize) {
    throw new RangeError(`${fieldName}[${index}] must be in 0..windowSize-1`);
  }
}

function normalizeGenerationData(data, windowSize = 256, fieldName = 'data') {
  assertWindowSize(windowSize);

  const type = dataTypeFor(data, fieldName);
  const values = [];

  for (let index = 0; index < data.length; index += 1) {
    const value = data[index];
    assertRingValue(fieldName, value, index, windowSize);
    values.push(value);
  }

  return {
    type,
    length: values.length,
    values,
  };
}

function normalizeResidual(residual, windowSize) {
  assertWindowSize(windowSize);
  dataTypeFor(residual, 'residual');

  const values = [];
  for (let index = 0; index < residual.length; index += 1) {
    const value = residual[index];
    assertInteger(`residual[${index}]`, value);
    values.push(normalizeTurns(value, windowSize));
  }

  return values;
}

function createBlankData(options) {
  const {
    length,
    windowSize = 256,
    type = 'array',
    fill = 0,
  } = options || {};

  assertLength(length);
  assertWindowSize(windowSize);
  assertDataType(type);
  assertInteger('fill', fill);

  const normalizedFill = normalizeTurns(fill, windowSize);
  assertByteRepresentable(type, normalizedFill);

  const values = new Array(length).fill(normalizedFill);
  return createOutput(type, values);
}

function effectiveWindowSizeForStack(options) {
  const suppliedWindowSize = Object.hasOwn(options, 'windowSize');
  const { stack } = options;
  const stackWindowSize = stack && stack.windowSize;
  const windowSize = stackWindowSize === undefined ? (options.windowSize ?? 256) : stackWindowSize;

  assertWindowSize(windowSize);

  if (suppliedWindowSize && stackWindowSize !== undefined && options.windowSize !== stackWindowSize) {
    throw new RangeError('windowSize must match stack.windowSize');
  }

  return windowSize;
}

function generateFromStack(options) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('options must be an object');
  }

  const {
    length,
    stack,
    type = 'array',
    fill = 0,
  } = options;
  const windowSize = effectiveWindowSizeForStack(options);
  const blank = createBlankData({ length, windowSize, type, fill });

  if (length === 0) {
    normalizeStack(stack);
    return blank;
  }

  return applyStack(blank, stack);
}

function assertSameLength(left, right, leftName, rightName) {
  if (left.length !== right.length) {
    throw new RangeError(`${leftName} and ${rightName} must have the same length`);
  }
}

function residualBetween({ target, generated, windowSize = 256 }) {
  assertWindowSize(windowSize);

  const targetData = normalizeGenerationData(target, windowSize, 'target');
  const generatedData = normalizeGenerationData(generated, windowSize, 'generated');
  assertSameLength(targetData, generatedData, 'target', 'generated');

  return targetData.values.map((targetValue, index) => (
    normalizeTurns(targetValue - generatedData.values[index], windowSize)
  ));
}

function outputForGenerated(generated, mutate) {
  const type = dataTypeFor(generated, 'generated');
  if (type === 'array') {
    return mutate ? generated : generated.slice();
  }
  if (type === 'buffer') {
    return mutate ? generated : Buffer.from(generated);
  }

  return mutate ? generated : new Uint8Array(generated);
}

function applyResidual({
  generated,
  residual,
  windowSize = 256,
  mutate = false,
}) {
  assertWindowSize(windowSize);

  const generatedData = normalizeGenerationData(generated, windowSize, 'generated');
  const residualValues = normalizeResidual(residual, windowSize);
  assertSameLength(generatedData, residualValues, 'generated', 'residual');

  const output = outputForGenerated(generated, mutate === true);
  for (let index = 0; index < output.length; index += 1) {
    const nextValue = normalizeTurns(generatedData.values[index] + residualValues[index], windowSize);
    assertByteRepresentable(generatedData.type, nextValue);
    output[index] = nextValue;
  }

  return output;
}

function reverseResidual({ target, generated, windowSize = 256 }) {
  return residualBetween({ target, generated, windowSize });
}

module.exports = {
  createBlankData,
  generateFromStack,
  residualBetween,
  applyResidual,
  reverseResidual,
  normalizeGenerationData,
};
