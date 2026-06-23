# UN-MATRIX Ideas

Status: Sprint 21 adds first-pass `UN-MATRIX-MUTATE-SIGNED` signed envelopes over explicit committed `UN-MATRIX-MUTATE` recipes beside the Sprint 19 `UN-MATRIX` utilities and Sprint 20 mutation helpers. `UN-ND`, `UN-MATRIX-COMBINE`, certificates, stack integration, cascade integration, CLI/file wrappers, and browser playground work remain future scope.

Sprint 19 `UN-MATRIX` utilities normalize rectangular safe-integer matrix values, create committed matrix descriptors, clone matrix values defensively, expose row/column accessors, transpose and flip matrix values, rotate square matrices by 90 or 270 degrees, rotate any rectangular matrix by 180 degrees, and flatten rows as ordered N-dimensional point vectors. These helpers do not mutate caller input or hidden key state.

`UN-MATRIX` is not production cryptography. Matrix commitments bind deterministic descriptor material for reproducibility, but they do not prove secrecy, strength, authenticity, safe key evolution, tamper-proofing, compression, steganography, or production-safe encryption.

Sprint 20 `UN-MATRIX-MUTATE` recipes are experimental and are not production cryptography. Mutation recipes do not prove secrecy, strength, authenticity, or safe key evolution. They are explicit, deterministic, replayable, bounded, and commitment-backed transition records only.

Sprint 21 `UN-MATRIX-MUTATE-SIGNED` envelopes are experimental and are not production cryptography. A signature proves signer intent over an explicit committed mutation recipe only. It does not prove matrix secrecy, key strength, authenticity of a real-world identity, safe key evolution, authorization, or production security.

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
- Sprint 21 signing covers explicit committed recipes only. Signing must not hide mutation, create automatic key evolution, or imply production-safe cryptography.
- Future mutation may bind to frame, layer, context, and packet commitments when used inside stacks or streams.
- Future mutation may bind to relevant object, gate, certificate, or descriptor commitments when used for validation.
- Geometry helpers should remain pure readers of key material. They should reject invalid shape or return degenerate geometry rather than mutating state.

## UN-MATRIX-COMBINE

`UN-MATRIX-COMBINE` would combine two equal-sized source matrices into a larger tiled matrix by placing transformed copies into a 2x2 quadrant layout.

Initial design constraints:

- Source matrices must be equal-sized unless a future version defines padding or crop policy.
- The combined output is a 2x2 quadrant tiling of source-derived tiles.
- A placement recipe declares which source matrix contributes to each quadrant.
- Each quadrant can declare a transform.

Candidate transforms:

- identity;
- horizontal flip;
- vertical flip;
- 180-degree rotation;
- 90-degree rotation when square shape policy permits it;
- 270-degree rotation when square shape policy permits it;
- transpose when shape policy permits it.

Candidate policies:

- balanced: both source matrices must appear in the combined output under policy-defined minimum coverage.
- free: any quadrant placement is allowed as long as commitments match.
- coverage: the recipe must satisfy explicit source coverage and transform coverage requirements.

Commitments should cover:

- source matrix A commitment;
- source matrix B commitment;
- combine recipe commitment;
- combined matrix commitment;
- shape policy and transform policy;
- optional frame/layer/context/gate/certificate bindings.

## Future Sprint Outline

- Docs-only design: refine vocabulary, shape constraints, mutation rules, and commitment boundaries.
- Pure matrix utilities: Sprint 19 adds validation, canonicalization, transforms, row-as-point flattening, and commitments without stack integration.
- Matrix mutation descriptors: Sprint 20 adds explicit committed `UN-MATRIX-MUTATE` recipes only; no helper mutates key state implicitly.
- Signed matrix mutation envelopes: Sprint 21 adds `UN-MATRIX-MUTATE-SIGNED` signer-intent envelopes over committed recipes only.
- Flatten matrix to N-D mesh: define a deterministic conversion from matrix keys to ordered N-dimensional point meshes.
- Combine descriptors: define committed `UN-MATRIX-COMBINE` recipe descriptors and verification helpers.
- Stack integration: allow stacks to consume committed matrix-derived meshes only after the docs and pure utilities are stable.

## Future Scope Boundaries

Matrix combine, certificates, N-dimensional angle math, GWM integration, stack integration, cascade integration, CLI/file wrappers, and browser playground work remain future scope. `UN-MATRIX-MUTATE` and `UN-MATRIX-MUTATE-SIGNED` do not add hidden key mutation, automatic key evolution, production-safe cryptography, compression, steganography, homomorphic behavior, or production authentication.
