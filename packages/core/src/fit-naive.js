'use strict';

const crypto = require('node:crypto');

const { objectCommitment } = require('./gate');
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
const { stableStringify, stackCommitment } = require('./stack-canonical');
const { verifySignedStackEnvelope } = require('./signed-stack');

const FIT_REPORT_FORMAT = 'UN-FIT-NAIVE-REPORT';
const FIT_REPORT_VERSION = 1;
const CANDIDATE_COMMITMENT_DOMAIN = 'UN-FIT-NAIVE-CANDIDATE:v1';
const FIT_REPORT_COMMITMENT_DOMAIN = 'UN-FIT-NAIVE-REPORT:v1';
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

function cloneCanonicalValue(value, fieldName) {
  try {
    return JSON.parse(stableStringify(value));
  } catch (error) {
    error.message = `${fieldName} must be canonical plain data: ${error.message}`;
    throw error;
  }
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
  return sha256Hex(CANDIDATE_COMMITMENT_DOMAIN, {
    id: material.id,
    stackCommitment: material.stackCommitment,
    signedStackPayloadCommitment: material.signedStackPayloadCommitment,
    windowSize,
    type,
    fill,
    metadata,
  });
}

function normalizeEvaluationOptions({
  windowSize = 256,
  type = 'array',
  fill = 0,
}) {
  assertWindowSize(windowSize);
  assertDataType(type);
  assertFill({ fill, windowSize, type });

  return { windowSize, type, fill };
}

function scoreResidual(residual, options = {}) {
  const { windowSize = 256 } = options;
  assertWindowSize(windowSize);

  if (!Array.isArray(residual) && !Buffer.isBuffer(residual) && !(residual instanceof Uint8Array)) {
    throw new TypeError('residual must be an Array, Uint8Array, or Buffer');
  }

  let zeroCount = 0;
  let sumAbsDelta = 0;
  let maxAbsDelta = 0;
  const values = [];

  for (let index = 0; index < residual.length; index += 1) {
    const value = residual[index];
    if (!Number.isInteger(value)) {
      throw new TypeError(`residual[${index}] must be an integer`);
    }
    if (value < 0 || value >= windowSize) {
      throw new RangeError(`residual[${index}] must be in 0..windowSize-1`);
    }

    values.push(value);
    if (value === 0) {
      zeroCount += 1;
    }

    const absDelta = Math.min(value, windowSize - value);
    sumAbsDelta += absDelta;
    if (absDelta > maxAbsDelta) {
      maxAbsDelta = absDelta;
    }
  }

  const residualLength = values.length;
  const nonZeroCount = residualLength - zeroCount;

  return {
    residualLength,
    zeroCount,
    nonZeroCount,
    sumAbsDelta,
    meanAbsDelta: residualLength === 0 ? 0 : sumAbsDelta / residualLength,
    maxAbsDelta,
    estimatedJsonSize: Buffer.byteLength(JSON.stringify(values), 'utf8'),
    exactZeroResidual: nonZeroCount === 0,
  };
}

function evaluateGenerationCandidate({
  target,
  candidate,
  windowSize = 256,
  type = 'array',
  fill = 0,
  metadata = {},
}) {
  const options = normalizeEvaluationOptions({ windowSize, type, fill });
  const normalizedTarget = normalizeGenerationData(target, options.windowSize, 'target');
  const material = resolveCandidateMaterial(candidate);
  const candidateMetadata = cloneCanonicalValue(candidate.metadata === undefined ? {} : candidate.metadata, 'candidate.metadata');
  const descriptorMetadata = cloneCanonicalValue({
    candidate: candidateMetadata,
    evaluation: metadata,
  }, 'metadata');

  const generated = generateFromStack({
    length: normalizedTarget.length,
    stack: material.stack,
    windowSize: options.windowSize,
    type: options.type,
    fill: options.fill,
  });
  const residual = residualBetween({
    target,
    generated,
    windowSize: options.windowSize,
  });
  const score = scoreResidual(residual, { windowSize: options.windowSize });
  const descriptorOptions = {
    length: normalizedTarget.length,
    stack: Object.hasOwn(candidate, 'stack') ? candidate.stack : undefined,
    signedStackEnvelope: Object.hasOwn(candidate, 'signedStackEnvelope')
      ? candidate.signedStackEnvelope
      : undefined,
    target,
    residual,
    windowSize: options.windowSize,
    type: options.type,
    fill: options.fill,
    metadata: descriptorMetadata,
  };
  const descriptor = createGenerationDescriptor(descriptorOptions);

  return {
    id: material.id,
    candidateCommitment: candidateCommitment({
      material,
      metadata: candidateMetadata,
      windowSize: options.windowSize,
      type: options.type,
      fill: options.fill,
    }),
    generatedCommitment: descriptor.generatedCommitment,
    residualCommitment: descriptor.residualCommitment,
    targetCommitment: objectCommitment(normalizedTarget.values),
    descriptorCommitment: descriptor.descriptorCommitment,
    score,
    metadata: candidateMetadata,
  };
}

function compareCandidateEvaluations(left, right) {
  const leftScore = left.score;
  const rightScore = right.score;

  return (
    leftScore.nonZeroCount - rightScore.nonZeroCount
    || leftScore.sumAbsDelta - rightScore.sumAbsDelta
    || leftScore.estimatedJsonSize - rightScore.estimatedJsonSize
    || left.id.localeCompare(right.id)
  );
}

function rankGenerationCandidates({
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

  if (candidates.length === 0) {
    return [];
  }

  const evaluated = candidates.map((candidate) => evaluateGenerationCandidate({
    target,
    candidate,
    windowSize,
    type,
    fill,
    metadata,
  }));

  return evaluated.slice().sort(compareCandidateEvaluations);
}

function fitReportPayload(reportLike) {
  assertObject(reportLike, 'report');

  return {
    format: reportLike.format,
    version: reportLike.version,
    targetCommitment: reportLike.targetCommitment,
    targetLength: reportLike.targetLength,
    windowSize: reportLike.windowSize,
    type: reportLike.type,
    fill: reportLike.fill,
    candidateCount: reportLike.candidateCount,
    rankings: cloneCanonicalValue(reportLike.rankings, 'rankings'),
    metadata: cloneCanonicalValue(reportLike.metadata, 'metadata'),
  };
}

function fitReportCommitment(reportLike) {
  return sha256Hex(FIT_REPORT_COMMITMENT_DOMAIN, fitReportPayload(reportLike));
}

function createFitReport({
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

  const options = normalizeEvaluationOptions({ windowSize, type, fill });
  const normalizedTarget = normalizeGenerationData(target, options.windowSize, 'target');
  const normalizedMetadata = cloneCanonicalValue(metadata, 'metadata');
  const rankings = rankGenerationCandidates({
    target,
    candidates,
    windowSize: options.windowSize,
    type: options.type,
    fill: options.fill,
    metadata: normalizedMetadata,
  });
  const payload = {
    format: FIT_REPORT_FORMAT,
    version: FIT_REPORT_VERSION,
    targetCommitment: objectCommitment(normalizedTarget.values),
    targetLength: normalizedTarget.length,
    windowSize: options.windowSize,
    type: options.type,
    fill: options.fill,
    candidateCount: candidates.length,
    rankings,
    metadata: normalizedMetadata,
  };

  return {
    ...payload,
    reportCommitment: fitReportCommitment(payload),
  };
}

module.exports = {
  FIT_REPORT_FORMAT,
  FIT_REPORT_VERSION,
  scoreResidual,
  evaluateGenerationCandidate,
  rankGenerationCandidates,
  createFitReport,
  fitReportCommitment,
};
