'use strict';

const crypto = require('node:crypto');

const {
  createMatrixKey,
} = require('./matrix');
const {
  applySignedMatrixCombine,
  verifySignedMatrixCombine,
} = require('./signed-matrix-combine');
const {
  restoreCutout,
  verifyCutout,
} = require('./cutout');
const { stableStringify } = require('./stack-canonical');

const CERT_FORMAT = 'UN-CERT';
const CERT_VERSION = 1;
const CERT_COMMITMENT_DOMAIN = 'UN-CERT:v1';
const CERT_CUTOUT_COMMITMENT_DOMAIN = 'UN-CERT:CUTOUT:v1';
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

function assertObject(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function assertOwnField(value, fieldName) {
  if (!Object.hasOwn(value, fieldName)) {
    throw new TypeError(`${fieldName} is required`);
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
    throw new TypeError(`${fieldName} must be a lowercase SHA-256 hex commitment`);
  }

  return value;
}

function normalizeName(value, fieldName) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }

  return value;
}

function normalizeOptionalLabel(value, fieldName) {
  if (value === undefined || value === null) {
    return null;
  }

  return normalizeName(value, fieldName);
}

function normalizePositiveDimension(value, fieldName) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${fieldName} must be a positive safe integer`);
  }

  return value;
}

function hasMatrixValues(value) {
  return Array.isArray(value) || (
    value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.hasOwn(value, 'values')
  );
}

function namedTileLikeFromArrayEntry(entry, fieldName, index) {
  assertObject(entry, `${fieldName}[${index}]`);
  const hasName = Object.hasOwn(entry, 'name');
  const hasId = Object.hasOwn(entry, 'id');
  if (!hasName && !hasId) {
    throw new TypeError(`${fieldName}[${index}] must include name or id`);
  }

  const name = normalizeName(hasName ? entry.name : entry.id, `${fieldName}[${index}].name`);
  if (hasName && hasId && entry.name !== entry.id) {
    throw new RangeError(`${fieldName}[${index}] name and id must match when both are supplied`);
  }

  if (Object.hasOwn(entry, 'matrix')) {
    return { name, tileLike: entry.matrix };
  }

  return { name, tileLike: entry };
}

function descriptorFromMatrix(name, matrixLike, includeMaterial, fieldName) {
  const key = createMatrixKey(matrixLike);
  const descriptor = {
    name,
    rows: key.rows,
    columns: key.columns,
    matrixCommitment: key.matrixCommitment,
  };

  if (!includeMaterial) {
    return descriptor;
  }

  return {
    ...descriptor,
    matrix: {
      format: key.format,
      version: key.version,
      rows: key.rows,
      columns: key.columns,
      values: key.values.map((row) => row.slice()),
      metadata: cloneCanonicalValue(key.metadata, `${fieldName}.metadata`),
      matrixCommitment: key.matrixCommitment,
    },
  };
}

function descriptorFromCommitment(name, tileLike, fieldName) {
  assertObject(tileLike, fieldName);
  assertOwnField(tileLike, 'rows');
  assertOwnField(tileLike, 'columns');
  assertOwnField(tileLike, 'matrixCommitment');

  return {
    name,
    rows: normalizePositiveDimension(tileLike.rows, `${fieldName}.rows`),
    columns: normalizePositiveDimension(tileLike.columns, `${fieldName}.columns`),
    matrixCommitment: assertSha256Hex(
      tileLike.matrixCommitment,
      `${fieldName}.matrixCommitment`
    ),
  };
}

function normalizeTileEntry(name, tileLike, options, fieldName) {
  if (hasMatrixValues(tileLike)) {
    return descriptorFromMatrix(name, tileLike, options.includeMaterial, fieldName);
  }

  return descriptorFromCommitment(name, tileLike, fieldName);
}

function normalizeTileCollection(value, options) {
  const entries = [];
  const { fieldName } = options;

  if (value === undefined) {
    return entries;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const { name, tileLike } = namedTileLikeFromArrayEntry(value[index], fieldName, index);
      entries.push(normalizeTileEntry(name, tileLike, options, `${fieldName}[${index}]`));
    }
  } else {
    assertObject(value, fieldName);
    for (const rawName of Object.keys(value)) {
      const name = normalizeName(rawName, `${fieldName} tile name`);
      entries.push(normalizeTileEntry(name, value[rawName], options, `${fieldName}.${name}`));
    }
  }

  return entries;
}

function mergeNamedEntries(groups, fieldName) {
  const entries = groups.flat();
  if (entries.length === 0) {
    throw new RangeError(`${fieldName} must contain at least one entry`);
  }

  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.name)) {
      throw new RangeError(`duplicate tile/slot name: ${entry.name}`);
    }
    seen.add(entry.name);
  }

  entries.sort((left, right) => left.name.localeCompare(right.name));
  return entries.map((entry) => cloneCanonicalValue(entry, fieldName));
}

function normalizePublicTiles(input) {
  const groups = [
    normalizeTileCollection(input.publicTiles, {
      fieldName: 'publicTiles',
      includeMaterial: true,
    }),
    normalizeTileCollection(input.publicTileCommitments, {
      fieldName: 'publicTileCommitments',
      includeMaterial: false,
    }),
  ];

  return mergeNamedEntries(groups, 'publicTiles');
}

function normalizePrivateSlots(input) {
  const privateSlotInput = input.privateSlots === undefined
    ? input.privateTileSlots
    : input.privateSlots;
  const groups = [
    normalizeTileCollection(privateSlotInput, {
      fieldName: 'privateSlots',
      includeMaterial: false,
    }),
    normalizeTileCollection(input.expectedPrivateTileCommitments, {
      fieldName: 'expectedPrivateTileCommitments',
      includeMaterial: false,
    }),
  ];

  return mergeNamedEntries(groups, 'privateSlots');
}

function assertUniqueCertificateNames(publicTiles, privateSlots) {
  const seen = new Set();
  for (const entry of [...publicTiles, ...privateSlots]) {
    if (seen.has(entry.name)) {
      throw new RangeError(`duplicate tile/slot name: ${entry.name}`);
    }
    seen.add(entry.name);
  }
}

function validateCommitmentFields(value, path) {
  if (value === null) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateCommitmentFields(entry, `${path}[${index}]`));
    return;
  }
  if (typeof value !== 'object') {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    const entryPath = `${path}.${key}`;
    if (/commitment/i.test(key) && typeof entry === 'string') {
      assertSha256Hex(entry, entryPath);
    }
    validateCommitmentFields(entry, entryPath);
  }
}

function normalizeTargetCommitments(value) {
  const normalized = cloneCanonicalValue(value === undefined ? {} : value, 'targetCommitments');
  validateCommitmentFields(normalized, 'targetCommitments');
  return normalized;
}

function firstDefined(values) {
  for (const value of values) {
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function cutoutSpanCommitmentsFrom(bindingLike, fieldName) {
  const spanCommitments = firstDefined([
    bindingLike.spanCommitments,
    bindingLike.spans,
    bindingLike.plan === undefined ? undefined : bindingLike.plan.spans,
    bindingLike.cutoutPlan === undefined ? undefined : bindingLike.cutoutPlan.spans,
  ]);

  if (!Array.isArray(spanCommitments)) {
    throw new TypeError(`${fieldName}.spanCommitments must be an array`);
  }

  return spanCommitments.map((entry, index) => {
    const commitment = typeof entry === 'string'
      ? entry
      : entry !== null && typeof entry === 'object' && !Array.isArray(entry)
        ? entry.spanCommitment
        : undefined;
    return assertSha256Hex(commitment, `${fieldName}.spanCommitments[${index}]`);
  });
}

function normalizeCutoutBinding(bindingLike, index, fieldName = `cutouts[${index}]`) {
  assertObject(bindingLike, fieldName);

  return {
    label: normalizeOptionalLabel(bindingLike.label, `${fieldName}.label`),
    cutoutPlanCommitment: assertSha256Hex(
      firstDefined([
        bindingLike.cutoutPlanCommitment,
        bindingLike.plan === undefined ? undefined : bindingLike.plan.cutoutPlanCommitment,
        bindingLike.cutoutPlan === undefined ? undefined : bindingLike.cutoutPlan.cutoutPlanCommitment,
      ]),
      `${fieldName}.cutoutPlanCommitment`
    ),
    originalPayloadCommitment: assertSha256Hex(
      firstDefined([
        bindingLike.originalPayloadCommitment,
        bindingLike.plan === undefined ? undefined : bindingLike.plan.originalPayloadCommitment,
        bindingLike.cutoutPlan === undefined ? undefined : bindingLike.cutoutPlan.originalPayloadCommitment,
      ]),
      `${fieldName}.originalPayloadCommitment`
    ),
    publicPayloadCommitment: assertSha256Hex(
      bindingLike.publicPayloadCommitment,
      `${fieldName}.publicPayloadCommitment`
    ),
    spanCommitments: cutoutSpanCommitmentsFrom(bindingLike, fieldName),
    context: cloneCanonicalValue(
      bindingLike.context === undefined ? {} : bindingLike.context,
      `${fieldName}.context`
    ),
    metadata: cloneCanonicalValue(
      bindingLike.metadata === undefined ? {} : bindingLike.metadata,
      `${fieldName}.metadata`
    ),
  };
}

function normalizeCutoutBindings(value) {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new TypeError('cutouts must be an array');
  }

  const normalized = value.map((entry, index) => normalizeCutoutBinding(entry, index));
  const labels = new Set();
  for (const binding of normalized) {
    if (binding.label === null) {
      continue;
    }
    if (labels.has(binding.label)) {
      throw new RangeError(`duplicate cutout label: ${binding.label}`);
    }
    labels.add(binding.label);
  }

  return cloneCanonicalValue(normalized, 'cutouts');
}

function certificateCutoutPayload(cutoutBindingLike) {
  return cloneCanonicalValue(
    normalizeCutoutBinding(cutoutBindingLike, 0, 'cutoutBinding'),
    'cutoutBinding'
  );
}

function certificateCutoutCommitment(cutoutBindingLike) {
  return crypto
    .createHash('sha256')
    .update(CERT_CUTOUT_COMMITMENT_DOMAIN)
    .update(Buffer.from([0]))
    .update(stableStringify(certificateCutoutPayload(cutoutBindingLike)))
    .digest('hex');
}

function signedCombineCommitmentFrom(input) {
  const hasEnvelope = input.signedMatrixCombine !== undefined;
  const hasCommitment = input.signedMatrixCombineCommitment !== undefined;
  if (!hasEnvelope && !hasCommitment) {
    throw new TypeError('signedMatrixCombine or signedMatrixCombineCommitment is required');
  }

  const envelopeCommitment = hasEnvelope
    ? assertSha256Hex(
      input.signedMatrixCombine.signedMatrixCombineCommitment,
      'signedMatrixCombine.signedMatrixCombineCommitment'
    )
    : undefined;
  const explicitCommitment = hasCommitment
    ? assertSha256Hex(
      input.signedMatrixCombineCommitment,
      'signedMatrixCombineCommitment'
    )
    : undefined;

  if (
    envelopeCommitment !== undefined
    && explicitCommitment !== undefined
    && envelopeCommitment !== explicitCommitment
  ) {
    throw new RangeError('signedMatrixCombineCommitment does not match signedMatrixCombine envelope');
  }

  return explicitCommitment === undefined ? envelopeCommitment : explicitCommitment;
}

function certificatePayloadObject(input) {
  assertObject(input, 'certificate');
  if (input.format !== undefined && input.format !== CERT_FORMAT) {
    throw new TypeError('certificate format is not UN-CERT');
  }
  if (input.version !== undefined && input.version !== CERT_VERSION) {
    throw new TypeError('certificate version is not supported');
  }

  const publicTiles = normalizePublicTiles(input);
  const privateSlots = normalizePrivateSlots(input);
  assertUniqueCertificateNames(publicTiles, privateSlots);

  assertOwnField(input, 'expectedOutputMatrixCommitment');
  const signedMatrixCombineCommitment = signedCombineCommitmentFrom(input);
  const expectedOutputMatrixCommitment = assertSha256Hex(
    input.expectedOutputMatrixCommitment,
    'expectedOutputMatrixCommitment'
  );
  const payload = {
    format: CERT_FORMAT,
    version: CERT_VERSION,
    publicTiles,
    privateSlots,
    signedMatrixCombineCommitment,
    expectedOutputMatrixCommitment,
    targetCommitments: normalizeTargetCommitments(input.targetCommitments),
    metadata: cloneCanonicalValue(input.metadata === undefined ? {} : input.metadata, 'metadata'),
    context: cloneCanonicalValue(input.context === undefined ? {} : input.context, 'context'),
  };
  const cutouts = normalizeCutoutBindings(input.cutouts);
  if (cutouts.length > 0) {
    payload.cutouts = cutouts;
  }

  if (input.signedMatrixCombine !== undefined) {
    payload.signedMatrixCombine = cloneCanonicalValue(input.signedMatrixCombine, 'signedMatrixCombine');
  }

  return payload;
}

function certificatePayload(certificateLike) {
  return cloneCanonicalValue(certificatePayloadObject(certificateLike), 'certificate');
}

function certificateCommitment(certificateLike) {
  return crypto
    .createHash('sha256')
    .update(CERT_COMMITMENT_DOMAIN)
    .update(Buffer.from([0]))
    .update(stableStringify(certificatePayloadObject(certificateLike)))
    .digest('hex');
}

function normalizeCertificate(input) {
  const payload = certificatePayloadObject(input);
  const commitment = certificateCommitment(payload);
  if (
    Object.hasOwn(input, 'certificateCommitment')
    && input.certificateCommitment !== commitment
  ) {
    throw new RangeError('certificateCommitment mismatch');
  }

  return {
    ...cloneCanonicalValue(payload, 'certificate'),
    certificateCommitment: commitment,
  };
}

function createCertificate(input) {
  return normalizeCertificate(input);
}

function invalid(reason, fields = {}) {
  return {
    ...cloneCanonicalValue(fields, 'fields'),
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
    ...cloneCanonicalValue(fields, 'fields'),
  };
}

function publicTileMaterialMap(certificate, suppliedPublicTiles) {
  const material = {};
  const supplied = suppliedPublicTiles === undefined ? {} : suppliedPublicTiles;

  for (const tile of certificate.publicTiles) {
    if (tile.matrix !== undefined) {
      material[tile.name] = tile.matrix;
    } else if (Object.hasOwn(supplied, tile.name)) {
      material[tile.name] = supplied[tile.name];
    }
  }

  return material;
}

function normalizeSuppliedPrivateTiles(privateTiles) {
  if (privateTiles === undefined) {
    return {};
  }
  if (Array.isArray(privateTiles)) {
    const mapped = {};
    for (let index = 0; index < privateTiles.length; index += 1) {
      const { name, tileLike } = namedTileLikeFromArrayEntry(privateTiles[index], 'privateTiles', index);
      if (Object.hasOwn(mapped, name)) {
        throw new RangeError(`duplicate tile/slot name: ${name}`);
      }
      mapped[name] = tileLike;
    }
    return mapped;
  }

  assertObject(privateTiles, 'privateTiles');
  return privateTiles;
}

function completionTileMaterial(certificate, privateTiles, publicTiles) {
  const material = publicTileMaterialMap(certificate, publicTiles);

  for (const tile of certificate.publicTiles) {
    if (!Object.hasOwn(material, tile.name)) {
      throw new TypeError(`public tile material is required for ${tile.name}`);
    }
    const key = createMatrixKey(material[tile.name]);
    if (key.matrixCommitment !== tile.matrixCommitment) {
      throw new RangeError(`public tile commitment mismatch for ${tile.name}`);
    }
    material[tile.name] = key;
  }

  const suppliedPrivateTiles = normalizeSuppliedPrivateTiles(privateTiles);
  for (const slot of certificate.privateSlots) {
    if (!Object.hasOwn(suppliedPrivateTiles, slot.name)) {
      throw new TypeError(`private tile is required for ${slot.name}`);
    }

    const key = createMatrixKey(suppliedPrivateTiles[slot.name]);
    if (key.matrixCommitment !== slot.matrixCommitment) {
      throw new RangeError(`private tile commitment mismatch for ${slot.name}`);
    }
    material[slot.name] = key;
  }

  return material;
}

function structureFields(certificate) {
  return {
    certificateCommitment: certificate.certificateCommitment,
    signedMatrixCombineCommitment: certificate.signedMatrixCombineCommitment,
    expectedOutputMatrixCommitment: certificate.expectedOutputMatrixCommitment,
  };
}

function cutoutLabelForResult(binding, index) {
  return binding.label === null ? `#${index}` : binding.label;
}

function isCutoutMaterial(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (
      Object.hasOwn(value, 'plan')
      || Object.hasOwn(value, 'cutoutPlan')
      || Object.hasOwn(value, 'publicPayload')
      || Object.hasOwn(value, 'hiddenSpans')
      || Object.hasOwn(value, 'cutoutPlanCommitment')
      || Object.hasOwn(value, 'spans')
    );
}

function suppliedCutoutMaterialFor(binding, index, suppliedCutouts, cutoutCount) {
  if (suppliedCutouts === undefined) {
    return undefined;
  }
  if (Array.isArray(suppliedCutouts)) {
    if (suppliedCutouts[index] !== undefined) {
      return suppliedCutouts[index];
    }
    if (binding.label !== null) {
      return suppliedCutouts.find((entry) => (
        entry !== null
        && typeof entry === 'object'
        && !Array.isArray(entry)
        && entry.label === binding.label
      ));
    }
    return undefined;
  }
  if (suppliedCutouts !== null && typeof suppliedCutouts === 'object') {
    if (cutoutCount === 1 && isCutoutMaterial(suppliedCutouts)) {
      return suppliedCutouts;
    }
    if (binding.label !== null && Object.hasOwn(suppliedCutouts, binding.label)) {
      return suppliedCutouts[binding.label];
    }
  }

  return undefined;
}

function cutoutResult(label, fields) {
  return cloneCanonicalValue({
    label,
    ...fields,
  }, 'cutoutResult');
}

function verifyCutoutAgainstBinding(binding, index, suppliedCutouts, cutoutCount) {
  const label = cutoutLabelForResult(binding, index);
  const material = suppliedCutoutMaterialFor(binding, index, suppliedCutouts, cutoutCount);
  if (material === undefined) {
    return cutoutResult(label, {
      ok: false,
      valid: false,
      mode: 'completion',
      reason: 'cutout material is required',
      cutoutPlanCommitment: binding.cutoutPlanCommitment,
      originalPayloadCommitment: binding.originalPayloadCommitment,
      publicPayloadCommitment: binding.publicPayloadCommitment,
    });
  }

  const verification = verifyCutout(material);
  if (!verification.ok) {
    return cutoutResult(label, {
      ok: false,
      valid: false,
      mode: 'completion',
      reason: verification.reason,
      cutoutPlanCommitment: binding.cutoutPlanCommitment,
      originalPayloadCommitment: binding.originalPayloadCommitment,
      publicPayloadCommitment: binding.publicPayloadCommitment,
    });
  }

  const suppliedSpanCommitments = verification.spanVerification.map((span) => span.spanCommitment);
  let reason = null;
  if (verification.cutoutPlanCommitment !== binding.cutoutPlanCommitment) {
    reason = 'cutout plan commitment mismatch';
  } else if (verification.originalPayloadCommitment !== binding.originalPayloadCommitment) {
    reason = 'cutout originalPayloadCommitment mismatch';
  } else if (verification.publicPayloadCommitment !== binding.publicPayloadCommitment) {
    reason = 'cutout publicPayloadCommitment mismatch';
  } else if (
    suppliedSpanCommitments.length !== binding.spanCommitments.length
    || suppliedSpanCommitments.some((commitment, spanIndex) => (
      commitment !== binding.spanCommitments[spanIndex]
    ))
  ) {
    reason = 'cutout spanCommitments mismatch';
  } else if (verification.spanVerification.some((span) => !span.ok)) {
    reason = 'cutout hidden span verification incomplete';
  }

  if (reason !== null) {
    return cutoutResult(label, {
      ok: false,
      valid: false,
      mode: 'completion',
      reason,
      cutoutPlanCommitment: binding.cutoutPlanCommitment,
      suppliedCutoutPlanCommitment: verification.cutoutPlanCommitment,
      originalPayloadCommitment: binding.originalPayloadCommitment,
      suppliedOriginalPayloadCommitment: verification.originalPayloadCommitment,
      publicPayloadCommitment: binding.publicPayloadCommitment,
      suppliedPublicPayloadCommitment: verification.publicPayloadCommitment,
      spanCommitments: binding.spanCommitments,
      suppliedSpanCommitments,
    });
  }

  return cutoutResult(label, {
    ok: true,
    valid: true,
    mode: 'completion',
    cutoutPlanCommitment: binding.cutoutPlanCommitment,
    originalPayloadCommitment: binding.originalPayloadCommitment,
    publicPayloadCommitment: binding.publicPayloadCommitment,
    spanCommitments: binding.spanCommitments,
    verification,
  });
}

function verifyCertificateCutouts(input, suppliedCutouts) {
  let certificate;
  try {
    certificate = normalizeCertificate(input);
  } catch (error) {
    return invalid(error.message);
  }

  const bindings = certificate.cutouts === undefined ? [] : certificate.cutouts;
  const wantsCompletion = suppliedCutouts !== undefined;
  const cutoutResults = [];

  if (!wantsCompletion) {
    for (let index = 0; index < bindings.length; index += 1) {
      const binding = bindings[index];
      cutoutResults.push(cutoutResult(cutoutLabelForResult(binding, index), {
        ok: true,
        valid: true,
        mode: 'structure',
        cutoutPlanCommitment: binding.cutoutPlanCommitment,
        originalPayloadCommitment: binding.originalPayloadCommitment,
        publicPayloadCommitment: binding.publicPayloadCommitment,
        spanCommitments: binding.spanCommitments,
      }));
    }

    return validResult({
      ...structureFields(certificate),
      cutoutsOk: true,
      cutoutMode: 'structure',
      cutoutResults,
      failedCutoutLabels: [],
      certificate,
    });
  }

  for (let index = 0; index < bindings.length; index += 1) {
    cutoutResults.push(verifyCutoutAgainstBinding(
      bindings[index],
      index,
      suppliedCutouts,
      bindings.length
    ));
  }

  const failedCutoutLabels = cutoutResults
    .filter((result) => !result.ok)
    .map((result) => result.label);

  const fields = {
    ...structureFields(certificate),
    cutoutsOk: failedCutoutLabels.length === 0,
    cutoutMode: 'completion',
    cutoutResults,
    failedCutoutLabels,
    certificate,
  };

  if (failedCutoutLabels.length > 0) {
    return invalid('cutout verification failed', fields);
  }

  return validResult(fields);
}

function cutoutVerificationFields(cutoutVerification) {
  return {
    cutoutsOk: cutoutVerification.cutoutsOk,
    cutoutMode: cutoutVerification.cutoutMode,
    cutoutResults: cloneCanonicalValue(cutoutVerification.cutoutResults, 'cutoutResults'),
    failedCutoutLabels: cloneCanonicalValue(
      cutoutVerification.failedCutoutLabels,
      'failedCutoutLabels'
    ),
  };
}

function verifyCertificate(input, options = {}) {
  let certificate;
  try {
    certificate = normalizeCertificate(input);
  } catch (error) {
    return invalid(error.message);
  }

  const fields = structureFields(certificate);
  if (certificate.signedMatrixCombine !== undefined) {
    const signed = verifySignedMatrixCombine(certificate.signedMatrixCombine, options);
    if (!signed.ok) {
      return invalid(signed.reason, fields);
    }
    if (signed.signedMatrixCombineCommitment !== certificate.signedMatrixCombineCommitment) {
      return invalid('signedMatrixCombineCommitment mismatch', fields);
    }
    if (
      signed.outputMatrixCommitment !== null
      && signed.outputMatrixCommitment !== certificate.expectedOutputMatrixCommitment
    ) {
      return invalid('expectedOutputMatrixCommitment does not match signed combine output', fields);
    }
  }

  const cutoutVerification = verifyCertificateCutouts(certificate, options.cutouts);
  const cutoutFields = cutoutVerification.ok
    ? cutoutVerificationFields(cutoutVerification)
    : {
      cutoutsOk: false,
      cutoutMode: cutoutVerification.cutoutMode,
      cutoutResults: cutoutVerification.cutoutResults || [],
      failedCutoutLabels: cutoutVerification.failedCutoutLabels || [],
    };
  if (!cutoutVerification.ok) {
    return invalid(cutoutVerification.reason, {
      ...fields,
      ...cutoutFields,
    });
  }

  const wantsCompletion = options.mode === 'completion' || options.privateTiles !== undefined;
  if (!wantsCompletion) {
    return validResult({
      ...fields,
      ...cutoutFields,
      mode: 'structure',
      certificate,
    });
  }

  const combined = applyCertificateCombine(certificate, options.privateTiles, options);
  if (!combined.ok) {
    return combined;
  }

  return {
    ...combined,
    ...cutoutFields,
  };
}

function applyCertificateCombine(input, privateTiles = {}, options = {}) {
  let certificate;
  try {
    certificate = normalizeCertificate(input);
  } catch (error) {
    return invalid(error.message);
  }

  const fields = structureFields(certificate);
  if (certificate.signedMatrixCombine === undefined) {
    return invalid('signedMatrixCombine envelope is required for completion verification', fields);
  }

  const signed = verifySignedMatrixCombine(certificate.signedMatrixCombine, options);
  if (!signed.ok) {
    return invalid(signed.reason, fields);
  }
  if (signed.signedMatrixCombineCommitment !== certificate.signedMatrixCombineCommitment) {
    return invalid('signedMatrixCombineCommitment mismatch', fields);
  }
  if (
    signed.outputMatrixCommitment !== null
    && signed.outputMatrixCommitment !== certificate.expectedOutputMatrixCommitment
  ) {
    return invalid('expectedOutputMatrixCommitment does not match signed combine output', fields);
  }

  try {
    const tiles = completionTileMaterial(certificate, privateTiles, options.publicTiles);
    const result = applySignedMatrixCombine(tiles, certificate.signedMatrixCombine, options);
    if (!result.ok) {
      return invalid(result.reason, fields);
    }
    const outputMatrixCommitment = result.matrix.matrixCommitment;
    if (outputMatrixCommitment !== certificate.expectedOutputMatrixCommitment) {
      return invalid('output matrix commitment mismatch', {
        ...fields,
        outputMatrixCommitment,
      });
    }

    return validResult({
      ...fields,
      outputMatrixCommitment,
      mode: 'completion',
      signedVerification: signed,
      application: result.application,
      matrix: cloneCanonicalValue(result.matrix, 'matrix'),
      certificate,
    });
  } catch (error) {
    return invalid(error.message, fields);
  }
}

function applyCertificateCutout(input, label, cutoutMaterial, options = {}) {
  let certificate;
  try {
    certificate = normalizeCertificate(input);
  } catch (error) {
    return invalid(error.message);
  }

  const bindings = certificate.cutouts === undefined ? [] : certificate.cutouts;
  const bindingIndex = bindings.findIndex((binding) => binding.label === label);
  if (bindingIndex === -1) {
    return invalid('cutout binding not found', {
      ...structureFields(certificate),
      cutoutsOk: false,
      failedCutoutLabels: [label],
    });
  }

  const bindingResult = verifyCutoutAgainstBinding(
    bindings[bindingIndex],
    bindingIndex,
    cutoutMaterial,
    1
  );
  if (!bindingResult.ok) {
    return invalid(bindingResult.reason, {
      ...structureFields(certificate),
      cutoutsOk: false,
      cutoutMode: 'completion',
      cutoutResults: [bindingResult],
      failedCutoutLabels: [label],
    });
  }

  const restore = options.restore === undefined ? true : options.restore;
  const cutoutResults = [bindingResult];
  const fields = {
    ...structureFields(certificate),
    cutoutsOk: true,
    cutoutMode: 'completion',
    cutoutResults,
    failedCutoutLabels: [],
    label,
    certificate,
  };

  if (!restore) {
    return {
      ok: true,
      valid: true,
      ...cloneCanonicalValue(fields, 'fields'),
    };
  }

  const restored = restoreCutout(cutoutMaterial);
  if (!restored.ok) {
    return invalid(restored.reason, fields);
  }
  if (restored.reconstructedPayloadCommitment !== bindings[bindingIndex].originalPayloadCommitment) {
    return invalid('restored payload commitment mismatch', fields);
  }

  return {
    ok: true,
    valid: true,
    ...cloneCanonicalValue(fields, 'fields'),
    reconstructedPayloadCommitment: restored.reconstructedPayloadCommitment,
    restoredPayload: Buffer.from(restored.restoredPayload),
    payload: Buffer.from(restored.payload),
  };
}

module.exports = {
  CERT_FORMAT,
  CERT_VERSION,
  normalizeCertificate,
  certificatePayload,
  certificateCommitment,
  certificateCutoutPayload,
  certificateCutoutCommitment,
  createCertificate,
  verifyCertificate,
  verifyCertificateCutouts,
  applyCertificateCombine,
  applyCertificateCutout,
};
