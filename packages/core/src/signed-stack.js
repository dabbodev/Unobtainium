'use strict';

const crypto = require('node:crypto');

const { normalizeStack } = require('./stack');
const {
  stableStringify,
  stackCommitment: computeStackCommitment,
} = require('./stack-canonical');

const SIGNED_STACK_FORMAT = 'UNSTACK-SIGNED';
const SIGNED_STACK_VERSION = 1;
const SUPPORTED_ALGORITHMS = new Set(['ed25519']);

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

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function signedStackPayloadObject({
  stackCommitment,
  signerId,
  purpose,
  metadata,
  algorithm,
}) {
  assertSupportedAlgorithm(algorithm);

  if (typeof stackCommitment !== 'string' || !/^[0-9a-f]{64}$/.test(stackCommitment)) {
    throw new TypeError('stackCommitment must be a SHA-256 hex string');
  }
  if (typeof signerId !== 'string' || signerId.length === 0) {
    throw new TypeError('signerId must be a non-empty string');
  }
  if (typeof purpose !== 'string' || purpose.length === 0) {
    throw new TypeError('purpose must be a non-empty string');
  }

  return {
    format: SIGNED_STACK_FORMAT,
    version: SIGNED_STACK_VERSION,
    stackCommitment,
    signerId,
    purpose,
    metadata: cloneCanonicalValue(metadata, 'metadata'),
    algorithm,
  };
}

function signedStackPayload({
  stackCommitment,
  signerId,
  purpose,
  metadata,
  algorithm,
}) {
  return stableStringify(signedStackPayloadObject({
    stackCommitment,
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

function generateEd25519KeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

  return {
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

function createSignedStackEnvelope({
  stack,
  signerId,
  privateKey,
  publicKey,
  purpose = 'owner-signed-stack',
  metadata = {},
  algorithm = 'ed25519',
}) {
  assertSupportedAlgorithm(algorithm);
  if (privateKey === undefined) {
    throw new TypeError('privateKey is required');
  }

  const normalizedStack = normalizeStack(stack);
  const normalizedMetadata = cloneCanonicalValue(metadata, 'metadata');
  const stackCommitment = computeStackCommitment(normalizedStack);
  const payload = signedStackPayload({
    stackCommitment,
    signerId,
    purpose,
    metadata: normalizedMetadata,
    algorithm,
  });
  const signature = crypto.sign(null, Buffer.from(payload, 'utf8'), privateKey);

  return {
    format: SIGNED_STACK_FORMAT,
    version: SIGNED_STACK_VERSION,
    stack: normalizedStack,
    stackCommitment,
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
    ok: false,
    valid: false,
    reason,
    error: reason,
  };
}

function verifySignedStackEnvelope(envelope, options = {}) {
  try {
    if (envelope === null || typeof envelope !== 'object' || Array.isArray(envelope)) {
      return invalid('envelope must be an object');
    }
    if (envelope.format !== SIGNED_STACK_FORMAT) {
      return invalid('envelope format is not UNSTACK-SIGNED');
    }
    if (envelope.version !== SIGNED_STACK_VERSION) {
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

    const normalizedStack = normalizeStack(envelope.stack);
    const stackCommitment = computeStackCommitment(normalizedStack);
    if (stackCommitment !== envelope.stackCommitment) {
      return invalid('stackCommitment mismatch');
    }

    const payload = signedStackPayload({
      stackCommitment,
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
      ok: true,
      valid: true,
      stackCommitment,
      payloadCommitment,
      signerId: envelope.signerId,
      purpose: envelope.purpose,
    };
  } catch (error) {
    return invalid(error.message);
  }
}

module.exports = {
  SIGNED_STACK_FORMAT,
  SIGNED_STACK_VERSION,
  signedStackPayload,
  createSignedStackEnvelope,
  verifySignedStackEnvelope,
  generateEd25519KeyPair,
};
