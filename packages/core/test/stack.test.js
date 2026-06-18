'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createContextPacket,
  createNoncePacket,
} = require('../src/point-packet');
const {
  normalizeStack,
  applyStack,
  reverseStack,
} = require('../src/stack');
const { stackCommitment } = require('../src/stack-canonical');

function baseMesh() {
  return [
    [0, 0, 0],
    [1000000, 0, 0],
    [0, 1000000, 0],
    [0, 0, 1000000],
  ];
}

function largerMesh() {
  return baseMesh().concat([
    [1000000, 1000000, 0],
    [0, 1000000, 1000000],
  ]);
}

function layer(overrides = {}) {
  return {
    id: 'layer-1',
    type: 'UN-ROTATE',
    mesh: baseMesh(),
    graftMode: 'none',
    state: { point: 0, shift: 1, gap: 1 },
    stateMode: 'explicit',
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
    layers: [layer()],
    ...overrides,
  };
}

function roundtrip(data, recipe) {
  const transformed = applyStack(data, recipe);
  return reverseStack(transformed, recipe);
}

test('normalizeStack validates and returns a normalized copy', () => {
  const recipe = stack({ layers: [layer({ graftMode: undefined, stateMode: undefined })] });
  const normalized = normalizeStack(recipe);

  assert.notEqual(normalized, recipe);
  assert.notEqual(normalized.layers[0], recipe.layers[0]);
  assert.equal(normalized.layers[0].graftMode, 'none');
  assert.equal(normalized.layers[0].stateMode, 'explicit');
});

test('single-layer stack roundtrips with applyStack then reverseStack', () => {
  const data = [0, 1, 2, 3, 4, 5];

  assert.deepEqual(roundtrip(data, stack()), data);
});

test('multi-layer stack roundtrips', () => {
  const recipe = stack({
    layers: [
      layer({ id: 'a', direction: 'up', turns: 3, state: { point: 0, shift: 1, gap: 1 } }),
      layer({ id: 'b', direction: 'down', turns: 5, state: { point: 1, shift: 2, gap: 1 } }),
      layer({ id: 'c', direction: 'up', turns: 8, state: { point: 2, shift: 1, gap: 2 } }),
    ],
  });
  const data = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
  const transformed = applyStack(data, recipe);
  const restored = reverseStack(transformed, recipe);

  assert.notDeepEqual([...transformed], [...data]);
  assert.deepEqual([...restored], [...data]);
});

test('layer order affects stack commitment for rotate-only recipes', () => {
  const first = stack({
    layers: [
      layer({ id: 'first', turns: 2 }),
      layer({ id: 'second', turns: 7, direction: 'down' }),
    ],
  });
  const second = stack({
    layers: [
      layer({ id: 'second', turns: 7, direction: 'down' }),
      layer({ id: 'first', turns: 2 }),
    ],
  });

  assert.notEqual(stackCommitment(first), stackCommitment(second));
});

test('stack input object is not mutated', () => {
  const recipe = stack();
  const before = JSON.stringify(recipe);

  applyStack([0, 1, 2, 3], recipe);

  assert.equal(JSON.stringify(recipe), before);
});

test('data input is not mutated by default', () => {
  const data = [0, 1, 2, 3];
  const before = data.slice();
  const transformed = applyStack(data, stack());

  assert.notEqual(transformed, data);
  assert.deepEqual(data, before);
});

test('data input mutates only when options.mutate is true', () => {
  const data = [0, 1, 2, 3];
  const transformed = applyStack(data, stack(), { mutate: true });

  assert.equal(transformed, data);
  assert.notDeepEqual(data, [0, 1, 2, 3]);
});

test('Array, Buffer, and Uint8Array inputs roundtrip', () => {
  const recipe = stack();
  const array = [0, 1, 2, 3, 4];
  const buffer = Buffer.from(array);
  const bytes = new Uint8Array(array);

  assert.deepEqual(roundtrip(array, recipe), array);
  assert.equal(Buffer.isBuffer(roundtrip(buffer, recipe)), true);
  assert.deepEqual([...roundtrip(buffer, recipe)], [...buffer]);
  assert.equal(roundtrip(bytes, recipe) instanceof Uint8Array, true);
  assert.equal(Buffer.isBuffer(roundtrip(bytes, recipe)), false);
  assert.deepEqual([...roundtrip(bytes, recipe)], [...bytes]);
});

test('stack with packet append graft roundtrips', () => {
  const packet = createContextPacket({ context: 'append', pointCount: 4 });
  const recipe = stack({ layers: [layer({ packet, graftMode: 'append' })] });
  const data = [0, 1, 2, 3, 4, 5];

  assert.deepEqual(roundtrip(data, recipe), data);
});

test('stack with packet prepend graft roundtrips', () => {
  const packet = createContextPacket({ context: 'prepend', pointCount: 4 });
  const recipe = stack({ layers: [layer({ packet, graftMode: 'prepend' })] });
  const data = [0, 1, 2, 3, 4, 5];

  assert.deepEqual(roundtrip(data, recipe), data);
});

test('stack with packet sandwich graft roundtrips', () => {
  const packet = createContextPacket({ context: 'sandwich', pointCount: 4 });
  const recipe = stack({ layers: [layer({ packet, graftMode: 'sandwich' })] });
  const data = [0, 1, 2, 3, 4, 5];

  assert.deepEqual(roundtrip(data, recipe), data);
});

test('stack with anchored state roundtrips', () => {
  const packet = createNoncePacket({ nonce: 'anchor', pointCount: 4 });
  const recipe = stack({
    layers: [layer({
      packet,
      graftMode: 'append',
      stateMode: 'anchored',
      state: undefined,
    })],
  });
  const data = Buffer.from([0, 1, 2, 3, 4, 5, 6]);
  const restored = roundtrip(data, recipe);

  assert.deepEqual([...restored], [...data]);
});

test('invalid stack format, version, and layers throw', () => {
  assert.throws(() => normalizeStack({ ...stack(), format: 'OTHER' }), /format/);
  assert.throws(() => normalizeStack({ ...stack(), version: 2 }), /version/);
  assert.throws(() => normalizeStack({ ...stack(), layers: [] }), /layers/);
});

test('unknown layer type throws', () => {
  assert.throws(() => normalizeStack(stack({ layers: [layer({ type: 'UN-SWAP' })] })), /type/);
});

test('missing mesh throws', () => {
  const missing = layer();
  delete missing.mesh;

  assert.throws(() => normalizeStack(stack({ layers: [missing] })), /mesh/);
});

test('anchored state without packet throws', () => {
  assert.throws(() => normalizeStack(stack({
    layers: [layer({ stateMode: 'anchored', packet: undefined })],
  })), /packet/);
});

test('malformed state throws', () => {
  assert.throws(() => normalizeStack(stack({
    layers: [layer({ state: { point: 0, shift: 1 } })],
  })), /state.gap/);
});

test('invalid direction, turns, minShift, and walkMode throw', () => {
  assert.throws(() => normalizeStack(stack({ layers: [layer({ direction: 'left' })] })), /direction/);
  assert.throws(() => normalizeStack(stack({ layers: [layer({ turns: 1.5 })] })), /turns/);
  assert.throws(() => normalizeStack(stack({ layers: [layer({ minShift: 256 })] })), /minShift/);
  assert.throws(() => normalizeStack(stack({ layers: [layer({ walkMode: 'random' })] })), /walkMode/);
});

test('distinct walk mode works when mesh has enough points', () => {
  const recipe = stack({
    layers: [layer({
      mesh: largerMesh(),
      walkMode: 'distinct',
      state: { point: 0, shift: 1, gap: 1 },
    })],
  });
  const data = [0, 1, 2, 3, 4, 5];

  assert.deepEqual(roundtrip(data, recipe), data);
});
