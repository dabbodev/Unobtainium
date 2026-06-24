'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const {
  CERT_FORMAT,
  CERT_VERSION,
  applyCertificateCombine,
  certificateCommitment,
  certificatePayload,
  createCertificate,
  createMatrixKey,
  createSignedMatrixCombine,
  generateEd25519KeyPair,
  normalizeCertificate,
  verifyCertificate,
} = require('..');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fixture(overrides = {}) {
  const keys = overrides.keys || generateEd25519KeyPair();
  const publicTile = Object.hasOwn(overrides, 'publicTile')
    ? overrides.publicTile
    : [[1, 2], [3, 4]];
  const privateTile = Object.hasOwn(overrides, 'privateTile')
    ? overrides.privateTile
    : [[5, 6], [7, 8]];
  const recipe = Object.hasOwn(overrides, 'recipe')
    ? overrides.recipe
    : {
      tiles: {
        public: publicTile,
        private: privateTile,
      },
      placements: [
        { tile: 'public', row: 0, column: 0 },
        { tile: 'private', row: 0, column: 1, transform: 'flipHorizontal' },
      ],
      metadata: { sprint: 26, kind: 'split-validation' },
    };
  const signed = createSignedMatrixCombine({
    recipe,
    signerId: 'validator:matrix-combine',
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
    purpose: 'split-validation',
    metadata: { sprint: 26 },
    outputMatrixCommitment: overrides.outputMatrixCommitment,
  });
  const privateKey = createMatrixKey(privateTile);
  const targetCommitments = Object.hasOwn(overrides, 'targetCommitments')
    ? overrides.targetCommitments
    : {
      objectCommitment: 'a'.repeat(64),
      rangeCommitments: [{ name: 'body', commitment: 'b'.repeat(64) }],
    };
  const metadata = Object.hasOwn(overrides, 'metadata')
    ? overrides.metadata
    : { note: 'first-pass cert' };
  const context = Object.hasOwn(overrides, 'context')
    ? overrides.context
    : { label: 'lab-only' };
  const certificateInput = {
    publicTiles: {
      public: publicTile,
    },
    privateSlots: [{
      name: 'private',
      rows: privateKey.rows,
      columns: privateKey.columns,
      matrixCommitment: privateKey.matrixCommitment,
    }],
    signedMatrixCombine: signed,
    expectedOutputMatrixCommitment: signed.outputMatrixCommitment,
    targetCommitments,
    metadata,
    context,
    ...overrides.certificateInput,
  };

  return {
    keys,
    publicTile,
    privateTile,
    privateKey,
    recipe,
    signed,
    certificateInput,
    certificate: createCertificate(certificateInput),
  };
}

test('creates a valid UN-CERT certificate object', () => {
  const { certificate, signed, privateKey } = fixture();

  assert.equal(certificate.format, CERT_FORMAT);
  assert.equal(certificate.version, CERT_VERSION);
  assert.equal(certificate.publicTiles[0].name, 'public');
  assert.equal(certificate.privateSlots[0].name, 'private');
  assert.equal(certificate.privateSlots[0].matrixCommitment, privateKey.matrixCommitment);
  assert.equal(certificate.signedMatrixCombineCommitment, signed.signedMatrixCombineCommitment);
  assert.equal(certificate.expectedOutputMatrixCommitment, signed.outputMatrixCommitment);
  assert.match(certificate.certificateCommitment, /^[0-9a-f]{64}$/);
});

test('normalizes equivalent certificate input into canonical field order', () => {
  const { signed, privateKey } = fixture();
  const normalized = normalizeCertificate({
    context: { b: 2, a: 1 },
    metadata: { z: true, a: false },
    expectedOutputMatrixCommitment: signed.outputMatrixCommitment,
    signedMatrixCombineCommitment: signed.signedMatrixCombineCommitment,
    privateSlots: {
      private: {
        columns: privateKey.columns,
        rows: privateKey.rows,
        matrixCommitment: privateKey.matrixCommitment,
      },
    },
    publicTileCommitments: {
      public: {
        columns: 2,
        rows: 2,
        matrixCommitment: createMatrixKey([[1, 2], [3, 4]]).matrixCommitment,
      },
    },
  });

  assert.deepEqual(normalized.context, { a: 1, b: 2 });
  assert.deepEqual(normalized.metadata, { a: false, z: true });
  assert.equal(Object.hasOwn(normalized.publicTiles[0], 'matrix'), false);
  assert.match(normalized.certificateCommitment, /^[0-9a-f]{64}$/);
});

test('certificatePayload excludes certificateCommitment and returns defensive copies', () => {
  const { certificate } = fixture();
  const payload = certificatePayload(certificate);

  assert.equal(Object.hasOwn(payload, 'certificateCommitment'), false);
  payload.publicTiles[0].matrix.values[0][0] = 99;
  payload.privateSlots[0].name = 'changed';
  payload.targetCommitments.rangeCommitments[0].commitment = 'c'.repeat(64);
  payload.metadata.note = 'changed';

  assert.equal(certificate.publicTiles[0].matrix.values[0][0], 1);
  assert.equal(certificate.privateSlots[0].name, 'private');
  assert.equal(certificate.targetCommitments.rangeCommitments[0].commitment, 'b'.repeat(64));
  assert.equal(certificate.metadata.note, 'first-pass cert');
});

test('certificate commitment is deterministic for equivalent input', () => {
  const keys = generateEd25519KeyPair();
  const first = fixture({ keys }).certificate;
  const second = fixture({ keys }).certificate;

  assert.equal(certificateCommitment(first), first.certificateCommitment);
  assert.equal(first.certificateCommitment, second.certificateCommitment);
});

test('certificate commitment changes when public tile commitment changes', () => {
  const first = fixture().certificate;
  const second = fixture({ publicTile: [[9, 2], [3, 4]] }).certificate;

  assert.notEqual(first.certificateCommitment, second.certificateCommitment);
});

test('certificate commitment changes when private tile commitment changes', () => {
  const first = fixture().certificate;
  const second = fixture({ privateTile: [[9, 6], [7, 8]] }).certificate;

  assert.notEqual(first.certificateCommitment, second.certificateCommitment);
});

test('certificate commitment changes when private slot name changes', () => {
  const base = fixture();
  const changed = createCertificate({
    ...base.certificateInput,
    privateSlots: [{
      name: 'private-renamed',
      rows: base.privateKey.rows,
      columns: base.privateKey.columns,
      matrixCommitment: base.privateKey.matrixCommitment,
    }],
  });

  assert.notEqual(base.certificate.certificateCommitment, changed.certificateCommitment);
});

test('certificate commitment changes when signed combine commitment changes', () => {
  const base = fixture();
  const changedInput = clone(base.certificateInput);
  delete changedInput.signedMatrixCombine;
  changedInput.signedMatrixCombineCommitment = 'f'.repeat(64);
  const changed = createCertificate({
    ...changedInput,
  });

  assert.notEqual(base.certificate.certificateCommitment, changed.certificateCommitment);
});

test('certificate commitment changes when expected output matrix commitment changes', () => {
  const base = fixture();
  const changed = createCertificate({
    ...base.certificateInput,
    expectedOutputMatrixCommitment: 'f'.repeat(64),
  });

  assert.notEqual(base.certificate.certificateCommitment, changed.certificateCommitment);
});

test('certificate commitment changes when target commitments change', () => {
  const first = fixture().certificate;
  const second = fixture({
    targetCommitments: { objectCommitment: 'c'.repeat(64) },
  }).certificate;

  assert.notEqual(first.certificateCommitment, second.certificateCommitment);
});

test('certificate commitment changes when metadata or context changes', () => {
  const first = fixture().certificate;
  const metadataChanged = fixture({ metadata: { note: 'changed' } }).certificate;
  const contextChanged = fixture({ context: { label: 'changed' } }).certificate;

  assert.notEqual(first.certificateCommitment, metadataChanged.certificateCommitment);
  assert.notEqual(first.certificateCommitment, contextChanged.certificateCommitment);
});

test('rejects malformed certificate shapes and unsupported format or version', () => {
  assert.throws(() => normalizeCertificate(null), /object/);
  assert.throws(() => normalizeCertificate({}), /publicTiles/);
  assert.throws(() => normalizeCertificate({
    format: 'OTHER',
    publicTiles: { public: [[1]] },
    privateSlots: { private: createMatrixKey([[2]]) },
    signedMatrixCombineCommitment: 'a'.repeat(64),
    expectedOutputMatrixCommitment: 'b'.repeat(64),
  }), /format/);
  assert.throws(() => normalizeCertificate({
    version: 99,
    publicTiles: { public: [[1]] },
    privateSlots: { private: createMatrixKey([[2]]) },
    signedMatrixCombineCommitment: 'a'.repeat(64),
    expectedOutputMatrixCommitment: 'b'.repeat(64),
  }), /version/);
});

test('rejects duplicate tile or slot names', () => {
  const base = fixture();

  assert.throws(() => createCertificate({
    ...base.certificateInput,
    publicTiles: [
      { name: 'public', matrix: [[1]] },
      { name: 'public', matrix: [[2]] },
    ],
  }), /duplicate/);
  assert.throws(() => createCertificate({
    ...base.certificateInput,
    privateSlots: [
      base.certificateInput.privateSlots[0],
      base.certificateInput.privateSlots[0],
    ],
  }), /duplicate/);
  assert.throws(() => createCertificate({
    ...base.certificateInput,
    privateSlots: [{
      ...base.certificateInput.privateSlots[0],
      name: 'public',
    }],
  }), /duplicate/);
});

test('rejects invalid commitment strings', () => {
  const base = fixture();

  assert.throws(() => createCertificate({
    ...base.certificateInput,
    publicTiles: { public: { rows: 1, columns: 1, matrixCommitment: 'not-hex' } },
  }), /commitment/);
  assert.throws(() => createCertificate({
    ...base.certificateInput,
    privateSlots: [{ ...base.certificateInput.privateSlots[0], matrixCommitment: 'A'.repeat(64) }],
  }), /commitment/);
  assert.throws(() => createCertificate({
    ...base.certificateInput,
    targetCommitments: { objectCommitment: 'not-hex' },
  }), /commitment/);
});

test('rejects missing signed combine material and missing expected output commitment', () => {
  const base = fixture();
  const noSigned = clone(base.certificateInput);
  delete noSigned.signedMatrixCombine;
  delete noSigned.signedMatrixCombineCommitment;
  const noOutput = clone(base.certificateInput);
  delete noOutput.expectedOutputMatrixCommitment;

  assert.throws(() => createCertificate(noSigned), /signedMatrixCombine/);
  assert.throws(() => createCertificate(noOutput), /expectedOutputMatrixCommitment/);
});

test('structure-only verification succeeds for a valid certificate without private tiles', () => {
  const { certificate } = fixture();
  const result = verifyCertificate(certificate);

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'structure');
  assert.equal(result.certificateCommitment, certificate.certificateCommitment);
  assert.equal(result.certificate.privateSlots[0].name, 'private');
});

test('structure-only verification fails for malformed certificate', () => {
  const result = verifyCertificate({ format: CERT_FORMAT, version: CERT_VERSION });

  assert.equal(result.ok, false);
  assert.match(result.reason, /publicTiles/);
});

test('embedded signed matrix combine envelope verification succeeds for a valid envelope', () => {
  const { certificate, signed } = fixture();
  const result = verifyCertificate(certificate);

  assert.equal(result.ok, true);
  assert.equal(result.signedMatrixCombineCommitment, signed.signedMatrixCombineCommitment);
});

test('embedded signed matrix combine envelope verification fails when tampered', () => {
  const { certificate } = fixture();
  const tampered = clone(certificate);
  tampered.signedMatrixCombine.recipe.placements[0].column = 1;
  tampered.certificateCommitment = certificateCommitment(tampered);
  const result = verifyCertificate(tampered);

  assert.equal(result.ok, false);
  assert.match(result.reason, /signature|overlapping|unfilled|mismatch/);
});

test('completion verification succeeds when supplied private tiles match and combine to expected output', () => {
  const { certificate, privateTile } = fixture();
  const result = verifyCertificate(certificate, {
    privateTiles: {
      private: privateTile,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'completion');
  assert.deepEqual(result.matrix.values, [
    [1, 2, 6, 5],
    [3, 4, 8, 7],
  ]);
  assert.equal(result.outputMatrixCommitment, certificate.expectedOutputMatrixCommitment);
});

test('completion verification rejects private tile commitment mismatch', () => {
  const { certificate } = fixture();
  const result = verifyCertificate(certificate, {
    privateTiles: {
      private: [[9, 6], [7, 8]],
    },
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /private tile commitment/);
});

test('completion verification rejects missing required private tile', () => {
  const { certificate } = fixture();
  const result = verifyCertificate(certificate, { privateTiles: {} });

  assert.equal(result.ok, false);
  assert.match(result.reason, /private tile is required/);
});

test('completion verification rejects output matrix commitment mismatch', () => {
  const keys = generateEd25519KeyPair();
  const publicTile = [[1, 2], [3, 4]];
  const privateTile = [[5, 6], [7, 8]];
  const signed = createSignedMatrixCombine({
    recipe: {
      tiles: { public: publicTile, private: privateTile },
      placements: [
        { tile: 'public', row: 0, column: 0 },
        { tile: 'private', row: 0, column: 1, transform: 'flipHorizontal' },
      ],
    },
    signerId: 'validator:matrix-combine',
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
    purpose: 'split-validation',
    outputMatrixCommitment: null,
  });
  const privateKey = createMatrixKey(privateTile);
  const certificate = createCertificate({
    publicTiles: { public: publicTile },
    privateSlots: [{
      name: 'private',
      rows: privateKey.rows,
      columns: privateKey.columns,
      matrixCommitment: privateKey.matrixCommitment,
    }],
    signedMatrixCombine: signed,
    expectedOutputMatrixCommitment: 'f'.repeat(64),
  });
  const result = applyCertificateCombine(certificate, { private: privateTile });

  assert.equal(result.ok, false);
  assert.match(result.reason, /output matrix commitment/);
});

test('applyCertificateCombine returns certificate, signed combine, output, and matrix result fields', () => {
  const { certificate, signed, privateTile } = fixture();
  const result = applyCertificateCombine(certificate, { private: privateTile });

  assert.equal(result.ok, true);
  assert.equal(result.certificateCommitment, certificate.certificateCommitment);
  assert.equal(result.signedMatrixCombineCommitment, signed.signedMatrixCombineCommitment);
  assert.equal(result.outputMatrixCommitment, certificate.expectedOutputMatrixCommitment);
  assert.equal(result.matrix.matrixCommitment, certificate.expectedOutputMatrixCommitment);
  assert.equal(result.application.matrix.matrixCommitment, certificate.expectedOutputMatrixCommitment);
});

test('returned certificate verification objects are defensive copies', () => {
  const { certificate, privateTile } = fixture();
  const result = applyCertificateCombine(certificate, { private: privateTile });

  result.certificate.publicTiles[0].matrix.values[0][0] = 99;
  result.application.matrix.values[0][0] = 88;
  result.matrix.values[0][0] = 77;

  const next = applyCertificateCombine(certificate, { private: privateTile });
  assert.equal(next.certificate.publicTiles[0].matrix.values[0][0], 1);
  assert.equal(next.application.matrix.values[0][0], 1);
  assert.equal(next.matrix.values[0][0], 1);
});

test('certificate helpers are exported through packages/core entrypoint', () => {
  assert.equal(CERT_FORMAT, 'UN-CERT');
  assert.equal(CERT_VERSION, 1);
  assert.equal(typeof normalizeCertificate, 'function');
  assert.equal(typeof certificatePayload, 'function');
  assert.equal(typeof certificateCommitment, 'function');
  assert.equal(typeof createCertificate, 'function');
  assert.equal(typeof verifyCertificate, 'function');
  assert.equal(typeof applyCertificateCombine, 'function');
});

test('root legacy export remains unchanged after certificate export update', () => {
  const Unobtainium = require('../../..');

  assert.equal(typeof Unobtainium, 'function');
  assert.equal(Unobtainium.name, 'Unobtainium');
});

test('tracked node_modules and generated .un files are not reintroduced by certificate work', () => {
  const cwd = path.resolve(__dirname, '../../..');
  const trackedNodeModules = execFileSync('git', ['ls-files', 'node_modules'], {
    cwd,
    encoding: 'utf8',
  }).trim();
  const trackedGeneratedUn = execFileSync('git', ['ls-files', 'out/*.un'], {
    cwd,
    encoding: 'utf8',
  }).trim();

  assert.equal(trackedNodeModules, '');
  assert.equal(trackedGeneratedUn, '');
});
