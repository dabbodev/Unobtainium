'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  applyCertificateCutout,
  certificateCommitment,
  certificateCutoutCommitment,
  certificateCutoutPayload,
  certificatePayload,
  createCertificate,
  createCutout,
  createMatrixKey,
  verifyCertificate,
  verifyCertificateCutouts,
} = require('..');

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function cloneCutout(cutout) {
  return {
    ...clonePlain({
      format: cutout.format,
      version: cutout.version,
      payloadLength: cutout.payloadLength,
      fillMode: cutout.fillMode,
      fillByte: cutout.fillByte,
      spans: cutout.spans,
      originalPayloadCommitment: cutout.originalPayloadCommitment,
      publicPayloadCommitment: cutout.publicPayloadCommitment,
      cutoutPlanCommitment: cutout.cutoutPlanCommitment,
      label: cutout.label,
      context: cutout.context,
      metadata: cutout.metadata,
      plan: cutout.plan,
    }),
    publicPayload: Buffer.from(cutout.publicPayload),
    hiddenSpans: cutout.hiddenSpans.map((span) => ({
      ...clonePlain({
        offset: span.offset,
        length: span.length,
        label: span.label,
        spanCommitment: span.spanCommitment,
      }),
      payload: Buffer.from(span.payload),
    })),
  };
}

function baseCertificateInput(cutouts) {
  const privateKey = createMatrixKey([[2]]);
  const input = {
    publicTiles: { public: [[1]] },
    privateSlots: [{
      name: 'private',
      rows: privateKey.rows,
      columns: privateKey.columns,
      matrixCommitment: privateKey.matrixCommitment,
    }],
    signedMatrixCombineCommitment: 'a'.repeat(64),
    expectedOutputMatrixCommitment: 'b'.repeat(64),
    targetCommitments: {
      objectCommitment: 'c'.repeat(64),
      rangeCommitments: [{ name: 'body', commitment: 'd'.repeat(64) }],
    },
    metadata: { sprint: 28 },
    context: { purpose: 'cutout-binding-validation' },
  };

  if (cutouts !== undefined) {
    input.cutouts = cutouts;
  }

  return input;
}

function payloadA() {
  return Buffer.from([10, 20, 30, 40, 50, 60, 70, 80]);
}

function payloadB() {
  return Buffer.from([1, 3, 5, 7, 9, 11, 13, 15]);
}

function plan(label, overrides = {}) {
  return {
    spans: [
      { offset: 1, length: 2, label: `${label}:alpha` },
      { offset: 5, length: 1, label: `${label}:beta` },
    ],
    fillByte: 0,
    label,
    context: { label },
    metadata: { fixture: label },
    ...overrides,
  };
}

function bindingFromCutout(cutout, label, overrides = {}) {
  return {
    label,
    cutoutPlanCommitment: cutout.cutoutPlanCommitment,
    originalPayloadCommitment: cutout.originalPayloadCommitment,
    publicPayloadCommitment: cutout.publicPayloadCommitment,
    spanCommitments: cutout.spans.map((span) => span.spanCommitment),
    context: { binding: label },
    metadata: { sprint: 28 },
    ...overrides,
  };
}

function fixture() {
  const primaryCutout = createCutout(payloadA(), plan('body'));
  const secondaryCutout = createCutout(payloadB(), plan('notes', {
    spans: [{ offset: 2, length: 3, label: 'notes:only' }],
    fillByte: 255,
  }));
  const primaryBinding = bindingFromCutout(primaryCutout, 'body');
  const secondaryBinding = bindingFromCutout(secondaryCutout, 'notes');
  const certificate = createCertificate(baseCertificateInput([primaryBinding]));

  return {
    primaryCutout,
    secondaryCutout,
    primaryBinding,
    secondaryBinding,
    certificate,
  };
}

test('creates a valid certificate with one cutout binding', () => {
  const { certificate, primaryBinding } = fixture();

  assert.equal(certificate.cutouts.length, 1);
  assert.deepEqual(certificate.cutouts[0], primaryBinding);
  assert.match(certificate.certificateCommitment, /^[0-9a-f]{64}$/);
});

test('creates a valid certificate with multiple ordered cutout bindings', () => {
  const { primaryBinding, secondaryBinding } = fixture();
  const certificate = createCertificate(baseCertificateInput([primaryBinding, secondaryBinding]));

  assert.deepEqual(certificate.cutouts.map((binding) => binding.label), ['body', 'notes']);
  assert.equal(certificate.cutouts[1].cutoutPlanCommitment, secondaryBinding.cutoutPlanCommitment);
});

test('certificates without cutout bindings still verify on the structure path', () => {
  const certificate = createCertificate(baseCertificateInput());
  const result = verifyCertificate(certificate);

  assert.equal(Object.hasOwn(certificate, 'cutouts'), false);
  assert.equal(result.ok, true);
  assert.equal(result.mode, 'structure');
  assert.equal(result.cutoutsOk, true);
  assert.deepEqual(result.cutoutResults, []);
});

test('certificate commitment changes when a cutout binding is added', () => {
  const { primaryBinding } = fixture();
  const withoutCutout = createCertificate(baseCertificateInput());
  const withCutout = createCertificate(baseCertificateInput([primaryBinding]));

  assert.notEqual(withoutCutout.certificateCommitment, withCutout.certificateCommitment);
});

test('certificate commitment changes when cutout binding order changes', () => {
  const { primaryBinding, secondaryBinding } = fixture();
  const first = createCertificate(baseCertificateInput([primaryBinding, secondaryBinding]));
  const second = createCertificate(baseCertificateInput([secondaryBinding, primaryBinding]));

  assert.notEqual(first.certificateCommitment, second.certificateCommitment);
});

test('certificate commitment changes when cutout label changes', () => {
  const { primaryBinding } = fixture();
  const first = createCertificate(baseCertificateInput([primaryBinding]));
  const second = createCertificate(baseCertificateInput([{
    ...primaryBinding,
    label: 'changed',
  }]));

  assert.notEqual(first.certificateCommitment, second.certificateCommitment);
});

test('certificate commitment changes when cutout plan commitment changes', () => {
  const { primaryBinding } = fixture();
  const first = createCertificate(baseCertificateInput([primaryBinding]));
  const second = createCertificate(baseCertificateInput([{
    ...primaryBinding,
    cutoutPlanCommitment: 'e'.repeat(64),
  }]));

  assert.notEqual(first.certificateCommitment, second.certificateCommitment);
});

test('certificate commitment changes when original payload commitment changes', () => {
  const { primaryBinding } = fixture();
  const first = createCertificate(baseCertificateInput([primaryBinding]));
  const second = createCertificate(baseCertificateInput([{
    ...primaryBinding,
    originalPayloadCommitment: 'e'.repeat(64),
  }]));

  assert.notEqual(first.certificateCommitment, second.certificateCommitment);
});

test('certificate commitment changes when public payload commitment changes', () => {
  const { primaryBinding } = fixture();
  const first = createCertificate(baseCertificateInput([primaryBinding]));
  const second = createCertificate(baseCertificateInput([{
    ...primaryBinding,
    publicPayloadCommitment: 'e'.repeat(64),
  }]));

  assert.notEqual(first.certificateCommitment, second.certificateCommitment);
});

test('certificate commitment changes when span commitments change', () => {
  const { primaryBinding } = fixture();
  const first = createCertificate(baseCertificateInput([primaryBinding]));
  const second = createCertificate(baseCertificateInput([{
    ...primaryBinding,
    spanCommitments: ['e'.repeat(64), ...primaryBinding.spanCommitments.slice(1)],
  }]));

  assert.notEqual(first.certificateCommitment, second.certificateCommitment);
});

test('certificate commitment changes when cutout context or metadata changes', () => {
  const { primaryBinding } = fixture();
  const first = createCertificate(baseCertificateInput([primaryBinding]));
  const contextChanged = createCertificate(baseCertificateInput([{
    ...primaryBinding,
    context: { binding: 'changed' },
  }]));
  const metadataChanged = createCertificate(baseCertificateInput([{
    ...primaryBinding,
    metadata: { sprint: 28, changed: true },
  }]));

  assert.notEqual(first.certificateCommitment, contextChanged.certificateCommitment);
  assert.notEqual(first.certificateCommitment, metadataChanged.certificateCommitment);
});

test('rejects malformed cutout binding shapes', () => {
  const { primaryBinding } = fixture();

  assert.throws(() => createCertificate(baseCertificateInput({ body: primaryBinding })), /cutouts/);
  assert.throws(() => createCertificate(baseCertificateInput([null])), /cutouts\[0\]/);
  assert.throws(() => createCertificate(baseCertificateInput([{
    ...primaryBinding,
    spanCommitments: 'bad',
  }])), /spanCommitments/);
});

test('rejects duplicate cutout labels', () => {
  const { primaryBinding, secondaryBinding } = fixture();

  assert.throws(() => createCertificate(baseCertificateInput([
    primaryBinding,
    { ...secondaryBinding, label: 'body' },
  ])), /duplicate cutout label/);
});

test('rejects invalid cutout commitment strings', () => {
  const { primaryBinding } = fixture();

  assert.throws(() => createCertificate(baseCertificateInput([{
    ...primaryBinding,
    cutoutPlanCommitment: 'not-hex',
  }])), /commitment/);
  assert.throws(() => createCertificate(baseCertificateInput([{
    ...primaryBinding,
    spanCommitments: ['A'.repeat(64)],
  }])), /commitment/);
});

test('structure-only verification succeeds for valid cutout bindings without hidden spans', () => {
  const { certificate } = fixture();
  const result = verifyCertificate(certificate);

  assert.equal(result.ok, true);
  assert.equal(result.cutoutsOk, true);
  assert.equal(result.cutoutMode, 'structure');
  assert.equal(result.cutoutResults[0].label, 'body');
  assert.equal(result.cutoutResults[0].mode, 'structure');
});

test('completion verification succeeds for supplied valid cutout material', () => {
  const { certificate, primaryCutout } = fixture();
  const result = verifyCertificate(certificate, {
    cutouts: {
      body: primaryCutout,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.cutoutsOk, true);
  assert.equal(result.cutoutMode, 'completion');
  assert.equal(result.cutoutResults[0].verification.reconstructedPayloadCommitment, primaryCutout.originalPayloadCommitment);
});

test('direct cutout binding verification succeeds with valid material', () => {
  const { certificate, primaryCutout } = fixture();
  const result = verifyCertificateCutouts(certificate, [primaryCutout]);

  assert.equal(result.ok, true);
  assert.equal(result.cutoutsOk, true);
  assert.equal(result.cutoutResults[0].label, 'body');
});

test('completion verification fails for cutout plan commitment mismatch', () => {
  const { certificate, secondaryCutout } = fixture();
  const result = verifyCertificate(certificate, { cutouts: { body: secondaryCutout } });

  assert.equal(result.ok, false);
  assert.equal(result.cutoutsOk, false);
  assert.match(result.cutoutResults[0].reason, /plan commitment/);
});

test('completion verification fails for original payload commitment mismatch', () => {
  const { primaryBinding, primaryCutout } = fixture();
  const certificate = createCertificate(baseCertificateInput([{
    ...primaryBinding,
    originalPayloadCommitment: 'e'.repeat(64),
  }]));
  const result = verifyCertificate(certificate, { cutouts: { body: primaryCutout } });

  assert.equal(result.ok, false);
  assert.match(result.cutoutResults[0].reason, /originalPayloadCommitment/);
});

test('completion verification fails for public payload commitment mismatch', () => {
  const { primaryBinding, primaryCutout } = fixture();
  const certificate = createCertificate(baseCertificateInput([{
    ...primaryBinding,
    publicPayloadCommitment: 'e'.repeat(64),
  }]));
  const result = verifyCertificate(certificate, { cutouts: { body: primaryCutout } });

  assert.equal(result.ok, false);
  assert.match(result.cutoutResults[0].reason, /publicPayloadCommitment/);
});

test('completion verification fails for hidden span commitment mismatch', () => {
  const { certificate, primaryCutout } = fixture();
  const tampered = cloneCutout(primaryCutout);
  tampered.hiddenSpans[0].payload[0] ^= 1;
  const result = verifyCertificate(certificate, { cutouts: { body: tampered } });

  assert.equal(result.ok, false);
  assert.match(result.cutoutResults[0].reason, /spanCommitment/);
});

test('completion verification fails when a required supplied cutout is missing', () => {
  const {
    primaryBinding,
    primaryCutout,
    secondaryBinding,
  } = fixture();
  const certificate = createCertificate(baseCertificateInput([primaryBinding, secondaryBinding]));
  const result = verifyCertificate(certificate, { cutouts: { body: primaryCutout } });

  assert.equal(result.ok, false);
  assert.deepEqual(result.failedCutoutLabels, ['notes']);
  assert.match(result.cutoutResults[1].reason, /required/);
});

test('applyCertificateCutout restores the original payload for valid material', () => {
  const { certificate, primaryCutout } = fixture();
  const result = applyCertificateCutout(certificate, 'body', primaryCutout);

  assert.equal(result.ok, true);
  assert.deepEqual([...result.restoredPayload], [...payloadA()]);
  assert.equal(result.reconstructedPayloadCommitment, primaryCutout.originalPayloadCommitment);
});

test('applyCertificateCutout rejects tampered hidden spans', () => {
  const { certificate, primaryCutout } = fixture();
  const tampered = cloneCutout(primaryCutout);
  tampered.hiddenSpans[1].payload[0] ^= 1;
  const result = applyCertificateCutout(certificate, 'body', tampered);

  assert.equal(result.ok, false);
  assert.match(result.reason, /spanCommitment/);
});

test('cutout binding payload and commitment helpers are deterministic and defensive', () => {
  const { primaryBinding } = fixture();
  const payload = certificateCutoutPayload({
    ...primaryBinding,
    metadata: { z: 2, a: 1 },
    context: { b: 2, a: 1 },
  });
  const first = certificateCutoutCommitment(payload);
  const second = certificateCutoutCommitment({
    ...payload,
    metadata: { a: 1, z: 2 },
    context: { a: 1, b: 2 },
  });

  payload.spanCommitments[0] = 'f'.repeat(64);
  assert.equal(first, second);
  assert.notEqual(first, certificateCutoutCommitment(payload));
});

test('cutout bindings and verification results are defensive copies', () => {
  const { primaryBinding, primaryCutout } = fixture();
  const originalSpanCommitment = primaryBinding.spanCommitments[0];
  const input = baseCertificateInput([{
    ...primaryBinding,
    spanCommitments: primaryBinding.spanCommitments.slice(),
    metadata: { nested: { value: 1 } },
  }]);
  const certificate = createCertificate(input);
  input.cutouts[0].spanCommitments[0] = 'f'.repeat(64);
  input.cutouts[0].metadata.nested.value = 99;

  assert.equal(certificate.cutouts[0].spanCommitments[0], originalSpanCommitment);
  assert.equal(certificate.cutouts[0].metadata.nested.value, 1);

  const payload = certificatePayload(certificate);
  payload.cutouts[0].context.binding = 'changed';
  assert.equal(certificate.cutouts[0].context.binding, 'body');

  const first = verifyCertificate(certificate, { cutouts: { body: primaryCutout } });
  first.cutoutResults[0].spanCommitments[0] = 'f'.repeat(64);
  first.cutoutResults[0].verification.plan.metadata.fixture = 'changed';
  const second = verifyCertificate(certificate, { cutouts: { body: primaryCutout } });
  assert.equal(second.cutoutResults[0].spanCommitments[0], originalSpanCommitment);
  assert.equal(second.cutoutResults[0].verification.plan.metadata.fixture, 'body');
});

test('applyCertificateCutout returns defensive restored payload copies', () => {
  const { certificate, primaryCutout } = fixture();
  const first = applyCertificateCutout(certificate, 'body', primaryCutout);
  first.restoredPayload[0] = 99;
  first.payload[1] = 99;
  const second = applyCertificateCutout(certificate, 'body', primaryCutout);

  assert.deepEqual([...second.restoredPayload], [...payloadA()]);
  assert.deepEqual([...second.payload], [...payloadA()]);
});

test('new certificate cutout helpers are exported through packages/core entrypoint', () => {
  assert.equal(typeof certificateCutoutPayload, 'function');
  assert.equal(typeof certificateCutoutCommitment, 'function');
  assert.equal(typeof verifyCertificateCutouts, 'function');
  assert.equal(typeof applyCertificateCutout, 'function');
});

test('root legacy export remains unchanged after certificate cutout export update', () => {
  const Unobtainium = require('../../..');

  assert.equal(typeof Unobtainium, 'function');
  assert.equal(Unobtainium.name, 'Unobtainium');
});

test('certificateCommitment sees normalized cutout binding identity', () => {
  const { certificate } = fixture();

  assert.equal(certificateCommitment(certificate), certificate.certificateCommitment);
});
