'use strict';

const { generateInstructionStream } = require('./instruction-stream');
const {
  applyRotateTransform,
  reverseRotateTransform,
} = require('./rotate-transform');
const { applyPacketGraft } = require('./packet-graft');
const { deriveAnchoredStateFromPacket } = require('./point-packet');

const STACK_FORMAT = 'UNSTACK';
const STACK_VERSION = 1;
const LAYER_TYPE_ROTATE = 'UN-ROTATE';
const GRAFT_MODES = new Set(['append', 'prepend', 'sandwich', 'none']);
const WALK_MODES = new Set(['permissive', 'distinct']);
const STATE_MODES = new Set(['explicit', 'anchored']);

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneValue(value, seen = new Set()) {
  if (value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new TypeError('stack must not contain circular references');
    }
    seen.add(value);
    const cloned = value.map((entry) => cloneValue(entry, seen));
    seen.delete(value);
    return cloned;
  }

  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'boolean') {
    return value;
  }
  if (valueType === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('stack numbers must be finite');
    }
    return value;
  }
  if (valueType === 'object') {
    if (!isPlainObject(value)) {
      throw new TypeError('stack values must be plain objects, arrays, or scalars');
    }
    if (seen.has(value)) {
      throw new TypeError('stack must not contain circular references');
    }

    seen.add(value);
    const cloned = {};
    for (const key of Object.keys(value)) {
      const entry = value[key];
      const entryType = typeof entry;
      if (entry === undefined || entryType === 'function' || entryType === 'symbol') {
        throw new TypeError('stack values must not contain unsupported fields');
      }
      cloned[key] = cloneValue(entry, seen);
    }
    seen.delete(value);
    return cloned;
  }

  throw new TypeError('stack values must not contain unsupported fields');
}

function assertWindowSize(windowSize) {
  if (!Number.isInteger(windowSize)) {
    throw new TypeError('windowSize must be an integer');
  }
  if (windowSize <= 1) {
    throw new RangeError('windowSize must be greater than 1');
  }
}

function assertDirection(direction) {
  if (direction !== 'up' && direction !== 'down') {
    throw new RangeError('direction must be "up" or "down"');
  }
}

function assertTurns(turns) {
  if (!Number.isInteger(turns)) {
    throw new TypeError('turns must be an integer');
  }
}

function assertMinShift(minShift, windowSize) {
  if (!Number.isInteger(minShift)) {
    throw new TypeError('minShift must be an integer');
  }
  if (minShift < 0 || minShift >= windowSize) {
    throw new RangeError('minShift must be 0 <= minShift < windowSize');
  }
}

function assertMode(name, value, allowed) {
  if (!allowed.has(value)) {
    throw new RangeError(`${name} is not supported`);
  }
}

function assertState(state) {
  if (!isPlainObject(state)) {
    throw new TypeError('state must be an object');
  }

  for (const field of ['point', 'shift', 'gap']) {
    if (!Number.isInteger(state[field])) {
      throw new TypeError(`state.${field} must be an integer`);
    }
  }
}

function cloneMesh(mesh) {
  if (!Array.isArray(mesh)) {
    throw new TypeError('mesh must be an array of points');
  }
  if (mesh.length === 0) {
    throw new TypeError('mesh must be a non-empty array of points');
  }

  return mesh.map((point, pointIndex) => {
    if (!Array.isArray(point) || point.length !== 3) {
      throw new TypeError(`mesh point ${pointIndex} must be a [x, y, z] array`);
    }
    point.forEach((coordinate, coordinateIndex) => {
      if (typeof coordinate !== 'number' || !Number.isFinite(coordinate)) {
        throw new TypeError(`mesh point ${pointIndex}[${coordinateIndex}] must be finite`);
      }
    });
    return point.slice();
  });
}

function validateLayer(layer, layerIndex, windowSize) {
  if (!isPlainObject(layer)) {
    throw new TypeError(`layer ${layerIndex} must be an object`);
  }
  if (layer.type !== LAYER_TYPE_ROTATE) {
    throw new RangeError(`layer ${layerIndex} type is not supported`);
  }
  if (layer.mesh === undefined) {
    throw new TypeError(`layer ${layerIndex} mesh is required`);
  }

  const definedLayer = {};
  for (const key of Object.keys(layer)) {
    if (layer[key] !== undefined) {
      definedLayer[key] = layer[key];
    }
  }

  const normalized = cloneValue(definedLayer);
  normalized.mesh = cloneMesh(layer.mesh);
  normalized.graftMode = normalized.graftMode === undefined ? 'none' : normalized.graftMode;
  normalized.stateMode = normalized.stateMode === undefined ? 'explicit' : normalized.stateMode;
  normalized.minShift = normalized.minShift === undefined ? 0 : normalized.minShift;
  normalized.walkMode = normalized.walkMode === undefined ? 'permissive' : normalized.walkMode;

  assertMode('graftMode', normalized.graftMode, GRAFT_MODES);
  assertMode('stateMode', normalized.stateMode, STATE_MODES);
  assertMode('walkMode', normalized.walkMode, WALK_MODES);
  assertDirection(normalized.direction);
  assertTurns(normalized.turns);
  assertMinShift(normalized.minShift, windowSize);

  if (normalized.stateMode === 'anchored') {
    if (normalized.packet === undefined) {
      throw new TypeError(`layer ${layerIndex} packet is required for anchored state`);
    }
  } else {
    assertState(normalized.state);
    normalized.state = {
      point: normalized.state.point,
      shift: normalized.state.shift,
      gap: normalized.state.gap,
    };
  }

  if (normalized.packet !== undefined) {
    applyPacketGraft(normalized.mesh, normalized.packet, normalized.graftMode);
    deriveAnchoredStateFromPacket(normalized.packet, normalized.mesh.length);
  }

  return normalized;
}

function normalizeStack(stack) {
  if (!isPlainObject(stack)) {
    throw new TypeError('stack must be an object');
  }
  if (stack.format !== STACK_FORMAT) {
    throw new RangeError('stack.format must be "UNSTACK"');
  }
  if (stack.version !== STACK_VERSION) {
    throw new RangeError('stack.version must be 1');
  }
  assertWindowSize(stack.windowSize);
  if (!Array.isArray(stack.layers) || stack.layers.length === 0) {
    throw new TypeError('stack.layers must be a non-empty array');
  }

  const normalized = cloneValue({
    ...stack,
    layers: [],
  });
  normalized.layers = stack.layers.map((layer, layerIndex) => (
    validateLayer(layer, layerIndex, stack.windowSize)
  ));

  return normalized;
}

function effectiveMeshForLayer(layer) {
  if (layer.packet !== undefined && layer.graftMode !== 'none') {
    return applyPacketGraft(layer.mesh, layer.packet, layer.graftMode);
  }

  return cloneMesh(layer.mesh);
}

function stateForLayer(layer, effectiveMesh) {
  if (layer.stateMode === 'anchored') {
    return deriveAnchoredStateFromPacket(layer.packet, effectiveMesh.length);
  }

  return {
    point: layer.state.point,
    shift: layer.state.shift,
    gap: layer.state.gap,
  };
}

function instructionsForLayer(layer, dataLength, windowSize) {
  const effectiveMesh = effectiveMeshForLayer(layer);
  const state = stateForLayer(layer, effectiveMesh);

  return generateInstructionStream({
    mesh: effectiveMesh,
    state,
    count: dataLength,
    windowSize,
    minShift: layer.minShift,
    mode: layer.walkMode,
  }).instructions;
}

function applyLayer(data, layer, windowSize, mutate, reverse) {
  const instructions = instructionsForLayer(layer, data.length, windowSize);
  const transformOptions = {
    direction: layer.direction,
    turns: layer.turns,
    mutate,
  };

  return reverse
    ? reverseRotateTransform(data, instructions, transformOptions)
    : applyRotateTransform(data, instructions, transformOptions);
}

function applyStack(data, stack, options = {}) {
  const normalized = normalizeStack(stack);
  let current = data;

  normalized.layers.forEach((layer, layerIndex) => {
    const mutate = options.mutate === true || layerIndex > 0;
    current = applyLayer(current, layer, normalized.windowSize, mutate, false);
  });

  return current;
}

function reverseStack(data, stack, options = {}) {
  const normalized = normalizeStack(stack);
  let current = data;

  for (let index = normalized.layers.length - 1; index >= 0; index -= 1) {
    const mutate = options.mutate === true || index < normalized.layers.length - 1;
    current = applyLayer(current, normalized.layers[index], normalized.windowSize, mutate, true);
  }

  return current;
}

module.exports = {
  normalizeStack,
  applyStack,
  reverseStack,
};
