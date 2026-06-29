'use strict';

const crypto = require('node:crypto');

const { stableStringify } = require('./stack-canonical');
const {
  normalizeTriadPoint,
  createTriadInstructionStreamFromWalk,
} = require('./triad-mix');

const GWM_V2_FORMAT = 'UN-GWM-V2-DESCRIPTOR';
const GWM_V2_VERSION = 1;
const GWM_V2_MODE = 'UN-GWM-V2';
const GWM_V2_COMMITMENT_DOMAIN = 'UN-GWM-V2-DESCRIPTOR:v1';
const GWM_V2_SOURCE_POINT_FORMAT = 'UN-GWM-V2-SOURCE-POINTS';
const GWM_V2_SOURCE_POINT_VERSION = 1;
const GWM_V2_SOURCE_POINT_COMMITMENT_DOMAIN = 'UN-GWM-V2-SOURCE-POINTS:v1';
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;
const DESCRIPTOR_FIELDS = [
  'format',
  'version',
  'mode',
  'sourcePointCommitment',
  'walkOptions',
  'triadStreamCommitment',
  'adapterPlanCommitment',
  'transformProofCommitment',
  'context',
  'metadata',
];
const WALK_OPTION_FIELDS = ['point', 'shift', 'gap', 'horizon', 'ring'];
const REQUIRED_WALK_OPTION_FIELDS = ['point', 'shift', 'gap'];

function assertObject(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function assertOwnField(value, fieldName) {
  if (!Object.hasOwn(value, fieldName)) {
    throw new TypeError(`${fieldName} is required`);
  }
}

function assertSupportedFieldNames(value, allowedFields, name) {
  for (const fieldName of Object.keys(value)) {
    if (!allowedFields.includes(fieldName)) {
      throw new TypeError(`${name}.${fieldName} is not supported`);
    }
  }
}

function assertSha256Hex(value, fieldName) {
  if (typeof value !== 'string' || !SHA256_HEX_PATTERN.test(value)) {
    throw new TypeError(`${fieldName} must be a SHA-256 hex commitment`);
  }
}

function assertSha256HexOrNull(value, fieldName) {
  if (value === null) {
    return;
  }
  assertSha256Hex(value, fieldName);
}

function normalizeSafeNonNegativeInteger(value, fieldName) {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${fieldName} must be a safe integer`);
  }
  if (value < 0) {
    throw new RangeError(`${fieldName} must be a non-negative safe integer`);
  }

  return Object.is(value, -0) ? 0 : value;
}

function normalizePositiveSafeInteger(value, fieldName) {
  const normalized = normalizeSafeNonNegativeInteger(value, fieldName);
  if (normalized <= 0) {
    throw new RangeError(`${fieldName} must be a positive safe integer`);
  }

  return normalized;
}

function cloneCanonicalValue(value, fieldName) {
  try {
    return JSON.parse(stableStringify(value));
  } catch (error) {
    error.message = `${fieldName} must be canonical plain data: ${error.message}`;
    throw error;
  }
}

function normalizeWalkOptions(walkOptionsLike) {
  assertObject(walkOptionsLike, 'walkOptions');
  assertSupportedFieldNames(walkOptionsLike, WALK_OPTION_FIELDS, 'walkOptions');

  for (const fieldName of REQUIRED_WALK_OPTION_FIELDS) {
    assertOwnField(walkOptionsLike, fieldName);
  }

  const walkOptions = {
    point: normalizeSafeNonNegativeInteger(walkOptionsLike.point, 'walkOptions.point'),
    shift: normalizeSafeNonNegativeInteger(walkOptionsLike.shift, 'walkOptions.shift'),
    gap: normalizeSafeNonNegativeInteger(walkOptionsLike.gap, 'walkOptions.gap'),
  };

  if (Object.hasOwn(walkOptionsLike, 'horizon')) {
    walkOptions.horizon = normalizePositiveSafeInteger(
      walkOptionsLike.horizon,
      'walkOptions.horizon'
    );
  }

  if (Object.hasOwn(walkOptionsLike, 'ring')) {
    walkOptions.ring = normalizePositiveSafeInteger(walkOptionsLike.ring, 'walkOptions.ring');
  }

  return walkOptions;
}

function assertGwmV2SourcePoints(pointsLike) {
  if (!Array.isArray(pointsLike)) {
    throw new TypeError('points must be an array');
  }
  if (pointsLike.length === 0) {
    throw new RangeError('points must contain at least one point');
  }
  if (pointsLike.length < 3) {
    throw new RangeError('points must contain at least 3 points for GWM-V2 triad generation');
  }

  return pointsLike.map((point, index) => normalizeTriadPoint(point, `points[${index}]`));
}

function gwmV2SourcePointPayload(pointsLike) {
  return {
    format: GWM_V2_SOURCE_POINT_FORMAT,
    version: GWM_V2_SOURCE_POINT_VERSION,
    points: assertGwmV2SourcePoints(pointsLike),
  };
}

function gwmV2SourcePointCommitment(pointsLike) {
  return crypto
    .createHash('sha256')
    .update(GWM_V2_SOURCE_POINT_COMMITMENT_DOMAIN)
    .update(Buffer.from([0]))
    .update(stableStringify(gwmV2SourcePointPayload(pointsLike)))
    .digest('hex');
}

function triadWalkOptionsFromGwmV2(walkOptions) {
  const triadWalkOptions = {
    state: {
      point: walkOptions.point,
      shift: walkOptions.shift,
      gap: walkOptions.gap,
    },
    mode: 'distinct',
  };

  if (Object.hasOwn(walkOptions, 'horizon')) {
    triadWalkOptions.count = walkOptions.horizon;
  }

  return triadWalkOptions;
}

function triadStreamContextFromGwmV2(walkOptions, contextLike = {}) {
  const context = cloneCanonicalValue(contextLike, 'context');

  return {
    ...context,
    point: walkOptions.point,
    shift: walkOptions.shift,
    gap: walkOptions.gap,
    ...(Object.hasOwn(walkOptions, 'horizon') ? { horizon: walkOptions.horizon } : {}),
    ...(Object.hasOwn(walkOptions, 'ring') ? { ring: walkOptions.ring } : {}),
  };
}

function createGwmV2TriadStream(pointsLike, walkOptionsLike, contextLike = {}) {
  const sourcePoints = assertGwmV2SourcePoints(pointsLike);
  const walkOptions = normalizeWalkOptions(walkOptionsLike);
  const triadContext = triadStreamContextFromGwmV2(walkOptions, contextLike);
  const triadStream = createTriadInstructionStreamFromWalk(
    sourcePoints,
    triadWalkOptionsFromGwmV2(walkOptions),
    triadContext
  );

  return {
    sourcePoints: cloneCanonicalValue(sourcePoints, 'sourcePoints'),
    sourcePointCommitment: gwmV2SourcePointCommitment(sourcePoints),
    walkOptions: cloneCanonicalValue(walkOptions, 'walkOptions'),
    triadStream: cloneCanonicalValue(triadStream, 'triadStream'),
    triadStreamCommitment: triadStream.streamCommitment,
  };
}

function gwmV2Payload(descriptorLike) {
  assertObject(descriptorLike, 'descriptor');
  assertSupportedFieldNames(
    descriptorLike,
    DESCRIPTOR_FIELDS.concat('descriptorCommitment'),
    'descriptor'
  );

  for (const fieldName of [
    'format',
    'version',
    'mode',
    'sourcePointCommitment',
    'walkOptions',
    'triadStreamCommitment',
    'adapterPlanCommitment',
  ]) {
    assertOwnField(descriptorLike, fieldName);
  }

  if (descriptorLike.format !== GWM_V2_FORMAT) {
    throw new TypeError('descriptor format is not UN-GWM-V2-DESCRIPTOR');
  }
  if (descriptorLike.version !== GWM_V2_VERSION) {
    throw new TypeError('descriptor version is not supported');
  }
  if (descriptorLike.mode !== GWM_V2_MODE) {
    throw new TypeError('descriptor mode is not UN-GWM-V2');
  }

  assertSha256Hex(descriptorLike.sourcePointCommitment, 'sourcePointCommitment');
  assertSha256Hex(descriptorLike.triadStreamCommitment, 'triadStreamCommitment');
  assertSha256Hex(descriptorLike.adapterPlanCommitment, 'adapterPlanCommitment');

  const transformProofCommitment = Object.hasOwn(descriptorLike, 'transformProofCommitment')
    ? descriptorLike.transformProofCommitment
    : null;
  assertSha256HexOrNull(transformProofCommitment, 'transformProofCommitment');

  const context = Object.hasOwn(descriptorLike, 'context') ? descriptorLike.context : {};
  const metadata = Object.hasOwn(descriptorLike, 'metadata') ? descriptorLike.metadata : {};

  return {
    format: descriptorLike.format,
    version: descriptorLike.version,
    mode: descriptorLike.mode,
    sourcePointCommitment: descriptorLike.sourcePointCommitment,
    walkOptions: normalizeWalkOptions(descriptorLike.walkOptions),
    triadStreamCommitment: descriptorLike.triadStreamCommitment,
    adapterPlanCommitment: descriptorLike.adapterPlanCommitment,
    transformProofCommitment,
    context: cloneCanonicalValue(context, 'context'),
    metadata: cloneCanonicalValue(metadata, 'metadata'),
  };
}

function gwmV2Commitment(descriptorLike) {
  const payload = gwmV2Payload(descriptorLike);

  return crypto
    .createHash('sha256')
    .update(GWM_V2_COMMITMENT_DOMAIN)
    .update(Buffer.from([0]))
    .update(stableStringify(payload))
    .digest('hex');
}

function normalizeGwmV2Descriptor(descriptorLike) {
  const payload = gwmV2Payload(descriptorLike);
  const descriptorCommitment = gwmV2Commitment(payload);

  if (
    Object.hasOwn(descriptorLike, 'descriptorCommitment')
    && descriptorLike.descriptorCommitment !== descriptorCommitment
  ) {
    throw new RangeError('descriptorCommitment mismatch');
  }

  return {
    ...payload,
    descriptorCommitment,
  };
}

function createGwmV2Descriptor(options) {
  assertObject(options, 'options');

  const descriptor = {
    format: GWM_V2_FORMAT,
    version: GWM_V2_VERSION,
    mode: GWM_V2_MODE,
    sourcePointCommitment: options.sourcePointCommitment,
    walkOptions: options.walkOptions,
    triadStreamCommitment: options.triadStreamCommitment,
    adapterPlanCommitment: options.adapterPlanCommitment,
    transformProofCommitment: Object.hasOwn(options, 'transformProofCommitment')
      ? options.transformProofCommitment
      : null,
    context: Object.hasOwn(options, 'context') ? options.context : {},
    metadata: Object.hasOwn(options, 'metadata') ? options.metadata : {},
  };

  return normalizeGwmV2Descriptor(descriptor);
}

function createGwmV2DescriptorFromPoints(pointsLike, options) {
  assertObject(options, 'options');
  assertOwnField(options, 'walkOptions');
  assertOwnField(options, 'adapterPlanCommitment');

  const streamResult = createGwmV2TriadStream(
    pointsLike,
    options.walkOptions,
    Object.hasOwn(options, 'context') ? options.context : {}
  );

  return createGwmV2Descriptor({
    sourcePointCommitment: streamResult.sourcePointCommitment,
    walkOptions: streamResult.walkOptions,
    triadStreamCommitment: streamResult.triadStreamCommitment,
    adapterPlanCommitment: options.adapterPlanCommitment,
    transformProofCommitment: Object.hasOwn(options, 'transformProofCommitment')
      ? options.transformProofCommitment
      : null,
    context: Object.hasOwn(options, 'context') ? options.context : {},
    metadata: Object.hasOwn(options, 'metadata') ? options.metadata : {},
  });
}

function assertGwmV2Descriptor(descriptorLike) {
  return normalizeGwmV2Descriptor(descriptorLike);
}

module.exports = {
  GWM_V2_FORMAT,
  GWM_V2_VERSION,
  GWM_V2_SOURCE_POINT_FORMAT,
  GWM_V2_SOURCE_POINT_VERSION,
  assertGwmV2SourcePoints,
  gwmV2SourcePointPayload,
  gwmV2SourcePointCommitment,
  normalizeGwmV2Descriptor,
  gwmV2Payload,
  gwmV2Commitment,
  createGwmV2Descriptor,
  createGwmV2TriadStream,
  createGwmV2DescriptorFromPoints,
  assertGwmV2Descriptor,
};
