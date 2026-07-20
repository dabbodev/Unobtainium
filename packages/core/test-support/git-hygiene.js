'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const REPOSITORY_ROOT = path.resolve(__dirname, '../../..');
const GIT_METADATA_SKIP_REASON =
  'Git-index assertion skipped: tracked state cannot be verified without Git metadata.';

function runGit(repositoryRoot, args, execFile = execFileSync) {
  return execFile('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function isGitWorktree(
  repositoryRoot = REPOSITORY_ROOT,
  { execFile = execFileSync, pathExists = existsSync } = {}
) {
  if (!pathExists(path.join(repositoryRoot, '.git'))) {
    return false;
  }

  assert.equal(
    runGit(repositoryRoot, ['rev-parse', '--is-inside-work-tree'], execFile),
    'true',
    'repository Git metadata does not identify a usable worktree'
  );
  return true;
}

function assertNoTrackedArtifacts(
  testContext,
  repositoryRoot = REPOSITORY_ROOT,
  { execFile = execFileSync, pathExists = existsSync } = {}
) {
  if (!isGitWorktree(repositoryRoot, { execFile, pathExists })) {
    testContext.skip(GIT_METADATA_SKIP_REASON);
    return false;
  }

  const trackedNodeModules = runGit(repositoryRoot, ['ls-files', 'node_modules'], execFile);
  const trackedGeneratedUn = runGit(repositoryRoot, ['ls-files', 'out/*.un'], execFile);

  assert.equal(trackedNodeModules, '');
  assert.equal(trackedGeneratedUn, '');
  return true;
}

module.exports = {
  GIT_METADATA_SKIP_REASON,
  REPOSITORY_ROOT,
  assertNoTrackedArtifacts,
  isGitWorktree,
};
