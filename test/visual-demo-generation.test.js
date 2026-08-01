'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  VISUAL_DEMO_FIXTURE_FORMAT,
  VISUAL_DEMO_FIXTURE_VERSION,
  canonicalGwmV2VisualDemoScenario,
  buildGwmV2VisualDemoFixture,
  serializeGwmV2VisualDemoFixture,
} = require('../demo/gwm-v2-visual/fixture-generator');
const {
  DEFAULT_FIXTURE_PATH,
  buildCanonicalFixtureText,
  checkGeneratedFixture,
  writeGeneratedFixture,
} = require('../scripts/generate-gwm-v2-visual-demo-fixture');
const core = require('../packages/core');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function collectKeys(value, output = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, output));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => {
      output.push(key);
      collectKeys(item, output);
    });
  }

  return output;
}

function collectArrays(value, output = []) {
  if (Array.isArray(value)) {
    output.push(value);
    value.forEach((item) => collectArrays(item, output));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectArrays(item, output));
  }

  return output;
}

test('canonical visual demo generation is deterministic and exactly matches the fixture', () => {
  const first = buildGwmV2VisualDemoFixture(canonicalGwmV2VisualDemoScenario());
  const second = buildGwmV2VisualDemoFixture(canonicalGwmV2VisualDemoScenario());
  const serialized = serializeGwmV2VisualDemoFixture(first);

  assert.deepEqual(first, second);
  assert.equal(serialized, buildCanonicalFixtureText());
  assert.equal(serialized, fs.readFileSync(DEFAULT_FIXTURE_PATH, 'utf8'));
  assert.equal(serialized.endsWith('\n'), true);
  assert.doesNotMatch(serialized, /\r\n/);
  assert.deepEqual(JSON.parse(serialized), first);
});

test('generated fixture exposes a coherent verified commitment chain and walk mapping', () => {
  const fixture = buildGwmV2VisualDemoFixture(canonicalGwmV2VisualDemoScenario());

  assert.equal(fixture.fixture.format, VISUAL_DEMO_FIXTURE_FORMAT);
  assert.equal(fixture.fixture.version, VISUAL_DEMO_FIXTURE_VERSION);
  assert.equal(fixture.fixture.introducedInSprint, 47);
  assert.equal(fixture.fixture.generatedInSprint, 55);
  assert.equal(fixture.fixture.modeVerified, true);
  assert.equal(fixture.transformProofSummary.roundtrip, true);
  assert.equal(
    fixture.transformProofSummary.inputPayloadCommitment,
    fixture.transformProofSummary.restoredPayloadCommitment
  );
  assert.equal(
    fixture.triadStream.streamCommitment,
    fixture.adapterPlan.sourceStreamCommitment
  );
  assert.equal(
    fixture.triadStream.streamCommitment,
    fixture.gwmV2Descriptor.triadStreamCommitment
  );
  assert.equal(
    fixture.adapterPlan.adapterCommitment,
    fixture.transformProofSummary.sourcePlanCommitment
  );
  assert.equal(
    fixture.adapterPlan.adapterCommitment,
    fixture.gwmV2Descriptor.adapterPlanCommitment
  );
  assert.equal(
    fixture.transformProofSummary.proofCommitment,
    fixture.gwmV2Descriptor.transformProofCommitment
  );
  assert.deepEqual(
    fixture.selectedTriads.map((entry) => entry.pointIndexes),
    [
      { A: 0, B: 2, C: 3 },
      { A: 1, B: 3, C: 0 },
    ]
  );
  assert.deepEqual(
    fixture.selectedTriads.map((entry) => entry.triad),
    [
      { A: fixture.points[0], B: fixture.points[2], C: fixture.points[3] },
      { A: fixture.points[1], B: fixture.points[3], C: fixture.points[0] },
    ]
  );
});

test('reordering a source point changes the generated commitment chain', () => {
  const baseline = buildGwmV2VisualDemoFixture(canonicalGwmV2VisualDemoScenario());
  const reorderedScenario = canonicalGwmV2VisualDemoScenario();
  [reorderedScenario.points[0], reorderedScenario.points[1]] = [
    reorderedScenario.points[1],
    reorderedScenario.points[0],
  ];
  const reordered = buildGwmV2VisualDemoFixture(reorderedScenario);

  assert.equal(reordered.fixture.modeVerified, true);
  assert.equal(reordered.transformProofSummary.roundtrip, true);
  assert.notEqual(
    reordered.gwmV2Descriptor.sourcePointCommitment,
    baseline.gwmV2Descriptor.sourcePointCommitment
  );
  assert.notEqual(
    reordered.triadStream.streamCommitment,
    baseline.triadStream.streamCommitment
  );
  assert.notEqual(
    reordered.gwmV2Descriptor.descriptorCommitment,
    baseline.gwmV2Descriptor.descriptorCommitment
  );
  assert.notEqual(reordered.gwmV2Mode.modeCommitment, baseline.gwmV2Mode.modeCommitment);
});

test('generator validates scenario boundaries and does not mutate caller input', () => {
  const scenario = canonicalGwmV2VisualDemoScenario();
  const before = clone(scenario);

  buildGwmV2VisualDemoFixture(scenario);
  assert.deepEqual(scenario, before);

  const typedPayload = canonicalGwmV2VisualDemoScenario();
  typedPayload.payloadBytes = Uint8Array.from(typedPayload.payloadBytes);
  assert.deepEqual(
    buildGwmV2VisualDemoFixture(typedPayload),
    buildGwmV2VisualDemoFixture(canonicalGwmV2VisualDemoScenario())
  );

  const tooFewPoints = canonicalGwmV2VisualDemoScenario();
  tooFewPoints.points = tooFewPoints.points.slice(0, 2);
  assert.throws(
    () => buildGwmV2VisualDemoFixture(tooFewPoints),
    /at least 3 points/
  );

  const invalidWalk = canonicalGwmV2VisualDemoScenario();
  invalidWalk.walkOptions.ring = 0;
  assert.throws(() => buildGwmV2VisualDemoFixture(invalidWalk), /ring must be a positive/);

  const invalidPayload = canonicalGwmV2VisualDemoScenario();
  invalidPayload.payloadBytes[3] = 256;
  assert.throws(
    () => buildGwmV2VisualDemoFixture(invalidPayload),
    /scenario\.payloadBytes\[3\]/
  );

  const mismatchedLength = canonicalGwmV2VisualDemoScenario();
  mismatchedLength.context.payloadLength = 7;
  assert.throws(
    () => buildGwmV2VisualDemoFixture(mismatchedLength),
    /payloadLength must match/
  );

  const mismatchedContextId = canonicalGwmV2VisualDemoScenario();
  mismatchedContextId.metadata.contextId = 'different-context';
  assert.throws(
    () => buildGwmV2VisualDemoFixture(mismatchedContextId),
    /metadata\.contextId must match/
  );
});

test('generated fixture omits raw payload and runtime proof objects while retaining framing', () => {
  const scenario = canonicalGwmV2VisualDemoScenario();
  const fixture = buildGwmV2VisualDemoFixture(scenario);
  const serialized = serializeGwmV2VisualDemoFixture(fixture);
  const keys = collectKeys(fixture);
  const arrays = collectArrays(fixture);

  for (const forbiddenKey of [
    'payloadBytes',
    'output',
    'restored',
    'applied',
    'reversed',
    'appliedOperations',
    'rotateInstructions',
    'swapInstructions',
  ]) {
    assert.equal(keys.includes(forbiddenKey), false, `fixture leaked runtime key: ${forbiddenKey}`);
  }

  assert.equal(
    arrays.some((array) => JSON.stringify(array) === JSON.stringify(scenario.payloadBytes)),
    false
  );
  assert.equal(fixture.fixture.rawPayloadBytesIncluded, false);
  assert.equal(fixture.securityFraming.notProductionCryptography, true);
  assert.equal(fixture.securityFraming.commitmentsAreIntegrityCheckArtifactsOnly, true);
  assert.equal(fixture.securityFraming.generatedLocallyWithoutNetwork, true);
  assert.equal(fixture.securityFraming.rawPayloadBytesAreOmitted, true);
  assert.doesNotMatch(serialized, /(^|[\\/])[^"'`\s]+\.un(?:\b|$)/i);
  assert.equal(Object.hasOwn(core, 'buildGwmV2VisualDemoFixture'), false);
});

test('generated fixture check detects drift without rewriting the checked file', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unobtainium-s55-'));
  const tempFixture = path.join(tempDir, 'fixture.json');

  try {
    const writeResult = writeGeneratedFixture(tempFixture);
    assert.equal(writeResult.changed, true);
    assert.deepEqual(checkGeneratedFixture(tempFixture), { ok: true, reason: null });

    fs.writeFileSync(tempFixture, '{"stale":true}\n', 'utf8');
    const before = fs.readFileSync(tempFixture, 'utf8');
    assert.deepEqual(checkGeneratedFixture(tempFixture), { ok: false, reason: 'stale' });
    assert.equal(fs.readFileSync(tempFixture, 'utf8'), before);

    const missingFixture = path.join(tempDir, 'missing.json');
    assert.deepEqual(checkGeneratedFixture(missingFixture), { ok: false, reason: 'missing' });
    assert.equal(fs.existsSync(missingFixture), false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
