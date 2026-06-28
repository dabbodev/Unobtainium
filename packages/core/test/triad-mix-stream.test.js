'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const core = require('..');
const { generateInstructionStream } = require('../src/instruction-stream');

const {
  TRIAD_STREAM_FORMAT,
  TRIAD_STREAM_VERSION,
  createTriadInstructionStream,
  createTriadInstructionStreamFromWalk,
  triadStreamPayload,
  triadStreamCommitment,
  assertTriadInstructionStream,
} = core;

const TRIADS = [
  [
    [1, 2, 3],
    [4, 6, 8],
    [-2, 5, 7],
  ],
  [
    [0, 0, 0],
    [3, 1, 2],
    [5, 8, 13],
  ],
  [
    [1, 1, 1],
    [1, 1, 1],
    [2, 2, 2],
  ],
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function baseStream(context = { walkIndex: 2, ring: 17, payloadLength: 11 }) {
  return createTriadInstructionStream(TRIADS, context);
}

test('creates a valid triad instruction stream from multiple triads', () => {
  const stream = baseStream();

  assert.equal(stream.format, TRIAD_STREAM_FORMAT);
  assert.equal(stream.version, TRIAD_STREAM_VERSION);
  assert.match(stream.streamCommitment, /^[0-9a-f]{64}$/);
  assert.equal(stream.records.length, TRIADS.length);
  assert.deepEqual(assertTriadInstructionStream(stream), stream);
});

test('stream records preserve input order and contain channel summaries', () => {
  const stream = baseStream();

  assert.deepEqual(stream.records.map((record) => record.index), [0, 1, 2]);
  assert.deepEqual(stream.records[0].triad.A, TRIADS[0][0]);
  assert.deepEqual(stream.records[1].triad.A, TRIADS[1][0]);
  assert.deepEqual(stream.records[2].triad.A, TRIADS[2][0]);

  for (const record of stream.records) {
    assert.match(record.triadFeatureCommitment, /^[0-9a-f]{64}$/);
    assert.match(record.triadInstructionCommitment, /^[0-9a-f]{64}$/);
    assert.equal(typeof record.rotate.delta, 'number');
    assert.equal(typeof record.position.seed, 'number');
    assert.equal(typeof record.rule.mixPattern, 'string');
    assert.equal(Array.isArray(record.explain.notes), true);
  }
});

test('same triads and context produce the same stream commitment', () => {
  const first = baseStream();
  const second = createTriadInstructionStream(clone(TRIADS), {
    payloadLength: 11,
    ring: 17,
    walkIndex: 2,
  });

  assert.deepEqual(first, second);
  assert.equal(triadStreamCommitment(first), first.streamCommitment);
  assert.equal(triadStreamCommitment(second), second.streamCommitment);
});

test('changing a triad changes the stream commitment', () => {
  const base = baseStream();
  const changed = clone(TRIADS);
  changed[1][2][0] += 1;

  assert.notEqual(createTriadInstructionStream(changed, base.context).streamCommitment, base.streamCommitment);
});

test('reordering triads changes the stream commitment', () => {
  const base = baseStream();
  const reordered = createTriadInstructionStream([TRIADS[1], TRIADS[0], TRIADS[2]], base.context);

  assert.notEqual(reordered.streamCommitment, base.streamCommitment);
  assert.deepEqual(reordered.records.map((record) => record.triad.A), [
    TRIADS[1][0],
    TRIADS[0][0],
    TRIADS[2][0],
  ]);
});

test('changing context changes the stream commitment', () => {
  const first = baseStream({ walkIndex: 2, ring: 17, payloadLength: 11 });
  const second = baseStream({ walkIndex: 3, ring: 17, payloadLength: 11 });

  assert.notEqual(second.streamCommitment, first.streamCommitment);
});

test('triadStreamPayload excludes only the stream commitment and returns copies', () => {
  const stream = baseStream();
  const payload = triadStreamPayload(stream);

  assert.equal(Object.hasOwn(payload, 'streamCommitment'), false);
  assert.equal(payload.records[0].triadFeatureCommitment, stream.records[0].triadFeatureCommitment);
  payload.records[0].triad.A[0] = 99;

  assert.equal(stream.records[0].triad.A[0], 1);
});

test('malformed and empty triad arrays are rejected', () => {
  assert.throws(() => createTriadInstructionStream('not triads'), /triads must be an array/);
  assert.throws(() => createTriadInstructionStream([]), /at least one triad/);
  assert.throws(() => createTriadInstructionStream([[1, 2, 3]]), /triad\.A/);
  assert.throws(() => createTriadInstructionStream([TRIADS[0]], { unsupported: 1 }), /not supported/);
});

test('degenerate triads are represented deterministically in stream records', () => {
  const first = createTriadInstructionStream([TRIADS[2]], { payloadLength: 4 });
  const second = createTriadInstructionStream([clone(TRIADS[2])], { payloadLength: 4 });

  assert.deepEqual(first, second);
  assert.equal(first.records[0].rule.degenerate, true);
  assert.equal(first.records[0].rule.repeatedPoint, true);
  assert.equal(first.records[0].explain.degenerate, true);
});

test('stream creation does not mutate caller input', () => {
  const triads = clone(TRIADS);
  const context = { walkIndex: 2, ring: 17, payloadLength: 11 };
  const beforeTriads = clone(triads);
  const beforeContext = clone(context);

  createTriadInstructionStream(triads, context);

  assert.deepEqual(triads, beforeTriads);
  assert.deepEqual(context, beforeContext);
});

test('assertTriadInstructionStream rejects malformed streams', () => {
  const stream = baseStream();
  const badRecord = clone(stream);
  badRecord.records[0].rotate.delta = badRecord.records[0].rotate.ring;
  assert.throws(() => assertTriadInstructionStream(badRecord), /does not match/);

  const badCommitment = clone(stream);
  badCommitment.streamCommitment = '0'.repeat(64);
  assert.throws(() => assertTriadInstructionStream(badCommitment), /streamCommitment mismatch/);

  const badIndex = clone(stream);
  badIndex.records[1].index = 0;
  assert.throws(() => assertTriadInstructionStream(badIndex), /index/);
});

test('creates deterministic triad instruction streams from walk-selected points', () => {
  const points = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const walkOptions = {
    state: { point: 0, shift: 1, gap: 1 },
    count: 3,
    mode: 'distinct',
  };
  const first = createTriadInstructionStreamFromWalk(points, walkOptions, { payloadLength: 8 });
  const second = createTriadInstructionStreamFromWalk(clone(points), clone(walkOptions), { payloadLength: 8 });

  assert.deepEqual(first, second);
  assert.equal(first.records.length, 3);
  assert.deepEqual(first.records[0].triad, {
    A: [0, 0, 0],
    B: [0, 1, 0],
    C: [1, 0, 0],
  });
});

test('walk stream adapter does not alter existing UN-GWM behavior', () => {
  const input = {
    mesh: {
      points: [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
    },
    state: { point: 0, shift: 1, gap: 1 },
    count: 4,
    windowSize: 16,
    mode: 'distinct',
  };
  const before = generateInstructionStream(input);

  createTriadInstructionStreamFromWalk(input.mesh.points, {
    state: input.state,
    count: 3,
    mode: 'distinct',
  });

  assert.deepEqual(generateInstructionStream(input), before);
});

test('public stream helpers are exported through packages/core entrypoint', () => {
  assert.equal(TRIAD_STREAM_FORMAT, 'UN-TRIAD-MIX-STREAM');
  assert.equal(TRIAD_STREAM_VERSION, 1);
  assert.equal(typeof triadStreamPayload, 'function');
  assert.equal(typeof triadStreamCommitment, 'function');
  assert.equal(typeof createTriadInstructionStream, 'function');
  assert.equal(typeof createTriadInstructionStreamFromWalk, 'function');
  assert.equal(typeof assertTriadInstructionStream, 'function');
});

test('root legacy export remains unchanged for triad streams', () => {
  const Unobtainium = require('../../..');

  assert.equal(typeof Unobtainium, 'function');
  assert.equal(Unobtainium.name, 'Unobtainium');
});
