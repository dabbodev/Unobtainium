# UN-MATRIX Ideas

Status: future design notes only. No `UN-MATRIX`, `UN-ND`, `UN-MATRIX-MUTATE`, or `UN-MATRIX-COMBINE` implementation exists yet.

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

## Matrix Mutation Ideas

`UN-MATRIX-MUTATE` would describe explicit key-state transitions. Candidate mutations include:

- grow row: append or insert a deterministic row;
- prune row: remove a declared row under a committed rule;
- grow dimension: append or insert a column/dimension across all rows;
- prune dimension: remove a declared column/dimension;
- evolve row: update row coordinates by an explicit deterministic transform;
- degenerate row: intentionally collapse or neutralize a row under a declared rule;
- axis swap: exchange two dimensions across all rows;
- row rotate: rotate row order;
- column rotate: rotate dimension order;
- transpose: swap rows and columns when shape policy permits it.

## Safety Rules

- Mutation must be explicit. A helper that computes distance or angle must not secretly change key shape or key state.
- Mutation must be deterministic. The same input matrix, context, and recipe must produce the same output matrix.
- Mutation should be signed or committed. A verifier should be able to bind pre-state, recipe, and post-state.
- Mutation should bind to frame, layer, context, and packet commitments when used inside stacks or streams.
- Mutation should bind to relevant object, gate, certificate, or descriptor commitments when used for validation.
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
- Pure matrix utilities: add validation, canonicalization, transforms, and commitments without stack integration.
- Flatten matrix to N-D mesh: define a deterministic conversion from matrix keys to ordered N-dimensional point meshes.
- Combine descriptors: define committed `UN-MATRIX-COMBINE` recipe descriptors and verification helpers.
- Stack integration: allow stacks to consume committed matrix-derived meshes only after the docs and pure utilities are stable.
