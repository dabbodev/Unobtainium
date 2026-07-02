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

  assert.equal(fixture.securityFraming.notProductionCryptography, true);
  assert.equal(fixture.securityFraming.visualizationExplainsDeterministicMachineryOnly, true);

  const strings = collectStrings(fixture);
  const unOutputPathPattern = /(^|[\\/])[^"'`\s]+\.un(?:\b|$)|\bout[\\/][^"'`\s]+\.un(?:\b|$)/i;

  assert.equal(strings.some((value) => unOutputPathPattern.test(value)), false);
});
