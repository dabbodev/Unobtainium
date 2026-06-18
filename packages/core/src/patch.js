'use strict';

const crypto = require('node:crypto');

const { objectCommitment, sliceCommitment } = require('./gate');
const { rotateDown, rotateUp } = require('./ring');
const { stableStringify } = require('./stack-canonical');
const { verifySignedStackEnvelope } = require('./signed-stack');

const PATCH_FORMAT = 'UNPATCH';
const PATCH_VERSION = 1;
const PATCH_OPERATION_ADD = 'add';
const PATCH_COMMITMENT_DOMAIN = 'UNPATCH:v1';
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

function sha256Hex(parts) {
  const hash = crypto.createHash('sha256');
  parts.forEach((part) => hash.update(part));
  return hash.digest('hex');
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

function assertNullableSha256Hex(value, fieldName) {
  if (value === null) {
    return;
  }
  assertSha256Hex(value, fieldName);
}

function assertObjectId(objectId) {
  if (typeof objectId !== 'string' || objectId.length === 0) {
    throw new TypeError('objectId must be a non-empty string');
  }
}

function assertWindowSize(windowSize) {
  if (!Number.isInteger(windowSize)) {
    throw new TypeError('windowSize must be an integer');
  }
  if (windowSize <= 1) {
    throw new RangeError('windowSize must be greater than 1');
  }
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

function assertDeltas(deltas, rangeLength) {
  if (!Array.isArray(deltas)) {
    throw new TypeError('deltas must be an array');
  }
  if (rangeLength !== undefined && deltas.length !== rangeLength) {
    throw new RangeError('deltas.length must equal range.length');
  }

  return deltas.map((delta, index) => {
    if (!Number.isInteger(delta)) {
      throw new TypeError(`deltas[${index}] must be an integer`);
    }
    return delta;
  });
}

function bytesFromData(data) {
  if (Buffer.isBuffer(data)) {
    return Buffer.from(data);
  }
  if (data instanceof Uint8Array) {
    return Buffer.from(data);
  }
  if (Array.isArray(data)) {
    data.forEach((value, index) => {
      if (!Number.isInteger(value) || value < 0 || value > 255) {
        throw new TypeError(`data[${index}] must be an integer byte`);
      }
    });
    return Buffer.from(data);
  }

  throw new TypeError('data must be an Array, Buffer, or Uint8Array');
}

function outputFor(data, mutate) {
  if (Array.isArray(data)) {
    data.forEach((value, index) => {
      if (!Number.isInteger(value)) {
        throw new TypeError(`data[${index}] must be an integer`);
      }
    });
    return mutate ? data : data.slice();
  }
  if (Buffer.isBuffer(data)) {
    return mutate ? data : Buffer.from(data);
  }
  if (data instanceof Uint8Array) {
    return mutate ? data : new Uint8Array(data);
  }

  throw new TypeError('data must be an Array, Buffer, or Uint8Array');
}

function assertByteArrayValue(output, value) {
  if ((Buffer.isBuffer(output) || output instanceof Uint8Array) && (value < 0 || value > 255)) {
    throw new RangeError('patch result must fit in one byte');
  }
}

function signedStackCommitments(signedStackEnvelope) {
  if (signedStackEnvelope === undefined) {
    return {
      signedStackCommitment: null,
      signedStackPayloadCommitment: null,
    };
  }

  const signedResult = verifySignedStackEnvelope(signedStackEnvelope);
  if (!signedResult.valid) {
    throw new TypeError(`signedStackEnvelope is invalid: ${signedResult.reason}`);
  }

  return {
    signedStackCommitment: signedResult.stackCommitment,
    signedStackPayloadCommitment: signedResult.payloadCommitment,
  };
}

function patchPayload(patchLike) {
  if (patchLike === null || typeof patchLike !== 'object' || Array.isArray(patchLike)) {
    throw new TypeError('patch must be an object');
  }

  assertObjectId(patchLike.objectId);
  assertWindowSize(patchLike.windowSize);
  assertSha256Hex(patchLike.baseObjectCommitment, 'baseObjectCommitment');
  assertSha256Hex(patchLike.baseSliceCommitment, 'baseSliceCommitment');
  assertNullableSha256Hex(
    patchLike.signedStackCommitment === undefined ? null : patchLike.signedStackCommitment,
    'signedStackCommitment',
  );
  assertNullableSha256Hex(
    patchLike.signedStackPayloadCommitment === undefined ? null : patchLike.signedStackPayloadCommitment,
    'signedStackPayloadCommitment',
  );

  const range = assertRange(patchLike.range);
  const deltas = assertDeltas(patchLike.deltas, range.length);

  return {
    format: patchLike.format,
    version: patchLike.version,
    objectId: patchLike.objectId,
    operation: patchLike.operation,
    range,
    deltas,
    windowSize: patchLike.windowSize,
    baseObjectCommitment: patchLike.baseObjectCommitment,
    baseSliceCommitment: patchLike.baseSliceCommitment,
    signedStackCommitment: patchLike.signedStackCommitment === undefined ? null : patchLike.signedStackCommitment,
    signedStackPayloadCommitment: patchLike.signedStackPayloadCommitment === undefined
      ? null
      : patchLike.signedStackPayloadCommitment,
    metadata: cloneCanonicalValue(patchLike.metadata === undefined ? {} : patchLike.metadata, 'metadata'),
  };
}

function patchCommitmentForPayload(payload) {
  return sha256Hex([
    Buffer.from(PATCH_COMMITMENT_DOMAIN, 'utf8'),
    Buffer.from([0]),
    Buffer.from(stableStringify(payload), 'utf8'),
  ]);
}

function patchCommitment(patchLike) {
  return patchCommitmentForPayload(patchPayload(patchLike));
}

function createAddPatch({
  objectId,
  data,
  range,
  deltas,
  windowSize = 256,
  signedStackEnvelope,
  metadata = {},
}) {
  assertObjectId(objectId);
  assertWindowSize(windowSize);

  const bytes = bytesFromData(data);
  const normalizedRange = assertRange(range, bytes.length);
  const normalizedDeltas = assertDeltas(deltas, normalizedRange.length);
  const normalizedMetadata = cloneCanonicalValue(metadata, 'metadata');
  const signedCommitments = signedStackCommitments(signedStackEnvelope);
  const payload = {
    format: PATCH_FORMAT,
    version: PATCH_VERSION,
    objectId,
    operation: PATCH_OPERATION_ADD,
    range: normalizedRange,
    deltas: normalizedDeltas,
    windowSize,
    baseObjectCommitment: objectCommitment(bytes),
    baseSliceCommitment: sliceCommitment(bytes, normalizedRange),
    ...signedCommitments,
    metadata: normalizedMetadata,
  };

  return {
    ...payload,
    patchCommitment: patchCommitmentForPayload(payload),
  };
}

function invalid(reason) {
  return {
    valid: false,
    reason,
  };
}

function verifyPatch(patch, { data, signedStackEnvelope } = {}) {
  try {
    if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
      return invalid('patch must be an object');
    }
    if (patch.format !== PATCH_FORMAT) {
      return invalid('patch format is not UNPATCH');
    }
    if (patch.version !== PATCH_VERSION) {
      return invalid('patch version is not supported');
    }
    if (patch.operation !== PATCH_OPERATION_ADD) {
      return invalid('patch operation is not supported');
    }
    assertSha256Hex(patch.patchCommitment, 'patchCommitment');

    const payload = patchPayload(patch);
    const expectedPatchCommitment = patchCommitmentForPayload(payload);
    if (expectedPatchCommitment !== patch.patchCommitment) {
      return invalid('patchCommitment mismatch');
    }

    if (signedStackEnvelope !== undefined) {
      const signedResult = verifySignedStackEnvelope(signedStackEnvelope);
      if (!signedResult.valid) {
        return invalid(`signedStackEnvelope invalid: ${signedResult.reason}`);
      }
      if (signedResult.stackCommitment !== payload.signedStackCommitment) {
        return invalid('signedStackCommitment mismatch');
      }
      if (signedResult.payloadCommitment !== payload.signedStackPayloadCommitment) {
        return invalid('signedStackPayloadCommitment mismatch');
      }
    }

    if (data !== undefined) {
      const bytes = bytesFromData(data);
      assertRange(payload.range, bytes.length);
      const currentSliceCommitment = sliceCommitment(bytes, payload.range);
      const currentObjectCommitment = objectCommitment(bytes);
      if (currentSliceCommitment !== payload.baseSliceCommitment) {
        return invalid('baseSliceCommitment mismatch');
      }
      if (currentObjectCommitment !== payload.baseObjectCommitment) {
        return invalid('baseObjectCommitment mismatch');
      }
    }

    return {
      valid: true,
      operation: payload.operation,
      objectId: payload.objectId,
      range: {
        start: payload.range.start,
        length: payload.range.length,
      },
      patchCommitment: patch.patchCommitment,
      baseObjectCommitment: payload.baseObjectCommitment,
      baseSliceCommitment: payload.baseSliceCommitment,
      signedStackCommitment: payload.signedStackCommitment,
      signedStackPayloadCommitment: payload.signedStackPayloadCommitment,
    };
  } catch (error) {
    return invalid(error.message);
  }
}

function assertApplicablePatch(patch) {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new TypeError('patch must be an object');
  }
  if (patch.format !== PATCH_FORMAT) {
    throw new RangeError('patch format is not UNPATCH');
  }
  if (patch.version !== PATCH_VERSION) {
    throw new RangeError('patch version is not supported');
  }
  if (patch.operation !== PATCH_OPERATION_ADD) {
    throw new RangeError('patch operation is not supported');
  }
  assertSha256Hex(patch.patchCommitment, 'patchCommitment');

  const payload = patchPayload(patch);
  if (patchCommitmentForPayload(payload) !== patch.patchCommitment) {
    throw new RangeError('patchCommitment mismatch');
  }

  return payload;
}

function applyPatchWithDirection(data, patch, options, reverse) {
  const payload = assertApplicablePatch(patch);
  const output = outputFor(data, options.mutate === true);
  const range = assertRange(payload.range, output.length);

  for (let index = 0; index < range.length; index += 1) {
    const targetIndex = range.start + index;
    const delta = payload.deltas[index];
    const nextValue = reverse
      ? rotateDown(output[targetIndex], delta, payload.windowSize)
      : rotateUp(output[targetIndex], delta, payload.windowSize);

    assertByteArrayValue(output, nextValue);
    output[targetIndex] = nextValue;
  }

  return output;
}

function applyPatch(data, patch, options = {}) {
  return applyPatchWithDirection(data, patch, options, false);
}

function reversePatch(data, patch, options = {}) {
  return applyPatchWithDirection(data, patch, options, true);
}

module.exports = {
  PATCH_FORMAT,
  PATCH_VERSION,
  PATCH_OPERATION_ADD,
  createAddPatch,
  patchPayload,
  patchCommitment,
  verifyPatch,
  applyPatch,
  reversePatch,
};
