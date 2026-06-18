'use strict';

const crypto = require('node:crypto');

const PACKET_TYPES = new Set([
  'UNPKT-CONTEXT',
  'UNPKT-NONCE',
  'UNPKT-RANDOM',
]);
const GRAFT_MODES = new Set(['append', 'prepend', 'sandwich', 'none']);

function stableStringify(value) {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const valueType = typeof value;
  if (valueType === 'string') {
    return JSON.stringify(value);
  }
  if (valueType === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('canonical values must be finite');
    }
    return JSON.stringify(value);
  }
  if (valueType === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (valueType === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }

  throw new TypeError('canonical value type is unsupported');
}

function commitmentFor(packet) {
  return crypto
    .createHash('sha256')
    .update(stableStringify({
      coordinateRange: packet.coordinateRange,
      pointCount: packet.pointCount,
      points: packet.points,
      scale: packet.scale,
      type: packet.type,
      version: packet.version,
    }))
    .digest('hex');
}

function assertPositiveInteger(name, value) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
}

function cloneMeshPoint(point, pointIndex, owner) {
  if (!Array.isArray(point) || point.length !== 3) {
    throw new TypeError(`${owner} point ${pointIndex} must be a [x, y, z] array`);
  }

  point.forEach((coordinate, coordinateIndex) => {
    if (typeof coordinate !== 'number' || !Number.isFinite(coordinate)) {
      throw new TypeError(`${owner} point ${pointIndex}[${coordinateIndex}] must be finite`);
    }
  });

  return point.slice();
}

function cloneBaseMesh(baseMesh) {
  if (!Array.isArray(baseMesh)) {
    throw new TypeError('baseMesh must be an array of points');
  }

  return baseMesh.map((point, pointIndex) => cloneMeshPoint(point, pointIndex, 'baseMesh'));
}

function clonePacketPoints(packet) {
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

  if (typeof packet.commitment !== 'string' || !/^[0-9a-f]{64}$/.test(packet.commitment)) {
    throw new TypeError('packet.commitment must be a hex sha256 string');
  }
  if (!Array.isArray(packet.points) || packet.points.length !== packet.pointCount) {
    throw new TypeError('packet.points must match packet.pointCount');
  }

  const points = packet.points.map((point, pointIndex) => {
    const cloned = cloneMeshPoint(point, pointIndex, 'packet');
    cloned.forEach((coordinate, coordinateIndex) => {
      if (!Number.isSafeInteger(coordinate)) {
        throw new TypeError(`packet point ${pointIndex}[${coordinateIndex}] must be a safe integer`);
      }
      if (coordinate < 0 || coordinate >= packet.coordinateRange) {
        throw new RangeError(`packet point ${pointIndex}[${coordinateIndex}] is out of range`);
      }
    });
    return cloned;
  });

  if (commitmentFor(packet) !== packet.commitment) {
    throw new Error('packet.commitment does not match packet fields');
  }

  return points;
}

function assertMode(mode) {
  if (!GRAFT_MODES.has(mode)) {
    throw new RangeError('mode must be "append", "prepend", "sandwich", or "none"');
  }
}

function applyPacketGraft(baseMesh, packet, mode = 'append') {
  assertMode(mode);

  const basePoints = cloneBaseMesh(baseMesh);
  if (mode === 'none') {
    return basePoints;
  }

  const packetPoints = clonePacketPoints(packet);
  if (mode === 'append') {
    return basePoints.concat(packetPoints);
  }
  if (mode === 'prepend') {
    return packetPoints.concat(basePoints);
  }

  const splitIndex = Math.ceil(packetPoints.length / 2);
  return packetPoints
    .slice(0, splitIndex)
    .concat(basePoints, packetPoints.slice(splitIndex));
}

module.exports = {
  applyPacketGraft,
};
