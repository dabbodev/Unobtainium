'use strict';

const crypto = require('node:crypto');

const { stableStringify } = require('./stack-canonical');

const FORMAT = 'UN-KEYFILE';
const VERSION = 1;
const DOMAIN = 'UN-KEYFILE:v1';
const DEFAULT_POINT_COUNT = 64;
const DEFAULT_SCALE = 1000000;
const DEFAULT_COORDINATE_RANGE = 1000000;
const COORDINATE_BYTES = 8;
const SOURCE_TYPES = new Set(['bytes', 'string', 'buffer', 'uint8array', 'array']);

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function assertPositiveInteger(name, value) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

function normalizedOptions(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('options must be an object');
  }

  const pointCount = options.pointCount === undefined ? DEFAULT_POINT_COUNT : options.pointCount;
  const scale = options.scale === undefined ? DEFAULT_SCALE : options.scale;
  const coordinateRange = options.coordinateRange === undefined
    ? DEFAULT_COORDINATE_RANGE
    : options.coordinateRange;

  assertPositiveInteger('pointCount', pointCount);
  assertPositiveInteger('scale', scale);
  assertPositiveInteger('coordinateRange', coordinateRange);

  if (options.label !== undefined && options.label !== null && typeof options.label !== 'string') {
    throw new TypeError('label must be a string when supplied');
  }

  if (options.sourceType !== undefined) {
    if (typeof options.sourceType !== 'string' || !SOURCE_TYPES.has(options.sourceType)) {
      throw new RangeError('sourceType must be "bytes", "string", "buffer", "uint8array", or "array"');
    }
  }

  return {
    pointCount,
    scale,
    coordinateRange,
    passphrase: options.passphrase,
    context: options.context,
    salt: options.salt,
    label: options.label === undefined ? null : options.label,
    sourceType: options.sourceType,
  };
}

function normalizeArrayBytes(input) {
  const bytes = Buffer.alloc(input.length);

  for (let index = 0; index < input.length; index += 1) {
    const value = input[index];
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new RangeError(`input byte ${index} must be an integer in 0..255`);
    }
    bytes[index] = value;
  }

  return bytes;
}

function normalizeKeyfileInput(input, options = {}) {
  void options;

  if (Buffer.isBuffer(input)) {
    return {
      bytes: Buffer.from(input),
      sourceType: 'buffer',
    };
  }

  if (input instanceof Uint8Array) {
    return {
      bytes: Buffer.from(input),
      sourceType: 'uint8array',
    };
  }

  if (Array.isArray(input)) {
    return {
      bytes: normalizeArrayBytes(input),
      sourceType: 'array',
    };
  }

  if (typeof input === 'string') {
    return {
      bytes: Buffer.from(input, 'utf8'),
      sourceType: 'string',
    };
  }

  throw new TypeError('input must be a Buffer, Uint8Array, Array of bytes, or string');
}

function bytesForCanonicalValue(name, value) {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return Buffer.from(stableStringify({
      type: 'bytes',
      hex: Buffer.from(value).toString('hex'),
    }), 'utf8');
  }

  try {
    return Buffer.from(stableStringify(value), 'utf8');
  } catch (error) {
    error.message = `${name} must be deterministic canonical material: ${error.message}`;
    throw error;
  }
}

function optionCommitment(name, value) {
  if (value === undefined) {
    return null;
  }

  return sha256Hex(Buffer.concat([
    Buffer.from(`${DOMAIN}:${name}`, 'utf8'),
    Buffer.from([0]),
    bytesForCanonicalValue(name, value),
  ]));
}

function derivationSeed(normalizedInput, options) {
  const optionMaterial = {
    coordinateRange: options.coordinateRange,
    contextCommitment: optionCommitment('context', options.context),
    labelCommitment: optionCommitment('label', options.label),
    passphraseCommitment: optionCommitment('passphrase', options.passphrase),
    pointCount: options.pointCount,
    saltCommitment: optionCommitment('salt', options.salt),
    scale: options.scale,
  };

  const hash = crypto.createHash('sha256');
  hash.update(DOMAIN);
  hash.update(Buffer.from([0]));
  hash.update(stableStringify(optionMaterial));
  hash.update(Buffer.from([0]));
  hash.update(normalizedInput.bytes);
  hash.update(Buffer.from([0]));

  for (const name of ['passphrase', 'context', 'salt', 'label']) {
    if (options[name] !== undefined) {
      hash.update(name);
      hash.update(Buffer.from([0]));
      hash.update(bytesForCanonicalValue(name, options[name]));
      hash.update(Buffer.from([0]));
    }
  }

  return hash.digest();
}

function expandBytes(seed, byteCount) {
  const chunks = [];
  let produced = 0;
  let counter = 0;

  while (produced < byteCount) {
    const counterBuffer = Buffer.allocUnsafe(4);
    counterBuffer.writeUInt32BE(counter, 0);
    const chunk = crypto
      .createHash('sha256')
      .update(`${DOMAIN}:expand`)
      .update(Buffer.from([0]))
      .update(seed)
      .update(counterBuffer)
      .digest();

    chunks.push(chunk);
    produced += chunk.length;
    counter += 1;
  }

  return Buffer.concat(chunks, produced).subarray(0, byteCount);
}

function coordinatesFromBytes(bytes, pointCount, coordinateRange) {
  const points = [];
  const range = BigInt(coordinateRange);
  let offset = 0;

  for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
    const point = [];
    for (let coordinateIndex = 0; coordinateIndex < 3; coordinateIndex += 1) {
      const raw = bytes.readBigUInt64BE(offset);
      point.push(Number(raw % range));
      offset += COORDINATE_BYTES;
    }
    points.push(point);
  }

  return points;
}

function deriveKeyMeshFromBytes(input, options = {}) {
  const normalizedInput = normalizeKeyfileInput(input);
  const keyfileOptions = normalizedOptions(options);
  const byteCount = keyfileOptions.pointCount * 3 * COORDINATE_BYTES;
  const expanded = expandBytes(derivationSeed(normalizedInput, keyfileOptions), byteCount);

  return coordinatesFromBytes(
    expanded,
    keyfileOptions.pointCount,
    keyfileOptions.coordinateRange,
  );
}

function deriveKeyMeshFromString(input, options = {}) {
  if (typeof input !== 'string') {
    throw new TypeError('input must be a string');
  }

  return deriveKeyMeshFromBytes(Buffer.from(input, 'utf8'), options);
}

function descriptorCommitmentPayload(keyMeshDescriptor) {
  if (
    keyMeshDescriptor === null
    || typeof keyMeshDescriptor !== 'object'
    || Array.isArray(keyMeshDescriptor)
  ) {
    throw new TypeError('keyMeshDescriptor must be an object');
  }

  const payload = {};
  for (const key of Object.keys(keyMeshDescriptor)) {
    if (key !== 'meshCommitment') {
      payload[key] = keyMeshDescriptor[key];
    }
  }

  return payload;
}

function keyMeshCommitment(keyMeshDescriptor) {
  return sha256Hex(Buffer.from(stableStringify(descriptorCommitmentPayload(keyMeshDescriptor)), 'utf8'));
}

function createKeyfileDescriptor(input, options = {}) {
  const normalizedInput = normalizeKeyfileInput(input);
  const keyfileOptions = normalizedOptions(options);
  const sourceType = keyfileOptions.sourceType || normalizedInput.sourceType;
  const points = deriveKeyMeshFromBytes(normalizedInput.bytes, keyfileOptions);
  const descriptor = {
    format: FORMAT,
    version: VERSION,
    pointCount: keyfileOptions.pointCount,
    scale: keyfileOptions.scale,
    coordinateRange: keyfileOptions.coordinateRange,
    sourceType,
    label: keyfileOptions.label,
    contextCommitment: optionCommitment('context', keyfileOptions.context),
    saltCommitment: optionCommitment('salt', keyfileOptions.salt),
    passphraseCommitment: optionCommitment('passphrase', keyfileOptions.passphrase),
    inputCommitment: sha256Hex(normalizedInput.bytes),
    points,
  };

  return {
    ...descriptor,
    meshCommitment: keyMeshCommitment(descriptor),
  };
}

module.exports = {
  normalizeKeyfileInput,
  deriveKeyMeshFromBytes,
  deriveKeyMeshFromString,
  keyMeshCommitment,
  createKeyfileDescriptor,
};
