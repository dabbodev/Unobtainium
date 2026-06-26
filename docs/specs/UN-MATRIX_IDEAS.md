# UN-MATRIX Ideas

Status: The current v3 matrix line includes Sprint 19 `UN-MATRIX` utilities, Sprint 20 mutation helpers, Sprint 21 signed mutation envelopes, Sprint 24 combine recipes, and Sprint 25 signed combine envelopes. Sprint 26 adds `UN-CERT`, Sprint 27 adds `UN-CUTOUT` / `UN-STENCIL`, and Sprint 28 adds validation-only `UN-CERT` cutout bindings beside the matrix work. `UN-ND`, `UN-TRIAD-MIX`, `UN-GWM-V2`, GWM integration, stack integration, cascade integration, CLI/file wrappers, browser playground work, and hybrid production crypto envelopes remain future scope.

Sprint 19 `UN-MATRIX` utilities normalize rectangular safe-integer matrix values, create committed matrix descriptors, clone matrix values defensively, expose row/column accessors, transpose and flip matrix values, rotate square matrices by 90 or 270 degrees, rotate any rectangular matrix by 180 degrees, and flatten rows as ordered N-dimensional point vectors. These helpers do not mutate caller input or hidden key state.

`UN-MATRIX` is not production cryptography. Matrix commitments bind deterministic descriptor material for reproducibility, but they do not prove secrecy, strength, authenticity, safe key evolution, tamper-proofing, compression, steganography, or production-safe encryption.

Sprint 20 `UN-MATRIX-MUTATE` recipes are experimental and are not production cryptography. Mutation recipes do not prove secrecy, strength, authenticity, or safe key evolution. They are explicit, deterministic, replayable, bounded, and commitment-backed transition records only.

Sprint 21 `UN-MATRIX-MUTATE-SIGNED` envelopes are experimental and are not production cryptography. A signature proves signer intent over an explicit committed mutation recipe only. It does not prove matrix secrecy, key strength, authenticity of a real-world identity, safe key evolution, authorization, or production security.

Sprint 24 `UN-MATRIX-COMBINE` recipes are experimental and are not production cryptography. Combine recipes deterministically place transformed copies of supplied matrix tiles into a larger matrix key and commit to the recipe identity. They do not prove secrecy, key strength, identity, certificate validity, asymmetric behavior, production authentication, or safe key evolution.

Sprint 25 `UN-MATRIX-COMBINE-SIGNED` envelopes are experimental and are not production cryptography. A signature proves signer intent over an explicit committed combine recipe only. It does not prove matrix secrecy, key strength, asymmetric encryption, authenticity of a real-world identity, certificate validity, authorization, or production authentication.

## Motivation

Current v3 key material is modeled as ordered 3D points. Matrix-shaped and N-dimensional keys would let the project explore richer geometry while keeping the same core discipline: explicit shape, deterministic canonicalization, stable commitments, and no hidden mutation inside geometry helpers.

Potential uses:

- represent rows of key material as points with more than three dimensions;
- keep square or rectangular matrix keys as first-class committed objects;
- flatten matrix keys into point meshes only at explicit stack or descriptor boundaries;
- support future certificate, cascade, and ratchet designs that need committed key-state transitions.

## N-Dimensional Distance and Angle

`UN-ND` would generalize a point from `[x, y, z]` to an ordered coordinate vector of length `N`.

Three points can still define an angle in N-dimensional Euclidean space. Given points `A`, `B`, and `C`, the angle at `B` can be derived from vectors `BA = A - B` and `BC = C - B`. The dot product of those vectors and their Euclidean lengths produce the cosine relation:

`cos(theta) = dot(BA, BC) / (length(BA) * length(BC))`

Degenerate cases remain explicit. If either vector has zero length, coordinates are non-finite, dimensions do not match, or the computation cannot produce a stable angle, the geometry oracle should return a degenerate result rather than `NaN`.

## Matrix Key Shape Options

- Rows as points, columns as dimensions: an `r x c` matrix is an ordered list of `r` N-dimensional points where `N = c`.
- Square matrix keys: `n x n` matrices can support symmetric operations, transpose, rotations, and quadrant combine recipes.
- Rectangular matrix keys: `r x c` matrices can carry non-square point sets while still preserving explicit row and dimension counts.
- Tensor-ish future scope: higher-rank shapes may be explored later, but should not be smuggled into the first matrix format.

## UN-MATRIX-MUTATE

Sprint 20 `UN-MATRIX-MUTATE` describes an ordered list of explicit matrix operations with source matrix commitment, target matrix commitment, canonical metadata, and a domain-separated recipe commitment. Operation order is part of recipe identity. Mutation is never hidden inside matrix helpers; callers must opt into applying a recipe.

Supported Sprint 20 operations:

- `swapRows`;
- `swapColumns`;
- `reverseRow`;
- `reverseColumn`;
- `rotateRows`;
- `rotateColumns`;
- `transpose`;
- `flipHorizontal`;
- `flipVertical`;
- `rotate180`;
- `rotate90` for square matrices only;
- `rotate270` for square matrices only.

Recipes reject unknown operations, invalid parameters, unsafe integers, out-of-bounds indexes, and rectangular 90/270-degree rotation. Bounds are checked dynamically as each operation runs because operations such as `transpose` can change the current matrix shape before later operations.

Future mutation ideas include:

- grow row: append or insert a deterministic row;
- prune row: remove a declared row under a committed rule;
- grow dimension: append or insert a column/dimension across all rows;
- prune dimension: remove a declared column/dimension;
- evolve row: update row coordinates by an explicit deterministic transform;
- degenerate row: intentionally collapse or neutralize a row under a declared rule;
- policy-bound mutation approval outside the signed-envelope primitive.

## UN-MATRIX-MUTATE-SIGNED

Sprint 21 `UN-MATRIX-MUTATE-SIGNED` signs an explicit normalized `UN-MATRIX-MUTATE` recipe using Ed25519. The signed payload includes signed-envelope format/version context, algorithm, public key material, signer metadata, the normalized mutation recipe payload, the mutation recipe commitment, source matrix commitment, and target matrix commitment when declared.

The signed matrix mutation commitment is deterministic and domain-separated. Verification checks the recipe commitment, source and target commitment bindings, signed envelope commitment, public key material, and signature bytes. Applying a signed mutation verifies the envelope first, then applies the underlying recipe only when the source matrix matches the signed source commitment and the computed target matrix matches any signed target commitment.

Signing does not make hidden mutation acceptable. Matrix mutation remains explicit, deterministic, replayable, bounded, and commitment-backed. The signature proves signer intent over the committed recipe; it does not prove secrecy, strength, authenticity of a real-world identity, authorization, or safe key evolution.

## Safety Rules

- Mutation must be explicit. A helper that computes distance, angle, matrix values, rows, columns, or transforms must not secretly change key shape or key state.
- Mutation must be deterministic. The same input matrix, context, and recipe must produce the same output matrix.
- Sprint 21 and Sprint 25 signing cover explicit committed recipes only. Signing must not hide mutation, create automatic key evolution, or imply production-safe cryptography.
- Future mutation may bind to frame, layer, context, and packet commitments when used inside stacks or streams.
- Future mutation may bind to relevant object, gate, certificate, or descriptor commitments when used for validation.
- Geometry helpers should remain pure readers of key material. They should reject invalid shape or return degenerate geometry rather than mutating state.

## UN-MATRIX-COMBINE

Sprint 24 `UN-MATRIX-COMBINE` combines named source matrix tiles into a larger tiled matrix by placing transformed copies into an output tile grid. It is a pure committed recipe family only. It does not add certificates, GWM integration, stack integration, cascade integration, CLI/file wrappers, browser demo behavior, or legacy runtime changes.

First-pass recipe shape:

- `tiles`: an object or array of named source matrix tiles;
- `placements`: an ordered array of placement objects;
- optional canonical `metadata`.

Each placement declares `tile`, `row`, `column`, and an optional `transform`. Placement order is part of recipe identity even when the assembled matrix values would match another ordering.

Supported Sprint 24 transforms:

- identity;
- `flipHorizontal`;
- `flipVertical`;
- `rotate180`;
- `transpose`;
- `rotate90` for square source tiles only;
- `rotate270` for square source tiles only.

Shape and bounds rules:

- all source tiles must be valid normalized matrix keys or raw matrix values accepted by `UN-MATRIX`;
- all source tiles must have the same base shape;
- transformed tile shape must fit the output cell shape;
- placement row and column indexes must be non-negative safe integers;
- missing tile references, unsupported transforms, overlapping placements, and unfilled output cells are rejected;
- every tile-grid cell from row `0` through the maximum used row and column `0` through the maximum used column must be filled;
- empty output cells and fill values are not supported in Sprint 24.

Commitments should cover:

- tile names;
- tile matrix commitments;
- ordered placements;
- placement coordinates;
- placement transforms;
- canonical metadata;
- combine recipe commitment;
- combined matrix commitment when a recipe is applied.

Matrix combine is experimental and not production cryptography. Combining public/private-looking tiles does not create real asymmetric cryptography. Combine recipe commitments do not prove secrecy, key strength, identity, or certificate validity. Certificate integration into GWM, stacks, cascade, CLI/file wrappers, browser paths, and legacy runtime paths remains future scope. N-dimensional angle math, `UN-TRIAD-MIX`, and `UN-GWM-V2` also remain future scope.

Tiny non-production recipe shape:

```javascript
{
  tiles: { left: [[1, 2]], right: [[3, 4]] },
  placements: [
    { tile: 'left', row: 0, column: 0 },
    { tile: 'right', row: 0, column: 1 }
  ],
  metadata: { example: 'matrix-combine-shape' }
}
```

## UN-MATRIX-COMBINE-SIGNED

Sprint 25 `UN-MATRIX-COMBINE-SIGNED` signs an explicit normalized `UN-MATRIX-COMBINE` recipe using Ed25519. The signed payload includes signed-envelope format/version context, algorithm, public key material, signer metadata, the normalized combine recipe payload, the combine recipe commitment, input tile commitments, and an output matrix commitment when available or declared.

The signed matrix combine commitment is deterministic and domain-separated. Verification checks the combine recipe commitment, signed input tile commitments, signed output matrix commitment field, signed envelope commitment, public key material, and signature bytes. Applying a signed combine verifies the envelope first, then applies the underlying recipe only when supplied tiles match the signed tile commitments and the computed output matrix matches any signed output commitment.

Matrix combine remains explicit, deterministic, replayable, and commitment-backed. The signature proves signer intent over the committed combine recipe only. It does not prove secrecy, key strength, asymmetric encryption, real-world identity, certificate validity, authorization, or production authentication. Combining public/private-looking tiles does not create real asymmetric cryptography.

Sprint 25 does not add `UN-CERT`, certificates, N-dimensional angle math, GWM integration, stack integration, cascade integration, CLI/file wrappers, browser playground behavior, hidden key evolution, automatic key evolution, `UN-STENCIL`, or `UN-CUTOUT`.

Tiny non-production signed combine concept:

```javascript
{
  format: 'UN-MATRIX-COMBINE-SIGNED',
  matrixCombineRecipeCommitment: '...',
  inputTileCommitments: [{ name: 'left', rows: 1, columns: 2, matrixCommitment: '...' }],
  outputMatrixCommitment: '...',
  signerId: 'lab-signer',
  purpose: 'signer-intent-over-combine-recipe',
  signature: { algorithm: 'ed25519', publicKey: '...', value: '...' }
}
```

## Future Sprint Outline

- Docs-only design: refine vocabulary, shape constraints, mutation rules, and commitment boundaries.
- Pure matrix utilities: Sprint 19 adds validation, canonicalization, transforms, row-as-point flattening, and commitments without stack integration.
- Matrix mutation descriptors: Sprint 20 adds explicit committed `UN-MATRIX-MUTATE` recipes only; no helper mutates key state implicitly.
- Signed matrix mutation envelopes: Sprint 21 adds `UN-MATRIX-MUTATE-SIGNED` signer-intent envelopes over committed recipes only.
- Matrix combine recipes: Sprint 24 adds pure committed `UN-MATRIX-COMBINE` recipes only; no certificates, stack integration, cascade integration, GWM integration, CLI/file wrappers, browser paths, or legacy runtime changes.
- Signed matrix combine envelopes: Sprint 25 adds `UN-MATRIX-COMBINE-SIGNED` signer-intent envelopes over explicit committed combine recipes only; no stack integration, cascade integration, GWM integration, CLI/file wrappers, browser paths, or legacy runtime changes.
- Split certificates and cutout bindings: Sprints 26-28 add `UN-CERT`, `UN-CUTOUT` / `UN-STENCIL`, and validation-only certificate cutout bindings beside the matrix modules. They do not integrate matrix/cert/cutout behavior into GWM, stacks, cascade, CLI/file wrappers, browser paths, or legacy runtime changes.
- Flatten matrix to N-D mesh: define a deterministic conversion from matrix keys to ordered N-dimensional point meshes.
- Stack integration: allow stacks to consume committed matrix-derived meshes only after the docs and pure utilities are stable.

## Future Scope Boundaries

N-dimensional angle math, `UN-TRIAD-MIX`, `UN-GWM-V2`, GWM integration, stack integration, cascade integration, CLI/file wrappers, browser playground work, and hybrid production crypto envelopes remain future scope. `UN-MATRIX-MUTATE`, `UN-MATRIX-MUTATE-SIGNED`, `UN-MATRIX-COMBINE`, `UN-MATRIX-COMBINE-SIGNED`, `UN-CERT`, and `UN-CUTOUT` / `UN-STENCIL` do not add hidden key mutation, automatic key evolution, production-safe cryptography, asymmetric cryptography, secure redaction, compression, steganography, homomorphic behavior, or production authentication.
