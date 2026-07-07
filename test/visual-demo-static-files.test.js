const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const demoDir = path.join(root, 'demo', 'gwm-v2-visual');

function readDemoFile(fileName) {
  return fs.readFileSync(path.join(demoDir, fileName), 'utf8');
}

test('visual demo static scaffold files exist', () => {
  [
    'index.html',
    'styles.css',
    'demo.js',
    'README.md'
  ].forEach((fileName) => {
    assert.ok(fs.existsSync(path.join(demoDir, fileName)), `missing ${fileName}`);
  });
});

test('visual demo scaffold keeps required safety labels and fixture-only path', () => {
  const html = readDemoFile('index.html');
  const js = readDemoFile('demo.js');
  const combined = `${html}\n${js}\n${readDemoFile('README.md')}`;

  [
    'Experimental',
    'Not production cryptography',
    'Deterministic demonstration',
    'No security guarantee',
    'Local/static fixture',
    'No file upload'
  ].forEach((label) => {
    assert.match(combined, new RegExp(label, 'i'));
  });

  assert.match(js, /\.\.\/\.\.\/docs\/examples\/gwm-v2-visual-demo-fixture\.json/);
  assert.doesNotMatch(html, /<input\b[^>]*\btype=["']?file/i);
});

test('visual demo scaffold exposes required static panel containers', () => {
  const html = readDemoFile('index.html');

  [
    'overview',
    'points',
    'walk',
    'triads',
    'features',
    'rotate',
    'position',
    'rule',
    'stream',
    'adapter',
    'proof',
    'descriptor'
  ].forEach((panelName) => {
    assert.match(html, new RegExp(`data-panel=["']${panelName}["']`));
    assert.match(html, new RegExp(`id=["']${panelName}-panel["']`));
  });
});

test('visual demo scaffold avoids external resources and core/runtime imports', () => {
  const html = readDemoFile('index.html');
  const js = readDemoFile('demo.js');

  assert.doesNotMatch(html, /https?:\/\//i);
  assert.doesNotMatch(html, /cdn/i);
  assert.doesNotMatch(html, /<canvas\b/i);
  assert.doesNotMatch(html, /webgl/i);
  assert.doesNotMatch(html, /<input\b[^>]*\btype=["']?file/i);
  assert.doesNotMatch(js, /require\s*\(/);
  assert.doesNotMatch(js, /import\s+.*(?:packages|unobtainium|index\.js)/);
  assert.doesNotMatch(js, /WebGL|canvas|getContext/i);
  assert.doesNotMatch(js, /createReadStream|readFileSync|writeFileSync|process\./);
});
