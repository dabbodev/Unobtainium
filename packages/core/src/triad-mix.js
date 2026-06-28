'use strict';

const crypto = require('node:crypto');

const {
  angleAtFirstPoint,
  isDegenerateTriangle,
} = require('./geometry');
const { stableStringify } = require('./stack-canonical');
const { selectTriple, advanceWalk } = require('./walk');

const TRIAD_MIX_FORMAT = 'UN-TRIAD-MIX';
const TRIAD_MIX_VERSION = 1;
const TRIAD_MIX_COMMITMENT_DOMAIN = 'UN-TRIAD-MIX:v1';
const TRIAD_INSTRUCTION_FORMAT = 'UN-TRIAD-MIX-INSTRUCTIONS';
const TRIAD_INSTRUCTION_VERSION = 1;
const TRIAD_INSTRUCTION_COMMITMENT_DOMAIN = 'UN-TRIAD-MIX-INSTRUCTIONS:v1';
const TRIAD_STREAM_FORMAT = 'UN-TRIAD-MIX-STREAM';
const TRIAD_STREAM_VERSION = 1;
const TRIAD_STREAM_COMMITMENT_DOMAIN = 'UN-TRIAD-MIX-STREAM:v1';
const DEFAULT_TRIAD_INSTRUCTION_RING = 256;
const MIX_PATTERNS = [
  'point-balanced',
  'edge-weighted',
  'orientation-selected',
  'centroid-coupled',
  'walk-index-coupled',
];
const CONTEXT_FIELDS = [
  'walkIndex',
  'ring',
  'horizon',
  'point',
  'shift',
  'gap',
  'payloadLength',
  'span',
];
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

function hasInstructionShape(input) {
  return input !== null
    && typeof input === 'object'
    && !Array.isArray(input)
    && Object.hasOwn(input, 'format')
    && Object.hasOwn(input, 'version')
    && Object.hasOwn(input, 'triadFeatureCommitment')
    && Object.hasOwn(input, 'channels');
}

function instructionPayloadFromEnvelope(input) {
  assertObject(input, 'triadInstructionChannels');
  if (input.format !== TRIAD_INSTRUCTION_FORMAT) {
    throw new TypeError('triad instruction format is not UN-TRIAD-MIX-INSTRUCTIONS');
  }
  if (input.version !== TRIAD_INSTRUCTION_VERSION) {
    throw new TypeError('triad instruction version is not supported');
  }

  const payload = cloneCanonicalValue(input, 'triadInstructionChannels');
  delete payload.triadInstructionCommitment;
  return payload;
}

function normalizePositiveSafeInteger(value, fieldName) {
  const normalized = normalizeSafeInteger(value, fieldName);
  if (normalized <= 0) {
    throw new RangeError(`${fieldName} must be a positive safe integer`);
  }

  return normalized;
}

function instructionContextFrom(options = {}, fallbackContext = {}) {
  const contextLike = options.context === undefined ? options : options.context;
  if (contextLike === undefined || contextLike === null) {
    return normalizeContext(fallbackContext);
  }
  if (Object.keys(contextLike).length === 0 && fallbackContext !== undefined) {
    return normalizeContext(fallbackContext);
  }

  return normalizeContext(contextLike);
}

function boundedDigestInteger(domain, value) {
  const digest = crypto
    .createHash('sha256')
    .update(domain)
    .update(Buffer.from([0]))
    .update(stableStringify(value))
    .digest('hex');

  return Number.parseInt(digest.slice(0, 12), 16);
}

function modulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function resolveInstructionRing(context) {
  if (context.ring === undefined) {
    return DEFAULT_TRIAD_INSTRUCTION_RING;
  }

  return normalizePositiveSafeInteger(context.ring, 'context.ring');
}

function resolveInstructionSpan(context) {
  if (context.span !== undefined) {
    return normalizePositiveSafeInteger(context.span, 'context.span');
  }
  if (context.payloadLength !== undefined) {
    return normalizePositiveSafeInteger(context.payloadLength, 'context.payloadLength');
  }

  return null;
}

function pointSummary(points) {
  return {
    A: points.A.coordinateSum,
    B: points.B.coordinateSum,
    C: points.C.coordinateSum,
  };
}

function edgeSummary(edges) {
  return {
    AB: edges.AB.squaredDistance,
    BC: edges.BC.squaredDistance,
    CA: edges.CA.squaredDistance,
  };
}

function triangleSummary(triangle) {
  return {
    angleBucket: triangle.angleBucket,
    centroidSum: triangle.centroidSum,
    orientationDominantAxis: triangle.orientationDominantAxis,
    perimeterSquaredSignature: triangle.perimeterSquaredSignature,
  };
}

function sourceFeatureFamilies(context) {
  const families = ['points', 'edges', 'triangle'];
  if (Object.keys(context).length > 0) {
    families.push('context');
  }

  return families;
}

function mixSelectionMaterial(triadFeatures, context) {
  const { features } = triadFeatures;

  return {
    featureCommitment: triadFeatures.triadFeatureCommitment,
    points: pointSummary(features.points),
    edges: edgeSummary(features.edges),
    triangle: triangleSummary(features.triangle),
    context,
  };
}

function selectMixPattern(triadFeatures, context) {
  const selector = boundedDigestInteger(
    'UN-TRIAD-MIX-INSTRUCTIONS:pattern:v1',
    mixSelectionMaterial(triadFeatures, context)
  );

  return MIX_PATTERNS[selector % MIX_PATTERNS.length];
}

function emitTriadRotateChannel(triadFeaturesLike, options = {}) {
  const triadFeatures = assertTriadFeatures(triadFeaturesLike);
  const context = instructionContextFrom(options, triadFeatures.context);
  const ring = resolveInstructionRing(context);
  const mixPattern = selectMixPattern(triadFeatures, context);
  const material = {
    featureCommitment: triadFeatures.triadFeatureCommitment,
    mixPattern,
    points: pointSummary(triadFeatures.features.points),
    edges: edgeSummary(triadFeatures.features.edges),
    triangle: triangleSummary(triadFeatures.features.triangle),
    context,
  };
  const seed = boundedDigestInteger('UN-TRIAD-MIX-INSTRUCTIONS:rotate:v1', material);

  return {
    delta: modulo(seed, ring),
    direction: seed % 2 === 0 ? 'up' : 'down',
    ring,
    sourceFeatures: {
      points: ['A.coordinateSum', 'B.coordinateSum', 'C.coordinateSum'],
      edges: ['AB.squaredDistance', 'BC.squaredDistance', 'CA.squaredDistance'],
      triangle: [
        'angleBucket',
        'centroidSum',
        'orientationDominantAxis',
        'perimeterSquaredSignature',
      ],
      context: Object.keys(context).sort(),
    },
    mixPattern,
  };
}

function emitTriadPositionChannel(triadFeaturesLike, options = {}) {
  const triadFeatures = assertTriadFeatures(triadFeaturesLike);
  const context = instructionContextFrom(options, triadFeatures.context);
  const span = resolveInstructionSpan(context);
  const mixPattern = selectMixPattern(triadFeatures, context);
  const material = {
    featureCommitment: triadFeatures.triadFeatureCommitment,
    mixPattern,
    points: pointSummary(triadFeatures.features.points),
    edges: edgeSummary(triadFeatures.features.edges),
    triangle: triangleSummary(triadFeatures.features.triangle),
    context,
  };
  const seed = boundedDigestInteger('UN-TRIAD-MIX-INSTRUCTIONS:position:v1', material);
  const offset = boundedDigestInteger('UN-TRIAD-MIX-INSTRUCTIONS:position-offset:v1', {
    seed,
    edgeSummary: material.edges,
    triangleSummary: material.triangle,
  });

  return {
    seed,
    span,
    a: span === null ? null : modulo(seed, span),
    b: span === null ? null : modulo(seed + offset, span),
    sourceFeatures: {
      points: ['A.coordinateSum', 'B.coordinateSum', 'C.coordinateSum'],
      edges: ['AB.squaredDistance', 'BC.squaredDistance', 'CA.squaredDistance'],
      triangle: [
        'angleBucket',
        'centroidSum',
        'orientationDominantAxis',
        'perimeterSquaredSignature',
      ],
      context: Object.keys(context).sort(),
    },
    mixPattern,
  };
}

function emitTriadRuleChannel(triadFeaturesLike, options = {}) {
  const triadFeatures = assertTriadFeatures(triadFeaturesLike);
  const context = instructionContextFrom(options, triadFeatures.context);
  const mixPattern = selectMixPattern(triadFeatures, context);
  const triangle = triadFeatures.features.triangle;

  return {
    angleBucket: triangle.angleBucket,
    mixPattern,
    degenerate: triangle.degenerate,
    repeatedPoint: triangle.repeatedPoint,
    sourceFeatureFamilies: sourceFeatureFamilies(context),
  };
}

function emitTriadExplainChannel(triadFeatures, context, ruleChannel, positionChannel) {
  const notes = [
    'deterministic instruction-channel descriptor only',
    'does not apply UN-ROTATE, UN-SWAP, or permutation transforms',
  ];
  if (positionChannel.span === null) {
    notes.push('position indexes are abstract because no span or payloadLength was supplied');
  }
  if (ruleChannel.degenerate) {
    notes.push('degenerate triad emitted deterministic flagged channels');
  }

  return {
    featureCommitment: triadFeatures.triadFeatureCommitment,
    selectedPattern: ruleChannel.mixPattern,
    changedByPointOrder: true,
    degenerate: ruleChannel.degenerate,
    notes,
  };
}

function triadFeaturesFromInstructionInput(input, options = {}) {
  if (hasFeatureShape(input)) {
    return assertTriadFeatures(input);
  }

  return extractTriadFeatures(input, options);
}

function buildInstructionPayload(input, options = {}) {
  const triadFeatures = triadFeaturesFromInstructionInput(input, options);
  const context = instructionContextFrom(options, triadFeatures.context);
  const rotate = emitTriadRotateChannel(triadFeatures, { context });
  const position = emitTriadPositionChannel(triadFeatures, { context });
  const rule = emitTriadRuleChannel(triadFeatures, { context });

  return {
    format: TRIAD_INSTRUCTION_FORMAT,
    version: TRIAD_INSTRUCTION_VERSION,
    triadFeatureCommitment: triadFeatures.triadFeatureCommitment,
    context,
    channels: {
      rotate,
      position,
      rule,
      explain: emitTriadExplainChannel(triadFeatures, context, rule, position),
    },
  };
}

function triadInstructionPayload(input, options = {}) {
  if (hasInstructionShape(input)) {
    return instructionPayloadFromEnvelope(input);
  }

  return cloneCanonicalValue(buildInstructionPayload(input, options), 'triadInstructionChannels');
}

function triadInstructionCommitment(input, options = {}) {
  return crypto
    .createHash('sha256')
    .update(TRIAD_INSTRUCTION_COMMITMENT_DOMAIN)
    .update(Buffer.from([0]))
    .update(stableStringify(triadInstructionPayload(input, options)))
    .digest('hex');
}

function emitTriadInstructionChannels(input, options = {}) {
  const payload = triadInstructionPayload(input, options);

  return {
    ...payload,
    triadInstructionCommitment: triadInstructionCommitment(payload),
  };
}

function assertHexCommitment(value, fieldName) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
    throw new TypeError(`${fieldName} must be a SHA-256 hex commitment`);
  }
}

function assertSourceFeatureObject(value, fieldName) {
  assertObject(value, fieldName);
  for (const key of ['points', 'edges', 'triangle', 'context']) {
    if (!Array.isArray(value[key])) {
      throw new TypeError(`${fieldName}.${key} must be an array`);
    }
  }
}

function validateInstructionPayload(payload) {
  assertObject(payload, 'triadInstructionChannels');
  if (payload.format !== TRIAD_INSTRUCTION_FORMAT) {
    throw new TypeError('triad instruction format is not UN-TRIAD-MIX-INSTRUCTIONS');
  }
  if (payload.version !== TRIAD_INSTRUCTION_VERSION) {
    throw new TypeError('triad instruction version is not supported');
  }
  assertHexCommitment(payload.triadFeatureCommitment, 'triadFeatureCommitment');
  normalizeContext(payload.context);
  assertObject(payload.channels, 'channels');

  const { rotate, position, rule, explain } = payload.channels;
  assertObject(rotate, 'channels.rotate');
  const ring = normalizePositiveSafeInteger(rotate.ring, 'channels.rotate.ring');
  normalizeSafeInteger(rotate.delta, 'channels.rotate.delta');
  if (rotate.delta < 0 || rotate.delta >= ring) {
    throw new RangeError('channels.rotate.delta must be within ring bounds');
  }
  if (!['up', 'down'].includes(rotate.direction)) {
    throw new TypeError('channels.rotate.direction must be up or down');
  }
  if (!MIX_PATTERNS.includes(rotate.mixPattern)) {
    throw new TypeError('channels.rotate.mixPattern is not supported');
  }
  assertSourceFeatureObject(rotate.sourceFeatures, 'channels.rotate.sourceFeatures');

  assertObject(position, 'channels.position');
  normalizeSafeInteger(position.seed, 'channels.position.seed');
  if (position.span !== null) {
    const span = normalizePositiveSafeInteger(position.span, 'channels.position.span');
    for (const fieldName of ['a', 'b']) {
      normalizeSafeInteger(position[fieldName], `channels.position.${fieldName}`);
      if (position[fieldName] < 0 || position[fieldName] >= span) {
        throw new RangeError(`channels.position.${fieldName} must be within span bounds`);
      }
    }
  } else if (position.a !== null || position.b !== null) {
    throw new TypeError('channels.position indexes must be null when span is null');
  }
  if (!MIX_PATTERNS.includes(position.mixPattern)) {
    throw new TypeError('channels.position.mixPattern is not supported');
  }
  assertSourceFeatureObject(position.sourceFeatures, 'channels.position.sourceFeatures');

  assertObject(rule, 'channels.rule');
  if (typeof rule.angleBucket !== 'string') {
    throw new TypeError('channels.rule.angleBucket must be a string');
  }
  if (!MIX_PATTERNS.includes(rule.mixPattern)) {
    throw new TypeError('channels.rule.mixPattern is not supported');
  }
  if (typeof rule.degenerate !== 'boolean') {
    throw new TypeError('channels.rule.degenerate must be a boolean');
  }
  if (typeof rule.repeatedPoint !== 'boolean') {
    throw new TypeError('channels.rule.repeatedPoint must be a boolean');
  }
  if (!Array.isArray(rule.sourceFeatureFamilies)) {
    throw new TypeError('channels.rule.sourceFeatureFamilies must be an array');
  }

  assertObject(explain, 'channels.explain');
  assertHexCommitment(explain.featureCommitment, 'channels.explain.featureCommitment');
  if (explain.featureCommitment !== payload.triadFeatureCommitment) {
    throw new RangeError('channels.explain.featureCommitment mismatch');
  }
  if (explain.selectedPattern !== rule.mixPattern) {
    throw new RangeError('channels.explain.selectedPattern mismatch');
  }
  if (typeof explain.changedByPointOrder !== 'boolean') {
    throw new TypeError('channels.explain.changedByPointOrder must be a boolean');
  }
  if (typeof explain.degenerate !== 'boolean') {
    throw new TypeError('channels.explain.degenerate must be a boolean');
  }
  if (!Array.isArray(explain.notes)) {
    throw new TypeError('channels.explain.notes must be an array');
  }
}

function assertTriadInstructionChannels(channelsLike) {
  const payload = triadInstructionPayload(channelsLike);
  validateInstructionPayload(payload);
  const commitment = triadInstructionCommitment(payload);

  if (
    Object.hasOwn(channelsLike, 'triadInstructionCommitment')
    && channelsLike.triadInstructionCommitment !== commitment
  ) {
    throw new RangeError('triadInstructionCommitment mismatch');
  }

  return {
    ...payload,
    triadInstructionCommitment: commitment,
  };
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

function normalizeTriadArray(triadsLike) {
  if (!Array.isArray(triadsLike)) {
    throw new TypeError('triads must be an array');
  }
  if (triadsLike.length === 0) {
    throw new RangeError('triads must contain at least one triad');
  }

  return triadsLike.map((triad, index) => normalizeTriad(triad, `triads[${index}]`));
}

function triadStreamRecord(triadLike, index, context) {
  const triad = normalizeTriad(triadLike);
  const channels = emitTriadInstructionChannels(triad, { context });

  return {
    index,
    triad,
    triadFeatureCommitment: channels.triadFeatureCommitment,
    triadInstructionCommitment: channels.triadInstructionCommitment,
    rotate: cloneCanonicalValue(channels.channels.rotate, 'record.rotate'),
    position: cloneCanonicalValue(channels.channels.position, 'record.position'),
    rule: cloneCanonicalValue(channels.channels.rule, 'record.rule'),
    explain: cloneCanonicalValue(channels.channels.explain, 'record.explain'),
  };
}

function buildStreamPayload(triadsLike, contextLike = {}) {
  const triads = normalizeTriadArray(triadsLike);
  const context = normalizeContext(contextLike);

  return {
    format: TRIAD_STREAM_FORMAT,
    version: TRIAD_STREAM_VERSION,
    context,
    records: triads.map((triad, index) => triadStreamRecord(triad, index, context)),
  };
}

function hasTriadStreamShape(input) {
  return input !== null
    && typeof input === 'object'
    && !Array.isArray(input)
    && Object.hasOwn(input, 'format')
    && Object.hasOwn(input, 'version')
    && Object.hasOwn(input, 'records');
}

function triadStreamPayloadFromEnvelope(input) {
  assertObject(input, 'triadInstructionStream');
  if (input.format !== TRIAD_STREAM_FORMAT) {
    throw new TypeError('triad instruction stream format is not UN-TRIAD-MIX-STREAM');
  }
  if (input.version !== TRIAD_STREAM_VERSION) {
    throw new TypeError('triad instruction stream version is not supported');
  }

  const payload = cloneCanonicalValue(input, 'triadInstructionStream');
  delete payload.streamCommitment;
  return payload;
}

function triadStreamPayload(input, context = {}) {
  if (hasTriadStreamShape(input)) {
    return triadStreamPayloadFromEnvelope(input);
  }

  return cloneCanonicalValue(buildStreamPayload(input, context), 'triadInstructionStream');
}

function triadStreamCommitment(input, context = {}) {
  return crypto
    .createHash('sha256')
    .update(TRIAD_STREAM_COMMITMENT_DOMAIN)
    .update(Buffer.from([0]))
    .update(stableStringify(triadStreamPayload(input, context)))
    .digest('hex');
}

function createTriadInstructionStream(triads, context = {}) {
  const payload = triadStreamPayload(triads, context);

  return {
    ...payload,
    streamCommitment: triadStreamCommitment(payload),
  };
}

function normalizeWalkPoints(pointsLike) {
  if (!Array.isArray(pointsLike)) {
    throw new TypeError('points must be an array');
  }
  if (pointsLike.length === 0) {
    throw new RangeError('points must contain at least one point');
  }

  return pointsLike.map((point, index) => normalizeTriadPoint(point, `points[${index}]`));
}

function normalizeWalkOptions(walkOptions = {}) {
  assertObject(walkOptions, 'walkOptions');

  const state = walkOptions.state === undefined
    ? { point: 0, shift: 1, gap: 1 }
    : cloneCanonicalValue(walkOptions.state, 'walkOptions.state');
  const mode = walkOptions.mode === undefined ? 'permissive' : walkOptions.mode;
  if (mode !== 'permissive' && mode !== 'distinct') {
    throw new RangeError('walkOptions.mode must be "permissive" or "distinct"');
  }

  if (walkOptions.count !== undefined && !Number.isInteger(walkOptions.count)) {
    throw new TypeError('walkOptions.count must be an integer');
  }

  return {
    state,
    mode,
    count: walkOptions.count,
  };
}

function createTriadInstructionStreamFromWalk(points, walkOptions = {}, context = {}) {
  const normalizedPoints = normalizeWalkPoints(points);
  const options = normalizeWalkOptions(walkOptions);
  const count = options.count === undefined ? normalizedPoints.length : options.count;
  if (count <= 0) {
    throw new RangeError('walkOptions.count must be positive');
  }

  const triads = [];
  let state = cloneCanonicalValue(options.state, 'walkOptions.state');
  for (let index = 0; index < count; index += 1) {
    const selected = selectTriple(state, normalizedPoints.length, options.mode);
    triads.push(selected.map((pointIndex) => normalizedPoints[pointIndex]));
    state = advanceWalk(state, normalizedPoints.length, options.mode);
  }

  return createTriadInstructionStream(triads, context);
}

function validateStreamPayload(payload) {
  assertObject(payload, 'triadInstructionStream');
  if (payload.format !== TRIAD_STREAM_FORMAT) {
    throw new TypeError('triad instruction stream format is not UN-TRIAD-MIX-STREAM');
  }
  if (payload.version !== TRIAD_STREAM_VERSION) {
    throw new TypeError('triad instruction stream version is not supported');
  }
  const context = normalizeContext(payload.context);
  if (!Array.isArray(payload.records)) {
    throw new TypeError('records must be an array');
  }
  if (payload.records.length === 0) {
    throw new RangeError('records must contain at least one record');
  }

  payload.records.forEach((record, index) => {
    assertObject(record, `records[${index}]`);
    if (record.index !== index) {
      throw new RangeError(`records[${index}].index must match its stream position`);
    }
    normalizeTriad(record.triad);
    assertHexCommitment(record.triadFeatureCommitment, `records[${index}].triadFeatureCommitment`);
    assertHexCommitment(
      record.triadInstructionCommitment,
      `records[${index}].triadInstructionCommitment`
    );

    const expected = triadStreamRecord(record.triad, index, context);
    if (stableStringify(record) !== stableStringify(expected)) {
      throw new RangeError(`records[${index}] does not match its triad instruction channels`);
    }
  });
}

function assertTriadInstructionStream(streamLike) {
  const payload = triadStreamPayload(streamLike);
  validateStreamPayload(payload);
  const commitment = triadStreamCommitment(payload);

  if (
    Object.hasOwn(streamLike, 'streamCommitment')
    && streamLike.streamCommitment !== commitment
  ) {
    throw new RangeError('streamCommitment mismatch');
  }

  return {
    ...payload,
    streamCommitment: commitment,
  };
}

module.exports = {
  TRIAD_MIX_FORMAT,
  TRIAD_MIX_VERSION,
  TRIAD_INSTRUCTION_FORMAT,
  TRIAD_INSTRUCTION_VERSION,
  TRIAD_STREAM_FORMAT,
  TRIAD_STREAM_VERSION,
  normalizeTriadPoint,
  normalizeTriad,
  triadFeaturePayload,
  triadFeatureCommitment,
  extractTriadFeatures,
  extractPointFeatures,
  extractEdgeFeatures,
  extractTriangleFeatures,
  assertTriadFeatures,
  triadInstructionPayload,
  triadInstructionCommitment,
  emitTriadInstructionChannels,
  emitTriadRotateChannel,
  emitTriadPositionChannel,
  emitTriadRuleChannel,
  assertTriadInstructionChannels,
  triadStreamPayload,
  triadStreamCommitment,
  createTriadInstructionStream,
  createTriadInstructionStreamFromWalk,
  assertTriadInstructionStream,
};
