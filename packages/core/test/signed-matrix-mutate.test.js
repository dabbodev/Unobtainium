'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  SIGNED_MATRIX_MUTATE_ALGORITHM,
  SIGNED_MATRIX_MUTATE_FORMAT,
  SIGNED_MATRIX_MUTATE_VERSION,
  applySignedMatrixMutation,
  createMatrixKey,
  createSignedMatrixMutation,
  generateEd25519KeyPair,
  matrixMutationRecipeCommitment,
  signedMatrixMutationCommitment,
  signedMatrixMutationPayload,
  verifySignedMatrixMutation,
} = require('..');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fixture(overrides = {}) {
  const keys = overrides.keys || generateEd25519KeyPair();
  const source = createMatrixKey([[1, 2], [3, 4]], {
    metadata: { name: 'source' },
  });
  const target = createMatrixKey([[3, 4], [1, 2]], {
    metadata: { name: 'source' },
  });
  const recipe = Object.hasOwn(overrides, 'recipe')
    ? overrides.recipe
    : {
      sourceMatrixCommitment: source.matrixCommitment,
      targetMatrixCommitment: target.matrixCommitment,
      operations: [{ type: 'swapRows', a: 0, b: 1 }],
      metadata: { b: 2, a: 1 },
    };

  const signed = createSignedMatrixMutation({
    recipe,
    signerId: overrides.signerId || 'owner:matrix',
    privateKey: keys.privateKey,
    publicKey: overrides.publicKey || keys.publicKey,
    purpose: overrides.purpose || 'owner-signed-matrix-mutation',
    metadata: Object.hasOwn(overrides, 'metadata')
      ? overrides.metadata
      : { sprint: 21, subject: 'matrix-mutate' },
    algorithm: overrides.algorithm || SIGNED_MATRIX_MUTATE_ALGORITHM,
  });

  return {
    keys,
    source,
    target,
    recipe,
    signed,
  };
}

test('creates a signed matrix mutation envelope with a valid Ed25519 key pair', () => {
  const { signed, source, target } = fixture();

  assert.equal(signed.format, SIGNED_MATRIX_MUTATE_FORMAT);
  assert.equal(signed.version, SIGNED_MATRIX_MUTATE_VERSION);
  assert.equal(signed.algorithm, SIGNED_MATRIX_MUTATE_ALGORITHM);
  assert.equal(signed.recipe.format, 'UN-MATRIX-MUTATE');
  assert.equal(signed.sourceMatrixCommitment, source.matrixCommitment);
  assert.equal(signed.targetMatrixCommitment, target.matrixCommitment);
  assert.equal(signed.matrixMutationRecipeCommitment, signed.recipe.matrixMutationRecipeCommitment);
  assert.match(signed.signedMatrixMutationCommitment, /^[0-9a-f]{64}$/);
  assert.equal(signed.signerId, 'owner:matrix');
  assert.deepEqual(signed.metadata, { sprint: 21, subject: 'matrix-mutate' });
  assert.equal(signed.signature.algorithm, SIGNED_MATRIX_MUTATE_ALGORITHM);
  assert.match(signed.signature.publicKey, /BEGIN PUBLIC KEY/);
  assert.equal(typeof signed.signature.value, 'string');
});

test('verifies a valid signed matrix mutation envelope', () => {
  const { signed, source, target } = fixture();
  const result = verifySignedMatrixMutation(signed);

  assert.equal(result.ok, true);
  assert.equal(result.valid, true);
  assert.equal(result.signedMatrixMutationCommitment, signed.signedMatrixMutationCommitment);
  assert.equal(result.matrixMutationRecipeCommitment, signed.matrixMutationRecipeCommitment);
  assert.equal(result.sourceMatrixCommitment, source.matrixCommitment);
  assert.equal(result.targetMatrixCommitment, target.matrixCommitment);
});

test('deterministic payload and commitment behavior for equivalent inputs', () => {
  const keys = generateEd25519KeyPair();
  const first = fixture({
    keys,
    recipe: {
      metadata: { z: 1, a: 2 },
      operations: [{ b: 1, type: 'swapRows', a: 0 }],
    },
    metadata: { b: 2, a: 1 },
  }).signed;
  const second = fixture({
    keys,
    recipe: {
      operations: [{ a: 0, b: 1, type: 'swapRows' }],
      metadata: { a: 2, z: 1 },
    },
    metadata: { a: 1, b: 2 },
  }).signed;

  assert.equal(first.matrixMutationRecipeCommitment, second.matrixMutationRecipeCommitment);
  assert.equal(first.signedMatrixMutationCommitment, second.signedMatrixMutationCommitment);
  assert.equal(verifySignedMatrixMutation(first).ok, true);
  assert.equal(verifySignedMatrixMutation(second).ok, true);
});

test('signedMatrixMutationPayload is canonical, domain-separated, and excludes signature bytes', () => {
  const payload = signedMatrixMutationPayload({
    matrixMutationRecipeCommitment: 'a'.repeat(64),
    matrixMutationRecipe: {
      format: 'UN-MATRIX-MUTATE',
      version: 1,
      sourceMatrixCommitment: null,
      targetMatrixCommitment: null,
      operations: [{ type: 'transpose' }],
      metadata: { b: 2, a: 1 },
    },
    sourceMatrixCommitment: null,
    targetMatrixCommitment: null,
    signerId: 'owner:matrix',
    purpose: 'owner-signed-matrix-mutation',
    metadata: { z: 1, a: 2 },
    algorithm: SIGNED_MATRIX_MUTATE_ALGORITHM,
    publicKey: 'public-key-material',
  });

  assert.equal(payload.includes('"domain":"UN-MATRIX-MUTATE-SIGNED:v1"'), true);
  assert.equal(payload.includes('signature'), false);
  assert.match(signedMatrixMutationCommitment(payload), /^[0-9a-f]{64}$/);
});

test('signature verification fails when operation type is tampered', () => {
  const tampered = clone(fixture().signed);
  tampered.recipe.operations[0].type = 'swapColumns';

  assert.equal(verifySignedMatrixMutation(tampered).ok, false);
});

test('signature verification fails when an operation parameter is tampered', () => {
  const tampered = clone(fixture().signed);
  tampered.recipe.operations[0].b = 0;

  assert.equal(verifySignedMatrixMutation(tampered).ok, false);
});

test('signature verification fails when operation order is tampered', () => {
  const { signed } = fixture({
    recipe: {
      operations: [
        { type: 'swapRows', a: 0, b: 1 },
        { type: 'swapColumns', a: 0, b: 1 },
      ],
    },
  });
  const tampered = clone(signed);
  tampered.recipe.operations.reverse();

  assert.equal(verifySignedMatrixMutation(tampered).ok, false);
});

test('signature verification fails when source commitment is tampered', () => {
  const tampered = clone(fixture().signed);
  tampered.sourceMatrixCommitment = '0'.repeat(64);

  const result = verifySignedMatrixMutation(tampered);
  assert.equal(result.ok, false);
  assert.match(result.reason, /sourceMatrixCommitment/);
});

test('signature verification fails when target commitment is tampered', () => {
  const tampered = clone(fixture().signed);
  tampered.targetMatrixCommitment = '0'.repeat(64);

  const result = verifySignedMatrixMutation(tampered);
  assert.equal(result.ok, false);
  assert.match(result.reason, /targetMatrixCommitment/);
});

test('signature verification fails when metadata/context is tampered', () => {
  const tampered = clone(fixture().signed);
  tampered.metadata.sprint = 22;

  assert.equal(verifySignedMatrixMutation(tampered).ok, false);
});

test('verification fails for wrong public key', () => {
  const { signed } = fixture();
  const wrong = generateEd25519KeyPair();

  const result = verifySignedMatrixMutation(signed, { publicKey: wrong.publicKey });
  assert.equal(result.ok, false);
  assert.match(result.reason, /signature verification/);
});

test('verification rejects unsupported algorithm', () => {
  const tampered = clone(fixture().signed);
  tampered.signature.algorithm = 'rsa';

  const result = verifySignedMatrixMutation(tampered);
  assert.equal(result.ok, false);
  assert.match(result.reason, /not supported/);
  assert.throws(() => fixture({ algorithm: 'rsa' }), /not supported/);
});

test('verification rejects malformed envelope shape', () => {
  assert.deepEqual(
    verifySignedMatrixMutation(null),
    {
      ok: false,
      valid: false,
      reason: 'envelope must be an object',
      error: 'envelope must be an object',
    }
  );
  assert.equal(verifySignedMatrixMutation({ format: SIGNED_MATRIX_MUTATE_FORMAT, version: 1 }).ok, false);
});

test('verification rejects malformed signature bytes', () => {
  const tampered = clone(fixture().signed);
  tampered.signature.value = 'not base64!';

  const result = verifySignedMatrixMutation(tampered);
  assert.equal(result.ok, false);
  assert.match(result.reason, /base64/);
});

test('signing rejects malformed keys', () => {
  assert.throws(() => createSignedMatrixMutation({
    recipe: { operations: [{ type: 'transpose' }] },
    signerId: 'owner:matrix',
    privateKey: 'not a private key',
  }));

  assert.throws(() => createSignedMatrixMutation({
    recipe: { operations: [{ type: 'transpose' }] },
    signerId: 'owner:matrix',
    privateKey: generateEd25519KeyPair().privateKey,
    publicKey: 'not a public key',
  }));
});

test('verification rejects malformed recipes', () => {
  const tampered = clone(fixture().signed);
  delete tampered.recipe.operations;

  const result = verifySignedMatrixMutation(tampered);
  assert.equal(result.ok, false);
  assert.match(result.reason, /operations/);
});

test('applySignedMatrixMutation applies a verified recipe to a matching source matrix', () => {
  const { signed, source, target } = fixture();
  const result = applySignedMatrixMutation(source, signed);

  assert.equal(result.ok, true);
  assert.equal(result.signedMatrixMutationCommitment, signed.signedMatrixMutationCommitment);
  assert.deepEqual(result.matrix.values, target.values);
  assert.equal(result.matrix.matrixCommitment, target.matrixCommitment);
  assert.equal(result.application.matrix.matrixCommitment, target.matrixCommitment);
});

test('applySignedMatrixMutation returns invalid result for source commitment mismatch', () => {
  const { signed } = fixture();
  const wrongSource = createMatrixKey([[1, 2], [3, 5]], {
    metadata: { name: 'source' },
  });
  const result = applySignedMatrixMutation(wrongSource, signed);

  assert.equal(result.ok, false);
  assert.match(result.reason, /sourceMatrixCommitment/);
});

test('applySignedMatrixMutation returns invalid result for target commitment mismatch', () => {
  const { signed, source } = fixture();
  const result = applySignedMatrixMutation(source, signed, {
    targetMetadata: { name: 'different' },
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /targetMatrixCommitment/);
});

test('returned apply result is defensively cloned and unaffected by later caller mutation', () => {
  const { signed, source, recipe } = fixture();
  const result = applySignedMatrixMutation(source, signed);

  source.values[0][0] = 99;
  recipe.operations[0].a = 1;
  signed.recipe.operations[0].a = 1;
  result.matrix.values[0][0] = 88;

  const next = applySignedMatrixMutation(createMatrixKey([[1, 2], [3, 4]], {
    metadata: { name: 'source' },
  }), fixture().signed);

  assert.deepEqual(result.application.matrix.values, [[3, 4], [1, 2]]);
  assert.deepEqual(next.matrix.values, [[3, 4], [1, 2]]);
});

test('public exports are available through packages/core entrypoint', () => {
  assert.equal(SIGNED_MATRIX_MUTATE_FORMAT, 'UN-MATRIX-MUTATE-SIGNED');
  assert.equal(SIGNED_MATRIX_MUTATE_VERSION, 1);
  assert.equal(SIGNED_MATRIX_MUTATE_ALGORITHM, 'ed25519');
  assert.equal(typeof createSignedMatrixMutation, 'function');
  assert.equal(typeof signedMatrixMutationPayload, 'function');
  assert.equal(typeof signedMatrixMutationCommitment, 'function');
  assert.equal(typeof verifySignedMatrixMutation, 'function');
  assert.equal(typeof applySignedMatrixMutation, 'function');
  assert.equal(typeof matrixMutationRecipeCommitment, 'function');
});

test('root legacy export remains unchanged', () => {
  const Unobtainium = require('../../..');

  assert.equal(typeof Unobtainium, 'function');
  assert.equal(Unobtainium.name, 'Unobtainium');
});
