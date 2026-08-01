'use strict';

const assert = require('node:assert/strict');

const core = require('../../packages/core');

const VISUAL_DEMO_FIXTURE_FORMAT = 'UN-GWM-V2-VISUAL-DEMO-FIXTURE';
const VISUAL_DEMO_FIXTURE_VERSION = 2;
const VISUAL_DEMO_CONTEXT_ID = 'gwm-v2-visual-demo-v2';

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalGwmV2VisualDemoScenario() {
  return {
    points: [
      [0, 0, 0],
      [2, 1, 3],
      [5, 8, 13],
      [8, 13, 21],
    ],
    walkOptions: {
      point: 0,
      shift: 1,
      gap: 2,
      horizon: 2,
      ring: 16,
    },
    payloadBytes: [0, 1, 2, 3, 4, 5, 6, 7],
    contextId: VISUAL_DEMO_CONTEXT_ID,
    context: {},
    metadata: {
      label: VISUAL_DEMO_CONTEXT_ID,
      contextId: VISUAL_DEMO_CONTEXT_ID,
    },
  };
}

function assertPlainObject(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function normalizePayloadBytes(payloadLike) {
  let bytes;

  if (Buffer.isBuffer(payloadLike) || payloadLike instanceof Uint8Array) {
    bytes = Array.from(payloadLike);
  } else if (Array.isArray(payloadLike)) {
    bytes = payloadLike.slice();
  } else {
    throw new TypeError('scenario.payloadBytes must be an array, Buffer, or Uint8Array');
  }

  if (bytes.length === 0) {
    throw new RangeError('scenario.payloadBytes must contain at least one byte');
  }

  bytes.forEach((byte, index) => {
    if (!Number.isInteger(byte) || byte < 0 || byte > 255) {
      throw new RangeError(`scenario.payloadBytes[${index}] must be an integer from 0 through 255`);
    }
  });

  return bytes;
}

function normalizeScenario(scenarioLike) {
  assertPlainObject(scenarioLike, 'scenario');

  for (const fieldName of [
    'points',
    'walkOptions',
    'payloadBytes',
    'contextId',
    'context',
    'metadata',
  ]) {
    if (!Object.hasOwn(scenarioLike, fieldName)) {
      throw new TypeError(`scenario.${fieldName} is required`);
    }
  }

  assertPlainObject(scenarioLike.walkOptions, 'scenario.walkOptions');
  assertPlainObject(scenarioLike.context, 'scenario.context');
  assertPlainObject(scenarioLike.metadata, 'scenario.metadata');
  if (typeof scenarioLike.contextId !== 'string' || scenarioLike.contextId.length === 0) {
    throw new TypeError('scenario.contextId must be a non-empty string');
  }
  if (scenarioLike.metadata.contextId !== scenarioLike.contextId) {
    throw new RangeError('scenario.metadata.contextId must match scenario.contextId');
  }

  const payloadBytes = normalizePayloadBytes(scenarioLike.payloadBytes);
  if (
    Object.hasOwn(scenarioLike.context, 'payloadLength')
    && scenarioLike.context.payloadLength !== payloadBytes.length
  ) {
    throw new RangeError('scenario.context.payloadLength must match scenario.payloadBytes length');
  }

  return {
    points: scenarioLike.points,
    walkOptions: scenarioLike.walkOptions,
    payloadBytes,
    contextId: scenarioLike.contextId,
    context: {
      ...cloneJson(scenarioLike.context),
      payloadLength: payloadBytes.length,
    },
    metadata: scenarioLike.metadata,
  };
}

function selectedTriadsFromWalk(sourcePoints, walkOptions, records) {
  let state = {
    point: walkOptions.point,
    shift: walkOptions.shift,
    gap: walkOptions.gap,
  };

  return records.map((record) => {
    const indexes = core.selectTriple(state, sourcePoints.length, 'distinct');
    const expectedTriad = {
      A: sourcePoints[indexes[0]],
      B: sourcePoints[indexes[1]],
      C: sourcePoints[indexes[2]],
    };

    assert.deepEqual(
      record.triad,
      expectedTriad,
      `generated stream triad ${record.index} does not match the distinct walk selection`
    );

    state = core.advanceWalk(state, sourcePoints.length, 'distinct');

    return {
      index: record.index,
      pointIndexes: {
        A: indexes[0],
        B: indexes[1],
        C: indexes[2],
      },
      triad: cloneJson(record.triad),
    };
  });
}

function triadFeatureSummaries(records) {
  return records.map((record) => ({
    recordIndex: record.index,
    angleBucket: record.rule.angleBucket,
    degenerate: record.rule.degenerate,
    mixPattern: record.rule.mixPattern,
    featureCommitment: record.triadFeatureCommitment,
    summary: {
      pointOrderSensitive: record.explain.changedByPointOrder,
      sourceFeatureFamilies: cloneJson(record.rule.sourceFeatureFamilies),
    },
  }));
}

function instructionChannelSummaries(records) {
  return records.map((record) => ({
    recordIndex: record.index,
    rotate: {
      delta: record.rotate.delta,
      direction: record.rotate.direction,
      ring: record.rotate.ring,
      mixPattern: record.rotate.mixPattern,
    },
    position: {
      a: record.position.a,
      b: record.position.b,
      span: record.position.span,
      seed: record.position.seed,
    },
    rule: {
      angleBucket: record.rule.angleBucket,
      degenerate: record.rule.degenerate,
      mixPattern: record.rule.mixPattern,
    },
    instructionCommitment: record.triadInstructionCommitment,
  }));
}

function assertCommitmentChain(
  streamResult,
  adapterPlan,
  transformProof,
  mode,
  verification,
  contextId
) {
  assert.equal(verification.ok, true, verification.error || verification.reason);
  assert.equal(streamResult.sourcePointCommitment, mode.sourcePointCommitment);
  assert.equal(streamResult.triadStreamCommitment, mode.triadStreamCommitment);
  assert.equal(adapterPlan.sourceStreamCommitment, streamResult.triadStreamCommitment);
  assert.equal(adapterPlan.adapterCommitment, mode.adapterPlanCommitment);
  assert.equal(transformProof.sourcePlanCommitment, adapterPlan.adapterCommitment);
  assert.equal(transformProof.proofCommitment, mode.transformProofCommitment);
  assert.equal(mode.descriptorCommitment, mode.descriptor.descriptorCommitment);
  assert.equal(mode.adapterBindingCommitment, mode.adapterBinding.bindingCommitment);
  assert.equal(mode.proofBindingCommitment, mode.proofBinding.bindingCommitment);
  assert.equal(adapterPlan.context.contextId, contextId);
  assert.equal(transformProof.context.contextId, contextId);
  assert.equal(mode.descriptor.context.contextId, contextId);
  assert.equal(mode.context.contextId, contextId);
  assert.equal(mode.metadata.contextId, contextId);
}

function buildGwmV2VisualDemoFixture(scenarioLike) {
  const scenario = normalizeScenario(scenarioLike);
  const streamResult = core.createGwmV2TriadStream(
    scenario.points,
    scenario.walkOptions,
    scenario.context
  );
  const generationContext = {
    ...scenario.context,
    contextId: scenario.contextId,
  };
  const adapterPlan = core.adaptTriadStreamToInstructionPlan(streamResult.triadStream, {
    context: generationContext,
  });
  const roundTrip = core.roundTripTriadInstructionPlan(
    adapterPlan,
    Buffer.from(scenario.payloadBytes),
    { context: generationContext }
  );

  if (roundTrip.roundTrip !== true) {
    throw new Error('generated transform proof did not restore the fixed sample payload');
  }

  const transformProof = roundTrip.applied;
  const descriptor = core.createGwmV2Descriptor({
    sourcePointCommitment: streamResult.sourcePointCommitment,
    walkOptions: streamResult.walkOptions,
    triadStreamCommitment: streamResult.triadStreamCommitment,
    adapterPlanCommitment: adapterPlan.adapterCommitment,
    transformProofCommitment: transformProof.proofCommitment,
    context: generationContext,
    metadata: scenario.metadata,
  });
  const mode = core.createGwmV2Mode({
    descriptor,
    adapterPlan,
    transformProof,
    context: generationContext,
    metadata: scenario.metadata,
  });
  const verification = core.verifyGwmV2Mode(mode);

  assertCommitmentChain(
    streamResult,
    adapterPlan,
    transformProof,
    mode,
    verification,
    scenario.contextId
  );

  const records = streamResult.triadStream.records;
  const selectedTriads = selectedTriadsFromWalk(
    streamResult.sourcePoints,
    streamResult.walkOptions,
    records
  );

  return {
    fixture: {
      format: VISUAL_DEMO_FIXTURE_FORMAT,
      version: VISUAL_DEMO_FIXTURE_VERSION,
      introducedInSprint: 47,
      generatedInSprint: 55,
      purpose: 'Canonical local generated-data fixture for the static UN-GWM-V2 visual explanation. It is explanatory only and is not a security example.',
      generatedFromExistingHelpers: true,
      generationContextId: scenario.contextId,
      fixedSamplePayloadLength: scenario.payloadBytes.length,
      rawPayloadBytesIncluded: false,
      modeVerified: verification.ok,
    },
    points: cloneJson(streamResult.sourcePoints),
    walkOptions: cloneJson(streamResult.walkOptions),
    selectedTriads,
    triadFeatures: triadFeatureSummaries(records),
    instructionChannels: instructionChannelSummaries(records),
    triadStream: {
      format: streamResult.triadStream.format,
      version: streamResult.triadStream.version,
      recordCount: records.length,
      context: cloneJson(streamResult.triadStream.context),
      streamCommitment: streamResult.triadStreamCommitment,
    },
    adapterPlan: {
      format: adapterPlan.format,
      version: adapterPlan.version,
      sourceStreamCommitment: adapterPlan.sourceStreamCommitment,
      rotateInstructionCount: adapterPlan.rotateInstructions.length,
      swapInstructionCount: adapterPlan.swapInstructions.length,
      skippedRecordCount: adapterPlan.skippedRecords.length,
      warningCount: 0,
      adapterCommitment: adapterPlan.adapterCommitment,
    },
    transformProofSummary: {
      format: transformProof.format,
      version: transformProof.version,
      mode: transformProof.mode,
      sourcePlanCommitment: transformProof.sourcePlanCommitment,
      inputPayloadCommitment: transformProof.inputPayloadCommitment,
      outputPayloadCommitment: transformProof.outputPayloadCommitment,
      restoredPayloadCommitment: roundTrip.restoredPayloadCommitment,
      roundtrip: roundTrip.roundTrip,
      appliedOperationCount: transformProof.appliedOperations.length,
      skippedRecordCount: transformProof.skippedRecords.length,
      warningCount: transformProof.warnings.length,
      proofCommitment: transformProof.proofCommitment,
      note: 'The fixed non-secret sample is processed only by this local Node generator. The fixture publishes commitments, counts, and roundtrip success without raw payload or transformed bytes.',
    },
    gwmV2Descriptor: {
      format: mode.descriptor.format,
      version: mode.descriptor.version,
      mode: mode.descriptor.mode,
      sourcePointCommitment: mode.sourcePointCommitment,
      triadStreamCommitment: mode.triadStreamCommitment,
      adapterPlanCommitment: mode.adapterPlanCommitment,
      transformProofCommitment: mode.transformProofCommitment,
      descriptorCommitment: mode.descriptorCommitment,
    },
    gwmV2Mode: {
      format: mode.format,
      version: mode.version,
      mode: mode.mode,
      adapterBindingCommitment: mode.adapterBindingCommitment,
      proofBindingCommitment: mode.proofBindingCommitment,
      modeCommitment: mode.modeCommitment,
    },
    notes: [
      'This fixture is generated locally from the canonical checked-in scenario by existing public core helpers.',
      'The browser remains a static read-only fixture viewer and does not execute core transforms or generate commitments.',
      'The fixed eight-byte sample is non-secret and its raw input, transformed output, and restored output are omitted.',
      'Commitments are deterministic integrity/check artifacts; the fixture is not a security test vector.',
    ],
    securityFraming: {
      notProductionCryptography: true,
      notSecureEncryption: true,
      commitmentsAreIntegrityCheckArtifactsOnly: true,
      visualizationExplainsDeterministicMachineryOnly: true,
      generatedLocallyWithoutNetwork: true,
      fixedSamplePayloadIsNonSecret: true,
      rawPayloadBytesAreOmitted: true,
      mustNotClaim: [
        'authenticated encryption',
        'asymmetric cryptography',
        'identity proof',
        'ownership proof',
        'secure redaction',
        'compression',
        'steganography',
        'tamper-proofing',
        'homomorphic behavior',
        'production authentication',
      ],
    },
  };
}

function serializeGwmV2VisualDemoFixture(fixture) {
  return `${JSON.stringify(fixture, null, 2)}\n`;
}

module.exports = {
  VISUAL_DEMO_FIXTURE_FORMAT,
  VISUAL_DEMO_FIXTURE_VERSION,
  canonicalGwmV2VisualDemoScenario,
  buildGwmV2VisualDemoFixture,
  serializeGwmV2VisualDemoFixture,
};
