'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createFitReport,
  createSignedStackEnvelope,
  deriveKeyMeshFromString,
  evaluateGenerationCandidate,
  fitReportCommitment,
  generateEd25519KeyPair,
  generateFromStack,
  rankGenerationCandidates,
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
    id: 'fit-rotate',
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
    id: 'fit-swap',
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
    metadata: { sprint: 16 },
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
    signerId: 'owner:fit-naive',
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

test('scoreResidual scores zero residual correctly', () => {
  assert.deepEqual(scoreResidual([0, 0, 0]), {
    residualLength: 3,
    zeroCount: 3,
    nonZeroCount: 0,
    sumAbsDelta: 0,
    meanAbsDelta: 0,
    maxAbsDelta: 0,
    estimatedJsonSize: Buffer.byteLength(JSON.stringify([0, 0, 0]), 'utf8'),
    exactZeroResidual: true,
  });
});

test('scoreResidual counts entries and computes ring-aware distances', () => {
  const score = scoreResidual([0, 1, 255, 128]);

  assert.equal(score.zeroCount, 1);
  assert.equal(score.nonZeroCount, 3);
  assert.equal(score.sumAbsDelta, 130);
  assert.equal(score.meanAbsDelta, 32.5);
  assert.equal(score.maxAbsDelta, 128);
  assert.equal(score.exactZeroResidual, false);
});

test('scoreResidual supports Array, Uint8Array, and Buffer', () => {
  for (const residual of [
    [0, 1, 255],
    new Uint8Array([0, 1, 255]),
    Buffer.from([0, 1, 255]),
  ]) {
    assert.equal(scoreResidual(residual).sumAbsDelta, 2);
  }
});

test('scoreResidual rejects invalid residual values', () => {
  assert.throws(() => scoreResidual(null), /residual/);
  assert.throws(() => scoreResidual([1.5]), /integer/);
  assert.throws(() => scoreResidual([-1]), /0..windowSize-1/);
  assert.throws(() => scoreResidual([256]), /0..windowSize-1/);
  assert.throws(() => scoreResidual([16], { windowSize: 16 }), /0..windowSize-1/);
});

test('scoreResidual does not mutate input', () => {
  const residual = [0, 255, 2];
  const before = residual.slice();

  scoreResidual(residual);

  assert.deepEqual(residual, before);
});

test('evaluateGenerationCandidate evaluates unsigned stack candidate', () => {
  const candidate = rotateStack(1, 'unsigned-a');
  const target = [3, 1, 4, 1, 5, 9, 2, 6];
  const result = evaluateGenerationCandidate({ target, candidate });

  assert.equal(result.id, 'unsigned-a');
  assert.match(result.candidateCommitment, /^[0-9a-f]{64}$/);
  assert.match(result.generatedCommitment, /^[0-9a-f]{64}$/);
  assert.match(result.residualCommitment, /^[0-9a-f]{64}$/);
  assert.match(result.descriptorCommitment, /^[0-9a-f]{64}$/);
  assert.equal(result.score.residualLength, target.length);
  assert.deepEqual(result.metadata, { turns: 1 });
});

test('evaluateGenerationCandidate evaluates signed stack candidate', () => {
  const recipe = rotateStack(2).stack;
  const candidate = signedCandidate(recipe);
  const target = [2, 7, 1, 8, 2, 8, 1, 8];
  const result = evaluateGenerationCandidate({ target, candidate });

  assert.match(result.descriptorCommitment, /^[0-9a-f]{64}$/);
  assert.equal(result.metadata.signed, true);
});

test('evaluateGenerationCandidate rejects invalid candidate material', () => {
  const target = [0, 0, 0, 0];

  assert.throws(() => evaluateGenerationCandidate({
    target,
    candidate: { id: 'missing' },
  }), /stack or signedStackEnvelope/);
});

test('evaluateGenerationCandidate rejects mismatched stack and signed envelope', () => {
  const signed = signedCandidate(rotateStack(1).stack);

  assert.throws(() => evaluateGenerationCandidate({
    target: [0, 0, 0, 0],
    candidate: {
      id: 'mismatch',
      stack: rotateStack(2).stack,
      signedStackEnvelope: signed.signedStackEnvelope,
    },
  }), /match/);
});

test('evaluateGenerationCandidate does not mutate target or candidate', () => {
  const target = [3, 1, 4, 1, 5, 9, 2, 6];
  const candidate = rotateStack(1, 'immutable');
  const targetBefore = target.slice();
  const candidateBefore = clone(candidate);

  evaluateGenerationCandidate({ target, candidate, metadata: { report: true } });

  assert.deepEqual(target, targetBefore);
  assert.deepEqual(candidate, candidateBefore);
});

test('evaluateGenerationCandidate works with keyfile-derived mesh stack', () => {
  const mesh = deriveKeyMeshFromString('fit naive keyfile mesh', { pointCount: 8 });
  const candidate = {
    id: 'keyfile-candidate',
    stack: stack({
      metadata: { source: 'keyfile-derived' },
      layers: [rotateLayer(mesh, { turns: 1 })],
    }),
  };
  const result = evaluateGenerationCandidate({
    target: [1, 1, 2, 3, 5, 8, 13, 21],
    candidate,
  });

  assert.equal(result.score.residualLength, 8);
});

test('evaluateGenerationCandidate works with mixed UN-ROTATE/UN-SWAP stack', () => {
  const candidate = {
    id: 'mixed-candidate',
    stack: mixedStack(),
  };
  const result = evaluateGenerationCandidate({
    target: [8, 6, 7, 5, 3, 0, 9, 9],
    candidate,
    type: 'buffer',
  });

  assert.equal(result.score.residualLength, 8);
});

test('exact generated target produces zero residual', () => {
  const candidate = rotateStack(3, 'exact');
  const generated = generateFromStack({
    length: 8,
    stack: candidate.stack,
  });
  const result = evaluateGenerationCandidate({ target: generated, candidate });

  assert.equal(result.score.exactZeroResidual, true);
  assert.equal(result.score.nonZeroCount, 0);
});

test('candidate commitment changes when committed candidate inputs change', () => {
  const target = [0, 0, 0, 0];
  const base = evaluateGenerationCandidate({
    target,
    candidate: rotateStack(1, 'same-id'),
  });
  const changedId = evaluateGenerationCandidate({
    target,
    candidate: rotateStack(1, 'changed-id'),
  });
  const changedMetadata = evaluateGenerationCandidate({
    target,
    candidate: {
      ...rotateStack(1, 'same-id'),
      metadata: { turns: 1, variant: true },
    },
  });
  const changedWindow = evaluateGenerationCandidate({
    target: [0, 0, 0, 0],
    candidate: {
      id: 'same-id',
      stack: stack({
        windowSize: 16,
        layers: [rotateLayer(baseMesh(), { turns: 1, minShift: 1, windowSize: 16 })],
      }),
      metadata: { turns: 1 },
    },
    windowSize: 16,
  });

  assert.notEqual(base.candidateCommitment, changedId.candidateCommitment);
  assert.notEqual(base.candidateCommitment, changedMetadata.candidateCommitment);
  assert.notEqual(base.candidateCommitment, changedWindow.candidateCommitment);
});

test('candidate commitment changes when signed stack binding is supplied', () => {
  const target = [0, 0, 0, 0];
  const recipe = rotateStack(1, 'same-id').stack;
  const unsigned = evaluateGenerationCandidate({
    target,
    candidate: { id: 'same-id', stack: recipe, metadata: { same: true } },
  });
  const signed = evaluateGenerationCandidate({
    target,
    candidate: {
      ...signedCandidate(recipe, 'same-id'),
      metadata: { same: true },
    },
  });

  assert.notEqual(unsigned.candidateCommitment, signed.candidateCommitment);
});

test('rankGenerationCandidates returns empty array for empty candidates', () => {
  assert.deepEqual(rankGenerationCandidates({
    target: [0, 0, 0],
    candidates: [],
  }), []);
});

test('rankGenerationCandidates ranks exact residual candidate first', () => {
  const exact = rotateStack(1, 'exact');
  const target = generateFromStack({ length: 4, stack: exact.stack });
  const rankings = rankGenerationCandidates({
    target,
    candidates: [rotateStack(2, 'worse'), exact],
  });

  assert.equal(rankings[0].id, 'exact');
  assert.equal(rankings[0].score.exactZeroResidual, true);
});

test('rankGenerationCandidates ranks lower nonZeroCount before lower sumAbsDelta', () => {
  const rankings = rankGenerationCandidates({
    target: [0, 4, 0, 0],
    candidates: [rotateStack(1, 'lower-sum'), rotateStack(2, 'lower-nonzero')],
  });

  assert.equal(rankings[0].id, 'lower-nonzero');
  assert.equal(rankings[0].score.nonZeroCount < rankings[1].score.nonZeroCount, true);
  assert.equal(rankings[0].score.sumAbsDelta > rankings[1].score.sumAbsDelta, true);
});

test('rankGenerationCandidates uses sumAbsDelta as secondary sort', () => {
  const rankings = rankGenerationCandidates({
    target: [0, 0, 0, 0],
    candidates: [rotateStack(2, 'higher-sum'), rotateStack(1, 'lower-sum')],
  });

  assert.equal(rankings[0].id, 'lower-sum');
  assert.equal(rankings[0].score.nonZeroCount, rankings[1].score.nonZeroCount);
  assert.equal(rankings[0].score.sumAbsDelta < rankings[1].score.sumAbsDelta, true);
});

test('rankGenerationCandidates uses estimatedJsonSize as tertiary sort', () => {
  const rankings = rankGenerationCandidates({
    target: [20, 30, 0, 0],
    candidates: [rotateStack(10, 'larger-json'), rotateStack(1, 'smaller-json')],
  });

  assert.equal(rankings[0].id, 'smaller-json');
  assert.equal(rankings[0].score.nonZeroCount, rankings[1].score.nonZeroCount);
  assert.equal(rankings[0].score.sumAbsDelta, rankings[1].score.sumAbsDelta);
  assert.equal(rankings[0].score.estimatedJsonSize < rankings[1].score.estimatedJsonSize, true);
});

test('rankGenerationCandidates uses candidate id as stable tie-break', () => {
  const recipe = rotateStack(1).stack;
  const rankings = rankGenerationCandidates({
    target: [0, 0, 0, 0],
    candidates: [
      { id: 'b-candidate', stack: recipe },
      { id: 'a-candidate', stack: recipe },
    ],
  });

  assert.deepEqual(rankings.map((entry) => entry.id), ['a-candidate', 'b-candidate']);
});

test('rankGenerationCandidates does not mutate candidates array', () => {
  const candidates = [rotateStack(2, 'b'), rotateStack(1, 'a')];
  const before = clone(candidates);

  rankGenerationCandidates({ target: [0, 0, 0, 0], candidates });

  assert.deepEqual(candidates, before);
});

test('createFitReport creates expected report fields', () => {
  const report = createFitReport({
    target: [0, 0, 0, 0],
    candidates: [rotateStack(1, 'a'), rotateStack(2, 'b')],
    metadata: { purpose: 'test' },
  });

  assert.equal(report.format, 'UN-FIT-NAIVE-REPORT');
  assert.equal(report.version, 1);
  assert.match(report.targetCommitment, /^[0-9a-f]{64}$/);
  assert.equal(report.targetLength, 4);
  assert.equal(report.candidateCount, 2);
  assert.equal(report.rankings.length, 2);
  assert.deepEqual(report.metadata, { purpose: 'test' });
  assert.equal(fitReportCommitment(report), report.reportCommitment);
});

test('createFitReport is deterministic for same inputs', () => {
  const options = {
    target: [0, 0, 0, 0],
    candidates: [rotateStack(1, 'a'), rotateStack(2, 'b')],
    metadata: { b: 2, a: 1 },
  };

  assert.deepEqual(createFitReport(options), createFitReport(clone(options)));
});

test('report commitment changes when target changes', () => {
  const candidates = [rotateStack(1, 'a'), rotateStack(2, 'b')];
  const first = createFitReport({ target: [0, 0, 0, 0], candidates });
  const second = createFitReport({ target: [1, 0, 0, 0], candidates });

  assert.notEqual(first.reportCommitment, second.reportCommitment);
});

test('report commitment changes when candidate metadata changes', () => {
  const first = createFitReport({
    target: [0, 0, 0, 0],
    candidates: [rotateStack(1, 'a')],
  });
  const second = createFitReport({
    target: [0, 0, 0, 0],
    candidates: [{ ...rotateStack(1, 'a'), metadata: { changed: true } }],
  });

  assert.notEqual(first.reportCommitment, second.reportCommitment);
});

test('createFitReport does not mutate target, candidates, or metadata', () => {
  const target = [0, 0, 0, 0];
  const candidates = [rotateStack(1, 'a'), rotateStack(2, 'b')];
  const metadata = { nested: { b: 2, a: 1 } };
  const before = {
    target: target.slice(),
    candidates: clone(candidates),
    metadata: clone(metadata),
  };

  createFitReport({ target, candidates, metadata });

  assert.deepEqual(target, before.target);
  assert.deepEqual(candidates, before.candidates);
  assert.deepEqual(metadata, before.metadata);
});

test('integration ranks closer keyfile-derived candidate first and report commitments verify', () => {
  const meshA = deriveKeyMeshFromString('fit integration mesh a', { pointCount: 8 });
  const meshB = deriveKeyMeshFromString('fit integration mesh b', { pointCount: 8 });
  const candidateA = {
    id: 'mesh-a',
    stack: mixedStack(meshA, { metadata: { mesh: 'a' } }),
    metadata: { mesh: 'a' },
  };
  const candidateB = {
    id: 'mesh-b',
    stack: mixedStack(meshB, { metadata: { mesh: 'b' } }),
    metadata: { mesh: 'b' },
  };
  const generatedA = generateFromStack({
    length: 8,
    stack: candidateA.stack,
  });
  const target = withRingDelta(withRingDelta(generatedA, 0, 1), 5, -2);
  const rankings = rankGenerationCandidates({
    target,
    candidates: [candidateB, candidateA],
  });
  const report = createFitReport({
    target,
    candidates: [candidateB, candidateA],
    metadata: { scenario: 'keyfile-fit' },
  });

  assert.equal(rankings[0].id, 'mesh-a');
  assert.equal(report.rankings[0].id, 'mesh-a');
  assert.equal(fitReportCommitment(report), report.reportCommitment);
});
