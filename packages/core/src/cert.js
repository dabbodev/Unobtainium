'use strict';

const crypto = require('node:crypto');

const {
  createMatrixKey,
} = require('./matrix');
const {
  applySignedMatrixCombine,
  verifySignedMatrixCombine,
} = require('./signed-matrix-combine');
const { stableStringify } = require('./stack-canonical');

const CERT_FORMAT = 'UN-CERT';
const CERT_VERSION = 1;
const CERT_COMMITMENT_DOMAIN = 'UN-CERT:v1';
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

  const wantsCompletion = options.mode === 'completion' || options.privateTiles !== undefined;
  if (!wantsCompletion) {
    return validResult({
      ...fields,
      mode: 'structure',
      certificate,
    });
  }

  return applyCertificateCombine(certificate, options.privateTiles, options);
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

module.exports = {
  CERT_FORMAT,
  CERT_VERSION,
  normalizeCertificate,
  certificatePayload,
  certificateCommitment,
  createCertificate,
  verifyCertificate,
  applyCertificateCombine,
};
