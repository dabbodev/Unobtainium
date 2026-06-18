'use strict';

const crypto = require('node:crypto');

const DEFAULT_POINT_COUNT = 8;
const DEFAULT_SCALE = 1000000;
const DEFAULT_COORDINATE_RANGE = 1000000;
const COORDINATE_BYTES = 8;
const PACKET_TYPES = new Set([
  'UNPKT-CONTEXT',
  'UNPKT-NONCE',
  'UNPKT-RANDOM',
]);

function assertPositiveInteger(name, value) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
}

function assertHexSha256(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
    throw new TypeError('packet.commitment must be a hex sha256 string');
  }
}

function stableStringify(value) {
  const seen = new Set();

  function stringify(item) {
    if (item === null) {
      return 'null';
    }

    if (Array.isArray(item)) {
      return `[${item.map(stringify).join(',')}]`;
    }

    if (Buffer.isBuffer(item) || item instanceof Uint8Array) {
      return stringify({
        type: 'bytes',
        hex: Buffer.from(item).toString('hex'),
      });
    }

    const valueType = typeof item;
    if (valueType === 'string') {
      return JSON.stringify(item);
    }
    if (valueType === 'number') {
      if (!Number.isFinite(item)) {
        throw new TypeError('canonical values must be finite');
      }
      return JSON.stringify(item);
    }
    if (valueType === 'boolean') {
      return item ? 'true' : 'false';
    }
    if (valueType === 'object') {
      if (seen.has(item)) {
        throw new TypeError('canonical values must not contain cycles');
      }

      seen.add(item);
      const keys = Object.keys(item).sort();
      const serialized = keys.map((key) => {
        const entry = item[key];
        const entryType = typeof entry;
        if (entry === undefined || entryType === 'function' || entryType === 'symbol') {
          throw new TypeError('canonical values must not contain unsupported fields');
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

function sourceBytesForContext(context) {
  if (context === undefined || context === null) {
    throw new TypeError('context is required');
  }
  if (typeof context === 'function' || typeof context === 'symbol') {
    throw new TypeError('context must be deterministic material');
  }

  return Buffer.from(stableStringify({ context }), 'utf8');
}

function sourceBytesForNonce(nonce) {
  if (typeof nonce === 'string') {
    return Buffer.from(nonce, 'utf8');
  }
  if (Buffer.isBuffer(nonce) || nonce instanceof Uint8Array) {
    return Buffer.from(nonce);
  }

  throw new TypeError('nonce must be a string, Buffer, or Uint8Array');
}

function randomSourceBytes(randomBytes) {
  if (randomBytes === undefined) {
    return crypto.randomBytes(32);
  }
  if (typeof randomBytes !== 'function') {
    throw new TypeError('randomBytes must be a function');
  }

  const bytes = randomBytes(32);
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) {
    throw new TypeError('randomBytes must return a Buffer or Uint8Array');
  }
  if (bytes.length < 32) {
    throw new RangeError('randomBytes must return at least the requested byte count');
  }

  return Buffer.from(bytes).subarray(0, 32);
}

function expandBytes(domain, source, byteCount) {
  const chunks = [];
  let produced = 0;
  let counter = 0;

  while (produced < byteCount) {
    const counterBuffer = Buffer.allocUnsafe(4);
    counterBuffer.writeUInt32BE(counter, 0);
    const chunk = crypto
      .createHash('sha256')
      .update(domain)
      .update(Buffer.from([0]))
      .update(source)
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

function commitmentFields(packet) {
  return {
    coordinateRange: packet.coordinateRange,
    pointCount: packet.pointCount,
    points: packet.points,
    scale: packet.scale,
    type: packet.type,
    version: packet.version,
  };
}

function commitmentFor(packet) {
  return crypto
    .createHash('sha256')
    .update(stableStringify(commitmentFields(packet)))
    .digest('hex');
}

function createPacket(type, domain, source, options) {
  const pointCount = options.pointCount === undefined ? DEFAULT_POINT_COUNT : options.pointCount;
  const scale = options.scale === undefined ? DEFAULT_SCALE : options.scale;
  const coordinateRange = options.coordinateRange === undefined
    ? DEFAULT_COORDINATE_RANGE
    : options.coordinateRange;

  assertPositiveInteger('pointCount', pointCount);
  assertPositiveInteger('scale', scale);
  assertPositiveInteger('coordinateRange', coordinateRange);

  const byteCount = pointCount * 3 * COORDINATE_BYTES;
  const bytes = expandBytes(domain, source, byteCount);
  const packet = {
    type,
    version: 1,
    pointCount,
    scale,
    coordinateRange,
    points: coordinatesFromBytes(bytes, pointCount, coordinateRange),
  };

  return {
    ...packet,
    commitment: commitmentFor(packet),
  };
}

function assertPacketPoint(point, pointIndex, coordinateRange) {
  if (!Array.isArray(point) || point.length !== 3) {
    throw new TypeError(`packet.points[${pointIndex}] must be a [x, y, z] array`);
  }

  point.forEach((coordinate, coordinateIndex) => {
    if (!Number.isSafeInteger(coordinate)) {
      throw new TypeError(`packet.points[${pointIndex}][${coordinateIndex}] must be a safe integer`);
    }
    if (coordinate < 0 || coordinate >= coordinateRange) {
      throw new RangeError(`packet.points[${pointIndex}][${coordinateIndex}] is out of range`);
    }
  });
}

function assertPointPacket(packet) {
  if (packet === null || typeof packet !== 'object' || Array.isArray(packet)) {
    throw new TypeError('packet must be an object');
  }
  if (!PACKET_TYPES.has(packet.type)) {
    throw new RangeError('packet.type is not a supported UNPKT point packet type');
  }
  if (packet.version !== 1) {
    throw new RangeError('packet.version must be 1');
  }

  assertPositiveInteger('packet.pointCount', packet.pointCount);
  assertPositiveInteger('packet.scale', packet.scale);
  assertPositiveInteger('packet.coordinateRange', packet.coordinateRange);
  assertHexSha256(packet.commitment);

  if (!Array.isArray(packet.points) || packet.points.length !== packet.pointCount) {
    throw new TypeError('packet.points must match packet.pointCount');
  }
  packet.points.forEach((point, pointIndex) => {
    assertPacketPoint(point, pointIndex, packet.coordinateRange);
  });

  if (commitmentFor(packet) !== packet.commitment) {
    throw new Error('packet.commitment does not match packet fields');
  }
}

function createContextPacket({
  context,
  pointCount = DEFAULT_POINT_COUNT,
  scale = DEFAULT_SCALE,
  coordinateRange = DEFAULT_COORDINATE_RANGE,
}) {
  return createPacket(
    'UNPKT-CONTEXT',
    'UNPKT-CONTEXT:v1',
    sourceBytesForContext(context),
    { pointCount, scale, coordinateRange },
  );
}

function createNoncePacket({
  nonce,
  pointCount = DEFAULT_POINT_COUNT,
  scale = DEFAULT_SCALE,
  coordinateRange = DEFAULT_COORDINATE_RANGE,
}) {
  return createPacket(
    'UNPKT-NONCE',
    'UNPKT-NONCE:v1',
    sourceBytesForNonce(nonce),
    { pointCount, scale, coordinateRange },
  );
}

function createRandomPacket({
  pointCount = DEFAULT_POINT_COUNT,
  scale = DEFAULT_SCALE,
  coordinateRange = DEFAULT_COORDINATE_RANGE,
  randomBytes,
} = {}) {
  return createPacket(
    'UNPKT-RANDOM',
    'UNPKT-RANDOM:v1',
    randomSourceBytes(randomBytes),
    { pointCount, scale, coordinateRange },
  );
}

function readAnchorValue(bytes, offset, modulo) {
  return Number(bytes.readBigUInt64BE(offset) % BigInt(modulo));
}

function deriveAnchoredStateFromPacket(packet, pointCount) {
  assertPointPacket(packet);
  assertPositiveInteger('pointCount', pointCount);

  const digest = crypto
    .createHash('sha256')
    .update('UNPKT-ANCHOR:v1')
    .update(Buffer.from([0]))
    .update(packet.commitment)
    .digest();

  return {
    point: readAnchorValue(digest, 0, pointCount),
    shift: readAnchorValue(digest, 8, pointCount),
    gap: readAnchorValue(digest, 16, pointCount),
  };
}

module.exports = {
  createContextPacket,
  createNoncePacket,
  createRandomPacket,
  deriveAnchoredStateFromPacket,
};
