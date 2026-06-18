const assert = require('node:assert/strict');
const test = require('node:test');

const Unobtainium = require('../unobtainium');

function smallKey() {
  return { poly: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]] };
}

test('package import returns the Unobtainium constructor', () => {
  const exported = require('..');

  assert.equal(typeof exported, 'function');
  assert.equal(exported.name, 'Unobtainium');
});

test('legacy object key obscures and obtains a Buffer roundtrip', async () => {
  const original = Buffer.from([0x00, 0x01, 0x02, 0x0f, 0x10, 0x7f, 0xff]);
  const encryptor = new Unobtainium(smallKey());

  encryptor.read(Buffer.from(original));
  await encryptor.obscure();
  await encryptor.obtain();

  assert.deepEqual(Buffer.from(encryptor.data), original);
});

test('keepPosition=false resets walk state after obscure', async () => {
  const encryptor = new Unobtainium(smallKey(), { keepPosition: false });

  encryptor.read(Buffer.from([1, 2, 3, 4, 5]));
  await encryptor.obscure();

  assert.equal(encryptor.point, 0);
  assert.equal(encryptor.shift, 0);
  assert.equal(encryptor.gap, 0);
});

test('keepPosition=true preserves the advanced walk state after obscure', async () => {
  const encryptor = new Unobtainium(smallKey(), { keepPosition: true });

  encryptor.read(Buffer.from([1, 2, 3, 4, 5]));
  await encryptor.obscure();

  assert.equal(encryptor.point, 1);
  assert.equal(encryptor.shift, 1);
  assert.equal(encryptor.gap, 0);
});

test('floor=0 and floor=1 produce distinct stable legacy output', async () => {
  const floor0 = new Unobtainium(smallKey(), { floor: 0 });
  const floor1 = new Unobtainium(smallKey(), { floor: 1 });

  floor0.read(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]));
  floor1.read(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]));

  await floor0.obscure();
  await floor1.obscure();

  assert.deepEqual([...floor0.data], [1, 1, 2, 3, 5, 7, 6, 7]);
  assert.deepEqual([...floor1.data], [0, 0, 3, 4, 4, 8, 7, 6]);
  assert.notDeepEqual([...floor0.data], [...floor1.data]);
});

