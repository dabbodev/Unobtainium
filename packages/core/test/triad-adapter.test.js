'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const core = require('..');
const { generateInstructionStream } = require('../src/instruction-stream');

const {
  TRIAD_ADAPTER_FORMAT,
  TRIAD_ADAPTER_VERSION,
  createTriadInstructionStream,
  adaptTriadStreamToRotateInstructions,
  adaptTriadStreamToSwapInstructions,
  adaptTriadStreamToInstructionPlan,
  triadAdapterPayload,
  triadAdapterCommitment,
  assertTriadInstructionPlan,
} = core;

const TRIADS = [
  [
    [1, 2, 3],
    [4, 6, 8],
    [-2, 5, 7],
  ],
  [
    [0, 0, 0],
    [3, 1, 2],
    [5, 8, 13],
  ],
  [
    [1, 1, 1],
    [1, 1, 1],
    [2, 2, 2],
  ],
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function boundedStream(context = { walkIndex: 2, ring: 17, payloadLength: 11 }) {
  return createTriadInstructionStream(TRIADS, context);
}

function unboundedStream() {
  return createTriadInstructionStream(TRIADS, { ring: 17 });
}

test('adapts a valid triad stream into rotate instruction descriptors', () => {
  const stream = boundedStream();
  const rotateInstructions = adaptTriadStreamToRotateInstructions(stream);

  assert.equal(rotateInstructions.length, stream.records.length);
  assert.deepEqual(rotateInstructions.map((instruction) => instruction.recordIndex), [0, 1, 2]);

  rotateInstructions.forEach((instruction, index) => {
    const record = stream.records[index];
    assert.equal(instruction.type, 'UN-ROTATE');
    assert.equal(instruction.delta, record.rotate.delta);
    assert.equal(instruction.direction, record.rotate.direction);
    assert.equal(instruction.ring, record.rotate.ring);
    assert.equal(instruction.mixPattern, record.rotate.mixPattern);
    assert.equal(instruction.sourceTriadInstructionCommitment, record.triadInstructionCommitment);
    assert.equal(instruction.sourceTriadFeatureCommitment, record.triadFeatureCommitment);
    assert.ok(instruction.delta >= 0);
    assert.ok(instruction.delta < instruction.ring);
  });
});

test('adapts a valid bounded triad stream into swap instruction descriptors', () => {
  const stream = boundedStream();
  const swapInstructions = adaptTriadStreamToSwapInstructions(stream);

  assert.equal(swapInstructions.length, stream.records.length);
  assert.deepEqual(swapInstructions.map((instruction) => instruction.recordIndex), [0, 1, 2]);

  swapInstructions.forEach((instruction, index) => {
    const record = stream.records[index];
    assert.equal(instruction.type, 'UN-SWAP');
    assert.equal(instruction.a, record.position.a);
    assert.equal(instruction.b, record.position.b);
    assert.equal(instruction.span, record.position.span);
    assert.equal(instruction.seed, record.position.seed);
    assert.equal(instruction.mixPattern, record.position.mixPattern);
    assert.equal(instruction.sourceTriadInstructionCommitment, record.triadInstructionCommitment);
    assert.equal(instruction.sourceTriadFeatureCommitment, record.triadFeatureCommitment);
    assert.ok(instruction.a >= 0);
    assert.ok(instruction.a < instruction.span);
    assert.ok(instruction.b >= 0);
    assert.ok(instruction.b < instruction.span);
  });
});

test('combined instruction plan contains rotate and swap descriptors', () => {
  const stream = boundedStream();
  const plan = adaptTriadStreamToInstructionPlan(stream, {
    context: { adapter: 'sprint-34', purpose: 'test-vector' },
  });

  assert.equal(plan.format, TRIAD_ADAPTER_FORMAT);
  assert.equal(plan.version, TRIAD_ADAPTER_VERSION);
  assert.equal(plan.sourceStreamCommitment, stream.streamCommitment);
  assert.deepEqual(plan.context, { adapter: 'sprint-34', purpose: 'test-vector' });
  assert.equal(plan.rotateInstructions.length, stream.records.length);
  assert.equal(plan.swapInstructions.length, stream.records.length);
  assert.deepEqual(plan.skippedRecords, []);
  assert.match(plan.adapterCommitment, /^[0-9a-f]{64}$/);
  assert.deepEqual(assertTriadInstructionPlan(plan), plan);
});

test('unbounded position channels skip swap descriptors with deterministic warnings', () => {
  const stream = unboundedStream();
  const swapInstructions = adaptTriadStreamToSwapInstructions(stream);
  const plan = adaptTriadStreamToInstructionPlan(stream);

  assert.deepEqual(swapInstructions, []);
  assert.equal(plan.swapInstructions.length, 0);
  assert.equal(plan.skippedRecords.length, stream.records.length);
  plan.skippedRecords.forEach((warning, index) => {
    assert.equal(warning.recordIndex, index);
    assert.equal(warning.reason, 'position channel has no span; swap descriptor skipped');
    assert.equal(warning.sourceTriadInstructionCommitment, stream.records[index].triadInstructionCommitment);
    assert.equal(warning.sourceTriadFeatureCommitment, stream.records[index].triadFeatureCommitment);
    assert.equal(warning.mixPattern, stream.records[index].position.mixPattern);
  });
});

test('triad adapter payload excludes only the adapter commitment and returns copies', () => {
  const plan = adaptTriadStreamToInstructionPlan(boundedStream());
  const payload = triadAdapterPayload(plan);

  assert.equal(Object.hasOwn(payload, 'adapterCommitment'), false);
  assert.equal(payload.sourceStreamCommitment, plan.sourceStreamCommitment);
  payload.rotateInstructions[0].delta = 999;
  payload.context.changed = true;

  assert.notEqual(plan.rotateInstructions[0].delta, 999);
  assert.equal(Object.hasOwn(plan.context, 'changed'), false);
});

test('same stream and context produce the same adapter commitment', () => {
  const stream = boundedStream();
  const context = { adapter: 'deterministic', nested: { value: 1 } };
  const first = adaptTriadStreamToInstructionPlan(stream, { context });
  const second = adaptTriadStreamToInstructionPlan(clone(stream), { context: clone(context) });

  assert.deepEqual(first, second);
  assert.equal(triadAdapterCommitment(first), first.adapterCommitment);
});

test('source stream commitment changes affect adapter commitment', () => {
  const plan = adaptTriadStreamToInstructionPlan(boundedStream());
  const changed = triadAdapterPayload(plan);
  changed.sourceStreamCommitment = '0'.repeat(64);

  assert.notEqual(triadAdapterCommitment(changed), plan.adapterCommitment);
});

test('record order changes affect adapter commitment', () => {
  const first = adaptTriadStreamToInstructionPlan(boundedStream());
  const reorderedStream = createTriadInstructionStream([TRIADS[1], TRIADS[0], TRIADS[2]], {
    walkIndex: 2,
    ring: 17,
    payloadLength: 11,
  });
  const second = adaptTriadStreamToInstructionPlan(reorderedStream);

  assert.notEqual(second.adapterCommitment, first.adapterCommitment);
  assert.notDeepEqual(second.rotateInstructions, first.rotateInstructions);
});

test('adapter context changes affect adapter commitment', () => {
  const stream = boundedStream();
  const first = adaptTriadStreamToInstructionPlan(stream, { context: { label: 'a' } });
  const second = adaptTriadStreamToInstructionPlan(stream, { context: { label: 'b' } });

  assert.notEqual(second.adapterCommitment, first.adapterCommitment);
});

test('adapter commitment changes when descriptor payload fields change', () => {
  const boundedPlan = adaptTriadStreamToInstructionPlan(boundedStream());
  const unboundedPlan = adaptTriadStreamToInstructionPlan(unboundedStream());

  const changedRotate = triadAdapterPayload(boundedPlan);
  changedRotate.rotateInstructions[0].direction = changedRotate.rotateInstructions[0].direction === 'up'
    ? 'down'
    : 'up';
  assert.notEqual(triadAdapterCommitment(changedRotate), boundedPlan.adapterCommitment);

  const changedSwap = triadAdapterPayload(boundedPlan);
  changedSwap.swapInstructions[0].a = (changedSwap.swapInstructions[0].a + 1)
    % changedSwap.swapInstructions[0].span;
  assert.notEqual(triadAdapterCommitment(changedSwap), boundedPlan.adapterCommitment);

  const changedSkipped = triadAdapterPayload(unboundedPlan);
  changedSkipped.skippedRecords[0].reason = 'changed warning';
  assert.notEqual(triadAdapterCommitment(changedSkipped), unboundedPlan.adapterCommitment);

  const changedFormat = triadAdapterPayload(boundedPlan);
  changedFormat.format = 'UN-TRIAD-MIX-ADAPTER-OTHER';
  assert.notEqual(triadAdapterCommitment(changedFormat), boundedPlan.adapterCommitment);

  const changedVersion = triadAdapterPayload(boundedPlan);
  changedVersion.version += 1;
  assert.notEqual(triadAdapterCommitment(changedVersion), boundedPlan.adapterCommitment);
});

test('malformed and empty triad streams are rejected through stream validation', () => {
  const stream = boundedStream();
  const badRecord = clone(stream);
  badRecord.records[0].rotate.delta = badRecord.records[0].rotate.ring;

  assert.throws(() => adaptTriadStreamToInstructionPlan(badRecord), /does not match/);

  const empty = clone(stream);
  empty.records = [];
  delete empty.streamCommitment;
  assert.throws(() => adaptTriadStreamToInstructionPlan(empty), /at least one record/);
});

test('adapter functions do not mutate caller input', () => {
  const stream = boundedStream();
  const before = clone(stream);

  const rotateInstructions = adaptTriadStreamToRotateInstructions(stream);
  const swapInstructions = adaptTriadStreamToSwapInstructions(stream);
  const plan = adaptTriadStreamToInstructionPlan(stream, { context: { label: 'copy' } });

  rotateInstructions[0].delta = 999;
  swapInstructions[0].a = 999;
  plan.rotateInstructions[0].delta = 999;
  plan.swapInstructions[0].a = 999;

  assert.deepEqual(stream, before);
});

test('assertTriadInstructionPlan accepts valid plans and rejects malformed plans', () => {
  const plan = adaptTriadStreamToInstructionPlan(boundedStream());

  assert.deepEqual(assertTriadInstructionPlan(plan), plan);

  const badCommitment = clone(plan);
  badCommitment.adapterCommitment = '0'.repeat(64);
  assert.throws(() => assertTriadInstructionPlan(badCommitment), /adapterCommitment mismatch/);

  const badRotate = clone(plan);
  badRotate.rotateInstructions[0].delta = badRotate.rotateInstructions[0].ring;
  assert.throws(() => assertTriadInstructionPlan(badRotate), /delta must be within ring bounds/);

  const badSwap = clone(plan);
  badSwap.swapInstructions[0].a = badSwap.swapInstructions[0].span;
  assert.throws(() => assertTriadInstructionPlan(badSwap), /a must be within span bounds/);

  const badFormat = clone(plan);
  badFormat.format = 'OTHER';
  assert.throws(() => assertTriadInstructionPlan(badFormat), /format/);
});

test('public adapter helpers are exported through packages/core entrypoint', () => {
  assert.equal(TRIAD_ADAPTER_FORMAT, 'UN-TRIAD-MIX-ADAPTER');
  assert.equal(TRIAD_ADAPTER_VERSION, 1);
  assert.equal(typeof triadAdapterPayload, 'function');
  assert.equal(typeof triadAdapterCommitment, 'function');
  assert.equal(typeof adaptTriadStreamToRotateInstructions, 'function');
  assert.equal(typeof adaptTriadStreamToSwapInstructions, 'function');
  assert.equal(typeof adaptTriadStreamToInstructionPlan, 'function');
  assert.equal(typeof assertTriadInstructionPlan, 'function');
});

test('root legacy export remains unchanged for triad adapter work', () => {
  const Unobtainium = require('../../..');

  assert.equal(typeof Unobtainium, 'function');
  assert.equal(Unobtainium.name, 'Unobtainium');
});

test('triad adapter work does not alter existing UN-GWM behavior', () => {
  const input = {
    mesh: {
      points: [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
    },
    state: { point: 0, shift: 1, gap: 1 },
    count: 4,
    windowSize: 16,
    mode: 'distinct',
  };
  const before = generateInstructionStream(input);

  adaptTriadStreamToInstructionPlan(boundedStream());

  assert.deepEqual(generateInstructionStream(input), before);
});

test('triad adapter emits descriptors only and no transform-ready application plan', () => {
  const plan = adaptTriadStreamToInstructionPlan(boundedStream());

  assert.equal(Object.hasOwn(plan, 'instructions'), false);
  assert.equal(Object.hasOwn(plan, 'swaps'), false);
  assert.equal(Object.hasOwn(plan, 'stateBefore'), false);
  assert.equal(Object.hasOwn(plan, 'stateAfter'), false);
  assert.equal(plan.rotateInstructions.every((instruction) => instruction.type === 'UN-ROTATE'), true);
  assert.equal(plan.swapInstructions.every((instruction) => instruction.type === 'UN-SWAP'), true);
});
