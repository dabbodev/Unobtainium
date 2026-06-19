'use strict';

const crypto = require('node:crypto');

const { normalizeTurns } = require('./ring');
const { stableStringify, stackCommitment } = require('./stack-canonical');
const { verifySignedStackEnvelope } = require('./signed-stack');
const {
  applyResidual,
  generateFromStack,
  normalizeGenerationData,
  residualBetween,
} = require('./generation');

const GENERATION_DESCRIPTOR_FORMAT = 'UN-GEN-DESCRIPTOR';
const GENERATION_DESCRIPTOR_VERSION = 1;
const DESCRIPTOR_COMMITMENT_DOMAIN = 'UN-GEN-DESCRIPTOR:v1';
const DATA_COMMITMENT_DOMAIN = 'UN-GEN-DATA:v1';
const RESIDUAL_COMMITMENT_DOMAIN = 'UN-GEN-RESIDUAL:v1';
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;
const DATA_TYPES = new Set(['array', 'uint8array', 'buffer']);

function sha256Hex(parts) {
  const hash = crypto.createHash('sha256');
  parts.forEach((part) => hash.update(part));
  return hash.digest('hex');
}

function invalid(reason) {
  return {
    valid: false,
    reason,
  };
}

function assertObject(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function assertSha256HexOrNull(value, fieldName) {
  if (value === null) {
    return;
  }
  if (typeof value !== 'string' || !SHA256_HEX_PATTERN.test(value)) {
    throw new TypeError(`${fieldName} must be a SHA-256 hex string or null`);
  }
}

function assertSha256Hex(value, fieldName) {
  if (typeof value !== 'string' || !SHA256_HEX_PATTERN.test(value)) {
    throw new TypeError(`${fieldName} must be a SHA-256 hex string`);
  }
}

function assertLength(length) {
  if (!Number.isInteger(length)) {
    throw new TypeError('length must be an integer');
  }
  if (length < 0) {
    throw new RangeError('length must be a non-negative integer');
  }
}

function assertWindowSize(windowSize) {
  if (!Number.isInteger(windowSize)) {
    throw new TypeError('windowSize must be an integer');
  }
  if (windowSize <= 1) {
    throw new RangeError('windowSize must be greater than 1');
  }
}

function assertDataType(type) {
  if (!DATA_TYPES.has(type)) {
    throw new RangeError('type must be "array", "uint8array", or "buffer"');
  }
}

function assertFill({ fill, windowSize, type }) {
  if (!Number.isInteger(fill)) {
    throw new TypeError('fill must be an integer');
  }

  const normalizedFill = normalizeTurns(fill, windowSize);
  if ((type === 'uint8array' || type === 'buffer') && (normalizedFill < 0 || normalizedFill > 255)) {
    throw new RangeError(`${type} fill must fit in one byte`);
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

function assertOwnField(value, fieldName) {
  if (!Object.hasOwn(value, fieldName)) {
    throw new TypeError(`${fieldName} is required`);
  }
}

function descriptorBasePayload(descriptorLike) {
  assertObject(descriptorLike, 'descriptor');

  for (const fieldName of [
    'format',
    'version',
    'length',
    'windowSize',
    'type',
    'fill',
    'stackCommitment',
    'signedStackPayloadCommitment',
    'generatedCommitment',
    'targetCommitment',
    'residualCommitment',
    'metadata',
  ]) {
    assertOwnField(descriptorLike, fieldName);
  }

  if (descriptorLike.format !== GENERATION_DESCRIPTOR_FORMAT) {
    throw new TypeError('descriptor format is not UN-GEN-DESCRIPTOR');
  }
  if (descriptorLike.version !== GENERATION_DESCRIPTOR_VERSION) {
    throw new TypeError('descriptor version is not supported');
  }

  assertLength(descriptorLike.length);
  assertWindowSize(descriptorLike.windowSize);
  assertDataType(descriptorLike.type);
  assertFill({
    fill: descriptorLike.fill,
    windowSize: descriptorLike.windowSize,
    type: descriptorLike.type,
  });
  assertSha256Hex(descriptorLike.stackCommitment, 'stackCommitment');
  assertSha256HexOrNull(
    descriptorLike.signedStackPayloadCommitment,
    'signedStackPayloadCommitment',
  );
  assertSha256Hex(descriptorLike.generatedCommitment, 'generatedCommitment');
  assertSha256HexOrNull(descriptorLike.targetCommitment, 'targetCommitment');
  assertSha256HexOrNull(descriptorLike.residualCommitment, 'residualCommitment');

  return {
    format: descriptorLike.format,
    version: descriptorLike.version,
    length: descriptorLike.length,
    windowSize: descriptorLike.windowSize,
    type: descriptorLike.type,
    fill: descriptorLike.fill,
    stackCommitment: descriptorLike.stackCommitment,
    signedStackPayloadCommitment: descriptorLike.signedStackPayloadCommitment,
    generatedCommitment: descriptorLike.generatedCommitment,
    targetCommitment: descriptorLike.targetCommitment,
    residualCommitment: descriptorLike.residualCommitment,
    metadata: cloneCanonicalValue(descriptorLike.metadata, 'metadata'),
  };
}

function generationDescriptorPayload(descriptorLike) {
  return descriptorBasePayload(descriptorLike);
}

function generationDescriptorCommitment(descriptorLike) {
  const payload = generationDescriptorPayload(descriptorLike);
  return sha256Hex([
    Buffer.from(DESCRIPTOR_COMMITMENT_DOMAIN, 'utf8'),
    Buffer.from([0]),
    Buffer.from(stableStringify(payload), 'utf8'),
  ]);
}

function dataCommitment(data, { windowSize, fieldName }) {
  const normalized = normalizeGenerationData(data, windowSize, fieldName);
  const payload = {
    domain: DATA_COMMITMENT_DOMAIN,
    fieldName,
    length: normalized.length,
    windowSize,
    values: normalized.values,
  };

  return sha256Hex([
    Buffer.from(DATA_COMMITMENT_DOMAIN, 'utf8'),
    Buffer.from([0]),
    Buffer.from(stableStringify(payload), 'utf8'),
  ]);
}

function normalizeResidualValues(residual, windowSize) {
  assertWindowSize(windowSize);
  if (!Array.isArray(residual) && !Buffer.isBuffer(residual) && !(residual instanceof Uint8Array)) {
    throw new TypeError('residual must be an Array, Uint8Array, or Buffer');
  }

  const values = [];
  for (let index = 0; index < residual.length; index += 1) {
    const value = residual[index];
    if (!Number.isInteger(value)) {
      throw new TypeError(`residual[${index}] must be an integer`);
    }
    values.push(normalizeTurns(value, windowSize));
  }

  return values;
}

function residualCommitment(residual, { windowSize }) {
  const values = normalizeResidualValues(residual, windowSize);
  const payload = {
    domain: RESIDUAL_COMMITMENT_DOMAIN,
    length: values.length,
    windowSize,
    values,
  };

  return sha256Hex([
    Buffer.from(RESIDUAL_COMMITMENT_DOMAIN, 'utf8'),
    Buffer.from([0]),
    Buffer.from(stableStringify(payload), 'utf8'),
  ]);
}

function assertDataLength(data, expectedLength, fieldName, windowSize) {
  const normalized = normalizeGenerationData(data, windowSize, fieldName);
  if (normalized.length !== expectedLength) {
    throw new RangeError(`${fieldName} length must match descriptor length`);
  }
}

function assertResidualLength(residual, expectedLength, windowSize) {
  const values = normalizeResidualValues(residual, windowSize);
  if (values.length !== expectedLength) {
    throw new RangeError('residual length must match descriptor length');
  }
}

function stacksMatch(left, right) {
  return stackCommitment(left) === stackCommitment(right);
}

function stackMaterial({ stack, signedStackEnvelope }) {
  if (signedStackEnvelope === undefined && stack === undefined) {
    throw new TypeError('stack or signedStackEnvelope is required');
  }

  if (signedStackEnvelope === undefined) {
    return {
      stack,
      stackCommitment: stackCommitment(stack),
      signedStackPayloadCommitment: null,
    };
  }

  const signedResult = verifySignedStackEnvelope(signedStackEnvelope);
  if (!signedResult.valid) {
    throw new TypeError(`signedStackEnvelope is invalid: ${signedResult.reason}`);
  }

  const generationStack = stack === undefined ? signedStackEnvelope.stack : stack;
  if (stack !== undefined && !stacksMatch(stack, signedStackEnvelope.stack)) {
    throw new TypeError('stack must match signedStackEnvelope.stack');
  }

  return {
    stack: generationStack,
    stackCommitment: signedResult.stackCommitment,
    signedStackPayloadCommitment: signedResult.payloadCommitment,
  };
}

function createGenerationDescriptor(options) {
  assertObject(options, 'options');

  const {
    length,
    stack,
    signedStackEnvelope,
    windowSize = 256,
    type = 'array',
    fill = 0,
    target,
    residual,
    metadata = {},
  } = options;

  assertLength(length);
  assertWindowSize(windowSize);
  assertDataType(type);
  assertFill({ fill, windowSize, type });

  const normalizedMetadata = cloneCanonicalValue(metadata, 'metadata');
  const material = stackMaterial({ stack, signedStackEnvelope });
  const generated = generateFromStack({
    length,
    stack: material.stack,
    windowSize,
    type,
    fill,
  });
  const generatedCommitment = dataCommitment(generated, {
    windowSize,
    fieldName: 'generated',
  });

  let targetCommitment = null;
  let residualCommitmentValue = null;
  let effectiveResidual = residual;

  if (target !== undefined) {
    assertDataLength(target, length, 'target', windowSize);
    targetCommitment = dataCommitment(target, {
      windowSize,
      fieldName: 'target',
    });

    if (effectiveResidual === undefined) {
      effectiveResidual = residualBetween({ target, generated, windowSize });
    }
  }

  if (effectiveResidual !== undefined) {
    assertResidualLength(effectiveResidual, length, windowSize);
    residualCommitmentValue = residualCommitment(effectiveResidual, { windowSize });
  }

  if (target !== undefined && effectiveResidual !== undefined) {
    const reconstructed = applyResidual({
      generated,
      residual: effectiveResidual,
      windowSize,
    });
    const reconstructedCommitment = dataCommitment(reconstructed, {
      windowSize,
      fieldName: 'target',
    });
    if (reconstructedCommitment !== targetCommitment) {
      throw new TypeError('residual does not reconstruct target');
    }
  }

  const payload = {
    format: GENERATION_DESCRIPTOR_FORMAT,
    version: GENERATION_DESCRIPTOR_VERSION,
    length,
    windowSize,
    type,
    fill,
    stackCommitment: material.stackCommitment,
    signedStackPayloadCommitment: material.signedStackPayloadCommitment,
    generatedCommitment,
    targetCommitment,
    residualCommitment: residualCommitmentValue,
    metadata: normalizedMetadata,
  };

  return {
    ...payload,
    descriptorCommitment: generationDescriptorCommitment(payload),
  };
}

function verifyGenerationDescriptor(
  descriptor,
  {
    stack,
    signedStackEnvelope,
    target,
    generated,
    residual,
  } = {},
) {
  try {
    assertObject(descriptor, 'descriptor');
    if (descriptor.format !== GENERATION_DESCRIPTOR_FORMAT) {
      return invalid('descriptor format is not UN-GEN-DESCRIPTOR');
    }
    if (descriptor.version !== GENERATION_DESCRIPTOR_VERSION) {
      return invalid('descriptor version is not supported');
    }
    assertSha256Hex(descriptor.descriptorCommitment, 'descriptorCommitment');

    const payload = generationDescriptorPayload(descriptor);
    const descriptorCommitment = generationDescriptorCommitment(payload);
    if (descriptorCommitment !== descriptor.descriptorCommitment) {
      return invalid('descriptorCommitment mismatch');
    }

    let generationStack;
    if (signedStackEnvelope !== undefined) {
      const signedResult = verifySignedStackEnvelope(signedStackEnvelope);
      if (!signedResult.valid) {
        return invalid(`signedStackEnvelope invalid: ${signedResult.reason}`);
      }
      if (signedResult.stackCommitment !== descriptor.stackCommitment) {
        return invalid('stackCommitment mismatch');
      }
      if (signedResult.payloadCommitment !== descriptor.signedStackPayloadCommitment) {
        return invalid('signedStackPayloadCommitment mismatch');
      }
      generationStack = signedStackEnvelope.stack;
    }

    if (stack !== undefined) {
      const currentStackCommitment = stackCommitment(stack);
      if (currentStackCommitment !== descriptor.stackCommitment) {
        return invalid('stackCommitment mismatch');
      }
      generationStack = stack;
    }

    let generatedForReconstruction;
    if (generationStack !== undefined) {
      const regenerated = generateFromStack({
        length: descriptor.length,
        stack: generationStack,
        windowSize: descriptor.windowSize,
        type: descriptor.type,
        fill: descriptor.fill,
      });
      const regeneratedCommitment = dataCommitment(regenerated, {
        windowSize: descriptor.windowSize,
        fieldName: 'generated',
      });
      if (regeneratedCommitment !== descriptor.generatedCommitment) {
        return invalid('generatedCommitment mismatch');
      }
      generatedForReconstruction = regenerated;
    }

    if (generated !== undefined) {
      assertDataLength(generated, descriptor.length, 'generated', descriptor.windowSize);
      const currentGeneratedCommitment = dataCommitment(generated, {
        windowSize: descriptor.windowSize,
        fieldName: 'generated',
      });
      if (currentGeneratedCommitment !== descriptor.generatedCommitment) {
        return invalid('generatedCommitment mismatch');
      }
      generatedForReconstruction = generated;
    }

    if (target !== undefined) {
      if (descriptor.targetCommitment === null) {
        return invalid('targetCommitment mismatch');
      }
      assertDataLength(target, descriptor.length, 'target', descriptor.windowSize);
      const currentTargetCommitment = dataCommitment(target, {
        windowSize: descriptor.windowSize,
        fieldName: 'target',
      });
      if (currentTargetCommitment !== descriptor.targetCommitment) {
        return invalid('targetCommitment mismatch');
      }
    }

    if (residual !== undefined) {
      if (descriptor.residualCommitment === null) {
        return invalid('residualCommitment mismatch');
      }
      assertResidualLength(residual, descriptor.length, descriptor.windowSize);
      const currentResidualCommitment = residualCommitment(residual, {
        windowSize: descriptor.windowSize,
      });
      if (currentResidualCommitment !== descriptor.residualCommitment) {
        return invalid('residualCommitment mismatch');
      }
    }

    if (generatedForReconstruction !== undefined && residual !== undefined && target !== undefined) {
      const reconstructed = applyResidual({
        generated: generatedForReconstruction,
        residual,
        windowSize: descriptor.windowSize,
      });
      const reconstructedCommitment = dataCommitment(reconstructed, {
        windowSize: descriptor.windowSize,
        fieldName: 'target',
      });
      if (reconstructedCommitment !== descriptor.targetCommitment) {
        return invalid('residual reconstruction mismatch');
      }
    }

    return {
      valid: true,
      descriptorCommitment,
      stackCommitment: descriptor.stackCommitment,
      signedStackPayloadCommitment: descriptor.signedStackPayloadCommitment,
      generatedCommitment: descriptor.generatedCommitment,
      targetCommitment: descriptor.targetCommitment,
      residualCommitment: descriptor.residualCommitment,
    };
  } catch (error) {
    return invalid(error.message);
  }
}

module.exports = {
  GENERATION_DESCRIPTOR_FORMAT,
  GENERATION_DESCRIPTOR_VERSION,
  generationDescriptorPayload,
  generationDescriptorCommitment,
  createGenerationDescriptor,
  verifyGenerationDescriptor,
  residualCommitment,
};
