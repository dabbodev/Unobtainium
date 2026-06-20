'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  applyResidual,
  cascadeReportCommitment,
  cascadeReportPayload,
  createCascadeReport,
  createSignedStackEnvelope,
  deriveKeyMeshFromString,
  generateEd25519KeyPair,
  generateFromStack,
  residualBetween,
  runCascade,
  scoreResidual,
} = require('..');

function baseMesh() {
  return [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 0],
    [0, 1, 1],
  ];
}

function state() {
  return { point: 0, shift: 1, gap: 1 };
}

function rotateLayer(mesh = baseMesh(), overrides = {}) {
  return {
    id: 'cascade-rotate',
    type: 'UN-ROTATE',
    mesh,
    graftMode: 'none',
    stateMode: 'explicit',
    state: state(),
    direction: 'up',
    turns: 1,
    minShift: 1,
    walkMode: 'permissive',
    ...overrides,
  };
}

function swapLayer(mesh = baseMesh(), overrides = {}) {
  return {
    id: 'cascade-swap',
    type: 'UN-SWAP',
    mesh,
    graftMode: 'none',
    stateMode: 'explicit',
    state: state(),
    swapCount: 4,
    minShift: 1,
    walkMode: 'permissive',
    ...overrides,
  };
}

function stack(overrides = {}) {
  return {
    format: 'UNSTACK',
    version: 1,
    windowSize: 256,
    metadata: { sprint: 18 },
    layers: [rotateLayer()],
    ...overrides,
  };
}

function rotateStack(turns, id = `candidate-r${turns}`) {
  return {
    id,
    stack: stack({
      layers: [rotateLayer(baseMesh(), { turns })],
    }),
    metadata: { turns },
  };
}

function mixedStack(mesh = baseMesh(), overrides = {}) {
  return stack({
    layers: [
      rotateLayer(mesh, { id: 'rotate-a', turns: 1 }),
      swapLayer(mesh, { id: 'swap-b', swapCount: 5 }),
    ],
    ...overrides,
  });
}

function signedCandidate(recipe = stack(), id = 'signed-candidate') {
  const keys = generateEd25519KeyPair();
  const signedStackEnvelope = createSignedStackEnvelope({
    stack: recipe,
    signerId: 'owner:cascade',
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
    purpose: 'owner-signed-stack',
    metadata: { signed: true },
  });

  return {
    id,
    signedStackEnvelope,
    metadata: { signed: true },
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function withRingDelta(data, index, delta, windowSize = 256) {
  const next = data.slice();
  next[index] = (next[index] + delta + windowSize) % windowSize;
  return next;
}

function reportOptions(overrides = {}) {
  return {
    target: [3, 1, 4, 1, 5, 9, 2, 6],
    candidates: [rotateStack(1, 'a'), rotateStack(2, 'b')],
    metadata: { purpose: 'cascade-test' },
    ...overrides,
  };
}

test('runCascade returns a valid empty run with final residual equal to original target', () => {
  const target = [1, 2, 3, 4];
  const run = runCascade({ target, candidates: [] });

  assert.equal(run.format, 'UN-CASCADE-RUN');
  assert.equal(run.version, 1);
  assert.equal(run.layerCount, 0);
  assert.deepEqual(run.layers, []);
  assert.equal(run.finalResidualCommitment, run.originalTargetCommitment);
  assert.deepEqual(run.finalScore, scoreResidual(target));
});

test('runCascade creates a single ordered layer for an unsigned stack candidate', () => {
  const candidate = rotateStack(1, 'unsigned-a');
  const run = runCascade({
    target: [3, 1, 4, 1, 5, 9, 2, 6],
    candidates: [candidate],
  });
  const layer = run.layers[0];

  assert.equal(run.layerCount, 1);
  assert.equal(layer.index, 0);
  assert.equal(layer.candidateId, 'unsigned-a');
  assert.equal(layer.inputTargetCommitment, run.originalTargetCommitment);
  assert.equal(run.finalResidualCommitment, layer.residualCommitment);
  assert.match(layer.candidateCommitment, /^[0-9a-f]{64}$/);
  assert.match(layer.generatedCommitment, /^[0-9a-f]{64}$/);
  assert.match(layer.residualCommitment, /^[0-9a-f]{64}$/);
  assert.match(layer.descriptorCommitment, /^[0-9a-f]{64}$/);
  assert.equal(layer.score.residualLength, 8);
  assert.deepEqual(layer.metadata, { turns: 1 });
});

test('runCascade carries each residual commitment forward as the next input target', () => {
  const run = runCascade({
    target: [3, 1, 4, 1, 5, 9, 2, 6],
    candidates: [rotateStack(1, 'a'), rotateStack(2, 'b'), rotateStack(3, 'c')],
  });

  assert.deepEqual(run.layers.map((layer) => layer.candidateId), ['a', 'b', 'c']);
  assert.equal(run.layers[0].inputTargetCommitment, run.originalTargetCommitment);
  assert.equal(run.layers[1].inputTargetCommitment, run.layers[0].residualCommitment);
  assert.equal(run.layers[2].inputTargetCommitment, run.layers[1].residualCommitment);
  assert.equal(run.finalResidualCommitment, run.layers[2].residualCommitment);
  run.layers.forEach((layer) => assert.equal(typeof layer.score.sumAbsDelta, 'number'));
});

test('runCascade does not mutate target, candidates, stacks, signed envelopes, or metadata', () => {
  const target = [3, 1, 4, 1, 5, 9, 2, 6];
  const unsigned = rotateStack(1, 'unsigned');
  const signed = signedCandidate(rotateStack(2).stack, 'signed');
  const candidates = [unsigned, signed];
  const metadata = { nested: { b: 2, a: 1 } };
  const before = {
    target: target.slice(),
    candidates: clone(candidates),
    metadata: clone(metadata),
  };

  runCascade({ target, candidates, metadata });

  assert.deepEqual(target, before.target);
  assert.deepEqual(candidates, before.candidates);
  assert.deepEqual(metadata, before.metadata);
});

test('runCascade works with signed stack candidates', () => {
  const candidate = signedCandidate(rotateStack(2).stack, 'signed-a');
  const run = runCascade({
    target: [2, 7, 1, 8, 2, 8, 1, 8],
    candidates: [candidate],
  });
  const layer = run.layers[0];

  assert.equal(layer.candidateId, 'signed-a');
  assert.match(layer.signedStackPayloadCommitment, /^[0-9a-f]{64}$/);
  assert.match(layer.stackCommitment, /^[0-9a-f]{64}$/);
  assert.match(layer.descriptorCommitment, /^[0-9a-f]{64}$/);
});

test('runCascade works with keyfile-derived mesh stacks', () => {
  const mesh = deriveKeyMeshFromString('cascade keyfile mesh', { pointCount: 8 });
  const candidate = {
    id: 'keyfile-derived',
    stack: stack({
      metadata: { source: 'keyfile-derived' },
      layers: [rotateLayer(mesh, { turns: 1 })],
    }),
    metadata: { source: 'keyfile-derived' },
  };
  const run = runCascade({
    target: [1, 1, 2, 3, 5, 8, 13, 21],
    candidates: [candidate],
  });

  assert.equal(run.layers[0].candidateId, 'keyfile-derived');
  assert.equal(run.layers[0].score.residualLength, 8);
});

test('runCascade works with mixed UN-ROTATE and UN-SWAP stack candidates', () => {
  const candidate = {
    id: 'mixed',
    stack: mixedStack(),
    metadata: { mixed: true },
  };
  const run = runCascade({
    target: [8, 6, 7, 5, 3, 0, 9, 9],
    candidates: [candidate],
  });

  assert.equal(run.layers[0].candidateId, 'mixed');
  assert.equal(run.layers[0].score.residualLength, 8);
});

test('candidate order affects cascade report and layer commitments', () => {
  const target = [3, 1, 4, 1, 5, 9, 2, 6];
  const candidateA = rotateStack(1, 'a');
  const candidateB = rotateStack(2, 'b');
  const first = createCascadeReport({ target, candidates: [candidateA, candidateB] });
  const second = createCascadeReport({ target, candidates: [candidateB, candidateA] });

  assert.notEqual(first.reportCommitment, second.reportCommitment);
  assert.notDeepEqual(
    first.layers.map((layer) => layer.descriptorCommitment),
    second.layers.map((layer) => layer.descriptorCommitment),
  );
});

test('target changes affect final residual and report commitment', () => {
  const candidates = [rotateStack(1, 'a')];
  const first = createCascadeReport({ target: [0, 0, 0, 0], candidates });
  const second = createCascadeReport({ target: [1, 0, 0, 0], candidates });

  assert.notEqual(first.finalResidualCommitment, second.finalResidualCommitment);
  assert.notEqual(first.reportCommitment, second.reportCommitment);
});

test('createCascadeReport creates expected format, version, claim metadata, and commitment', () => {
  const report = createCascadeReport(reportOptions());

  assert.equal(report.format, 'UN-CASCADE-REPORT');
  assert.equal(report.version, 1);
  assert.equal(report.runFormat, 'UN-CASCADE-RUN');
  assert.equal(report.runVersion, 1);
  assert.equal(report.layerCount, 2);
  assert.equal(report.metadata.claim, 'deterministic-residual-layering');
  assert.match(report.reportCommitment, /^[0-9a-f]{64}$/);
  assert.equal(cascadeReportCommitment(report), report.reportCommitment);
});

test('createCascadeReport commitment is deterministic and metadata key order is stable', () => {
  const first = createCascadeReport(reportOptions({
    metadata: { b: 2, a: 1 },
  }));
  const second = createCascadeReport(reportOptions({
    metadata: { a: 1, b: 2 },
  }));

  assert.deepEqual(first, second);
});

test('cascadeReportPayload excludes reportCommitment and is defensive', () => {
  const report = createCascadeReport(reportOptions());
  const payload = cascadeReportPayload(report);

  assert.equal(Object.hasOwn(payload, 'reportCommitment'), false);
  payload.layers[0].candidateId = 'changed';
  assert.notEqual(payload.layers[0].candidateId, report.layers[0].candidateId);
  assert.throws(() => cascadeReportPayload({ ...report, layers: null }), /layers/);
});

test('tampering target commitment invalidates report commitment', () => {
  const report = createCascadeReport(reportOptions());
  const tampered = {
    ...report,
    originalTargetCommitment: '0'.repeat(64),
  };

  assert.notEqual(cascadeReportCommitment(tampered), report.reportCommitment);
});

test('tampering candidate id or layer data invalidates report commitment', () => {
  const report = createCascadeReport(reportOptions());
  const changedId = clone(report);
  const changedScore = clone(report);
  changedId.layers[0].candidateId = 'tampered';
  changedScore.layers[0].score.sumAbsDelta += 1;

  assert.notEqual(cascadeReportCommitment(changedId), report.reportCommitment);
  assert.notEqual(cascadeReportCommitment(changedScore), report.reportCommitment);
});

test('tampering layer order invalidates report commitment', () => {
  const report = createCascadeReport(reportOptions());
  const tampered = clone(report);
  tampered.layers = [tampered.layers[1], tampered.layers[0]];

  assert.notEqual(cascadeReportCommitment(tampered), report.reportCommitment);
});

test('tampering metadata invalidates report commitment', () => {
  const report = createCascadeReport(reportOptions());
  const tampered = clone(report);
  tampered.metadata.extra = true;

  assert.notEqual(cascadeReportCommitment(tampered), report.reportCommitment);
});

test('createCascadeReport does not mutate inputs', () => {
  const options = reportOptions({
    metadata: { nested: { z: 1, a: 2 } },
  });
  const before = clone(options);

  createCascadeReport(options);

  assert.deepEqual(options, before);
});

test('a closer first layer leaves a better residual score than a deliberately worse candidate', () => {
  const candidateA = {
    id: 'good',
    stack: mixedStack(baseMesh(), { metadata: { candidate: 'good' } }),
    metadata: { candidate: 'good' },
  };
  const candidateB = rotateStack(9, 'worse');
  const generatedA = generateFromStack({ length: 8, stack: candidateA.stack });
  const target = withRingDelta(withRingDelta(generatedA, 0, 1), 5, -2);
  const goodFirst = runCascade({ target, candidates: [candidateA] });
  const worseFirst = runCascade({ target, candidates: [candidateB] });

  assert.equal(goodFirst.layers[0].candidateId, 'good');
  assert.equal(goodFirst.layers[0].score.nonZeroCount < worseFirst.layers[0].score.nonZeroCount, true);
  assert.equal(goodFirst.layers[0].score.sumAbsDelta < worseFirst.layers[0].score.sumAbsDelta, true);
});

test('generated layers plus externally supplied final residual reconstruct the original target', () => {
  const candidateA = rotateStack(1, 'a');
  const candidateB = rotateStack(2, 'b');
  const target = [3, 1, 4, 1, 5, 9, 2, 6];
  const generatedA = generateFromStack({ length: target.length, stack: candidateA.stack });
  const residualA = residualBetween({ target, generated: generatedA });
  const generatedB = generateFromStack({ length: target.length, stack: candidateB.stack });
  const finalResidual = residualBetween({ target: residualA, generated: generatedB });
  const layerSum = applyResidual({ generated: generatedA, residual: generatedB });
  const reconstructed = applyResidual({ generated: layerSum, residual: finalResidual });
  const run = runCascade({ target, candidates: [candidateA, candidateB] });

  assert.deepEqual(reconstructed, target);
  assert.equal(run.layers[0].generatedCommitment.length, 64);
  assert.equal(run.layers[1].generatedCommitment.length, 64);
  assert.equal(run.finalResidualCommitment, run.layers[1].residualCommitment);
});
