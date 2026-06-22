'use strict';

const crypto = require('node:crypto');

const { stableStringify } = require('./stack-canonical');

const MATRIX_FORMAT = 'UN-MATRIX';
const MATRIX_VERSION = 1;
const MATRIX_COMMITMENT_DOMAIN = 'UN-MATRIX:v1';

function assertObject(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function assertOwnField(value, fieldName) {
  if (!Object.hasOwn(value, fieldName)) {
    throw new TypeError(`${fieldName} is required`);
  }
}

function cloneCanonicalValue(value, fieldName) {
  try {
    return JSON.parse(stableStringify(value));
  } catch (error) {
    error.message = `${fieldName} must be canonical plain data: ${error.message}`;
    throw error;
  }
}

function normalizeSafeInteger(value, fieldName) {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${fieldName} must be a safe integer`);
  }

  return Object.is(value, -0) ? 0 : value;
}

function cloneMatrixValues(values) {
  if (!Array.isArray(values)) {
    throw new TypeError('matrix values must be a two-dimensional array');
  }
  if (values.length === 0) {
    throw new RangeError('matrix must contain at least one row');
  }

  let columnCount;
  return values.map((row, rowIndex) => {
    if (!Array.isArray(row)) {
      throw new TypeError(`matrix row ${rowIndex} must be an array`);
    }
    if (row.length === 0) {
      throw new RangeError('matrix rows must contain at least one column');
    }
    if (columnCount === undefined) {
      columnCount = row.length;
    } else if (row.length !== columnCount) {
      throw new RangeError('matrix rows must be rectangular');
    }

    return row.map((value, columnIndex) => (
      normalizeSafeInteger(value, `matrix[${rowIndex}][${columnIndex}]`)
    ));
  });
}

function valuesAndMetadata(input, options = {}) {
  if (Array.isArray(input)) {
    return {
      values: input,
      metadata: options.metadata === undefined ? {} : options.metadata,
    };
  }

  assertObject(input, 'matrix');
  assertOwnField(input, 'values');

  return {
    values: input.values,
    metadata: options.metadata === undefined
      ? (input.metadata === undefined ? {} : input.metadata)
      : options.metadata,
  };
}

function normalizeMatrix(input, options = {}) {
  const material = valuesAndMetadata(input, options);
  const values = cloneMatrixValues(material.values);
  const rowCount = values.length;
  const columnCount = values[0].length;

  return {
    format: MATRIX_FORMAT,
    version: MATRIX_VERSION,
    rows: rowCount,
    columns: columnCount,
    values,
    metadata: cloneCanonicalValue(material.metadata, 'metadata'),
  };
}

function matrixPayload(matrixLike) {
  const matrix = Array.isArray(matrixLike) ? normalizeMatrix(matrixLike) : matrixLike;
  assertObject(matrix, 'matrix');

  for (const fieldName of ['format', 'version', 'rows', 'columns', 'values', 'metadata']) {
    assertOwnField(matrix, fieldName);
  }

  if (matrix.format !== MATRIX_FORMAT) {
    throw new TypeError('matrix format is not UN-MATRIX');
  }
  if (matrix.version !== MATRIX_VERSION) {
    throw new TypeError('matrix version is not supported');
  }

  const values = cloneMatrixValues(matrix.values);
  if (!Number.isSafeInteger(matrix.rows) || matrix.rows !== values.length) {
    throw new RangeError('matrix rows must match values length');
  }
  if (!Number.isSafeInteger(matrix.columns) || matrix.columns !== values[0].length) {
    throw new RangeError('matrix columns must match values width');
  }

  return {
    format: matrix.format,
    version: matrix.version,
    rows: matrix.rows,
    columns: matrix.columns,
    values,
    metadata: cloneCanonicalValue(matrix.metadata, 'metadata'),
  };
}

function matrixCommitment(matrixLike) {
  return crypto
    .createHash('sha256')
    .update(MATRIX_COMMITMENT_DOMAIN)
    .update(Buffer.from([0]))
    .update(stableStringify(matrixPayload(matrixLike)))
    .digest('hex');
}

function createMatrixKey(input, options = {}) {
  const payload = normalizeMatrix(input, options);

  return {
    ...payload,
    matrixCommitment: matrixCommitment(payload),
  };
}

function matrixValues(matrixLike) {
  if (Array.isArray(matrixLike)) {
    return cloneMatrixValues(matrixLike);
  }

  return matrixPayload(matrixLike).values;
}

function assertIndex(index, limit, name) {
  if (!Number.isInteger(index)) {
    throw new TypeError(`${name} must be an integer`);
  }
  if (index < 0 || index >= limit) {
    throw new RangeError(`${name} is out of range`);
  }
}

function getMatrixRow(matrixLike, rowIndex) {
  const values = matrixValues(matrixLike);
  assertIndex(rowIndex, values.length, 'rowIndex');

  return values[rowIndex].slice();
}

function getMatrixColumn(matrixLike, columnIndex) {
  const values = matrixValues(matrixLike);
  assertIndex(columnIndex, values[0].length, 'columnIndex');

  return values.map((row) => row[columnIndex]);
}

function transposeMatrix(matrixLike) {
  const values = matrixValues(matrixLike);

  return values[0].map((_, columnIndex) => values.map((row) => row[columnIndex]));
}

function flipMatrixHorizontal(matrixLike) {
  return matrixValues(matrixLike).map((row) => row.slice().reverse());
}

function flipMatrixVertical(matrixLike) {
  return matrixValues(matrixLike).slice().reverse();
}

function rotateMatrix180(matrixLike) {
  return flipMatrixVertical(flipMatrixHorizontal(matrixLike));
}

function assertSquare(values) {
  if (values.length !== values[0].length) {
    throw new RangeError('matrix must be square for this rotation');
  }
}

function rotateMatrix90(matrixLike) {
  const values = matrixValues(matrixLike);
  assertSquare(values);

  return transposeMatrix(values).map((row) => row.reverse());
}

function rotateMatrix270(matrixLike) {
  const values = matrixValues(matrixLike);
  assertSquare(values);

  return transposeMatrix(values).reverse();
}

function matrixRowsAsPoints(matrixLike) {
  return matrixValues(matrixLike).map((row) => row.slice());
}

module.exports = {
  MATRIX_FORMAT,
  MATRIX_VERSION,
  normalizeMatrix,
  createMatrixKey,
  matrixPayload,
  matrixCommitment,
  cloneMatrixValues,
  getMatrixRow,
  getMatrixColumn,
  transposeMatrix,
  flipMatrixHorizontal,
  flipMatrixVertical,
  rotateMatrix180,
  rotateMatrix90,
  rotateMatrix270,
  matrixRowsAsPoints,
};
