'use strict';

const crypto = require('node:crypto');

const {
  cloneMatrixValues,
  createMatrixKey,
  flipMatrixHorizontal,
  flipMatrixVertical,
  matrixPayload,
  rotateMatrix180,
  rotateMatrix270,
  rotateMatrix90,
  transposeMatrix,
} = require('./matrix');
const { stableStringify } = require('./stack-canonical');

const MATRIX_COMBINE_FORMAT = 'UN-MATRIX-COMBINE';
const MATRIX_COMBINE_VERSION = 1;
const MATRIX_COMBINE_COMMITMENT_DOMAIN = 'UN-MATRIX-COMBINE:v1';

const SUPPORTED_TRANSFORMS = new Set([
  'identity',
  'flipHorizontal',
  'flipVertical',
  'rotate180',
  'transpose',
  'rotate90',
  'rotate270',
]);

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

function normalizeTileName(value, fieldName) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }

  return value;
}

function normalizePlacementIndex(value, fieldName) {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${fieldName} must be a safe integer`);
  }
  if (value < 0) {
    throw new RangeError(`${fieldName} must be non-negative`);
  }

  return Object.is(value, -0) ? 0 : value;
}

function assertCommitment(value, fieldName) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
    throw new TypeError(`${fieldName} must be a lowercase SHA-256 hex commitment`);
  }

  return value;
}

function normalizePositiveDimension(value, fieldName) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${fieldName} must be a positive safe integer`);
  }

  return value;
}

function normalizeTransform(value) {
  const transform = value === undefined ? 'identity' : value;
  if (typeof transform !== 'string' || !SUPPORTED_TRANSFORMS.has(transform)) {
    throw new TypeError('placement transform is not supported');
  }

  return transform;
}

function matrixValuesFromLike(matrixLike) {
  if (Array.isArray(matrixLike)) {
    return cloneMatrixValues(matrixLike);
  }

  return matrixPayload(matrixLike).values;
}

function hasDescriptorShape(value) {
  return (
    value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.hasOwn(value, 'matrixCommitment')
    && Object.hasOwn(value, 'rows')
    && Object.hasOwn(value, 'columns')
    && !Object.hasOwn(value, 'values')
    && !Object.hasOwn(value, 'matrix')
  );
}

function matrixKeyFromLike(matrixLike, fieldName) {
  const key = createMatrixKey(matrixLike);
  if (
    matrixLike !== null
    && typeof matrixLike === 'object'
    && !Array.isArray(matrixLike)
    && matrixLike.matrixCommitment !== undefined
    && matrixLike.matrixCommitment !== key.matrixCommitment
  ) {
    throw new RangeError(`${fieldName} matrixCommitment does not match tile matrix`);
  }

  return key;
}

function normalizeDescriptorTile(name, tileLike) {
  return {
    name,
    rows: normalizePositiveDimension(tileLike.rows, `${name}.rows`),
    columns: normalizePositiveDimension(tileLike.columns, `${name}.columns`),
    matrixCommitment: assertCommitment(
      tileLike.matrixCommitment,
      `${name}.matrixCommitment`
    ),
  };
}

function normalizeMaterialTile(name, tileLike, fieldName) {
  const key = matrixKeyFromLike(tileLike, fieldName);

  return {
    descriptor: {
      name,
      rows: key.rows,
      columns: key.columns,
      matrixCommitment: key.matrixCommitment,
    },
    values: cloneMatrixValues(key.values),
  };
}

function normalizeTileEntry(name, tileLike, options) {
  if (hasDescriptorShape(tileLike)) {
    if (options.requireValues) {
      throw new TypeError(`${name} tile values are required to apply a combine recipe`);
    }

    return {
      descriptor: normalizeDescriptorTile(name, tileLike),
      values: null,
    };
  }

  return normalizeMaterialTile(name, tileLike, name);
}

function tileMaterialFromArrayEntry(entry, index) {
  assertObject(entry, `tiles[${index}]`);
  const hasName = Object.hasOwn(entry, 'name');
  const hasId = Object.hasOwn(entry, 'id');
  if (!hasName && !hasId) {
    throw new TypeError(`tiles[${index}] must include name or id`);
  }

  const name = normalizeTileName(hasName ? entry.name : entry.id, `tiles[${index}].name`);
  if (hasName && hasId && entry.name !== entry.id) {
    throw new RangeError(`tiles[${index}] name and id must match when both are supplied`);
  }

  if (Object.hasOwn(entry, 'matrix')) {
    return { name, tileLike: entry.matrix };
  }

  return { name, tileLike: entry };
}

function normalizeTiles(tiles, options = {}) {
  const entries = [];

  if (Array.isArray(tiles)) {
    if (tiles.length === 0) {
      throw new RangeError('tiles must contain at least one tile');
    }
    for (let index = 0; index < tiles.length; index += 1) {
      const { name, tileLike } = tileMaterialFromArrayEntry(tiles[index], index);
      entries.push(normalizeTileEntry(name, tileLike, options));
    }
  } else {
    assertObject(tiles, 'tiles');
    const names = Object.keys(tiles);
    if (names.length === 0) {
      throw new RangeError('tiles must contain at least one tile');
    }
    for (const name of names) {
      const normalizedName = normalizeTileName(name, 'tile name');
      entries.push(normalizeTileEntry(normalizedName, tiles[name], options));
    }
  }

  const names = new Set();
  for (const entry of entries) {
    if (names.has(entry.descriptor.name)) {
      throw new RangeError(`duplicate tile name: ${entry.descriptor.name}`);
    }
    names.add(entry.descriptor.name);
  }

  entries.sort((a, b) => a.descriptor.name.localeCompare(b.descriptor.name));
  return {
    descriptors: entries.map((entry) => ({ ...entry.descriptor })),
    valuesByName: new Map(entries.map((entry) => [
      entry.descriptor.name,
      entry.values === null ? null : cloneMatrixValues(entry.values),
    ])),
  };
}

function normalizePlacement(placement) {
  assertObject(placement, 'placement');
  for (const fieldName of Object.keys(placement)) {
    if (!['tile', 'row', 'column', 'transform'].includes(fieldName)) {
      throw new TypeError(`${fieldName} is not supported for placement`);
    }
  }
  assertOwnField(placement, 'tile');
  assertOwnField(placement, 'row');
  assertOwnField(placement, 'column');

  return {
    tile: normalizeTileName(placement.tile, 'placement tile'),
    row: normalizePlacementIndex(placement.row, 'row'),
    column: normalizePlacementIndex(placement.column, 'column'),
    transform: normalizeTransform(placement.transform),
  };
}

function normalizePlacements(placements) {
  if (!Array.isArray(placements)) {
    throw new TypeError('placements must be an array');
  }
  if (placements.length === 0) {
    throw new RangeError('placements must contain at least one placement');
  }

  return placements.map((placement) => normalizePlacement(placement));
}

function transformedShape(tile, transform) {
  switch (transform) {
    case 'identity':
    case 'flipHorizontal':
    case 'flipVertical':
    case 'rotate180':
      return { rows: tile.rows, columns: tile.columns };
    case 'transpose':
      return { rows: tile.columns, columns: tile.rows };
    case 'rotate90':
    case 'rotate270':
      if (tile.rows !== tile.columns) {
        throw new RangeError(`${transform} requires a square tile`);
      }
      return { rows: tile.rows, columns: tile.columns };
    default:
      throw new TypeError('placement transform is not supported');
  }
}

function validateRecipeShape(tileDescriptors, placements) {
  const tileByName = new Map(tileDescriptors.map((tile) => [tile.name, tile]));
  const [firstTile] = tileDescriptors;
  const cellRows = firstTile.rows;
  const cellColumns = firstTile.columns;

  for (const tile of tileDescriptors) {
    if (tile.rows !== cellRows || tile.columns !== cellColumns) {
      throw new RangeError('all source tiles must have the same base shape');
    }
  }

  let maxRow = -1;
  let maxColumn = -1;
  const occupied = new Set();

  for (const placement of placements) {
    const tile = tileByName.get(placement.tile);
    if (tile === undefined) {
      throw new RangeError(`unknown tile reference: ${placement.tile}`);
    }

    const cellKey = `${placement.row}:${placement.column}`;
    if (occupied.has(cellKey)) {
      throw new RangeError(`overlapping placement at ${cellKey}`);
    }
    occupied.add(cellKey);

    const shape = transformedShape(tile, placement.transform);
    if (shape.rows !== cellRows || shape.columns !== cellColumns) {
      throw new RangeError('transformed tile shape does not fit output cell shape');
    }

    maxRow = Math.max(maxRow, placement.row);
    maxColumn = Math.max(maxColumn, placement.column);
  }

  for (let row = 0; row <= maxRow; row += 1) {
    for (let column = 0; column <= maxColumn; column += 1) {
      if (!occupied.has(`${row}:${column}`)) {
        throw new RangeError(`unfilled output cell at ${row}:${column}`);
      }
    }
  }

  return {
    tileRows: maxRow + 1,
    tileColumns: maxColumn + 1,
    cellRows,
    cellColumns,
    outputRows: (maxRow + 1) * cellRows,
    outputColumns: (maxColumn + 1) * cellColumns,
  };
}

function matrixCombineRecipePayloadObject(recipeLike) {
  assertObject(recipeLike, 'matrix combine recipe');
  if (
    recipeLike.format !== undefined
    && recipeLike.format !== MATRIX_COMBINE_FORMAT
  ) {
    throw new TypeError('matrix combine recipe format is not UN-MATRIX-COMBINE');
  }
  if (
    recipeLike.version !== undefined
    && recipeLike.version !== MATRIX_COMBINE_VERSION
  ) {
    throw new TypeError('matrix combine recipe version is not supported');
  }
  assertOwnField(recipeLike, 'tiles');
  assertOwnField(recipeLike, 'placements');

  const tiles = normalizeTiles(recipeLike.tiles);
  const placements = normalizePlacements(recipeLike.placements);
  validateRecipeShape(tiles.descriptors, placements);

  return {
    format: MATRIX_COMBINE_FORMAT,
    version: MATRIX_COMBINE_VERSION,
    tiles: tiles.descriptors.map((tile) => ({ ...tile })),
    placements: placements.map((placement) => ({ ...placement })),
    metadata: cloneCanonicalValue(
      recipeLike.metadata === undefined ? {} : recipeLike.metadata,
      'metadata'
    ),
  };
}

function matrixCombineRecipeCommitment(recipeLike) {
  return crypto
    .createHash('sha256')
    .update(MATRIX_COMBINE_COMMITMENT_DOMAIN)
    .update(Buffer.from([0]))
    .update(stableStringify(matrixCombineRecipePayloadObject(recipeLike)))
    .digest('hex');
}

function normalizeMatrixCombineRecipe(input) {
  const payload = matrixCombineRecipePayloadObject(input);

  return {
    ...payload,
    matrixCombineRecipeCommitment: matrixCombineRecipeCommitment(payload),
  };
}

function matrixCombineRecipePayload(recipeLike) {
  const payload = matrixCombineRecipePayloadObject(recipeLike);

  return {
    format: payload.format,
    version: payload.version,
    tiles: payload.tiles.map((tile) => ({ ...tile })),
    placements: payload.placements.map((placement) => ({ ...placement })),
    metadata: cloneCanonicalValue(payload.metadata, 'metadata'),
  };
}

function applyMatrixCombineTile(tileLike, transform = 'identity') {
  const normalizedTransform = normalizeTransform(transform);
  const values = matrixValuesFromLike(tileLike);

  switch (normalizedTransform) {
    case 'identity':
      return cloneMatrixValues(values);
    case 'flipHorizontal':
      return flipMatrixHorizontal(values);
    case 'flipVertical':
      return flipMatrixVertical(values);
    case 'rotate180':
      return rotateMatrix180(values);
    case 'transpose':
      return transposeMatrix(values);
    case 'rotate90':
      return rotateMatrix90(values);
    case 'rotate270':
      return rotateMatrix270(values);
    default:
      throw new TypeError('placement transform is not supported');
  }
}

function assertMatrixCombineBounds(recipeLike) {
  const payload = matrixCombineRecipePayloadObject(recipeLike);
  const bounds = validateRecipeShape(payload.tiles, payload.placements);

  return {
    ...bounds,
    placements: payload.placements.map((placement) => ({ ...placement })),
  };
}

function applyMatrixCombineRecipe(recipeLike, options = {}) {
  assertObject(recipeLike, 'matrix combine recipe');
  const normalized = normalizeMatrixCombineRecipe(recipeLike);
  const tiles = normalizeTiles(recipeLike.tiles, { requireValues: true });
  const bounds = validateRecipeShape(normalized.tiles, normalized.placements);
  const placementByCell = new Map(normalized.placements.map((placement) => [
    `${placement.row}:${placement.column}`,
    placement,
  ]));

  const outputValues = [];
  for (let tileRow = 0; tileRow < bounds.tileRows; tileRow += 1) {
    const transformedCells = [];
    for (let tileColumn = 0; tileColumn < bounds.tileColumns; tileColumn += 1) {
      const placement = placementByCell.get(`${tileRow}:${tileColumn}`);
      const tileValues = tiles.valuesByName.get(placement.tile);
      transformedCells.push(applyMatrixCombineTile(tileValues, placement.transform));
    }

    for (let localRow = 0; localRow < bounds.cellRows; localRow += 1) {
      outputValues.push(transformedCells.flatMap((cell) => cell[localRow]));
    }
  }

  return {
    ...normalized,
    matrix: createMatrixKey(outputValues, {
      metadata: options.outputMetadata === undefined ? {} : options.outputMetadata,
    }),
  };
}

module.exports = {
  MATRIX_COMBINE_FORMAT,
  MATRIX_COMBINE_VERSION,
  normalizeMatrixCombineRecipe,
  matrixCombineRecipePayload,
  matrixCombineRecipeCommitment,
  applyMatrixCombineRecipe,
  applyMatrixCombineTile,
  assertMatrixCombineBounds,
};
