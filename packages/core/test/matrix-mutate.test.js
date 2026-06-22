'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  MATRIX_MUTATE_FORMAT,
  MATRIX_MUTATE_VERSION,
  applyMatrixMutationOperation,
  applyMatrixMutationRecipe,
  assertMatrixMutationBounds,
  createMatrixKey,
  matrixMutationRecipeCommitment,
  matrixMutationRecipePayload,
  normalizeMatrixMutationRecipe,
} = require('..');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function valuesAfter(source, operation) {
  return applyMatrixMutationOperation(source, operation);
}

test('normalizeMatrixMutationRecipe canonicalizes a valid committed recipe', () => {
  const source = createMatrixKey([[1, 2], [3, 4]]);
  const target = createMatrixKey([[3, 4], [1, 2]]);
  const recipe = normalizeMatrixMutationRecipe({
    sourceMatrix: source,
    targetMatrixCommitment: target.matrixCommitment,
    operations: [{ type: 'swapRows', a: 0, b: 1 }],
    metadata: { b: 2, a: 1 },
  });

  assert.deepEqual(recipe, {
    format: MATRIX_MUTATE_FORMAT,
    version: MATRIX_MUTATE_VERSION,
    sourceMatrixCommitment: source.matrixCommitment,
    targetMatrixCommitment: target.matrixCommitment,
    operations: [{ type: 'swapRows', a: 0, b: 1 }],
    metadata: { a: 1, b: 2 },
    matrixMutationRecipeCommitment: recipe.matrixMutationRecipeCommitment,
  });
  assert.match(recipe.matrixMutationRecipeCommitment, /^[0-9a-f]{64}$/);
});

test('normalizeMatrixMutationRecipe accepts a source matrix commitment', () => {
  const source = createMatrixKey([[1, 2], [3, 4]]);
  const recipe = normalizeMatrixMutationRecipe({
    sourceMatrixCommitment: source.matrixCommitment,
    operations: [{ type: 'reverseRow', row: 0 }],
  });

  assert.equal(recipe.sourceMatrixCommitment, source.matrixCommitment);
  assert.equal(recipe.targetMatrixCommitment, null);
});

test('matrixMutationRecipePayload excludes runtime commitment and returns copies', () => {
  const recipe = normalizeMatrixMutationRecipe({
    operations: [{ type: 'reverseRow', row: 0 }],
    metadata: { nested: { value: 1 } },
  });
  const payload = matrixMutationRecipePayload(recipe);

  assert.equal(Object.hasOwn(payload, 'matrixMutationRecipeCommitment'), false);
  assert.deepEqual(payload.operations, [{ type: 'reverseRow', row: 0 }]);

  payload.operations[0].row = 1;
  payload.metadata.nested.value = 2;
  assert.equal(recipe.operations[0].row, 0);
  assert.equal(recipe.metadata.nested.value, 1);
});

test('normalizeMatrixMutationRecipe rejects invalid recipe shape', () => {
  assert.throws(() => normalizeMatrixMutationRecipe(null), /object/);
  assert.throws(() => normalizeMatrixMutationRecipe({}), /operations/);
  assert.throws(() => normalizeMatrixMutationRecipe({ operations: 'nope' }), /array/);
  assert.throws(() => normalizeMatrixMutationRecipe({ operations: [] }), /at least one/);
  assert.throws(() => normalizeMatrixMutationRecipe({
    format: 'OTHER',
    operations: [{ type: 'transpose' }],
  }), /format/);
  assert.throws(() => normalizeMatrixMutationRecipe({
    version: 99,
    operations: [{ type: 'transpose' }],
  }), /version/);
});

test('normalizeMatrixMutationRecipe rejects unknown operation types', () => {
  assert.throws(() => normalizeMatrixMutationRecipe({
    operations: [{ type: 'shiftRows', by: 1 }],
  }), /not supported/);
});

test('normalizeMatrixMutationRecipe rejects invalid operation parameters', () => {
  assert.throws(() => normalizeMatrixMutationRecipe({
    operations: [{ type: 'swapRows', a: 0 }],
  }), /b is required/);
  assert.throws(() => normalizeMatrixMutationRecipe({
    operations: [{ type: 'swapColumns', a: '0', b: 1 }],
  }), /safe integer/);
  assert.throws(() => normalizeMatrixMutationRecipe({
    operations: [{ type: 'reverseRow', row: {} }],
  }), /safe integer/);
  assert.throws(() => normalizeMatrixMutationRecipe({
    operations: [{ type: 'transpose', by: 1 }],
  }), /not supported/);
  assert.throws(() => normalizeMatrixMutationRecipe({
    operations: [{ type: 'transpose', typeHint: 'square' }],
  }), /not supported/);
});

test('normalizeMatrixMutationRecipe rejects unsafe integer parameters', () => {
  for (const value of [Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 1.5]) {
    assert.throws(() => normalizeMatrixMutationRecipe({
      operations: [{ type: 'rotateRows', by: value }],
    }), /safe integer/);
  }
});

test('normalizeMatrixMutationRecipe defensively clones operations and metadata', () => {
  const input = {
    operations: [{ type: 'swapRows', a: 0, b: 1 }],
    metadata: { nested: { value: 1 } },
  };
  const recipe = normalizeMatrixMutationRecipe(input);

  input.operations[0].a = 1;
  input.metadata.nested.value = 2;

  assert.deepEqual(recipe.operations, [{ type: 'swapRows', a: 0, b: 1 }]);
  assert.deepEqual(recipe.metadata, { nested: { value: 1 } });
});

test('matrixMutationRecipeCommitment is deterministic for identical recipes', () => {
  const first = normalizeMatrixMutationRecipe({
    operations: [{ type: 'swapRows', b: 1, a: 0 }],
    metadata: { b: 2, a: 1 },
  });
  const second = normalizeMatrixMutationRecipe({
    metadata: { a: 1, b: 2 },
    operations: [{ a: 0, type: 'swapRows', b: 1 }],
  });

  assert.equal(first.matrixMutationRecipeCommitment, second.matrixMutationRecipeCommitment);
  assert.equal(
    matrixMutationRecipeCommitment(first),
    matrixMutationRecipeCommitment(clone(second))
  );
});

test('matrixMutationRecipeCommitment changes when operation order changes', () => {
  const first = normalizeMatrixMutationRecipe({
    operations: [
      { type: 'swapRows', a: 0, b: 1 },
      { type: 'swapColumns', a: 0, b: 1 },
    ],
  });
  const second = normalizeMatrixMutationRecipe({
    operations: [
      { type: 'swapColumns', a: 0, b: 1 },
      { type: 'swapRows', a: 0, b: 1 },
    ],
  });

  assert.notEqual(first.matrixMutationRecipeCommitment, second.matrixMutationRecipeCommitment);
});

test('matrixMutationRecipeCommitment changes when an operation parameter changes', () => {
  const first = normalizeMatrixMutationRecipe({
    operations: [{ type: 'rotateRows', by: 1 }],
  });
  const second = normalizeMatrixMutationRecipe({
    operations: [{ type: 'rotateRows', by: 2 }],
  });

  assert.notEqual(first.matrixMutationRecipeCommitment, second.matrixMutationRecipeCommitment);
});

test('matrixMutationRecipeCommitment changes when metadata changes', () => {
  const first = normalizeMatrixMutationRecipe({
    operations: [{ type: 'transpose' }],
    metadata: { purpose: 'alpha' },
  });
  const second = normalizeMatrixMutationRecipe({
    operations: [{ type: 'transpose' }],
    metadata: { purpose: 'beta' },
  });

  assert.notEqual(first.matrixMutationRecipeCommitment, second.matrixMutationRecipeCommitment);
});

test('matrixMutationRecipeCommitment changes when declared source or target changes', () => {
  const sourceA = createMatrixKey([[1, 2], [3, 4]]);
  const sourceB = createMatrixKey([[1, 2], [3, 5]]);
  const targetA = createMatrixKey([[3, 4], [1, 2]]);
  const targetB = createMatrixKey([[4, 3], [2, 1]]);
  const operation = { type: 'swapRows', a: 0, b: 1 };

  const first = normalizeMatrixMutationRecipe({
    sourceMatrixCommitment: sourceA.matrixCommitment,
    targetMatrixCommitment: targetA.matrixCommitment,
    operations: [operation],
  });
  const differentSource = normalizeMatrixMutationRecipe({
    sourceMatrixCommitment: sourceB.matrixCommitment,
    targetMatrixCommitment: targetA.matrixCommitment,
    operations: [operation],
  });
  const differentTarget = normalizeMatrixMutationRecipe({
    sourceMatrixCommitment: sourceA.matrixCommitment,
    targetMatrixCommitment: targetB.matrixCommitment,
    operations: [operation],
  });

  assert.notEqual(first.matrixMutationRecipeCommitment, differentSource.matrixMutationRecipeCommitment);
  assert.notEqual(first.matrixMutationRecipeCommitment, differentTarget.matrixMutationRecipeCommitment);
});

test('assertMatrixMutationBounds checks current matrix shape', () => {
  assert.deepEqual(
    assertMatrixMutationBounds({ type: 'swapRows', a: 0, b: 1 }, [[1], [2]]),
    {
      rows: 2,
      columns: 1,
      operation: { type: 'swapRows', a: 0, b: 1 },
    }
  );
  assert.throws(
    () => assertMatrixMutationBounds({ type: 'reverseColumn', column: 2 }, [[1, 2], [3, 4]]),
    /range/
  );
});

test('applyMatrixMutationRecipe checks bounds dynamically after shape-changing operations', () => {
  const result = applyMatrixMutationRecipe([[1, 2, 3], [4, 5, 6]], {
    operations: [
      { type: 'transpose' },
      { type: 'swapRows', a: 0, b: 2 },
    ],
  });

  assert.deepEqual(result.matrix.values, [[3, 6], [2, 5], [1, 4]]);
  assert.throws(() => applyMatrixMutationRecipe([[1, 2, 3], [4, 5, 6]], {
    operations: [
      { type: 'transpose' },
      { type: 'reverseColumn', column: 2 },
    ],
  }), /range/);
});

test('applyMatrixMutationOperation supports swapRows', () => {
  assert.deepEqual(valuesAfter([[1, 2], [3, 4]], { type: 'swapRows', a: 0, b: 1 }), [
    [3, 4],
    [1, 2],
  ]);
});

test('applyMatrixMutationOperation supports swapColumns', () => {
  assert.deepEqual(valuesAfter([[1, 2], [3, 4]], { type: 'swapColumns', a: 0, b: 1 }), [
    [2, 1],
    [4, 3],
  ]);
});

test('applyMatrixMutationOperation supports reverseRow', () => {
  assert.deepEqual(valuesAfter([[1, 2, 3], [4, 5, 6]], { type: 'reverseRow', row: 1 }), [
    [1, 2, 3],
    [6, 5, 4],
  ]);
});

test('applyMatrixMutationOperation supports reverseColumn', () => {
  assert.deepEqual(valuesAfter([[1, 2], [3, 4], [5, 6]], { type: 'reverseColumn', column: 0 }), [
    [5, 2],
    [3, 4],
    [1, 6],
  ]);
});

test('applyMatrixMutationOperation supports rotateRows positive, negative, and large offsets', () => {
  const values = [[1, 2], [3, 4], [5, 6]];

  assert.deepEqual(valuesAfter(values, { type: 'rotateRows', by: 1 }), [[5, 6], [1, 2], [3, 4]]);
  assert.deepEqual(valuesAfter(values, { type: 'rotateRows', by: -1 }), [[3, 4], [5, 6], [1, 2]]);
  assert.deepEqual(valuesAfter(values, { type: 'rotateRows', by: 4 }), [[5, 6], [1, 2], [3, 4]]);
});

test('applyMatrixMutationOperation supports rotateColumns positive, negative, and large offsets', () => {
  const values = [[1, 2, 3], [4, 5, 6]];

  assert.deepEqual(valuesAfter(values, { type: 'rotateColumns', by: 1 }), [[3, 1, 2], [6, 4, 5]]);
  assert.deepEqual(valuesAfter(values, { type: 'rotateColumns', by: -1 }), [[2, 3, 1], [5, 6, 4]]);
  assert.deepEqual(valuesAfter(values, { type: 'rotateColumns', by: 4 }), [[3, 1, 2], [6, 4, 5]]);
});

test('applyMatrixMutationOperation supports transpose on rectangular and square matrices', () => {
  assert.deepEqual(valuesAfter([[1, 2, 3], [4, 5, 6]], { type: 'transpose' }), [
    [1, 4],
    [2, 5],
    [3, 6],
  ]);
  assert.deepEqual(valuesAfter([[1, 2], [3, 4]], { type: 'transpose' }), [
    [1, 3],
    [2, 4],
  ]);
});

test('applyMatrixMutationOperation supports flips and rotate180', () => {
  const values = [[1, 2, 3], [4, 5, 6]];

  assert.deepEqual(valuesAfter(values, { type: 'flipHorizontal' }), [[3, 2, 1], [6, 5, 4]]);
  assert.deepEqual(valuesAfter(values, { type: 'flipVertical' }), [[4, 5, 6], [1, 2, 3]]);
  assert.deepEqual(valuesAfter(values, { type: 'rotate180' }), [[6, 5, 4], [3, 2, 1]]);
});

test('applyMatrixMutationOperation supports rotate90 and rotate270 on square matrices', () => {
  const values = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];

  assert.deepEqual(valuesAfter(values, { type: 'rotate90' }), [[7, 4, 1], [8, 5, 2], [9, 6, 3]]);
  assert.deepEqual(valuesAfter(values, { type: 'rotate270' }), [[3, 6, 9], [2, 5, 8], [1, 4, 7]]);
});

test('applyMatrixMutationOperation rejects rotate90 and rotate270 on rectangular matrices', () => {
  const values = [[1, 2, 3], [4, 5, 6]];

  assert.throws(() => valuesAfter(values, { type: 'rotate90' }), /square/);
  assert.throws(() => valuesAfter(values, { type: 'rotate270' }), /square/);
});

test('applyMatrixMutationRecipe applies multiple operations in order', () => {
  const result = applyMatrixMutationRecipe([[1, 2], [3, 4]], {
    operations: [
      { type: 'swapRows', a: 0, b: 1 },
      { type: 'reverseColumn', column: 0 },
      { type: 'flipHorizontal' },
    ],
  });

  assert.deepEqual(result.matrix.values, [[4, 1], [2, 3]]);
  assert.deepEqual(result.operations, [
    { type: 'swapRows', a: 0, b: 1 },
    { type: 'reverseColumn', column: 0 },
    { type: 'flipHorizontal' },
  ]);
});

test('applyMatrixMutationRecipe rejects source commitment mismatches', () => {
  const source = createMatrixKey([[1, 2], [3, 4]]);
  const other = createMatrixKey([[1, 2], [3, 5]]);

  assert.throws(() => applyMatrixMutationRecipe(source, {
    sourceMatrixCommitment: other.matrixCommitment,
    operations: [{ type: 'transpose' }],
  }), /sourceMatrixCommitment/);
});

test('applyMatrixMutationRecipe rejects target commitment mismatches', () => {
  const wrongTarget = createMatrixKey([[1, 2], [3, 5]]);

  assert.throws(() => applyMatrixMutationRecipe([[1, 2], [3, 4]], {
    targetMatrixCommitment: wrongTarget.matrixCommitment,
    operations: [{ type: 'transpose' }],
  }), /targetMatrixCommitment/);
});

test('applyMatrixMutationRecipe returns defensive result copies', () => {
  const source = [[1, 2], [3, 4]];
  const recipe = {
    operations: [{ type: 'swapRows', a: 0, b: 1 }],
    metadata: { nested: { value: 1 } },
  };
  const result = applyMatrixMutationRecipe(source, recipe);

  source[0][0] = 99;
  recipe.operations[0].a = 1;
  recipe.metadata.nested.value = 2;

  assert.deepEqual(result.matrix.values, [[3, 4], [1, 2]]);
  assert.deepEqual(result.operations, [{ type: 'swapRows', a: 0, b: 1 }]);
  assert.deepEqual(result.metadata, { nested: { value: 1 } });
});

test('applyMatrixMutationOperation returns cloned values and does not mutate input', () => {
  const values = [[1, 2], [3, 4]];
  const result = applyMatrixMutationOperation(values, { type: 'flipHorizontal' });

  result[0][0] = 99;

  assert.deepEqual(values, [[1, 2], [3, 4]]);
  assert.deepEqual(result, [[99, 1], [4, 3]]);
});

test('matrix mutation helpers are exported through packages/core entrypoint', () => {
  assert.equal(MATRIX_MUTATE_FORMAT, 'UN-MATRIX-MUTATE');
  assert.equal(MATRIX_MUTATE_VERSION, 1);
  assert.equal(typeof normalizeMatrixMutationRecipe, 'function');
  assert.equal(typeof matrixMutationRecipePayload, 'function');
  assert.equal(typeof matrixMutationRecipeCommitment, 'function');
  assert.equal(typeof applyMatrixMutationRecipe, 'function');
  assert.equal(typeof applyMatrixMutationOperation, 'function');
  assert.equal(typeof assertMatrixMutationBounds, 'function');
});
