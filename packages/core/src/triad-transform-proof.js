'use strict';

const crypto = require('node:crypto');

const { stableStringify } = require('./stack-canonical');
const { assertTriadInstructionPlan } = require('./triad-adapter');
const {
  applyRotateTransform,
  reverseRotateTransform,
} = require('./rotate-transform');
const {
  applySwapTransform,
  reverseSwapTransform,
} = require('./swap-transform');

const TRIAD_TRANSFORM_PROOF_FORMAT = 'UN-TRIAD-MIX-TRANSFORM-PROOF';
const TRIAD_TRANSFORM_PROOF_VERSION = 1;
const TRIAD_TRANSFORM_PROOF_COMMITMENT_DOMAIN = 'UN-TRIAD-MIX-TRANSFORM-PROOF:v1';
const TRIAD_TRANSFORM_PAYLOAD_COMMITMENT_DOMAIN = 'UN-TRIAD-MIX-TRANSFORM-PAYLOAD:v1';

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

function normalizeSafeInteger(value, fieldName) {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${fieldName} must be a safe integer`);
  }

  return Object.is(value, -0) ? 0 : value;
}

function normalizePositiveSafeInteger(value, fieldName) {
  const normalized = normalizeSafeInteger(value, fieldName);
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

function assertHexCommitment(value, fieldName) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
    throw new TypeError(`${fieldName} must be a SHA-256 hex commitment`);
  }
}

function payloadKind(payload) {
  if (Buffer.isBuffer(payload)) {
    return 'Buffer';
  }
  if (payload instanceof Uint8Array) {
    return 'Uint8Array';
  }
  if (Array.isArray(payload)) {
    return 'Array';
  }

  throw new TypeError('payload must be an Array, Uint8Array, or Buffer');
}

function assertByte(value, fieldName) {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${fieldName} must be an integer byte`);
  }
  if (value < 0 || value > 255) {
    throw new RangeError(`${fieldName} must be between 0 and 255`);
  }
}

function payloadBytes(payload) {
  const kind = payloadKind(payload);
  const bytes = Array.from(payload);
  bytes.forEach((value, index) => assertByte(value, `payload[${index}]`));

  return { kind, bytes };
}

function clonePayload(payload) {
  const kind = payloadKind(payload);
  if (kind === 'Buffer') {
    return Buffer.from(payload);
  }
  if (kind === 'Uint8Array') {
    return new Uint8Array(payload);
  }

  payload.forEach((value, index) => assertByte(value, `payload[${index}]`));
  return payload.slice();
}

function payloadCommitment(payload) {
  const { bytes } = payloadBytes(payload);

  return crypto
    .createHash('sha256')
    .update(TRIAD_TRANSFORM_PAYLOAD_COMMITMENT_DOMAIN)
    .update(Buffer.from([0]))
    .update(stableStringify({
      byteLength: bytes.length,
      bytes,
    }))
    .digest('hex');
}

function contextFrom(options = {}) {
  assertObject(options, 'options');
  if (options.context === undefined) {
    return {};
  }

  assertObject(options.context, 'context');
  return cloneCanonicalValue(options.context, 'context');
}

function rotateInstructionsForPayload(descriptor, payloadLength) {
  const ring = normalizePositiveSafeInteger(descriptor.ring, 'rotate.ring');
  const delta = normalizeSafeInteger(descriptor.delta, 'rotate.delta');
  if (delta < 0 || delta >= ring) {
    throw new RangeError('rotate.delta must be within ring bounds');
  }
  if (!['up', 'down'].includes(descriptor.direction)) {
    throw new TypeError('rotate.direction must be up or down');
  }

  return Array.from({ length: payloadLength }, () => ({
    shift: delta,
    windowSize: ring,
  }));
}

function swapPlanForPayload(descriptor, payloadLength) {
  const span = normalizePositiveSafeInteger(descriptor.span, 'swap.span');
  if (span !== payloadLength) {
    throw new RangeError('swap.span must match payload length');
  }

  const a = normalizeSafeInteger(descriptor.a, 'swap.a');
  const b = normalizeSafeInteger(descriptor.b, 'swap.b');
  if (a < 0 || a >= span) {
    throw new RangeError('swap.a must be within span bounds');
  }
  if (b < 0 || b >= span) {
    throw new RangeError('swap.b must be within span bounds');
  }

  return {
    format: 'UN-SWAP-PLAN',
    version: 1,
    length: payloadLength,
    swapCount: 1,
    swaps: [[a, b]],
  };
}

function operationsFromPlan(plan) {
  const operations = [];
  const swapsByRecord = new Map();

  plan.swapInstructions.forEach((descriptor) => {
    if (!swapsByRecord.has(descriptor.recordIndex)) {
      swapsByRecord.set(descriptor.recordIndex, []);
    }
    swapsByRecord.get(descriptor.recordIndex).push(descriptor);
  });

  const consumedSwaps = new Set();
  for (const descriptor of plan.rotateInstructions) {
    operations.push({ type: 'UN-ROTATE', descriptor });

    const swaps = swapsByRecord.get(descriptor.recordIndex) || [];
    for (const swap of swaps) {
      operations.push({ type: 'UN-SWAP', descriptor: swap });
      consumedSwaps.add(swap);
    }
  }

  for (const descriptor of plan.swapInstructions) {
    if (!consumedSwaps.has(descriptor)) {
      operations.push({ type: 'UN-SWAP', descriptor });
    }
  }

  return operations;
}

function operationSummary(operation, operationIndex, payloadLength, reverseOf) {
  const { descriptor } = operation;
  const summary = {
    operationIndex,
    type: operation.type,
    recordIndex: descriptor.recordIndex,
    payloadLength,
  };

  if (reverseOf !== undefined) {
    summary.reverseOfOperationIndex = reverseOf;
  }

  if (operation.type === 'UN-ROTATE') {
    return {
      ...summary,
      delta: descriptor.delta,
      direction: descriptor.direction,
      ring: descriptor.ring,
    };
  }

  if (operation.type === 'UN-SWAP') {
    return {
      ...summary,
      a: descriptor.a,
      b: descriptor.b,
      span: descriptor.span,
    };
  }

  throw new TypeError(`unsupported descriptor type: ${operation.type}`);
}

function applyOperation(payload, operation) {
  if (operation.type === 'UN-ROTATE') {
    return applyRotateTransform(
      payload,
      rotateInstructionsForPayload(operation.descriptor, payload.length),
      { direction: operation.descriptor.direction }
    );
  }

  if (operation.type === 'UN-SWAP') {
    return applySwapTransform(
      payload,
      swapPlanForPayload(operation.descriptor, payload.length)
    );
  }

  throw new TypeError(`unsupported descriptor type: ${operation.type}`);
}

function reverseOperation(payload, operation) {
  if (operation.type === 'UN-ROTATE') {
    return reverseRotateTransform(
      payload,
      rotateInstructionsForPayload(operation.descriptor, payload.length),
      { direction: operation.descriptor.direction }
    );
  }

  if (operation.type === 'UN-SWAP') {
    return reverseSwapTransform(
      payload,
      swapPlanForPayload(operation.descriptor, payload.length)
    );
  }

  throw new TypeError(`unsupported descriptor type: ${operation.type}`);
}

function proofBase({
  mode,
  plan,
  input,
  output,
  appliedOperations,
  context,
}) {
  return {
    format: TRIAD_TRANSFORM_PROOF_FORMAT,
    version: TRIAD_TRANSFORM_PROOF_VERSION,
    mode,
    sourcePlanCommitment: plan.adapterCommitment,
    inputPayloadCommitment: payloadCommitment(input),
    outputPayloadCommitment: payloadCommitment(output),
    context,
    appliedOperations,
    skippedRecords: cloneCanonicalValue(plan.skippedRecords, 'skippedRecords'),
    warnings: [],
  };
}

function triadTransformProofPayload(proofLike) {
  assertObject(proofLike, 'triadTransformProof');
  const payload = { ...proofLike };
  delete payload.proofCommitment;
  delete payload.input;
  delete payload.output;
  delete payload.payload;
  delete payload.restored;

  return cloneCanonicalValue(payload, 'triadTransformProof');
}

function triadTransformProofCommitment(proofLike) {
  return crypto
    .createHash('sha256')
    .update(TRIAD_TRANSFORM_PROOF_COMMITMENT_DOMAIN)
    .update(Buffer.from([0]))
    .update(stableStringify(triadTransformProofPayload(proofLike)))
    .digest('hex');
}

function applyTriadInstructionPlan(planLike, payload, options = {}) {
  const plan = assertTriadInstructionPlan(planLike);
  const context = contextFrom(options);
  const input = clonePayload(payload);
  let output = clonePayload(input);
  const operations = operationsFromPlan(plan);
  const appliedOperations = [];

  operations.forEach((operation, index) => {
    output = applyOperation(output, operation);
    appliedOperations.push(operationSummary(operation, index, output.length));
  });

  const proof = proofBase({
    mode: 'apply',
    plan,
    input,
    output,
    appliedOperations,
    context,
  });

  proof.proofCommitment = triadTransformProofCommitment(proof);
  proof.output = output;

  return proof;
}

function reverseTriadInstructionPlan(planLike, payload, options = {}) {
  const plan = assertTriadInstructionPlan(planLike);
  const context = contextFrom(options);
  const input = clonePayload(payload);
  let output = clonePayload(input);
  const operations = operationsFromPlan(plan);
  const appliedOperations = [];

  for (let operationIndex = operations.length - 1; operationIndex >= 0; operationIndex -= 1) {
    const operation = operations[operationIndex];
    output = reverseOperation(output, operation);
    appliedOperations.push(operationSummary(
      operation,
      appliedOperations.length,
      output.length,
      operationIndex
    ));
  }

  const proof = proofBase({
    mode: 'reverse',
    plan,
    input,
    output,
    appliedOperations,
    context,
  });

  proof.proofCommitment = triadTransformProofCommitment(proof);
  proof.output = output;

  return proof;
}

function samePayload(left, right) {
  return stableStringify(payloadBytes(left).bytes) === stableStringify(payloadBytes(right).bytes);
}

function roundTripTriadInstructionPlan(planLike, payload, options = {}) {
  const original = clonePayload(payload);
  const applied = applyTriadInstructionPlan(planLike, original, options);
  const reversed = reverseTriadInstructionPlan(planLike, applied.output, options);

  return {
    format: TRIAD_TRANSFORM_PROOF_FORMAT,
    version: TRIAD_TRANSFORM_PROOF_VERSION,
    sourcePlanCommitment: applied.sourcePlanCommitment,
    inputPayloadCommitment: applied.inputPayloadCommitment,
    transformedPayloadCommitment: applied.outputPayloadCommitment,
    restoredPayloadCommitment: reversed.outputPayloadCommitment,
    roundTrip: samePayload(original, reversed.output),
    applied,
    reversed,
    restored: reversed.output,
  };
}

function assertOperationSummary(summary, index) {
  assertObject(summary, `appliedOperations[${index}]`);
  normalizeSafeInteger(summary.operationIndex, `appliedOperations[${index}].operationIndex`);
  if (summary.operationIndex !== index) {
    throw new RangeError(`appliedOperations[${index}].operationIndex must match its position`);
  }
  if (!['UN-ROTATE', 'UN-SWAP'].includes(summary.type)) {
    throw new TypeError(`appliedOperations[${index}].type is not supported`);
  }
  normalizeSafeInteger(summary.recordIndex, `appliedOperations[${index}].recordIndex`);
  normalizeSafeInteger(summary.payloadLength, `appliedOperations[${index}].payloadLength`);
  if (summary.payloadLength < 0) {
    throw new RangeError(`appliedOperations[${index}].payloadLength must be non-negative`);
  }
  if (Object.hasOwn(summary, 'reverseOfOperationIndex')) {
    normalizeSafeInteger(
      summary.reverseOfOperationIndex,
      `appliedOperations[${index}].reverseOfOperationIndex`
    );
  }

  if (summary.type === 'UN-ROTATE') {
    const ring = normalizePositiveSafeInteger(summary.ring, `appliedOperations[${index}].ring`);
    const delta = normalizeSafeInteger(summary.delta, `appliedOperations[${index}].delta`);
    if (delta < 0 || delta >= ring) {
      throw new RangeError(`appliedOperations[${index}].delta must be within ring bounds`);
    }
    if (!['up', 'down'].includes(summary.direction)) {
      throw new TypeError(`appliedOperations[${index}].direction must be up or down`);
    }
  } else {
    const span = normalizePositiveSafeInteger(summary.span, `appliedOperations[${index}].span`);
    for (const fieldName of ['a', 'b']) {
      const position = normalizeSafeInteger(
        summary[fieldName],
        `appliedOperations[${index}].${fieldName}`
      );
      if (position < 0 || position >= span) {
        throw new RangeError(`appliedOperations[${index}].${fieldName} must be within span bounds`);
      }
    }
  }
}

function assertTriadTransformProof(proofLike) {
  assertObject(proofLike, 'triadTransformProof');
  for (const fieldName of [
    'format',
    'version',
    'mode',
    'sourcePlanCommitment',
    'inputPayloadCommitment',
    'outputPayloadCommitment',
    'context',
    'appliedOperations',
    'skippedRecords',
    'warnings',
  ]) {
    assertOwnField(proofLike, fieldName);
  }

  if (proofLike.format !== TRIAD_TRANSFORM_PROOF_FORMAT) {
    throw new TypeError('triad transform proof format is not UN-TRIAD-MIX-TRANSFORM-PROOF');
  }
  if (proofLike.version !== TRIAD_TRANSFORM_PROOF_VERSION) {
    throw new TypeError('triad transform proof version is not supported');
  }
  if (!['apply', 'reverse'].includes(proofLike.mode)) {
    throw new TypeError('triad transform proof mode must be apply or reverse');
  }
  assertHexCommitment(proofLike.sourcePlanCommitment, 'sourcePlanCommitment');
  assertHexCommitment(proofLike.inputPayloadCommitment, 'inputPayloadCommitment');
  assertHexCommitment(proofLike.outputPayloadCommitment, 'outputPayloadCommitment');
  assertObject(proofLike.context, 'context');
  cloneCanonicalValue(proofLike.context, 'context');
  if (!Array.isArray(proofLike.appliedOperations)) {
    throw new TypeError('appliedOperations must be an array');
  }
  proofLike.appliedOperations.forEach(assertOperationSummary);
  if (!Array.isArray(proofLike.skippedRecords)) {
    throw new TypeError('skippedRecords must be an array');
  }
  cloneCanonicalValue(proofLike.skippedRecords, 'skippedRecords');
  if (!Array.isArray(proofLike.warnings)) {
    throw new TypeError('warnings must be an array');
  }
  cloneCanonicalValue(proofLike.warnings, 'warnings');

  if (Object.hasOwn(proofLike, 'output')) {
    const outputCommitment = payloadCommitment(proofLike.output);
    if (outputCommitment !== proofLike.outputPayloadCommitment) {
      throw new RangeError('outputPayloadCommitment mismatch');
    }
  }

  const proofCommitment = triadTransformProofCommitment(proofLike);
  if (
    Object.hasOwn(proofLike, 'proofCommitment')
    && proofLike.proofCommitment !== proofCommitment
  ) {
    throw new RangeError('proofCommitment mismatch');
  }

  return {
    ...triadTransformProofPayload(proofLike),
    proofCommitment,
  };
}

module.exports = {
  TRIAD_TRANSFORM_PROOF_FORMAT,
  TRIAD_TRANSFORM_PROOF_VERSION,
  triadTransformProofPayload,
  triadTransformProofCommitment,
  applyTriadInstructionPlan,
  reverseTriadInstructionPlan,
  roundTripTriadInstructionPlan,
  assertTriadTransformProof,
};
