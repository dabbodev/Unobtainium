'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const core = require('..');
const { generateInstructionStream } = require('../src/instruction-stream');

const {
  TRIAD_TRANSFORM_PROOF_FORMAT,
  TRIAD_TRANSFORM_PROOF_VERSION,
  createTriadInstructionStream,
  adaptTriadStreamToInstructionPlan,
  triadAdapterPayload,
  triadAdapterCommitment,
  triadTransformProofPayload,
  triadTransformProofCommitment,
  applyTriadInstructionPlan,
  reverseTriadInstructionPlan,
  roundTripTriadInstructionPlan,
  assertTriadTransformProof,
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
    [2, 3, 5],
    [7, 11, 13],
    [17, 19, 23],
  ],
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function boundedPlan(context = { ring: 16, payloadLength: 8, walkIndex: 2 }) {
  return adaptTriadStreamToInstructionPlan(createTriadInstructionStream(TRIADS, context), {
    context: { sprint: 35 },
  });
}

function withCommitment(planLike) {
  const payload = triadAdapterPayload(planLike);
  return {
    ...payload,
    adapterCommitment: triadAdapterCommitment(payload),
  };
}

function rotateOnlyPlan() {
  const plan = triadAdapterPayload(boundedPlan());
  plan.swapInstructions = [];
  plan.skippedRecords = [];
  return withCommitment(plan);
}

function swapOnlyPlan() {
  const plan = triadAdapterPayload(boundedPlan());
  plan.rotateInstructions = [plan.rotateInstructions[0]];
  plan.rotateInstructions[0].delta = 0;
  plan.swapInstructions = [plan.swapInstructions[1]];
  plan.skippedRecords = [];
  return withCommitment(plan);
}

test('applies a valid triad instruction plan to a byte payload', () => {
  const payload = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]);
  const proof = applyTriadInstructionPlan(boundedPlan(), payload, {
    context: { purpose: 'apply-test' },
  });

  assert.equal(proof.format, TRIAD_TRANSFORM_PROOF_FORMAT);
  assert.equal(proof.version, TRIAD_TRANSFORM_PROOF_VERSION);
  assert.equal(proof.mode, 'apply');
  assert.equal(Buffer.isBuffer(proof.output), true);
  assert.deepEqual([...proof.output], [14, 1, 0, 3, 2, 15, 4, 5]);
  assert.notDeepEqual([...proof.output], [...payload]);
  assert.equal(proof.appliedOperations.length, 6);
  assert.deepEqual(proof.context, { purpose: 'apply-test' });
  assert.deepEqual(assertTriadTransformProof(proof), {
    ...triadTransformProofPayload(proof),
    proofCommitment: proof.proofCommitment,
  });
});

test('reversing the applied plan restores the original payload', () => {
  const payload = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]);
  const plan = boundedPlan();
  const applied = applyTriadInstructionPlan(plan, payload);
  const reversed = reverseTriadInstructionPlan(plan, applied.output);

  assert.equal(reversed.mode, 'reverse');
  assert.deepEqual([...reversed.output], [...payload]);
  assert.deepEqual(
    reversed.appliedOperations.map((operation) => operation.reverseOfOperationIndex),
    [5, 4, 3, 2, 1, 0]
  );
});

test('roundTripTriadInstructionPlan proves apply and reverse roundtrip', () => {
  const payload = new Uint8Array([3, 1, 4, 1, 5, 9, 2, 6]);
  const roundTrip = roundTripTriadInstructionPlan(boundedPlan(), payload);

  assert.equal(roundTrip.roundTrip, true);
  assert.equal(roundTrip.applied.mode, 'apply');
  assert.equal(roundTrip.reversed.mode, 'reverse');
  assert.deepEqual([...roundTrip.restored], [...payload]);
  assert.equal(roundTrip.restoredPayloadCommitment, roundTrip.inputPayloadCommitment);
});

test('rotate descriptors affect payload deterministically', () => {
  const payload = [0, 1, 2, 3, 4, 5, 6, 7];
  const first = applyTriadInstructionPlan(rotateOnlyPlan(), payload);
  const second = applyTriadInstructionPlan(rotateOnlyPlan(), payload);

  assert.deepEqual(first.output, [14, 15, 0, 1, 2, 3, 4, 5]);
  assert.deepEqual(second.output, first.output);
  assert.equal(second.proofCommitment, first.proofCommitment);
});

test('swap descriptors affect payload deterministically when bounded', () => {
  const payload = [0, 1, 2, 3, 4, 5, 6, 7];
  const proof = applyTriadInstructionPlan(swapOnlyPlan(), payload);

  assert.deepEqual(proof.output, [0, 5, 2, 3, 4, 1, 6, 7]);
  assert.deepEqual(
    proof.appliedOperations.map((operation) => operation.type),
    ['UN-ROTATE', 'UN-SWAP']
  );
});

test('combined rotate and swap descriptors apply in source record order', () => {
  const proof = applyTriadInstructionPlan(boundedPlan(), Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]));

  assert.deepEqual(
    proof.appliedOperations.map((operation) => [operation.type, operation.recordIndex]),
    [
      ['UN-ROTATE', 0],
      ['UN-SWAP', 0],
      ['UN-ROTATE', 1],
      ['UN-SWAP', 1],
      ['UN-ROTATE', 2],
      ['UN-SWAP', 2],
    ]
  );
});

test('same payload and plan produce the same output and proof commitment', () => {
  const payload = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]);
  const plan = boundedPlan();
  const first = applyTriadInstructionPlan(plan, payload);
  const second = applyTriadInstructionPlan(clone(plan), Buffer.from(payload));

  assert.deepEqual([...second.output], [...first.output]);
  assert.equal(second.outputPayloadCommitment, first.outputPayloadCommitment);
  assert.equal(second.proofCommitment, first.proofCommitment);
});

test('changing payload changes output and proof commitment', () => {
  const plan = boundedPlan();
  const first = applyTriadInstructionPlan(plan, Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]));
  const second = applyTriadInstructionPlan(plan, Buffer.from([0, 1, 2, 3, 4, 5, 6, 8]));

  assert.notDeepEqual([...second.output], [...first.output]);
  assert.notEqual(second.outputPayloadCommitment, first.outputPayloadCommitment);
  assert.notEqual(second.proofCommitment, first.proofCommitment);
});

test('changing plan changes output and proof commitment', () => {
  const payload = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]);
  const first = applyTriadInstructionPlan(boundedPlan(), payload);
  const changedPlan = triadAdapterPayload(boundedPlan());
  changedPlan.rotateInstructions[0].delta = (changedPlan.rotateInstructions[0].delta + 1)
    % changedPlan.rotateInstructions[0].ring;
  const second = applyTriadInstructionPlan(withCommitment(changedPlan), payload);

  assert.notDeepEqual([...second.output], [...first.output]);
  assert.notEqual(second.sourcePlanCommitment, first.sourcePlanCommitment);
  assert.notEqual(second.proofCommitment, first.proofCommitment);
});

test('proof commitment changes when operation summaries or context change', () => {
  const proof = applyTriadInstructionPlan(boundedPlan(), Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]));
  const changedOperation = triadTransformProofPayload(proof);
  changedOperation.appliedOperations[0].delta += 1;
  const changedContext = triadTransformProofPayload(proof);
  changedContext.context = { label: 'changed' };

  assert.notEqual(triadTransformProofCommitment(changedOperation), proof.proofCommitment);
  assert.notEqual(triadTransformProofCommitment(changedContext), proof.proofCommitment);
});

test('malformed plan is rejected', () => {
  const plan = boundedPlan();
  const malformed = clone(plan);
  malformed.adapterCommitment = '0'.repeat(64);

  assert.throws(
    () => applyTriadInstructionPlan(malformed, Buffer.from([0, 1, 2, 3, 4, 5, 6, 7])),
    /adapterCommitment mismatch/
  );
});

test('unsupported descriptor type is rejected', () => {
  const plan = triadAdapterPayload(boundedPlan());
  plan.rotateInstructions[0].type = 'UN-OTHER';

  assert.throws(
    () => applyTriadInstructionPlan(withCommitment(plan), Buffer.from([0, 1, 2, 3, 4, 5, 6, 7])),
    /type must be UN-ROTATE/
  );
});

test('invalid payload is rejected', () => {
  assert.throws(() => applyTriadInstructionPlan(boundedPlan(), 'bytes'), /payload must be/);
  assert.throws(() => applyTriadInstructionPlan(boundedPlan(), [0, 1, 256]), /between 0 and 255/);
});

test('unbounded or null active swap descriptors are rejected', () => {
  const plan = triadAdapterPayload(boundedPlan());
  plan.swapInstructions[0].span = null;
  plan.swapInstructions[0].a = null;
  plan.swapInstructions[0].b = null;

  assert.throws(
    () => applyTriadInstructionPlan(withCommitment(plan), Buffer.from([0, 1, 2, 3, 4, 5, 6, 7])),
    /span/
  );
});

test('swap descriptors whose span differs from payload length are rejected', () => {
  assert.throws(
    () => applyTriadInstructionPlan(boundedPlan(), Buffer.from([0, 1, 2, 3])),
    /span must match payload length/
  );
});

test('caller input payload and plan object are not mutated', () => {
  const payload = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]);
  const beforePayload = Buffer.from(payload);
  const plan = boundedPlan();
  const beforePlan = clone(plan);

  const proof = applyTriadInstructionPlan(plan, payload);
  proof.output[0] = 255;

  assert.deepEqual([...payload], [...beforePayload]);
  assert.deepEqual(plan, beforePlan);
});

test('assertTriadTransformProof accepts valid proofs and rejects malformed ones', () => {
  const proof = applyTriadInstructionPlan(boundedPlan(), Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]));

  assert.deepEqual(assertTriadTransformProof(proof), {
    ...triadTransformProofPayload(proof),
    proofCommitment: proof.proofCommitment,
  });

  const badCommitment = { ...proof, proofCommitment: '0'.repeat(64) };
  assert.throws(() => assertTriadTransformProof(badCommitment), /proofCommitment mismatch/);

  const badOutput = { ...proof, output: Buffer.from([1, 2, 3]) };
  assert.throws(() => assertTriadTransformProof(badOutput), /outputPayloadCommitment mismatch/);

  const badOperation = triadTransformProofPayload(proof);
  badOperation.appliedOperations[0].type = 'UN-OTHER';
  assert.throws(() => assertTriadTransformProof(badOperation), /not supported/);
});

test('public transform proof helpers are exported through packages/core entrypoint', () => {
  assert.equal(TRIAD_TRANSFORM_PROOF_FORMAT, 'UN-TRIAD-MIX-TRANSFORM-PROOF');
  assert.equal(TRIAD_TRANSFORM_PROOF_VERSION, 1);
  assert.equal(typeof triadTransformProofPayload, 'function');
  assert.equal(typeof triadTransformProofCommitment, 'function');
  assert.equal(typeof applyTriadInstructionPlan, 'function');
  assert.equal(typeof reverseTriadInstructionPlan, 'function');
  assert.equal(typeof roundTripTriadInstructionPlan, 'function');
  assert.equal(typeof assertTriadTransformProof, 'function');
});

test('root legacy export remains unchanged for triad transform proof work', () => {
  const Unobtainium = require('../../..');

  assert.equal(typeof Unobtainium, 'function');
  assert.equal(Unobtainium.name, 'Unobtainium');
});

test('triad transform proof work does not alter existing UN-GWM behavior', () => {
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

  applyTriadInstructionPlan(boundedPlan(), Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]));

  assert.deepEqual(generateInstructionStream(input), before);
});
