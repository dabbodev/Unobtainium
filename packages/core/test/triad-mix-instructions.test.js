'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const core = require('..');
const { generateInstructionStream } = require('../src/instruction-stream');

const {
  TRIAD_INSTRUCTION_FORMAT,
  TRIAD_INSTRUCTION_VERSION,
  TRIAD_STREAM_FORMAT,
  TRIAD_STREAM_VERSION,
  extractTriadFeatures,
  triadInstructionPayload,
  triadInstructionCommitment,
  triadStreamPayload,
  triadStreamCommitment,
  emitTriadInstructionChannels,
  createTriadInstructionStream,
  createTriadInstructionStreamFromWalk,
  emitTriadRotateChannel,
  emitTriadPositionChannel,
  emitTriadRuleChannel,
  assertTriadInstructionChannels,
  assertTriadInstructionStream,
} = core;

const BASE_TRIAD = [
  [1, 2, 3],
  [4, 6, 8],
  [-2, 5, 7],
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function baseChannels(context = { walkIndex: 2, ring: 17, payloadLength: 11 }) {
  return emitTriadInstructionChannels(BASE_TRIAD, context);
}

test('emits valid instruction channels from extracted triad features', () => {
  const features = extractTriadFeatures(BASE_TRIAD, { walkIndex: 2, ring: 17 });
  const channels = emitTriadInstructionChannels(features, {
    context: { walkIndex: 2, ring: 17, payloadLength: 11 },
  });

  assert.equal(channels.format, TRIAD_INSTRUCTION_FORMAT);
  assert.equal(channels.version, TRIAD_INSTRUCTION_VERSION);
  assert.equal(channels.triadFeatureCommitment, features.triadFeatureCommitment);
  assert.deepEqual(Object.keys(channels.channels).sort(), ['explain', 'position', 'rotate', 'rule']);
  assert.deepEqual(assertTriadInstructionChannels(channels), channels);
});

test('emits instruction channels directly from a raw triad', () => {
  const channels = baseChannels();

  assert.match(channels.triadFeatureCommitment, /^[0-9a-f]{64}$/);
  assert.match(channels.triadInstructionCommitment, /^[0-9a-f]{64}$/);
  assert.equal(channels.channels.explain.featureCommitment, channels.triadFeatureCommitment);
});

test('rotate channel uses bounded default ring when no ring is supplied', () => {
  const rotate = emitTriadRotateChannel(extractTriadFeatures(BASE_TRIAD));

  assert.equal(rotate.ring, 256);
  assert.ok(rotate.delta >= 0);
  assert.ok(rotate.delta < rotate.ring);
});

test('rotate channel delta stays within supplied ring bounds', () => {
  const channels = baseChannels({ walkIndex: 2, ring: 7, payloadLength: 11 });

  assert.equal(channels.channels.rotate.ring, 7);
  assert.ok(channels.channels.rotate.delta >= 0);
  assert.ok(channels.channels.rotate.delta < 7);
});

test('rotate channel direction is deterministic', () => {
  const first = baseChannels();
  const second = baseChannels();

  assert.equal(first.channels.rotate.direction, second.channels.rotate.direction);
  assert.match(first.channels.rotate.direction, /^(up|down)$/);
});

test('position channel indexes stay within supplied payload bounds', () => {
  const position = emitTriadPositionChannel(extractTriadFeatures(BASE_TRIAD), {
    context: { payloadLength: 5, walkIndex: 9 },
  });

  assert.equal(position.span, 5);
  assert.ok(position.a >= 0);
  assert.ok(position.a < 5);
  assert.ok(position.b >= 0);
  assert.ok(position.b < 5);
});

test('position channel indexes stay within supplied span bounds', () => {
  const position = emitTriadPositionChannel(extractTriadFeatures(BASE_TRIAD), {
    context: { span: 3, payloadLength: 20 },
  });

  assert.equal(position.span, 3);
  assert.ok(position.a >= 0);
  assert.ok(position.a < 3);
  assert.ok(position.b >= 0);
  assert.ok(position.b < 3);
});

test('position channel emits abstract seed and null indexes without bounds', () => {
  const channels = emitTriadInstructionChannels(BASE_TRIAD, { walkIndex: 4 });

  assert.equal(Number.isSafeInteger(channels.channels.position.seed), true);
  assert.equal(channels.channels.position.span, null);
  assert.equal(channels.channels.position.a, null);
  assert.equal(channels.channels.position.b, null);
  assert.ok(channels.channels.explain.notes.some((note) => note.includes('abstract')));
});

test('rule channel includes selected mix pattern and angle bucket', () => {
  const rule = emitTriadRuleChannel(extractTriadFeatures(BASE_TRIAD), {
    context: { walkIndex: 2, ring: 17 },
  });

  assert.match(rule.angleBucket, /acute|right|obtuse|straight|degenerate/);
  assert.match(rule.mixPattern, /point-balanced|edge-weighted|orientation-selected|centroid-coupled|walk-index-coupled/);
  assert.deepEqual(rule.sourceFeatureFamilies, ['points', 'edges', 'triangle', 'context']);
});

test('explain channel includes feature commitment and selected pattern', () => {
  const channels = baseChannels();

  assert.equal(channels.channels.explain.featureCommitment, channels.triadFeatureCommitment);
  assert.equal(channels.channels.explain.selectedPattern, channels.channels.rule.mixPattern);
  assert.equal(channels.channels.explain.changedByPointOrder, true);
});

test('same triad and context produce same channels and same commitment', () => {
  const first = baseChannels();
  const second = emitTriadInstructionChannels(clone(BASE_TRIAD), {
    payloadLength: 11,
    ring: 17,
    walkIndex: 2,
  });

  assert.deepEqual(first, second);
  assert.equal(triadInstructionCommitment(first), first.triadInstructionCommitment);
  assert.equal(triadInstructionCommitment(second), second.triadInstructionCommitment);
});

test('triadInstructionPayload excludes only the instruction commitment field', () => {
  const channels = baseChannels();
  const payload = triadInstructionPayload(channels);

  assert.equal(Object.hasOwn(payload, 'triadInstructionCommitment'), false);
  assert.equal(payload.triadFeatureCommitment, channels.triadFeatureCommitment);
  assert.deepEqual(payload.channels, channels.channels);
});

test('changing A, B, or C changes channels or commitment', () => {
  const base = baseChannels();
  const changedA = emitTriadInstructionChannels([[9, 2, 3], BASE_TRIAD[1], BASE_TRIAD[2]], {
    walkIndex: 2,
    ring: 17,
    payloadLength: 11,
  });
  const changedB = emitTriadInstructionChannels([BASE_TRIAD[0], [4, 9, 8], BASE_TRIAD[2]], {
    walkIndex: 2,
    ring: 17,
    payloadLength: 11,
  });
  const changedC = emitTriadInstructionChannels([BASE_TRIAD[0], BASE_TRIAD[1], [-2, 5, 9]], {
    walkIndex: 2,
    ring: 17,
    payloadLength: 11,
  });

  assert.notEqual(changedA.triadInstructionCommitment, base.triadInstructionCommitment);
  assert.notEqual(changedB.triadInstructionCommitment, base.triadInstructionCommitment);
  assert.notEqual(changedC.triadInstructionCommitment, base.triadInstructionCommitment);
});

test('reordering points changes channels or commitment', () => {
  const abc = baseChannels();
  const bca = emitTriadInstructionChannels([BASE_TRIAD[1], BASE_TRIAD[2], BASE_TRIAD[0]], {
    walkIndex: 2,
    ring: 17,
    payloadLength: 11,
  });

  assert.notEqual(bca.triadFeatureCommitment, abc.triadFeatureCommitment);
  assert.notEqual(bca.triadInstructionCommitment, abc.triadInstructionCommitment);
});

test('changing walk context changes channels or commitment', () => {
  const first = baseChannels({ walkIndex: 2, ring: 17, payloadLength: 11 });
  const second = baseChannels({ walkIndex: 3, ring: 17, payloadLength: 11 });
  const third = baseChannels({ walkIndex: 2, ring: 19, payloadLength: 11 });

  assert.notEqual(first.triadInstructionCommitment, second.triadInstructionCommitment);
  assert.notEqual(first.triadInstructionCommitment, third.triadInstructionCommitment);
});

test('mix pattern changes for at least some context changes', () => {
  const patterns = new Set();
  for (let walkIndex = 0; walkIndex < 12; walkIndex += 1) {
    patterns.add(baseChannels({ walkIndex, ring: 17, payloadLength: 11 }).channels.rule.mixPattern);
  }

  assert.ok(patterns.size > 1);
});

test('degenerate triads emit deterministic flagged channels', () => {
  const triad = [
    [1, 1, 1],
    [1, 1, 1],
    [2, 2, 2],
  ];
  const first = emitTriadInstructionChannels(triad, { payloadLength: 4 });
  const second = emitTriadInstructionChannels(triad, { payloadLength: 4 });

  assert.deepEqual(first, second);
  assert.equal(first.channels.rule.degenerate, true);
  assert.equal(first.channels.rule.repeatedPoint, true);
  assert.equal(first.channels.explain.degenerate, true);
});

test('repeated-point triads preserve repeatedPoint signal', () => {
  const channels = emitTriadInstructionChannels([
    [3, 0, 0],
    [4, 1, 0],
    [3, 0, 0],
  ]);

  assert.equal(channels.channels.rule.repeatedPoint, true);
});

test('assertTriadInstructionChannels rejects malformed output', () => {
  const channels = baseChannels();
  const malformed = clone(channels);
  malformed.channels.rotate.delta = malformed.channels.rotate.ring;

  assert.throws(() => assertTriadInstructionChannels(malformed), /delta/);

  const badCommitment = clone(channels);
  badCommitment.triadInstructionCommitment = '0'.repeat(64);
  assert.throws(() => assertTriadInstructionChannels(badCommitment), /triadInstructionCommitment mismatch/);
});

test('instruction emission does not mutate caller input', () => {
  const triad = clone(BASE_TRIAD);
  const context = { walkIndex: 2, ring: 17, payloadLength: 11 };
  const beforeTriad = clone(triad);
  const beforeContext = clone(context);

  emitTriadInstructionChannels(triad, context);

  assert.deepEqual(triad, beforeTriad);
  assert.deepEqual(context, beforeContext);
});

test('public instruction helpers are exported through packages/core entrypoint', () => {
  assert.equal(TRIAD_INSTRUCTION_FORMAT, 'UN-TRIAD-MIX-INSTRUCTIONS');
  assert.equal(TRIAD_INSTRUCTION_VERSION, 1);
  assert.equal(TRIAD_STREAM_FORMAT, 'UN-TRIAD-MIX-STREAM');
  assert.equal(TRIAD_STREAM_VERSION, 1);
  assert.equal(typeof triadInstructionPayload, 'function');
  assert.equal(typeof triadInstructionCommitment, 'function');
  assert.equal(typeof triadStreamPayload, 'function');
  assert.equal(typeof triadStreamCommitment, 'function');
  assert.equal(typeof emitTriadInstructionChannels, 'function');
  assert.equal(typeof createTriadInstructionStream, 'function');
  assert.equal(typeof createTriadInstructionStreamFromWalk, 'function');
  assert.equal(typeof emitTriadRotateChannel, 'function');
  assert.equal(typeof emitTriadPositionChannel, 'function');
  assert.equal(typeof emitTriadRuleChannel, 'function');
  assert.equal(typeof assertTriadInstructionChannels, 'function');
  assert.equal(typeof assertTriadInstructionStream, 'function');
});

test('root legacy export remains unchanged', () => {
  const Unobtainium = require('../../..');

  assert.equal(typeof Unobtainium, 'function');
  assert.equal(Unobtainium.name, 'Unobtainium');
});

test('existing UN-GWM instruction stream behavior is not integrated with triad emission', () => {
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
  };
  const before = generateInstructionStream(input);

  emitTriadInstructionChannels(BASE_TRIAD, { walkIndex: 2, ring: 17, payloadLength: 11 });

  assert.deepEqual(generateInstructionStream(input), before);
});
