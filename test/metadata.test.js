const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('package metadata matches repository license and status framing', () => {
  const pkg = require('../package.json');
  const license = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8');

  assert.equal(pkg.license, 'GPL-3.0-only');
  assert.match(license, /GNU GENERAL PUBLIC LICENSE\s+Version 3/);
  assert.equal(pkg.description, 'Experimental data masking using 3-dimensional geometry');
  assert.doesNotMatch(pkg.description, /encyption/i);
});

test('package lock tracks package metadata and declared top-level dependencies', () => {
  const pkg = require('../package.json');
  const lock = require('../package-lock.json');
  const declaredDeps = Object.keys(pkg.dependencies || {}).sort();
  const lockDeps = lock.packages
    ? Object.keys(lock.packages[''].dependencies || {}).sort()
    : Object.keys(lock.dependencies || {}).filter((name) => declaredDeps.includes(name)).sort();

  assert.equal(lock.name, pkg.name);
  assert.equal(lock.version, pkg.version);
  assert.deepEqual(lockDeps, declaredDeps);
});
