'use strict';

const crypto = require('node:crypto');

const { stableStringify } = require('./stack-canonical');
const {
  normalizeTriadPoint,
  createTriadInstructionStreamFromWalk,
} = require('./triad-mix');
const {
  triadAdapterCommitment,
  assertTriadInstructionPlan,
} = require('./triad-adapter');
const {
  triadTransformProofCommitment,
  assertTriadTransformProof,
} = require('./triad-transform-proof');

const GWM_V2_FORMAT = 'UN-GWM-V2-DESCRIPTOR';
const GWM_V2_VERSION = 1;
const GWM_V2_MODE = 'UN-GWM-V2';
const GWM_V2_COMMITMENT_DOMAIN = 'UN-GWM-V2-DESCRIPTOR:v1';
const GWM_V2_ADAPTER_BINDING_FORMAT = 'UN-GWM-V2-ADAPTER-BINDING';
const GWM_V2_ADAPTER_BINDING_VERSION = 1;
const GWM_V2_ADAPTER_BINDING_COMMITMENT_DOMAIN = 'UN-GWM-V2-ADAPTER-BINDING:v1';
const GWM_V2_PROOF_BINDING_FORMAT = 'UN-GWM-V2-PROOF-BINDING';
const GWM_V2_PROOF_BINDING_VERSION = 1;
const GWM_V2_PROOF_BINDING_COMMITMENT_DOMAIN = 'UN-GWM-V2-PROOF-BINDING:v1';
const GWM_V2_MODE_FORMAT = 'UN-GWM-V2-MODE';
const GWM_V2_MODE_VERSION = 1;
const GWM_V2_MODE_COMMITMENT_DOMAIN = 'UN-GWM-V2-MODE:v1';
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
const MODE_FIELDS = [
  'format',
  'version',
  'mode',
  'descriptor',
  'descriptorCommitment',
  'sourcePointCommitment',
  'triadStreamCommitment',
  'adapterPlanCommitment',
  'transformProofCommitment',
  'adapterPlan',
  'adapterBinding',
  'adapterBindingCommitment',
  'transformProof',
  'proofBinding',
  'proofBindingCommitment',
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

function gwmV2AdapterBindingPayload(bindingLike) {
  assertObject(bindingLike, 'binding');

  for (const fieldName of [
    'format',
    'version',
    'descriptorCommitment',
    'triadStreamCommitment',
    'adapterPlanCommitment',
    'expectedAdapterPlanCommitment',
  ]) {
    assertOwnField(bindingLike, fieldName);
  }

  if (bindingLike.format !== GWM_V2_ADAPTER_BINDING_FORMAT) {
    throw new TypeError('binding format is not UN-GWM-V2-ADAPTER-BINDING');
  }
  if (bindingLike.version !== GWM_V2_ADAPTER_BINDING_VERSION) {
    throw new TypeError('binding version is not supported');
  }

  assertSha256Hex(bindingLike.descriptorCommitment, 'descriptorCommitment');
  assertSha256Hex(bindingLike.triadStreamCommitment, 'triadStreamCommitment');
  assertSha256Hex(bindingLike.adapterPlanCommitment, 'adapterPlanCommitment');
  assertSha256Hex(bindingLike.expectedAdapterPlanCommitment, 'expectedAdapterPlanCommitment');

  return {
    format: bindingLike.format,
    version: bindingLike.version,
    descriptorCommitment: bindingLike.descriptorCommitment,
    triadStreamCommitment: bindingLike.triadStreamCommitment,
    adapterPlanCommitment: bindingLike.adapterPlanCommitment,
    expectedAdapterPlanCommitment: bindingLike.expectedAdapterPlanCommitment,
  };
}

function gwmV2AdapterBindingCommitment(bindingLike) {
  return crypto
    .createHash('sha256')
    .update(GWM_V2_ADAPTER_BINDING_COMMITMENT_DOMAIN)
    .update(Buffer.from([0]))
    .update(stableStringify(gwmV2AdapterBindingPayload(bindingLike)))
    .digest('hex');
}

function gwmV2ProofBindingPayload(bindingLike) {
  assertObject(bindingLike, 'binding');

  for (const fieldName of [
    'format',
    'version',
    'descriptorCommitment',
    'triadStreamCommitment',
    'adapterPlanCommitment',
    'expectedTransformProofCommitment',
    'suppliedTransformProofCommitment',
  ]) {
    assertOwnField(bindingLike, fieldName);
  }

  if (bindingLike.format !== GWM_V2_PROOF_BINDING_FORMAT) {
    throw new TypeError('binding format is not UN-GWM-V2-PROOF-BINDING');
  }
  if (bindingLike.version !== GWM_V2_PROOF_BINDING_VERSION) {
    throw new TypeError('binding version is not supported');
  }

  assertSha256Hex(bindingLike.descriptorCommitment, 'descriptorCommitment');
  assertSha256Hex(bindingLike.triadStreamCommitment, 'triadStreamCommitment');
  assertSha256Hex(bindingLike.adapterPlanCommitment, 'adapterPlanCommitment');
  assertSha256Hex(
    bindingLike.expectedTransformProofCommitment,
    'expectedTransformProofCommitment'
  );
  assertSha256Hex(
    bindingLike.suppliedTransformProofCommitment,
    'suppliedTransformProofCommitment'
  );

  return {
    format: bindingLike.format,
    version: bindingLike.version,
    descriptorCommitment: bindingLike.descriptorCommitment,
    triadStreamCommitment: bindingLike.triadStreamCommitment,
    adapterPlanCommitment: bindingLike.adapterPlanCommitment,
    expectedTransformProofCommitment: bindingLike.expectedTransformProofCommitment,
    suppliedTransformProofCommitment: bindingLike.suppliedTransformProofCommitment,
  };
}

function gwmV2ProofBindingCommitment(bindingLike) {
  return crypto
    .createHash('sha256')
    .update(GWM_V2_PROOF_BINDING_COMMITMENT_DOMAIN)
    .update(Buffer.from([0]))
    .update(stableStringify(gwmV2ProofBindingPayload(bindingLike)))
    .digest('hex');
}

function adapterSummaryFromPlan(plan) {
  return {
    sourceStreamCommitment: plan.sourceStreamCommitment,
    rotateInstructionCount: plan.rotateInstructions.length,
    swapInstructionCount: plan.swapInstructions.length,
    skippedRecordCount: plan.skippedRecords.length,
  };
}

function proofSummaryFromProof(proof) {
  return {
    mode: proof.mode,
    sourcePlanCommitment: proof.sourcePlanCommitment,
    inputPayloadCommitment: proof.inputPayloadCommitment,
    outputPayloadCommitment: proof.outputPayloadCommitment,
    appliedOperationCount: proof.appliedOperations.length,
    skippedRecordCount: proof.skippedRecords.length,
    warningCount: proof.warnings.length,
  };
}

function invalidAdapterVerification(reason, error, partial = {}) {
  return cloneCanonicalValue({
    format: GWM_V2_ADAPTER_BINDING_FORMAT,
    version: GWM_V2_ADAPTER_BINDING_VERSION,
    ok: false,
    reason,
    error: error instanceof Error ? error.message : String(error),
    ...partial,
  }, 'adapterBindingResult');
}

function invalidProofVerification(reason, error, partial = {}) {
  return cloneCanonicalValue({
    format: GWM_V2_PROOF_BINDING_FORMAT,
    version: GWM_V2_PROOF_BINDING_VERSION,
    ok: false,
    reason,
    ...(error === undefined ? {} : {
      error: error instanceof Error ? error.message : String(error),
    }),
    ...partial,
  }, 'proofBindingResult');
}

function verifyGwmV2AdapterPlan(descriptorLike, adapterPlanLike) {
  let descriptor;
  try {
    descriptor = normalizeGwmV2Descriptor(descriptorLike);
  } catch (error) {
    return invalidAdapterVerification('invalid-descriptor', error);
  }

  let adapterPlan;
  try {
    adapterPlan = assertTriadInstructionPlan(adapterPlanLike);
  } catch (error) {
    return invalidAdapterVerification('invalid-adapter-plan', error, {
      descriptorCommitment: descriptor.descriptorCommitment,
      triadStreamCommitment: descriptor.triadStreamCommitment,
      expectedAdapterPlanCommitment: descriptor.adapterPlanCommitment,
    });
  }

  const adapterPlanCommitment = triadAdapterCommitment(adapterPlan);
  const partial = {
    descriptorCommitment: descriptor.descriptorCommitment,
    triadStreamCommitment: descriptor.triadStreamCommitment,
    adapterPlanCommitment,
    expectedAdapterPlanCommitment: descriptor.adapterPlanCommitment,
    adapterSummary: adapterSummaryFromPlan(adapterPlan),
  };

  if (adapterPlan.sourceStreamCommitment !== descriptor.triadStreamCommitment) {
    return cloneCanonicalValue({
      format: GWM_V2_ADAPTER_BINDING_FORMAT,
      version: GWM_V2_ADAPTER_BINDING_VERSION,
      ok: false,
      reason: 'source-stream-commitment-mismatch',
      ...partial,
    }, 'adapterBindingResult');
  }

  if (adapterPlanCommitment !== descriptor.adapterPlanCommitment) {
    return cloneCanonicalValue({
      format: GWM_V2_ADAPTER_BINDING_FORMAT,
      version: GWM_V2_ADAPTER_BINDING_VERSION,
      ok: false,
      reason: 'adapter-plan-commitment-mismatch',
      ...partial,
    }, 'adapterBindingResult');
  }

  const bindingPayload = {
    format: GWM_V2_ADAPTER_BINDING_FORMAT,
    version: GWM_V2_ADAPTER_BINDING_VERSION,
    descriptorCommitment: descriptor.descriptorCommitment,
    triadStreamCommitment: descriptor.triadStreamCommitment,
    adapterPlanCommitment,
    expectedAdapterPlanCommitment: descriptor.adapterPlanCommitment,
  };

  return cloneCanonicalValue({
    ...bindingPayload,
    ok: true,
    adapterSummary: adapterSummaryFromPlan(adapterPlan),
    bindingCommitment: gwmV2AdapterBindingCommitment(bindingPayload),
  }, 'adapterBindingResult');
}

function bindGwmV2AdapterPlan(descriptorLike, adapterPlanLike) {
  const result = verifyGwmV2AdapterPlan(descriptorLike, adapterPlanLike);
  if (!result.ok) {
    throw new RangeError(result.error || result.reason || 'GWM-V2 adapter binding failed');
  }

  return cloneCanonicalValue(result, 'adapterBinding');
}

function assertGwmV2AdapterBinding(descriptorLike, adapterPlanLike) {
  return bindGwmV2AdapterPlan(descriptorLike, adapterPlanLike);
}

function verifyGwmV2TransformProof(descriptorLike, transformProofLike) {
  let descriptor;
  try {
    descriptor = normalizeGwmV2Descriptor(descriptorLike);
  } catch (error) {
    return invalidProofVerification('invalid-descriptor', error);
  }

  const descriptorPartial = {
    descriptorCommitment: descriptor.descriptorCommitment,
    triadStreamCommitment: descriptor.triadStreamCommitment,
    adapterPlanCommitment: descriptor.adapterPlanCommitment,
    expectedTransformProofCommitment: descriptor.transformProofCommitment,
  };

  if (descriptor.transformProofCommitment === null) {
    return invalidProofVerification(
      'missing-transform-proof-commitment',
      undefined,
      descriptorPartial
    );
  }

  let transformProof;
  try {
    transformProof = assertTriadTransformProof(transformProofLike);
  } catch (error) {
    return invalidProofVerification('invalid-transform-proof', error, descriptorPartial);
  }

  const suppliedTransformProofCommitment = triadTransformProofCommitment(transformProof);
  const partial = {
    ...descriptorPartial,
    suppliedTransformProofCommitment,
    proofSummary: proofSummaryFromProof(transformProof),
  };

  if (transformProof.sourcePlanCommitment !== descriptor.adapterPlanCommitment) {
    return invalidProofVerification(
      'source-plan-commitment-mismatch',
      undefined,
      partial
    );
  }

  if (suppliedTransformProofCommitment !== descriptor.transformProofCommitment) {
    return invalidProofVerification(
      'transform-proof-commitment-mismatch',
      undefined,
      partial
    );
  }

  const bindingPayload = {
    format: GWM_V2_PROOF_BINDING_FORMAT,
    version: GWM_V2_PROOF_BINDING_VERSION,
    descriptorCommitment: descriptor.descriptorCommitment,
    triadStreamCommitment: descriptor.triadStreamCommitment,
    adapterPlanCommitment: descriptor.adapterPlanCommitment,
    expectedTransformProofCommitment: descriptor.transformProofCommitment,
    suppliedTransformProofCommitment,
  };

  return cloneCanonicalValue({
    ...bindingPayload,
    ok: true,
    proofSummary: proofSummaryFromProof(transformProof),
    bindingCommitment: gwmV2ProofBindingCommitment(bindingPayload),
  }, 'proofBindingResult');
}

function bindGwmV2TransformProof(descriptorLike, transformProofLike) {
  const result = verifyGwmV2TransformProof(descriptorLike, transformProofLike);
  if (!result.ok) {
    throw new RangeError(result.error || result.reason || 'GWM-V2 transform proof binding failed');
  }

  return cloneCanonicalValue(result, 'proofBinding');
}

function assertGwmV2ProofBinding(descriptorLike, transformProofLike) {
  return bindGwmV2TransformProof(descriptorLike, transformProofLike);
}

function bindingPayloadWithCommitment(bindingLike, payloadFn, commitmentFn, name) {
  const payload = payloadFn(bindingLike);
  const bindingCommitment = commitmentFn(payload);

  if (
    Object.hasOwn(bindingLike, 'bindingCommitment')
    && bindingLike.bindingCommitment !== bindingCommitment
  ) {
    throw new RangeError(`${name} bindingCommitment mismatch`);
  }

  return cloneCanonicalValue({
    ...cloneCanonicalValue(bindingLike, name),
    bindingCommitment,
  }, name);
}

function normalizeNullableProofBinding(proofBindingLike) {
  if (proofBindingLike === null) {
    return null;
  }

  return bindingPayloadWithCommitment(
    proofBindingLike,
    gwmV2ProofBindingPayload,
    gwmV2ProofBindingCommitment,
    'proofBinding'
  );
}

function gwmV2ModePayload(modeLike) {
  assertObject(modeLike, 'modeWrapper');
  assertSupportedFieldNames(
    modeLike,
    MODE_FIELDS.concat('modeCommitment'),
    'modeWrapper'
  );

  for (const fieldName of [
    'format',
    'version',
    'mode',
    'descriptor',
    'descriptorCommitment',
    'sourcePointCommitment',
    'triadStreamCommitment',
    'adapterPlanCommitment',
    'transformProofCommitment',
    'adapterPlan',
    'adapterBinding',
    'adapterBindingCommitment',
  ]) {
    assertOwnField(modeLike, fieldName);
  }

  if (!Number.isSafeInteger(modeLike.version)) {
    throw new TypeError('modeWrapper version must be a safe integer');
  }
  if (typeof modeLike.format !== 'string' || modeLike.format.length === 0) {
    throw new TypeError('modeWrapper format must be a non-empty string');
  }
  if (modeLike.mode !== GWM_V2_MODE) {
    throw new TypeError('modeWrapper mode is not UN-GWM-V2');
  }

  assertSha256Hex(modeLike.descriptorCommitment, 'descriptorCommitment');
  assertSha256Hex(modeLike.sourcePointCommitment, 'sourcePointCommitment');
  assertSha256Hex(modeLike.triadStreamCommitment, 'triadStreamCommitment');
  assertSha256Hex(modeLike.adapterPlanCommitment, 'adapterPlanCommitment');
  assertSha256HexOrNull(modeLike.transformProofCommitment, 'transformProofCommitment');
  assertSha256Hex(modeLike.adapterBindingCommitment, 'adapterBindingCommitment');

  const proofBindingCommitment = Object.hasOwn(modeLike, 'proofBindingCommitment')
    ? modeLike.proofBindingCommitment
    : null;
  assertSha256HexOrNull(proofBindingCommitment, 'proofBindingCommitment');

  const descriptor = normalizeGwmV2Descriptor(modeLike.descriptor);
  const adapterPlan = assertTriadInstructionPlan(modeLike.adapterPlan);
  const adapterBinding = bindingPayloadWithCommitment(
    modeLike.adapterBinding,
    gwmV2AdapterBindingPayload,
    gwmV2AdapterBindingCommitment,
    'adapterBinding'
  );
  const transformProof = Object.hasOwn(modeLike, 'transformProof')
    && modeLike.transformProof !== null
    ? assertTriadTransformProof(modeLike.transformProof)
    : null;
  const proofBinding = Object.hasOwn(modeLike, 'proofBinding')
    ? normalizeNullableProofBinding(modeLike.proofBinding)
    : null;
  const context = Object.hasOwn(modeLike, 'context') ? modeLike.context : {};
  const metadata = Object.hasOwn(modeLike, 'metadata') ? modeLike.metadata : {};

  return {
    format: modeLike.format,
    version: modeLike.version,
    mode: modeLike.mode,
    descriptor,
    descriptorCommitment: modeLike.descriptorCommitment,
    sourcePointCommitment: modeLike.sourcePointCommitment,
    triadStreamCommitment: modeLike.triadStreamCommitment,
    adapterPlanCommitment: modeLike.adapterPlanCommitment,
    transformProofCommitment: modeLike.transformProofCommitment,
    adapterPlan: cloneCanonicalValue(adapterPlan, 'adapterPlan'),
    adapterBinding,
    adapterBindingCommitment: modeLike.adapterBindingCommitment,
    transformProof: transformProof === null
      ? null
      : cloneCanonicalValue(transformProof, 'transformProof'),
    proofBinding,
    proofBindingCommitment,
    context: cloneCanonicalValue(context, 'context'),
    metadata: cloneCanonicalValue(metadata, 'metadata'),
  };
}

function gwmV2ModeCommitment(modeLike) {
  return crypto
    .createHash('sha256')
    .update(GWM_V2_MODE_COMMITMENT_DOMAIN)
    .update(Buffer.from([0]))
    .update(stableStringify(gwmV2ModePayload(modeLike)))
    .digest('hex');
}

function normalizeGwmV2Mode(modeLike) {
  const payload = gwmV2ModePayload(modeLike);

  if (payload.format !== GWM_V2_MODE_FORMAT) {
    throw new TypeError('modeWrapper format is not UN-GWM-V2-MODE');
  }
  if (payload.version !== GWM_V2_MODE_VERSION) {
    throw new TypeError('modeWrapper version is not supported');
  }

  const modeCommitment = gwmV2ModeCommitment(payload);
  if (
    Object.hasOwn(modeLike, 'modeCommitment')
    && modeLike.modeCommitment !== modeCommitment
  ) {
    throw new RangeError('modeCommitment mismatch');
  }

  return {
    ...payload,
    modeCommitment,
  };
}

function createGwmV2Mode(input) {
  assertObject(input, 'input');
  assertOwnField(input, 'adapterPlan');

  const hasDescriptor = Object.hasOwn(input, 'descriptor');
  const hasPoints = Object.hasOwn(input, 'points');
  if (hasDescriptor === hasPoints) {
    throw new TypeError('input must supply exactly one of descriptor or points');
  }

  const context = Object.hasOwn(input, 'context') ? input.context : {};
  const metadata = Object.hasOwn(input, 'metadata') ? input.metadata : {};
  const hasTransformProof = Object.hasOwn(input, 'transformProof')
    && input.transformProof !== null;
  const adapterPlan = assertTriadInstructionPlan(input.adapterPlan);
  let descriptor;

  if (hasDescriptor) {
    descriptor = normalizeGwmV2Descriptor(input.descriptor);
  } else if (hasTransformProof) {
    assertOwnField(input, 'walkOptions');
    descriptor = createGwmV2DescriptorFromPointsAdapterAndProof(
      input.points,
      input.walkOptions,
      adapterPlan,
      input.transformProof,
      { context, metadata }
    );
  } else {
    assertOwnField(input, 'walkOptions');
    descriptor = createGwmV2DescriptorFromPointsAndAdapter(
      input.points,
      input.walkOptions,
      adapterPlan,
      {
        context,
        metadata,
        transformProofCommitment: Object.hasOwn(input, 'transformProofCommitment')
          ? input.transformProofCommitment
          : null,
      }
    );
  }

  if (descriptor.transformProofCommitment !== null && !hasTransformProof) {
    throw new RangeError(
      'transform proof material is required when descriptor declares transformProofCommitment'
    );
  }

  const adapterBinding = bindGwmV2AdapterPlan(descriptor, adapterPlan);
  let transformProof = null;
  let proofBinding = null;

  if (hasTransformProof) {
    transformProof = assertTriadTransformProof(input.transformProof);
    proofBinding = bindGwmV2TransformProof(descriptor, transformProof);
  }

  const payload = {
    format: GWM_V2_MODE_FORMAT,
    version: GWM_V2_MODE_VERSION,
    mode: GWM_V2_MODE,
    descriptor,
    descriptorCommitment: descriptor.descriptorCommitment,
    sourcePointCommitment: descriptor.sourcePointCommitment,
    triadStreamCommitment: descriptor.triadStreamCommitment,
    adapterPlanCommitment: descriptor.adapterPlanCommitment,
    transformProofCommitment: descriptor.transformProofCommitment,
    adapterPlan,
    adapterBinding,
    adapterBindingCommitment: adapterBinding.bindingCommitment,
    transformProof,
    proofBinding,
    proofBindingCommitment: proofBinding === null ? null : proofBinding.bindingCommitment,
    context,
    metadata,
  };

  return normalizeGwmV2Mode(payload);
}

function invalidModeVerification(reason, error, partial = {}) {
  return cloneCanonicalValue({
    format: GWM_V2_MODE_FORMAT,
    version: GWM_V2_MODE_VERSION,
    ok: false,
    reason,
    ...(error === undefined ? {} : {
      error: error instanceof Error ? error.message : String(error),
    }),
    ...partial,
  }, 'modeVerificationResult');
}

function verifyModeMirrorCommitments(payload, descriptor) {
  const mirrorFields = [
    'descriptorCommitment',
    'sourcePointCommitment',
    'triadStreamCommitment',
    'adapterPlanCommitment',
    'transformProofCommitment',
  ];

  for (const fieldName of mirrorFields) {
    if (payload[fieldName] !== descriptor[fieldName]) {
      return `${fieldName}-mismatch`;
    }
  }

  return null;
}

function verifyGwmV2Mode(modeLike) {
  let payload;
  try {
    payload = gwmV2ModePayload(modeLike);
  } catch (error) {
    return invalidModeVerification('invalid-mode', error);
  }

  const partial = {
    ...(Object.hasOwn(modeLike, 'modeCommitment') ? { modeCommitment: modeLike.modeCommitment } : {}),
    descriptorCommitment: payload.descriptorCommitment,
    sourcePointCommitment: payload.sourcePointCommitment,
    triadStreamCommitment: payload.triadStreamCommitment,
    adapterPlanCommitment: payload.adapterPlanCommitment,
    transformProofCommitment: payload.transformProofCommitment,
    adapterBindingCommitment: payload.adapterBindingCommitment,
    proofBindingCommitment: payload.proofBindingCommitment,
  };

  if (payload.format !== GWM_V2_MODE_FORMAT) {
    return invalidModeVerification('invalid-format', undefined, partial);
  }
  if (payload.version !== GWM_V2_MODE_VERSION) {
    return invalidModeVerification('invalid-version', undefined, partial);
  }

  const descriptor = payload.descriptor;
  const mirrorMismatch = verifyModeMirrorCommitments(payload, descriptor);
  if (mirrorMismatch !== null) {
    return invalidModeVerification(mirrorMismatch, undefined, partial);
  }

  const adapterBinding = verifyGwmV2AdapterPlan(descriptor, payload.adapterPlan);
  if (!adapterBinding.ok) {
    return invalidModeVerification('adapter-binding-failed', undefined, {
      ...partial,
      adapterBinding,
    });
  }
  if (payload.adapterBindingCommitment !== adapterBinding.bindingCommitment) {
    return invalidModeVerification('adapter-binding-commitment-mismatch', undefined, {
      ...partial,
      expectedAdapterBindingCommitment: adapterBinding.bindingCommitment,
      adapterBinding,
    });
  }

  let proofBinding = null;
  if (descriptor.transformProofCommitment !== null || payload.transformProof !== null) {
    if (payload.transformProof === null) {
      return invalidModeVerification('missing-transform-proof-material', undefined, partial);
    }

    proofBinding = verifyGwmV2TransformProof(descriptor, payload.transformProof);
    if (!proofBinding.ok) {
      return invalidModeVerification('proof-binding-failed', undefined, {
        ...partial,
        adapterBinding,
        proofBinding,
      });
    }
    if (payload.proofBindingCommitment !== proofBinding.bindingCommitment) {
      return invalidModeVerification('proof-binding-commitment-mismatch', undefined, {
        ...partial,
        adapterBinding,
        proofBinding,
        expectedProofBindingCommitment: proofBinding.bindingCommitment,
      });
    }
  } else if (payload.proofBindingCommitment !== null || payload.proofBinding !== null) {
    return invalidModeVerification('unexpected-proof-binding', undefined, partial);
  }

  const modeCommitment = gwmV2ModeCommitment(payload);
  if (
    Object.hasOwn(modeLike, 'modeCommitment')
    && modeLike.modeCommitment !== modeCommitment
  ) {
    return invalidModeVerification('mode-commitment-mismatch', undefined, {
      ...partial,
      expectedModeCommitment: modeCommitment,
      adapterBinding,
      proofBinding,
    });
  }

  return cloneCanonicalValue({
    format: GWM_V2_MODE_FORMAT,
    version: GWM_V2_MODE_VERSION,
    ok: true,
    modeCommitment,
    descriptorCommitment: descriptor.descriptorCommitment,
    sourcePointCommitment: descriptor.sourcePointCommitment,
    triadStreamCommitment: descriptor.triadStreamCommitment,
    adapterPlanCommitment: descriptor.adapterPlanCommitment,
    transformProofCommitment: descriptor.transformProofCommitment,
    adapterBindingCommitment: adapterBinding.bindingCommitment,
    proofBindingCommitment: proofBinding === null ? null : proofBinding.bindingCommitment,
    adapterBinding,
    proofBinding,
  }, 'modeVerificationResult');
}

function assertGwmV2Mode(modeLike) {
  const result = verifyGwmV2Mode(modeLike);
  if (!result.ok) {
    throw new RangeError(result.error || result.reason || 'GWM-V2 mode verification failed');
  }

  return normalizeGwmV2Mode(modeLike);
}

function createGwmV2DescriptorFromPointsAndAdapter(
  pointsLike,
  walkOptionsLike,
  adapterPlanLike,
  options = {}
) {
  assertObject(options, 'options');

  const streamResult = createGwmV2TriadStream(
    pointsLike,
    walkOptionsLike,
    Object.hasOwn(options, 'context') ? options.context : {}
  );
  const adapterPlan = assertTriadInstructionPlan(adapterPlanLike);

  if (adapterPlan.sourceStreamCommitment !== streamResult.triadStreamCommitment) {
    throw new RangeError('adapter plan sourceStreamCommitment must match generated triad stream commitment');
  }

  return createGwmV2Descriptor({
    sourcePointCommitment: streamResult.sourcePointCommitment,
    walkOptions: streamResult.walkOptions,
    triadStreamCommitment: streamResult.triadStreamCommitment,
    adapterPlanCommitment: adapterPlan.adapterCommitment,
    transformProofCommitment: Object.hasOwn(options, 'transformProofCommitment')
      ? options.transformProofCommitment
      : null,
    context: Object.hasOwn(options, 'context') ? options.context : {},
    metadata: Object.hasOwn(options, 'metadata') ? options.metadata : {},
  });
}

function createGwmV2DescriptorFromPointsAdapterAndProof(
  pointsLike,
  walkOptionsLike,
  adapterPlanLike,
  transformProofLike,
  options = {}
) {
  assertObject(options, 'options');

  const streamResult = createGwmV2TriadStream(
    pointsLike,
    walkOptionsLike,
    Object.hasOwn(options, 'context') ? options.context : {}
  );
  const adapterPlan = assertTriadInstructionPlan(adapterPlanLike);

  if (adapterPlan.sourceStreamCommitment !== streamResult.triadStreamCommitment) {
    throw new RangeError('adapter plan sourceStreamCommitment must match generated triad stream commitment');
  }

  const transformProof = assertTriadTransformProof(transformProofLike);
  if (transformProof.sourcePlanCommitment !== adapterPlan.adapterCommitment) {
    throw new RangeError('transform proof sourcePlanCommitment must match supplied adapter plan commitment');
  }

  return createGwmV2Descriptor({
    sourcePointCommitment: streamResult.sourcePointCommitment,
    walkOptions: streamResult.walkOptions,
    triadStreamCommitment: streamResult.triadStreamCommitment,
    adapterPlanCommitment: adapterPlan.adapterCommitment,
    transformProofCommitment: transformProof.proofCommitment,
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
  GWM_V2_ADAPTER_BINDING_FORMAT,
  GWM_V2_ADAPTER_BINDING_VERSION,
  GWM_V2_PROOF_BINDING_FORMAT,
  GWM_V2_PROOF_BINDING_VERSION,
  GWM_V2_MODE_FORMAT,
  GWM_V2_MODE_VERSION,
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
  gwmV2AdapterBindingPayload,
  gwmV2AdapterBindingCommitment,
  gwmV2ProofBindingPayload,
  gwmV2ProofBindingCommitment,
  verifyGwmV2AdapterPlan,
  bindGwmV2AdapterPlan,
  verifyGwmV2TransformProof,
  bindGwmV2TransformProof,
  gwmV2ModePayload,
  gwmV2ModeCommitment,
  createGwmV2Mode,
  verifyGwmV2Mode,
  assertGwmV2Mode,
  createGwmV2DescriptorFromPointsAndAdapter,
  createGwmV2DescriptorFromPointsAdapterAndProof,
  assertGwmV2AdapterBinding,
  assertGwmV2ProofBinding,
  assertGwmV2Descriptor,
};
