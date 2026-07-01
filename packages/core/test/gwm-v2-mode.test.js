'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const core = require('..');
const {
  GWM_V2_MODE_FORMAT,
  GWM_V2_MODE_VERSION,
  createGwmV2TriadStream,
  createGwmV2Descriptor,
  createGwmV2DescriptorFromPointsAndAdapter,
  gwmV2ModePayload,
  gwmV2ModeCommitment,
  createGwmV2Mode,
  verifyGwmV2Mode,
  assertGwmV2Mode,
} = require('../src/gwm-v2');
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
const { generateInstructionStream } = require('../src/instruction-stream');

const POINTS = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function adapterFixture(adapterContext = {}) {
  const walkOptions = { point: 0, shift: 0, gap: 0, horizon: 3, ring: 17 };
  const context = { payloadLength: 8 };
  const stream = createGwmV2TriadStream(POINTS, walkOptions, context);
  const adapterPlan = adaptTriadStreamToInstructionPlan(stream.triadStream, {
    context: adapterContext,
  });
  const descriptor = createGwmV2Descriptor({
    sourcePointCommitment: stream.sourcePointCommitment,
    walkOptions: stream.walkOptions,
    triadStreamCommitment: stream.triadStreamCommitment,
    adapterPlanCommitment: adapterPlan.adapterCommitment,
    context,
    metadata: { label: 'mode-fixture' },
  });

  return { stream, descriptor, adapterPlan, walkOptions, context };
}

function proofFixture(adapterContext = {}) {
  const fixture = adapterFixture(adapterContext);
  const transformProof = applyTriadInstructionPlan(
    fixture.adapterPlan,
    Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]),
    { context: { proof: 'supplied' } }
  );
  const descriptor = createGwmV2Descriptor({
    ...fixture.descriptor,
    transformProofCommitment: transformProof.proofCommitment,
    metadata: { label: 'mode-proof-fixture' },
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

test('creates a valid GWM-V2 mode wrapper from an existing descriptor and adapter plan', () => {
  const { descriptor, adapterPlan } = adapterFixture({ adapter: 'descriptor-path' });
  const mode = createGwmV2Mode({
    descriptor,
    adapterPlan,
    context: { run: 'descriptor' },
    metadata: { label: 'descriptor-mode' },
  });

  assert.equal(mode.format, GWM_V2_MODE_FORMAT);
  assert.equal(mode.version, GWM_V2_MODE_VERSION);
  assert.equal(mode.mode, 'UN-GWM-V2');
  assert.deepEqual(mode.descriptor, descriptor);
  assert.equal(mode.descriptorCommitment, descriptor.descriptorCommitment);
  assert.equal(mode.sourcePointCommitment, descriptor.sourcePointCommitment);
  assert.equal(mode.triadStreamCommitment, descriptor.triadStreamCommitment);
  assert.equal(mode.adapterPlanCommitment, descriptor.adapterPlanCommitment);
  assert.equal(mode.transformProofCommitment, null);
  assert.equal(mode.adapterBindingCommitment, mode.adapterBinding.bindingCommitment);
  assert.equal(mode.proofBindingCommitment, null);
  assert.equal(mode.transformProof, null);
  assert.equal(mode.proofBinding, null);
  assert.equal(verifyGwmV2Mode(mode).ok, true);
});

test('creates a valid GWM-V2 mode wrapper from points, walk options, and adapter plan', () => {
  const { adapterPlan, walkOptions, context } = adapterFixture({ adapter: 'points-path' });
  const mode = createGwmV2Mode({
    points: POINTS,
    walkOptions,
    adapterPlan,
    context,
    metadata: { label: 'points-mode' },
  });
  const descriptor = createGwmV2DescriptorFromPointsAndAdapter(
    POINTS,
    walkOptions,
    adapterPlan,
    { context, metadata: { label: 'points-mode' } }
  );

  assert.equal(mode.descriptorCommitment, descriptor.descriptorCommitment);
  assert.equal(mode.adapterPlanCommitment, adapterPlan.adapterCommitment);
  assert.equal(verifyGwmV2Mode(mode).ok, true);
});

test('creates and verifies a GWM-V2 mode wrapper with a supplied transform proof', () => {
  const { descriptor, adapterPlan, transformProof } = proofFixture({ adapter: 'proof-path' });
  const mode = createGwmV2Mode({
    descriptor,
    adapterPlan,
    transformProof,
    context: { run: 'proof' },
  });
  const result = verifyGwmV2Mode(mode);

  assert.equal(result.ok, true);
  assert.equal(result.descriptorCommitment, descriptor.descriptorCommitment);
  assert.equal(result.sourcePointCommitment, descriptor.sourcePointCommitment);
  assert.equal(result.triadStreamCommitment, descriptor.triadStreamCommitment);
  assert.equal(result.adapterPlanCommitment, descriptor.adapterPlanCommitment);
  assert.equal(result.transformProofCommitment, transformProof.proofCommitment);
  assert.equal(result.adapterBindingCommitment, mode.adapterBindingCommitment);
  assert.equal(mode.transformProofCommitment, transformProof.proofCommitment);
  assert.equal(mode.proofBindingCommitment, mode.proofBinding.bindingCommitment);
  assert.equal(result.proofBindingCommitment, mode.proofBindingCommitment);
  assert.equal(result.proofBinding.suppliedTransformProofCommitment, transformProof.proofCommitment);
});

test('verification fails without throwing for malformed GWM-V2 mode wrappers', () => {
  const result = verifyGwmV2Mode({ format: GWM_V2_MODE_FORMAT });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid-mode');
  assert.match(result.error, /version|required/);
});

test('verification fails without throwing for adapter plan mismatch', () => {
  const { descriptor, adapterPlan } = adapterFixture();
  const mode = createGwmV2Mode({ descriptor, adapterPlan });
  const changedPlan = changedAdapterPlan(adapterPlan, (payload) => {
    payload.context = { adapter: 'changed' };
  });
  const result = verifyGwmV2Mode({
    ...mode,
    adapterPlan: changedPlan,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'adapter-binding-failed');
  assert.equal(result.descriptorCommitment, descriptor.descriptorCommitment);
  assert.equal(result.sourcePointCommitment, descriptor.sourcePointCommitment);
  assert.equal(result.triadStreamCommitment, descriptor.triadStreamCommitment);
  assert.equal(result.adapterPlanCommitment, descriptor.adapterPlanCommitment);
  assert.equal(result.transformProofCommitment, descriptor.transformProofCommitment);
  assert.equal(result.adapterBindingCommitment, mode.adapterBindingCommitment);
  assert.equal(result.proofBindingCommitment, null);
  assert.equal(result.adapterBinding.ok, false);
  assert.equal(result.adapterBinding.reason, 'adapter-plan-commitment-mismatch');
});

test('verification fails without throwing for proof commitment mismatch', () => {
  const { descriptor, adapterPlan, transformProof } = proofFixture();
  const mode = createGwmV2Mode({ descriptor, adapterPlan, transformProof });
  const changedProof = changedTransformProof(transformProof, (payload) => {
    payload.context = { proof: 'changed' };
  });
  const result = verifyGwmV2Mode({
    ...mode,
    transformProof: changedProof,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'proof-binding-failed');
  assert.equal(result.proofBinding.ok, false);
  assert.equal(result.proofBinding.reason, 'transform-proof-commitment-mismatch');
});

test('creation rejects but verification reports missing proof material non-throwingly', () => {
  const { descriptor, adapterPlan, transformProof } = proofFixture();
  assert.throws(
    () => createGwmV2Mode({ descriptor, adapterPlan }),
    /transform proof material is required/
  );

  const valid = createGwmV2Mode({ descriptor, adapterPlan, transformProof });
  const missingProof = {
    ...valid,
    transformProof: null,
    proofBinding: null,
    proofBindingCommitment: null,
  };
  const result = verifyGwmV2Mode(missingProof);

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'missing-transform-proof-material');
});

test('mode commitments are deterministic for equivalent input', () => {
  const { descriptor, adapterPlan } = adapterFixture({ adapter: 'deterministic' });
  const first = createGwmV2Mode({
    descriptor,
    adapterPlan,
    context: { a: 1 },
    metadata: { b: 2 },
  });
  const second = createGwmV2Mode({
    descriptor: clone(descriptor),
    adapterPlan: clone(adapterPlan),
    metadata: { b: 2 },
    context: { a: 1 },
  });

  assert.equal(second.modeCommitment, first.modeCommitment);
  assert.equal(gwmV2ModeCommitment(gwmV2ModePayload(first)), first.modeCommitment);
});

test('mode commitment changes when descriptor changes', () => {
  const { descriptor, adapterPlan } = adapterFixture();
  const changedDescriptor = createGwmV2Descriptor({
    ...descriptor,
    metadata: { label: 'changed-descriptor' },
  });

  assert.notEqual(
    createGwmV2Mode({ descriptor: changedDescriptor, adapterPlan }).modeCommitment,
    createGwmV2Mode({ descriptor, adapterPlan }).modeCommitment
  );
});

test('mode commitment changes when adapter plan changes', () => {
  const { descriptor, adapterPlan } = adapterFixture();
  const changedPlan = changedAdapterPlan(adapterPlan, (payload) => {
    payload.context = { adapter: 'changed' };
  });
  const changedDescriptor = createGwmV2Descriptor({
    ...descriptor,
    adapterPlanCommitment: changedPlan.adapterCommitment,
  });

  assert.notEqual(
    createGwmV2Mode({ descriptor: changedDescriptor, adapterPlan: changedPlan }).modeCommitment,
    createGwmV2Mode({ descriptor, adapterPlan }).modeCommitment
  );
});

test('mode commitment changes when proof changes', () => {
  const { descriptor, adapterPlan, transformProof } = proofFixture();
  const changedProof = changedTransformProof(transformProof, (payload) => {
    payload.context = { proof: 'changed' };
  });
  const changedDescriptor = createGwmV2Descriptor({
    ...descriptor,
    transformProofCommitment: changedProof.proofCommitment,
  });

  assert.notEqual(
    createGwmV2Mode({
      descriptor: changedDescriptor,
      adapterPlan,
      transformProof: changedProof,
    }).modeCommitment,
    createGwmV2Mode({ descriptor, adapterPlan, transformProof }).modeCommitment
  );
});

test('mode commitment changes when context, metadata, format, or version changes', () => {
  const { descriptor, adapterPlan } = adapterFixture();
  const base = createGwmV2Mode({
    descriptor,
    adapterPlan,
    context: { run: 1 },
    metadata: { label: 'base' },
  });
  const contextChanged = createGwmV2Mode({
    descriptor,
    adapterPlan,
    context: { run: 2 },
    metadata: { label: 'base' },
  });
  const metadataChanged = createGwmV2Mode({
    descriptor,
    adapterPlan,
    context: { run: 1 },
    metadata: { label: 'changed' },
  });

  assert.notEqual(contextChanged.modeCommitment, base.modeCommitment);
  assert.notEqual(metadataChanged.modeCommitment, base.modeCommitment);
  assert.notEqual(gwmV2ModeCommitment({ ...base, format: 'UN-GWM-V2-MODE-NEXT' }), base.modeCommitment);
  assert.notEqual(gwmV2ModeCommitment({ ...base, version: 2 }), base.modeCommitment);
});

test('mode wrapper preserves descriptor, source, stream, adapter, and proof commitments', () => {
  const { descriptor, adapterPlan, transformProof } = proofFixture();
  const mode = createGwmV2Mode({ descriptor, adapterPlan, transformProof });

  assert.equal(mode.descriptorCommitment, descriptor.descriptorCommitment);
  assert.equal(mode.sourcePointCommitment, descriptor.sourcePointCommitment);
  assert.equal(mode.triadStreamCommitment, descriptor.triadStreamCommitment);
  assert.equal(mode.adapterPlanCommitment, adapterPlan.adapterCommitment);
  assert.equal(mode.transformProofCommitment, transformProof.proofCommitment);
  assert.equal(mode.adapterBinding.adapterPlanCommitment, adapterPlan.adapterCommitment);
  assert.equal(mode.proofBinding.suppliedTransformProofCommitment, transformProof.proofCommitment);
});

test('mode wrapper defensively clones descriptor, adapter plan, proof, context, metadata, and results', () => {
  const { descriptor, adapterPlan, transformProof } = proofFixture();
  const input = {
    descriptor: clone(descriptor),
    adapterPlan: clone(adapterPlan),
    transformProof: triadTransformProofPayload(transformProof),
    context: { labels: ['context'] },
    metadata: { labels: ['metadata'] },
  };
  const mode = createGwmV2Mode(input);
  const result = verifyGwmV2Mode(mode);

  input.descriptor.metadata.label = 'mutated';
  input.adapterPlan.context.changed = true;
  input.transformProof.context.proof = 'mutated';
  input.context.labels.push('mutated');
  input.metadata.labels.push('mutated');
  result.adapterBinding.adapterSummary.rotateInstructionCount = 999;

  assert.equal(mode.descriptor.metadata.label, 'mode-proof-fixture');
  assert.deepEqual(mode.adapterPlan.context, {});
  assert.deepEqual(mode.transformProof.context, { proof: 'supplied' });
  assert.deepEqual(mode.context.labels, ['context']);
  assert.deepEqual(mode.metadata.labels, ['metadata']);
  assert.equal(
    verifyGwmV2Mode(mode).adapterBinding.adapterSummary.rotateInstructionCount,
    adapterPlan.rotateInstructions.length
  );
});

test('assertGwmV2Mode accepts valid wrappers and rejects malformed wrappers', () => {
  const { descriptor, adapterPlan } = adapterFixture();
  const mode = createGwmV2Mode({ descriptor, adapterPlan });

  assert.deepEqual(assertGwmV2Mode(mode), mode);
  assert.throws(
    () => assertGwmV2Mode({ ...mode, modeCommitment: '0'.repeat(64) }),
    /mode-commitment-mismatch/
  );
});

test('GWM-V2 mode helpers are exported through packages/core', () => {
  for (const name of [
    'GWM_V2_MODE_FORMAT',
    'GWM_V2_MODE_VERSION',
    'gwmV2ModePayload',
    'gwmV2ModeCommitment',
    'createGwmV2Mode',
    'verifyGwmV2Mode',
    'assertGwmV2Mode',
  ]) {
    assert.equal(core[name], require('../src/gwm-v2')[name]);
  }
});

test('root legacy export and existing UN-GWM behavior remain unchanged with mode helpers present', () => {
  const exported = require('../../..');
  const stream = generateInstructionStream({
    mesh: {
      points: POINTS,
    },
    state: { point: 0, shift: 1, gap: 1 },
    count: 3,
    windowSize: 16,
    minShift: 0,
  });

  assert.equal(typeof exported, 'function');
  assert.equal(exported.name, 'Unobtainium');
  assert.deepEqual(stream.instructions.map((instruction) => instruction.shift), [0, 1, 15]);
});

test('mode creation does not automatically generate adapters, proofs, or apply transforms', () => {
  const { descriptor } = adapterFixture();
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'gwm-v2.js'), 'utf8');

  assert.throws(() => createGwmV2Mode({ descriptor }), /adapterPlan is required/);
  assert.equal(source.includes('adaptTriadStreamToInstructionPlan'), false);
  assert.equal(source.includes('applyTriadInstructionPlan'), false);
  assert.equal(source.includes('reverseTriadInstructionPlan'), false);
  assert.equal(source.includes('roundTripTriadInstructionPlan'), false);
  assert.equal(source.includes('applyRotateTransform'), false);
  assert.equal(source.includes('applySwapTransform'), false);
});
