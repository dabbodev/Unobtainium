'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  applyStack,
  createSignedStackEnvelope,
  createValidationGate,
  generateEd25519KeyPair,
  gatePayload,
  objectCommitment,
  sliceCommitment,
  verifyValidationGate,
} = require('..');

function baseMesh() {
  return [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 0],
    [0, 1, 1],
  ];
}

function rotateLayer(overrides = {}) {
  return {
    id: 'rotate-layer',
    type: 'UN-ROTATE',
    mesh: baseMesh(),
    graftMode: 'none',
    stateMode: 'explicit',
    state: { point: 0, shift: 1, gap: 1 },
    direction: 'up',
    turns: 2,
    minShift: 1,
    walkMode: 'permissive',
    ...overrides,
  };
}

function swapLayer(overrides = {}) {
  return {
    id: 'swap-layer',
    type: 'UN-SWAP',
    mesh: baseMesh(),
    graftMode: 'none',
    stateMode: 'explicit',
    state: { point: 0, shift: 1, gap: 1 },
    swapCount: 3,
    minShift: 1,
    walkMode: 'permissive',
    ...overrides,
  };
}

function stack(overrides = {}) {
  return {
    format: 'UNSTACK',
    version: 1,
    windowSize: 16,
    metadata: { recipe: 'gate-test' },
    layers: [rotateLayer()],
    ...overrides,
  };
}

function envelope(overrides = {}) {
  const keys = overrides.keys || generateEd25519KeyPair();
  return createSignedStackEnvelope({
    stack: overrides.stack || stack(),
    signerId: overrides.signerId || 'owner:test',
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
    purpose: overrides.purpose || 'owner-signed-stack',
    metadata: overrides.metadata || { sprint: 10 },
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function gateFixture(overrides = {}) {
  const data = overrides.data || Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const range = overrides.range || { start: 2, length: 4 };
  const signedStackEnvelope = overrides.signedStackEnvelope || envelope();
  const metadata = overrides.metadata || { ticket: 'gate-1', labels: ['validate'] };
  const gate = createValidationGate({
    objectId: overrides.objectId || 'object:test',
    data,
    range,
    signedStackEnvelope,
    metadata,
  });

  return {
    data,
    range,
    signedStackEnvelope,
    metadata,
    gate,
  };
}

test('objectCommitment is deterministic', () => {
  const data = [1, 2, 3, 4];

  assert.equal(objectCommitment(data), objectCommitment(data));
  assert.match(objectCommitment(data), /^[0-9a-f]{64}$/);
});

test('objectCommitment differs when data differs', () => {
  assert.notEqual(objectCommitment([1, 2, 3]), objectCommitment([1, 2, 4]));
});

test('sliceCommitment is deterministic', () => {
  const data = Buffer.from([0, 1, 2, 3, 4, 5]);
  const range = { start: 1, length: 3 };

  assert.equal(sliceCommitment(data, range), sliceCommitment(data, range));
  assert.match(sliceCommitment(data, range), /^[0-9a-f]{64}$/);
});

test('sliceCommitment differs when range changes even if selected bytes match', () => {
  const data = [9, 1, 2, 1, 2, 9];

  assert.notEqual(
    sliceCommitment(data, { start: 1, length: 2 }),
    sliceCommitment(data, { start: 3, length: 2 }),
  );
});

test('malformed ranges throw', () => {
  const data = [0, 1, 2, 3];

  assert.throws(() => sliceCommitment(data, null), /range must be an object/);
  assert.throws(() => sliceCommitment(data, { start: -1, length: 1 }), /range.start/);
  assert.throws(() => sliceCommitment(data, { start: 0, length: 0 }), /range.length/);
  assert.throws(() => sliceCommitment(data, { start: 3, length: 2 }), /within data length/);
  assert.throws(() => sliceCommitment(data, { start: 1.5, length: 1 }), /range.start/);
  assert.throws(() => sliceCommitment(data, { start: 1, length: 1.5 }), /range.length/);
});

test('can create validation gate from data, range, and signed stack', () => {
  const { gate, signedStackEnvelope } = gateFixture();

  assert.equal(gate.format, 'UN-GATE');
  assert.equal(gate.version, 1);
  assert.equal(gate.permission, 'validate');
  assert.equal(gate.objectId, 'object:test');
  assert.deepEqual(gate.range, { start: 2, length: 4 });
  assert.equal(gate.signedStackCommitment, signedStackEnvelope.stackCommitment);
  assert.equal(gate.signedStackPayloadCommitment, signedStackEnvelope.payloadCommitment);
  assert.deepEqual(Object.keys(gatePayload(gate)).sort(), [
    'format',
    'metadata',
    'objectCommitment',
    'objectId',
    'permission',
    'range',
    'signedStackCommitment',
    'signedStackPayloadCommitment',
    'sliceCommitment',
    'version',
  ]);
});

test('created gate verifies with data and signed stack', () => {
  const { gate, data, signedStackEnvelope } = gateFixture();
  const result = verifyValidationGate(gate, { data, signedStackEnvelope });

  assert.equal(result.valid, true);
  assert.equal(result.permission, 'validate');
  assert.equal(result.objectId, gate.objectId);
  assert.deepEqual(result.range, gate.range);
  assert.equal(result.gateCommitment, gate.gateCommitment);
  assert.equal(result.objectCommitment, gate.objectCommitment);
  assert.equal(result.sliceCommitment, gate.sliceCommitment);
  assert.equal(result.signedStackCommitment, gate.signedStackCommitment);
  assert.equal(result.signedStackPayloadCommitment, gate.signedStackPayloadCommitment);
});

test('created gate verifies structurally without data when gate commitment is intact', () => {
  const { gate, signedStackEnvelope } = gateFixture();

  assert.equal(verifyValidationGate(gate, { signedStackEnvelope }).valid, true);
});

test('created gate verifies structurally without signed stack when gate commitment is intact', () => {
  const { gate, data } = gateFixture();

  assert.equal(verifyValidationGate(gate, { data }).valid, true);
});

test('created gate verifies structurally without data or signed stack when gate commitment is intact', () => {
  const { gate } = gateFixture();

  assert.equal(verifyValidationGate(gate).valid, true);
});

test('verification with supplied signed stack detects signed stack mismatch', () => {
  const { gate } = gateFixture();
  const otherSignedStackEnvelope = envelope({
    metadata: { sprint: 10, other: true },
  });
  const result = verifyValidationGate(gate, { signedStackEnvelope: otherSignedStackEnvelope });

  assert.equal(result.valid, false);
  assert.match(result.reason, /signedStack/);
});

test('verification with supplied data detects object data mismatch outside the range', () => {
  const { gate, data } = gateFixture();
  const tampered = Buffer.from(data);
  tampered[9] ^= 0xff;
  const result = verifyValidationGate(gate, { data: tampered });

  assert.deepEqual(result, { valid: false, reason: 'objectCommitment mismatch' });
});

test('verification with supplied data detects slice mismatch inside the range', () => {
  const { gate, data } = gateFixture();
  const tampered = Buffer.from(data);
  tampered[3] ^= 0xff;
  const result = verifyValidationGate(gate, { data: tampered });

  assert.deepEqual(result, { valid: false, reason: 'sliceCommitment mismatch' });
});

test('tampering range invalidates gate', () => {
  const { gate } = gateFixture();
  const tampered = clone(gate);
  tampered.range.start += 1;

  assert.equal(verifyValidationGate(tampered).valid, false);
});

test('tampering objectId invalidates gate', () => {
  const { gate } = gateFixture();
  const tampered = clone(gate);
  tampered.objectId = 'object:other';

  assert.equal(verifyValidationGate(tampered).valid, false);
});

test('tampering objectCommitment invalidates gate', () => {
  const { gate } = gateFixture();
  const tampered = clone(gate);
  tampered.objectCommitment = '0'.repeat(64);

  assert.equal(verifyValidationGate(tampered).valid, false);
});

test('tampering sliceCommitment invalidates gate', () => {
  const { gate } = gateFixture();
  const tampered = clone(gate);
  tampered.sliceCommitment = '0'.repeat(64);

  assert.equal(verifyValidationGate(tampered).valid, false);
});

test('tampering signedStackCommitment invalidates gate', () => {
  const { gate } = gateFixture();
  const tampered = clone(gate);
  tampered.signedStackCommitment = '0'.repeat(64);

  assert.equal(verifyValidationGate(tampered).valid, false);
});

test('tampering signedStackPayloadCommitment invalidates gate', () => {
  const { gate } = gateFixture();
  const tampered = clone(gate);
  tampered.signedStackPayloadCommitment = '0'.repeat(64);

  assert.equal(verifyValidationGate(tampered).valid, false);
});

test('tampering metadata invalidates gate', () => {
  const { gate } = gateFixture();
  const tampered = clone(gate);
  tampered.metadata.ticket = 'gate-2';

  assert.equal(verifyValidationGate(tampered).valid, false);
});

test('unsupported permission invalidates gate', () => {
  const { gate } = gateFixture();
  const tampered = clone(gate);
  tampered.permission = 'decrypt';
  const result = verifyValidationGate(tampered);

  assert.deepEqual(result, { valid: false, reason: 'gate permission is not supported' });
});

test('malformed gate returns invalid result', () => {
  assert.deepEqual(verifyValidationGate(null), { valid: false, reason: 'gate must be an object' });
  assert.equal(verifyValidationGate({ format: 'UN-GATE', version: 1 }).valid, false);
});

test('create and verify do not mutate data, range, metadata, gate, or signed stack envelope', () => {
  const data = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]);
  const range = { start: 1, length: 4 };
  const metadata = { z: 1, nested: { a: true } };
  const signedStackEnvelope = envelope();
  const dataBefore = Buffer.from(data);
  const rangeBefore = clone(range);
  const metadataBefore = clone(metadata);
  const signedBefore = clone(signedStackEnvelope);
  const gate = createValidationGate({
    objectId: 'object:immutability',
    data,
    range,
    signedStackEnvelope,
    metadata,
  });
  const gateBefore = clone(gate);

  verifyValidationGate(gate, { data, signedStackEnvelope });

  assert.deepEqual([...data], [...dataBefore]);
  assert.deepEqual(range, rangeBefore);
  assert.deepEqual(metadata, metadataBefore);
  assert.deepEqual(signedStackEnvelope, signedBefore);
  assert.deepEqual(gate, gateBefore);
});

test('Array, Buffer, and Uint8Array data are supported', () => {
  const signedStackEnvelope = envelope();
  const range = { start: 1, length: 3 };

  for (const data of [
    [0, 1, 2, 3, 4],
    Buffer.from([0, 1, 2, 3, 4]),
    new Uint8Array([0, 1, 2, 3, 4]),
  ]) {
    const gate = createValidationGate({
      objectId: 'object:type-support',
      data,
      range,
      signedStackEnvelope,
    });

    assert.equal(verifyValidationGate(gate, { data, signedStackEnvelope }).valid, true);
  }
});

test('gate range can point to transformed data produced by applyStack', () => {
  const recipe = stack({
    layers: [
      rotateLayer({ id: 'rotate-a', turns: 1 }),
      swapLayer({ id: 'swap-b', swapCount: 4 }),
    ],
  });
  const signedStackEnvelope = envelope({ stack: recipe });
  const source = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const transformed = applyStack(source, recipe);
  const range = { start: 2, length: 5 };
  const gate = createValidationGate({
    objectId: 'object:transformed',
    data: transformed,
    range,
    signedStackEnvelope,
    metadata: { stage: 'after-stack' },
  });

  assert.equal(verifyValidationGate(gate, { data: transformed, signedStackEnvelope }).valid, true);

  const insideTamper = Buffer.from(transformed);
  insideTamper[4] ^= 0xff;
  assert.deepEqual(
    verifyValidationGate(gate, { data: insideTamper, signedStackEnvelope }),
    { valid: false, reason: 'sliceCommitment mismatch' },
  );

  const outsideTamper = Buffer.from(transformed);
  outsideTamper[9] ^= 0xff;
  assert.deepEqual(
    verifyValidationGate(gate, { data: outsideTamper, signedStackEnvelope }),
    { valid: false, reason: 'objectCommitment mismatch' },
  );
});
