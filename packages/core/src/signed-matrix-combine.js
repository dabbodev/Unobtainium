'use strict';

const crypto = require('node:crypto');

const {
  applyMatrixCombineRecipe,
  matrixCombineRecipeCommitment,
  matrixCombineRecipePayload,
  normalizeMatrixCombineRecipe,
} = require('./matrix-combine');
const { stableStringify } = require('./stack-canonical');

const SIGNED_MATRIX_COMBINE_FORMAT = 'UN-MATRIX-COMBINE-SIGNED';
const SIGNED_MATRIX_COMBINE_VERSION = 1;
const SIGNED_MATRIX_COMBINE_ALGORITHM = 'ed25519';
const SIGNED_MATRIX_COMBINE_PAYLOAD_DOMAIN = 'UN-MATRIX-COMBINE-SIGNED:v1';
const SUPPORTED_ALGORITHMS = new Set([SIGNED_MATRIX_COMBINE_ALGORITHM]);
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

function nullableCommitment(value, fieldName) {
  if (value === null) {
    return null;
  }
  assertSha256Hex(value, fieldName);
  return value;
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

function normalizeInputTileCommitments(inputTileCommitments) {
  if (!Array.isArray(inputTileCommitments) || inputTileCommitments.length === 0) {
    throw new TypeError('inputTileCommitments must be a non-empty array');
  }

  return inputTileCommitments.map((tile, index) => {
    if (tile === null || typeof tile !== 'object' || Array.isArray(tile)) {
      throw new TypeError(`inputTileCommitments[${index}] must be an object`);
    }
    if (typeof tile.name !== 'string' || tile.name.length === 0) {
      throw new TypeError(`inputTileCommitments[${index}].name must be a non-empty string`);
    }
    if (!Number.isSafeInteger(tile.rows) || tile.rows < 1) {
      throw new RangeError(`inputTileCommitments[${index}].rows must be a positive safe integer`);
    }
    if (!Number.isSafeInteger(tile.columns) || tile.columns < 1) {
      throw new RangeError(`inputTileCommitments[${index}].columns must be a positive safe integer`);
    }
    assertSha256Hex(tile.matrixCommitment, `inputTileCommitments[${index}].matrixCommitment`);

    return {
      name: tile.name,
      rows: tile.rows,
      columns: tile.columns,
      matrixCommitment: tile.matrixCommitment,
    };
  });
}

function sameCanonicalValue(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function signedMatrixCombinePayloadObject({
  matrixCombineRecipeCommitment,
  matrixCombineRecipe,
  inputTileCommitments,
  outputMatrixCommitment,
  signerId,
  purpose,
  metadata,
  algorithm,
  publicKey,
}) {
  assertSupportedAlgorithm(algorithm);
  assertSha256Hex(matrixCombineRecipeCommitment, 'matrixCombineRecipeCommitment');
  const normalizedOutputMatrixCommitment = nullableCommitment(
    outputMatrixCommitment,
    'outputMatrixCommitment'
  );
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
    domain: SIGNED_MATRIX_COMBINE_PAYLOAD_DOMAIN,
    format: SIGNED_MATRIX_COMBINE_FORMAT,
    version: SIGNED_MATRIX_COMBINE_VERSION,
    algorithm,
    publicKey,
    signerId,
    purpose,
    metadata: cloneCanonicalValue(metadata, 'metadata'),
    matrixCombineRecipeCommitment,
    matrixCombineRecipe: cloneCanonicalValue(matrixCombineRecipe, 'matrixCombineRecipe'),
    inputTileCommitments: normalizeInputTileCommitments(inputTileCommitments),
    outputMatrixCommitment: normalizedOutputMatrixCommitment,
  };
}

function signedMatrixCombinePayload({
  matrixCombineRecipeCommitment,
  matrixCombineRecipe,
  inputTileCommitments,
  outputMatrixCommitment,
  signerId,
  purpose,
  metadata,
  algorithm,
  publicKey,
}) {
  return stableStringify(signedMatrixCombinePayloadObject({
    matrixCombineRecipeCommitment,
    matrixCombineRecipe,
    inputTileCommitments,
    outputMatrixCommitment,
    signerId,
    purpose,
    metadata,
    algorithm,
    publicKey,
  }));
}

function signedMatrixCombineCommitment(payloadLike) {
  return sha256Hex(Buffer.concat([
    Buffer.from(SIGNED_MATRIX_COMBINE_PAYLOAD_DOMAIN, 'utf8'),
    Buffer.from([0]),
    Buffer.from(
      typeof payloadLike === 'string'
        ? payloadLike
        : signedMatrixCombinePayload(payloadLike),
      'utf8'
    ),
  ]));
}

function inferOutputMatrixCommitment(recipe, outputMetadata) {
  try {
    return applyMatrixCombineRecipe(recipe, {
      outputMetadata: outputMetadata === undefined ? {} : outputMetadata,
    }).matrix.matrixCommitment;
  } catch (error) {
    return null;
  }
}

function createSignedMatrixCombine({
  recipe,
  signerId,
  privateKey,
  publicKey,
  purpose = 'owner-signed-matrix-combine',
  metadata = {},
  algorithm = SIGNED_MATRIX_COMBINE_ALGORITHM,
  outputMatrixCommitment,
  outputMetadata,
}) {
  assertSupportedAlgorithm(algorithm);
  if (privateKey === undefined) {
    throw new TypeError('privateKey is required');
  }

  const normalizedRecipe = normalizeMatrixCombineRecipe(recipe);
  const recipePayload = matrixCombineRecipePayload(normalizedRecipe);
  const recipeCommitment = matrixCombineRecipeCommitment(normalizedRecipe);
  if (recipeCommitment !== normalizedRecipe.matrixCombineRecipeCommitment) {
    throw new TypeError('matrixCombineRecipeCommitment mismatch');
  }

  const normalizedMetadata = cloneCanonicalValue(metadata, 'metadata');
  const exportedPublicKey = publicKeyForEnvelope(privateKey, publicKey);
  const normalizedOutputMatrixCommitment = outputMatrixCommitment === undefined
    ? inferOutputMatrixCommitment(recipe, outputMetadata)
    : nullableCommitment(outputMatrixCommitment, 'outputMatrixCommitment');
  const inputTileCommitments = normalizeInputTileCommitments(normalizedRecipe.tiles);
  const payload = signedMatrixCombinePayload({
    matrixCombineRecipeCommitment: recipeCommitment,
    matrixCombineRecipe: recipePayload,
    inputTileCommitments,
    outputMatrixCommitment: normalizedOutputMatrixCommitment,
    signerId,
    purpose,
    metadata: normalizedMetadata,
    algorithm,
    publicKey: exportedPublicKey,
  });
  const signature = crypto.sign(null, Buffer.from(payload, 'utf8'), privateKey);

  return {
    format: SIGNED_MATRIX_COMBINE_FORMAT,
    version: SIGNED_MATRIX_COMBINE_VERSION,
    algorithm,
    recipe: normalizedRecipe,
    matrixCombineRecipeCommitment: recipeCommitment,
    inputTileCommitments,
    outputMatrixCommitment: normalizedOutputMatrixCommitment,
    signedMatrixCombineCommitment: signedMatrixCombineCommitment(payload),
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

function verificationFields({
  signedMatrixCombineCommitmentValue,
  matrixCombineRecipeCommitmentValue,
  inputTileCommitments,
  outputMatrixCommitment,
}) {
  return {
    signedMatrixCombineCommitment: signedMatrixCombineCommitmentValue,
    matrixCombineRecipeCommitment: matrixCombineRecipeCommitmentValue,
    inputTileCommitments: inputTileCommitments === undefined
      ? undefined
      : cloneCanonicalValue(inputTileCommitments, 'inputTileCommitments'),
    outputMatrixCommitment,
  };
}

function verifySignedMatrixCombine(envelope, options = {}) {
  try {
    if (envelope === null || typeof envelope !== 'object' || Array.isArray(envelope)) {
      return invalid('envelope must be an object');
    }
    if (envelope.format !== SIGNED_MATRIX_COMBINE_FORMAT) {
      return invalid('envelope format is not UN-MATRIX-COMBINE-SIGNED');
    }
    if (envelope.version !== SIGNED_MATRIX_COMBINE_VERSION) {
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

    const recipe = normalizeMatrixCombineRecipe(envelope.recipe);
    const recipePayload = matrixCombineRecipePayload(recipe);
    const recipeCommitment = matrixCombineRecipeCommitment(recipe);
    const inputTileCommitments = normalizeInputTileCommitments(recipe.tiles);
    const outputMatrixCommitment = Object.hasOwn(envelope, 'outputMatrixCommitment')
      ? nullableCommitment(envelope.outputMatrixCommitment, 'outputMatrixCommitment')
      : null;
    const baseFields = verificationFields({
      matrixCombineRecipeCommitmentValue: recipeCommitment,
      inputTileCommitments,
      outputMatrixCommitment,
    });

    if (recipeCommitment !== envelope.matrixCombineRecipeCommitment) {
      return invalid('matrixCombineRecipeCommitment mismatch', baseFields);
    }
    if (!Object.hasOwn(envelope, 'inputTileCommitments')) {
      return invalid('inputTileCommitments are required', baseFields);
    }
    const envelopeInputTileCommitments = normalizeInputTileCommitments(envelope.inputTileCommitments);
    if (!sameCanonicalValue(envelopeInputTileCommitments, inputTileCommitments)) {
      return invalid('inputTileCommitments mismatch', baseFields);
    }
    if (!Object.hasOwn(envelope, 'outputMatrixCommitment')) {
      return invalid('outputMatrixCommitment is required', baseFields);
    }

    if (typeof envelope.signature.publicKey !== 'string') {
      return invalid('signature publicKey must be present', baseFields);
    }
    const publicKey = options.publicKey === undefined
      ? envelope.signature.publicKey
      : exportPublicKeyPem(options.publicKey);
    const payloadPublicKey = exportPublicKeyPem(envelope.signature.publicKey);
    const payload = signedMatrixCombinePayload({
      matrixCombineRecipeCommitment: recipeCommitment,
      matrixCombineRecipe: recipePayload,
      inputTileCommitments,
      outputMatrixCommitment,
      signerId: envelope.signerId,
      purpose: envelope.purpose,
      metadata: envelope.metadata,
      algorithm,
      publicKey: payloadPublicKey,
    });
    const signedMatrixCombineCommitmentValue = signedMatrixCombineCommitment(payload);
    const signedFields = verificationFields({
      signedMatrixCombineCommitmentValue,
      matrixCombineRecipeCommitmentValue: recipeCommitment,
      inputTileCommitments,
      outputMatrixCommitment,
    });
    if (signedMatrixCombineCommitmentValue !== envelope.signedMatrixCombineCommitment) {
      return invalid('signedMatrixCombineCommitment mismatch', signedFields);
    }

    const signature = decodeSignature(envelope.signature.value);
    const signatureValid = crypto.verify(null, Buffer.from(payload, 'utf8'), publicKey, signature);
    if (!signatureValid) {
      return invalid('signature verification failed', signedFields);
    }

    return validResult({
      ...signedFields,
      signerId: envelope.signerId,
      purpose: envelope.purpose,
      algorithm,
    });
  } catch (error) {
    return invalid(error.message);
  }
}

function materialRecipeFromTiles(tiles, signedRecipe) {
  const recipePayload = matrixCombineRecipePayload(signedRecipe);

  return {
    format: recipePayload.format,
    version: recipePayload.version,
    tiles,
    placements: recipePayload.placements,
    metadata: recipePayload.metadata,
  };
}

function applySignedMatrixCombine(tiles, envelope, options = {}) {
  const verification = verifySignedMatrixCombine(envelope, options);
  if (!verification.ok) {
    return verification;
  }

  try {
    const materialRecipe = materialRecipeFromTiles(tiles, envelope.recipe);
    const materialRecipeCommitment = normalizeMatrixCombineRecipe(materialRecipe).matrixCombineRecipeCommitment;
    if (materialRecipeCommitment !== verification.matrixCombineRecipeCommitment) {
      return invalid('input tile commitments do not match signed tile commitments', verification);
    }

    const application = applyMatrixCombineRecipe(materialRecipe, options);
    if (
      verification.outputMatrixCommitment !== null
      && application.matrix.matrixCommitment !== verification.outputMatrixCommitment
    ) {
      return invalid('outputMatrixCommitment does not match output matrix', verification);
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
  SIGNED_MATRIX_COMBINE_FORMAT,
  SIGNED_MATRIX_COMBINE_VERSION,
  SIGNED_MATRIX_COMBINE_ALGORITHM,
  signedMatrixCombinePayload,
  signedMatrixCombineCommitment,
  createSignedMatrixCombine,
  verifySignedMatrixCombine,
  applySignedMatrixCombine,
};
