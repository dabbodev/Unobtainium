'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createContextPacket,
  deriveAnchoredStateFromPacket,
} = require('../src/point-packet');
const { applyPacketGraft } = require('../src/packet-graft');
const { generateInstructionStream } = require('../src/instruction-stream');
const {
  applyRotateTransform,
  reverseRotateTransform,
} = require('../src/rotate-transform');

function baseMesh() {
  return [
    [0, 0, 0],
    [1000000, 0, 0],
    [0, 1000000, 0],
    [0, 0, 1000000],
  ];
}

function packetWithFourPoints() {
  return createContextPacket({
    context: 'packet-graft-order',
    pointCount: 4,
    coordinateRange: 1000000,
  });
}

test('append mode preserves base then packet order', () => {
  const base = baseMesh();
  const packet = packetWithFourPoints();
  const grafted = applyPacketGraft(base, packet, 'append');

  assert.deepEqual(grafted, base.concat(packet.points));
});

test('prepend mode preserves packet then base order', () => {
  const base = baseMesh();
  const packet = packetWithFourPoints();
  const grafted = applyPacketGraft(base, packet, 'prepend');

  assert.deepEqual(grafted, packet.points.concat(base));
});

test('sandwich mode splits packet around base', () => {
  const base = baseMesh();
  const packet = packetWithFourPoints();
  const grafted = applyPacketGraft(base, packet, 'sandwich');

  assert.deepEqual(grafted, packet.points.slice(0, 2).concat(base, packet.points.slice(2)));
});

test('none mode returns a copy, not the same array', () => {
  const base = baseMesh();
  const packet = packetWithFourPoints();
  const grafted = applyPacketGraft(base, packet, 'none');

  assert.deepEqual(grafted, base);
  assert.notEqual(grafted, base);
  assert.notEqual(grafted[0], base[0]);
});

test('base mesh is not mutated', () => {
  const base = baseMesh();
  const packet = packetWithFourPoints();
  const before = JSON.stringify(base);

  applyPacketGraft(base, packet, 'sandwich');

  assert.equal(JSON.stringify(base), before);
});

test('packet is not mutated', () => {
  const base = baseMesh();
  const packet = packetWithFourPoints();
  const before = JSON.stringify(packet);

  applyPacketGraft(base, packet, 'prepend');

  assert.equal(JSON.stringify(packet), before);
});

test('invalid mode throws', () => {
  assert.throws(() => applyPacketGraft(baseMesh(), packetWithFourPoints(), 'interleave'), /mode/);
});

test('malformed mesh and packet throw', () => {
  const packet = packetWithFourPoints();
  const tampered = {
    ...packet,
    points: packet.points.map((point) => point.slice()),
  };
  tampered.points[0][0] += 1;

  assert.throws(() => applyPacketGraft({ points: baseMesh() }, packet), /baseMesh/);
  assert.throws(() => applyPacketGraft([[0, 0]], packet), /baseMesh point/);
  assert.throws(() => applyPacketGraft(baseMesh(), tampered), /commitment/);
});

test('grafted mesh works with instruction stream and rotate transform roundtrip', () => {
  const packet = createContextPacket({ context: 'roundtrip', pointCount: 6 });
  const mesh = applyPacketGraft(baseMesh(), packet, 'append');
  const state = deriveAnchoredStateFromPacket(packet, mesh.length);
  const data = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]);
  const stream = generateInstructionStream({
    mesh,
    state,
    count: data.length,
    windowSize: 256,
    minShift: 1,
    mode: 'permissive',
  });
  const transformed = applyRotateTransform(data, stream.instructions, { turns: 3 });
  const restored = reverseRotateTransform(transformed, stream.instructions, { turns: 3 });

  assert.notDeepEqual([...transformed], [...data]);
  assert.deepEqual([...restored], [...data]);
});
