'use strict';

const crypto = require('node:crypto');

const {
  cloneMatrixValues,
  createMatrixKey,
  flipMatrixHorizontal,
  flipMatrixVertical,
  matrixCommitment,
  matrixPayload,
  rotateMatrix180,
  rotateMatrix270,
  rotateMatrix90,
  transposeMatrix,
} = require('./matrix');
const { stableStringify } = require('./stack-canonical');

const MATRIX_MUTATE_FORMAT = 'UN-MATRIX-MUTATE';
const MATRIX_MUTATE_VERSION = 1;
const MATRIX_MUTATE_COMMITMENT_DOMAIN = 'UN-MATRIX-MUTATE:v1';

const OPERATION_FIELDS = {
  swapRows: ['a', 'b'],
  swapColumns: ['a', 'b'],
  reverseRow: ['row'],
  reverseColumn: ['column'],
  rotateRows: ['by'],
  rotateColumns: ['by'],
  transpose: [],
  flipHorizontal: [],
  flipVertical: [],
  rotate180: [],
  rotate90: [],
  rotate270: [],
};

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

function assertCommitment(value, fieldName) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
    throw new TypeError(`${fieldName} must be a lowercase SHA-256 hex commitment`);
  }

  return value;
}

function commitmentFromMatrixOrValue(recipe, options, matrixField, commitmentField) {
  const explicitCommitment = options[commitmentField] === undefined
    ? recipe[commitmentField]
    : options[commitmentField];
  const normalizedExplicitCommitment = assertCommitment(explicitCommitment, commitmentField);

  if (options[matrixField] !== undefined) {
    const computedCommitment = matrixCommitment(options[matrixField]);
    if (
      normalizedExplicitCommitment !== null
      && normalizedExplicitCommitment !== computedCommitment
    ) {
      throw new RangeError(`${commitmentField} does not match ${matrixField}`);
    }
    return computedCommitment;
  }
  if (recipe[matrixField] !== undefined) {
    const computedCommitment = matrixCommitment(recipe[matrixField]);
    if (
      normalizedExplicitCommitment !== null
      && normalizedExplicitCommitment !== computedCommitment
    ) {
      throw new RangeError(`${commitmentField} does not match ${matrixField}`);
    }
    return computedCommitment;
  }

  return normalizedExplicitCommitment;
}

function normalizeMatrixMutationOperation(operation) {
  assertObject(operation, 'matrix mutation operation');
  assertOwnField(operation, 'type');

  const { type } = operation;
  if (typeof type !== 'string' || !Object.hasOwn(OPERATION_FIELDS, type)) {
    throw new TypeError('matrix mutation operation type is not supported');
  }

  const allowedFields = new Set(['type', ...OPERATION_FIELDS[type]]);
  for (const fieldName of Object.keys(operation)) {
    if (!allowedFields.has(fieldName)) {
      throw new TypeError(`${fieldName} is not supported for ${type}`);
    }
  }

  const normalized = { type };
  for (const fieldName of OPERATION_FIELDS[type]) {
    assertOwnField(operation, fieldName);
    normalized[fieldName] = normalizeSafeInteger(operation[fieldName], fieldName);
  }

  return normalized;
}

function normalizeOperations(operations) {
  if (!Array.isArray(operations)) {
    throw new TypeError('operations must be an array');
  }
  if (operations.length === 0) {
    throw new RangeError('matrix mutation recipe must contain at least one operation');
  }

  return operations.map((operation) => normalizeMatrixMutationOperation(operation));
}

function normalizeMatrixMutationRecipe(input, options = {}) {
  assertObject(input, 'matrix mutation recipe');
  if (input.format !== undefined && input.format !== MATRIX_MUTATE_FORMAT) {
    throw new TypeError('matrix mutation recipe format is not UN-MATRIX-MUTATE');
  }
  if (input.version !== undefined && input.version !== MATRIX_MUTATE_VERSION) {
    throw new TypeError('matrix mutation recipe version is not supported');
  }
  assertOwnField(input, 'operations');

  const payload = {
    format: MATRIX_MUTATE_FORMAT,
    version: MATRIX_MUTATE_VERSION,
    sourceMatrixCommitment: commitmentFromMatrixOrValue(
      input,
      options,
      'sourceMatrix',
      'sourceMatrixCommitment'
    ),
    targetMatrixCommitment: commitmentFromMatrixOrValue(
      input,
      options,
      'targetMatrix',
      'targetMatrixCommitment'
    ),
    operations: normalizeOperations(input.operations),
    metadata: cloneCanonicalValue(
      options.metadata === undefined
        ? (input.metadata === undefined ? {} : input.metadata)
        : options.metadata,
      'metadata'
    ),
  };

  return {
    ...payload,
    matrixMutationRecipeCommitment: matrixMutationRecipeCommitment(payload),
  };
}

function matrixMutationRecipePayload(recipeLike) {
  const recipe = normalizeMatrixMutationRecipe(recipeLike);

  return {
    format: recipe.format,
    version: recipe.version,
    sourceMatrixCommitment: recipe.sourceMatrixCommitment,
    targetMatrixCommitment: recipe.targetMatrixCommitment,
    operations: recipe.operations.map((operation) => ({ ...operation })),
    metadata: cloneCanonicalValue(recipe.metadata, 'metadata'),
  };
}

function matrixMutationRecipeCommitment(recipeLike) {
  return crypto
    .createHash('sha256')
    .update(MATRIX_MUTATE_COMMITMENT_DOMAIN)
    .update(Buffer.from([0]))
    .update(stableStringify(matrixMutationRecipePayloadObject(recipeLike)))
    .digest('hex');
}

function matrixMutationRecipePayloadObject(recipeLike) {
  assertObject(recipeLike, 'matrix mutation recipe');
  if (recipeLike.format !== undefined && recipeLike.format !== MATRIX_MUTATE_FORMAT) {
    throw new TypeError('matrix mutation recipe format is not UN-MATRIX-MUTATE');
  }
  if (recipeLike.version !== undefined && recipeLike.version !== MATRIX_MUTATE_VERSION) {
    throw new TypeError('matrix mutation recipe version is not supported');
  }
  assertOwnField(recipeLike, 'operations');

  return {
    format: MATRIX_MUTATE_FORMAT,
    version: MATRIX_MUTATE_VERSION,
    sourceMatrixCommitment: assertCommitment(
      recipeLike.sourceMatrixCommitment,
      'sourceMatrixCommitment'
    ),
    targetMatrixCommitment: assertCommitment(
      recipeLike.targetMatrixCommitment,
      'targetMatrixCommitment'
    ),
    operations: normalizeOperations(recipeLike.operations),
    metadata: cloneCanonicalValue(
      recipeLike.metadata === undefined ? {} : recipeLike.metadata,
      'metadata'
    ),
  };
}

function assertIndex(index, limit, fieldName) {
  if (!Number.isSafeInteger(index)) {
    throw new TypeError(`${fieldName} must be a safe integer`);
  }
  if (index < 0 || index >= limit) {
    throw new RangeError(`${fieldName} is out of range`);
  }
}

function assertSquare(values, type) {
  if (values.length !== values[0].length) {
    throw new RangeError(`${type} requires a square matrix`);
  }
}

function matrixValueSet(matrixLike) {
  if (Array.isArray(matrixLike)) {
    return cloneMatrixValues(matrixLike);
  }

  return matrixPayload(matrixLike).values;
}

function assertMatrixMutationBounds(operationLike, matrixLike) {
  const operation = normalizeMatrixMutationOperation(operationLike);
  const values = matrixValueSet(matrixLike);
  const rows = values.length;
  const columns = values[0].length;

  switch (operation.type) {
    case 'swapRows':
      assertIndex(operation.a, rows, 'a');
      assertIndex(operation.b, rows, 'b');
      break;
    case 'swapColumns':
      assertIndex(operation.a, columns, 'a');
      assertIndex(operation.b, columns, 'b');
      break;
    case 'reverseRow':
      assertIndex(operation.row, rows, 'row');
      break;
    case 'reverseColumn':
      assertIndex(operation.column, columns, 'column');
      break;
    case 'rotate90':
    case 'rotate270':
      assertSquare(values, operation.type);
      break;
    default:
      break;
  }

  return { rows, columns, operation };
}

function rotateSequence(sequence, by) {
  const length = sequence.length;
  const offset = ((by % length) + length) % length;
  if (offset === 0) {
    return sequence.map((entry) => (Array.isArray(entry) ? entry.slice() : entry));
  }

  return sequence.slice(length - offset).concat(sequence.slice(0, length - offset));
}

function swapRows(values, a, b) {
  const next = cloneMatrixValues(values);
  const row = next[a];
  next[a] = next[b];
  next[b] = row;
  return next;
}

function swapColumns(values, a, b) {
  return values.map((row) => {
    const next = row.slice();
    const value = next[a];
    next[a] = next[b];
    next[b] = value;
    return next;
  });
}

function reverseColumn(values, column) {
  const next = cloneMatrixValues(values);
  const columnValues = next.map((row) => row[column]).reverse();
  return next.map((row, rowIndex) => {
    const clonedRow = row.slice();
    clonedRow[column] = columnValues[rowIndex];
    return clonedRow;
  });
}

function rotateColumns(values, by) {
  const transposed = transposeMatrix(values);
  return transposeMatrix(rotateSequence(transposed, by));
}

function applyMatrixMutationOperation(matrixLike, operationLike) {
  const values = matrixValueSet(matrixLike);
  const { operation } = assertMatrixMutationBounds(operationLike, values);

  switch (operation.type) {
    case 'swapRows':
      return swapRows(values, operation.a, operation.b);
    case 'swapColumns':
      return swapColumns(values, operation.a, operation.b);
    case 'reverseRow':
      return values.map((row, rowIndex) => (
        rowIndex === operation.row ? row.slice().reverse() : row.slice()
      ));
    case 'reverseColumn':
      return reverseColumn(values, operation.column);
    case 'rotateRows':
      return rotateSequence(values, operation.by);
    case 'rotateColumns':
      return rotateColumns(values, operation.by);
    case 'transpose':
      return transposeMatrix(values);
    case 'flipHorizontal':
      return flipMatrixHorizontal(values);
    case 'flipVertical':
      return flipMatrixVertical(values);
    case 'rotate180':
      return rotateMatrix180(values);
    case 'rotate90':
      return rotateMatrix90(values);
    case 'rotate270':
      return rotateMatrix270(values);
    default:
      throw new TypeError('matrix mutation operation type is not supported');
  }
}

function applyMatrixMutationRecipe(sourceMatrixLike, recipeLike, options = {}) {
  const sourceMatrix = createMatrixKey(sourceMatrixLike);
  const recipe = normalizeMatrixMutationRecipe(recipeLike);

  if (
    recipe.sourceMatrixCommitment !== null
    && recipe.sourceMatrixCommitment !== sourceMatrix.matrixCommitment
  ) {
    throw new RangeError('sourceMatrixCommitment does not match source matrix');
  }

  let values = cloneMatrixValues(sourceMatrix.values);
  for (const operation of recipe.operations) {
    values = applyMatrixMutationOperation(values, operation);
  }

  const targetMatrix = createMatrixKey(values, {
    metadata: options.targetMetadata === undefined
      ? sourceMatrix.metadata
      : options.targetMetadata,
  });

  if (
    recipe.targetMatrixCommitment !== null
    && recipe.targetMatrixCommitment !== targetMatrix.matrixCommitment
  ) {
    throw new RangeError('targetMatrixCommitment does not match target matrix');
  }

  const appliedRecipe = normalizeMatrixMutationRecipe({
    operations: recipe.operations,
    metadata: recipe.metadata,
    sourceMatrixCommitment: sourceMatrix.matrixCommitment,
    targetMatrixCommitment: targetMatrix.matrixCommitment,
  });

  return {
    ...appliedRecipe,
    matrix: targetMatrix,
  };
}

module.exports = {
  MATRIX_MUTATE_FORMAT,
  MATRIX_MUTATE_VERSION,
  normalizeMatrixMutationRecipe,
  matrixMutationRecipePayload,
  matrixMutationRecipeCommitment,
  applyMatrixMutationRecipe,
  applyMatrixMutationOperation,
  assertMatrixMutationBounds,
};
