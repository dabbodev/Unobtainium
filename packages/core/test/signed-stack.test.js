'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  applyStack,
  createContextPacket,
  createSignedStackEnvelope,
  generateEd25519KeyPair,
  reverseStack,
  signedStackPayload,
  stackCommitment,
  verifySignedStackEnvelope,
} = require('..');

function baseMesh() {
  return [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 0],
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
    metadata: { recipe: 'signed-stack-test' },
    layers: [rotateLayer()],
    ...overrides,
  };
}

function keyPair() {
  return generateEd25519KeyPair();
}

function envelope(overrides = {}) {
  const keys = overrides.keys || keyPair();
  return createSignedStackEnvelope({
    stack: overrides.stack || stack(),
    signerId: overrides.signerId || 'owner:test',
    privateKey: keys.privateKey,
    publicKey: overrides.publicKey || keys.publicKey,
    purpose: overrides.purpose || 'owner-signed-stack',
    metadata: overrides.metadata || { ticket: 9, labels: ['v3', 'test'] },
    algorithm: overrides.algorithm || 'ed25519',
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('can generate Ed25519 key pair', () => {
  const keys = keyPair();

  assert.match(keys.publicKey, /BEGIN PUBLIC KEY/);
  assert.match(keys.privateKey, /BEGIN PRIVATE KEY/);
});

test('can create signed stack envelope', () => {
  const signed = envelope();

  assert.equal(signed.format, 'UNSTACK-SIGNED');
  assert.equal(signed.version, 1);
  assert.equal(signed.stack.format, 'UNSTACK');
  assert.match(signed.stackCommitment, /^[0-9a-f]{64}$/);
  assert.match(signed.payloadCommitment, /^[0-9a-f]{64}$/);
  assert.equal(signed.signerId, 'owner:test');
  assert.equal(signed.purpose, 'owner-signed-stack');
  assert.deepEqual(signed.metadata, { labels: ['v3', 'test'], ticket: 9 });
  assert.equal(signed.signature.algorithm, 'ed25519');
  assert.equal(signed.signature.signerId, 'owner:test');
  assert.match(signed.signature.publicKey, /BEGIN PUBLIC KEY/);
  assert.equal(typeof signed.signature.value, 'string');
});

test('verifies valid envelope and returns diagnostic commitments', () => {
  const signed = envelope();
  const result = verifySignedStackEnvelope(signed);

  assert.equal(result.valid, true);
  assert.equal(result.signerId, signed.signerId);
  assert.equal(result.purpose, signed.purpose);
  assert.equal(result.stackCommitment, signed.stackCommitment);
  assert.equal(result.payloadCommitment, signed.payloadCommitment);
});

test('signing does not mutate stack', () => {
  const recipe = stack();
  const before = clone(recipe);
  const keys = keyPair();

  createSignedStackEnvelope({
    stack: recipe,
    signerId: 'owner:test',
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
  });

  assert.deepEqual(recipe, before);
});

test('signing does not mutate metadata', () => {
  const metadata = { z: 1, a: { b: true } };
  const before = clone(metadata);

  envelope({ metadata });

  assert.deepEqual(metadata, before);
});

test('verification does not mutate envelope', () => {
  const signed = envelope();
  const before = clone(signed);

  verifySignedStackEnvelope(signed);

  assert.deepEqual(signed, before);
});

test('tampering stack layer order invalidates verification', () => {
  const signed = envelope({
    stack: stack({
      layers: [
        rotateLayer({ id: 'a', turns: 1 }),
        rotateLayer({ id: 'b', direction: 'down', turns: 2 }),
      ],
    }),
  });
  const tampered = clone(signed);
  tampered.stack.layers.reverse();

  assert.equal(verifySignedStackEnvelope(tampered).valid, false);
});

test('tampering turns invalidates verification', () => {
  const tampered = clone(envelope());
  tampered.stack.layers[0].turns += 1;

  assert.equal(verifySignedStackEnvelope(tampered).valid, false);
});

test('tampering swapCount invalidates verification', () => {
  const signed = envelope({ stack: stack({ layers: [swapLayer()] }) });
  const tampered = clone(signed);
  tampered.stack.layers[0].swapCount += 1;

  assert.equal(verifySignedStackEnvelope(tampered).valid, false);
});

test('tampering packet commitment invalidates verification', () => {
  const packet = createContextPacket({ context: 'signed-stack-packet', pointCount: 3 });
  const signed = envelope({
    stack: stack({
      layers: [rotateLayer({ packet, graftMode: 'append' })],
    }),
  });
  const tampered = clone(signed);
  tampered.stack.layers[0].packet.commitment = '0'.repeat(64);

  assert.equal(verifySignedStackEnvelope(tampered).valid, false);
});

test('tampering metadata invalidates verification', () => {
  const tampered = clone(envelope());
  tampered.metadata.ticket = 10;

  assert.equal(verifySignedStackEnvelope(tampered).valid, false);
});

test('tampering signerId invalidates verification', () => {
  const tampered = clone(envelope());
  tampered.signerId = 'owner:other';

  assert.equal(verifySignedStackEnvelope(tampered).valid, false);
});

test('tampering purpose invalidates verification', () => {
  const tampered = clone(envelope());
  tampered.purpose = 'other-purpose';

  assert.equal(verifySignedStackEnvelope(tampered).valid, false);
});

test('tampering algorithm invalidates verification', () => {
  const tampered = clone(envelope());
  tampered.signature.algorithm = 'rsa';

  assert.equal(verifySignedStackEnvelope(tampered).valid, false);
});

test('tampering signature value invalidates verification', () => {
  const tampered = clone(envelope());
  tampered.signature.value = `${tampered.signature.value.slice(0, -4)}AAAA`;

  assert.equal(verifySignedStackEnvelope(tampered).valid, false);
});

test('envelope stackCommitment mismatch invalidates verification', () => {
  const tampered = clone(envelope());
  tampered.stackCommitment = '0'.repeat(64);

  assert.equal(verifySignedStackEnvelope(tampered).valid, false);
});

test('unsupported algorithm is rejected', () => {
  const keys = keyPair();

  assert.throws(() => createSignedStackEnvelope({
    stack: stack(),
    signerId: 'owner:test',
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
    algorithm: 'rsa',
  }), /not supported/);

  const tampered = clone(envelope());
  tampered.signature.algorithm = 'rsa';

  assert.equal(verifySignedStackEnvelope(tampered).valid, false);
});

test('malformed envelope returns invalid result', () => {
  assert.deepEqual(
    verifySignedStackEnvelope(null),
    {
      ok: false,
      valid: false,
      reason: 'envelope must be an object',
      error: 'envelope must be an object',
    },
  );
  assert.equal(verifySignedStackEnvelope({ format: 'UNSTACK-SIGNED', version: 1 }).valid, false);
});

test('mixed UN-ROTATE and UN-SWAP stack can be signed and verified', () => {
  const signed = envelope({
    stack: stack({
      layers: [
        rotateLayer({ id: 'rotate-a', turns: 1 }),
        swapLayer({ id: 'swap-b', swapCount: 4 }),
      ],
    }),
  });

  assert.equal(verifySignedStackEnvelope(signed).valid, true);
});

test('signed stack can still be applied and reversed through envelope.stack', () => {
  const signed = envelope({
    stack: stack({
      layers: [
        rotateLayer({ id: 'rotate-a', turns: 1 }),
        swapLayer({ id: 'swap-b', swapCount: 4 }),
      ],
    }),
  });
  const data = [0, 1, 2, 3, 4, 5, 6, 7];
  const transformed = applyStack(data, signed.stack);
  const restored = reverseStack(transformed, signed.stack);

  assert.notDeepEqual(transformed, data);
  assert.deepEqual(restored, data);
});

test('equivalent metadata object key order produces same valid payload commitment', () => {
  const keys = keyPair();
  const recipe = stack();
  const first = createSignedStackEnvelope({
    stack: recipe,
    signerId: 'owner:test',
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
    metadata: { b: 2, a: 1 },
  });
  const second = createSignedStackEnvelope({
    stack: recipe,
    signerId: 'owner:test',
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
    metadata: { a: 1, b: 2 },
  });

  assert.equal(verifySignedStackEnvelope(first).valid, true);
  assert.equal(verifySignedStackEnvelope(second).valid, true);
  assert.equal(first.payloadCommitment, second.payloadCommitment);
});

test('different metadata values produce different payload commitment', () => {
  const keys = keyPair();
  const recipe = stack();
  const first = createSignedStackEnvelope({
    stack: recipe,
    signerId: 'owner:test',
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
    metadata: { value: 'a' },
  });
  const second = createSignedStackEnvelope({
    stack: recipe,
    signerId: 'owner:test',
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
    metadata: { value: 'b' },
  });

  assert.notEqual(first.payloadCommitment, second.payloadCommitment);
});

test('reordered stack layers produce different stack commitment and tamper failure', () => {
  const firstStack = stack({
    layers: [
      rotateLayer({ id: 'first', turns: 1 }),
      swapLayer({ id: 'second', swapCount: 2 }),
    ],
  });
  const secondStack = stack({
    layers: [
      swapLayer({ id: 'second', swapCount: 2 }),
      rotateLayer({ id: 'first', turns: 1 }),
    ],
  });
  const signed = envelope({ stack: firstStack });
  const tampered = clone(signed);
  tampered.stack = secondStack;

  assert.notEqual(stackCommitment(firstStack), stackCommitment(secondStack));
  assert.equal(verifySignedStackEnvelope(tampered).valid, false);
});

test('signedStackPayload is canonical and excludes signature value', () => {
  const payload = signedStackPayload({
    stackCommitment: 'a'.repeat(64),
    signerId: 'owner:test',
    purpose: 'owner-signed-stack',
    metadata: { b: 2, a: 1 },
    algorithm: 'ed25519',
  });

  assert.equal(
    payload,
    '{"algorithm":"ed25519","format":"UNSTACK-SIGNED","metadata":{"a":1,"b":2},"purpose":"owner-signed-stack","signerId":"owner:test","stackCommitment":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","version":1}',
  );
  assert.equal(payload.includes('signature'), false);
});
