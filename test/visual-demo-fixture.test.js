const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const fixturePath = path.join(root, 'docs', 'examples', 'gwm-v2-visual-demo-fixture.json');

function collectStrings(value, output = []) {
  if (typeof value === 'string') {
    output.push(value);
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, output));
    return output;
  }

  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectStrings(item, output));
  }

  return output;
}

test('visual demo fixture is parseable and structurally framed', () => {
  const raw = fs.readFileSync(fixturePath, 'utf8');
  const fixture = JSON.parse(raw);
  const expectedTopLevelKeys = [
    'fixture',
    'points',
    'walkOptions',
    'selectedTriads',
    'triadFeatures',
    'instructionChannels',
    'triadStream',
    'adapterPlan',
    'transformProofSummary',
    'gwmV2Descriptor',
    'gwmV2Mode',
    'notes',
    'securityFraming'
  ];

  expectedTopLevelKeys.forEach((key) => {
    assert.ok(Object.prototype.hasOwnProperty.call(fixture, key), `missing top-level key: ${key}`);
  });

  assert.ok(Array.isArray(fixture.points));
  assert.ok(Array.isArray(fixture.selectedTriads));
  assert.ok(Array.isArray(fixture.triadFeatures));
  assert.ok(Array.isArray(fixture.instructionChannels));
  assert.ok(Array.isArray(fixture.notes));

  assert.equal(fixture.fixture.format, 'UN-GWM-V2-VISUAL-DEMO-FIXTURE');
  assert.equal(fixture.fixture.version, 2);
  assert.equal(fixture.fixture.introducedInSprint, 47);
  assert.equal(fixture.fixture.generatedInSprint, 55);
  assert.equal(fixture.fixture.generationContextId, 'gwm-v2-visual-demo-v2');
  assert.equal(fixture.fixture.fixedSamplePayloadLength, 8);
  assert.equal(fixture.fixture.rawPayloadBytesIncluded, false);
  assert.equal(fixture.fixture.modeVerified, true);

  assert.equal(fixture.securityFraming.notProductionCryptography, true);
  assert.equal(fixture.securityFraming.visualizationExplainsDeterministicMachineryOnly, true);
  assert.equal(fixture.securityFraming.generatedLocallyWithoutNetwork, true);
  assert.equal(fixture.securityFraming.fixedSamplePayloadIsNonSecret, true);
  assert.equal(fixture.securityFraming.rawPayloadBytesAreOmitted, true);

  const strings = collectStrings(fixture);
  const unOutputPathPattern = /(^|[\\/])[^"'`\s]+\.un(?:\b|$)|\bout[\\/][^"'`\s]+\.un(?:\b|$)/i;

  assert.equal(strings.some((value) => unOutputPathPattern.test(value)), false);
});
