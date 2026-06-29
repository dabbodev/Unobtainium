'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const core = require('..');
const {
  GWM_V2_FORMAT,
  GWM_V2_VERSION,
  GWM_V2_SOURCE_POINT_FORMAT,
  GWM_V2_SOURCE_POINT_VERSION,
  assertGwmV2SourcePoints,
  gwmV2SourcePointPayload,
  gwmV2SourcePointCommitment,
  createGwmV2TriadStream,
  createGwmV2DescriptorFromPoints,
  normalizeGwmV2Descriptor,
  gwmV2Payload,
  gwmV2Commitment,
  createGwmV2Descriptor,
  assertGwmV2Descriptor,
} = require('../src/gwm-v2');
const { generateInstructionStream } = require('../src/instruction-stream');

const HEX = {
  source: 'a'.repeat(64),
  source2: 'b'.repeat(64),
  stream: 'c'.repeat(64),
  stream2: 'd'.repeat(64),
  adapter: 'e'.repeat(64),
  adapter2: 'f'.repeat(64),
  proof: '0123456789abcdef'.repeat(4),
  proof2: 'fedcba9876543210'.repeat(4),
};

const POINTS = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

const OBJECT_POINTS = [
  { x: 0, y: 0, z: 0 },
  { x: 1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: 0, z: 1 },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function descriptorInput(overrides = {}) {
  return {
    format: GWM_V2_FORMAT,
    version: GWM_V2_VERSION,
    mode: 'UN-GWM-V2',
    sourcePointCommitment: HEX.source,
    walkOptions: {
      point: 0,
      shift: 1,
      gap: 2,
      horizon: 12,
      ring: 5,
    },
    triadStreamCommitment: HEX.stream,
    adapterPlanCommitment: HEX.adapter,
    transformProofCommitment: HEX.proof,
    context: {
      purpose: 'sprint-39-test',
      bounds: { payloadLength: 8 },
    },
    metadata: {
      label: 'fixture',
      flags: ['pure-descriptor'],
    },
    ...overrides,
  };
}

function createFixture(overrides = {}) {
  return createGwmV2Descriptor(descriptorInput(overrides));
}

function changedCommitment(fieldOverrides) {
  return createFixture(fieldOverrides).descriptorCommitment;
}

test('normalizes GWM-V2 source points from array points', () => {
  const points = assertGwmV2SourcePoints(POINTS);

  assert.deepEqual(points, POINTS);
  assert.notEqual(points, POINTS);
  assert.notEqual(points[0], POINTS[0]);
});

test('normalizes GWM-V2 source points from object points', () => {
  assert.deepEqual(assertGwmV2SourcePoints(OBJECT_POINTS), POINTS);
});

test('rejects malformed GWM-V2 source points', () => {
  assert.throws(() => assertGwmV2SourcePoints('points'), /points must be an array/);
  assert.throws(() => assertGwmV2SourcePoints([[0, 0]]), /at least 3 points/);
  assert.throws(() => assertGwmV2SourcePoints([[0, 0, 0], [1, 0, 0], [Infinity, 0, 0]]), /finite/);
  assert.throws(() => assertGwmV2SourcePoints([[0, 0, 0], [1, 0, 0], { x: 1, y: 2 }]), /z/);
});

test('rejects empty and too-small GWM-V2 point sets', () => {
  assert.throws(() => assertGwmV2SourcePoints([]), /at least one point/);
  assert.throws(
    () => createGwmV2TriadStream([[0, 0, 0], [1, 0, 0]], { point: 0, shift: 0, gap: 0 }),
    /at least 3 points/
  );
});

test('creates deterministic GWM-V2 source point payloads and commitments', () => {
  const payload = gwmV2SourcePointPayload(OBJECT_POINTS);
  const first = gwmV2SourcePointCommitment(POINTS);
  const second = gwmV2SourcePointCommitment(OBJECT_POINTS);

  assert.equal(payload.format, GWM_V2_SOURCE_POINT_FORMAT);
  assert.equal(payload.version, GWM_V2_SOURCE_POINT_VERSION);
  assert.deepEqual(payload.points, POINTS);
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(first, second);
});

test('GWM-V2 source point commitment changes with point material, order, and count', () => {
  const base = gwmV2SourcePointCommitment(POINTS);
  const changedPoint = clone(POINTS);
  changedPoint[1][0] = 2;

  assert.notEqual(gwmV2SourcePointCommitment(changedPoint), base);
  assert.notEqual(gwmV2SourcePointCommitment([POINTS[1], POINTS[0], POINTS[2], POINTS[3]]), base);
  assert.notEqual(gwmV2SourcePointCommitment(POINTS.concat([[2, 2, 2]])), base);
});

test('creates a deterministic GWM-V2 triad stream from source points', () => {
  const walkOptions = { point: 0, shift: 0, gap: 0, horizon: 3, ring: 17 };
  const context = { payloadLength: 8 };
  const stream = createGwmV2TriadStream(POINTS, walkOptions, context);
  const repeated = createGwmV2TriadStream(clone(POINTS), clone(walkOptions), clone(context));

  assert.equal(stream.sourcePointCommitment, gwmV2SourcePointCommitment(POINTS));
  assert.match(stream.triadStreamCommitment, /^[0-9a-f]{64}$/);
  assert.equal(stream.triadStream.streamCommitment, stream.triadStreamCommitment);
  assert.deepEqual(stream, repeated);
  assert.equal(stream.triadStream.records.length, 3);
  assert.deepEqual(stream.walkOptions, walkOptions);
  assert.deepEqual(stream.triadStream.context, {
    gap: 0,
    horizon: 3,
    payloadLength: 8,
    point: 0,
    ring: 17,
    shift: 0,
  });
});

test('GWM-V2 triad stream changes when walk options or context change', () => {
  const base = createGwmV2TriadStream(POINTS, { point: 0, shift: 0, gap: 0, horizon: 3 }, {
    payloadLength: 8,
  });
  const changedWalk = createGwmV2TriadStream(POINTS, { point: 0, shift: 0, gap: 1, horizon: 3 }, {
    payloadLength: 8,
  });
  const changedContext = createGwmV2TriadStream(POINTS, { point: 0, shift: 0, gap: 0, horizon: 3 }, {
    payloadLength: 9,
  });

  assert.notEqual(changedWalk.triadStreamCommitment, base.triadStreamCommitment);
  assert.notEqual(changedContext.triadStreamCommitment, base.triadStreamCommitment);
});

test('GWM-V2 triad stream rejects invalid walk options', () => {
  assert.throws(() => createGwmV2TriadStream(POINTS, { shift: 0, gap: 0 }), /point is required/);
  assert.throws(() => createGwmV2TriadStream(POINTS, { point: -1, shift: 0, gap: 0 }), /point/);
  assert.throws(() => createGwmV2TriadStream(POINTS, { point: 0, shift: 0, gap: 0, horizon: 0 }), /horizon/);
  assert.throws(() => createGwmV2TriadStream(POINTS, { point: 0, shift: 0, gap: 0, ring: 0 }), /ring/);
  assert.throws(
    () => createGwmV2TriadStream(POINTS, { point: 0, shift: 0, gap: Number.MAX_SAFE_INTEGER + 1 }),
    /gap/
  );
});

test('creates a GWM-V2 descriptor from source points and supplied adapter commitment', () => {
  const options = {
    walkOptions: { point: 0, shift: 0, gap: 0, horizon: 3, ring: 17 },
    adapterPlanCommitment: HEX.adapter,
    transformProofCommitment: HEX.proof,
    context: { payloadLength: 8 },
    metadata: { label: 'from-points' },
  };
  const stream = createGwmV2TriadStream(POINTS, options.walkOptions, options.context);
  const descriptor = createGwmV2DescriptorFromPoints(POINTS, options);

  assert.equal(descriptor.format, GWM_V2_FORMAT);
  assert.equal(descriptor.sourcePointCommitment, stream.sourcePointCommitment);
  assert.equal(descriptor.triadStreamCommitment, stream.triadStreamCommitment);
  assert.equal(descriptor.adapterPlanCommitment, HEX.adapter);
  assert.equal(descriptor.transformProofCommitment, HEX.proof);
  assert.deepEqual(assertGwmV2Descriptor(descriptor), descriptor);
});

test('descriptor-from-points binds source point and triad stream commitments', () => {
  const options = {
    walkOptions: { point: 0, shift: 0, gap: 0, horizon: 3 },
    adapterPlanCommitment: HEX.adapter,
    context: { payloadLength: 8 },
  };
  const descriptor = createGwmV2DescriptorFromPoints(POINTS, options);
  const changedPoint = clone(POINTS);
  changedPoint[1][0] = 2;
  const changedWalk = createGwmV2DescriptorFromPoints(POINTS, {
    ...options,
    walkOptions: { point: 0, shift: 0, gap: 1, horizon: 3 },
  });

  assert.notEqual(createGwmV2DescriptorFromPoints(changedPoint, options).descriptorCommitment, descriptor.descriptorCommitment);
  assert.notEqual(changedWalk.descriptorCommitment, descriptor.descriptorCommitment);
  assert.notEqual(changedWalk.triadStreamCommitment, descriptor.triadStreamCommitment);
});

test('descriptor-from-points rejects missing adapter plan commitment', () => {
  assert.throws(
    () => createGwmV2DescriptorFromPoints(POINTS, {
      walkOptions: { point: 0, shift: 0, gap: 0 },
    }),
    /adapterPlanCommitment/
  );
});

test('GWM-V2 source, stream, and descriptor helpers defensively clone inputs and results', () => {
  const points = clone(OBJECT_POINTS);
  const walkOptions = { point: 0, shift: 0, gap: 0, horizon: 3, ring: 17 };
  const context = { payloadLength: 8 };
  const metadata = { labels: ['copy-check'] };
  const stream = createGwmV2TriadStream(points, walkOptions, context);
  const descriptor = createGwmV2DescriptorFromPoints(points, {
    walkOptions,
    adapterPlanCommitment: HEX.adapter,
    context,
    metadata,
  });

  points[1].x = 99;
  walkOptions.gap = 99;
  context.payloadLength = 99;
  metadata.labels.push('mutated');

  assert.deepEqual(stream.sourcePoints, POINTS);
  assert.equal(stream.walkOptions.gap, 0);
  assert.equal(stream.triadStream.context.payloadLength, 8);
  assert.equal(descriptor.walkOptions.gap, 0);
  assert.equal(descriptor.context.payloadLength, 8);
  assert.deepEqual(descriptor.metadata.labels, ['copy-check']);

  stream.sourcePoints[0][0] = 88;
  stream.walkOptions.gap = 88;
  stream.triadStream.records[0].triad.A[0] = 88;
  descriptor.walkOptions.gap = 88;
  descriptor.context.payloadLength = 88;
  descriptor.metadata.labels.push('local');

  const freshStream = createGwmV2TriadStream(OBJECT_POINTS, { point: 0, shift: 0, gap: 0, horizon: 3, ring: 17 }, {
    payloadLength: 8,
  });
  const freshDescriptor = createGwmV2DescriptorFromPoints(OBJECT_POINTS, {
    walkOptions: { point: 0, shift: 0, gap: 0, horizon: 3, ring: 17 },
    adapterPlanCommitment: HEX.adapter,
    context: { payloadLength: 8 },
    metadata: { labels: ['copy-check'] },
  });

  assert.deepEqual(freshStream.sourcePoints, POINTS);
  assert.equal(freshStream.walkOptions.gap, 0);
  assert.equal(freshStream.triadStream.records[0].triad.A[0], 0);
  assert.equal(freshDescriptor.walkOptions.gap, 0);
  assert.equal(freshDescriptor.context.payloadLength, 8);
  assert.deepEqual(freshDescriptor.metadata.labels, ['copy-check']);
});

test('creates a valid UN-GWM-V2 descriptor', () => {
  const descriptor = createFixture();

  assert.equal(descriptor.format, GWM_V2_FORMAT);
  assert.equal(descriptor.version, GWM_V2_VERSION);
  assert.equal(descriptor.mode, 'UN-GWM-V2');
  assert.equal(descriptor.sourcePointCommitment, HEX.source);
  assert.equal(descriptor.triadStreamCommitment, HEX.stream);
  assert.equal(descriptor.adapterPlanCommitment, HEX.adapter);
  assert.equal(descriptor.transformProofCommitment, HEX.proof);
  assert.match(descriptor.descriptorCommitment, /^[0-9a-f]{64}$/);
});

test('normalizes descriptor input and verifies supplied descriptor commitment', () => {
  const descriptor = createFixture();
  const normalized = normalizeGwmV2Descriptor({
    metadata: { flags: ['pure-descriptor'], label: 'fixture' },
    context: { bounds: { payloadLength: 8 }, purpose: 'sprint-39-test' },
    transformProofCommitment: HEX.proof,
    adapterPlanCommitment: HEX.adapter,
    triadStreamCommitment: HEX.stream,
    walkOptions: { ring: 5, horizon: 12, gap: 2, shift: 1, point: 0 },
    sourcePointCommitment: HEX.source,
    mode: 'UN-GWM-V2',
    version: GWM_V2_VERSION,
    format: GWM_V2_FORMAT,
    descriptorCommitment: descriptor.descriptorCommitment,
  });

  assert.deepEqual(normalized, descriptor);
});

test('returns canonical payload without descriptorCommitment', () => {
  const descriptor = createFixture();
  const payload = gwmV2Payload(descriptor);

  assert.equal(Object.hasOwn(payload, 'descriptorCommitment'), false);
  assert.equal(gwmV2Commitment(payload), descriptor.descriptorCommitment);
});

test('descriptor commitment is deterministic for equivalent input', () => {
  const left = createFixture();
  const right = createGwmV2Descriptor({
    metadata: { flags: ['pure-descriptor'], label: 'fixture' },
    context: { bounds: { payloadLength: 8 }, purpose: 'sprint-39-test' },
    transformProofCommitment: HEX.proof,
    adapterPlanCommitment: HEX.adapter,
    triadStreamCommitment: HEX.stream,
    walkOptions: { ring: 5, horizon: 12, gap: 2, shift: 1, point: 0 },
    sourcePointCommitment: HEX.source,
  });

  assert.equal(right.descriptorCommitment, left.descriptorCommitment);
  assert.deepEqual(right, left);
});

test('descriptor commitment changes when source point commitment changes', () => {
  assert.notEqual(changedCommitment({}), changedCommitment({ sourcePointCommitment: HEX.source2 }));
});

test('descriptor commitment changes when walk options change', () => {
  assert.notEqual(
    changedCommitment({}),
    changedCommitment({ walkOptions: { point: 0, shift: 1, gap: 3, horizon: 12, ring: 5 } })
  );
});

test('descriptor commitment changes when triad stream commitment changes', () => {
  assert.notEqual(changedCommitment({}), changedCommitment({ triadStreamCommitment: HEX.stream2 }));
});

test('descriptor commitment changes when adapter plan commitment changes', () => {
  assert.notEqual(changedCommitment({}), changedCommitment({ adapterPlanCommitment: HEX.adapter2 }));
});

test('descriptor commitment changes when transform proof commitment changes', () => {
  assert.notEqual(
    changedCommitment({}),
    changedCommitment({ transformProofCommitment: HEX.proof2 })
  );
});

test('descriptor commitment changes when context changes', () => {
  assert.notEqual(
    changedCommitment({}),
    changedCommitment({ context: { purpose: 'changed', bounds: { payloadLength: 8 } } })
  );
});

test('descriptor commitment changes when metadata changes', () => {
  assert.notEqual(
    changedCommitment({}),
    changedCommitment({ metadata: { label: 'changed', flags: ['pure-descriptor'] } })
  );
});

test('optional transform proof, context, and metadata default to committed canonical values', () => {
  const descriptor = createGwmV2Descriptor({
    sourcePointCommitment: HEX.source,
    walkOptions: { point: 0, shift: 0, gap: 0 },
    triadStreamCommitment: HEX.stream,
    adapterPlanCommitment: HEX.adapter,
  });

  assert.equal(descriptor.transformProofCommitment, null);
  assert.deepEqual(descriptor.context, {});
  assert.deepEqual(descriptor.metadata, {});
  assert.match(descriptor.descriptorCommitment, /^[0-9a-f]{64}$/);
});

test('rejects malformed descriptor shapes', () => {
  assert.throws(() => normalizeGwmV2Descriptor(null), /descriptor must be an object/);
  assert.throws(() => normalizeGwmV2Descriptor([]), /descriptor must be an object/);
  assert.throws(
    () => normalizeGwmV2Descriptor(descriptorInput({ unsupported: true })),
    /descriptor.unsupported is not supported/
  );
  assert.throws(
    () => normalizeGwmV2Descriptor({
      ...descriptorInput(),
      descriptorCommitment: '0'.repeat(64),
    }),
    /descriptorCommitment mismatch/
  );
});

test('rejects unsupported format, version, and mode values', () => {
  assert.throws(
    () => normalizeGwmV2Descriptor(descriptorInput({ format: 'UN-GWM-V2' })),
    /format/
  );
  assert.throws(
    () => normalizeGwmV2Descriptor(descriptorInput({ version: 2 })),
    /version/
  );
  assert.throws(
    () => normalizeGwmV2Descriptor(descriptorInput({ mode: 'UN-GWM' })),
    /mode/
  );
});

test('rejects invalid commitment strings', () => {
  assert.throws(
    () => createFixture({ sourcePointCommitment: 'not-hex' }),
    /sourcePointCommitment/
  );
  assert.throws(
    () => createFixture({ triadStreamCommitment: 'A'.repeat(64) }),
    /triadStreamCommitment/
  );
  assert.throws(
    () => createFixture({ adapterPlanCommitment: '1'.repeat(63) }),
    /adapterPlanCommitment/
  );
  assert.throws(
    () => createFixture({ transformProofCommitment: 'z'.repeat(64) }),
    /transformProofCommitment/
  );
});

test('rejects missing required commitments', () => {
  for (const fieldName of [
    'sourcePointCommitment',
    'triadStreamCommitment',
    'adapterPlanCommitment',
  ]) {
    const input = descriptorInput();
    delete input[fieldName];
    assert.throws(() => normalizeGwmV2Descriptor(input), new RegExp(fieldName));
  }
});

test('rejects unsafe integer walk options', () => {
  assert.throws(
    () => createFixture({ walkOptions: { point: 1.2, shift: 0, gap: 0 } }),
    /walkOptions.point/
  );
  assert.throws(
    () => createFixture({ walkOptions: { point: -1, shift: 0, gap: 0 } }),
    /walkOptions.point/
  );
  assert.throws(
    () => createFixture({ walkOptions: { point: 0, shift: 0, gap: 0, horizon: 0 } }),
    /walkOptions.horizon/
  );
  assert.throws(
    () => createFixture({ walkOptions: { point: 0, shift: 0, gap: 0, ring: 0 } }),
    /walkOptions.ring/
  );
  assert.throws(
    () => createFixture({ walkOptions: { point: Number.MAX_SAFE_INTEGER + 1, shift: 0, gap: 0 } }),
    /walkOptions.point/
  );
});

test('defensively clones descriptor, walk options, context, and metadata', () => {
  const input = descriptorInput();
  const descriptor = createGwmV2Descriptor(input);

  input.walkOptions.gap = 99;
  input.context.bounds.payloadLength = 999;
  input.metadata.flags.push('mutated');

  assert.equal(descriptor.walkOptions.gap, 2);
  assert.equal(descriptor.context.bounds.payloadLength, 8);
  assert.deepEqual(descriptor.metadata.flags, ['pure-descriptor']);

  descriptor.walkOptions.gap = 100;
  descriptor.context.bounds.payloadLength = 1000;
  descriptor.metadata.flags.push('local-mutation');

  const normalized = normalizeGwmV2Descriptor(createFixture());
  assert.equal(normalized.walkOptions.gap, 2);
  assert.equal(normalized.context.bounds.payloadLength, 8);
  assert.deepEqual(normalized.metadata.flags, ['pure-descriptor']);
});

test('assertGwmV2Descriptor accepts valid descriptors and rejects malformed descriptors', () => {
  const descriptor = createFixture();

  assert.deepEqual(assertGwmV2Descriptor(descriptor), descriptor);
  assert.throws(
    () => assertGwmV2Descriptor({ ...descriptor, adapterPlanCommitment: HEX.adapter2 }),
    /descriptorCommitment mismatch/
  );
});

test('public exports are available through packages/core', () => {
  for (const name of [
    'GWM_V2_FORMAT',
    'GWM_V2_VERSION',
    'GWM_V2_SOURCE_POINT_FORMAT',
    'GWM_V2_SOURCE_POINT_VERSION',
    'assertGwmV2SourcePoints',
    'gwmV2SourcePointPayload',
    'gwmV2SourcePointCommitment',
    'normalizeGwmV2Descriptor',
    'gwmV2Payload',
    'gwmV2Commitment',
    'createGwmV2Descriptor',
    'createGwmV2TriadStream',
    'createGwmV2DescriptorFromPoints',
    'assertGwmV2Descriptor',
  ]) {
    assert.equal(core[name], require('../src/gwm-v2')[name]);
  }
});

test('root legacy export remains the Unobtainium constructor', () => {
  const exported = require('../../..');

  assert.equal(typeof exported, 'function');
  assert.equal(exported.name, 'Unobtainium');
});

test('existing UN-GWM instruction stream behavior remains unchanged', () => {
  const stream = generateInstructionStream({
    mesh: {
      points: [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
    },
    state: { point: 0, shift: 1, gap: 1 },
    count: 3,
    windowSize: 16,
    minShift: 0,
  });

  assert.deepEqual(stream.instructions.map((instruction) => instruction.shift), [0, 1, 15]);
  assert.deepEqual(stream.instructions.map((instruction) => instruction.indices), [
    [0, 1, 2],
    [1, 2, 3],
    [2, 3, 0],
  ]);
  assert.deepEqual(stream.stateAfter, { point: 3, shift: 1, gap: 1 });
});

test('UN-GWM-V2 descriptor module does not reference transform or integration helpers', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'gwm-v2.js'), 'utf8');
  const forbiddenNames = [
    'adaptTriadStreamToInstructionPlan',
    'applyTriadInstructionPlan',
    'generateInstructionStream',
    'applyRotateTransform',
    'applySwapTransform',
    'applyStack',
    'createCascadeReport',
    'createCertificate',
    'createCutout',
  ];

  for (const name of forbiddenNames) {
    assert.equal(source.includes(name), false, `${name} must remain outside gwm-v2.js`);
  }
});
