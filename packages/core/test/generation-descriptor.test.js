'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  applyResidual,
  createGenerationDescriptor,
  createKeyfileDescriptor,
  createSignedStackEnvelope,
  deriveKeyMeshFromString,
  generateEd25519KeyPair,
  generateFromStack,
  generationDescriptorCommitment,
  generationDescriptorPayload,
  residualBetween,
  stackCommitment,
  verifyGenerationDescriptor,
} = require('..');

function baseMesh() {
  return [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 0],
    [0, 1, 1],
  ];
}

function state() {
  return { point: 0, shift: 1, gap: 1 };
}

function rotateLayer(mesh = baseMesh(), overrides = {}) {
  return {
    id: 'descriptor-rotate',
    type: 'UN-ROTATE',
    mesh,
    graftMode: 'none',
    stateMode: 'explicit',
    state: state(),
    direction: 'up',
    turns: 2,
    minShift: 1,
    walkMode: 'permissive',
    ...overrides,
  };
}

function swapLayer(mesh = baseMesh(), overrides = {}) {
  return {
    id: 'descriptor-swap',
    type: 'UN-SWAP',
    mesh,
    graftMode: 'none',
    stateMode: 'explicit',
    state: state(),
    swapCount: 4,
    minShift: 1,
    walkMode: 'permissive',
    ...overrides,
  };
}

function stack(overrides = {}) {
  return {
    format: 'UNSTACK',
    version: 1,
    windowSize: 256,
    metadata: { sprint: 15 },
    layers: [rotateLayer()],
    ...overrides,
  };
}

function mixedStack(mesh = baseMesh(), overrides = {}) {
  return stack({
    layers: [
      rotateLayer(mesh, { id: 'rotate-a', turns: 1 }),
      swapLayer(mesh, { id: 'swap-b', swapCount: 5 }),
    ],
    ...overrides,
  });
}

function signedEnvelope(recipe = stack(), metadata = { signed: true }) {
  const keys = generateEd25519KeyPair();
  return createSignedStackEnvelope({
    stack: recipe,
    signerId: 'owner:generation-descriptor',
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
    purpose: 'owner-signed-stack',
    metadata,
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mutateHex(value) {
  return `${value[0] === '0' ? '1' : '0'}${value.slice(1)}`;
}

function generatedFor(descriptor, recipe) {
  return generateFromStack({
    length: descriptor.length,
    stack: recipe,
    windowSize: descriptor.windowSize,
    type: descriptor.type,
    fill: descriptor.fill,
  });
}

test('can create descriptor from unsigned stack', () => {
  const recipe = stack();
  const descriptor = createGenerationDescriptor({
    length: 16,
    stack: recipe,
    metadata: { b: 2, a: 1 },
  });

  assert.equal(descriptor.format, 'UN-GEN-DESCRIPTOR');
  assert.equal(descriptor.version, 1);
  assert.equal(descriptor.length, 16);
  assert.equal(descriptor.windowSize, 256);
  assert.equal(descriptor.type, 'array');
  assert.equal(descriptor.fill, 0);
  assert.equal(descriptor.stackCommitment, stackCommitment(recipe));
  assert.equal(descriptor.signedStackPayloadCommitment, null);
  assert.match(descriptor.generatedCommitment, /^[0-9a-f]{64}$/);
  assert.equal(descriptor.targetCommitment, null);
  assert.equal(descriptor.residualCommitment, null);
  assert.match(descriptor.descriptorCommitment, /^[0-9a-f]{64}$/);
  assert.deepEqual(descriptor.metadata, { a: 1, b: 2 });
});

test('can create descriptor from signed stack envelope', () => {
  const recipe = stack();
  const signed = signedEnvelope(recipe);
  const descriptor = createGenerationDescriptor({
    length: 16,
    signedStackEnvelope: signed,
  });

  assert.equal(descriptor.stackCommitment, signed.stackCommitment);
  assert.equal(descriptor.signedStackPayloadCommitment, signed.payloadCommitment);
});

test('descriptor verifies structurally', () => {
  const descriptor = createGenerationDescriptor({
    length: 8,
    stack: stack(),
  });
  const result = verifyGenerationDescriptor(descriptor);

  assert.equal(result.valid, true);
  assert.equal(result.descriptorCommitment, descriptor.descriptorCommitment);
  assert.equal(result.generatedCommitment, descriptor.generatedCommitment);
});

test('descriptor verifies with unsigned stack', () => {
  const recipe = stack();
  const descriptor = createGenerationDescriptor({
    length: 8,
    stack: recipe,
  });

  assert.equal(verifyGenerationDescriptor(descriptor, { stack: recipe }).valid, true);
});

test('descriptor verifies with signed stack envelope', () => {
  const recipe = stack();
  const signed = signedEnvelope(recipe);
  const descriptor = createGenerationDescriptor({
    length: 8,
    signedStackEnvelope: signed,
  });

  assert.equal(verifyGenerationDescriptor(descriptor, { signedStackEnvelope: signed }).valid, true);
});

test('descriptor verifies with supplied generated data', () => {
  const recipe = stack();
  const descriptor = createGenerationDescriptor({
    length: 8,
    stack: recipe,
    type: 'buffer',
  });
  const generated = generatedFor(descriptor, recipe);

  assert.equal(Buffer.isBuffer(generated), true);
  assert.equal(verifyGenerationDescriptor(descriptor, { generated }).valid, true);
});

test('descriptor with target computes residual automatically', () => {
  const recipe = stack();
  const target = [3, 1, 4, 1, 5, 9, 2, 6];
  const automatic = createGenerationDescriptor({
    length: target.length,
    stack: recipe,
    target,
  });
  const generated = generatedFor(automatic, recipe);
  const residual = residualBetween({
    target,
    generated,
    windowSize: automatic.windowSize,
  });
  const explicit = createGenerationDescriptor({
    length: target.length,
    stack: recipe,
    target,
    residual,
  });

  assert.equal(automatic.targetCommitment, explicit.targetCommitment);
  assert.equal(automatic.residualCommitment, explicit.residualCommitment);
});

test('descriptor with target and residual verifies reconstruction', () => {
  const recipe = stack();
  const target = [8, 6, 7, 5, 3, 0, 9, 9];
  const generated = generateFromStack({ length: target.length, stack: recipe });
  const residual = residualBetween({ target, generated });
  const descriptor = createGenerationDescriptor({
    length: target.length,
    stack: recipe,
    target,
    residual,
  });

  assert.equal(verifyGenerationDescriptor(descriptor, {
    stack: recipe,
    target,
    generated,
    residual,
  }).valid, true);
});

test('descriptor with residual but no target is supported', () => {
  const recipe = stack();
  const residual = [1, 1, 2, 3, 5, 8, 13, 21];
  const descriptor = createGenerationDescriptor({
    length: residual.length,
    stack: recipe,
    residual,
  });

  assert.equal(descriptor.targetCommitment, null);
  assert.match(descriptor.residualCommitment, /^[0-9a-f]{64}$/);
  assert.equal(verifyGenerationDescriptor(descriptor, { stack: recipe, residual }).valid, true);
});

test('descriptor with neither target nor residual is supported', () => {
  const recipe = stack();
  const descriptor = createGenerationDescriptor({
    length: 8,
    stack: recipe,
  });

  assert.equal(descriptor.targetCommitment, null);
  assert.equal(descriptor.residualCommitment, null);
  assert.equal(verifyGenerationDescriptor(descriptor, { stack: recipe }).valid, true);
});

test('generationDescriptorCommitment is deterministic', () => {
  const descriptor = createGenerationDescriptor({
    length: 8,
    stack: stack(),
  });

  assert.equal(
    generationDescriptorCommitment(descriptor),
    generationDescriptorCommitment(clone(descriptor)),
  );
  assert.equal(generationDescriptorCommitment(descriptor), descriptor.descriptorCommitment);
});

test('generationDescriptorPayload excludes descriptorCommitment', () => {
  const descriptor = createGenerationDescriptor({
    length: 8,
    stack: stack(),
  });
  const payload = generationDescriptorPayload(descriptor);

  assert.equal(Object.hasOwn(payload, 'descriptorCommitment'), false);
  assert.deepEqual(payload, {
    format: 'UN-GEN-DESCRIPTOR',
    version: 1,
    length: 8,
    windowSize: 256,
    type: 'array',
    fill: 0,
    stackCommitment: descriptor.stackCommitment,
    signedStackPayloadCommitment: null,
    generatedCommitment: descriptor.generatedCommitment,
    targetCommitment: null,
    residualCommitment: null,
    metadata: {},
  });
});

test('tampering committed descriptor fields invalidates descriptor', () => {
  const signed = signedEnvelope(stack());
  const target = [1, 2, 3, 4, 5, 6, 7, 8];
  const descriptor = createGenerationDescriptor({
    length: target.length,
    signedStackEnvelope: signed,
    target,
    metadata: { nested: { value: 1 } },
  });
  const tamperCases = [
    ['length', (draft) => { draft.length += 1; }],
    ['windowSize', (draft) => { draft.windowSize = 128; }],
    ['type', (draft) => { draft.type = 'buffer'; }],
    ['fill', (draft) => { draft.fill = 1; }],
    ['stackCommitment', (draft) => { draft.stackCommitment = mutateHex(draft.stackCommitment); }],
    ['signedStackPayloadCommitment', (draft) => {
      draft.signedStackPayloadCommitment = mutateHex(draft.signedStackPayloadCommitment);
    }],
    ['generatedCommitment', (draft) => {
      draft.generatedCommitment = mutateHex(draft.generatedCommitment);
    }],
    ['targetCommitment', (draft) => { draft.targetCommitment = mutateHex(draft.targetCommitment); }],
    ['residualCommitment', (draft) => {
      draft.residualCommitment = mutateHex(draft.residualCommitment);
    }],
    ['metadata', (draft) => { draft.metadata.nested.value = 2; }],
  ];

  for (const [fieldName, mutate] of tamperCases) {
    const tampered = clone(descriptor);
    mutate(tampered);

    assert.equal(
      verifyGenerationDescriptor(tampered).valid,
      false,
      `${fieldName} tamper should fail verification`,
    );
  }
});

test('wrong stack fails verification', () => {
  const descriptor = createGenerationDescriptor({
    length: 8,
    stack: stack(),
  });
  const wrongStack = stack({
    layers: [rotateLayer(baseMesh(), { turns: 3 })],
  });

  assert.equal(verifyGenerationDescriptor(descriptor, { stack: wrongStack }).valid, false);
});

test('wrong signed stack envelope fails verification', () => {
  const descriptor = createGenerationDescriptor({
    length: 8,
    signedStackEnvelope: signedEnvelope(stack()),
  });
  const wrongEnvelope = signedEnvelope(stack({
    layers: [rotateLayer(baseMesh(), { turns: 3 })],
  }));

  assert.equal(
    verifyGenerationDescriptor(descriptor, { signedStackEnvelope: wrongEnvelope }).valid,
    false,
  );
});

test('wrong generated data fails verification', () => {
  const recipe = stack();
  const descriptor = createGenerationDescriptor({
    length: 8,
    stack: recipe,
  });
  const generated = generatedFor(descriptor, recipe);
  generated[0] = (generated[0] + 1) % descriptor.windowSize;

  assert.equal(verifyGenerationDescriptor(descriptor, { generated }).valid, false);
});

test('wrong target fails verification', () => {
  const recipe = stack();
  const target = [1, 2, 3, 4, 5, 6, 7, 8];
  const descriptor = createGenerationDescriptor({
    length: target.length,
    stack: recipe,
    target,
  });
  const wrongTarget = target.slice();
  wrongTarget[0] += 1;

  assert.equal(verifyGenerationDescriptor(descriptor, { target: wrongTarget }).valid, false);
});

test('wrong residual fails verification', () => {
  const recipe = stack();
  const target = [1, 2, 3, 4, 5, 6, 7, 8];
  const generated = generateFromStack({ length: target.length, stack: recipe });
  const residual = residualBetween({ target, generated });
  const descriptor = createGenerationDescriptor({
    length: target.length,
    stack: recipe,
    target,
    residual,
  });
  const wrongResidual = residual.slice();
  wrongResidual[0] += 1;

  assert.equal(verifyGenerationDescriptor(descriptor, { residual: wrongResidual }).valid, false);
});

test('equivalent metadata key order is stable', () => {
  const recipe = stack();
  const first = createGenerationDescriptor({
    length: 8,
    stack: recipe,
    metadata: { b: 2, a: 1 },
  });
  const second = createGenerationDescriptor({
    length: 8,
    stack: recipe,
    metadata: { a: 1, b: 2 },
  });

  assert.equal(first.descriptorCommitment, second.descriptorCommitment);
});

test('create and verify do not mutate stack, envelope, target, residual, or metadata', () => {
  const recipe = stack();
  const signed = signedEnvelope(recipe, { z: 1, a: { b: 2 } });
  const target = [3, 1, 4, 1, 5, 9, 2, 6];
  const generated = generateFromStack({ length: target.length, stack: recipe });
  const residual = residualBetween({ target, generated });
  const metadata = { z: 1, a: { b: 2 } };
  const before = {
    recipe: clone(recipe),
    signed: clone(signed),
    target: target.slice(),
    residual: residual.slice(),
    metadata: clone(metadata),
  };

  const descriptor = createGenerationDescriptor({
    length: target.length,
    stack: recipe,
    signedStackEnvelope: signed,
    target,
    residual,
    metadata,
  });
  verifyGenerationDescriptor(descriptor, {
    stack: recipe,
    signedStackEnvelope: signed,
    target,
    residual,
  });

  assert.deepEqual(recipe, before.recipe);
  assert.deepEqual(signed, before.signed);
  assert.deepEqual(target, before.target);
  assert.deepEqual(residual, before.residual);
  assert.deepEqual(metadata, before.metadata);
});

test('invalid length, window, type, and fill throw on create', () => {
  const recipe = stack();

  assert.throws(() => createGenerationDescriptor({ length: -1, stack: recipe }), /length/);
  assert.throws(() => createGenerationDescriptor({ length: 1.5, stack: recipe }), /length/);
  assert.throws(() => createGenerationDescriptor({
    length: 1,
    stack: recipe,
    windowSize: 1,
  }), /windowSize/);
  assert.throws(() => createGenerationDescriptor({
    length: 1,
    stack: recipe,
    type: 'string',
  }), /type/);
  assert.throws(() => createGenerationDescriptor({
    length: 1,
    stack: recipe,
    fill: 1.5,
  }), /fill/);
  assert.throws(() => createGenerationDescriptor({
    length: 1,
    stack: stack({ windowSize: 512 }),
    windowSize: 512,
    type: 'buffer',
    fill: 300,
  }), /fill|byte/);
});

test('malformed descriptors return invalid from verify and throw from payload', () => {
  assert.equal(verifyGenerationDescriptor(null).valid, false);
  assert.throws(() => generationDescriptorPayload(null), /descriptor/);

  const descriptor = createGenerationDescriptor({
    length: 8,
    stack: stack(),
  });
  const missingMetadata = clone(descriptor);
  delete missingMetadata.metadata;

  assert.equal(verifyGenerationDescriptor(missingMetadata).valid, false);
  assert.throws(() => generationDescriptorPayload(missingMetadata), /metadata/);
});

test('conflicting explicit stack and signed envelope stack fails consistently', () => {
  const signed = signedEnvelope(stack());
  const conflictingStack = stack({
    layers: [rotateLayer(baseMesh(), { turns: 9 })],
  });

  assert.throws(() => createGenerationDescriptor({
    length: 8,
    stack: conflictingStack,
    signedStackEnvelope: signed,
  }), /match/);
});

test('works with a mixed UN-ROTATE and UN-SWAP stack', () => {
  const recipe = mixedStack();
  const descriptor = createGenerationDescriptor({
    length: 8,
    stack: recipe,
    fill: 7,
  });

  assert.equal(verifyGenerationDescriptor(descriptor, { stack: recipe }).valid, true);
});

test('works with a keyfile-derived mesh stack', () => {
  const keyfile = createKeyfileDescriptor('descriptor key mesh', { pointCount: 8 });
  const recipe = stack({
    metadata: { keyMeshCommitment: keyfile.meshCommitment },
    layers: [rotateLayer(keyfile.points, { turns: 1 })],
  });
  const descriptor = createGenerationDescriptor({
    length: 8,
    stack: recipe,
  });

  assert.equal(verifyGenerationDescriptor(descriptor, { stack: recipe }).valid, true);
});

test('integration: signed keyfile mixed stack descriptor reconstructs target', () => {
  const mesh = deriveKeyMeshFromString('sprint 15 descriptor integration', { pointCount: 8 });
  const recipe = mixedStack(mesh, {
    metadata: { source: 'keyfile-derived' },
  });
  const signed = signedEnvelope(recipe, { integration: true });
  const target = [2, 7, 1, 8, 2, 8, 1, 8];
  const descriptor = createGenerationDescriptor({
    length: target.length,
    signedStackEnvelope: signed,
    target,
    metadata: { scenario: 'signed-keyfile-mixed-stack' },
  });
  const verifyResult = verifyGenerationDescriptor(descriptor, {
    signedStackEnvelope: signed,
    target,
  });
  const generated = generatedFor(descriptor, signed.stack);
  const residual = residualBetween({ target, generated });
  const reconstructed = applyResidual({ generated, residual });
  const tamperedStack = clone(signed.stack);
  tamperedStack.layers.reverse();

  assert.equal(verifyResult.valid, true);
  assert.deepEqual(reconstructed, target);
  assert.equal(verifyGenerationDescriptor(descriptor, { stack: tamperedStack }).valid, false);
});
