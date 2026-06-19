'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  applyResidual,
  createBlankData,
  createKeyfileDescriptor,
  deriveKeyMeshFromString,
  generateFromStack,
  normalizeGenerationData,
  residualBetween,
  reverseResidual,
  reverseStack,
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

function state() {
  return { point: 0, shift: 1, gap: 1 };
}

function rotateLayer(mesh = baseMesh(), overrides = {}) {
  return {
    id: 'generation-rotate',
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

function swapLayer(mesh = baseMesh(), overrides = {}) {
  return {
    id: 'generation-swap',
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

function stack(overrides = {}) {
  return {
    format: 'UNSTACK',
    version: 1,
    windowSize: 256,
    metadata: { sprint: 14 },
    layers: [rotateLayer()],
    ...overrides,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function asArray(data) {
  return Array.from(data);
}

test('createBlankData creates Array blank data with requested length and fill', () => {
  assert.deepEqual(createBlankData({ length: 4, fill: 7 }), [7, 7, 7, 7]);
});

test('createBlankData creates Uint8Array blank data', () => {
  const blank = createBlankData({ length: 3, type: 'uint8array', fill: 5 });

  assert.equal(blank instanceof Uint8Array, true);
  assert.equal(Buffer.isBuffer(blank), false);
  assert.deepEqual([...blank], [5, 5, 5]);
});

test('createBlankData creates Buffer blank data', () => {
  const blank = createBlankData({ length: 3, type: 'buffer', fill: 6 });

  assert.equal(Buffer.isBuffer(blank), true);
  assert.deepEqual([...blank], [6, 6, 6]);
});

test('createBlankData length zero works', () => {
  assert.deepEqual(createBlankData({ length: 0 }), []);
  assert.equal(createBlankData({ length: 0, type: 'buffer' }).length, 0);
});

test('createBlankData fill wraps through window', () => {
  assert.deepEqual(createBlankData({ length: 3, windowSize: 16, fill: -1 }), [15, 15, 15]);
  assert.deepEqual(createBlankData({ length: 3, windowSize: 16, fill: 18 }), [2, 2, 2]);
});

test('createBlankData rejects invalid options', () => {
  assert.throws(() => createBlankData({ length: -1 }), /length/);
  assert.throws(() => createBlankData({ length: 1.5 }), /length/);
  assert.throws(() => createBlankData({ length: 1, windowSize: 1 }), /windowSize/);
  assert.throws(() => createBlankData({ length: 1, windowSize: 1.5 }), /windowSize/);
  assert.throws(() => createBlankData({ length: 1, type: 'string' }), /type/);
  assert.throws(() => createBlankData({ length: 1, fill: 1.5 }), /fill/);
  assert.throws(() => createBlankData({
    length: 1,
    windowSize: 512,
    type: 'buffer',
    fill: 300,
  }), /byte/);
});

test('generateFromStack creates deterministic generated data', () => {
  const recipe = stack();
  const first = generateFromStack({ length: 8, stack: recipe });
  const second = generateFromStack({ length: 8, stack: recipe });

  assert.deepEqual(first, second);
});

test('generateFromStack output is not all blank with active rotate and swap layers', () => {
  const recipe = stack({
    layers: [
      rotateLayer(baseMesh(), { id: 'rotate-a', turns: 1 }),
      swapLayer(baseMesh(), { id: 'swap-b', swapCount: 5 }),
    ],
  });
  const generated = generateFromStack({ length: 8, stack: recipe, fill: 0 });

  assert.notDeepEqual(generated, createBlankData({ length: 8, fill: 0 }));
});

test('generateFromStack length zero returns empty generated data', () => {
  const generated = generateFromStack({
    length: 0,
    stack: stack({ layers: [swapLayer()] }),
  });

  assert.deepEqual(generated, []);
});

test('generateFromStack preserves requested type', () => {
  const bufferGenerated = generateFromStack({ length: 5, stack: stack(), type: 'buffer' });
  const bytesGenerated = generateFromStack({ length: 5, stack: stack(), type: 'uint8array' });

  assert.equal(Buffer.isBuffer(bufferGenerated), true);
  assert.equal(bytesGenerated instanceof Uint8Array, true);
  assert.equal(Buffer.isBuffer(bytesGenerated), false);
});

test('generateFromStack does not mutate stack', () => {
  const recipe = stack();
  const before = clone(recipe);

  generateFromStack({ length: 6, stack: recipe });

  assert.deepEqual(recipe, before);
});

test('generateFromStack rejects conflicting supplied windowSize and stack.windowSize', () => {
  assert.throws(() => generateFromStack({
    length: 4,
    stack: stack({ windowSize: 16 }),
    windowSize: 256,
  }), /windowSize/);
});

test('generateFromStack uses stack.windowSize when windowSize is omitted', () => {
  const recipe = stack({
    windowSize: 16,
    layers: [rotateLayer(baseMesh(), { windowSize: 16, minShift: 1 })],
  });
  const generated = generateFromStack({ length: 4, stack: recipe });

  generated.forEach((value) => assert.equal(value >= 0 && value < 16, true));
});

test('generateFromStack works with keyfile-derived mesh', () => {
  const descriptor = createKeyfileDescriptor('generation descriptor mesh', { pointCount: 8 });
  const recipe = stack({
    metadata: { keyMeshCommitment: descriptor.meshCommitment },
    layers: [rotateLayer(descriptor.points, { turns: 1 })],
  });
  const generated = generateFromStack({ length: 8, stack: recipe });

  assert.notDeepEqual(generated, createBlankData({ length: 8 }));
});

test('generateFromStack works with mixed UN-ROTATE and UN-SWAP stack', () => {
  const recipe = stack({
    layers: [
      rotateLayer(baseMesh(), { id: 'rotate-a', turns: 1 }),
      swapLayer(baseMesh(), { id: 'swap-b', swapCount: 5 }),
    ],
  });
  const generated = generateFromStack({ length: 8, stack: recipe, type: 'buffer' });
  const restored = reverseStack(generated, recipe);

  assert.equal(Buffer.isBuffer(generated), true);
  assert.deepEqual([...restored], [...createBlankData({ length: 8, type: 'buffer' })]);
});

test('reverse stack on generated data returns blank data', () => {
  const recipe = stack({
    layers: [
      rotateLayer(baseMesh(), { id: 'rotate-a', turns: 3 }),
      swapLayer(baseMesh(), { id: 'swap-b', swapCount: 5 }),
    ],
  });
  const generated = generateFromStack({ length: 8, stack: recipe, fill: 9 });
  const restored = reverseStack(generated, recipe);

  assert.deepEqual(restored, createBlankData({ length: 8, fill: 9 }));
});

test('residualBetween produces residual that reconstructs target from generated', () => {
  const generated = [10, 250, 0, 5];
  const target = [12, 1, 255, 5];
  const residual = residualBetween({ target, generated });

  assert.deepEqual(residual, [2, 7, 255, 0]);
  assert.deepEqual(applyResidual({ generated, residual }), target);
});

test('reverseResidual matches residualBetween', () => {
  const generated = [3, 14, 0];
  const target = [5, 1, 15];
  const options = { target, generated, windowSize: 16 };

  assert.deepEqual(reverseResidual(options), residualBetween(options));
});

test('residual functions do not mutate inputs', () => {
  const generated = [10, 20, 30];
  const target = [11, 19, 30];
  const generatedBefore = generated.slice();
  const targetBefore = target.slice();
  const residual = residualBetween({ target, generated });
  const residualBefore = residual.slice();

  applyResidual({ generated, residual });
  reverseResidual({ target, generated });

  assert.deepEqual(generated, generatedBefore);
  assert.deepEqual(target, targetBefore);
  assert.deepEqual(residual, residualBefore);
});

test('applyResidual mutates only when mutate is true', () => {
  const generated = [0, 1, 2];
  const immutable = applyResidual({ generated, residual: [1, 1, 1] });

  assert.notEqual(immutable, generated);
  assert.deepEqual(generated, [0, 1, 2]);

  const mutable = applyResidual({ generated, residual: [2, 2, 2], mutate: true });

  assert.equal(mutable, generated);
  assert.deepEqual(generated, [2, 3, 4]);
});

test('residual functions support Array, Buffer, and Uint8Array inputs', () => {
  for (const { generated, target } of [
    { generated: [0, 1, 2, 3], target: [3, 2, 1, 0] },
    { generated: Buffer.from([0, 1, 2, 3]), target: Buffer.from([3, 2, 1, 0]) },
    { generated: new Uint8Array([0, 1, 2, 3]), target: new Uint8Array([3, 2, 1, 0]) },
  ]) {
    const residual = residualBetween({ target, generated });
    const reconstructed = applyResidual({ generated, residual });

    assert.deepEqual(asArray(reconstructed), [3, 2, 1, 0]);
    assert.equal(Array.isArray(reconstructed), Array.isArray(generated));
    assert.equal(Buffer.isBuffer(reconstructed), Buffer.isBuffer(generated));
    assert.equal(reconstructed instanceof Uint8Array, generated instanceof Uint8Array);
  }
});

test('residual values wrap around window boundaries', () => {
  const generated = [14, 15, 0, 1];
  const target = [0, 1, 15, 14];
  const residual = residualBetween({ target, generated, windowSize: 16 });

  assert.deepEqual(residual, [2, 2, 15, 13]);
  assert.deepEqual(applyResidual({ generated, residual, windowSize: 16 }), target);
});

test('residual operations reject different lengths and invalid values', () => {
  assert.throws(() => residualBetween({
    target: [1],
    generated: [1, 2],
  }), /same length/);
  assert.throws(() => applyResidual({
    generated: [1],
    residual: [1, 2],
  }), /same length/);
  assert.throws(() => residualBetween({
    target: [1.5],
    generated: [1],
  }), /integer/);
  assert.throws(() => residualBetween({
    target: [16],
    generated: [1],
    windowSize: 16,
  }), /0..windowSize-1/);
  assert.throws(() => residualBetween({
    target: [Number.NaN],
    generated: [1],
  }), /integer/);
  assert.throws(() => residualBetween({
    target: [Number.POSITIVE_INFINITY],
    generated: [1],
  }), /integer/);
  assert.throws(() => applyResidual({
    generated: [1],
    residual: [1.5],
  }), /integer/);
  assert.throws(() => applyResidual({
    generated: { 0: 1, length: 1 },
    residual: [1],
  }), /generated/);
  assert.throws(() => normalizeGenerationData([, 1]), /data\[0\]/);
});

test('negative residual integers apply correctly', () => {
  assert.deepEqual(applyResidual({
    generated: [0, 1, 2, 3],
    residual: [-1, -2, -16, -17],
    windowSize: 16,
  }), [15, 15, 2, 2]);
});

test('integration: generated plus residual reconstructs target with keyfile mixed stack', () => {
  const mesh = deriveKeyMeshFromString('sprint 14 integration mesh', { pointCount: 8 });
  const recipe = stack({
    layers: [
      rotateLayer(mesh, { id: 'rotate-keyfile', turns: 1 }),
      swapLayer(mesh, { id: 'swap-keyfile', swapCount: 5 }),
    ],
  });
  const blank = createBlankData({ length: 8 });
  const generated = generateFromStack({ length: 8, stack: recipe });
  const target = [3, 1, 4, 1, 5, 9, 2, 6];
  const residual = residualBetween({ target, generated });
  const reconstructed = applyResidual({ generated, residual });
  const secondResidual = reverseResidual({ target, generated });
  const restoredBlank = reverseStack(generated, recipe);

  assert.deepEqual(reconstructed, target);
  assert.deepEqual(secondResidual, residual);
  assert.deepEqual(restoredBlank, blank);
});
