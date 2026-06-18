'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  applyPatch,
  applyStack,
  createAddPatch,
  createSignedStackEnvelope,
  generateEd25519KeyPair,
  objectCommitment,
  patchCommitment,
  patchPayload,
  reversePatch,
  reverseStack,
  sliceCommitment,
  verifyPatch,
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
    metadata: { recipe: 'patch-test' },
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
    publicKey: overrides.publicKey || keys.publicKey,
    purpose: overrides.purpose || 'owner-signed-stack',
    metadata: overrides.metadata || { sprint: 11 },
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function patchFixture(overrides = {}) {
  const data = overrides.data || Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const range = overrides.range || { start: 2, length: 4 };
  const deltas = overrides.deltas || [1, 0, 255, -2];
  const signedStackEnvelope = Object.hasOwn(overrides, 'signedStackEnvelope')
    ? overrides.signedStackEnvelope
    : envelope();
  const metadata = overrides.metadata || { ticket: 'patch-1', labels: ['add'] };
  const patch = createAddPatch({
    objectId: overrides.objectId || 'object:test',
    data,
    range,
    deltas,
    windowSize: overrides.windowSize || 256,
    signedStackEnvelope,
    metadata,
  });

  return {
    data,
    range,
    deltas,
    signedStackEnvelope,
    metadata,
    patch,
  };
}

test('can create add patch', () => {
  const { patch, data, range, deltas, signedStackEnvelope } = patchFixture();

  assert.equal(patch.format, 'UNPATCH');
  assert.equal(patch.version, 1);
  assert.equal(patch.objectId, 'object:test');
  assert.equal(patch.operation, 'add');
  assert.deepEqual(patch.range, range);
  assert.deepEqual(patch.deltas, deltas);
  assert.equal(patch.windowSize, 256);
  assert.equal(patch.baseObjectCommitment, objectCommitment(data));
  assert.equal(patch.baseSliceCommitment, sliceCommitment(data, range));
  assert.equal(patch.signedStackCommitment, signedStackEnvelope.stackCommitment);
  assert.equal(patch.signedStackPayloadCommitment, signedStackEnvelope.payloadCommitment);
  assert.match(patch.patchCommitment, /^[0-9a-f]{64}$/);
  assert.deepEqual(Object.keys(patchPayload(patch)).sort(), [
    'baseObjectCommitment',
    'baseSliceCommitment',
    'deltas',
    'format',
    'metadata',
    'objectId',
    'operation',
    'range',
    'signedStackCommitment',
    'signedStackPayloadCommitment',
    'version',
    'windowSize',
  ]);
});

test('created patch verifies structurally', () => {
  const { patch } = patchFixture();

  assert.equal(verifyPatch(patch).valid, true);
});

test('created patch verifies with base data', () => {
  const { patch, data } = patchFixture();
  const result = verifyPatch(patch, { data });

  assert.equal(result.valid, true);
  assert.equal(result.operation, 'add');
  assert.equal(result.objectId, patch.objectId);
  assert.deepEqual(result.range, patch.range);
  assert.equal(result.patchCommitment, patch.patchCommitment);
  assert.equal(result.baseObjectCommitment, patch.baseObjectCommitment);
  assert.equal(result.baseSliceCommitment, patch.baseSliceCommitment);
});

test('created patch verifies with signed stack envelope when supplied', () => {
  const { patch, data, signedStackEnvelope } = patchFixture();
  const result = verifyPatch(patch, { data, signedStackEnvelope });

  assert.equal(result.valid, true);
  assert.equal(result.signedStackCommitment, signedStackEnvelope.stackCommitment);
  assert.equal(result.signedStackPayloadCommitment, signedStackEnvelope.payloadCommitment);
});

test('created patch can omit signed stack envelope with null bindings', () => {
  const data = [0, 1, 2, 3, 4];
  const patch = createAddPatch({
    objectId: 'object:no-stack',
    data,
    range: { start: 1, length: 2 },
    deltas: [1, 2],
  });

  assert.equal(patch.signedStackCommitment, null);
  assert.equal(patch.signedStackPayloadCommitment, null);
  assert.equal(verifyPatch(patch, { data }).valid, true);
});

test('patchCommitment is deterministic', () => {
  const first = patchFixture();
  const second = patchFixture({
    data: Buffer.from(first.data),
    range: clone(first.range),
    deltas: first.deltas.slice(),
    signedStackEnvelope: first.signedStackEnvelope,
    metadata: clone(first.metadata),
  });

  assert.equal(patchCommitment(first.patch), patchCommitment(first.patch));
  assert.equal(first.patch.patchCommitment, second.patch.patchCommitment);
});

test('tampering objectId invalidates patch', () => {
  const { patch } = patchFixture();
  const tampered = clone(patch);
  tampered.objectId = 'object:other';

  assert.equal(verifyPatch(tampered).valid, false);
});

test('tampering operation rejects patch', () => {
  const { patch } = patchFixture();
  const tampered = clone(patch);
  tampered.operation = 'replace';
  const result = verifyPatch(tampered);

  assert.deepEqual(result, { valid: false, reason: 'patch operation is not supported' });
});

test('tampering range invalidates patch', () => {
  const { patch } = patchFixture();
  const tampered = clone(patch);
  tampered.range.start += 1;

  assert.equal(verifyPatch(tampered).valid, false);
});

test('tampering deltas invalidates patch', () => {
  const { patch } = patchFixture();
  const tampered = clone(patch);
  tampered.deltas[0] += 1;

  assert.equal(verifyPatch(tampered).valid, false);
});

test('tampering windowSize invalidates patch', () => {
  const { patch } = patchFixture();
  const tampered = clone(patch);
  tampered.windowSize = 16;

  assert.equal(verifyPatch(tampered).valid, false);
});

test('tampering baseObjectCommitment invalidates patch', () => {
  const { patch } = patchFixture();
  const tampered = clone(patch);
  tampered.baseObjectCommitment = '0'.repeat(64);

  assert.equal(verifyPatch(tampered).valid, false);
});

test('tampering baseSliceCommitment invalidates patch', () => {
  const { patch } = patchFixture();
  const tampered = clone(patch);
  tampered.baseSliceCommitment = '0'.repeat(64);

  assert.equal(verifyPatch(tampered).valid, false);
});

test('tampering signedStackCommitment invalidates patch', () => {
  const { patch } = patchFixture();
  const tampered = clone(patch);
  tampered.signedStackCommitment = '0'.repeat(64);

  assert.equal(verifyPatch(tampered).valid, false);
});

test('tampering signedStackPayloadCommitment invalidates patch', () => {
  const { patch } = patchFixture();
  const tampered = clone(patch);
  tampered.signedStackPayloadCommitment = '0'.repeat(64);

  assert.equal(verifyPatch(tampered).valid, false);
});

test('tampering metadata invalidates patch', () => {
  const { patch } = patchFixture();
  const tampered = clone(patch);
  tampered.metadata.ticket = 'patch-2';

  assert.equal(verifyPatch(tampered).valid, false);
});

test('verification with wrong data fails', () => {
  const { patch, data } = patchFixture();
  const insideTamper = Buffer.from(data);
  insideTamper[3] ^= 0xff;
  const outsideTamper = Buffer.from(data);
  outsideTamper[9] ^= 0xff;

  assert.deepEqual(
    verifyPatch(patch, { data: insideTamper }),
    { valid: false, reason: 'baseSliceCommitment mismatch' },
  );
  assert.deepEqual(
    verifyPatch(patch, { data: outsideTamper }),
    { valid: false, reason: 'baseObjectCommitment mismatch' },
  );
});

test('verification with wrong signed stack fails', () => {
  const { patch } = patchFixture();
  const otherSignedStackEnvelope = envelope({ metadata: { sprint: 11, other: true } });
  const result = verifyPatch(patch, { signedStackEnvelope: otherSignedStackEnvelope });

  assert.equal(result.valid, false);
  assert.match(result.reason, /signedStack/);
});

test('malformed patch returns invalid result', () => {
  assert.deepEqual(verifyPatch(null), { valid: false, reason: 'patch must be an object' });
  assert.equal(verifyPatch({ format: 'UNPATCH', version: 1 }).valid, false);
});

test('malformed range throws where appropriate', () => {
  const data = [0, 1, 2, 3];

  assert.throws(() => createAddPatch({
    objectId: 'object:bad-range',
    data,
    range: null,
    deltas: [1],
  }), /range must be an object/);
  assert.throws(() => createAddPatch({
    objectId: 'object:bad-range',
    data,
    range: { start: -1, length: 1 },
    deltas: [1],
  }), /range.start/);
  assert.throws(() => createAddPatch({
    objectId: 'object:bad-range',
    data,
    range: { start: 0, length: 0 },
    deltas: [],
  }), /range.length/);
  assert.throws(() => createAddPatch({
    objectId: 'object:bad-range',
    data,
    range: { start: 3, length: 2 },
    deltas: [1, 2],
  }), /within data length/);
});

test('invalid deltas throw where appropriate', () => {
  const data = [0, 1, 2, 3];
  const range = { start: 1, length: 2 };

  assert.throws(() => createAddPatch({
    objectId: 'object:bad-deltas',
    data,
    range,
    deltas: 'nope',
  }), /deltas must be an array/);
  assert.throws(() => createAddPatch({
    objectId: 'object:bad-deltas',
    data,
    range,
    deltas: [1],
  }), /deltas.length/);
  assert.throws(() => createAddPatch({
    objectId: 'object:bad-deltas',
    data,
    range,
    deltas: [1, 1.5],
  }), /deltas\[1\]/);
});

test('deltas.length must equal range.length during verification', () => {
  const { patch } = patchFixture();
  const tampered = clone(patch);
  tampered.deltas.pop();

  assert.deepEqual(verifyPatch(tampered), {
    valid: false,
    reason: 'deltas.length must equal range.length',
  });
});

test('applyPatch modifies only the specified range', () => {
  const data = [10, 20, 30, 40, 50, 60];
  const patch = createAddPatch({
    objectId: 'object:apply',
    data,
    range: { start: 2, length: 3 },
    deltas: [1, 2, 3],
  });
  const patched = applyPatch(data, patch);

  assert.deepEqual(patched, [10, 20, 31, 42, 53, 60]);
});

test('reversePatch restores original data', () => {
  const data = [10, 20, 30, 40, 50, 60];
  const patch = createAddPatch({
    objectId: 'object:reverse',
    data,
    range: { start: 1, length: 4 },
    deltas: [1, 2, 3, 4],
  });
  const patched = applyPatch(data, patch);
  const restored = reversePatch(patched, patch);

  assert.deepEqual(restored, data);
});

test('Array, Buffer, and Uint8Array inputs are supported and preserve type', () => {
  for (const data of [
    [0, 1, 2, 3, 4],
    Buffer.from([0, 1, 2, 3, 4]),
    new Uint8Array([0, 1, 2, 3, 4]),
  ]) {
    const patch = createAddPatch({
      objectId: 'object:type-support',
      data,
      range: { start: 1, length: 3 },
      deltas: [1, 2, 3],
    });
    const patched = applyPatch(data, patch);
    const restored = reversePatch(patched, patch);

    assert.equal(Array.isArray(patched), Array.isArray(data));
    assert.equal(Buffer.isBuffer(patched), Buffer.isBuffer(data));
    assert.equal(patched instanceof Uint8Array, data instanceof Uint8Array);
    assert.deepEqual([...restored], [...data]);
  }
});

test('inputs are not mutated by default', () => {
  const data = [0, 1, 2, 3, 4];
  const patch = createAddPatch({
    objectId: 'object:immutable',
    data,
    range: { start: 1, length: 2 },
    deltas: [5, 6],
  });
  const patched = applyPatch(data, patch);

  assert.notEqual(patched, data);
  assert.deepEqual(data, [0, 1, 2, 3, 4]);
});

test('inputs mutate only when mutate is true', () => {
  const data = [0, 1, 2, 3, 4];
  const patch = createAddPatch({
    objectId: 'object:mutable',
    data,
    range: { start: 1, length: 2 },
    deltas: [5, 6],
  });
  const patched = applyPatch(data, patch, { mutate: true });

  assert.equal(patched, data);
  assert.deepEqual(data, [0, 6, 8, 3, 4]);
});

test('deltas wrap around ring/window boundaries', () => {
  const data = [14, 15, 0, 1];
  const patch = createAddPatch({
    objectId: 'object:ring',
    data,
    range: { start: 0, length: 4 },
    deltas: [1, 1, 16, 17],
    windowSize: 16,
  });

  assert.deepEqual(applyPatch(data, patch), [15, 0, 0, 2]);
});

test('negative deltas are supported and committed exactly', () => {
  const data = [0, 1, 2, 3];
  const patch = createAddPatch({
    objectId: 'object:negative',
    data,
    range: { start: 0, length: 4 },
    deltas: [-1, -2, -16, -17],
    windowSize: 16,
  });

  assert.deepEqual(patch.deltas, [-1, -2, -16, -17]);
  assert.deepEqual(applyPatch(data, patch), [15, 15, 2, 2]);
});

test('create and verify do not mutate inputs', () => {
  const data = Buffer.from([0, 1, 2, 3, 4, 5]);
  const range = { start: 1, length: 3 };
  const deltas = [1, 2, 3];
  const metadata = { z: 1, nested: { a: true } };
  const signedStackEnvelope = envelope();
  const dataBefore = Buffer.from(data);
  const rangeBefore = clone(range);
  const deltasBefore = deltas.slice();
  const metadataBefore = clone(metadata);
  const signedBefore = clone(signedStackEnvelope);
  const patch = createAddPatch({
    objectId: 'object:input-immutability',
    data,
    range,
    deltas,
    signedStackEnvelope,
    metadata,
  });
  const patchBefore = clone(patch);

  verifyPatch(patch, { data, signedStackEnvelope });

  assert.deepEqual([...data], [...dataBefore]);
  assert.deepEqual(range, rangeBefore);
  assert.deepEqual(deltas, deltasBefore);
  assert.deepEqual(metadata, metadataBefore);
  assert.deepEqual(signedStackEnvelope, signedBefore);
  assert.deepEqual(patch, patchBefore);
});

test('mixed UNSTACK transformed data can be patched and reversed', () => {
  const recipe = stack({
    layers: [
      rotateLayer({ id: 'rotate-a', turns: 1 }),
      swapLayer({ id: 'swap-b', swapCount: 4 }),
    ],
  });
  const signedStackEnvelope = envelope({ stack: recipe });
  const source = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const transformed = applyStack(source, recipe);
  const patch = createAddPatch({
    objectId: 'object:transformed',
    data: transformed,
    range: { start: 2, length: 5 },
    deltas: [1, 2, 3, 4, 5],
    signedStackEnvelope,
    metadata: { stage: 'after-stack' },
  });

  assert.equal(verifyPatch(patch, { data: transformed, signedStackEnvelope }).valid, true);

  const patchedTransformed = applyPatch(transformed, patch);
  assert.notDeepEqual([...patchedTransformed], [...transformed]);
  assert.deepEqual([...reversePatch(patchedTransformed, patch)], [...transformed]);
  assert.deepEqual([...reverseStack(transformed, recipe)], [...source]);

  const patchedPlaintext = reverseStack(patchedTransformed, recipe);
  assert.notDeepEqual([...patchedPlaintext], [...source]);
});
