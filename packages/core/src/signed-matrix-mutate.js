'use strict';

const crypto = require('node:crypto');

const {
  applyMatrixMutationRecipe,
  matrixMutationRecipeCommitment,
  matrixMutationRecipePayload,
  normalizeMatrixMutationRecipe,
} = require('./matrix-mutate');
const { stableStringify } = require('./stack-canonical');

const SIGNED_MATRIX_MUTATE_FORMAT = 'UN-MATRIX-MUTATE-SIGNED';
const SIGNED_MATRIX_MUTATE_VERSION = 1;
const SIGNED_MATRIX_MUTATE_ALGORITHM = 'ed25519';
const SIGNED_MATRIX_MUTATE_PAYLOAD_DOMAIN = 'UN-MATRIX-MUTATE-SIGNED:v1';
const SUPPORTED_ALGORITHMS = new Set([SIGNED_MATRIX_MUTATE_ALGORITHM]);
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function assertSupportedAlgorithm(algorithm) {
  if (!SUPPORTED_ALGORITHMS.has(algorithm)) {
    throw new RangeError(`signature algorithm ${algorithm} is not supported`);
  }
}

function cloneCanonicalValue(value, fieldName) {
  try {
    return JSON.parse(stableStringify(value));
  } catch (error) {
    error.message = `${fieldName} must be canonical plain data: ${error.message}`;
    throw error;
  }
}

function assertSha256Hex(value, fieldName) {
  if (typeof value !== 'string' || !SHA256_HEX_PATTERN.test(value)) {
    throw new TypeError(`${fieldName} must be a SHA-256 hex string`);
  }
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function exportPublicKeyPem(publicKey) {
  const keyObject = crypto.createPublicKey(publicKey);
  return keyObject.export({ type: 'spki', format: 'pem' });
}

function publicKeyForEnvelope(privateKey, publicKey) {
  if (publicKey !== undefined) {
    return exportPublicKeyPem(publicKey);
  }

  return exportPublicKeyPem(crypto.createPublicKey(privateKey));
}

function signedMatrixMutationPayloadObject({
  matrixMutationRecipeCommitment,
  matrixMutationRecipe,
  sourceMatrixCommitment,
  targetMatrixCommitment,
  signerId,
  purpose,
  metadata,
  algorithm,
  publicKey,
}) {
  assertSupportedAlgorithm(algorithm);
  assertSha256Hex(matrixMutationRecipeCommitment, 'matrixMutationRecipeCommitment');
  if (sourceMatrixCommitment !== null) {
    assertSha256Hex(sourceMatrixCommitment, 'sourceMatrixCommitment');
  }
  if (targetMatrixCommitment !== null) {
    assertSha256Hex(targetMatrixCommitment, 'targetMatrixCommitment');
  }
  if (typeof signerId !== 'string' || signerId.length === 0) {
    throw new TypeError('signerId must be a non-empty string');
  }
  if (typeof purpose !== 'string' || purpose.length === 0) {
    throw new TypeError('purpose must be a non-empty string');
  }
  if (typeof publicKey !== 'string' || publicKey.length === 0) {
    throw new TypeError('publicKey must be a non-empty PEM string');
  }

  return {
    domain: SIGNED_MATRIX_MUTATE_PAYLOAD_DOMAIN,
    format: SIGNED_MATRIX_MUTATE_FORMAT,
    version: SIGNED_MATRIX_MUTATE_VERSION,
    algorithm,
    publicKey,
    signerId,
    purpose,
    metadata: cloneCanonicalValue(metadata, 'metadata'),
    matrixMutationRecipeCommitment,
    matrixMutationRecipe: cloneCanonicalValue(matrixMutationRecipe, 'matrixMutationRecipe'),
    sourceMatrixCommitment,
    targetMatrixCommitment,
  };
}

function signedMatrixMutationPayload({
  matrixMutationRecipeCommitment,
  matrixMutationRecipe,
  sourceMatrixCommitment,
  targetMatrixCommitment,
  signerId,
  purpose,
  metadata,
  algorithm,
  publicKey,
}) {
  return stableStringify(signedMatrixMutationPayloadObject({
    matrixMutationRecipeCommitment,
    matrixMutationRecipe,
    sourceMatrixCommitment,
    targetMatrixCommitment,
    signerId,
    purpose,
    metadata,
    algorithm,
    publicKey,
  }));
}

function signedMatrixMutationCommitment(payloadLike) {
  return crypto
    .createHash('sha256')
    .update(SIGNED_MATRIX_MUTATE_PAYLOAD_DOMAIN)
    .update(Buffer.from([0]))
    .update(typeof payloadLike === 'string'
      ? payloadLike
      : signedMatrixMutationPayload(payloadLike))
    .digest('hex');
}

function createSignedMatrixMutation({
  recipe,
  signerId,
  privateKey,
  publicKey,
  purpose = 'owner-signed-matrix-mutation',
  metadata = {},
  algorithm = SIGNED_MATRIX_MUTATE_ALGORITHM,
}) {
  assertSupportedAlgorithm(algorithm);
  if (privateKey === undefined) {
    throw new TypeError('privateKey is required');
  }

  const normalizedRecipe = normalizeMatrixMutationRecipe(recipe);
  const recipePayload = matrixMutationRecipePayload(normalizedRecipe);
  const recipeCommitment = matrixMutationRecipeCommitment(normalizedRecipe);
  if (recipeCommitment !== normalizedRecipe.matrixMutationRecipeCommitment) {
    throw new TypeError('matrixMutationRecipeCommitment mismatch');
  }

  const normalizedMetadata = cloneCanonicalValue(metadata, 'metadata');
  const exportedPublicKey = publicKeyForEnvelope(privateKey, publicKey);
  const payload = signedMatrixMutationPayload({
    matrixMutationRecipeCommitment: recipeCommitment,
    matrixMutationRecipe: recipePayload,
    sourceMatrixCommitment: normalizedRecipe.sourceMatrixCommitment,
    targetMatrixCommitment: normalizedRecipe.targetMatrixCommitment,
    signerId,
    purpose,
    metadata: normalizedMetadata,
    algorithm,
    publicKey: exportedPublicKey,
  });
  const signature = crypto.sign(null, Buffer.from(payload, 'utf8'), privateKey);

  return {
    format: SIGNED_MATRIX_MUTATE_FORMAT,
    version: SIGNED_MATRIX_MUTATE_VERSION,
    algorithm,
    recipe: normalizedRecipe,
    matrixMutationRecipeCommitment: recipeCommitment,
    sourceMatrixCommitment: normalizedRecipe.sourceMatrixCommitment,
    targetMatrixCommitment: normalizedRecipe.targetMatrixCommitment,
    signedMatrixMutationCommitment: signedMatrixMutationCommitment(payload),
    signerId,
    purpose,
    metadata: normalizedMetadata,
    signature: {
      algorithm,
      signerId,
      publicKey: exportedPublicKey,
      value: signature.toString('base64'),
    },
  };
}

function invalid(reason, fields = {}) {
  return {
    ...fields,
    ok: false,
    valid: false,
    reason,
    error: reason,
  };
}

function validResult(fields) {
  return {
    ok: true,
    valid: true,
    ...fields,
  };
}

function decodeSignature(signatureValue) {
  if (typeof signatureValue !== 'string' || signatureValue.length === 0) {
    throw new TypeError('signature value must be a non-empty base64 string');
  }
  if (!BASE64_PATTERN.test(signatureValue)) {
    throw new TypeError('signature value must be valid base64');
  }

  const signature = Buffer.from(signatureValue, 'base64');
  if (signature.length !== 64 || signature.toString('base64') !== signatureValue) {
    throw new TypeError('signature value must be 64 Ed25519 signature bytes');
  }

  return signature;
}

function verifySignedMatrixMutation(envelope, options = {}) {
  try {
    if (envelope === null || typeof envelope !== 'object' || Array.isArray(envelope)) {
      return invalid('envelope must be an object');
    }
    if (envelope.format !== SIGNED_MATRIX_MUTATE_FORMAT) {
      return invalid('envelope format is not UN-MATRIX-MUTATE-SIGNED');
    }
    if (envelope.version !== SIGNED_MATRIX_MUTATE_VERSION) {
      return invalid('envelope version is not supported');
    }
    if (envelope.signature === null || typeof envelope.signature !== 'object' || Array.isArray(envelope.signature)) {
      return invalid('envelope signature must be an object');
    }
    if (envelope.signature.signerId !== envelope.signerId) {
      return invalid('signature signerId does not match envelope signerId');
    }

    const algorithm = envelope.signature.algorithm;
    try {
      assertSupportedAlgorithm(algorithm);
    } catch (error) {
      return invalid(error.message);
    }
    if (envelope.algorithm !== undefined && envelope.algorithm !== algorithm) {
      return invalid('envelope algorithm does not match signature algorithm');
    }

    const recipe = normalizeMatrixMutationRecipe(envelope.recipe);
    const recipePayload = matrixMutationRecipePayload(recipe);
    const recipeCommitment = matrixMutationRecipeCommitment(recipe);
    if (recipeCommitment !== envelope.matrixMutationRecipeCommitment) {
      return invalid('matrixMutationRecipeCommitment mismatch', {
        matrixMutationRecipeCommitment: recipeCommitment,
        sourceMatrixCommitment: recipe.sourceMatrixCommitment,
        targetMatrixCommitment: recipe.targetMatrixCommitment,
      });
    }
    if (recipe.sourceMatrixCommitment !== envelope.sourceMatrixCommitment) {
      return invalid('sourceMatrixCommitment mismatch', {
        matrixMutationRecipeCommitment: recipeCommitment,
        sourceMatrixCommitment: recipe.sourceMatrixCommitment,
        targetMatrixCommitment: recipe.targetMatrixCommitment,
      });
    }
    if (recipe.targetMatrixCommitment !== envelope.targetMatrixCommitment) {
      return invalid('targetMatrixCommitment mismatch', {
        matrixMutationRecipeCommitment: recipeCommitment,
        sourceMatrixCommitment: recipe.sourceMatrixCommitment,
        targetMatrixCommitment: recipe.targetMatrixCommitment,
      });
    }

    if (typeof envelope.signature.publicKey !== 'string' && options.publicKey === undefined) {
      return invalid('signature publicKey must be present', {
        matrixMutationRecipeCommitment: recipeCommitment,
        sourceMatrixCommitment: recipe.sourceMatrixCommitment,
        targetMatrixCommitment: recipe.targetMatrixCommitment,
      });
    }
    const publicKey = options.publicKey === undefined
      ? envelope.signature.publicKey
      : exportPublicKeyPem(options.publicKey);
    const payloadPublicKey = exportPublicKeyPem(envelope.signature.publicKey);
    const payload = signedMatrixMutationPayload({
      matrixMutationRecipeCommitment: recipeCommitment,
      matrixMutationRecipe: recipePayload,
      sourceMatrixCommitment: recipe.sourceMatrixCommitment,
      targetMatrixCommitment: recipe.targetMatrixCommitment,
      signerId: envelope.signerId,
      purpose: envelope.purpose,
      metadata: envelope.metadata,
      algorithm,
      publicKey: payloadPublicKey,
    });
    const signedMatrixMutationPayloadCommitment = signedMatrixMutationCommitment(payload);
    if (signedMatrixMutationPayloadCommitment !== envelope.signedMatrixMutationCommitment) {
      return invalid('signedMatrixMutationCommitment mismatch', {
        signedMatrixMutationCommitment: signedMatrixMutationPayloadCommitment,
        matrixMutationRecipeCommitment: recipeCommitment,
        sourceMatrixCommitment: recipe.sourceMatrixCommitment,
        targetMatrixCommitment: recipe.targetMatrixCommitment,
      });
    }

    const signature = decodeSignature(envelope.signature.value);
    const signatureValid = crypto.verify(null, Buffer.from(payload, 'utf8'), publicKey, signature);
    if (!signatureValid) {
      return invalid('signature verification failed', {
        signedMatrixMutationCommitment: signedMatrixMutationPayloadCommitment,
        matrixMutationRecipeCommitment: recipeCommitment,
        sourceMatrixCommitment: recipe.sourceMatrixCommitment,
        targetMatrixCommitment: recipe.targetMatrixCommitment,
      });
    }

    return validResult({
      signedMatrixMutationCommitment: signedMatrixMutationPayloadCommitment,
      matrixMutationRecipeCommitment: recipeCommitment,
      sourceMatrixCommitment: recipe.sourceMatrixCommitment,
      targetMatrixCommitment: recipe.targetMatrixCommitment,
      signerId: envelope.signerId,
      purpose: envelope.purpose,
      algorithm,
    });
  } catch (error) {
    return invalid(error.message);
  }
}

function applySignedMatrixMutation(sourceMatrix, envelope, options = {}) {
  const verification = verifySignedMatrixMutation(envelope, options);
  if (!verification.ok) {
    return verification;
  }

  try {
    const application = applyMatrixMutationRecipe(sourceMatrix, envelope.recipe, options);
    if (
      envelope.targetMatrixCommitment !== null
      && application.matrix.matrixCommitment !== envelope.targetMatrixCommitment
    ) {
      return invalid('targetMatrixCommitment does not match target matrix', verification);
    }

    return validResult({
      ...verification,
      application: cloneCanonicalValue(application, 'application'),
      matrix: cloneCanonicalValue(application.matrix, 'matrix'),
    });
  } catch (error) {
    return invalid(error.message, verification);
  }
}

module.exports = {
  SIGNED_MATRIX_MUTATE_FORMAT,
  SIGNED_MATRIX_MUTATE_VERSION,
  SIGNED_MATRIX_MUTATE_ALGORITHM,
  signedMatrixMutationPayload,
  signedMatrixMutationCommitment,
  createSignedMatrixMutation,
  verifySignedMatrixMutation,
  applySignedMatrixMutation,
};
