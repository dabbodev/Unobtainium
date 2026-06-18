'use strict';

const crypto = require('node:crypto');

const { stableStringify } = require('./stack-canonical');
const { verifySignedStackEnvelope } = require('./signed-stack');

const GATE_FORMAT = 'UN-GATE';
const GATE_VERSION = 1;
const GATE_PERMISSION_VALIDATE = 'validate';
const OBJECT_COMMITMENT_DOMAIN = 'UNOBJ-COMMITMENT:v1';
const SLICE_COMMITMENT_DOMAIN = 'UNSLICE-COMMITMENT:v1';
const GATE_COMMITMENT_DOMAIN = 'UNGATE-COMMITMENT:v1';
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

function sha256Hex(parts) {
  const hash = crypto.createHash('sha256');
  parts.forEach((part) => hash.update(part));
  return hash.digest('hex');
}

function assertByte(value, index) {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new TypeError(`data[${index}] must be an integer byte`);
  }
}

function bytesFromData(data) {
  if (Buffer.isBuffer(data)) {
    return Buffer.from(data);
  }
  if (data instanceof Uint8Array) {
    return Buffer.from(data);
  }
  if (Array.isArray(data)) {
    data.forEach(assertByte);
    return Buffer.from(data);
  }

  throw new TypeError('data must be an Array, Buffer, or Uint8Array');
}

function assertRange(range, dataLength) {
  if (range === null || typeof range !== 'object' || Array.isArray(range)) {
    throw new TypeError('range must be an object');
  }
  if (!Number.isInteger(range.start)) {
    throw new TypeError('range.start must be an integer');
  }
  if (range.start < 0) {
    throw new RangeError('range.start must be a non-negative integer');
  }
  if (!Number.isInteger(range.length)) {
    throw new TypeError('range.length must be an integer');
  }
  if (range.length <= 0) {
    throw new RangeError('range.length must be a positive integer');
  }
  if (dataLength !== undefined && range.start + range.length > dataLength) {
    throw new RangeError('range must be within data length');
  }

  return {
    start: range.start,
    length: range.length,
  };
}

function cloneCanonicalValue(value, fieldName) {
  try {
    return JSON.parse(stableStringify(value));
  } catch (error) {
    error.message = `${fieldName} must be canonical plain data: ${error.message}`;
    throw error;
  }
}

function assertSha256Hex(value, fieldName) {
  if (typeof value !== 'string' || !SHA256_HEX_PATTERN.test(value)) {
    throw new TypeError(`${fieldName} must be a SHA-256 hex string`);
  }
}

function objectCommitment(data, options = {}) {
  void options;
  const bytes = bytesFromData(data);
  const header = stableStringify({
    domain: OBJECT_COMMITMENT_DOMAIN,
    length: bytes.length,
  });

  return sha256Hex([Buffer.from(header, 'utf8'), Buffer.from([0]), bytes]);
}

function sliceCommitment(data, range, options = {}) {
  void options;
  const bytes = bytesFromData(data);
  const normalizedRange = assertRange(range, bytes.length);
  const slice = bytes.subarray(
    normalizedRange.start,
    normalizedRange.start + normalizedRange.length,
  );
  const header = stableStringify({
    domain: SLICE_COMMITMENT_DOMAIN,
    objectLength: bytes.length,
    range: normalizedRange,
  });

  return sha256Hex([Buffer.from(header, 'utf8'), Buffer.from([0]), slice]);
}

function gatePayload(gateLike) {
  if (gateLike === null || typeof gateLike !== 'object' || Array.isArray(gateLike)) {
    throw new TypeError('gate must be an object');
  }

  assertSha256Hex(gateLike.objectCommitment, 'objectCommitment');
  assertSha256Hex(gateLike.sliceCommitment, 'sliceCommitment');
  assertSha256Hex(gateLike.signedStackCommitment, 'signedStackCommitment');
  assertSha256Hex(gateLike.signedStackPayloadCommitment, 'signedStackPayloadCommitment');

  return {
    format: gateLike.format,
    version: gateLike.version,
    permission: gateLike.permission,
    objectId: gateLike.objectId,
    range: assertRange(gateLike.range),
    objectCommitment: gateLike.objectCommitment,
    sliceCommitment: gateLike.sliceCommitment,
    signedStackCommitment: gateLike.signedStackCommitment,
    signedStackPayloadCommitment: gateLike.signedStackPayloadCommitment,
    metadata: cloneCanonicalValue(gateLike.metadata === undefined ? {} : gateLike.metadata, 'metadata'),
  };
}

function gateCommitmentForPayload(payload) {
  return sha256Hex([
    Buffer.from(GATE_COMMITMENT_DOMAIN, 'utf8'),
    Buffer.from([0]),
    Buffer.from(stableStringify(payload), 'utf8'),
  ]);
}

function signedStackCommitments(signedStackEnvelope) {
  const signedResult = verifySignedStackEnvelope(signedStackEnvelope);
  if (!signedResult.valid) {
    throw new TypeError(`signedStackEnvelope is invalid: ${signedResult.reason}`);
  }

  return {
    signedStackCommitment: signedResult.stackCommitment,
    signedStackPayloadCommitment: signedResult.payloadCommitment,
  };
}

function createValidationGate({
  objectId,
  data,
  range,
  signedStackEnvelope,
  metadata = {},
}) {
  if (typeof objectId !== 'string' || objectId.length === 0) {
    throw new TypeError('objectId must be a non-empty string');
  }

  const bytes = bytesFromData(data);
  const normalizedRange = assertRange(range, bytes.length);
  const normalizedMetadata = cloneCanonicalValue(metadata, 'metadata');
  const signedCommitments = signedStackCommitments(signedStackEnvelope);
  const payload = {
    format: GATE_FORMAT,
    version: GATE_VERSION,
    permission: GATE_PERMISSION_VALIDATE,
    objectId,
    range: normalizedRange,
    objectCommitment: objectCommitment(bytes),
    sliceCommitment: sliceCommitment(bytes, normalizedRange),
    ...signedCommitments,
    metadata: normalizedMetadata,
  };

  return {
    ...payload,
    gateCommitment: gateCommitmentForPayload(payload),
  };
}

function invalid(reason) {
  return {
    valid: false,
    reason,
  };
}

function verifyValidationGate(gate, { data, signedStackEnvelope } = {}) {
  try {
    if (gate === null || typeof gate !== 'object' || Array.isArray(gate)) {
      return invalid('gate must be an object');
    }
    if (gate.format !== GATE_FORMAT) {
      return invalid('gate format is not UN-GATE');
    }
    if (gate.version !== GATE_VERSION) {
      return invalid('gate version is not supported');
    }
    if (gate.permission !== GATE_PERMISSION_VALIDATE) {
      return invalid('gate permission is not supported');
    }
    if (typeof gate.objectId !== 'string' || gate.objectId.length === 0) {
      return invalid('gate objectId must be a non-empty string');
    }
    assertSha256Hex(gate.gateCommitment, 'gateCommitment');

    const payload = gatePayload(gate);
    const expectedGateCommitment = gateCommitmentForPayload(payload);
    if (expectedGateCommitment !== gate.gateCommitment) {
      return invalid('gateCommitment mismatch');
    }

    if (signedStackEnvelope !== undefined) {
      const signedResult = verifySignedStackEnvelope(signedStackEnvelope);
      if (!signedResult.valid) {
        return invalid(`signedStackEnvelope invalid: ${signedResult.reason}`);
      }
      if (signedResult.stackCommitment !== gate.signedStackCommitment) {
        return invalid('signedStackCommitment mismatch');
      }
      if (signedResult.payloadCommitment !== gate.signedStackPayloadCommitment) {
        return invalid('signedStackPayloadCommitment mismatch');
      }
    }

    if (data !== undefined) {
      const bytes = bytesFromData(data);
      const currentSliceCommitment = sliceCommitment(bytes, payload.range);
      const currentObjectCommitment = objectCommitment(bytes);
      if (currentSliceCommitment !== gate.sliceCommitment) {
        return invalid('sliceCommitment mismatch');
      }
      if (currentObjectCommitment !== gate.objectCommitment) {
        return invalid('objectCommitment mismatch');
      }
    }

    return {
      valid: true,
      permission: gate.permission,
      objectId: gate.objectId,
      range: {
        start: payload.range.start,
        length: payload.range.length,
      },
      gateCommitment: gate.gateCommitment,
      objectCommitment: gate.objectCommitment,
      sliceCommitment: gate.sliceCommitment,
      signedStackCommitment: gate.signedStackCommitment,
      signedStackPayloadCommitment: gate.signedStackPayloadCommitment,
    };
  } catch (error) {
    return invalid(error.message);
  }
}

module.exports = {
  GATE_FORMAT,
  GATE_VERSION,
  objectCommitment,
  sliceCommitment,
  createValidationGate,
  verifyValidationGate,
  gatePayload,
};
