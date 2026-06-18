'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  applyPatch,
  applyStack,
  createAddPatch,
  createSignedPatchEnvelope,
  createSignedStackEnvelope,
  generateEd25519KeyPair,
  patchCommitment,
  reversePatch,
  reverseStack,
  signedPatchPayload,
  verifyPatch,
  verifySignedPatchEnvelope,
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
    metadata: { recipe: 'signed-patch-test' },
    layers: [rotateLayer()],
    ...overrides,
  };
}

function signedStackEnvelope(overrides = {}) {
  const keys = overrides.keys || generateEd25519KeyPair();
  return createSignedStackEnvelope({
    stack: overrides.stack || stack(),
    signerId: overrides.signerId || 'owner:stack',
    privateKey: keys.privateKey,
    publicKey: overrides.publicKey || keys.publicKey,
    purpose: overrides.purpose || 'owner-signed-stack',
    metadata: overrides.metadata || { sprint: 12, subject: 'stack' },
  });
}

function patchFixture(overrides = {}) {
  const data = overrides.data || Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const range = overrides.range || { start: 2, length: 4 };
  const deltas = overrides.deltas || [1, 0, 255, -2];
  const signedStack = Object.hasOwn(overrides, 'signedStackEnvelope')
    ? overrides.signedStackEnvelope
    : signedStackEnvelope();
  const patch = createAddPatch({
    objectId: overrides.objectId || 'object:test',
    data,
    range,
    deltas,
    windowSize: overrides.windowSize || 256,
    signedStackEnvelope: signedStack,
    metadata: overrides.patchMetadata || { ticket: 'patch-1', labels: ['add'] },
  });

  return {
    data,
    range,
    deltas,
    signedStackEnvelope: signedStack,
    patch,
  };
}

function signedPatchEnvelope(overrides = {}) {
  const keys = overrides.keys || generateEd25519KeyPair();
  const { patch } = Object.hasOwn(overrides, 'patch')
    ? { patch: overrides.patch }
    : patchFixture(overrides);

  return createSignedPatchEnvelope({
    patch,
    signerId: overrides.signerId || 'owner:patch',
    privateKey: keys.privateKey,
    publicKey: overrides.publicKey || keys.publicKey,
    purpose: overrides.purpose || 'owner-signed-patch',
    metadata: Object.hasOwn(overrides, 'metadata')
      ? overrides.metadata
      : { sprint: 12, subject: 'patch' },
    algorithm: overrides.algorithm || 'ed25519',
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('can create signed patch envelope', () => {
  const signed = signedPatchEnvelope();

  assert.equal(signed.format, 'UNPATCH-SIGNED');
  assert.equal(signed.version, 1);
  assert.equal(signed.patch.format, 'UNPATCH');
  assert.equal(signed.patchCommitment, signed.patch.patchCommitment);
  assert.match(signed.patchCommitment, /^[0-9a-f]{64}$/);
  assert.match(signed.payloadCommitment, /^[0-9a-f]{64}$/);
  assert.equal(signed.signerId, 'owner:patch');
  assert.equal(signed.purpose, 'owner-signed-patch');
  assert.deepEqual(signed.metadata, { sprint: 12, subject: 'patch' });
  assert.equal(signed.signature.algorithm, 'ed25519');
  assert.equal(signed.signature.signerId, 'owner:patch');
  assert.match(signed.signature.publicKey, /BEGIN PUBLIC KEY/);
  assert.equal(typeof signed.signature.value, 'string');
});

test('verifies valid signed patch envelope', () => {
  const signed = signedPatchEnvelope();

  assert.equal(verifySignedPatchEnvelope(signed).valid, true);
});

test('verification result includes signerId, purpose, patchCommitment, and payloadCommitment', () => {
  const signed = signedPatchEnvelope();
  const result = verifySignedPatchEnvelope(signed);

  assert.equal(result.valid, true);
  assert.equal(result.signerId, signed.signerId);
  assert.equal(result.purpose, signed.purpose);
  assert.equal(result.patchCommitment, signed.patchCommitment);
  assert.equal(result.payloadCommitment, signed.payloadCommitment);
});

test('signing does not mutate patch', () => {
  const { patch } = patchFixture();
  const before = clone(patch);
  const keys = generateEd25519KeyPair();

  createSignedPatchEnvelope({
    patch,
    signerId: 'owner:patch',
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
  });

  assert.deepEqual(patch, before);
});

test('signing does not mutate metadata', () => {
  const metadata = { z: 1, a: { b: true } };
  const before = clone(metadata);

  signedPatchEnvelope({ metadata });

  assert.deepEqual(metadata, before);
});

test('verification does not mutate envelope', () => {
  const signed = signedPatchEnvelope();
  const before = clone(signed);

  verifySignedPatchEnvelope(signed);

  assert.deepEqual(signed, before);
});

test('tampering patch object invalidates verification', () => {
  const tampered = clone(signedPatchEnvelope());
  tampered.patch.objectId = 'object:other';

  assert.equal(verifySignedPatchEnvelope(tampered).valid, false);
});

test('tampering range invalidates verification', () => {
  const tampered = clone(signedPatchEnvelope());
  tampered.patch.range.start += 1;

  assert.equal(verifySignedPatchEnvelope(tampered).valid, false);
});

test('tampering deltas invalidates verification', () => {
  const tampered = clone(signedPatchEnvelope());
  tampered.patch.deltas[0] += 1;

  assert.equal(verifySignedPatchEnvelope(tampered).valid, false);
});

test('tampering windowSize invalidates verification', () => {
  const tampered = clone(signedPatchEnvelope());
  tampered.patch.windowSize = 16;

  assert.equal(verifySignedPatchEnvelope(tampered).valid, false);
});

test('tampering baseObjectCommitment invalidates verification', () => {
  const tampered = clone(signedPatchEnvelope());
  tampered.patch.baseObjectCommitment = '0'.repeat(64);

  assert.equal(verifySignedPatchEnvelope(tampered).valid, false);
});

test('tampering baseSliceCommitment invalidates verification', () => {
  const tampered = clone(signedPatchEnvelope());
  tampered.patch.baseSliceCommitment = '0'.repeat(64);

  assert.equal(verifySignedPatchEnvelope(tampered).valid, false);
});

test('tampering signedStackCommitment invalidates verification', () => {
  const tampered = clone(signedPatchEnvelope());
  tampered.patch.signedStackCommitment = '0'.repeat(64);

  assert.equal(verifySignedPatchEnvelope(tampered).valid, false);
});

test('tampering signedStackPayloadCommitment invalidates verification', () => {
  const tampered = clone(signedPatchEnvelope());
  tampered.patch.signedStackPayloadCommitment = '0'.repeat(64);

  assert.equal(verifySignedPatchEnvelope(tampered).valid, false);
});

test('tampering metadata invalidates verification', () => {
  const tampered = clone(signedPatchEnvelope());
  tampered.metadata.sprint = 13;

  assert.equal(verifySignedPatchEnvelope(tampered).valid, false);
});

test('tampering signerId invalidates verification', () => {
  const tampered = clone(signedPatchEnvelope());
  tampered.signerId = 'owner:other';

  assert.equal(verifySignedPatchEnvelope(tampered).valid, false);
});

test('tampering purpose invalidates verification', () => {
  const tampered = clone(signedPatchEnvelope());
  tampered.purpose = 'other-purpose';

  assert.equal(verifySignedPatchEnvelope(tampered).valid, false);
});

test('tampering algorithm invalidates verification', () => {
  const tampered = clone(signedPatchEnvelope());
  tampered.signature.algorithm = 'rsa';

  assert.equal(verifySignedPatchEnvelope(tampered).valid, false);
});

test('tampering signature value invalidates verification', () => {
  const tampered = clone(signedPatchEnvelope());
  tampered.signature.value = `${tampered.signature.value.slice(0, -4)}AAAA`;

  assert.equal(verifySignedPatchEnvelope(tampered).valid, false);
});

test('envelope patchCommitment mismatch invalidates verification', () => {
  const tampered = clone(signedPatchEnvelope());
  tampered.patchCommitment = '0'.repeat(64);

  assert.equal(verifySignedPatchEnvelope(tampered).valid, false);
});

test('unsupported algorithm is rejected', () => {
  const keys = generateEd25519KeyPair();
  const { patch } = patchFixture();

  assert.throws(() => createSignedPatchEnvelope({
    patch,
    signerId: 'owner:patch',
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
    algorithm: 'rsa',
  }), /not supported/);

  const tampered = clone(signedPatchEnvelope());
  tampered.signature.algorithm = 'rsa';

  assert.equal(verifySignedPatchEnvelope(tampered).valid, false);
});

test('malformed envelope returns invalid result', () => {
  assert.deepEqual(
    verifySignedPatchEnvelope(null),
    { valid: false, reason: 'envelope must be an object' },
  );
  assert.equal(verifySignedPatchEnvelope({ format: 'UNPATCH-SIGNED', version: 1 }).valid, false);
});

test('equivalent metadata object key order produces same valid payload commitment', () => {
  const keys = generateEd25519KeyPair();
  const { patch } = patchFixture();
  const first = createSignedPatchEnvelope({
    patch,
    signerId: 'owner:patch',
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
    metadata: { b: 2, a: 1 },
  });
  const second = createSignedPatchEnvelope({
    patch,
    signerId: 'owner:patch',
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
    metadata: { a: 1, b: 2 },
  });

  assert.equal(verifySignedPatchEnvelope(first).valid, true);
  assert.equal(verifySignedPatchEnvelope(second).valid, true);
  assert.equal(first.payloadCommitment, second.payloadCommitment);
});

test('different metadata values produce different payload commitment', () => {
  const keys = generateEd25519KeyPair();
  const { patch } = patchFixture();
  const first = createSignedPatchEnvelope({
    patch,
    signerId: 'owner:patch',
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
    metadata: { value: 'a' },
  });
  const second = createSignedPatchEnvelope({
    patch,
    signerId: 'owner:patch',
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
    metadata: { value: 'b' },
  });

  assert.notEqual(first.payloadCommitment, second.payloadCommitment);
});

test('signedPatchPayload is canonical, domain-separated, and excludes signature value', () => {
  const payload = signedPatchPayload({
    patchCommitment: 'a'.repeat(64),
    signerId: 'owner:patch',
    purpose: 'owner-signed-patch',
    metadata: { b: 2, a: 1 },
    algorithm: 'ed25519',
  });

  assert.equal(
    payload,
    '{"algorithm":"ed25519","domain":"UNPATCH-SIGNED:v1","format":"UNPATCH-SIGNED","metadata":{"a":1,"b":2},"patchCommitment":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","purpose":"owner-signed-patch","signerId":"owner:patch","version":1}',
  );
  assert.equal(payload.includes('signature'), false);
});

test('signed patch binds to the committed patch payload', () => {
  const { patch } = patchFixture();
  const signed = signedPatchEnvelope({ patch });

  assert.equal(signed.patchCommitment, patchCommitment(patch));
  assert.equal(verifySignedPatchEnvelope(signed).patchCommitment, patch.patchCommitment);
});

test('mixed signed stack patch integration applies and reverses', () => {
  const recipe = stack({
    layers: [
      rotateLayer({ id: 'rotate-a', turns: 1 }),
      swapLayer({ id: 'swap-b', swapCount: 4 }),
    ],
  });
  const stackKeys = generateEd25519KeyPair();
  const signedStack = signedStackEnvelope({
    stack: recipe,
    keys: stackKeys,
    signerId: 'owner:stack',
    metadata: { sprint: 12, integration: true },
  });
  const source = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const transformed = applyStack(source, signedStack.stack);
  const patch = createAddPatch({
    objectId: 'object:integration',
    data: transformed,
    range: { start: 2, length: 5 },
    deltas: [1, 2, 3, 4, 5],
    windowSize: 16,
    signedStackEnvelope: signedStack,
    metadata: { stage: 'after-stack' },
  });
  const patchKeys = generateEd25519KeyPair();
  const signedPatch = createSignedPatchEnvelope({
    patch,
    signerId: 'owner:patch',
    privateKey: patchKeys.privateKey,
    publicKey: patchKeys.publicKey,
    metadata: { sprint: 12, integration: true },
  });

  assert.equal(verifySignedPatchEnvelope(signedPatch).valid, true);
  assert.equal(verifyPatch(signedPatch.patch, { data: transformed, signedStackEnvelope: signedStack }).valid, true);

  const patched = applyPatch(transformed, signedPatch.patch);
  const unpatched = reversePatch(patched, signedPatch.patch);
  const restored = reverseStack(unpatched, signedStack.stack);

  assert.notDeepEqual([...patched], [...transformed]);
  assert.deepEqual([...unpatched], [...transformed]);
  assert.deepEqual([...restored], [...source]);

  const tampered = clone(signedPatch);
  tampered.patch.deltas[0] += 1;
  assert.equal(verifySignedPatchEnvelope(tampered).valid, false);
});
