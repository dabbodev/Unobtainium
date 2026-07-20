'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  GIT_METADATA_SKIP_REASON,
  assertNoTrackedArtifacts,
  isGitWorktree,
} = require('../test-support/git-hygiene');

const repositoryRoot = '/repository-root';

function createGitStub(responses) {
  const calls = [];
  const execFile = (file, args, options) => {
    calls.push({ file, args, options });
    const key = args.join(' ');
    const response = responses[key];

    if (response instanceof Error) {
      throw response;
    }

    return response;
  };

  return { calls, execFile };
}

test('Git-worktree detection uses git rev-parse without a shell command string', () => {
  const inside = createGitStub({ 'rev-parse --is-inside-work-tree': 'true\n' });

  assert.equal(
    isGitWorktree(repositoryRoot, { execFile: inside.execFile, pathExists: () => true }),
    true
  );
  assert.deepEqual(inside.calls[0].args, ['rev-parse', '--is-inside-work-tree']);
  assert.equal(inside.calls[0].file, 'git');
  assert.equal(inside.calls[0].options.cwd, repositoryRoot);

  assert.throws(
    () => isGitWorktree(repositoryRoot, {
      execFile: () => {
        throw new Error('broken Git metadata');
      },
      pathExists: () => true,
    }),
    /broken Git metadata/
  );
});

test('an archive-like root without .git is not treated as a Git worktree', (t) => {
  const archiveRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'unobtainium-archive-test-'));
  t.after(() => fs.rmSync(archiveRoot, { recursive: true, force: true }));

  assert.equal(isGitWorktree(archiveRoot), false);
});

test('Git-index hygiene skips clearly and remains unverified without Git metadata', () => {
  const skipReasons = [];

  const verified = assertNoTrackedArtifacts(
    { skip: (reason) => skipReasons.push(reason) },
    repositoryRoot,
    {
      execFile: () => assert.fail('Git must not run without repository metadata'),
      pathExists: () => false,
    }
  );

  assert.equal(verified, false);
  assert.deepEqual(skipReasons, [GIT_METADATA_SKIP_REASON]);
});

test('Git-index hygiene preserves both git ls-files assertions in a worktree', () => {
  const clean = createGitStub({
    'rev-parse --is-inside-work-tree': 'true\n',
    'ls-files node_modules': '',
    'ls-files out/*.un': '',
  });

  assert.equal(
    assertNoTrackedArtifacts(
      { skip: assert.fail },
      repositoryRoot,
      { execFile: clean.execFile, pathExists: () => true }
    ),
    true
  );
  assert.deepEqual(
    clean.calls.map(({ args }) => args),
    [
      ['rev-parse', '--is-inside-work-tree'],
      ['ls-files', 'node_modules'],
      ['ls-files', 'out/*.un'],
    ]
  );

  const tracked = createGitStub({
    'rev-parse --is-inside-work-tree': 'true\n',
    'ls-files node_modules': 'node_modules/example/index.js\n',
    'ls-files out/*.un': '',
  });

  assert.throws(
    () => assertNoTrackedArtifacts(
      { skip: assert.fail },
      repositoryRoot,
      { execFile: tracked.execFile, pathExists: () => true }
    ),
    /node_modules\/example\/index\.js/
  );
});
