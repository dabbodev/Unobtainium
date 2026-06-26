'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
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
} = require('..');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const BASE_TRIAD = [
  [1, 2, 3],
  [4, 6, 8],
  [-2, 5, 7],
];

test('normalizeTriad accepts array points', () => {
  assert.deepEqual(normalizeTriad(BASE_TRIAD), {
    A: [1, 2, 3],
    B: [4, 6, 8],
    C: [-2, 5, 7],
  });
});

test('normalizeTriad accepts object points', () => {
  const normalized = normalizeTriad({
    A: { x: 1, y: 2, z: 3 },
    B: { x: 4, y: 6, z: 8 },
    C: { x: -2, y: 5, z: 7 },
  });

  assert.deepEqual(normalized, normalizeTriad(BASE_TRIAD));
});

test('normalizeTriadPoint rejects malformed points', () => {
  assert.throws(() => normalizeTriadPoint(null), /object/);
  assert.throws(() => normalizeTriadPoint([1, 2]), /array/);
  assert.throws(() => normalizeTriadPoint([1, 2, 3, 4]), /array/);
  assert.throws(() => normalizeTriadPoint('1,2,3'), /object/);
});

test('normalizeTriadPoint rejects NaN and Infinity', () => {
  assert.throws(() => normalizeTriadPoint([Number.NaN, 0, 0]), /finite number/);
  assert.throws(() => normalizeTriadPoint([Infinity, 0, 0]), /finite number/);
  assert.throws(() => normalizeTriadPoint({ x: 0, y: -Infinity, z: 0 }), /finite number/);
});

test('normalizeTriadPoint rejects missing coordinates', () => {
  assert.throws(() => normalizeTriadPoint({ x: 1, y: 2 }), /z is required/);
  assert.throws(() => normalizeTriad({ A: [0, 0, 0], B: [1, 0, 0] }), /C is required/);
});

test('normalizeTriad returns defensive copies', () => {
  const triad = clone(BASE_TRIAD);
  const normalized = normalizeTriad(triad);

  triad[0][0] = 99;
  normalized.A[1] = 88;

  assert.deepEqual(normalized.A, [1, 88, 3]);
  assert.deepEqual(normalizeTriad(BASE_TRIAD).A, [1, 2, 3]);
});

test('extractPointFeatures records independent A, B, and C features', () => {
  const features = extractPointFeatures(BASE_TRIAD);

  assert.deepEqual(features.A.coordinates, [1, 2, 3]);
  assert.deepEqual(features.B.coordinates, [4, 6, 8]);
  assert.deepEqual(features.C.coordinates, [-2, 5, 7]);
  assert.equal(features.A.coordinateSum, 6);
  assert.equal(features.B.coordinateSum, 18);
  assert.equal(features.C.coordinateSum, 10);
});

test('extractEdgeFeatures includes ordered AB, BC, and CA features', () => {
  const edges = extractEdgeFeatures(BASE_TRIAD);

  assert.deepEqual(Object.keys(edges), ['AB', 'BC', 'CA']);
  assert.deepEqual(edges.AB.delta, [3, 4, 5]);
  assert.deepEqual(edges.BC.delta, [-6, -1, -1]);
  assert.deepEqual(edges.CA.delta, [3, -3, -4]);
  assert.equal(edges.AB.squaredDistance, 50);
});

test('extractTriangleFeatures includes whole-triad features', () => {
  const triangle = extractTriangleFeatures(BASE_TRIAD);

  assert.deepEqual(triangle.sideSquaredDistances, {
    AB: 50,
    BC: 38,
    CA: 34,
  });
  assert.deepEqual(triangle.centroid, [1, 13 / 3, 6]);
  assert.deepEqual(triangle.orientationVector, [1, -27, 21]);
  assert.equal(triangle.degenerate, false);
  assert.match(triangle.angleBucket, /acute|right|obtuse|straight/);
});

test('same triad produces the same features and commitment', () => {
  const first = extractTriadFeatures(BASE_TRIAD, { walkIndex: 1, ring: 9 });
  const second = extractTriadFeatures(clone(BASE_TRIAD), { ring: 9, walkIndex: 1 });

  assert.deepEqual(first, second);
  assert.match(first.triadFeatureCommitment, /^[0-9a-f]{64}$/);
  assert.equal(triadFeatureCommitment(first), first.triadFeatureCommitment);
  assert.deepEqual(assertTriadFeatures(first), first);
});

test('triadFeaturePayload excludes commitment fields and returns copies', () => {
  const features = extractTriadFeatures(BASE_TRIAD, { walkIndex: 3 });
  const payload = triadFeaturePayload(features);

  assert.equal(Object.hasOwn(payload, 'triadFeatureCommitment'), false);
  assert.equal(payload.format, TRIAD_MIX_FORMAT);
  assert.equal(payload.version, TRIAD_MIX_VERSION);

  payload.triad.A[0] = 99;
  assert.equal(features.triad.A[0], 1);
});

test('changing A, B, or C changes features or commitment', () => {
  const base = extractTriadFeatures(BASE_TRIAD);
  const changedA = extractTriadFeatures([[9, 2, 3], BASE_TRIAD[1], BASE_TRIAD[2]]);
  const changedB = extractTriadFeatures([BASE_TRIAD[0], [4, 9, 8], BASE_TRIAD[2]]);
  const changedC = extractTriadFeatures([BASE_TRIAD[0], BASE_TRIAD[1], [-2, 5, 9]]);

  assert.notDeepEqual(changedA.features, base.features);
  assert.notDeepEqual(changedB.features, base.features);
  assert.notDeepEqual(changedC.features, base.features);
  assert.notEqual(changedA.triadFeatureCommitment, base.triadFeatureCommitment);
  assert.notEqual(changedB.triadFeatureCommitment, base.triadFeatureCommitment);
  assert.notEqual(changedC.triadFeatureCommitment, base.triadFeatureCommitment);
});

test('reordering points changes features and commitment', () => {
  const abc = extractTriadFeatures(BASE_TRIAD);
  const bca = extractTriadFeatures([BASE_TRIAD[1], BASE_TRIAD[2], BASE_TRIAD[0]]);

  assert.notDeepEqual(bca.triad, abc.triad);
  assert.notDeepEqual(bca.features.edges, abc.features.edges);
  assert.notEqual(bca.triadFeatureCommitment, abc.triadFeatureCommitment);
});

test('changing supplied walk context changes commitment', () => {
  const first = extractTriadFeatures(BASE_TRIAD, { walkIndex: 1, ring: 9 });
  const second = extractTriadFeatures(BASE_TRIAD, { walkIndex: 2, ring: 9 });
  const third = extractTriadFeatures(BASE_TRIAD, { context: { walkIndex: 1, ring: 10 } });

  assert.notEqual(first.triadFeatureCommitment, second.triadFeatureCommitment);
  assert.notEqual(first.triadFeatureCommitment, third.triadFeatureCommitment);
  assert.throws(() => extractTriadFeatures(BASE_TRIAD, { walkIndex: 1.5 }), /safe integer/);
  assert.throws(() => extractTriadFeatures(BASE_TRIAD, { unsupported: 1 }), /not supported/);
});

test('degenerate repeated points are accepted with an explicit flag', () => {
  const features = extractTriadFeatures([
    [1, 1, 1],
    [1, 1, 1],
    [2, 2, 2],
  ]);

  assert.equal(features.features.triangle.degenerate, true);
  assert.equal(features.features.triangle.repeatedPoint, true);
  assert.equal(features.features.triangle.angleBucket, 'degenerate');
  assert.match(features.triadFeatureCommitment, /^[0-9a-f]{64}$/);
});

test('feature extraction does not mutate caller input', () => {
  const triad = clone(BASE_TRIAD);
  const before = clone(triad);

  extractTriadFeatures(triad, { walkIndex: 7, point: 2, shift: 3, gap: 4 });

  assert.deepEqual(triad, before);
});

test('triad feature helpers are exported through packages/core entrypoint', () => {
  assert.equal(TRIAD_MIX_FORMAT, 'UN-TRIAD-MIX');
  assert.equal(TRIAD_MIX_VERSION, 1);
  assert.equal(typeof normalizeTriadPoint, 'function');
  assert.equal(typeof normalizeTriad, 'function');
  assert.equal(typeof triadFeaturePayload, 'function');
  assert.equal(typeof triadFeatureCommitment, 'function');
  assert.equal(typeof extractTriadFeatures, 'function');
  assert.equal(typeof extractPointFeatures, 'function');
  assert.equal(typeof extractEdgeFeatures, 'function');
  assert.equal(typeof extractTriangleFeatures, 'function');
  assert.equal(typeof assertTriadFeatures, 'function');
});

test('root legacy export remains the Unobtainium constructor', () => {
  const Unobtainium = require('../../..');

  assert.equal(typeof Unobtainium, 'function');
  assert.equal(Unobtainium.name, 'Unobtainium');
});
