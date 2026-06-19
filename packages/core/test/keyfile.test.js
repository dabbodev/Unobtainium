'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  applyPacketGraft,
  applyRotateTransform,
  applyStack,
  createContextPacket,
  createKeyfileDescriptor,
  createSignedStackEnvelope,
  deriveKeyMeshFromBytes,
  deriveKeyMeshFromString,
  generateEd25519KeyPair,
  generateInstructionStream,
  keyMeshCommitment,
  normalizeKeyfileInput,
  reverseRotateTransform,
  reverseStack,
  verifySignedStackEnvelope,
} = require('..');

function options(overrides = {}) {
  return {
    pointCount: 8,
    scale: 1000000,
    coordinateRange: 1000000,
    ...overrides,
  };
}

function state() {
  return { point: 0, shift: 1, gap: 1 };
}

function rotateLayer(mesh, overrides = {}) {
  return {
    id: 'keyfile-rotate',
    type: 'UN-ROTATE',
    mesh,
    graftMode: 'none',
    stateMode: 'explicit',
    state: state(),
    direction: 'up',
    turns: 2,
    minShift: 1,
    walkMode: 'permissive',
    ...overrides,
  };
}

function swapLayer(mesh, overrides = {}) {
  return {
    id: 'keyfile-swap',
    type: 'UN-SWAP',
    mesh,
    graftMode: 'none',
    stateMode: 'explicit',
    state: state(),
    swapCount: 4,
    minShift: 1,
    walkMode: 'permissive',
    ...overrides,
  };
}

function stack(layers, metadata = {}) {
  return {
    format: 'UNSTACK',
    version: 1,
    windowSize: 256,
    metadata,
    layers,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertPointMesh(points, pointCount, coordinateRange) {
  assert.equal(points.length, pointCount);
  points.forEach((point) => {
    assert.equal(point.length, 3);
    point.forEach((coordinate) => {
      assert.equal(Number.isSafeInteger(coordinate), true);
      assert.equal(coordinate >= 0 && coordinate < coordinateRange, true);
    });
  });
}

test('normalizes Buffer input with a defensive copy', () => {
  const input = Buffer.from([1, 2, 3]);
  const normalized = normalizeKeyfileInput(input);

  assert.equal(normalized.sourceType, 'buffer');
  assert.deepEqual([...normalized.bytes], [1, 2, 3]);
  normalized.bytes[0] = 99;
  assert.deepEqual([...input], [1, 2, 3]);
});

test('normalizes Uint8Array input with a defensive copy', () => {
  const input = new Uint8Array([4, 5, 6]);
  const normalized = normalizeKeyfileInput(input);

  assert.equal(normalized.sourceType, 'uint8array');
  assert.deepEqual([...normalized.bytes], [4, 5, 6]);
  normalized.bytes[0] = 99;
  assert.deepEqual([...input], [4, 5, 6]);
});

test('normalizes Array input to bytes', () => {
  const input = [7, 8, 9];
  const normalized = normalizeKeyfileInput(input);

  assert.equal(normalized.sourceType, 'array');
  assert.deepEqual([...normalized.bytes], input);
});

test('normalizes string input as UTF-8', () => {
  const normalized = normalizeKeyfileInput('unobtainium');

  assert.equal(normalized.sourceType, 'string');
  assert.deepEqual(normalized.bytes, Buffer.from('unobtainium', 'utf8'));
});

test('Buffer input derives deterministic mesh', () => {
  const first = deriveKeyMeshFromBytes(Buffer.from('mesh'), options());
  const second = deriveKeyMeshFromBytes(Buffer.from('mesh'), options());

  assert.deepEqual(first, second);
  assertPointMesh(first, 8, 1000000);
});

test('Uint8Array input derives deterministic mesh', () => {
  const first = deriveKeyMeshFromBytes(new Uint8Array([1, 2, 3]), options());
  const second = deriveKeyMeshFromBytes(new Uint8Array([1, 2, 3]), options());

  assert.deepEqual(first, second);
});

test('Array input derives deterministic mesh', () => {
  const first = deriveKeyMeshFromBytes([1, 2, 3], options());
  const second = deriveKeyMeshFromBytes([1, 2, 3], options());

  assert.deepEqual(first, second);
});

test('String input derives deterministic mesh', () => {
  const first = deriveKeyMeshFromString('key text', options());
  const second = deriveKeyMeshFromString('key text', options());

  assert.deepEqual(first, second);
});

test('same bytes produce same points across byte input types', () => {
  const opts = options({ context: { purpose: 'same-bytes' } });
  const fromBuffer = deriveKeyMeshFromBytes(Buffer.from([1, 2, 3]), opts);
  const fromArray = deriveKeyMeshFromBytes([1, 2, 3], opts);
  const fromUint8Array = deriveKeyMeshFromBytes(new Uint8Array([1, 2, 3]), opts);

  assert.deepEqual(fromBuffer, fromArray);
  assert.deepEqual(fromBuffer, fromUint8Array);
});

test('deriveKeyMeshFromString uses UTF-8 bytes for points', () => {
  const opts = options({ salt: 'string-wrapper' });

  assert.deepEqual(
    deriveKeyMeshFromString('same text', opts),
    deriveKeyMeshFromBytes(Buffer.from('same text', 'utf8'), opts),
  );
});

test('different bytes produce different points', () => {
  const first = deriveKeyMeshFromBytes(Buffer.from('alpha'), options());
  const second = deriveKeyMeshFromBytes(Buffer.from('beta'), options());

  assert.notDeepEqual(first, second);
});

test('different passphrase changes points and commitment', () => {
  const first = createKeyfileDescriptor('input', options({ passphrase: 'one' }));
  const second = createKeyfileDescriptor('input', options({ passphrase: 'two' }));

  assert.notDeepEqual(first.points, second.points);
  assert.notEqual(first.meshCommitment, second.meshCommitment);
  assert.notEqual(first.passphraseCommitment, second.passphraseCommitment);
});

test('different context changes points and commitment', () => {
  const first = createKeyfileDescriptor('input', options({ context: { tenant: 'a' } }));
  const second = createKeyfileDescriptor('input', options({ context: { tenant: 'b' } }));

  assert.notDeepEqual(first.points, second.points);
  assert.notEqual(first.meshCommitment, second.meshCommitment);
  assert.notEqual(first.contextCommitment, second.contextCommitment);
});

test('different salt changes points and commitment', () => {
  const first = createKeyfileDescriptor('input', options({ salt: 'one' }));
  const second = createKeyfileDescriptor('input', options({ salt: 'two' }));

  assert.notDeepEqual(first.points, second.points);
  assert.notEqual(first.meshCommitment, second.meshCommitment);
  assert.notEqual(first.saltCommitment, second.saltCommitment);
});

test('different label changes points and mesh commitment', () => {
  const first = createKeyfileDescriptor('input', options({ label: 'one' }));
  const second = createKeyfileDescriptor('input', options({ label: 'two' }));

  assert.notDeepEqual(first.points, second.points);
  assert.notEqual(first.meshCommitment, second.meshCommitment);
});

test('different pointCount changes points length and commitment', () => {
  const first = createKeyfileDescriptor('input', options({ pointCount: 4 }));
  const second = createKeyfileDescriptor('input', options({ pointCount: 6 }));

  assert.equal(first.points.length, 4);
  assert.equal(second.points.length, 6);
  assert.notEqual(first.meshCommitment, second.meshCommitment);
});

test('different scale changes points and commitment', () => {
  const first = createKeyfileDescriptor('input', options({ scale: 1000 }));
  const second = createKeyfileDescriptor('input', options({ scale: 2000 }));

  assert.notDeepEqual(first.points, second.points);
  assert.notEqual(first.meshCommitment, second.meshCommitment);
});

test('different coordinateRange changes points and commitment', () => {
  const first = createKeyfileDescriptor('input', options({ coordinateRange: 1000 }));
  const second = createKeyfileDescriptor('input', options({ coordinateRange: 2000 }));

  assertPointMesh(first.points, 8, 1000);
  assertPointMesh(second.points, 8, 2000);
  assert.notDeepEqual(first.points, second.points);
  assert.notEqual(first.meshCommitment, second.meshCommitment);
});

test('sourceType affects descriptor commitment but not derived points', () => {
  const first = createKeyfileDescriptor(Buffer.from('abc'), options({ sourceType: 'bytes' }));
  const second = createKeyfileDescriptor(Buffer.from('abc'), options({ sourceType: 'buffer' }));

  assert.deepEqual(first.points, second.points);
  assert.notEqual(first.meshCommitment, second.meshCommitment);
});

test('descriptor includes expected fields and commitments', () => {
  const descriptor = createKeyfileDescriptor(Buffer.from('descriptor'), options({
    label: 'fixture',
    passphrase: 'secret',
    context: { b: 2, a: 1 },
    salt: Buffer.from([9, 8, 7]),
  }));

  assert.equal(descriptor.format, 'UN-KEYFILE');
  assert.equal(descriptor.version, 1);
  assert.equal(descriptor.pointCount, 8);
  assert.equal(descriptor.scale, 1000000);
  assert.equal(descriptor.coordinateRange, 1000000);
  assert.equal(descriptor.sourceType, 'buffer');
  assert.equal(descriptor.label, 'fixture');
  assert.match(descriptor.inputCommitment, /^[0-9a-f]{64}$/);
  assert.match(descriptor.contextCommitment, /^[0-9a-f]{64}$/);
  assert.match(descriptor.saltCommitment, /^[0-9a-f]{64}$/);
  assert.match(descriptor.passphraseCommitment, /^[0-9a-f]{64}$/);
  assert.match(descriptor.meshCommitment, /^[0-9a-f]{64}$/);
  assertPointMesh(descriptor.points, 8, 1000000);
});

test('meshCommitment is deterministic', () => {
  const first = createKeyfileDescriptor('stable', options({ context: { a: 1 } }));
  const second = createKeyfileDescriptor('stable', options({ context: { a: 1 } }));

  assert.equal(first.meshCommitment, second.meshCommitment);
  assert.equal(keyMeshCommitment(first), first.meshCommitment);
});

test('tampering descriptor points changes keyMeshCommitment', () => {
  const descriptor = createKeyfileDescriptor('tamper', options());
  const tampered = clone(descriptor);
  tampered.points[0][0] = (tampered.points[0][0] + 1) % tampered.coordinateRange;

  assert.notEqual(keyMeshCommitment(tampered), descriptor.meshCommitment);
});

test('keyMeshCommitment excludes meshCommitment itself from payload', () => {
  const descriptor = createKeyfileDescriptor('exclude', options());
  const tampered = {
    ...descriptor,
    meshCommitment: '0'.repeat(64),
  };

  assert.equal(keyMeshCommitment(tampered), descriptor.meshCommitment);
});

test('input and options are not mutated', () => {
  const input = [1, 2, 3];
  const opts = options({
    passphrase: 'secret',
    context: { nested: { b: 2, a: 1 } },
    salt: [9, 8, 7],
    label: 'immutable',
  });
  const inputBefore = input.slice();
  const optsBefore = clone(opts);

  createKeyfileDescriptor(input, opts);

  assert.deepEqual(input, inputBefore);
  assert.deepEqual(opts, optsBefore);
});

test('invalid pointCount, scale, and coordinateRange throw', () => {
  for (const pointCount of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => deriveKeyMeshFromBytes('x', options({ pointCount })), /pointCount/);
  }
  for (const scale of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => deriveKeyMeshFromBytes('x', options({ scale })), /scale/);
  }
  for (const coordinateRange of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => deriveKeyMeshFromBytes('x', options({ coordinateRange })), /coordinateRange/);
  }
});

test('invalid array byte values throw', () => {
  for (const input of [[-1], [256], [1.5], [Number.NaN], [Number.POSITIVE_INFINITY], [, 1]]) {
    assert.throws(() => normalizeKeyfileInput(input), /byte/);
  }
});

test('unsupported input types throw', () => {
  for (const input of [null, undefined, 12, true, {}, () => {}]) {
    assert.throws(() => normalizeKeyfileInput(input), /input/);
  }
  assert.throws(() => deriveKeyMeshFromString(Buffer.from('x')), /string/);
});

test('unsupported option material throws', () => {
  assert.throws(() => createKeyfileDescriptor('x', options({ context: () => {} })), /context/);
  assert.throws(() => createKeyfileDescriptor('x', options({ salt: Number.NaN })), /salt/);
  assert.throws(() => createKeyfileDescriptor('x', options({ label: { nope: true } })), /label/);
  assert.throws(() => createKeyfileDescriptor('x', options({ sourceType: 'path' })), /sourceType/);
});

test('context object key order is stable', () => {
  const first = createKeyfileDescriptor('ctx', options({ context: { b: 2, a: 1 } }));
  const second = createKeyfileDescriptor('ctx', options({ context: { a: 1, b: 2 } }));

  assert.deepEqual(first.points, second.points);
  assert.equal(first.contextCommitment, second.contextCommitment);
  assert.equal(first.meshCommitment, second.meshCommitment);
});

test('keyfile-derived mesh works with instruction stream and rotate roundtrip', () => {
  const mesh = deriveKeyMeshFromString('instruction integration', options());
  const data = Buffer.from([1, 2, 3, 4, 5, 6]);
  const instructions = generateInstructionStream({
    mesh,
    state: state(),
    count: data.length,
    windowSize: 256,
    minShift: 1,
  }).instructions;
  const transformed = applyRotateTransform(data, instructions);
  const restored = reverseRotateTransform(transformed, instructions);

  assert.notDeepEqual([...transformed], [...data]);
  assert.deepEqual([...restored], [...data]);
});

test('keyfile-derived mesh works in unsigned UNSTACK layer', () => {
  const mesh = deriveKeyMeshFromBytes(Buffer.from('stack integration'), options());
  const recipe = stack([rotateLayer(mesh)]);
  const data = [0, 1, 2, 3, 4, 5, 6];
  const transformed = applyStack(data, recipe);
  const restored = reverseStack(transformed, recipe);

  assert.notDeepEqual(transformed, data);
  assert.deepEqual(restored, data);
});

test('keyfile-derived mesh works in mixed UN-ROTATE and UN-SWAP stack roundtrip', () => {
  const mesh = deriveKeyMeshFromString('mixed stack integration', options());
  const recipe = stack([
    rotateLayer(mesh, { turns: 1 }),
    swapLayer(mesh, { swapCount: 5 }),
  ]);
  const data = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]);
  const transformed = applyStack(data, recipe);
  const restored = reverseStack(transformed, recipe);

  assert.notDeepEqual([...transformed], [...data]);
  assert.deepEqual([...restored], [...data]);
});

test('context packet can be grafted onto keyfile-derived mesh', () => {
  const mesh = deriveKeyMeshFromString('graft integration', options({ pointCount: 5 }));
  const packet = createContextPacket({ context: { role: 'demo' }, pointCount: 3 });
  const grafted = applyPacketGraft(mesh, packet, 'append');

  assert.equal(grafted.length, 8);
  assert.deepEqual(grafted.slice(0, mesh.length), mesh);
  assert.deepEqual(grafted.slice(mesh.length), packet.points);
});

test('signed stack can bind keyfile-derived mesh descriptor in metadata', () => {
  const descriptor = createKeyfileDescriptor('signed keyfile mesh', options({ label: 'signed' }));
  const keys = generateEd25519KeyPair();
  const recipe = stack(
    [rotateLayer(descriptor.points)],
    { keyMeshCommitment: descriptor.meshCommitment },
  );
  const envelope = createSignedStackEnvelope({
    stack: recipe,
    signerId: 'owner:keyfile-test',
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
  });

  assert.equal(envelope.stack.metadata.keyMeshCommitment, descriptor.meshCommitment);
  assert.equal(verifySignedStackEnvelope(envelope).valid, true);
});
