'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const {
  CUTOUT_FORMAT,
  CUTOUT_VERSION,
  applyCutout,
  createCutout,
  cutoutPlanCommitment,
  cutoutPlanPayload,
  cutoutSpanCommitment,
  normalizeCutoutPlan,
  payloadCommitment,
  restoreCutout,
  verifyCutout,
} = require('..');

function basePayload() {
  return Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
}

function basePlan(overrides = {}) {
  return {
    spans: [
      { offset: 1, length: 2, label: 'alpha' },
      { offset: 5, length: 2, label: 'beta' },
    ],
    fillByte: 255,
    label: 'fixture',
    context: { objectId: 'demo' },
    metadata: { sprint: 27 },
    ...overrides,
  };
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function cloneApplied(applied) {
  return {
    ...clonePlain({
      format: applied.format,
      version: applied.version,
      payloadLength: applied.payloadLength,
      fillMode: applied.fillMode,
      fillByte: applied.fillByte,
      spans: applied.spans,
      originalPayloadCommitment: applied.originalPayloadCommitment,
      publicPayloadCommitment: applied.publicPayloadCommitment,
      cutoutPlanCommitment: applied.cutoutPlanCommitment,
      label: applied.label,
      context: applied.context,
      metadata: applied.metadata,
      plan: applied.plan,
    }),
    publicPayload: Buffer.from(applied.publicPayload),
    hiddenSpans: applied.hiddenSpans.map((span) => ({
      ...clonePlain({
        offset: span.offset,
        length: span.length,
        label: span.label,
        spanCommitment: span.spanCommitment,
      }),
      payload: Buffer.from(span.payload),
    })),
  };
}

test('creates a valid cutout from Buffer input', () => {
  const cutout = createCutout(basePayload(), basePlan());

  assert.equal(cutout.format, CUTOUT_FORMAT);
  assert.equal(cutout.version, CUTOUT_VERSION);
  assert.equal(cutout.payloadLength, 8);
  assert.equal(cutout.fillMode, 'byte');
  assert.equal(cutout.fillByte, 255);
  assert.match(cutout.originalPayloadCommitment, /^[0-9a-f]{64}$/);
  assert.match(cutout.publicPayloadCommitment, /^[0-9a-f]{64}$/);
  assert.match(cutout.cutoutPlanCommitment, /^[0-9a-f]{64}$/);
  assert.equal(Buffer.isBuffer(cutout.publicPayload), true);
});

test('creates a valid cutout from Uint8Array input', () => {
  const payload = new Uint8Array(basePayload());
  const cutout = createCutout(payload, basePlan());

  assert.deepEqual([...cutout.publicPayload], [1, 255, 255, 4, 5, 255, 255, 8]);
  assert.deepEqual([...payload], [...basePayload()]);
});

test('creates a valid cutout from byte array input', () => {
  const cutout = createCutout([...basePayload()], basePlan());

  assert.deepEqual(cutout.hiddenSpans.map((span) => [...span.payload]), [
    [2, 3],
    [6, 7],
  ]);
});

test('rejects invalid byte input', () => {
  assert.throws(() => createCutout('not bytes', basePlan()), /Buffer, Uint8Array, or Array/);
  assert.throws(() => createCutout([1, 256], { spans: [{ offset: 0, length: 1 }] }), /byte/);
  assert.throws(() => createCutout([1, NaN], { spans: [{ offset: 0, length: 1 }] }), /byte/);
});

test('rejects invalid span shape', () => {
  assert.throws(() => createCutout(basePayload(), { spans: 'bad' }), /spans/);
  assert.throws(() => createCutout(basePayload(), { spans: [null] }), /spans\[0\]/);
  assert.throws(() => createCutout(basePayload(), { spans: [{ offset: 0, length: 0 }] }), /positive/);
  assert.throws(() => createCutout(basePayload(), {
    spans: [{ offset: Number.POSITIVE_INFINITY, length: 1 }],
  }), /safe integer/);
});

test('rejects negative offset and length', () => {
  assert.throws(() => createCutout(basePayload(), {
    spans: [{ offset: -1, length: 1 }],
  }), /non-negative/);
  assert.throws(() => createCutout(basePayload(), {
    spans: [{ offset: 1, length: -1 }],
  }), /positive/);
});

test('rejects out-of-bounds spans', () => {
  assert.throws(() => createCutout(basePayload(), {
    spans: [{ offset: 7, length: 2 }],
  }), /within payloadLength/);
});

test('rejects overlapping spans', () => {
  assert.throws(() => createCutout(basePayload(), {
    spans: [
      { offset: 1, length: 4 },
      { offset: 3, length: 2 },
    ],
  }), /sorted by offset and must not overlap/);
});

test('rejects unsorted spans rather than canonicalizing them', () => {
  assert.throws(() => createCutout(basePayload(), {
    spans: [
      { offset: 5, length: 1 },
      { offset: 1, length: 1 },
    ],
  }), /sorted by offset/);
});

test('cutout plan commitment is deterministic for equivalent input', () => {
  const first = createCutout(basePayload(), basePlan({
    metadata: { z: 2, a: 1 },
    context: { b: 2, a: 1 },
  }));
  const second = createCutout(Buffer.from(basePayload()), basePlan({
    metadata: { a: 1, z: 2 },
    context: { a: 1, b: 2 },
  }));

  assert.equal(first.cutoutPlanCommitment, second.cutoutPlanCommitment);
  assert.equal(cutoutPlanCommitment(first.plan), first.cutoutPlanCommitment);
  assert.equal(cutoutPlanPayload(first.plan).metadata.a, 1);
});

test('commitment changes when payload changes', () => {
  const first = createCutout(basePayload(), basePlan());
  const changed = Buffer.from(basePayload());
  changed[2] = 99;
  const second = createCutout(changed, basePlan());

  assert.notEqual(first.originalPayloadCommitment, second.originalPayloadCommitment);
  assert.notEqual(first.cutoutPlanCommitment, second.cutoutPlanCommitment);
});

test('span commitment changes when span offset changes', () => {
  const bytes = Buffer.from([2, 3]);

  assert.notEqual(
    cutoutSpanCommitment(bytes, { offset: 1, length: 2, label: 'alpha' }),
    cutoutSpanCommitment(bytes, { offset: 2, length: 2, label: 'alpha' }),
  );
});

test('span commitment changes when span length changes', () => {
  assert.notEqual(
    cutoutSpanCommitment(Buffer.from([2]), { offset: 1, length: 1, label: 'alpha' }),
    cutoutSpanCommitment(Buffer.from([2, 3]), { offset: 1, length: 2, label: 'alpha' }),
  );
});

test('span commitment changes when span label changes', () => {
  const bytes = Buffer.from([2, 3]);

  assert.notEqual(
    cutoutSpanCommitment(bytes, { offset: 1, length: 2, label: 'alpha' }),
    cutoutSpanCommitment(bytes, { offset: 1, length: 2, label: 'changed' }),
  );
});

test('plan commitment changes when metadata or context changes', () => {
  const base = createCutout(basePayload(), basePlan());
  const metadataChanged = createCutout(basePayload(), basePlan({ metadata: { sprint: 27, x: true } }));
  const contextChanged = createCutout(basePayload(), basePlan({ context: { objectId: 'changed' } }));

  assert.notEqual(base.cutoutPlanCommitment, metadataChanged.cutoutPlanCommitment);
  assert.notEqual(base.cutoutPlanCommitment, contextChanged.cutoutPlanCommitment);
});

test('payloadCommitment commits full byte payloads with domain separation', () => {
  assert.match(payloadCommitment(basePayload()), /^[0-9a-f]{64}$/);
  assert.equal(payloadCommitment(basePayload()), payloadCommitment([...basePayload()]));
  assert.notEqual(payloadCommitment(basePayload()), cutoutSpanCommitment(basePayload(), {
    offset: 0,
    length: basePayload().length,
  }));
});

test('applyCutout produces expected public payload with deterministic fill', () => {
  const cutout = applyCutout(basePayload(), basePlan());

  assert.deepEqual([...cutout.publicPayload], [1, 255, 255, 4, 5, 255, 255, 8]);
  assert.equal(cutout.publicPayloadCommitment, payloadCommitment(cutout.publicPayload));
});

test('applyCutout extracts expected hidden spans', () => {
  const cutout = applyCutout(basePayload(), basePlan());

  assert.deepEqual(cutout.hiddenSpans.map((span) => ({
    offset: span.offset,
    length: span.length,
    label: span.label,
    payload: [...span.payload],
  })), [
    { offset: 1, length: 2, label: 'alpha', payload: [2, 3] },
    { offset: 5, length: 2, label: 'beta', payload: [6, 7] },
  ]);
});

test('verifyCutout succeeds with correct public payload and hidden spans', () => {
  const cutout = applyCutout(basePayload(), basePlan());
  const result = verifyCutout(cutout);

  assert.equal(result.ok, true);
  assert.equal(result.cutoutPlanCommitment, cutout.cutoutPlanCommitment);
  assert.equal(result.originalPayloadCommitment, cutout.originalPayloadCommitment);
  assert.equal(result.publicPayloadCommitment, cutout.publicPayloadCommitment);
  assert.equal(result.reconstructedPayloadCommitment, cutout.originalPayloadCommitment);
  assert.equal(result.spanVerification.every((span) => span.ok), true);
});

test('verifyCutout fails when a hidden span is tampered', () => {
  const cutout = cloneApplied(applyCutout(basePayload(), basePlan()));
  cutout.hiddenSpans[0].payload[0] = 99;
  const result = verifyCutout(cutout);

  assert.equal(result.ok, false);
  assert.match(result.reason, /spanCommitment mismatch/);
});

test('verifyCutout fails when public payload is tampered outside the cutout region', () => {
  const cutout = cloneApplied(applyCutout(basePayload(), basePlan()));
  cutout.publicPayload[0] = 99;
  cutout.publicPayloadCommitment = payloadCommitment(cutout.publicPayload);
  const result = verifyCutout(cutout);

  assert.equal(result.ok, false);
  assert.match(result.reason, /reconstructed payload commitment mismatch/);
});

test('verifyCutout fails when public payload fill is tampered inside a cutout region', () => {
  const cutout = cloneApplied(applyCutout(basePayload(), basePlan()));
  cutout.publicPayload[1] = 99;
  cutout.publicPayloadCommitment = payloadCommitment(cutout.publicPayload);
  const result = verifyCutout(cutout);

  assert.equal(result.ok, false);
  assert.match(result.reason, /fill mismatch/);
});

test('verifyCutout fails when original payload commitment does not match reconstruction', () => {
  const cutout = applyCutout(basePayload(), basePlan());
  const result = verifyCutout({
    ...cutout,
    originalPayloadCommitment: 'f'.repeat(64),
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /originalPayloadCommitment mismatch/);
});

test('restoreCutout reconstructs original payload with valid hidden spans', () => {
  const cutout = applyCutout(basePayload(), basePlan());
  const result = restoreCutout(cutout);

  assert.equal(result.ok, true);
  assert.deepEqual([...result.restoredPayload], [...basePayload()]);
  assert.equal(result.reconstructedPayloadCommitment, cutout.originalPayloadCommitment);
});

test('restoreCutout returns invalid for tampered hidden spans', () => {
  const cutout = cloneApplied(applyCutout(basePayload(), basePlan()));
  cutout.hiddenSpans[1].payload[0] = 99;
  const result = restoreCutout(cutout);

  assert.equal(result.ok, false);
  assert.match(result.reason, /spanCommitment mismatch/);
});

test('cutout helpers return defensive copies', () => {
  const payload = basePayload();
  const plan = basePlan({ metadata: { nested: { value: 1 } } });
  const cutout = applyCutout(payload, plan);

  payload[1] = 99;
  plan.metadata.nested.value = 99;
  assert.deepEqual([...cutout.hiddenSpans[0].payload], [2, 3]);
  assert.equal(cutout.metadata.nested.value, 1);
  assert.equal(cutout.plan.metadata.nested.value, 1);

  cutout.plan.metadata.nested.value = 42;
  cutout.publicPayload[0] = 42;
  cutout.hiddenSpans[0].payload[0] = 42;
  assert.equal(cutout.metadata.nested.value, 1);

  const fresh = applyCutout(basePayload(), basePlan({ metadata: { nested: { value: 1 } } }));
  assert.deepEqual([...fresh.publicPayload], [1, 255, 255, 4, 5, 255, 255, 8]);
  assert.deepEqual([...fresh.hiddenSpans[0].payload], [2, 3]);

  const firstRestore = restoreCutout(fresh);
  firstRestore.restoredPayload[0] = 99;
  const secondRestore = restoreCutout(fresh);
  assert.equal(secondRestore.restoredPayload[0], 1);
});

test('normalizeCutoutPlan returns defensive canonical copies', () => {
  const cutout = applyCutout(basePayload(), basePlan());
  const normalized = normalizeCutoutPlan(cutout.plan);

  normalized.spans[0].label = 'changed';
  normalized.metadata.sprint = 99;

  assert.equal(cutout.plan.spans[0].label, 'alpha');
  assert.equal(cutout.plan.metadata.sprint, 27);
});

test('cutout helpers are exported through packages/core entrypoint', () => {
  assert.equal(CUTOUT_FORMAT, 'UN-CUTOUT');
  assert.equal(CUTOUT_VERSION, 1);
  assert.equal(typeof normalizeCutoutPlan, 'function');
  assert.equal(typeof cutoutPlanPayload, 'function');
  assert.equal(typeof cutoutPlanCommitment, 'function');
  assert.equal(typeof createCutout, 'function');
  assert.equal(typeof applyCutout, 'function');
  assert.equal(typeof verifyCutout, 'function');
  assert.equal(typeof restoreCutout, 'function');
  assert.equal(typeof cutoutSpanCommitment, 'function');
  assert.equal(typeof payloadCommitment, 'function');
});

test('root legacy export remains unchanged after cutout export update', () => {
  const Unobtainium = require('../../..');

  assert.equal(typeof Unobtainium, 'function');
  assert.equal(Unobtainium.name, 'Unobtainium');
});

test('tracked node_modules and generated .un files are not reintroduced by cutout work', () => {
  const cwd = path.resolve(__dirname, '../../..');
  const trackedNodeModules = execFileSync('git', ['ls-files', 'node_modules'], {
    cwd,
    encoding: 'utf8',
  }).trim();
  const trackedGeneratedUn = execFileSync('git', ['ls-files', 'out/*.un'], {
    cwd,
    encoding: 'utf8',
  }).trim();

  assert.equal(trackedNodeModules, '');
  assert.equal(trackedGeneratedUn, '');
});
