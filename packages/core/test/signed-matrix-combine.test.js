'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { assertNoTrackedArtifacts } = require('../test-support/git-hygiene');

const {
  SIGNED_MATRIX_COMBINE_ALGORITHM,
  SIGNED_MATRIX_COMBINE_FORMAT,
  SIGNED_MATRIX_COMBINE_VERSION,
  applyMatrixCombineRecipe,
  applySignedMatrixCombine,
  createSignedMatrixCombine,
  generateEd25519KeyPair,
  matrixCombineRecipeCommitment,
  signedMatrixCombineCommitment,
  signedMatrixCombinePayload,
  verifySignedMatrixCombine,
} = require('..');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fixture(overrides = {}) {
  const keys = overrides.keys || generateEd25519KeyPair();
  const tiles = Object.hasOwn(overrides, 'tiles')
    ? overrides.tiles
    : {
      a: [[1, 2], [3, 4]],
      b: [[5, 6], [7, 8]],
    };
  const recipe = Object.hasOwn(overrides, 'recipe')
    ? overrides.recipe
    : {
      tiles,
      placements: [
        { tile: 'a', row: 0, column: 0 },
        { tile: 'b', row: 0, column: 1, transform: 'flipHorizontal' },
      ],
      metadata: { b: 2, a: 1 },
    };

  const signed = createSignedMatrixCombine({
    recipe,
    signerId: overrides.signerId || 'owner:matrix-combine',
    privateKey: keys.privateKey,
    publicKey: overrides.publicKey || keys.publicKey,
    purpose: overrides.purpose || 'owner-signed-matrix-combine',
    metadata: Object.hasOwn(overrides, 'metadata')
      ? overrides.metadata
      : { sprint: 25, subject: 'matrix-combine' },
    algorithm: overrides.algorithm || SIGNED_MATRIX_COMBINE_ALGORITHM,
    outputMatrixCommitment: overrides.outputMatrixCommitment,
    outputMetadata: overrides.outputMetadata,
  });

  return {
    keys,
    tiles,
    recipe,
    signed,
  };
}

test('creates a signed matrix combine envelope with a valid Ed25519 key pair', () => {
  const { signed } = fixture();

  assert.equal(signed.format, SIGNED_MATRIX_COMBINE_FORMAT);
  assert.equal(signed.version, SIGNED_MATRIX_COMBINE_VERSION);
  assert.equal(signed.algorithm, SIGNED_MATRIX_COMBINE_ALGORITHM);
  assert.equal(signed.recipe.format, 'UN-MATRIX-COMBINE');
  assert.equal(signed.matrixCombineRecipeCommitment, signed.recipe.matrixCombineRecipeCommitment);
  assert.deepEqual(signed.inputTileCommitments, signed.recipe.tiles);
  assert.match(signed.outputMatrixCommitment, /^[0-9a-f]{64}$/);
  assert.match(signed.signedMatrixCombineCommitment, /^[0-9a-f]{64}$/);
  assert.equal(signed.signerId, 'owner:matrix-combine');
  assert.deepEqual(signed.metadata, { sprint: 25, subject: 'matrix-combine' });
  assert.equal(signed.signature.algorithm, SIGNED_MATRIX_COMBINE_ALGORITHM);
  assert.match(signed.signature.publicKey, /BEGIN PUBLIC KEY/);
  assert.equal(typeof signed.signature.value, 'string');
});

test('verifies a valid signed matrix combine envelope', () => {
  const { signed } = fixture();
  const result = verifySignedMatrixCombine(signed);

  assert.equal(result.ok, true);
  assert.equal(result.valid, true);
  assert.equal(result.signedMatrixCombineCommitment, signed.signedMatrixCombineCommitment);
  assert.equal(result.matrixCombineRecipeCommitment, signed.matrixCombineRecipeCommitment);
  assert.deepEqual(result.inputTileCommitments, signed.inputTileCommitments);
  assert.equal(result.outputMatrixCommitment, signed.outputMatrixCommitment);
});

test('deterministic payload and commitment behavior for equivalent inputs', () => {
  const keys = generateEd25519KeyPair();
  const first = fixture({
    keys,
    recipe: {
      tiles: { b: [[5, 6], [7, 8]], a: [[1, 2], [3, 4]] },
      placements: [
        { column: 0, row: 0, tile: 'a' },
        { transform: 'flipHorizontal', tile: 'b', row: 0, column: 1 },
      ],
      metadata: { z: 1, a: 2 },
    },
    metadata: { b: 2, a: 1 },
  }).signed;
  const second = fixture({
    keys,
    recipe: {
      metadata: { a: 2, z: 1 },
      placements: [
        { tile: 'a', row: 0, column: 0, transform: 'identity' },
        { tile: 'b', row: 0, column: 1, transform: 'flipHorizontal' },
      ],
      tiles: { a: [[1, 2], [3, 4]], b: [[5, 6], [7, 8]] },
    },
    metadata: { a: 1, b: 2 },
  }).signed;

  assert.equal(first.matrixCombineRecipeCommitment, second.matrixCombineRecipeCommitment);
  assert.equal(first.signedMatrixCombineCommitment, second.signedMatrixCombineCommitment);
  assert.equal(first.signature.value, second.signature.value);
  assert.equal(verifySignedMatrixCombine(first).ok, true);
  assert.equal(verifySignedMatrixCombine(second).ok, true);
});

test('signedMatrixCombinePayload is canonical, domain-separated, and excludes signature bytes', () => {
  const payload = signedMatrixCombinePayload({
    matrixCombineRecipeCommitment: 'a'.repeat(64),
    matrixCombineRecipe: {
      format: 'UN-MATRIX-COMBINE',
      version: 1,
      tiles: [{ name: 'a', rows: 1, columns: 1, matrixCommitment: 'b'.repeat(64) }],
      placements: [{ tile: 'a', row: 0, column: 0, transform: 'identity' }],
      metadata: { b: 2, a: 1 },
    },
    inputTileCommitments: [
      { name: 'a', rows: 1, columns: 1, matrixCommitment: 'b'.repeat(64) },
    ],
    outputMatrixCommitment: null,
    signerId: 'owner:matrix-combine',
    purpose: 'owner-signed-matrix-combine',
    metadata: { z: 1, a: 2 },
    algorithm: SIGNED_MATRIX_COMBINE_ALGORITHM,
    publicKey: 'public-key-material',
  });

  assert.equal(payload.includes('"domain":"UN-MATRIX-COMBINE-SIGNED:v1"'), true);
  assert.equal(payload.includes('signature'), false);
  assert.match(signedMatrixCombineCommitment(payload), /^[0-9a-f]{64}$/);
});

test('signature verification fails when a tile reference is tampered', () => {
  const tampered = clone(fixture().signed);
  tampered.recipe.placements[0].tile = 'b';

  assert.equal(verifySignedMatrixCombine(tampered).ok, false);
});

test('signature verification fails when tile content commitment is tampered', () => {
  const tampered = clone(fixture().signed);
  tampered.recipe.tiles[0].matrixCommitment = '0'.repeat(64);

  assert.equal(verifySignedMatrixCombine(tampered).ok, false);
});

test('signature verification fails when placement order is tampered', () => {
  const tampered = clone(fixture().signed);
  tampered.recipe.placements.reverse();

  assert.equal(verifySignedMatrixCombine(tampered).ok, false);
});

test('signature verification fails when placement coordinates are tampered', () => {
  const tampered = clone(fixture().signed);
  tampered.recipe.placements[0].column = 1;

  assert.equal(verifySignedMatrixCombine(tampered).ok, false);
});

test('signature verification fails when placement transform is tampered', () => {
  const tampered = clone(fixture().signed);
  tampered.recipe.placements[0].transform = 'flipVertical';

  assert.equal(verifySignedMatrixCombine(tampered).ok, false);
});

test('signature verification fails when output matrix commitment is tampered', () => {
  const tampered = clone(fixture().signed);
  tampered.outputMatrixCommitment = '0'.repeat(64);

  const result = verifySignedMatrixCombine(tampered);
  assert.equal(result.ok, false);
  assert.match(result.reason, /signedMatrixCombineCommitment|signature verification/);
});

test('signature verification fails when metadata/context is tampered', () => {
  const tampered = clone(fixture().signed);
  tampered.metadata.sprint = 26;

  assert.equal(verifySignedMatrixCombine(tampered).ok, false);
});

test('verification fails for wrong public key', () => {
  const { signed } = fixture();
  const wrong = generateEd25519KeyPair();

  const result = verifySignedMatrixCombine(signed, { publicKey: wrong.publicKey });
  assert.equal(result.ok, false);
  assert.match(result.reason, /signature verification/);
});

test('verification rejects unsupported algorithm', () => {
  const tampered = clone(fixture().signed);
  tampered.signature.algorithm = 'rsa';

  const result = verifySignedMatrixCombine(tampered);
  assert.equal(result.ok, false);
  assert.match(result.reason, /not supported/);
  assert.throws(() => fixture({ algorithm: 'rsa' }), /not supported/);
});

test('verification rejects malformed envelope shape', () => {
  assert.deepEqual(
    verifySignedMatrixCombine(null),
    {
      ok: false,
      valid: false,
      reason: 'envelope must be an object',
      error: 'envelope must be an object',
    }
  );
  assert.equal(verifySignedMatrixCombine({ format: SIGNED_MATRIX_COMBINE_FORMAT, version: 1 }).ok, false);
});

test('verification rejects malformed signature bytes', () => {
  const tampered = clone(fixture().signed);
  tampered.signature.value = 'not base64!';

  const result = verifySignedMatrixCombine(tampered);
  assert.equal(result.ok, false);
  assert.match(result.reason, /base64/);
});

test('signing rejects malformed keys', () => {
  assert.throws(() => createSignedMatrixCombine({
    recipe: {
      tiles: { a: [[1]] },
      placements: [{ tile: 'a', row: 0, column: 0 }],
    },
    signerId: 'owner:matrix-combine',
    privateKey: 'not a private key',
  }));

  assert.throws(() => createSignedMatrixCombine({
    recipe: {
      tiles: { a: [[1]] },
      placements: [{ tile: 'a', row: 0, column: 0 }],
    },
    signerId: 'owner:matrix-combine',
    privateKey: generateEd25519KeyPair().privateKey,
    publicKey: 'not a public key',
  }));
});

test('verification rejects malformed combine recipes', () => {
  const tampered = clone(fixture().signed);
  delete tampered.recipe.placements;

  const result = verifySignedMatrixCombine(tampered);
  assert.equal(result.ok, false);
  assert.match(result.reason, /placements/);
});

test('applySignedMatrixCombine applies a verified recipe to matching supplied tiles', () => {
  const { signed, tiles } = fixture();
  const result = applySignedMatrixCombine(tiles, signed);
  const expected = applyMatrixCombineRecipe({
    tiles,
    placements: signed.recipe.placements,
    metadata: signed.recipe.metadata,
  });

  assert.equal(result.ok, true);
  assert.equal(result.signedMatrixCombineCommitment, signed.signedMatrixCombineCommitment);
  assert.deepEqual(result.matrix.values, [
    [1, 2, 6, 5],
    [3, 4, 8, 7],
  ]);
  assert.equal(result.matrix.matrixCommitment, signed.outputMatrixCommitment);
  assert.equal(result.application.matrix.matrixCommitment, expected.matrix.matrixCommitment);
});

test('applySignedMatrixCombine returns invalid result for tile commitment mismatch', () => {
  const { signed, tiles } = fixture();
  const wrongTiles = clone(tiles);
  wrongTiles.b[0][0] = 99;
  const result = applySignedMatrixCombine(wrongTiles, signed);

  assert.equal(result.ok, false);
  assert.match(result.reason, /input tile commitments/);
});

test('applySignedMatrixCombine returns invalid result for output commitment mismatch', () => {
  const { signed, tiles } = fixture({ outputMatrixCommitment: 'f'.repeat(64) });
  const verification = verifySignedMatrixCombine(signed);
  const result = applySignedMatrixCombine(tiles, signed);

  assert.equal(verification.ok, true);
  assert.equal(result.ok, false);
  assert.match(result.reason, /outputMatrixCommitment/);
});

test('returned apply result is defensively cloned and unaffected by later caller mutation', () => {
  const { signed, tiles, recipe } = fixture();
  const result = applySignedMatrixCombine(tiles, signed);

  tiles.a[0][0] = 99;
  recipe.placements[0].column = 1;
  signed.recipe.placements[0].column = 1;
  result.matrix.values[0][0] = 88;

  const nextFixture = fixture();
  const next = applySignedMatrixCombine(nextFixture.tiles, nextFixture.signed);

  assert.deepEqual(result.application.matrix.values, [
    [1, 2, 6, 5],
    [3, 4, 8, 7],
  ]);
  assert.deepEqual(next.matrix.values, [
    [1, 2, 6, 5],
    [3, 4, 8, 7],
  ]);
});

test('public exports are available through packages/core entrypoint', () => {
  assert.equal(SIGNED_MATRIX_COMBINE_FORMAT, 'UN-MATRIX-COMBINE-SIGNED');
  assert.equal(SIGNED_MATRIX_COMBINE_VERSION, 1);
  assert.equal(SIGNED_MATRIX_COMBINE_ALGORITHM, 'ed25519');
  assert.equal(typeof createSignedMatrixCombine, 'function');
  assert.equal(typeof signedMatrixCombinePayload, 'function');
  assert.equal(typeof signedMatrixCombineCommitment, 'function');
  assert.equal(typeof verifySignedMatrixCombine, 'function');
  assert.equal(typeof applySignedMatrixCombine, 'function');
  assert.equal(typeof matrixCombineRecipeCommitment, 'function');
});

test('root legacy export remains unchanged', () => {
  const Unobtainium = require('../../..');

  assert.equal(typeof Unobtainium, 'function');
  assert.equal(Unobtainium.name, 'Unobtainium');
});

test('tracked node_modules and generated .un files are not reintroduced', (t) => {
  assertNoTrackedArtifacts(t);
});
