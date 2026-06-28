'use strict';

const crypto = require('node:crypto');

const { stableStringify } = require('./stack-canonical');
const { assertTriadInstructionStream } = require('./triad-mix');

const TRIAD_ADAPTER_FORMAT = 'UN-TRIAD-MIX-ADAPTER';
const TRIAD_ADAPTER_VERSION = 1;
const TRIAD_ADAPTER_COMMITMENT_DOMAIN = 'UN-TRIAD-MIX-ADAPTER:v1';

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

function adapterContextFrom(options = {}) {
  assertObject(options, 'options');
  if (options.context === undefined) {
    return {};
  }

  assertObject(options.context, 'context');
  return cloneCanonicalValue(options.context, 'context');
}

function rotateInstructionFromRecord(record) {
  const ring = normalizePositiveSafeInteger(record.rotate.ring, 'record.rotate.ring');
  const delta = normalizeSafeInteger(record.rotate.delta, 'record.rotate.delta');
  if (delta < 0 || delta >= ring) {
    throw new RangeError('record.rotate.delta must be within ring bounds');
  }

  return {
    type: 'UN-ROTATE',
    recordIndex: record.index,
    delta,
    direction: record.rotate.direction,
    ring,
    sourceTriadInstructionCommitment: record.triadInstructionCommitment,
    sourceTriadFeatureCommitment: record.triadFeatureCommitment,
    mixPattern: record.rotate.mixPattern,
  };
}

function swapInstructionFromRecord(record) {
  if (record.position.span === null) {
    return null;
  }

  const span = normalizePositiveSafeInteger(record.position.span, 'record.position.span');
  const a = normalizeSafeInteger(record.position.a, 'record.position.a');
  const b = normalizeSafeInteger(record.position.b, 'record.position.b');
  if (a < 0 || a >= span) {
    throw new RangeError('record.position.a must be within span bounds');
  }
  if (b < 0 || b >= span) {
    throw new RangeError('record.position.b must be within span bounds');
  }

  return {
    type: 'UN-SWAP',
    recordIndex: record.index,
    a,
    b,
    span,
    seed: record.position.seed,
    sourceTriadInstructionCommitment: record.triadInstructionCommitment,
    sourceTriadFeatureCommitment: record.triadFeatureCommitment,
    mixPattern: record.position.mixPattern,
  };
}

function skippedSwapRecord(record) {
  return {
    recordIndex: record.index,
    reason: 'position channel has no span; swap descriptor skipped',
    sourceTriadInstructionCommitment: record.triadInstructionCommitment,
    sourceTriadFeatureCommitment: record.triadFeatureCommitment,
    mixPattern: record.position.mixPattern,
  };
}

function adaptTriadStreamToRotateInstructions(streamLike) {
  const stream = assertTriadInstructionStream(streamLike);
  return cloneCanonicalValue(
    stream.records.map(rotateInstructionFromRecord),
    'rotateInstructions'
  );
}

function adaptTriadStreamToSwapInstructions(streamLike) {
  const stream = assertTriadInstructionStream(streamLike);
  return cloneCanonicalValue(
    stream.records
      .map(swapInstructionFromRecord)
      .filter((instruction) => instruction !== null),
    'swapInstructions'
  );
}

function buildAdapterPayload(streamLike, options = {}) {
  const stream = assertTriadInstructionStream(streamLike);
  const rotateInstructions = stream.records.map(rotateInstructionFromRecord);
  const swapInstructions = [];
  const skippedRecords = [];

  for (const record of stream.records) {
    const instruction = swapInstructionFromRecord(record);
    if (instruction === null) {
      skippedRecords.push(skippedSwapRecord(record));
    } else {
      swapInstructions.push(instruction);
    }
  }

  return cloneCanonicalValue({
    format: TRIAD_ADAPTER_FORMAT,
    version: TRIAD_ADAPTER_VERSION,
    sourceStreamCommitment: stream.streamCommitment,
    context: adapterContextFrom(options),
    rotateInstructions,
    swapInstructions,
    skippedRecords,
  }, 'triadAdapter');
}

function hasAdapterPlanShape(input) {
  return input !== null
    && typeof input === 'object'
    && !Array.isArray(input)
    && Object.hasOwn(input, 'format')
    && Object.hasOwn(input, 'version')
    && Object.hasOwn(input, 'sourceStreamCommitment')
    && Object.hasOwn(input, 'rotateInstructions')
    && Object.hasOwn(input, 'swapInstructions');
}

function triadAdapterPayload(input, options = {}) {
  if (hasAdapterPlanShape(input)) {
    const payload = cloneCanonicalValue(input, 'triadAdapter');
    delete payload.adapterCommitment;
    return payload;
  }

  return buildAdapterPayload(input, options);
}

function triadAdapterCommitment(input, options = {}) {
  return crypto
    .createHash('sha256')
    .update(TRIAD_ADAPTER_COMMITMENT_DOMAIN)
    .update(Buffer.from([0]))
    .update(stableStringify(triadAdapterPayload(input, options)))
    .digest('hex');
}

function adaptTriadStreamToInstructionPlan(streamLike, options = {}) {
  const payload = buildAdapterPayload(streamLike, options);

  return {
    ...payload,
    adapterCommitment: triadAdapterCommitment(payload),
  };
}

function assertRotateInstruction(instruction, index) {
  assertObject(instruction, `rotateInstructions[${index}]`);
  if (instruction.type !== 'UN-ROTATE') {
    throw new TypeError(`rotateInstructions[${index}].type must be UN-ROTATE`);
  }
  if (normalizeSafeInteger(instruction.recordIndex, `rotateInstructions[${index}].recordIndex`) !== index) {
    throw new RangeError(`rotateInstructions[${index}].recordIndex must preserve record order`);
  }
  const ring = normalizePositiveSafeInteger(instruction.ring, `rotateInstructions[${index}].ring`);
  const delta = normalizeSafeInteger(instruction.delta, `rotateInstructions[${index}].delta`);
  if (delta < 0 || delta >= ring) {
    throw new RangeError(`rotateInstructions[${index}].delta must be within ring bounds`);
  }
  if (!['up', 'down'].includes(instruction.direction)) {
    throw new TypeError(`rotateInstructions[${index}].direction must be up or down`);
  }
  assertHexCommitment(
    instruction.sourceTriadInstructionCommitment,
    `rotateInstructions[${index}].sourceTriadInstructionCommitment`
  );
  assertHexCommitment(
    instruction.sourceTriadFeatureCommitment,
    `rotateInstructions[${index}].sourceTriadFeatureCommitment`
  );
  if (typeof instruction.mixPattern !== 'string') {
    throw new TypeError(`rotateInstructions[${index}].mixPattern must be a string`);
  }
}

function assertSwapInstruction(instruction, index) {
  assertObject(instruction, `swapInstructions[${index}]`);
  if (instruction.type !== 'UN-SWAP') {
    throw new TypeError(`swapInstructions[${index}].type must be UN-SWAP`);
  }
  normalizeSafeInteger(instruction.recordIndex, `swapInstructions[${index}].recordIndex`);
  const span = normalizePositiveSafeInteger(instruction.span, `swapInstructions[${index}].span`);
  for (const fieldName of ['a', 'b']) {
    const position = normalizeSafeInteger(instruction[fieldName], `swapInstructions[${index}].${fieldName}`);
    if (position < 0 || position >= span) {
      throw new RangeError(`swapInstructions[${index}].${fieldName} must be within span bounds`);
    }
  }
  normalizeSafeInteger(instruction.seed, `swapInstructions[${index}].seed`);
  assertHexCommitment(
    instruction.sourceTriadInstructionCommitment,
    `swapInstructions[${index}].sourceTriadInstructionCommitment`
  );
  assertHexCommitment(
    instruction.sourceTriadFeatureCommitment,
    `swapInstructions[${index}].sourceTriadFeatureCommitment`
  );
  if (typeof instruction.mixPattern !== 'string') {
    throw new TypeError(`swapInstructions[${index}].mixPattern must be a string`);
  }
}

function assertSkippedRecord(record, index) {
  assertObject(record, `skippedRecords[${index}]`);
  normalizeSafeInteger(record.recordIndex, `skippedRecords[${index}].recordIndex`);
  if (typeof record.reason !== 'string' || record.reason.length === 0) {
    throw new TypeError(`skippedRecords[${index}].reason must be a non-empty string`);
  }
  assertHexCommitment(
    record.sourceTriadInstructionCommitment,
    `skippedRecords[${index}].sourceTriadInstructionCommitment`
  );
  assertHexCommitment(
    record.sourceTriadFeatureCommitment,
    `skippedRecords[${index}].sourceTriadFeatureCommitment`
  );
  if (typeof record.mixPattern !== 'string') {
    throw new TypeError(`skippedRecords[${index}].mixPattern must be a string`);
  }
}

function validateAdapterPayload(payload) {
  assertObject(payload, 'triadInstructionPlan');
  if (payload.format !== TRIAD_ADAPTER_FORMAT) {
    throw new TypeError('triad adapter format is not UN-TRIAD-MIX-ADAPTER');
  }
  if (payload.version !== TRIAD_ADAPTER_VERSION) {
    throw new TypeError('triad adapter version is not supported');
  }
  assertHexCommitment(payload.sourceStreamCommitment, 'sourceStreamCommitment');
  assertObject(payload.context, 'context');
  cloneCanonicalValue(payload.context, 'context');
  if (!Array.isArray(payload.rotateInstructions)) {
    throw new TypeError('rotateInstructions must be an array');
  }
  if (!Array.isArray(payload.swapInstructions)) {
    throw new TypeError('swapInstructions must be an array');
  }
  if (!Array.isArray(payload.skippedRecords)) {
    throw new TypeError('skippedRecords must be an array');
  }
  if (payload.rotateInstructions.length === 0) {
    throw new RangeError('rotateInstructions must contain at least one descriptor');
  }

  payload.rotateInstructions.forEach(assertRotateInstruction);
  payload.swapInstructions.forEach(assertSwapInstruction);
  payload.skippedRecords.forEach(assertSkippedRecord);
}

function assertTriadInstructionPlan(planLike) {
  assertObject(planLike, 'triadInstructionPlan');
  for (const fieldName of [
    'format',
    'version',
    'sourceStreamCommitment',
    'context',
    'rotateInstructions',
    'swapInstructions',
    'skippedRecords',
  ]) {
    assertOwnField(planLike, fieldName);
  }

  const payload = triadAdapterPayload(planLike);
  validateAdapterPayload(payload);
  const commitment = triadAdapterCommitment(payload);

  if (
    Object.hasOwn(planLike, 'adapterCommitment')
    && planLike.adapterCommitment !== commitment
  ) {
    throw new RangeError('adapterCommitment mismatch');
  }

  return {
    ...payload,
    adapterCommitment: commitment,
  };
}

module.exports = {
  TRIAD_ADAPTER_FORMAT,
  TRIAD_ADAPTER_VERSION,
  triadAdapterPayload,
  triadAdapterCommitment,
  adaptTriadStreamToRotateInstructions,
  adaptTriadStreamToSwapInstructions,
  adaptTriadStreamToInstructionPlan,
  assertTriadInstructionPlan,
};
