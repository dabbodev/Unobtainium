'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  MATRIX_FORMAT,
  MATRIX_VERSION,
  cloneMatrixValues,
  createMatrixKey,
  flipMatrixHorizontal,
  flipMatrixVertical,
  getMatrixColumn,
  getMatrixRow,
  matrixCommitment,
  matrixPayload,
  matrixRowsAsPoints,
  normalizeMatrix,
  rotateMatrix180,
  rotateMatrix270,
  rotateMatrix90,
  transposeMatrix,
} = require('..');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('normalizeMatrix accepts rectangular and square safe-integer matrices', () => {
  const rectangular = normalizeMatrix([[1, 2, 3], [4, 5, 6]], {
    metadata: { b: 2, a: 1 },
  });
  const square = normalizeMatrix([[1, 2], [3, 4]]);

  assert.deepEqual(rectangular, {
    format: MATRIX_FORMAT,
    version: MATRIX_VERSION,
    rows: 2,
    columns: 3,
    values: [[1, 2, 3], [4, 5, 6]],
    metadata: { a: 1, b: 2 },
  });
  assert.deepEqual(square.values, [[1, 2], [3, 4]]);
  assert.equal(square.rows, 2);
  assert.equal(square.columns, 2);
});

test('normalizeMatrix rejects invalid shapes', () => {
  assert.throws(() => normalizeMatrix(null), /object|array/);
  assert.throws(() => normalizeMatrix({ values: 'nope' }), /two-dimensional/);
  assert.throws(() => normalizeMatrix([]), /row/);
  assert.throws(() => normalizeMatrix([[]]), /column/);
  assert.throws(() => normalizeMatrix([[1], [2, 3]]), /rectangular/);
  assert.throws(() => normalizeMatrix([[1], 'row']), /row 1/);
});

test('normalizeMatrix rejects unsupported values', () => {
  const badValues = [
    Number.NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    undefined,
    {},
    '1',
    true,
    null,
  ];

  badValues.forEach((value) => {
    assert.throws(() => normalizeMatrix([[value]]), /safe integer/);
  });
});

test('normalizeMatrix and createMatrixKey defensively clone caller input', () => {
  const values = [[1, 2], [3, 4]];
  const metadata = { nested: { value: 1 } };
  const normalized = normalizeMatrix(values, { metadata });
  const key = createMatrixKey(values, { metadata });

  values[0][0] = 99;
  metadata.nested.value = 2;

  assert.deepEqual(normalized.values, [[1, 2], [3, 4]]);
  assert.deepEqual(normalized.metadata, { nested: { value: 1 } });
  assert.deepEqual(key.values, [[1, 2], [3, 4]]);
  assert.deepEqual(key.metadata, { nested: { value: 1 } });
});

test('matrixPayload excludes matrixCommitment and returns defensive copies', () => {
  const key = createMatrixKey([[1, 2], [3, 4]], {
    metadata: { purpose: 'payload' },
  });
  const payload = matrixPayload(key);

  assert.equal(Object.hasOwn(payload, 'matrixCommitment'), false);
  assert.deepEqual(payload, {
    format: MATRIX_FORMAT,
    version: MATRIX_VERSION,
    rows: 2,
    columns: 2,
    values: [[1, 2], [3, 4]],
    metadata: { purpose: 'payload' },
  });

  payload.values[0][0] = 9;
  payload.metadata.purpose = 'changed';
  assert.equal(key.values[0][0], 1);
  assert.equal(key.metadata.purpose, 'payload');
});

test('matrixCommitment is deterministic for identical matrix material', () => {
  const first = createMatrixKey([[1, 2], [3, 4]], {
    metadata: { b: 2, a: 1 },
  });
  const second = createMatrixKey([[1, 2], [3, 4]], {
    metadata: { a: 1, b: 2 },
  });

  assert.match(first.matrixCommitment, /^[0-9a-f]{64}$/);
  assert.equal(first.matrixCommitment, second.matrixCommitment);
  assert.equal(matrixCommitment(first), first.matrixCommitment);
  assert.equal(matrixCommitment(first), matrixCommitment(clone(first)));
});

test('matrixCommitment changes when values, row order, column order, or shape changes', () => {
  const base = createMatrixKey([[1, 2], [3, 4]]);

  assert.notEqual(base.matrixCommitment, createMatrixKey([[1, 2], [3, 5]]).matrixCommitment);
  assert.notEqual(base.matrixCommitment, createMatrixKey([[3, 4], [1, 2]]).matrixCommitment);
  assert.notEqual(base.matrixCommitment, createMatrixKey([[2, 1], [4, 3]]).matrixCommitment);
  assert.notEqual(base.matrixCommitment, createMatrixKey([[1, 2, 0], [3, 4, 0]]).matrixCommitment);
});

test('matrixCommitment changes when metadata changes', () => {
  const first = createMatrixKey([[1, 2]], { metadata: { purpose: 'alpha' } });
  const second = createMatrixKey([[1, 2]], { metadata: { purpose: 'beta' } });

  assert.notEqual(first.matrixCommitment, second.matrixCommitment);
});

test('cloneMatrixValues deep-clones matrix values', () => {
  const values = [[1, 2], [3, 4]];
  const cloned = cloneMatrixValues(values);

  cloned[0][0] = 99;
  assert.deepEqual(values, [[1, 2], [3, 4]]);
});

test('row and column accessors return copies and reject out-of-range indexes', () => {
  const key = createMatrixKey([[1, 2, 3], [4, 5, 6]]);
  const row = getMatrixRow(key, 1);
  const column = getMatrixColumn(key, 2);

  assert.deepEqual(row, [4, 5, 6]);
  assert.deepEqual(column, [3, 6]);

  row[0] = 99;
  column[0] = 88;
  assert.deepEqual(key.values, [[1, 2, 3], [4, 5, 6]]);

  assert.throws(() => getMatrixRow(key, -1), /range/);
  assert.throws(() => getMatrixRow(key, 2), /range/);
  assert.throws(() => getMatrixRow(key, 1.5), /integer/);
  assert.throws(() => getMatrixColumn(key, -1), /range/);
  assert.throws(() => getMatrixColumn(key, 3), /range/);
  assert.throws(() => getMatrixColumn(key, 1.5), /integer/);
});

test('transposeMatrix supports rectangular and square matrices', () => {
  assert.deepEqual(transposeMatrix([[1, 2, 3], [4, 5, 6]]), [[1, 4], [2, 5], [3, 6]]);
  assert.deepEqual(transposeMatrix([[1, 2], [3, 4]]), [[1, 3], [2, 4]]);
});

test('flip and 180 rotation helpers return transformed copies', () => {
  const values = [[1, 2, 3], [4, 5, 6]];

  assert.deepEqual(flipMatrixHorizontal(values), [[3, 2, 1], [6, 5, 4]]);
  assert.deepEqual(flipMatrixVertical(values), [[4, 5, 6], [1, 2, 3]]);
  assert.deepEqual(rotateMatrix180(values), [[6, 5, 4], [3, 2, 1]]);
  assert.deepEqual(values, [[1, 2, 3], [4, 5, 6]]);
});

test('rotateMatrix90 and rotateMatrix270 support square matrices', () => {
  const values = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];

  assert.deepEqual(rotateMatrix90(values), [[7, 4, 1], [8, 5, 2], [9, 6, 3]]);
  assert.deepEqual(rotateMatrix270(values), [[3, 6, 9], [2, 5, 8], [1, 4, 7]]);
});

test('rotateMatrix90 and rotateMatrix270 reject rectangular matrices', () => {
  const values = [[1, 2, 3], [4, 5, 6]];

  assert.throws(() => rotateMatrix90(values), /square/);
  assert.throws(() => rotateMatrix270(values), /square/);
});

test('matrixRowsAsPoints returns ordered N-dimensional row copies', () => {
  const key = createMatrixKey([[1, 2, 3, 4], [5, 6, 7, 8]]);
  const points = matrixRowsAsPoints(key);

  assert.deepEqual(points, [[1, 2, 3, 4], [5, 6, 7, 8]]);
  points[0][0] = 99;
  assert.equal(key.values[0][0], 1);
});

test('matrix helpers are exported through packages/core entrypoint', () => {
  assert.equal(MATRIX_FORMAT, 'UN-MATRIX');
  assert.equal(MATRIX_VERSION, 1);
  assert.equal(typeof normalizeMatrix, 'function');
  assert.equal(typeof createMatrixKey, 'function');
  assert.equal(typeof matrixPayload, 'function');
  assert.equal(typeof matrixCommitment, 'function');
  assert.equal(typeof cloneMatrixValues, 'function');
  assert.equal(typeof getMatrixRow, 'function');
  assert.equal(typeof getMatrixColumn, 'function');
  assert.equal(typeof transposeMatrix, 'function');
  assert.equal(typeof flipMatrixHorizontal, 'function');
  assert.equal(typeof flipMatrixVertical, 'function');
  assert.equal(typeof rotateMatrix180, 'function');
  assert.equal(typeof rotateMatrix90, 'function');
  assert.equal(typeof rotateMatrix270, 'function');
  assert.equal(typeof matrixRowsAsPoints, 'function');
});
