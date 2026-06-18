'use strict';

const crypto = require('node:crypto');

const {
  patchCommitment: computePatchCommitment,
  verifyPatch,
} = require('./patch');
const { stableStringify } = require('./stack-canonical');
const {
  generateEd25519KeyPair,
} = require('./signed-stack');

const SIGNED_PATCH_FORMAT = 'UNPATCH-SIGNED';
const SIGNED_PATCH_VERSION = 1;
const SIGNED_PATCH_PAYLOAD_DOMAIN = 'UNPATCH-SIGNED:v1';
const SUPPORTED_ALGORITHMS = new Set(['ed25519']);
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

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

function signedPatchPayloadObject({
  patchCommitment,
  signerId,
  purpose,
  metadata,
  algorithm,
}) {
  assertSupportedAlgorithm(algorithm);
  assertSha256Hex(patchCommitment, 'patchCommitment');
  if (typeof signerId !== 'string' || signerId.length === 0) {
    throw new TypeError('signerId must be a non-empty string');
  }
  if (typeof purpose !== 'string' || purpose.length === 0) {
    throw new TypeError('purpose must be a non-empty string');
  }

  return {
    domain: SIGNED_PATCH_PAYLOAD_DOMAIN,
    format: SIGNED_PATCH_FORMAT,
    version: SIGNED_PATCH_VERSION,
    patchCommitment,
    signerId,
    purpose,
    metadata: cloneCanonicalValue(metadata, 'metadata'),
    algorithm,
  };
}

function signedPatchPayload({
  patchCommitment,
  signerId,
  purpose,
  metadata,
  algorithm,
}) {
  return stableStringify(signedPatchPayloadObject({
    patchCommitment,
    signerId,
    purpose,
    metadata,
    algorithm,
  }));
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

function assertValidPatchForSigning(patch) {
  const result = verifyPatch(patch);
  if (!result.valid) {
    throw new TypeError(`patch is invalid: ${result.reason}`);
  }

  const patchCommitment = computePatchCommitment(patch);
  if (patchCommitment !== patch.patchCommitment) {
    throw new TypeError('patchCommitment mismatch');
  }

  return patchCommitment;
}

function createSignedPatchEnvelope({
  patch,
  signerId,
  privateKey,
  publicKey,
  purpose = 'owner-signed-patch',
  metadata = {},
  algorithm = 'ed25519',
}) {
  assertSupportedAlgorithm(algorithm);
  if (privateKey === undefined) {
    throw new TypeError('privateKey is required');
  }

  const patchCommitment = assertValidPatchForSigning(patch);
  const normalizedPatch = cloneCanonicalValue(patch, 'patch');
  const normalizedMetadata = cloneCanonicalValue(metadata, 'metadata');
  const payload = signedPatchPayload({
    patchCommitment,
    signerId,
    purpose,
    metadata: normalizedMetadata,
    algorithm,
  });
  const signature = crypto.sign(null, Buffer.from(payload, 'utf8'), privateKey);

  return {
    format: SIGNED_PATCH_FORMAT,
    version: SIGNED_PATCH_VERSION,
    patch: normalizedPatch,
    patchCommitment,
    payloadCommitment: sha256Hex(payload),
    signerId,
    purpose,
    metadata: normalizedMetadata,
    signature: {
      algorithm,
      signerId,
      publicKey: publicKeyForEnvelope(privateKey, publicKey),
      value: signature.toString('base64'),
    },
  };
}

function invalid(reason) {
  return {
    valid: false,
    reason,
  };
}

function verifySignedPatchEnvelope(envelope, options = {}) {
  try {
    if (envelope === null || typeof envelope !== 'object' || Array.isArray(envelope)) {
      return invalid('envelope must be an object');
    }
    if (envelope.format !== SIGNED_PATCH_FORMAT) {
      return invalid('envelope format is not UNPATCH-SIGNED');
    }
    if (envelope.version !== SIGNED_PATCH_VERSION) {
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

    const patchResult = verifyPatch(envelope.patch);
    if (!patchResult.valid) {
      return invalid(`patch invalid: ${patchResult.reason}`);
    }

    const patchCommitment = computePatchCommitment(envelope.patch);
    if (patchCommitment !== envelope.patchCommitment) {
      return invalid('patchCommitment mismatch');
    }

    const payload = signedPatchPayload({
      patchCommitment,
      signerId: envelope.signerId,
      purpose: envelope.purpose,
      metadata: envelope.metadata,
      algorithm,
    });
    const payloadCommitment = sha256Hex(payload);
    if (payloadCommitment !== envelope.payloadCommitment) {
      return invalid('payloadCommitment mismatch');
    }

    if (typeof envelope.signature.value !== 'string' || envelope.signature.value.length === 0) {
      return invalid('signature value must be a non-empty base64 string');
    }
    if (typeof envelope.signature.publicKey !== 'string' && options.publicKey === undefined) {
      return invalid('signature publicKey must be present');
    }

    const publicKey = options.publicKey === undefined ? envelope.signature.publicKey : options.publicKey;
    const signature = Buffer.from(envelope.signature.value, 'base64');
    const valid = crypto.verify(null, Buffer.from(payload, 'utf8'), publicKey, signature);

    if (!valid) {
      return invalid('signature verification failed');
    }

    return {
      valid: true,
      patchCommitment,
      payloadCommitment,
      signerId: envelope.signerId,
      purpose: envelope.purpose,
    };
  } catch (error) {
    return invalid(error.message);
  }
}

module.exports = {
  SIGNED_PATCH_FORMAT,
  SIGNED_PATCH_VERSION,
  SIGNED_PATCH_PAYLOAD_DOMAIN,
  signedPatchPayload,
  createSignedPatchEnvelope,
  verifySignedPatchEnvelope,
  generateEd25519KeyPair,
};
