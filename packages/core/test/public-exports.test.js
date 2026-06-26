'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const core = require('..');

test('Sprint 19-28 matrix, certificate, and cutout helpers are public exports', () => {
  const expectedExports = [
    'applyCertificateCombine',
    'applyCertificateCutout',
    'applyCutout',
    'applyMatrixCombineRecipe',
    'applyMatrixMutationRecipe',
    'applySignedMatrixCombine',
    'applySignedMatrixMutation',
    'certificateCommitment',
    'certificateCutoutCommitment',
    'certificateCutoutPayload',
    'certificatePayload',
    'createCertificate',
    'createCutout',
    'createMatrixKey',
    'createSignedMatrixCombine',
    'createSignedMatrixMutation',
    'cutoutPlanCommitment',
    'cutoutPlanPayload',
    'cutoutSpanCommitment',
    'matrixCombineRecipeCommitment',
    'matrixCombineRecipePayload',
    'matrixCommitment',
    'matrixMutationRecipeCommitment',
    'matrixMutationRecipePayload',
    'matrixPayload',
    'normalizeCertificate',
    'normalizeCutoutPlan',
    'normalizeMatrix',
    'normalizeMatrixCombineRecipe',
    'normalizeMatrixMutationRecipe',
    'restoreCutout',
    'signedMatrixCombineCommitment',
    'signedMatrixCombinePayload',
    'signedMatrixMutationCommitment',
    'signedMatrixMutationPayload',
    'verifyCertificate',
    'verifyCertificateCutouts',
    'verifyCutout',
    'verifySignedMatrixCombine',
    'verifySignedMatrixMutation',
  ];

  for (const name of expectedExports) {
    assert.equal(typeof core[name], 'function', `${name} should be exported`);
  }
});
