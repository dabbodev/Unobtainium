'use strict';

const crypto = require('node:crypto');

const {
  createGenerationDescriptor,
  residualCommitment,
} = require('./generation-descriptor');
const {
  generateFromStack,
  normalizeGenerationData,
  residualBetween,
} = require('./generation');
const { normalizeTurns } = require('./ring');
const { scoreResidual } = require('./fit-naive');
const { stableStringify, stackCommitment } = require('./stack-canonical');
const { verifySignedStackEnvelope } = require('./signed-stack');

const CASCADE_RUN_FORMAT = 'UN-CASCADE-RUN';
const CASCADE_REPORT_FORMAT = 'UN-CASCADE-REPORT';
const CASCADE_VERSION = 1;
const CASCADE_CANDIDATE_COMMITMENT_DOMAIN = 'UN-CASCADE-CANDIDATE:v1';
const CASCADE_REPORT_COMMITMENT_DOMAIN = 'UN-CASCADE-REPORT:v1';
const DATA_TYPES = new Set(['array', 'uint8array', 'buffer']);

function sha256Hex(domain, payload) {
  return crypto
    .createHash('sha256')
    .update(domain)
    .update(Buffer.from([0]))
    .update(stableStringify(payload))
    .digest('hex');
}

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

function assertWindowSize(windowSize) {
  if (!Number.isInteger(windowSize)) {
    throw new TypeError('windowSize must be an integer');
  }
  if (windowSize <= 1) {
    throw new RangeError('windowSize must be greater than 1');
  }
}

function assertDataType(type) {
  if (!DATA_TYPES.has(type)) {
    throw new RangeError('type must be "array", "uint8array", or "buffer"');
  }
}

function assertFill({ fill, windowSize, type }) {
  if (!Number.isInteger(fill)) {
    throw new TypeError('fill must be an integer');
  }

  const normalizedFill = normalizeTurns(fill, windowSize);
  if ((type === 'uint8array' || type === 'buffer') && (normalizedFill < 0 || normalizedFill > 255)) {
    throw new RangeError(`${type} fill must fit in one byte`);
  }
}

function assertSha256Hex(value, fieldName) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
    throw new TypeError(`${fieldName} must be a SHA-256 hex string`);
  }
}

function cloneCanonicalValue(value, fieldName) {
  try {
    return JSON.parse(stableStringify(value));
  } catch (error) {
    error.message = `${fieldName} must be canonical plain data: ${error.message}`;
    throw error;
  }
}

function normalizeCascadeOptions({
  windowSize = 256,
  type = 'array',
  fill = 0,
}) {
  assertWindowSize(windowSize);
  assertDataType(type);
  assertFill({ fill, windowSize, type });

  return { windowSize, type, fill };
}

function candidateId(candidate) {
  if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
    throw new TypeError('candidate.id must be a non-empty string');
  }

  return candidate.id;
}

function stacksMatch(left, right) {
  return stackCommitment(left) === stackCommitment(right);
}

function resolveCandidateMaterial(candidate) {
  assertObject(candidate, 'candidate');
  const id = candidateId(candidate);
  const hasStack = Object.hasOwn(candidate, 'stack');
  const hasSignedStackEnvelope = Object.hasOwn(candidate, 'signedStackEnvelope');

  if (!hasStack && !hasSignedStackEnvelope) {
    throw new TypeError('candidate must supply stack or signedStackEnvelope');
  }

  if (!hasSignedStackEnvelope) {
    return {
      id,
      stack: candidate.stack,
      stackCommitment: stackCommitment(candidate.stack),
      signedStackPayloadCommitment: null,
    };
  }

  const signedResult = verifySignedStackEnvelope(candidate.signedStackEnvelope);
  if (!signedResult.valid) {
    throw new TypeError(`signedStackEnvelope is invalid: ${signedResult.reason}`);
  }

  if (hasStack && !stacksMatch(candidate.stack, candidate.signedStackEnvelope.stack)) {
    throw new TypeError('candidate stack must match signedStackEnvelope.stack');
  }

  return {
    id,
    stack: hasStack ? candidate.stack : candidate.signedStackEnvelope.stack,
    stackCommitment: signedResult.stackCommitment,
    signedStackPayloadCommitment: signedResult.payloadCommitment,
  };
}

function candidateCommitment({
  material,
  metadata,
  windowSize,
  type,
  fill,
}) {
  return sha256Hex(CASCADE_CANDIDATE_COMMITMENT_DOMAIN, {
    id: material.id,
    stackCommitment: material.stackCommitment,
    signedStackPayloadCommitment: material.signedStackPayloadCommitment,
    windowSize,
    type,
    fill,
    metadata,
  });
}

function vectorCommitment(data, windowSize) {
  return residualCommitment(data, { windowSize });
}

function layerForCandidate({
  candidate,
  index,
  currentTarget,
  targetLength,
  windowSize,
  type,
  fill,
  runMetadata,
}) {
  const material = resolveCandidateMaterial(candidate);
  const candidateMetadata = cloneCanonicalValue(
    candidate.metadata === undefined ? {} : candidate.metadata,
    'candidate.metadata',
  );
  const inputTargetCommitment = vectorCommitment(currentTarget, windowSize);
  const generated = generateFromStack({
    length: targetLength,
    stack: material.stack,
    windowSize,
    type,
    fill,
  });
  const residual = residualBetween({
    target: currentTarget,
    generated,
    windowSize,
  });
  const descriptor = createGenerationDescriptor({
    length: targetLength,
    stack: Object.hasOwn(candidate, 'stack') ? candidate.stack : undefined,
    signedStackEnvelope: Object.hasOwn(candidate, 'signedStackEnvelope')
      ? candidate.signedStackEnvelope
      : undefined,
    target: currentTarget,
    residual,
    windowSize,
    type,
    fill,
    metadata: cloneCanonicalValue({
      cascade: {
        layerIndex: index,
        candidateId: material.id,
      },
      candidate: candidateMetadata,
      run: runMetadata,
    }, 'descriptor metadata'),
  });

  return {
    layer: {
      index,
      candidateId: material.id,
      candidateCommitment: candidateCommitment({
        material,
        metadata: candidateMetadata,
        windowSize,
        type,
        fill,
      }),
      stackCommitment: material.stackCommitment,
      signedStackPayloadCommitment: material.signedStackPayloadCommitment,
      inputTargetCommitment,
      generatedCommitment: descriptor.generatedCommitment,
      residualCommitment: descriptor.residualCommitment,
      descriptorCommitment: descriptor.descriptorCommitment,
      score: scoreResidual(residual, { windowSize }),
      metadata: candidateMetadata,
    },
    residual,
  };
}

function runCascade({
  target,
  candidates,
  windowSize = 256,
  type = 'array',
  fill = 0,
  metadata = {},
}) {
  if (!Array.isArray(candidates)) {
    throw new TypeError('candidates must be an array');
  }

  const options = normalizeCascadeOptions({ windowSize, type, fill });
  const normalizedTarget = normalizeGenerationData(target, options.windowSize, 'target');
  const normalizedMetadata = cloneCanonicalValue(metadata, 'metadata');
  const originalTargetCommitment = vectorCommitment(normalizedTarget.values, options.windowSize);
  let currentTarget = normalizedTarget.values.slice();
  const layers = [];

  candidates.forEach((candidate, index) => {
    const result = layerForCandidate({
      candidate,
      index,
      currentTarget,
      targetLength: normalizedTarget.length,
      windowSize: options.windowSize,
      type: options.type,
      fill: options.fill,
      runMetadata: normalizedMetadata,
    });
    layers.push(result.layer);
    currentTarget = result.residual;
  });

  const finalResidualCommitment = vectorCommitment(currentTarget, options.windowSize);
  const finalScore = scoreResidual(currentTarget, { windowSize: options.windowSize });

  return {
    format: CASCADE_RUN_FORMAT,
    version: CASCADE_VERSION,
    windowSize: options.windowSize,
    type: options.type,
    fill,
    targetLength: normalizedTarget.length,
    originalTargetCommitment,
    finalResidualCommitment,
    layerCount: layers.length,
    layers,
    finalScore,
    metadata: normalizedMetadata,
  };
}

function cascadeReportPayload(reportLike) {
  assertObject(reportLike, 'report');

  for (const fieldName of [
    'format',
    'version',
    'runFormat',
    'runVersion',
    'windowSize',
    'type',
    'fill',
    'targetLength',
    'originalTargetCommitment',
    'finalResidualCommitment',
    'layerCount',
    'layers',
    'finalScore',
    'metadata',
  ]) {
    assertOwnField(reportLike, fieldName);
  }

  if (reportLike.format !== CASCADE_REPORT_FORMAT) {
    throw new TypeError('report format is not UN-CASCADE-REPORT');
  }
  if (reportLike.version !== CASCADE_VERSION) {
    throw new TypeError('report version is not supported');
  }
  if (reportLike.runFormat !== CASCADE_RUN_FORMAT) {
    throw new TypeError('report runFormat is not UN-CASCADE-RUN');
  }
  if (reportLike.runVersion !== CASCADE_VERSION) {
    throw new TypeError('report runVersion is not supported');
  }
  assertWindowSize(reportLike.windowSize);
  assertDataType(reportLike.type);
  assertFill({
    fill: reportLike.fill,
    windowSize: reportLike.windowSize,
    type: reportLike.type,
  });
  if (!Number.isInteger(reportLike.targetLength) || reportLike.targetLength < 0) {
    throw new TypeError('targetLength must be a non-negative integer');
  }
  assertSha256Hex(reportLike.originalTargetCommitment, 'originalTargetCommitment');
  assertSha256Hex(reportLike.finalResidualCommitment, 'finalResidualCommitment');
  if (!Number.isInteger(reportLike.layerCount) || reportLike.layerCount < 0) {
    throw new TypeError('layerCount must be a non-negative integer');
  }
  if (!Array.isArray(reportLike.layers)) {
    throw new TypeError('layers must be an array');
  }
  if (reportLike.layers.length !== reportLike.layerCount) {
    throw new RangeError('layerCount must match layers length');
  }

  return {
    format: reportLike.format,
    version: reportLike.version,
    runFormat: reportLike.runFormat,
    runVersion: reportLike.runVersion,
    windowSize: reportLike.windowSize,
    type: reportLike.type,
    fill: reportLike.fill,
    targetLength: reportLike.targetLength,
    originalTargetCommitment: reportLike.originalTargetCommitment,
    finalResidualCommitment: reportLike.finalResidualCommitment,
    layerCount: reportLike.layerCount,
    layers: cloneCanonicalValue(reportLike.layers, 'layers'),
    finalScore: cloneCanonicalValue(reportLike.finalScore, 'finalScore'),
    metadata: cloneCanonicalValue(reportLike.metadata, 'metadata'),
  };
}

function cascadeReportCommitment(reportLike) {
  return sha256Hex(CASCADE_REPORT_COMMITMENT_DOMAIN, cascadeReportPayload(reportLike));
}

function createCascadeReport({
  target,
  candidates,
  windowSize = 256,
  type = 'array',
  fill = 0,
  metadata = {},
}) {
  const run = runCascade({
    target,
    candidates,
    windowSize,
    type,
    fill,
    metadata: {
      ...metadata,
      claim: 'deterministic-residual-layering',
    },
  });
  const report = {
    format: CASCADE_REPORT_FORMAT,
    version: CASCADE_VERSION,
    runFormat: run.format,
    runVersion: run.version,
    windowSize: run.windowSize,
    type: run.type,
    fill: run.fill,
    targetLength: run.targetLength,
    originalTargetCommitment: run.originalTargetCommitment,
    finalResidualCommitment: run.finalResidualCommitment,
    layerCount: run.layerCount,
    layers: run.layers,
    finalScore: run.finalScore,
    metadata: run.metadata,
  };

  return {
    ...report,
    reportCommitment: cascadeReportCommitment(report),
  };
}

module.exports = {
  CASCADE_RUN_FORMAT,
  CASCADE_REPORT_FORMAT,
  CASCADE_VERSION,
  runCascade,
  createCascadeReport,
  cascadeReportPayload,
  cascadeReportCommitment,
};
