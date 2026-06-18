'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createContextPacket,
  createNoncePacket,
  createRandomPacket,
  deriveAnchoredStateFromPacket,
} = require('../src/point-packet');

test('context packet is deterministic for the same context', () => {
  const first = createContextPacket({ context: { tenant: 'alpha', session: 7 } });
  const second = createContextPacket({ context: { session: 7, tenant: 'alpha' } });

  assert.deepEqual(first, second);
});

test('different context produces different commitment', () => {
  const first = createContextPacket({ context: 'alpha' });
  const second = createContextPacket({ context: 'beta' });

  assert.notEqual(first.commitment, second.commitment);
});

test('nonce packet is deterministic for the same nonce', () => {
  const first = createNoncePacket({ nonce: Buffer.from([1, 2, 3, 4]) });
  const second = createNoncePacket({ nonce: new Uint8Array([1, 2, 3, 4]) });

  assert.deepEqual(first, second);
});

test('random packet differs across default calls', () => {
  const first = createRandomPacket();
  const second = createRandomPacket();

  assert.notEqual(first.commitment, second.commitment);
});

test('random packet is deterministic with deterministic randomBytes injection', () => {
  const randomBytes = (size) => Buffer.alloc(size, 0xab);
  const first = createRandomPacket({ randomBytes });
  const second = createRandomPacket({ randomBytes });

  assert.deepEqual(first, second);
});

test('packet has expected point count and bounded fixed-point integer triples', () => {
  const packet = createContextPacket({
    context: 'bounded',
    pointCount: 5,
    scale: 1000000,
    coordinateRange: 19,
  });

  assert.equal(packet.type, 'UNPKT-CONTEXT');
  assert.equal(packet.version, 1);
  assert.equal(packet.pointCount, 5);
  assert.equal(packet.points.length, 5);
  packet.points.forEach((point) => {
    assert.equal(point.length, 3);
    point.forEach((coordinate) => {
      assert.equal(Number.isSafeInteger(coordinate), true);
      assert.equal(coordinate >= 0 && coordinate < 19, true);
    });
  });
});

test('packet commitment is stable for deterministic packet fields', () => {
  const first = createContextPacket({
    context: 'stable-commitment',
    pointCount: 3,
    coordinateRange: 1000,
  });
  const second = createContextPacket({
    context: 'stable-commitment',
    pointCount: 3,
    coordinateRange: 1000,
  });

  assert.match(first.commitment, /^[0-9a-f]{64}$/);
  assert.equal(first.commitment, second.commitment);
});

test('malformed context, nonce, pointCount, and coordinateRange throw', () => {
  assert.throws(() => createContextPacket({}), /context/);
  assert.throws(() => createContextPacket({ context: null }), /context/);
  assert.throws(() => createContextPacket({ context: () => {} }), /context/);
  assert.throws(() => createNoncePacket({ nonce: { id: 1 } }), /nonce/);
  assert.throws(() => createContextPacket({ context: 'x', pointCount: 0 }), /pointCount/);
  assert.throws(() => createContextPacket({ context: 'x', pointCount: 1.5 }), /pointCount/);
  assert.throws(() => createContextPacket({ context: 'x', coordinateRange: 0 }), /coordinateRange/);
  assert.throws(() => createContextPacket({ context: 'x', coordinateRange: 1.5 }), /coordinateRange/);
});

test('deriveAnchoredStateFromPacket returns in-range point, shift, and gap', () => {
  const packet = createNoncePacket({ nonce: 'anchor' });
  const state = deriveAnchoredStateFromPacket(packet, 11);

  assert.equal(Number.isInteger(state.point), true);
  assert.equal(Number.isInteger(state.shift), true);
  assert.equal(Number.isInteger(state.gap), true);
  assert.equal(state.point >= 0 && state.point < 11, true);
  assert.equal(state.shift >= 0 && state.shift < 11, true);
  assert.equal(state.gap >= 0 && state.gap < 11, true);
});

test('deriveAnchoredStateFromPacket is deterministic and does not mutate packet', () => {
  const packet = createContextPacket({ context: 'no-mutation' });
  const before = JSON.stringify(packet);
  const first = deriveAnchoredStateFromPacket(packet, 9);
  const second = deriveAnchoredStateFromPacket(packet, 9);

  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(packet), before);
});

test('deriveAnchoredStateFromPacket rejects malformed input', () => {
  const packet = createContextPacket({ context: 'valid' });
  const tampered = {
    ...packet,
    points: packet.points.map((point) => point.slice()),
  };
  tampered.points[0][0] += 1;

  assert.throws(() => deriveAnchoredStateFromPacket(tampered, 8), /commitment/);
  assert.throws(() => deriveAnchoredStateFromPacket(packet, 0), /pointCount/);
});
