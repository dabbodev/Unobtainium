'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  MATRIX_COMBINE_FORMAT,
  MATRIX_COMBINE_VERSION,
  applyMatrixCombineRecipe,
  applyMatrixCombineTile,
  assertMatrixCombineBounds,
  createMatrixKey,
  matrixCombineRecipeCommitment,
  matrixCombineRecipePayload,
  normalizeMatrixCombineRecipe,
} = require('..');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function recipeWith(transform) {
  return {
    tiles: {
      a: [[1, 2], [3, 4]],
    },
    placements: [{ tile: 'a', row: 0, column: 0, transform }],
  };
}

test('normalizeMatrixCombineRecipe canonicalizes a valid simple combine recipe', () => {
  const tile = createMatrixKey([[1, 2], [3, 4]]);
  const recipe = normalizeMatrixCombineRecipe({
    tiles: { a: tile },
    placements: [{ tile: 'a', row: 0, column: 0 }],
    metadata: { b: 2, a: 1 },
  });

  assert.deepEqual(recipe, {
    format: MATRIX_COMBINE_FORMAT,
    version: MATRIX_COMBINE_VERSION,
    tiles: [{
      name: 'a',
      rows: 2,
      columns: 2,
      matrixCommitment: tile.matrixCommitment,
    }],
    placements: [{ tile: 'a', row: 0, column: 0, transform: 'identity' }],
    metadata: { a: 1, b: 2 },
    matrixCombineRecipeCommitment: recipe.matrixCombineRecipeCommitment,
  });
  assert.match(recipe.matrixCombineRecipeCommitment, /^[0-9a-f]{64}$/);
});

test('normalizeMatrixCombineRecipe accepts array tile entries with name or id', () => {
  const recipe = normalizeMatrixCombineRecipe({
    tiles: [
      { id: 'b', values: [[2]] },
      { name: 'a', matrix: [[1]] },
    ],
    placements: [
      { tile: 'a', row: 0, column: 0 },
      { tile: 'b', row: 0, column: 1 },
    ],
  });

  assert.deepEqual(recipe.tiles.map((tile) => tile.name), ['a', 'b']);
});

test('matrixCombineRecipePayload excludes runtime commitment and returns copies', () => {
  const recipe = normalizeMatrixCombineRecipe({
    tiles: { a: [[1]] },
    placements: [{ tile: 'a', row: 0, column: 0 }],
    metadata: { nested: { value: 1 } },
  });
  const payload = matrixCombineRecipePayload(recipe);

  assert.equal(Object.hasOwn(payload, 'matrixCombineRecipeCommitment'), false);
  payload.tiles[0].name = 'changed';
  payload.placements[0].row = 1;
  payload.metadata.nested.value = 2;

  assert.equal(recipe.tiles[0].name, 'a');
  assert.equal(recipe.placements[0].row, 0);
  assert.equal(recipe.metadata.nested.value, 1);
});

test('normalizeMatrixCombineRecipe rejects invalid recipe shapes', () => {
  assert.throws(() => normalizeMatrixCombineRecipe(null), /object/);
  assert.throws(() => normalizeMatrixCombineRecipe({}), /tiles/);
  assert.throws(() => normalizeMatrixCombineRecipe({ tiles: {}, placements: [] }), /at least one tile/);
  assert.throws(() => normalizeMatrixCombineRecipe({ tiles: { a: [[1]] } }), /placements/);
  assert.throws(() => normalizeMatrixCombineRecipe({
    tiles: { a: [[1]] },
    placements: [],
  }), /at least one placement/);
  assert.throws(() => normalizeMatrixCombineRecipe({
    format: 'OTHER',
    tiles: { a: [[1]] },
    placements: [{ tile: 'a', row: 0, column: 0 }],
  }), /format/);
  assert.throws(() => normalizeMatrixCombineRecipe({
    version: 99,
    tiles: { a: [[1]] },
    placements: [{ tile: 'a', row: 0, column: 0 }],
  }), /version/);
  assert.throws(() => normalizeMatrixCombineRecipe({
    tiles: [{ name: 'a', id: 'b', values: [[1]] }],
    placements: [{ tile: 'a', row: 0, column: 0 }],
  }), /name and id/);
  assert.throws(() => normalizeMatrixCombineRecipe({
    tiles: { a: [[1]] },
    placements: [{ tile: 'a', row: 0, column: 0, extra: true }],
  }), /not supported/);
});

test('normalizeMatrixCombineRecipe rejects missing or unknown tile references', () => {
  assert.throws(() => normalizeMatrixCombineRecipe({
    tiles: { a: [[1]] },
    placements: [{ row: 0, column: 0 }],
  }), /tile is required/);
  assert.throws(() => normalizeMatrixCombineRecipe({
    tiles: { a: [[1]] },
    placements: [{ tile: 'b', row: 0, column: 0 }],
  }), /unknown tile/);
});

test('normalizeMatrixCombineRecipe rejects invalid tile matrices', () => {
  assert.throws(() => normalizeMatrixCombineRecipe({
    tiles: { a: [] },
    placements: [{ tile: 'a', row: 0, column: 0 }],
  }), /row/);
  assert.throws(() => normalizeMatrixCombineRecipe({
    tiles: { a: [[1], [2, 3]] },
    placements: [{ tile: 'a', row: 0, column: 0 }],
  }), /rectangular/);
  assert.throws(() => normalizeMatrixCombineRecipe({
    tiles: { a: [[Number.MAX_SAFE_INTEGER + 1]] },
    placements: [{ tile: 'a', row: 0, column: 0 }],
  }), /safe integer/);
});

test('normalizeMatrixCombineRecipe rejects invalid placement coordinates', () => {
  const badCoordinates = [-1, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 1.5, '0'];

  for (const value of badCoordinates) {
    assert.throws(() => normalizeMatrixCombineRecipe({
      tiles: { a: [[1]] },
      placements: [{ tile: 'a', row: value, column: 0 }],
    }), /safe integer|non-negative/);
    assert.throws(() => normalizeMatrixCombineRecipe({
      tiles: { a: [[1]] },
      placements: [{ tile: 'a', row: 0, column: value }],
    }), /safe integer|non-negative/);
  }
});

test('normalizeMatrixCombineRecipe rejects unsupported transforms', () => {
  assert.throws(() => normalizeMatrixCombineRecipe({
    tiles: { a: [[1]] },
    placements: [{ tile: 'a', row: 0, column: 0, transform: 'spiral' }],
  }), /not supported/);
});

test('normalizeMatrixCombineRecipe rejects overlapping placements', () => {
  assert.throws(() => normalizeMatrixCombineRecipe({
    tiles: { a: [[1]], b: [[2]] },
    placements: [
      { tile: 'a', row: 0, column: 0 },
      { tile: 'b', row: 0, column: 0 },
    ],
  }), /overlapping/);
});

test('normalizeMatrixCombineRecipe rejects unfilled output cells', () => {
  assert.throws(() => normalizeMatrixCombineRecipe({
    tiles: { a: [[1]], b: [[2]] },
    placements: [
      { tile: 'a', row: 0, column: 0 },
      { tile: 'b', row: 0, column: 2 },
    ],
  }), /unfilled/);
  assert.throws(() => normalizeMatrixCombineRecipe({
    tiles: { a: [[1]] },
    placements: [{ tile: 'a', row: 1, column: 0 }],
  }), /unfilled/);
});

test('normalizeMatrixCombineRecipe rejects incompatible tile and transform shapes', () => {
  assert.throws(() => normalizeMatrixCombineRecipe({
    tiles: {
      a: [[1, 2]],
      b: [[3], [4]],
    },
    placements: [
      { tile: 'a', row: 0, column: 0 },
      { tile: 'b', row: 0, column: 1 },
    ],
  }), /same base shape/);
  assert.throws(() => normalizeMatrixCombineRecipe({
    tiles: { a: [[1, 2], [3, 4], [5, 6]] },
    placements: [{ tile: 'a', row: 0, column: 0, transform: 'transpose' }],
  }), /does not fit/);
});

test('matrixCombineRecipeCommitment is deterministic for equivalent input', () => {
  const first = normalizeMatrixCombineRecipe({
    tiles: { b: [[2]], a: [[1]] },
    placements: [
      { column: 0, row: 0, tile: 'a' },
      { transform: 'identity', tile: 'b', row: 0, column: 1 },
    ],
    metadata: { b: 2, a: 1 },
  });
  const second = normalizeMatrixCombineRecipe({
    metadata: { a: 1, b: 2 },
    placements: [
      { tile: 'a', row: 0, column: 0, transform: 'identity' },
      { tile: 'b', row: 0, column: 1 },
    ],
    tiles: { a: [[1]], b: [[2]] },
  });

  assert.equal(first.matrixCombineRecipeCommitment, second.matrixCombineRecipeCommitment);
  assert.equal(
    matrixCombineRecipeCommitment(first),
    matrixCombineRecipeCommitment(clone(second))
  );
});

test('matrixCombineRecipeCommitment changes when tile content changes', () => {
  const first = normalizeMatrixCombineRecipe({
    tiles: { a: [[1]] },
    placements: [{ tile: 'a', row: 0, column: 0 }],
  });
  const second = normalizeMatrixCombineRecipe({
    tiles: { a: [[2]] },
    placements: [{ tile: 'a', row: 0, column: 0 }],
  });

  assert.notEqual(first.matrixCombineRecipeCommitment, second.matrixCombineRecipeCommitment);
});

test('matrixCombineRecipeCommitment changes when tile name changes', () => {
  const first = normalizeMatrixCombineRecipe({
    tiles: { a: [[1]] },
    placements: [{ tile: 'a', row: 0, column: 0 }],
  });
  const second = normalizeMatrixCombineRecipe({
    tiles: { b: [[1]] },
    placements: [{ tile: 'b', row: 0, column: 0 }],
  });

  assert.notEqual(first.matrixCombineRecipeCommitment, second.matrixCombineRecipeCommitment);
});

test('matrixCombineRecipeCommitment changes when placement order changes', () => {
  const first = normalizeMatrixCombineRecipe({
    tiles: { a: [[1]], b: [[2]] },
    placements: [
      { tile: 'a', row: 0, column: 0 },
      { tile: 'b', row: 0, column: 1 },
    ],
  });
  const second = normalizeMatrixCombineRecipe({
    tiles: { a: [[1]], b: [[2]] },
    placements: [
      { tile: 'b', row: 0, column: 1 },
      { tile: 'a', row: 0, column: 0 },
    ],
  });

  assert.notEqual(first.matrixCombineRecipeCommitment, second.matrixCombineRecipeCommitment);
});

test('matrixCombineRecipeCommitment changes when placement coordinates change', () => {
  const first = normalizeMatrixCombineRecipe({
    tiles: { a: [[1]], b: [[2]] },
    placements: [
      { tile: 'a', row: 0, column: 0 },
      { tile: 'b', row: 0, column: 1 },
    ],
  });
  const second = normalizeMatrixCombineRecipe({
    tiles: { a: [[1]], b: [[2]] },
    placements: [
      { tile: 'a', row: 0, column: 0 },
      { tile: 'b', row: 1, column: 0 },
    ],
  });

  assert.notEqual(first.matrixCombineRecipeCommitment, second.matrixCombineRecipeCommitment);
});

test('matrixCombineRecipeCommitment changes when placement transform changes', () => {
  const first = normalizeMatrixCombineRecipe(recipeWith('identity'));
  const second = normalizeMatrixCombineRecipe(recipeWith('flipHorizontal'));

  assert.notEqual(first.matrixCombineRecipeCommitment, second.matrixCombineRecipeCommitment);
});

test('matrixCombineRecipeCommitment changes when metadata changes', () => {
  const first = normalizeMatrixCombineRecipe({
    tiles: { a: [[1]] },
    placements: [{ tile: 'a', row: 0, column: 0 }],
    metadata: { purpose: 'alpha' },
  });
  const second = normalizeMatrixCombineRecipe({
    tiles: { a: [[1]] },
    placements: [{ tile: 'a', row: 0, column: 0 }],
    metadata: { purpose: 'beta' },
  });

  assert.notEqual(first.matrixCombineRecipeCommitment, second.matrixCombineRecipeCommitment);
});

test('normalize and apply defensively clone tiles, placements, metadata, and output matrix', () => {
  const tiles = { a: [[1, 2], [3, 4]] };
  const placements = [{ tile: 'a', row: 0, column: 0 }];
  const metadata = { nested: { value: 1 } };
  const normalized = normalizeMatrixCombineRecipe({ tiles, placements, metadata });
  const result = applyMatrixCombineRecipe({ tiles, placements, metadata });

  tiles.a[0][0] = 99;
  placements[0].row = 1;
  metadata.nested.value = 2;

  assert.deepEqual(normalized.tiles[0], {
    name: 'a',
    rows: 2,
    columns: 2,
    matrixCommitment: createMatrixKey([[1, 2], [3, 4]]).matrixCommitment,
  });
  assert.deepEqual(normalized.placements, [{ tile: 'a', row: 0, column: 0, transform: 'identity' }]);
  assert.deepEqual(normalized.metadata, { nested: { value: 1 } });
  assert.deepEqual(result.matrix.values, [[1, 2], [3, 4]]);

  result.matrix.values[0][0] = 88;
  assert.deepEqual(tiles.a, [[99, 2], [3, 4]]);
});

test('applyMatrixCombineTile supports identity placement', () => {
  const values = [[1, 2], [3, 4]];
  const result = applyMatrixCombineTile(values, 'identity');

  assert.deepEqual(result, [[1, 2], [3, 4]]);
  result[0][0] = 99;
  assert.equal(values[0][0], 1);
});

test('applyMatrixCombineTile supports flipHorizontal placement', () => {
  assert.deepEqual(applyMatrixCombineTile([[1, 2], [3, 4]], 'flipHorizontal'), [
    [2, 1],
    [4, 3],
  ]);
});

test('applyMatrixCombineTile supports flipVertical placement', () => {
  assert.deepEqual(applyMatrixCombineTile([[1, 2], [3, 4]], 'flipVertical'), [
    [3, 4],
    [1, 2],
  ]);
});

test('applyMatrixCombineTile supports rotate180 placement', () => {
  assert.deepEqual(applyMatrixCombineTile([[1, 2], [3, 4]], 'rotate180'), [
    [4, 3],
    [2, 1],
  ]);
});

test('applyMatrixCombineTile supports transpose placement', () => {
  assert.deepEqual(applyMatrixCombineTile([[1, 2], [3, 4]], 'transpose'), [
    [1, 3],
    [2, 4],
  ]);
});

test('applyMatrixCombineTile supports rotate90 and rotate270 for square tiles', () => {
  const values = [[1, 2], [3, 4]];

  assert.deepEqual(applyMatrixCombineTile(values, 'rotate90'), [
    [3, 1],
    [4, 2],
  ]);
  assert.deepEqual(applyMatrixCombineTile(values, 'rotate270'), [
    [2, 4],
    [1, 3],
  ]);
});

test('applyMatrixCombineTile rejects rotate90 and rotate270 for rectangular tiles', () => {
  const values = [[1, 2, 3], [4, 5, 6]];

  assert.throws(() => applyMatrixCombineTile(values, 'rotate90'), /square/);
  assert.throws(() => applyMatrixCombineTile(values, 'rotate270'), /square/);
});

test('applyMatrixCombineRecipe assembles a 2x2 tile grid', () => {
  const result = applyMatrixCombineRecipe({
    tiles: {
      a: [[1]],
      b: [[2]],
      c: [[3]],
      d: [[4]],
    },
    placements: [
      { tile: 'a', row: 0, column: 0 },
      { tile: 'b', row: 0, column: 1 },
      { tile: 'c', row: 1, column: 0 },
      { tile: 'd', row: 1, column: 1 },
    ],
  });

  assert.deepEqual(result.matrix.values, [[1, 2], [3, 4]]);
  assert.match(result.matrix.matrixCommitment, /^[0-9a-f]{64}$/);
});

test('applyMatrixCombineRecipe assembles a 1x2 tile grid', () => {
  const result = applyMatrixCombineRecipe({
    tiles: {
      a: [[1, 2], [3, 4]],
      b: [[5, 6], [7, 8]],
    },
    placements: [
      { tile: 'a', row: 0, column: 0 },
      { tile: 'b', row: 0, column: 1, transform: 'flipHorizontal' },
    ],
  });

  assert.deepEqual(result.matrix.values, [
    [1, 2, 6, 5],
    [3, 4, 8, 7],
  ]);
});

test('applyMatrixCombineRecipe assembles a 2x1 tile grid', () => {
  const result = applyMatrixCombineRecipe({
    tiles: {
      a: [[1, 2], [3, 4]],
      b: [[5, 6], [7, 8]],
    },
    placements: [
      { tile: 'a', row: 0, column: 0 },
      { tile: 'b', row: 1, column: 0, transform: 'flipVertical' },
    ],
  });

  assert.deepEqual(result.matrix.values, [
    [1, 2],
    [3, 4],
    [7, 8],
    [5, 6],
  ]);
});

test('applyMatrixCombineRecipe applies per-placement transforms during assembly', () => {
  const result = applyMatrixCombineRecipe({
    tiles: {
      a: [[1, 2], [3, 4]],
      b: [[5, 6], [7, 8]],
    },
    placements: [
      { tile: 'a', row: 0, column: 0, transform: 'rotate180' },
      { tile: 'b', row: 0, column: 1, transform: 'rotate90' },
    ],
  });

  assert.deepEqual(result.matrix.values, [
    [4, 3, 7, 5],
    [2, 1, 8, 6],
  ]);
});

test('assertMatrixCombineBounds returns output tile and matrix dimensions', () => {
  assert.deepEqual(assertMatrixCombineBounds({
    tiles: { a: [[1, 2], [3, 4]], b: [[5, 6], [7, 8]] },
    placements: [
      { tile: 'a', row: 0, column: 0 },
      { tile: 'b', row: 0, column: 1 },
    ],
  }), {
    tileRows: 1,
    tileColumns: 2,
    cellRows: 2,
    cellColumns: 2,
    outputRows: 2,
    outputColumns: 4,
    placements: [
      { tile: 'a', row: 0, column: 0, transform: 'identity' },
      { tile: 'b', row: 0, column: 1, transform: 'identity' },
    ],
  });
});

test('matrix combine helpers are exported through packages/core entrypoint', () => {
  assert.equal(MATRIX_COMBINE_FORMAT, 'UN-MATRIX-COMBINE');
  assert.equal(MATRIX_COMBINE_VERSION, 1);
  assert.equal(typeof normalizeMatrixCombineRecipe, 'function');
  assert.equal(typeof matrixCombineRecipePayload, 'function');
  assert.equal(typeof matrixCombineRecipeCommitment, 'function');
  assert.equal(typeof applyMatrixCombineRecipe, 'function');
  assert.equal(typeof applyMatrixCombineTile, 'function');
  assert.equal(typeof assertMatrixCombineBounds, 'function');
});
