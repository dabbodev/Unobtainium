'use strict';

const crypto = require('node:crypto');

const {
  angleAtFirstPoint,
  isDegenerateTriangle,
} = require('./geometry');
const { stableStringify } = require('./stack-canonical');

const TRIAD_MIX_FORMAT = 'UN-TRIAD-MIX';
const TRIAD_MIX_VERSION = 1;
const TRIAD_MIX_COMMITMENT_DOMAIN = 'UN-TRIAD-MIX:v1';
const CONTEXT_FIELDS = ['walkIndex', 'ring', 'horizon', 'point', 'shift', 'gap'];
const POINT_LABELS = ['A', 'B', 'C'];

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

function normalizeFiniteNumber(value, fieldName) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${fieldName} must be a finite number`);
  }

  return Object.is(value, -0) ? 0 : value;
}

function normalizeSafeInteger(value, fieldName) {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${fieldName} must be a safe integer`);
  }

  return Object.is(value, -0) ? 0 : value;
}

function cloneCanonicalValue(value, fieldName) {
  try {
    return JSON.parse(stableStringify(value));
  } catch (error) {
    error.message = `${fieldName} must be canonical plain data: ${error.message}`;
    throw error;
  }
}

function normalizeTriadPoint(point, fieldName = 'point') {
  if (Array.isArray(point)) {
    if (point.length !== 3) {
      throw new TypeError(`${fieldName} must be a [x, y, z] array`);
    }

    return point.map((coordinate, index) => (
      normalizeFiniteNumber(coordinate, `${fieldName}[${index}]`)
    ));
  }

  assertObject(point, fieldName);
  for (const coordinateName of ['x', 'y', 'z']) {
    assertOwnField(point, coordinateName);
  }

  return ['x', 'y', 'z'].map((coordinateName) => (
    normalizeFiniteNumber(point[coordinateName], `${fieldName}.${coordinateName}`)
  ));
}

function triadInputFrom(input) {
  if (Array.isArray(input)) {
    if (input.length !== 3) {
      throw new TypeError('triad must contain exactly three points');
    }

    return {
      A: input[0],
      B: input[1],
      C: input[2],
    };
  }

  assertObject(input, 'triad');
  for (const label of POINT_LABELS) {
    assertOwnField(input, label);
  }

  return input;
}

function normalizeTriad(input) {
  const triad = triadInputFrom(input);

  return {
    A: normalizeTriadPoint(triad.A, 'triad.A'),
    B: normalizeTriadPoint(triad.B, 'triad.B'),
    C: normalizeTriadPoint(triad.C, 'triad.C'),
  };
}

function normalizeContext(contextLike = {}) {
  assertObject(contextLike, 'context');

  const normalized = {};
  for (const fieldName of Object.keys(contextLike)) {
    if (!CONTEXT_FIELDS.includes(fieldName)) {
      throw new TypeError(`context.${fieldName} is not supported`);
    }
    normalized[fieldName] = normalizeSafeInteger(contextLike[fieldName], `context.${fieldName}`);
  }

  return normalized;
}

function finiteFeature(value, fieldName) {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${fieldName} must be finite`);
  }

  return Object.is(value, -0) ? 0 : value;
}

function add(values, fieldName) {
  return finiteFeature(values.reduce((sum, value) => sum + value, 0), fieldName);
}

function product(values, fieldName) {
  const value = values.reduce((current, entry) => current * entry, 1);
  return Number.isFinite(value) ? (Object.is(value, -0) ? 0 : value) : null;
}

function parity(value) {
  if (!Number.isSafeInteger(value)) {
    return null;
  }

  return Math.abs(value % 2);
}

function modularSignature(value, modulus) {
  if (!Number.isSafeInteger(value)) {
    return null;
  }

  return ((value % modulus) + modulus) % modulus;
}

function sign(value) {
  if (value > 0) {
    return 1;
  }
  if (value < 0) {
    return -1;
  }
  return 0;
}

function featurePoint(point, label) {
  const coordinateSum = add(point, `${label}.coordinateSum`);
  const coordinateAbsoluteSum = add(
    point.map((coordinate) => Math.abs(coordinate)),
    `${label}.coordinateAbsoluteSum`
  );
  const coordinateProduct = product(point, `${label}.coordinateProduct`);

  return {
    label,
    coordinates: point.slice(),
    coordinateSum,
    coordinateAbsoluteSum,
    coordinateProduct,
    coordinateProductFinite: coordinateProduct !== null,
    paritySignature: point.map(parity),
    mod7Signature: point.map((coordinate) => modularSignature(coordinate, 7)),
    signSignature: point.map(sign),
  };
}

function extractPointFeatures(triadLike) {
  const triad = normalizeTriad(triadLike);

  return {
    A: featurePoint(triad.A, 'A'),
    B: featurePoint(triad.B, 'B'),
    C: featurePoint(triad.C, 'C'),
  };
}

function deltaVector(from, to, label) {
  return to.map((coordinate, index) => (
    finiteFeature(coordinate - from[index], `${label}.delta[${index}]`)
  ));
}

function squaredDistance(delta, label) {
  return finiteFeature(
    delta.reduce((sum, coordinate) => sum + (coordinate * coordinate), 0),
    `${label}.squaredDistance`
  );
}

function edgeFeature(triad, fromLabel, toLabel, edgeLabel) {
  const delta = deltaVector(triad[fromLabel], triad[toLabel], edgeLabel);
  const absoluteDelta = delta.map((coordinate) => Math.abs(coordinate));

  return {
    label: edgeLabel,
    from: fromLabel,
    to: toLabel,
    delta,
    absoluteDelta,
    squaredDistance: squaredDistance(delta, edgeLabel),
    manhattanDistance: add(absoluteDelta, `${edgeLabel}.manhattanDistance`),
    directionSignature: delta.map(sign),
  };
}

function extractEdgeFeatures(triadLike) {
  const triad = normalizeTriad(triadLike);

  return {
    AB: edgeFeature(triad, 'A', 'B', 'AB'),
    BC: edgeFeature(triad, 'B', 'C', 'BC'),
    CA: edgeFeature(triad, 'C', 'A', 'CA'),
  };
}

function subtract(left, right, fieldName) {
  return left.map((coordinate, index) => (
    finiteFeature(coordinate - right[index], `${fieldName}[${index}]`)
  ));
}

function cross(left, right) {
  return [
    finiteFeature((left[1] * right[2]) - (left[2] * right[1]), 'orientationVector[0]'),
    finiteFeature((left[2] * right[0]) - (left[0] * right[2]), 'orientationVector[1]'),
    finiteFeature((left[0] * right[1]) - (left[1] * right[0]), 'orientationVector[2]'),
  ];
}

function dominantAxis(vector) {
  const absolute = vector.map((value) => Math.abs(value));
  const max = Math.max(...absolute);
  if (max === 0) {
    return 'none';
  }

  return ['x', 'y', 'z'][absolute.indexOf(max)];
}

function angleBucket(angle, degenerate) {
  if (degenerate) {
    return 'degenerate';
  }
  if (Math.abs(angle - 90) <= 1e-9) {
    return 'right';
  }
  if (angle < 90) {
    return 'acute';
  }
  if (angle < 180) {
    return 'obtuse';
  }
  return 'straight';
}

function extractTriangleFeatures(triadLike) {
  const triad = normalizeTriad(triadLike);
  const edges = extractEdgeFeatures(triad);
  const degenerate = isDegenerateTriangle(triad.A, triad.B, triad.C);
  const angleAtA = finiteFeature(angleAtFirstPoint(triad.A, triad.B, triad.C), 'angleAtA');
  const ab = subtract(triad.B, triad.A, 'AB');
  const ac = subtract(triad.C, triad.A, 'AC');
  const orientationVector = cross(ab, ac);
  const centroid = [0, 1, 2].map((index) => finiteFeature(
    (triad.A[index] + triad.B[index] + triad.C[index]) / 3,
    `centroid[${index}]`
  ));
  const sideSquaredDistances = {
    AB: edges.AB.squaredDistance,
    BC: edges.BC.squaredDistance,
    CA: edges.CA.squaredDistance,
  };

  return {
    sideSquaredDistances,
    perimeterSquaredSignature: add(
      [sideSquaredDistances.AB, sideSquaredDistances.BC, sideSquaredDistances.CA],
      'perimeterSquaredSignature'
    ),
    manhattanPerimeterSignature: add(
      [
        edges.AB.manhattanDistance,
        edges.BC.manhattanDistance,
        edges.CA.manhattanDistance,
      ],
      'manhattanPerimeterSignature'
    ),
    centroid,
    centroidSum: add(centroid, 'centroidSum'),
    orientationVector,
    orientationSignature: orientationVector.map(sign),
    orientationDominantAxis: dominantAxis(orientationVector),
    angleAtA,
    angleBucket: angleBucket(angleAtA, degenerate),
    degenerate,
    repeatedPoint: (
      sideSquaredDistances.AB === 0
      || sideSquaredDistances.BC === 0
      || sideSquaredDistances.CA === 0
    ),
  };
}

function payloadOptions(options = {}) {
  if (options.context !== undefined) {
    return options.context;
  }

  return options;
}

function buildFeaturePayload(triadLike, options = {}) {
  const triad = normalizeTriad(triadLike);
  const context = normalizeContext(payloadOptions(options));

  return {
    format: TRIAD_MIX_FORMAT,
    version: TRIAD_MIX_VERSION,
    triad,
    context,
    features: {
      points: extractPointFeatures(triad),
      edges: extractEdgeFeatures(triad),
      triangle: extractTriangleFeatures(triad),
    },
  };
}

function hasFeatureShape(input) {
  return input !== null
    && typeof input === 'object'
    && !Array.isArray(input)
    && Object.hasOwn(input, 'format')
    && Object.hasOwn(input, 'version')
    && Object.hasOwn(input, 'triad')
    && Object.hasOwn(input, 'features');
}

function featurePayloadFromEnvelope(input) {
  assertObject(input, 'triadFeatures');
  if (input.format !== TRIAD_MIX_FORMAT) {
    throw new TypeError('triad feature format is not UN-TRIAD-MIX');
  }
  if (input.version !== TRIAD_MIX_VERSION) {
    throw new TypeError('triad feature version is not supported');
  }

  const payload = buildFeaturePayload(input.triad, input.context === undefined ? {} : input.context);
  const suppliedFeatures = cloneCanonicalValue(input.features, 'features');
  if (stableStringify(suppliedFeatures) !== stableStringify(payload.features)) {
    throw new RangeError('triad feature payload mismatch');
  }

  return payload;
}

function triadFeaturePayload(triadLike, options = {}) {
  if (hasFeatureShape(triadLike)) {
    return cloneCanonicalValue(featurePayloadFromEnvelope(triadLike), 'triadFeatures');
  }

  return cloneCanonicalValue(buildFeaturePayload(triadLike, options), 'triadFeatures');
}

function triadFeatureCommitment(triadLike, options = {}) {
  return crypto
    .createHash('sha256')
    .update(TRIAD_MIX_COMMITMENT_DOMAIN)
    .update(Buffer.from([0]))
    .update(stableStringify(triadFeaturePayload(triadLike, options)))
    .digest('hex');
}

function extractTriadFeatures(triadLike, options = {}) {
  const payload = triadFeaturePayload(triadLike, options);

  return {
    ...payload,
    triadFeatureCommitment: triadFeatureCommitment(payload),
  };
}

function assertTriadFeatures(featuresLike) {
  const payload = triadFeaturePayload(featuresLike);
  const commitment = triadFeatureCommitment(payload);

  if (
    Object.hasOwn(featuresLike, 'triadFeatureCommitment')
    && featuresLike.triadFeatureCommitment !== commitment
  ) {
    throw new RangeError('triadFeatureCommitment mismatch');
  }

  return {
    ...payload,
    triadFeatureCommitment: commitment,
  };
}

module.exports = {
  TRIAD_MIX_FORMAT,
  TRIAD_MIX_VERSION,
  normalizeTriadPoint,
  normalizeTriad,
  triadFeaturePayload,
  triadFeatureCommitment,
  extractTriadFeatures,
  extractPointFeatures,
  extractEdgeFeatures,
  extractTriangleFeatures,
  assertTriadFeatures,
};
