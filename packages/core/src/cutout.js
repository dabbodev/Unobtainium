'use strict';

const crypto = require('node:crypto');

const { stableStringify } = require('./stack-canonical');

const CUTOUT_FORMAT = 'UN-CUTOUT';
const CUTOUT_VERSION = 1;
const CUTOUT_PAYLOAD_DOMAIN = 'UN-CUTOUT:payload:v1';
const CUTOUT_SPAN_DOMAIN = 'UN-CUTOUT:span:v1';
const CUTOUT_PLAN_DOMAIN = 'UN-CUTOUT:plan:v1';
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

function sha256Hex(parts) {
  const hash = crypto.createHash('sha256');
  parts.forEach((part) => hash.update(part));
  return hash.digest('hex');
}

function assertObject(value, fieldName) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${fieldName} must be an object`);
  }
}

function assertSafeInteger(value, fieldName) {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${fieldName} must be a safe integer`);
  }
}

function assertSha256Hex(value, fieldName) {
  if (typeof value !== 'string' || !SHA256_HEX_PATTERN.test(value)) {
    throw new TypeError(`${fieldName} must be a lowercase SHA-256 hex commitment`);
  }
  return value;
}

function assertNullableSha256Hex(value, fieldName) {
  if (value === null) {
    return null;
  }
  return assertSha256Hex(value, fieldName);
}

function cloneCanonicalValue(value, fieldName) {
  try {
    return JSON.parse(stableStringify(value));
  } catch (error) {
    error.message = `${fieldName} must be canonical plain data: ${error.message}`;
    throw error;
  }
}

function normalizeBytes(input, fieldName = 'payload') {
  if (Buffer.isBuffer(input)) {
    return Buffer.from(input);
  }
  if (input instanceof Uint8Array) {
    return Buffer.from(input);
  }
  if (Array.isArray(input)) {
    const output = Buffer.alloc(input.length);
    for (let index = 0; index < input.length; index += 1) {
      const value = input[index];
      if (!Number.isInteger(value) || value < 0 || value > 255) {
        throw new RangeError(`${fieldName}[${index}] must be an integer byte in 0..255`);
      }
      output[index] = value;
    }
    return output;
  }

  throw new TypeError(`${fieldName} must be a Buffer, Uint8Array, or Array of bytes`);
}

function normalizeLabel(value, fieldName) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new TypeError(`${fieldName} must be a string when supplied`);
  }
  return value;
}

function normalizePayloadLength(value) {
  assertSafeInteger(value, 'payloadLength');
  if (value < 0) {
    throw new RangeError('payloadLength must be a non-negative safe integer');
  }
  return value;
}

function normalizeFillByte(value) {
  const fillByte = value === undefined ? 0 : value;
  if (!Number.isInteger(fillByte) || fillByte < 0 || fillByte > 255) {
    throw new RangeError('fillByte must be an integer byte in 0..255');
  }
  return fillByte;
}

function normalizeFillMode(value) {
  const fillMode = value === undefined ? 'byte' : value;
  if (fillMode !== 'byte') {
    throw new RangeError('fillMode must be "byte"');
  }
  return fillMode;
}

function normalizeSpan(spanLike, payloadLength, index) {
  assertObject(spanLike, `spans[${index}]`);
  assertSafeInteger(spanLike.offset, `spans[${index}].offset`);
  assertSafeInteger(spanLike.length, `spans[${index}].length`);
  if (spanLike.offset < 0) {
    throw new RangeError(`spans[${index}].offset must be non-negative`);
  }
  if (spanLike.length <= 0) {
    throw new RangeError(`spans[${index}].length must be positive`);
  }
  if (spanLike.offset + spanLike.length > payloadLength) {
    throw new RangeError(`spans[${index}] must be within payloadLength`);
  }

  return {
    offset: spanLike.offset,
    length: spanLike.length,
    label: normalizeLabel(spanLike.label, `spans[${index}].label`),
    spanCommitment: assertNullableSha256Hex(
      spanLike.spanCommitment === undefined ? null : spanLike.spanCommitment,
      `spans[${index}].spanCommitment`,
    ),
  };
}

function normalizeSpans(spansLike, payloadLength) {
  if (!Array.isArray(spansLike)) {
    throw new TypeError('spans must be an array');
  }

  const spans = spansLike.map((span, index) => normalizeSpan(span, payloadLength, index));
  let previousEnd = 0;
  for (let index = 0; index < spans.length; index += 1) {
    const span = spans[index];
    if (index > 0 && span.offset < previousEnd) {
      throw new RangeError('spans must be sorted by offset and must not overlap');
    }
    previousEnd = span.offset + span.length;
  }

  return spans;
}

function cutoutPlanPayload(planLike) {
  assertObject(planLike, 'cutoutPlan');
  if (planLike.format !== undefined && planLike.format !== CUTOUT_FORMAT) {
    throw new TypeError('cutoutPlan format is not UN-CUTOUT');
  }
  if (planLike.version !== undefined && planLike.version !== CUTOUT_VERSION) {
    throw new TypeError('cutoutPlan version is not supported');
  }

  const payloadLength = normalizePayloadLength(
    planLike.payloadLength === undefined ? planLike.length : planLike.payloadLength,
  );
  const payload = {
    format: CUTOUT_FORMAT,
    version: CUTOUT_VERSION,
    payloadLength,
    fillMode: normalizeFillMode(planLike.fillMode),
    fillByte: normalizeFillByte(planLike.fillByte),
    spans: normalizeSpans(planLike.spans, payloadLength),
    originalPayloadCommitment: assertNullableSha256Hex(
      planLike.originalPayloadCommitment === undefined ? null : planLike.originalPayloadCommitment,
      'originalPayloadCommitment',
    ),
    label: normalizeLabel(planLike.label, 'label'),
    context: cloneCanonicalValue(planLike.context === undefined ? {} : planLike.context, 'context'),
    metadata: cloneCanonicalValue(planLike.metadata === undefined ? {} : planLike.metadata, 'metadata'),
  };

  return cloneCanonicalValue(payload, 'cutoutPlan');
}

function cutoutPlanCommitment(planLike) {
  return sha256Hex([
    Buffer.from(CUTOUT_PLAN_DOMAIN, 'utf8'),
    Buffer.from([0]),
    Buffer.from(stableStringify(cutoutPlanPayload(planLike)), 'utf8'),
  ]);
}

function normalizeCutoutPlan(planLike) {
  const payload = cutoutPlanPayload(planLike);
  const commitment = cutoutPlanCommitment(payload);
  if (
    Object.hasOwn(planLike, 'cutoutPlanCommitment')
    && planLike.cutoutPlanCommitment !== commitment
  ) {
    throw new RangeError('cutoutPlanCommitment mismatch');
  }

  return {
    ...payload,
    cutoutPlanCommitment: commitment,
  };
}

function payloadCommitment(payload) {
  const bytes = normalizeBytes(payload, 'payload');
  const committed = {
    format: `${CUTOUT_FORMAT}-PAYLOAD`,
    version: CUTOUT_VERSION,
    length: bytes.length,
    bytesHex: bytes.toString('hex'),
  };

  return sha256Hex([
    Buffer.from(CUTOUT_PAYLOAD_DOMAIN, 'utf8'),
    Buffer.from([0]),
    Buffer.from(stableStringify(committed), 'utf8'),
  ]);
}

function cutoutSpanCommitment(spanPayload, spanLike = {}) {
  const bytes = normalizeBytes(spanPayload, 'spanPayload');
  assertSafeInteger(spanLike.offset === undefined ? 0 : spanLike.offset, 'span.offset');
  const offset = spanLike.offset === undefined ? 0 : spanLike.offset;
  if (offset < 0) {
    throw new RangeError('span.offset must be non-negative');
  }
  const length = spanLike.length === undefined ? bytes.length : spanLike.length;
  assertSafeInteger(length, 'span.length');
  if (length <= 0) {
    throw new RangeError('span.length must be positive');
  }
  if (bytes.length !== length) {
    throw new RangeError('spanPayload length must match span.length');
  }

  const committed = {
    format: `${CUTOUT_FORMAT}-SPAN`,
    version: CUTOUT_VERSION,
    offset,
    length,
    label: normalizeLabel(spanLike.label, 'span.label'),
    bytesHex: bytes.toString('hex'),
  };

  return sha256Hex([
    Buffer.from(CUTOUT_SPAN_DOMAIN, 'utf8'),
    Buffer.from([0]),
    Buffer.from(stableStringify(committed), 'utf8'),
  ]);
}

function planInputForPayload(payload, planLike) {
  assertObject(planLike, 'cutoutPlan');
  return {
    ...planLike,
    payloadLength: planLike.payloadLength === undefined ? payload.length : planLike.payloadLength,
  };
}

function applyFill(publicPayload, span, fillByte) {
  for (let index = span.offset; index < span.offset + span.length; index += 1) {
    publicPayload[index] = fillByte;
  }
}

function withCommittedSpans(payload, normalizedPlan) {
  const originalPayloadCommitment = payloadCommitment(payload);
  const spans = normalizedPlan.spans.map((span) => {
    const spanPayload = payload.subarray(span.offset, span.offset + span.length);
    return {
      ...span,
      spanCommitment: cutoutSpanCommitment(spanPayload, span),
    };
  });
  const {
    cutoutPlanCommitment: _ignoredCutoutPlanCommitment,
    ...planPayload
  } = normalizedPlan;

  return normalizeCutoutPlan({
    ...planPayload,
    spans,
    originalPayloadCommitment,
  });
}

function clonePlan(plan) {
  return normalizeCutoutPlan(plan);
}

function cloneHiddenSpans(hiddenSpans) {
  return hiddenSpans.map((span) => ({
    offset: span.offset,
    length: span.length,
    label: span.label,
    spanCommitment: span.spanCommitment,
    payload: Buffer.from(span.payload),
  }));
}

function applyCutout(payloadLike, planLike) {
  const payload = normalizeBytes(payloadLike, 'payload');
  const preliminaryPlan = normalizeCutoutPlan(planInputForPayload(payload, planLike));
  if (preliminaryPlan.payloadLength !== payload.length) {
    throw new RangeError('payload length must match cutoutPlan payloadLength');
  }

  const plan = withCommittedSpans(payload, preliminaryPlan);
  const publicPayload = Buffer.from(payload);
  const hiddenSpans = plan.spans.map((span) => {
    const spanPayload = payload.subarray(span.offset, span.offset + span.length);
    applyFill(publicPayload, span, plan.fillByte);
    return {
      offset: span.offset,
      length: span.length,
      label: span.label,
      spanCommitment: span.spanCommitment,
      payload: Buffer.from(spanPayload),
    };
  });
  const publicPayloadCommitment = payloadCommitment(publicPayload);
  const planCopy = clonePlan(plan);

  return {
    ...planCopy,
    plan: clonePlan(planCopy),
    publicPayload: Buffer.from(publicPayload),
    hiddenSpans: cloneHiddenSpans(hiddenSpans),
    originalPayloadCommitment: plan.originalPayloadCommitment,
    publicPayloadCommitment,
    cutoutPlanCommitment: plan.cutoutPlanCommitment,
  };
}

function createCutout(payloadLike, planLike) {
  return applyCutout(payloadLike, planLike);
}

function invalid(reason, fields = {}) {
  return {
    ...cloneCanonicalValue(fields, 'fields'),
    ok: false,
    valid: false,
    reason,
    error: reason,
  };
}

function valid(fields) {
  return {
    ok: true,
    valid: true,
    ...fields,
  };
}

function materialFrom(input, options) {
  if (input !== null && typeof input === 'object' && !Array.isArray(input)) {
    const plan = input.plan || input.cutoutPlan || (
      Object.hasOwn(input, 'spans') ? input : undefined
    );
    return {
      plan,
      publicPayload: input.publicPayload === undefined ? options.publicPayload : input.publicPayload,
      hiddenSpans: input.hiddenSpans === undefined ? options.hiddenSpans : input.hiddenSpans,
      originalPayloadCommitment: input.originalPayloadCommitment === undefined
        ? options.originalPayloadCommitment
        : input.originalPayloadCommitment,
      publicPayloadCommitment: input.publicPayloadCommitment === undefined
        ? options.publicPayloadCommitment
        : input.publicPayloadCommitment,
    };
  }

  return {
    plan: input,
    publicPayload: options.publicPayload,
    hiddenSpans: options.hiddenSpans,
    originalPayloadCommitment: options.originalPayloadCommitment,
    publicPayloadCommitment: options.publicPayloadCommitment,
  };
}

function spanPayloadFromEntry(entry, expected, index) {
  if (Buffer.isBuffer(entry) || entry instanceof Uint8Array || Array.isArray(entry)) {
    return normalizeBytes(entry, `hiddenSpans[${index}]`);
  }

  assertObject(entry, `hiddenSpans[${index}]`);
  if (entry.offset !== undefined && entry.offset !== expected.offset) {
    throw new RangeError(`hiddenSpans[${index}].offset mismatch`);
  }
  if (entry.length !== undefined && entry.length !== expected.length) {
    throw new RangeError(`hiddenSpans[${index}].length mismatch`);
  }
  if (entry.label !== undefined && entry.label !== expected.label) {
    throw new RangeError(`hiddenSpans[${index}].label mismatch`);
  }
  const bytes = entry.payload === undefined
    ? entry.bytes === undefined
      ? entry.data
      : entry.bytes
    : entry.payload;
  if (bytes === undefined) {
    throw new TypeError(`hiddenSpans[${index}] must include payload bytes`);
  }

  return normalizeBytes(bytes, `hiddenSpans[${index}].payload`);
}

function verifyPublicPayload(publicPayload, plan) {
  if (publicPayload.length !== plan.payloadLength) {
    throw new RangeError('publicPayload length must match cutoutPlan payloadLength');
  }

  for (let spanIndex = 0; spanIndex < plan.spans.length; spanIndex += 1) {
    const span = plan.spans[spanIndex];
    for (let index = span.offset; index < span.offset + span.length; index += 1) {
      if (publicPayload[index] !== plan.fillByte) {
        throw new RangeError(`publicPayload fill mismatch for span ${spanIndex}`);
      }
    }
  }
}

function verifyHiddenSpans(hiddenSpansLike, plan) {
  if (hiddenSpansLike === undefined) {
    return {
      complete: false,
      hiddenSpans: [],
      details: plan.spans.map((span, index) => ({
        index,
        offset: span.offset,
        length: span.length,
        ok: false,
        reason: 'hidden span not supplied',
        spanCommitment: span.spanCommitment,
      })),
    };
  }
  if (!Array.isArray(hiddenSpansLike)) {
    throw new TypeError('hiddenSpans must be an array');
  }
  if (hiddenSpansLike.length !== plan.spans.length) {
    throw new RangeError('hiddenSpans length must match cutoutPlan spans length');
  }

  const hiddenSpans = [];
  const details = [];
  for (let index = 0; index < plan.spans.length; index += 1) {
    const span = plan.spans[index];
    if (span.spanCommitment === null) {
      throw new TypeError(`spans[${index}].spanCommitment is required`);
    }
    const bytes = spanPayloadFromEntry(hiddenSpansLike[index], span, index);
    if (bytes.length !== span.length) {
      throw new RangeError(`hiddenSpans[${index}] length must match span length`);
    }
    const suppliedSpanCommitment = cutoutSpanCommitment(bytes, span);
    const ok = suppliedSpanCommitment === span.spanCommitment;
    details.push({
      index,
      offset: span.offset,
      length: span.length,
      ok,
      spanCommitment: span.spanCommitment,
      suppliedSpanCommitment,
      reason: ok ? null : 'spanCommitment mismatch',
    });
    if (!ok) {
      throw new RangeError(`hiddenSpans[${index}] spanCommitment mismatch`);
    }
    hiddenSpans.push({
      offset: span.offset,
      length: span.length,
      label: span.label,
      spanCommitment: span.spanCommitment,
      payload: Buffer.from(bytes),
    });
  }

  return {
    complete: true,
    hiddenSpans,
    details,
  };
}

function reconstructPayload(publicPayload, hiddenSpans) {
  const reconstructed = Buffer.from(publicPayload);
  hiddenSpans.forEach((span) => {
    Buffer.from(span.payload).copy(reconstructed, span.offset);
  });
  return reconstructed;
}

function verifyCutout(input, options = {}) {
  try {
    const material = materialFrom(input, options);
    const plan = normalizeCutoutPlan(material.plan);
    const fields = {
      cutoutPlanCommitment: plan.cutoutPlanCommitment,
      originalPayloadCommitment: plan.originalPayloadCommitment,
    };

    let publicPayload;
    let publicPayloadCommitmentValue = null;
    if (material.publicPayload !== undefined) {
      publicPayload = normalizeBytes(material.publicPayload, 'publicPayload');
      verifyPublicPayload(publicPayload, plan);
      publicPayloadCommitmentValue = payloadCommitment(publicPayload);
      if (
        material.publicPayloadCommitment !== undefined
        && material.publicPayloadCommitment !== publicPayloadCommitmentValue
      ) {
        return invalid('publicPayloadCommitment mismatch', {
          ...fields,
          publicPayloadCommitment: publicPayloadCommitmentValue,
        });
      }
    }

    const hidden = verifyHiddenSpans(material.hiddenSpans, plan);
    const spanVerification = cloneCanonicalValue(hidden.details, 'spanVerification');
    const expectedOriginalCommitment = material.originalPayloadCommitment === undefined
      ? plan.originalPayloadCommitment
      : material.originalPayloadCommitment;
    if (expectedOriginalCommitment !== null && expectedOriginalCommitment !== undefined) {
      assertSha256Hex(expectedOriginalCommitment, 'originalPayloadCommitment');
      if (
        plan.originalPayloadCommitment !== null
        && expectedOriginalCommitment !== plan.originalPayloadCommitment
      ) {
        return invalid('originalPayloadCommitment mismatch', {
          ...fields,
          publicPayloadCommitment: publicPayloadCommitmentValue,
          spanVerification,
        });
      }
    }

    let reconstructedPayloadCommitment = null;
    if (publicPayload !== undefined && hidden.complete) {
      const reconstructed = reconstructPayload(publicPayload, hidden.hiddenSpans);
      reconstructedPayloadCommitment = payloadCommitment(reconstructed);
      if (
        expectedOriginalCommitment !== null
        && expectedOriginalCommitment !== undefined
        && reconstructedPayloadCommitment !== expectedOriginalCommitment
      ) {
        return invalid('reconstructed payload commitment mismatch', {
          ...fields,
          publicPayloadCommitment: publicPayloadCommitmentValue,
          reconstructedPayloadCommitment,
          spanVerification,
        });
      }
    }

    return valid({
      cutoutPlanCommitment: plan.cutoutPlanCommitment,
      originalPayloadCommitment: expectedOriginalCommitment === undefined
        ? plan.originalPayloadCommitment
        : expectedOriginalCommitment,
      publicPayloadCommitment: publicPayloadCommitmentValue,
      reconstructedPayloadCommitment,
      spanVerification,
      plan: clonePlan(plan),
    });
  } catch (error) {
    return invalid(error.message);
  }
}

function restoreCutout(input, options = {}) {
  try {
    const material = materialFrom(input, options);
    if (material.publicPayload === undefined) {
      return invalid('publicPayload is required');
    }
    if (material.hiddenSpans === undefined) {
      return invalid('hiddenSpans are required');
    }

    const verification = verifyCutout(input, options);
    if (!verification.ok) {
      return verification;
    }

    const plan = normalizeCutoutPlan(material.plan);
    const publicPayload = normalizeBytes(material.publicPayload, 'publicPayload');
    const hidden = verifyHiddenSpans(material.hiddenSpans, plan);
    const restoredPayload = reconstructPayload(publicPayload, hidden.hiddenSpans);

    return valid({
      cutoutPlanCommitment: plan.cutoutPlanCommitment,
      originalPayloadCommitment: verification.originalPayloadCommitment,
      publicPayloadCommitment: verification.publicPayloadCommitment,
      reconstructedPayloadCommitment: payloadCommitment(restoredPayload),
      restoredPayload: Buffer.from(restoredPayload),
      payload: Buffer.from(restoredPayload),
      spanVerification: verification.spanVerification,
      plan: clonePlan(plan),
    });
  } catch (error) {
    return invalid(error.message);
  }
}

module.exports = {
  CUTOUT_FORMAT,
  CUTOUT_VERSION,
  normalizeCutoutPlan,
  cutoutPlanPayload,
  cutoutPlanCommitment,
  createCutout,
  applyCutout,
  verifyCutout,
  restoreCutout,
  cutoutSpanCommitment,
  payloadCommitment,
};
