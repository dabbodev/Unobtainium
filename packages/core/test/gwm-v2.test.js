'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const core = require('..');
const {
  GWM_V2_FORMAT,
  GWM_V2_VERSION,
  GWM_V2_ADAPTER_BINDING_FORMAT,
  GWM_V2_ADAPTER_BINDING_VERSION,
  GWM_V2_PROOF_BINDING_FORMAT,
  GWM_V2_PROOF_BINDING_VERSION,
  GWM_V2_SOURCE_POINT_FORMAT,
  GWM_V2_SOURCE_POINT_VERSION,
  assertGwmV2SourcePoints,
  gwmV2SourcePointPayload,
  gwmV2SourcePointCommitment,
  createGwmV2TriadStream,
  createGwmV2DescriptorFromPoints,
  normalizeGwmV2Descriptor,
  gwmV2Payload,
  gwmV2Commitment,
  createGwmV2Descriptor,
  gwmV2AdapterBindingPayload,
  gwmV2AdapterBindingCommitment,
  gwmV2ProofBindingPayload,
  gwmV2ProofBindingCommitment,
  verifyGwmV2AdapterPlan,
  bindGwmV2AdapterPlan,
  verifyGwmV2TransformProof,
  bindGwmV2TransformProof,
  createGwmV2DescriptorFromPointsAndAdapter,
  createGwmV2DescriptorFromPointsAdapterAndProof,
  assertGwmV2AdapterBinding,
  assertGwmV2ProofBinding,
  assertGwmV2Descriptor,
} = require('../src/gwm-v2');
const { generateInstructionStream } = require('../src/instruction-stream');
const {
  adaptTriadStreamToInstructionPlan,
  triadAdapterPayload,
  triadAdapterCommitment,
} = require('../src/triad-adapter');
const {
  applyTriadInstructionPlan,
  triadTransformProofPayload,
  triadTransformProofCommitment,
} = require('../src/triad-transform-proof');

const HEX = {
  source: 'a'.repeat(64),
  source2: 'b'.repeat(64),
  stream: 'c'.repeat(64),
  stream2: 'd'.repeat(64),
  adapter: 'e'.repeat(64),
  adapter2: 'f'.repeat(64),
  proof: '0123456789abcdef'.repeat(4),
  proof2: 'fedcba9876543210'.repeat(4),
};

const POINTS = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

const OBJECT_POINTS = [
  { x: 0, y: 0, z: 0 },
  { x: 1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: 0, z: 1 },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function descriptorInput(overrides = {}) {
  return {
    format: GWM_V2_FORMAT,
    version: GWM_V2_VERSION,
    mode: 'UN-GWM-V2',
    sourcePointCommitment: HEX.source,
    walkOptions: {
      point: 0,
      shift: 1,
      gap: 2,
      horizon: 12,
      ring: 5,
    },
    triadStreamCommitment: HEX.stream,
    adapterPlanCommitment: HEX.adapter,
    transformProofCommitment: HEX.proof,
    context: {
      purpose: 'sprint-39-test',
      bounds: { payloadLength: 8 },
    },
    metadata: {
      label: 'fixture',
      flags: ['pure-descriptor'],
    },
    ...overrides,
  };
}

function createFixture(overrides = {}) {
  return createGwmV2Descriptor(descriptorInput(overrides));
}

function gwmV2AdapterFixture(adapterOptions = {}) {
  const walkOptions = { point: 0, shift: 0, gap: 0, horizon: 3, ring: 17 };
  const context = { payloadLength: 8 };
  const stream = createGwmV2TriadStream(POINTS, walkOptions, context);
  const adapterPlan = adaptTriadStreamToInstructionPlan(stream.triadStream, adapterOptions);
  const descriptor = createGwmV2Descriptor({
    sourcePointCommitment: stream.sourcePointCommitment,
    walkOptions: stream.walkOptions,
    triadStreamCommitment: stream.triadStreamCommitment,
    adapterPlanCommitment: adapterPlan.adapterCommitment,
    context,
    metadata: { label: 'adapter-binding' },
  });

  return { stream, descriptor, adapterPlan, walkOptions, context };
}

function gwmV2ProofFixture(adapterOptions = {}) {
  const fixture = gwmV2AdapterFixture(adapterOptions);
  const transformProof = applyTriadInstructionPlan(
    fixture.adapterPlan,
    Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]),
    { context: { proof: 'supplied' } }
  );
  const descriptor = createGwmV2Descriptor({
    ...fixture.descriptor,
    transformProofCommitment: transformProof.proofCommitment,
    metadata: { label: 'proof-binding' },
  });

  return { ...fixture, descriptor, transformProof };
}

function changedAdapterPlan(planLike, mutatePayload) {
  const payload = triadAdapterPayload(planLike);
  mutatePayload(payload);
  return {
    ...payload,
    adapterCommitment: triadAdapterCommitment(payload),
  };
}

function changedTransformProof(proofLike, mutatePayload) {
  const payload = triadTransformProofPayload(proofLike);
  mutatePayload(payload);
  return {
    ...payload,
    proofCommitment: triadTransformProofCommitment(payload),
  };
}

function changedCommitment(fieldOverrides) {
  return createFixture(fieldOverrides).descriptorCommitment;
}

test('normalizes GWM-V2 source points from array points', () => {
  const points = assertGwmV2SourcePoints(POINTS);

  assert.deepEqual(points, POINTS);
  assert.notEqual(points, POINTS);
  assert.notEqual(points[0], POINTS[0]);
});

test('normalizes GWM-V2 source points from object points', () => {
  assert.deepEqual(assertGwmV2SourcePoints(OBJECT_POINTS), POINTS);
});

test('rejects malformed GWM-V2 source points', () => {
  assert.throws(() => assertGwmV2SourcePoints('points'), /points must be an array/);
  assert.throws(() => assertGwmV2SourcePoints([[0, 0]]), /at least 3 points/);
  assert.throws(() => assertGwmV2SourcePoints([[0, 0, 0], [1, 0, 0], [Infinity, 0, 0]]), /finite/);
  assert.throws(() => assertGwmV2SourcePoints([[0, 0, 0], [1, 0, 0], { x: 1, y: 2 }]), /z/);
});

test('rejects empty and too-small GWM-V2 point sets', () => {
  assert.throws(() => assertGwmV2SourcePoints([]), /at least one point/);
  assert.throws(
    () => createGwmV2TriadStream([[0, 0, 0], [1, 0, 0]], { point: 0, shift: 0, gap: 0 }),
    /at least 3 points/
  );
});

test('creates deterministic GWM-V2 source point payloads and commitments', () => {
  const payload = gwmV2SourcePointPayload(OBJECT_POINTS);
  const first = gwmV2SourcePointCommitment(POINTS);
  const second = gwmV2SourcePointCommitment(OBJECT_POINTS);

  assert.equal(payload.format, GWM_V2_SOURCE_POINT_FORMAT);
  assert.equal(payload.version, GWM_V2_SOURCE_POINT_VERSION);
  assert.deepEqual(payload.points, POINTS);
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(first, second);
});

test('GWM-V2 source point commitment changes with point material, order, and count', () => {
  const base = gwmV2SourcePointCommitment(POINTS);
  const changedPoint = clone(POINTS);
  changedPoint[1][0] = 2;

  assert.notEqual(gwmV2SourcePointCommitment(changedPoint), base);
  assert.notEqual(gwmV2SourcePointCommitment([POINTS[1], POINTS[0], POINTS[2], POINTS[3]]), base);
  assert.notEqual(gwmV2SourcePointCommitment(POINTS.concat([[2, 2, 2]])), base);
});

test('creates a deterministic GWM-V2 triad stream from source points', () => {
  const walkOptions = { point: 0, shift: 0, gap: 0, horizon: 3, ring: 17 };
  const context = { payloadLength: 8 };
  const stream = createGwmV2TriadStream(POINTS, walkOptions, context);
  const repeated = createGwmV2TriadStream(clone(POINTS), clone(walkOptions), clone(context));

  assert.equal(stream.sourcePointCommitment, gwmV2SourcePointCommitment(POINTS));
  assert.match(stream.triadStreamCommitment, /^[0-9a-f]{64}$/);
  assert.equal(stream.triadStream.streamCommitment, stream.triadStreamCommitment);
  assert.deepEqual(stream, repeated);
  assert.equal(stream.triadStream.records.length, 3);
  assert.deepEqual(stream.walkOptions, walkOptions);
  assert.deepEqual(stream.triadStream.context, {
    gap: 0,
    horizon: 3,
    payloadLength: 8,
    point: 0,
    ring: 17,
    shift: 0,
  });
});

test('GWM-V2 triad stream changes when walk options or context change', () => {
  const base = createGwmV2TriadStream(POINTS, { point: 0, shift: 0, gap: 0, horizon: 3 }, {
    payloadLength: 8,
  });
  const changedWalk = createGwmV2TriadStream(POINTS, { point: 0, shift: 0, gap: 1, horizon: 3 }, {
    payloadLength: 8,
  });
  const changedContext = createGwmV2TriadStream(POINTS, { point: 0, shift: 0, gap: 0, horizon: 3 }, {
    payloadLength: 9,
  });

  assert.notEqual(changedWalk.triadStreamCommitment, base.triadStreamCommitment);
  assert.notEqual(changedContext.triadStreamCommitment, base.triadStreamCommitment);
});

test('GWM-V2 triad stream rejects invalid walk options', () => {
  assert.throws(() => createGwmV2TriadStream(POINTS, { shift: 0, gap: 0 }), /point is required/);
  assert.throws(() => createGwmV2TriadStream(POINTS, { point: -1, shift: 0, gap: 0 }), /point/);
  assert.throws(() => createGwmV2TriadStream(POINTS, { point: 0, shift: 0, gap: 0, horizon: 0 }), /horizon/);
  assert.throws(() => createGwmV2TriadStream(POINTS, { point: 0, shift: 0, gap: 0, ring: 0 }), /ring/);
  assert.throws(
    () => createGwmV2TriadStream(POINTS, { point: 0, shift: 0, gap: Number.MAX_SAFE_INTEGER + 1 }),
    /gap/
  );
});

test('creates a GWM-V2 descriptor from source points and supplied adapter commitment', () => {
  const options = {
    walkOptions: { point: 0, shift: 0, gap: 0, horizon: 3, ring: 17 },
    adapterPlanCommitment: HEX.adapter,
    transformProofCommitment: HEX.proof,
    context: { payloadLength: 8 },
    metadata: { label: 'from-points' },
  };
  const stream = createGwmV2TriadStream(POINTS, options.walkOptions, options.context);
  const descriptor = createGwmV2DescriptorFromPoints(POINTS, options);

  assert.equal(descriptor.format, GWM_V2_FORMAT);
  assert.equal(descriptor.sourcePointCommitment, stream.sourcePointCommitment);
  assert.equal(descriptor.triadStreamCommitment, stream.triadStreamCommitment);
  assert.equal(descriptor.adapterPlanCommitment, HEX.adapter);
  assert.equal(descriptor.transformProofCommitment, HEX.proof);
  assert.deepEqual(assertGwmV2Descriptor(descriptor), descriptor);
});

test('descriptor-from-points binds source point and triad stream commitments', () => {
  const options = {
    walkOptions: { point: 0, shift: 0, gap: 0, horizon: 3 },
    adapterPlanCommitment: HEX.adapter,
    context: { payloadLength: 8 },
  };
  const descriptor = createGwmV2DescriptorFromPoints(POINTS, options);
  const changedPoint = clone(POINTS);
  changedPoint[1][0] = 2;
  const changedWalk = createGwmV2DescriptorFromPoints(POINTS, {
    ...options,
    walkOptions: { point: 0, shift: 0, gap: 1, horizon: 3 },
  });

  assert.notEqual(createGwmV2DescriptorFromPoints(changedPoint, options).descriptorCommitment, descriptor.descriptorCommitment);
  assert.notEqual(changedWalk.descriptorCommitment, descriptor.descriptorCommitment);
  assert.notEqual(changedWalk.triadStreamCommitment, descriptor.triadStreamCommitment);
});

test('descriptor-from-points rejects missing adapter plan commitment', () => {
  assert.throws(
    () => createGwmV2DescriptorFromPoints(POINTS, {
      walkOptions: { point: 0, shift: 0, gap: 0 },
    }),
    /adapterPlanCommitment/
  );
});

test('verifies a GWM-V2 descriptor against a matching supplied adapter plan', () => {
  const { descriptor, adapterPlan } = gwmV2AdapterFixture({ context: { adapter: 'matching' } });
  const result = verifyGwmV2AdapterPlan(descriptor, adapterPlan);

  assert.equal(result.format, GWM_V2_ADAPTER_BINDING_FORMAT);
  assert.equal(result.version, GWM_V2_ADAPTER_BINDING_VERSION);
  assert.equal(result.ok, true);
  assert.equal(result.descriptorCommitment, descriptor.descriptorCommitment);
  assert.equal(result.triadStreamCommitment, descriptor.triadStreamCommitment);
  assert.equal(result.adapterPlanCommitment, adapterPlan.adapterCommitment);
  assert.equal(result.expectedAdapterPlanCommitment, descriptor.adapterPlanCommitment);
  assert.deepEqual(result.adapterSummary, {
    sourceStreamCommitment: adapterPlan.sourceStreamCommitment,
    rotateInstructionCount: adapterPlan.rotateInstructions.length,
    swapInstructionCount: adapterPlan.swapInstructions.length,
    skippedRecordCount: adapterPlan.skippedRecords.length,
  });
  assert.equal(
    result.bindingCommitment,
    gwmV2AdapterBindingCommitment(gwmV2AdapterBindingPayload(result))
  );
  assert.equal(Object.hasOwn(result, 'reason'), false);
  assert.equal(Object.hasOwn(result, 'error'), false);
});

test('verification fails without throwing for adapter plan commitment mismatch', () => {
  const { descriptor, adapterPlan } = gwmV2AdapterFixture();
  const mismatched = createGwmV2Descriptor({
    ...descriptor,
    adapterPlanCommitment: HEX.adapter2,
  });
  const result = verifyGwmV2AdapterPlan(mismatched, adapterPlan);

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'adapter-plan-commitment-mismatch');
  assert.equal(result.adapterPlanCommitment, adapterPlan.adapterCommitment);
  assert.equal(result.expectedAdapterPlanCommitment, HEX.adapter2);
  assert.equal(Object.hasOwn(result, 'error'), false);
  assert.equal(Object.hasOwn(result, 'bindingCommitment'), false);
});

test('verification fails without throwing for malformed descriptor and adapter plan', () => {
  const { descriptor, adapterPlan } = gwmV2AdapterFixture();
  const badDescriptor = verifyGwmV2AdapterPlan({ ...descriptor, format: 'BAD' }, adapterPlan);
  const badPlan = clone(adapterPlan);
  badPlan.rotateInstructions[0].delta = badPlan.rotateInstructions[0].ring;
  const badAdapter = verifyGwmV2AdapterPlan(descriptor, badPlan);

  assert.equal(badDescriptor.ok, false);
  assert.equal(badDescriptor.reason, 'invalid-descriptor');
  assert.match(badDescriptor.error, /format/);
  assert.equal(badAdapter.ok, false);
  assert.equal(badAdapter.reason, 'invalid-adapter-plan');
  assert.match(badAdapter.error, /delta must be within ring bounds|adapterCommitment mismatch/);
  assert.equal(badAdapter.descriptorCommitment, descriptor.descriptorCommitment);
});

test('binding returns deterministic results and asserts valid adapter bindings', () => {
  const { descriptor, adapterPlan } = gwmV2AdapterFixture({ context: { label: 'deterministic' } });
  const first = bindGwmV2AdapterPlan(descriptor, adapterPlan);
  const second = assertGwmV2AdapterBinding(clone(descriptor), clone(adapterPlan));

  assert.deepEqual(first, second);
  assert.equal(first.ok, true);
  assert.match(first.bindingCommitment, /^[0-9a-f]{64}$/);
});

test('binding commitment changes when descriptor commitment changes', () => {
  const { descriptor, adapterPlan } = gwmV2AdapterFixture();
  const changedDescriptor = createGwmV2Descriptor({
    ...descriptor,
    metadata: { label: 'changed-descriptor' },
  });

  assert.notEqual(
    bindGwmV2AdapterPlan(changedDescriptor, adapterPlan).bindingCommitment,
    bindGwmV2AdapterPlan(descriptor, adapterPlan).bindingCommitment
  );
});

test('binding commitment changes when supplied adapter plan changes', () => {
  const { descriptor, adapterPlan } = gwmV2AdapterFixture();
  const changedPlan = changedAdapterPlan(adapterPlan, (payload) => {
    payload.context = { label: 'changed-adapter' };
  });
  const changedDescriptor = createGwmV2Descriptor({
    ...descriptor,
    adapterPlanCommitment: changedPlan.adapterCommitment,
  });

  assert.notEqual(
    bindGwmV2AdapterPlan(changedDescriptor, changedPlan).bindingCommitment,
    bindGwmV2AdapterPlan(descriptor, adapterPlan).bindingCommitment
  );
});

test('createGwmV2DescriptorFromPointsAndAdapter creates and binds a valid descriptor', () => {
  const { stream, adapterPlan, walkOptions, context } = gwmV2AdapterFixture({
    context: { adapter: 'descriptor-from-plan' },
  });
  const descriptor = createGwmV2DescriptorFromPointsAndAdapter(POINTS, walkOptions, adapterPlan, {
    context,
    metadata: { label: 'from-supplied-adapter' },
    transformProofCommitment: HEX.proof,
  });

  assert.equal(descriptor.sourcePointCommitment, gwmV2SourcePointCommitment(POINTS));
  assert.equal(descriptor.sourcePointCommitment, stream.sourcePointCommitment);
  assert.equal(descriptor.triadStreamCommitment, stream.triadStreamCommitment);
  assert.equal(descriptor.adapterPlanCommitment, adapterPlan.adapterCommitment);
  assert.equal(descriptor.transformProofCommitment, HEX.proof);
  assert.deepEqual(assertGwmV2Descriptor(descriptor), descriptor);
  assert.equal(verifyGwmV2AdapterPlan(descriptor, adapterPlan).ok, true);
});

test('createGwmV2DescriptorFromPointsAndAdapter rejects source stream mismatches', () => {
  const { adapterPlan, walkOptions, context } = gwmV2AdapterFixture();

  assert.throws(
    () => createGwmV2DescriptorFromPointsAndAdapter(POINTS, {
      ...walkOptions,
      gap: 1,
    }, adapterPlan, { context }),
    /sourceStreamCommitment/
  );
});

test('GWM-V2 adapter binding helpers defensively clone inputs and results', () => {
  const points = clone(OBJECT_POINTS);
  const { adapterPlan, walkOptions, context } = gwmV2AdapterFixture();
  const options = { context: clone(context), metadata: { labels: ['copy-check'] } };
  const descriptor = createGwmV2DescriptorFromPointsAndAdapter(
    points,
    clone(walkOptions),
    adapterPlan,
    options
  );
  const binding = bindGwmV2AdapterPlan(descriptor, adapterPlan);

  points[0].x = 99;
  walkOptions.gap = 99;
  adapterPlan.rotateInstructions[0].delta = 999;
  options.context.payloadLength = 99;
  options.metadata.labels.push('mutated');
  binding.adapterSummary.rotateInstructionCount = 999;

  const fresh = gwmV2AdapterFixture();
  const freshDescriptor = createGwmV2DescriptorFromPointsAndAdapter(
    OBJECT_POINTS,
    fresh.walkOptions,
    fresh.adapterPlan,
    { context: fresh.context, metadata: { labels: ['copy-check'] } }
  );
  const freshBinding = bindGwmV2AdapterPlan(freshDescriptor, fresh.adapterPlan);

  assert.equal(descriptor.walkOptions.gap, 0);
  assert.equal(descriptor.context.payloadLength, 8);
  assert.deepEqual(descriptor.metadata.labels, ['copy-check']);
  assert.equal(freshBinding.adapterSummary.rotateInstructionCount, fresh.adapterPlan.rotateInstructions.length);
});

test('GWM-V2 adapter binding does not automatically generate adapter plans or apply transforms', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'gwm-v2.js'), 'utf8');

  assert.equal(source.includes('adaptTriadStreamToInstructionPlan'), false);
  assert.equal(source.includes('applyTriadInstructionPlan'), false);
  assert.equal(source.includes('reverseTriadInstructionPlan'), false);
  assert.equal(source.includes('roundTripTriadInstructionPlan'), false);
  assert.equal(source.includes('applyRotateTransform'), false);
  assert.equal(source.includes('applySwapTransform'), false);
});

test('verifies a GWM-V2 descriptor against a matching supplied transform proof', () => {
  const { descriptor, adapterPlan, transformProof } = gwmV2ProofFixture();
  const result = verifyGwmV2TransformProof(descriptor, transformProof);

  assert.equal(result.format, GWM_V2_PROOF_BINDING_FORMAT);
  assert.equal(result.version, GWM_V2_PROOF_BINDING_VERSION);
  assert.equal(result.ok, true);
  assert.equal(result.descriptorCommitment, descriptor.descriptorCommitment);
  assert.equal(result.triadStreamCommitment, descriptor.triadStreamCommitment);
  assert.equal(result.adapterPlanCommitment, adapterPlan.adapterCommitment);
  assert.equal(result.expectedTransformProofCommitment, descriptor.transformProofCommitment);
  assert.equal(result.suppliedTransformProofCommitment, transformProof.proofCommitment);
  assert.deepEqual(result.proofSummary, {
    mode: transformProof.mode,
    sourcePlanCommitment: adapterPlan.adapterCommitment,
    inputPayloadCommitment: transformProof.inputPayloadCommitment,
    outputPayloadCommitment: transformProof.outputPayloadCommitment,
    appliedOperationCount: transformProof.appliedOperations.length,
    skippedRecordCount: transformProof.skippedRecords.length,
    warningCount: transformProof.warnings.length,
  });
  assert.equal(
    result.bindingCommitment,
    gwmV2ProofBindingCommitment(gwmV2ProofBindingPayload(result))
  );
  assert.equal(Object.hasOwn(result, 'reason'), false);
  assert.equal(Object.hasOwn(result, 'error'), false);
});

test('transform proof verification fails when descriptor has no proof commitment', () => {
  const { descriptor, transformProof } = gwmV2ProofFixture();
  const missing = createGwmV2Descriptor({
    ...descriptor,
    transformProofCommitment: null,
  });
  const result = verifyGwmV2TransformProof(missing, transformProof);

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'missing-transform-proof-commitment');
  assert.equal(result.descriptorCommitment, missing.descriptorCommitment);
  assert.equal(result.expectedTransformProofCommitment, null);
  assert.equal(Object.hasOwn(result, 'suppliedTransformProofCommitment'), false);
});

test('transform proof verification fails for proof commitment mismatch', () => {
  const { descriptor, transformProof } = gwmV2ProofFixture();
  const mismatched = createGwmV2Descriptor({
    ...descriptor,
    transformProofCommitment: HEX.proof2,
  });
  const result = verifyGwmV2TransformProof(mismatched, transformProof);

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'transform-proof-commitment-mismatch');
  assert.equal(result.expectedTransformProofCommitment, HEX.proof2);
  assert.equal(result.suppliedTransformProofCommitment, transformProof.proofCommitment);
  assert.equal(Object.hasOwn(result, 'error'), false);
  assert.equal(Object.hasOwn(result, 'bindingCommitment'), false);
});

test('transform proof verification fails for malformed descriptor and transform proof', () => {
  const { descriptor, transformProof } = gwmV2ProofFixture();
  const badDescriptor = verifyGwmV2TransformProof({ ...descriptor, format: 'BAD' }, transformProof);
  const badProof = verifyGwmV2TransformProof(descriptor, {
    ...transformProof,
    format: 'BAD',
  });

  assert.equal(badDescriptor.ok, false);
  assert.equal(badDescriptor.reason, 'invalid-descriptor');
  assert.match(badDescriptor.error, /format/);
  assert.equal(badProof.ok, false);
  assert.equal(badProof.reason, 'invalid-transform-proof');
  assert.match(badProof.error, /format/);
  assert.equal(badProof.descriptorCommitment, descriptor.descriptorCommitment);
});

test('transform proof verification rejects source plan commitment mismatches', () => {
  const { descriptor, transformProof } = gwmV2ProofFixture();
  const changedProof = changedTransformProof(transformProof, (payload) => {
    payload.sourcePlanCommitment = HEX.adapter2;
  });
  const changedDescriptor = createGwmV2Descriptor({
    ...descriptor,
    transformProofCommitment: changedProof.proofCommitment,
  });
  const result = verifyGwmV2TransformProof(changedDescriptor, changedProof);

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'source-plan-commitment-mismatch');
  assert.equal(result.adapterPlanCommitment, descriptor.adapterPlanCommitment);
  assert.equal(result.proofSummary.sourcePlanCommitment, HEX.adapter2);
});

test('transform proof binding returns deterministic results and asserts valid bindings', () => {
  const { descriptor, transformProof } = gwmV2ProofFixture({
    context: { adapter: 'proof-deterministic' },
  });
  const first = bindGwmV2TransformProof(descriptor, transformProof);
  const second = assertGwmV2ProofBinding(
    clone(descriptor),
    clone(triadTransformProofPayload(transformProof))
  );

  assert.deepEqual(first, second);
  assert.equal(first.ok, true);
  assert.match(first.bindingCommitment, /^[0-9a-f]{64}$/);
});

test('transform proof binding commitment changes when descriptor commitment changes', () => {
  const { descriptor, transformProof } = gwmV2ProofFixture();
  const changedDescriptor = createGwmV2Descriptor({
    ...descriptor,
    metadata: { label: 'changed-proof-descriptor' },
  });

  assert.notEqual(
    bindGwmV2TransformProof(changedDescriptor, transformProof).bindingCommitment,
    bindGwmV2TransformProof(descriptor, transformProof).bindingCommitment
  );
});

test('transform proof binding commitment changes when supplied transform proof changes', () => {
  const { descriptor, transformProof } = gwmV2ProofFixture();
  const changedProof = changedTransformProof(transformProof, (payload) => {
    payload.context = { proof: 'changed' };
  });
  const changedDescriptor = createGwmV2Descriptor({
    ...descriptor,
    transformProofCommitment: changedProof.proofCommitment,
  });

  assert.notEqual(
    bindGwmV2TransformProof(changedDescriptor, changedProof).bindingCommitment,
    bindGwmV2TransformProof(descriptor, transformProof).bindingCommitment
  );
});

test('createGwmV2DescriptorFromPointsAdapterAndProof creates and binds a valid descriptor', () => {
  const { stream, adapterPlan, transformProof, walkOptions, context } = gwmV2ProofFixture();
  const descriptor = createGwmV2DescriptorFromPointsAdapterAndProof(
    POINTS,
    walkOptions,
    adapterPlan,
    transformProof,
    { context, metadata: { label: 'from-supplied-proof' } }
  );

  assert.equal(descriptor.sourcePointCommitment, gwmV2SourcePointCommitment(POINTS));
  assert.equal(descriptor.sourcePointCommitment, stream.sourcePointCommitment);
  assert.equal(descriptor.triadStreamCommitment, stream.triadStreamCommitment);
  assert.equal(descriptor.adapterPlanCommitment, adapterPlan.adapterCommitment);
  assert.equal(descriptor.transformProofCommitment, transformProof.proofCommitment);
  assert.deepEqual(assertGwmV2Descriptor(descriptor), descriptor);
  assert.equal(verifyGwmV2AdapterPlan(descriptor, adapterPlan).ok, true);
  assert.equal(verifyGwmV2TransformProof(descriptor, transformProof).ok, true);
});

test('GWM-V2 descriptor chain commitments can be checked without runtime integration', () => {
  const { stream, descriptor, adapterPlan, transformProof } = gwmV2ProofFixture({
    context: { adapter: 'chain-readiness' },
  });
  const normalizedDescriptor = assertGwmV2Descriptor(descriptor);
  const adapterBinding = verifyGwmV2AdapterPlan(normalizedDescriptor, adapterPlan);
  const proofBinding = verifyGwmV2TransformProof(normalizedDescriptor, transformProof);

  assert.equal(stream.sourcePointCommitment, gwmV2SourcePointCommitment(POINTS));
  assert.equal(normalizedDescriptor.sourcePointCommitment, stream.sourcePointCommitment);
  assert.equal(normalizedDescriptor.triadStreamCommitment, stream.triadStreamCommitment);
  assert.equal(normalizedDescriptor.adapterPlanCommitment, adapterPlan.adapterCommitment);
  assert.equal(normalizedDescriptor.transformProofCommitment, transformProof.proofCommitment);
  assert.equal(adapterBinding.ok, true);
  assert.equal(adapterBinding.descriptorCommitment, normalizedDescriptor.descriptorCommitment);
  assert.equal(adapterBinding.triadStreamCommitment, normalizedDescriptor.triadStreamCommitment);
  assert.equal(adapterBinding.adapterPlanCommitment, normalizedDescriptor.adapterPlanCommitment);
  assert.equal(adapterBinding.bindingCommitment, gwmV2AdapterBindingCommitment(adapterBinding));
  assert.equal(proofBinding.ok, true);
  assert.equal(proofBinding.descriptorCommitment, normalizedDescriptor.descriptorCommitment);
  assert.equal(proofBinding.triadStreamCommitment, normalizedDescriptor.triadStreamCommitment);
  assert.equal(proofBinding.adapterPlanCommitment, normalizedDescriptor.adapterPlanCommitment);
  assert.equal(proofBinding.expectedTransformProofCommitment, transformProof.proofCommitment);
  assert.equal(proofBinding.suppliedTransformProofCommitment, transformProof.proofCommitment);
  assert.equal(proofBinding.bindingCommitment, gwmV2ProofBindingCommitment(proofBinding));
});

test('createGwmV2DescriptorFromPointsAdapterAndProof rejects adapter source stream mismatches', () => {
  const { adapterPlan, transformProof, walkOptions, context } = gwmV2ProofFixture();

  assert.throws(
    () => createGwmV2DescriptorFromPointsAdapterAndProof(POINTS, {
      ...walkOptions,
      gap: 1,
    }, adapterPlan, transformProof, { context }),
    /sourceStreamCommitment/
  );
});

test('createGwmV2DescriptorFromPointsAdapterAndProof rejects source plan mismatches', () => {
  const { adapterPlan, transformProof, walkOptions, context } = gwmV2ProofFixture();
  const changedProof = changedTransformProof(transformProof, (payload) => {
    payload.sourcePlanCommitment = HEX.adapter2;
  });

  assert.throws(
    () => createGwmV2DescriptorFromPointsAdapterAndProof(
      POINTS,
      walkOptions,
      adapterPlan,
      changedProof,
      { context }
    ),
    /sourcePlanCommitment/
  );
});

test('GWM-V2 proof binding helpers defensively clone inputs and results', () => {
  const points = clone(OBJECT_POINTS);
  const { adapterPlan, transformProof, walkOptions, context } = gwmV2ProofFixture();
  const options = { context: clone(context), metadata: { labels: ['proof-copy-check'] } };
  const descriptor = createGwmV2DescriptorFromPointsAdapterAndProof(
    points,
    clone(walkOptions),
    adapterPlan,
    transformProof,
    options
  );
  const binding = bindGwmV2TransformProof(descriptor, transformProof);

  points[0].x = 99;
  walkOptions.gap = 99;
  adapterPlan.rotateInstructions[0].delta = 999;
  transformProof.context.proof = 'mutated';
  options.context.payloadLength = 99;
  options.metadata.labels.push('mutated');
  binding.proofSummary.appliedOperationCount = 999;

  const fresh = gwmV2ProofFixture();
  const freshDescriptor = createGwmV2DescriptorFromPointsAdapterAndProof(
    OBJECT_POINTS,
    fresh.walkOptions,
    fresh.adapterPlan,
    fresh.transformProof,
    { context: fresh.context, metadata: { labels: ['proof-copy-check'] } }
  );
  const freshBinding = bindGwmV2TransformProof(freshDescriptor, fresh.transformProof);

  assert.equal(descriptor.walkOptions.gap, 0);
  assert.equal(descriptor.context.payloadLength, 8);
  assert.deepEqual(descriptor.metadata.labels, ['proof-copy-check']);
  assert.equal(freshBinding.proofSummary.appliedOperationCount, fresh.transformProof.appliedOperations.length);
});

test('GWM-V2 source, stream, and descriptor helpers defensively clone inputs and results', () => {
  const points = clone(OBJECT_POINTS);
  const walkOptions = { point: 0, shift: 0, gap: 0, horizon: 3, ring: 17 };
  const context = { payloadLength: 8 };
  const metadata = { labels: ['copy-check'] };
  const stream = createGwmV2TriadStream(points, walkOptions, context);
  const descriptor = createGwmV2DescriptorFromPoints(points, {
    walkOptions,
    adapterPlanCommitment: HEX.adapter,
    context,
    metadata,
  });

  points[1].x = 99;
  walkOptions.gap = 99;
  context.payloadLength = 99;
  metadata.labels.push('mutated');

  assert.deepEqual(stream.sourcePoints, POINTS);
  assert.equal(stream.walkOptions.gap, 0);
  assert.equal(stream.triadStream.context.payloadLength, 8);
  assert.equal(descriptor.walkOptions.gap, 0);
  assert.equal(descriptor.context.payloadLength, 8);
  assert.deepEqual(descriptor.metadata.labels, ['copy-check']);

  stream.sourcePoints[0][0] = 88;
  stream.walkOptions.gap = 88;
  stream.triadStream.records[0].triad.A[0] = 88;
  descriptor.walkOptions.gap = 88;
  descriptor.context.payloadLength = 88;
  descriptor.metadata.labels.push('local');

  const freshStream = createGwmV2TriadStream(OBJECT_POINTS, { point: 0, shift: 0, gap: 0, horizon: 3, ring: 17 }, {
    payloadLength: 8,
  });
  const freshDescriptor = createGwmV2DescriptorFromPoints(OBJECT_POINTS, {
    walkOptions: { point: 0, shift: 0, gap: 0, horizon: 3, ring: 17 },
    adapterPlanCommitment: HEX.adapter,
    context: { payloadLength: 8 },
    metadata: { labels: ['copy-check'] },
  });

  assert.deepEqual(freshStream.sourcePoints, POINTS);
  assert.equal(freshStream.walkOptions.gap, 0);
  assert.equal(freshStream.triadStream.records[0].triad.A[0], 0);
  assert.equal(freshDescriptor.walkOptions.gap, 0);
  assert.equal(freshDescriptor.context.payloadLength, 8);
  assert.deepEqual(freshDescriptor.metadata.labels, ['copy-check']);
});

test('creates a valid UN-GWM-V2 descriptor', () => {
  const descriptor = createFixture();

  assert.equal(descriptor.format, GWM_V2_FORMAT);
  assert.equal(descriptor.version, GWM_V2_VERSION);
  assert.equal(descriptor.mode, 'UN-GWM-V2');
  assert.equal(descriptor.sourcePointCommitment, HEX.source);
  assert.equal(descriptor.triadStreamCommitment, HEX.stream);
  assert.equal(descriptor.adapterPlanCommitment, HEX.adapter);
  assert.equal(descriptor.transformProofCommitment, HEX.proof);
  assert.match(descriptor.descriptorCommitment, /^[0-9a-f]{64}$/);
});

test('normalizes descriptor input and verifies supplied descriptor commitment', () => {
  const descriptor = createFixture();
  const normalized = normalizeGwmV2Descriptor({
    metadata: { flags: ['pure-descriptor'], label: 'fixture' },
    context: { bounds: { payloadLength: 8 }, purpose: 'sprint-39-test' },
    transformProofCommitment: HEX.proof,
    adapterPlanCommitment: HEX.adapter,
    triadStreamCommitment: HEX.stream,
    walkOptions: { ring: 5, horizon: 12, gap: 2, shift: 1, point: 0 },
    sourcePointCommitment: HEX.source,
    mode: 'UN-GWM-V2',
    version: GWM_V2_VERSION,
    format: GWM_V2_FORMAT,
    descriptorCommitment: descriptor.descriptorCommitment,
  });

  assert.deepEqual(normalized, descriptor);
});

test('returns canonical payload without descriptorCommitment', () => {
  const descriptor = createFixture();
  const payload = gwmV2Payload(descriptor);

  assert.equal(Object.hasOwn(payload, 'descriptorCommitment'), false);
  assert.equal(gwmV2Commitment(payload), descriptor.descriptorCommitment);
});

test('descriptor commitment is deterministic for equivalent input', () => {
  const left = createFixture();
  const right = createGwmV2Descriptor({
    metadata: { flags: ['pure-descriptor'], label: 'fixture' },
    context: { bounds: { payloadLength: 8 }, purpose: 'sprint-39-test' },
    transformProofCommitment: HEX.proof,
    adapterPlanCommitment: HEX.adapter,
    triadStreamCommitment: HEX.stream,
    walkOptions: { ring: 5, horizon: 12, gap: 2, shift: 1, point: 0 },
    sourcePointCommitment: HEX.source,
  });

  assert.equal(right.descriptorCommitment, left.descriptorCommitment);
  assert.deepEqual(right, left);
});

test('descriptor commitment changes when source point commitment changes', () => {
  assert.notEqual(changedCommitment({}), changedCommitment({ sourcePointCommitment: HEX.source2 }));
});

test('descriptor commitment changes when walk options change', () => {
  assert.notEqual(
    changedCommitment({}),
    changedCommitment({ walkOptions: { point: 0, shift: 1, gap: 3, horizon: 12, ring: 5 } })
  );
});

test('descriptor commitment changes when triad stream commitment changes', () => {
  assert.notEqual(changedCommitment({}), changedCommitment({ triadStreamCommitment: HEX.stream2 }));
});

test('descriptor commitment changes when adapter plan commitment changes', () => {
  assert.notEqual(changedCommitment({}), changedCommitment({ adapterPlanCommitment: HEX.adapter2 }));
});

test('descriptor commitment changes when transform proof commitment changes', () => {
  assert.notEqual(
    changedCommitment({}),
    changedCommitment({ transformProofCommitment: HEX.proof2 })
  );
});

test('descriptor commitment changes when context changes', () => {
  assert.notEqual(
    changedCommitment({}),
    changedCommitment({ context: { purpose: 'changed', bounds: { payloadLength: 8 } } })
  );
});

test('descriptor commitment changes when metadata changes', () => {
  assert.notEqual(
    changedCommitment({}),
    changedCommitment({ metadata: { label: 'changed', flags: ['pure-descriptor'] } })
  );
});

test('optional transform proof, context, and metadata default to committed canonical values', () => {
  const descriptor = createGwmV2Descriptor({
    sourcePointCommitment: HEX.source,
    walkOptions: { point: 0, shift: 0, gap: 0 },
    triadStreamCommitment: HEX.stream,
    adapterPlanCommitment: HEX.adapter,
  });

  assert.equal(descriptor.transformProofCommitment, null);
  assert.deepEqual(descriptor.context, {});
  assert.deepEqual(descriptor.metadata, {});
  assert.match(descriptor.descriptorCommitment, /^[0-9a-f]{64}$/);
});

test('rejects malformed descriptor shapes', () => {
  assert.throws(() => normalizeGwmV2Descriptor(null), /descriptor must be an object/);
  assert.throws(() => normalizeGwmV2Descriptor([]), /descriptor must be an object/);
  assert.throws(
    () => normalizeGwmV2Descriptor(descriptorInput({ unsupported: true })),
    /descriptor.unsupported is not supported/
  );
  assert.throws(
    () => normalizeGwmV2Descriptor({
      ...descriptorInput(),
      descriptorCommitment: '0'.repeat(64),
    }),
    /descriptorCommitment mismatch/
  );
});

test('rejects unsupported format, version, and mode values', () => {
  assert.throws(
    () => normalizeGwmV2Descriptor(descriptorInput({ format: 'UN-GWM-V2' })),
    /format/
  );
  assert.throws(
    () => normalizeGwmV2Descriptor(descriptorInput({ version: 2 })),
    /version/
  );
  assert.throws(
    () => normalizeGwmV2Descriptor(descriptorInput({ mode: 'UN-GWM' })),
    /mode/
  );
});

test('rejects invalid commitment strings', () => {
  assert.throws(
    () => createFixture({ sourcePointCommitment: 'not-hex' }),
    /sourcePointCommitment/
  );
  assert.throws(
    () => createFixture({ triadStreamCommitment: 'A'.repeat(64) }),
    /triadStreamCommitment/
  );
  assert.throws(
    () => createFixture({ adapterPlanCommitment: '1'.repeat(63) }),
    /adapterPlanCommitment/
  );
  assert.throws(
    () => createFixture({ transformProofCommitment: 'z'.repeat(64) }),
    /transformProofCommitment/
  );
});

test('rejects missing required commitments', () => {
  for (const fieldName of [
    'sourcePointCommitment',
    'triadStreamCommitment',
    'adapterPlanCommitment',
  ]) {
    const input = descriptorInput();
    delete input[fieldName];
    assert.throws(() => normalizeGwmV2Descriptor(input), new RegExp(fieldName));
  }
});

test('rejects unsafe integer walk options', () => {
  assert.throws(
    () => createFixture({ walkOptions: { point: 1.2, shift: 0, gap: 0 } }),
    /walkOptions.point/
  );
  assert.throws(
    () => createFixture({ walkOptions: { point: -1, shift: 0, gap: 0 } }),
    /walkOptions.point/
  );
  assert.throws(
    () => createFixture({ walkOptions: { point: 0, shift: 0, gap: 0, horizon: 0 } }),
    /walkOptions.horizon/
  );
  assert.throws(
    () => createFixture({ walkOptions: { point: 0, shift: 0, gap: 0, ring: 0 } }),
    /walkOptions.ring/
  );
  assert.throws(
    () => createFixture({ walkOptions: { point: Number.MAX_SAFE_INTEGER + 1, shift: 0, gap: 0 } }),
    /walkOptions.point/
  );
});

test('defensively clones descriptor, walk options, context, and metadata', () => {
  const input = descriptorInput();
  const descriptor = createGwmV2Descriptor(input);

  input.walkOptions.gap = 99;
  input.context.bounds.payloadLength = 999;
  input.metadata.flags.push('mutated');

  assert.equal(descriptor.walkOptions.gap, 2);
  assert.equal(descriptor.context.bounds.payloadLength, 8);
  assert.deepEqual(descriptor.metadata.flags, ['pure-descriptor']);

  descriptor.walkOptions.gap = 100;
  descriptor.context.bounds.payloadLength = 1000;
  descriptor.metadata.flags.push('local-mutation');

  const normalized = normalizeGwmV2Descriptor(createFixture());
  assert.equal(normalized.walkOptions.gap, 2);
  assert.equal(normalized.context.bounds.payloadLength, 8);
  assert.deepEqual(normalized.metadata.flags, ['pure-descriptor']);
});

test('assertGwmV2Descriptor accepts valid descriptors and rejects malformed descriptors', () => {
  const descriptor = createFixture();

  assert.deepEqual(assertGwmV2Descriptor(descriptor), descriptor);
  assert.throws(
    () => assertGwmV2Descriptor({ ...descriptor, adapterPlanCommitment: HEX.adapter2 }),
    /descriptorCommitment mismatch/
  );
});

test('public exports are available through packages/core', () => {
  for (const name of [
    'GWM_V2_FORMAT',
    'GWM_V2_VERSION',
    'GWM_V2_ADAPTER_BINDING_FORMAT',
    'GWM_V2_ADAPTER_BINDING_VERSION',
    'GWM_V2_PROOF_BINDING_FORMAT',
    'GWM_V2_PROOF_BINDING_VERSION',
    'GWM_V2_MODE_FORMAT',
    'GWM_V2_MODE_VERSION',
    'GWM_V2_SOURCE_POINT_FORMAT',
    'GWM_V2_SOURCE_POINT_VERSION',
    'assertGwmV2SourcePoints',
    'gwmV2SourcePointPayload',
    'gwmV2SourcePointCommitment',
    'normalizeGwmV2Descriptor',
    'gwmV2Payload',
    'gwmV2Commitment',
    'createGwmV2Descriptor',
    'createGwmV2TriadStream',
    'createGwmV2DescriptorFromPoints',
    'gwmV2AdapterBindingPayload',
    'gwmV2AdapterBindingCommitment',
    'gwmV2ProofBindingPayload',
    'gwmV2ProofBindingCommitment',
    'verifyGwmV2AdapterPlan',
    'bindGwmV2AdapterPlan',
    'verifyGwmV2TransformProof',
    'bindGwmV2TransformProof',
    'gwmV2ModePayload',
    'gwmV2ModeCommitment',
    'createGwmV2Mode',
    'verifyGwmV2Mode',
    'assertGwmV2Mode',
    'createGwmV2DescriptorFromPointsAndAdapter',
    'createGwmV2DescriptorFromPointsAdapterAndProof',
    'assertGwmV2AdapterBinding',
    'assertGwmV2ProofBinding',
    'assertGwmV2Descriptor',
  ]) {
    assert.equal(core[name], require('../src/gwm-v2')[name]);
  }
});

test('root legacy export remains the Unobtainium constructor', () => {
  const exported = require('../../..');

  assert.equal(typeof exported, 'function');
  assert.equal(exported.name, 'Unobtainium');
});

test('existing UN-GWM instruction stream behavior remains unchanged', () => {
  const stream = generateInstructionStream({
    mesh: {
      points: [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
    },
    state: { point: 0, shift: 1, gap: 1 },
    count: 3,
    windowSize: 16,
    minShift: 0,
  });

  assert.deepEqual(stream.instructions.map((instruction) => instruction.shift), [0, 1, 15]);
  assert.deepEqual(stream.instructions.map((instruction) => instruction.indices), [
    [0, 1, 2],
    [1, 2, 3],
    [2, 3, 0],
  ]);
  assert.deepEqual(stream.stateAfter, { point: 3, shift: 1, gap: 1 });
});

test('UN-GWM-V2 descriptor module does not reference transform or integration helpers', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'gwm-v2.js'), 'utf8');
  const forbiddenNames = [
    'adaptTriadStreamToInstructionPlan',
    'applyTriadInstructionPlan',
    'generateInstructionStream',
    'applyRotateTransform',
    'applySwapTransform',
    'applyStack',
    'createCascadeReport',
    'createCertificate',
    'createCutout',
  ];

  for (const name of forbiddenNames) {
    assert.equal(source.includes(name), false, `${name} must remain outside gwm-v2.js`);
  }
});
