'use strict';

const DEGENERATE_BUCKET_ID = 'degenerate';

const DEFAULT_BUCKETS = Object.freeze([
  Object.freeze({ id: DEGENERATE_BUCKET_ID, degenerate: true }),
  Object.freeze({ id: 'lt-15', maxExclusive: 15 }),
  Object.freeze({ id: 'lt-30', maxExclusive: 30 }),
  Object.freeze({ id: 'lt-45', maxExclusive: 45 }),
  Object.freeze({ id: 'lt-60', maxExclusive: 60 }),
  Object.freeze({ id: 'lt-75', maxExclusive: 75 }),
  Object.freeze({ id: 'lt-90', maxExclusive: 90 }),
  Object.freeze({ id: 'lt-105', maxExclusive: 105 }),
  Object.freeze({ id: 'gte-105', minInclusive: 105 }),
]);

function defaultAngleBuckets() {
  return DEFAULT_BUCKETS;
}

function assertBuckets(buckets) {
  if (!Array.isArray(buckets) || buckets.length === 0) {
    throw new TypeError('buckets must be a non-empty array');
  }

  buckets.forEach((bucket, index) => {
    if (bucket === null || typeof bucket !== 'object') {
      throw new TypeError(`bucket[${index}] must be an object`);
    }
    if (typeof bucket.id !== 'string' || bucket.id.length === 0) {
      throw new TypeError(`bucket[${index}].id must be a non-empty string`);
    }
  });
}

function degenerateBucketFrom(buckets) {
  return buckets.find((bucket) => bucket.degenerate === true || bucket.id === DEGENERATE_BUCKET_ID);
}

function bucketForAngle(angle, buckets = defaultAngleBuckets()) {
  assertBuckets(buckets);

  if (angle !== null && typeof angle !== 'number') {
    throw new TypeError('angle must be a number or null');
  }

  if (angle === null || !Number.isFinite(angle)) {
    const degenerateBucket = degenerateBucketFrom(buckets);
    if (!degenerateBucket) {
      throw new RangeError('buckets must include a degenerate bucket');
    }
    return degenerateBucket;
  }

  if (typeof angle !== 'number' || angle < 0 || angle > 180) {
    throw new RangeError('angle must be a finite number between 0 and 180');
  }

  const bucket = buckets.find((candidate) => {
    if (candidate.degenerate === true) {
      return false;
    }

    if (
      Object.prototype.hasOwnProperty.call(candidate, 'maxExclusive')
      && angle < candidate.maxExclusive
    ) {
      return true;
    }

    return (
      Object.prototype.hasOwnProperty.call(candidate, 'minInclusive')
      && angle >= candidate.minInclusive
    );
  });

  if (!bucket) {
    throw new RangeError('no bucket matched angle');
  }

  return bucket;
}

module.exports = {
  defaultAngleBuckets,
  bucketForAngle,
};
