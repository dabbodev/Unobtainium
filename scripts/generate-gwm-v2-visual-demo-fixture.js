'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  canonicalGwmV2VisualDemoScenario,
  buildGwmV2VisualDemoFixture,
  serializeGwmV2VisualDemoFixture,
} = require('../demo/gwm-v2-visual/fixture-generator');

const DEFAULT_FIXTURE_PATH = path.resolve(
  __dirname,
  '..',
  'docs',
  'examples',
  'gwm-v2-visual-demo-fixture.json'
);

function buildCanonicalFixtureText() {
  const fixture = buildGwmV2VisualDemoFixture(canonicalGwmV2VisualDemoScenario());
  return serializeGwmV2VisualDemoFixture(fixture);
}

function checkGeneratedFixture(filePath = DEFAULT_FIXTURE_PATH) {
  const expected = buildCanonicalFixtureText();

  if (!fs.existsSync(filePath)) {
    return {
      ok: false,
      reason: 'missing',
    };
  }

  const actual = fs.readFileSync(filePath, 'utf8');
  return {
    ok: actual === expected,
    reason: actual === expected ? null : 'stale',
  };
}

function writeGeneratedFixture(filePath = DEFAULT_FIXTURE_PATH) {
  const expected = buildCanonicalFixtureText();
  const previous = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;

  if (previous !== expected) {
    fs.writeFileSync(filePath, expected, 'utf8');
  }

  return {
    changed: previous !== expected,
    filePath,
  };
}

function run(argv = process.argv.slice(2)) {
  if (argv.length > 1 || (argv.length === 1 && argv[0] !== '--check')) {
    console.error('Usage: node scripts/generate-gwm-v2-visual-demo-fixture.js [--check]');
    return 2;
  }

  if (argv[0] === '--check') {
    const result = checkGeneratedFixture();
    if (!result.ok) {
      console.error(
        `GWM-V2 visual demo fixture is ${result.reason}. Run npm run demo:gwm-v2:generate.`
      );
      return 1;
    }

    console.log('GWM-V2 visual demo fixture matches canonical generated output.');
    return 0;
  }

  const result = writeGeneratedFixture();
  console.log(
    result.changed
      ? `Generated ${result.filePath}`
      : `GWM-V2 visual demo fixture is already current: ${result.filePath}`
  );
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = run();
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_FIXTURE_PATH,
  buildCanonicalFixtureText,
  checkGeneratedFixture,
  writeGeneratedFixture,
  run,
};
