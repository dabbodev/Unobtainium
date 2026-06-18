'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createContextPacket,
  createNoncePacket,
} = require('../src/point-packet');
const {
  stableStringify,
  canonicalizeStack,
  stackCommitment,
} = require('../src/stack-canonical');

function mesh() {
  return [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
}

function layer(overrides = {}) {
  return {
    id: 'layer-1',
    type: 'UN-ROTATE',
    mesh: mesh(),
    state: { point: 0, shift: 1, gap: 1 },
    direction: 'up',
    turns: 3,
    minShift: 1,
    walkMode: 'permissive',
    ...overrides,
  };
}

function stack(overrides = {}) {
  return {
    format: 'UNSTACK',
    version: 1,
    windowSize: 256,
    metadata: { purpose: 'test' },
    layers: [layer()],
    ...overrides,
  };
}

test('stableStringify sorts object keys', () => {
  assert.equal(stableStringify({ b: 2, a: 1 }), '{"a":1,"b":2}');
});

test('stableStringify preserves array order', () => {
  assert.equal(stableStringify({ values: [3, 1, 2] }), '{"values":[3,1,2]}');
});

test('stableStringify rejects unsupported values', () => {
  const circular = {};
  circular.self = circular;

  assert.throws(() => stableStringify({ value: undefined }), /unsupported|undefined/);
  assert.throws(() => stableStringify({ value: () => {} }), /unsupported/);
  assert.throws(() => stableStringify({ value: Symbol('x') }), /unsupported/);
  assert.throws(() => stableStringify({ value: Number.NaN }), /finite/);
  assert.throws(() => stableStringify({ value: Infinity }), /finite/);
  assert.throws(() => stableStringify(circular), /cycles/);
});

test('canonicalizeStack is stable for equivalent object key orders', () => {
  const first = stack();
  const second = {
    layers: [{
      turns: 3,
      walkMode: 'permissive',
      direction: 'up',
      state: { gap: 1, shift: 1, point: 0 },
      mesh: mesh(),
      minShift: 1,
      type: 'UN-ROTATE',
      id: 'layer-1',
    }],
    metadata: { purpose: 'test' },
    windowSize: 256,
    version: 1,
    format: 'UNSTACK',
  };

  assert.equal(canonicalizeStack(first), canonicalizeStack(second));
});

test('stackCommitment is deterministic', () => {
  const recipe = stack();

  assert.match(stackCommitment(recipe), /^[0-9a-f]{64}$/);
  assert.equal(stackCommitment(recipe), stackCommitment(recipe));
});

test('reordering layers changes commitment', () => {
  const first = stack({
    layers: [
      layer({ id: 'a', direction: 'up', turns: 1 }),
      layer({ id: 'b', direction: 'down', turns: 2 }),
    ],
  });
  const second = stack({
    layers: [
      layer({ id: 'b', direction: 'down', turns: 2 }),
      layer({ id: 'a', direction: 'up', turns: 1 }),
    ],
  });

  assert.notEqual(stackCommitment(first), stackCommitment(second));
});

test('changing turns changes commitment', () => {
  assert.notEqual(
    stackCommitment(stack({ layers: [layer({ turns: 1 })] })),
    stackCommitment(stack({ layers: [layer({ turns: 2 })] })),
  );
});

test('changing packet commitment changes commitment', () => {
  const packet = createContextPacket({ context: 'canonical-packet', pointCount: 3 });
  const first = stack({
    layers: [layer({ packet, graftMode: 'append' })],
  });
  const second = stack({
    layers: [layer({
      packet: { ...packet, commitment: createNoncePacket({ nonce: 'other', pointCount: 3 }).commitment },
      graftMode: 'append',
    })],
  });

  assert.notEqual(stackCommitment(first), stackCommitment(second));
});

test('changing metadata changes commitment', () => {
  assert.notEqual(
    stackCommitment(stack({ metadata: { purpose: 'alpha' } })),
    stackCommitment(stack({ metadata: { purpose: 'beta' } })),
  );
});

test('canonicalizeStack omits runtime-only fields', () => {
  const first = stack();
  const second = {
    ...stack(),
    runtime: { startedAt: 'not part of recipe', transform: () => {} },
    _scratch: { value: 1 },
  };

  assert.equal(canonicalizeStack(first), canonicalizeStack(second));
});
