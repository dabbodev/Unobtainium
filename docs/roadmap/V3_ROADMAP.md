# Unobtainium v3 Roadmap

Status: planning document for an experimental cipher lab. Raw v3 modes are not production encryption. Fitting, cascade, matrix, certificate, cutout/stencil, and steganography branches are research directions, not compression or security claims.

## Completed Sprints

- Sprint 0: established v3 documentation framing, legacy behavior documentation, and security disclaimers.
- Sprint 1: added legacy behavior coverage and Node built-in tests around existing runtime behavior.
- Sprint 2: added the v3 core skeleton under `packages/core` without changing the legacy package API.
- Sprint 3: added geometry helpers, angle buckets, coordinate rules, and `generateMaskInstruction()`.
- Sprint 4: added `generateInstructionStream()`, `applyRotateTransform()`, and `reverseRotateTransform()`.
- Sprint 5: added `UNPKT` point packets and packet grafting.
- Sprint 6: added unsigned `UNSTACK` recipes.
- Sprint 7: added standalone pair-swap `UN-SWAP`.
- Sprint 8: integrated `UN-SWAP` into `UNSTACK`.
- Sprint 9: added first-pass `UNSTACK-SIGNED` recipe envelopes.
- Sprint 10: added validation-only `UN-GATE`.
- Sprint 11: added first-pass committed `UNPATCH`.
- Sprint 12: added first-pass `UNPATCH-SIGNED` intent envelopes.
- Sprint 13: added first-pass in-memory `UN-KEYFILE`.
- Sprint 14: added first-pass `UN-GEN` blank-substrate generation.
- Sprint 15: added first-pass `UN-GEN-DESCRIPTOR` generation manifests.
- Sprint 16: added first-pass `UN-FIT-NAIVE` candidate evaluation.
- Sprint 17: consolidates roadmap/spec documentation, legacy demo archaeology, and future design branches before adding more implementation.
- Sprint 18: added first-pass `UN-CASCADE` deterministic residual layering for caller-supplied candidates.
- Sprint 19: added first-pass `UN-MATRIX` pure utilities for matrix validation, descriptors, commitments, copied accessors, basic transforms, and row-as-point flattening.
- Sprint 20: added first-pass `UN-MATRIX-MUTATE` pure committed mutation recipes for explicit deterministic bounded matrix transitions.
- Sprint 21: added first-pass `UN-MATRIX-MUTATE-SIGNED` envelopes for signer intent over explicit committed matrix mutation recipes.
- Sprint 24: added first-pass `UN-MATRIX-COMBINE` pure committed combine recipes for deterministic tiled matrix assembly.
- Sprint 25: added first-pass `UN-MATRIX-COMBINE-SIGNED` envelopes for signer intent over explicit committed matrix combine recipes.
- Sprint 26: added first-pass `UN-CERT` split validation certificate objects.
- Sprint 27: added first-pass `UN-CUTOUT` / `UN-STENCIL` committed region descriptors for byte-like payloads.
- Sprint 28: extended `UN-CERT` with validation-only bindings for `UN-CUTOUT` descriptors and cutout commitments.
- Sprint 30: added a docs-only `UN-TRIAD-MIX` / `UN-GWM-V2` design specification for triad-as-instruction-cell mask generation.
- Sprint 31: added pure `UN-TRIAD-MIX` feature extraction utilities for ordered point triads, including point, edge, whole-triangle, optional walk-context features, and deterministic commitments, without transform instruction emission or runtime integration.

## Current Module Map

- `UN-GWM`: geometric walk mask family that derives mask instructions from ordered point-cloud keys.
- `UN-ROTATE`: reversible in-memory ring rotation transform driven by instruction streams.
- `UN-SWAP`: deterministic pair-swap positional permutation primitive.
- `UNPKT`: ordered point packets for context, nonce, random, or future packet-derived geometry material.
- `UNSTACK`: unsigned ordered transform stack recipe format.
- `UNSTACK-SIGNED`: signed envelope for committed stack recipes and signer intent metadata.
- `UN-GATE`: validation-only scoped commitment object.
- `UNPATCH`: committed bounded additive patch object for controlled malleability experiments.
- `UNPATCH-SIGNED`: signed envelope for committed patch intent.
- `UN-KEYFILE`: in-memory derivation of ordered fixed-point 3D point-cloud keys from normalized bytes or strings.
- `UN-GEN`: blank-substrate generation by applying existing stack recipes.
- `UN-GEN-DESCRIPTOR`: committed manifest for generation settings and reconstruction relations.
- `UN-FIT-NAIVE`: deterministic evaluator for caller-supplied generation candidates and residual scores.
- `UN-CASCADE`: deterministic residual layering over caller-supplied generation candidates in declared order.
- `UN-MATRIX`: pure utilities for rectangular safe-integer matrix key descriptors, deterministic commitments, defensive copies, basic matrix transforms, and row-as-point flattening.
- `UN-MATRIX-MUTATE`: pure utilities for explicit committed matrix mutation recipes. Recipes are deterministic, replayable, bounded, and commitment-backed; they are not hidden key evolution or production cryptography.
- `UN-MATRIX-MUTATE-SIGNED`: signed envelopes over explicit committed matrix mutation recipes. A signature proves signer intent over the committed recipe only; it does not prove secrecy, strength, real-world identity, authorization, or safe key evolution.
- `UN-MATRIX-COMBINE`: pure utilities for committed matrix combine recipes. Recipes place transformed copies of named source tiles into a fully filled rectangular tile grid and return a normal `UN-MATRIX` key when applied; they are not certificates, asymmetric cryptography, or production cryptography.
- `UN-MATRIX-COMBINE-SIGNED`: signed envelopes over explicit committed matrix combine recipes. A signature proves signer intent over the committed recipe only; it does not prove secrecy, strength, asymmetric encryption, real-world identity, certificate validity, authorization, or production authentication.
- `UN-CERT`: split validation certificate objects that bind public matrix tile material or commitments, private tile slots and expected commitments, signed matrix combine material, an expected output matrix commitment, optional target commitments, optional ordered cutout bindings, metadata, context, and a certificate commitment. A certificate proves only that supplied material satisfies a committed validation relationship.
- `UN-CUTOUT` / `UN-STENCIL`: committed region descriptors for byte-like payloads. A cutout plan declares ordered hidden ranges, deterministic public fill, span commitments, payload commitments, context, metadata, and a plan commitment. Verification proves only that supplied hidden spans satisfy committed reconstruction checks.
- `UN-TRIAD-MIX` / `UN-GWM-V2`: pure feature extraction branch for treating each ordered point triad as deterministic point, edge, triangle, and optional context material. Sprint 31 does not emit `UN-ROTATE`, `UN-SWAP`, or permutation instructions and does not change existing `UN-GWM` streams.

## Near-Term Recommended Sprints

- Demo archaeology docs complete: finish documenting side demos as reference material and keep the authority boundary clear.
- v3 browser playground planning: design a browser-only playground that rebuilds old demo affordances using v3 abstractions.
- `UN-CASCADE` descriptor/reconstruction follow-up: sketch how external generated data, descriptors, and final residual material could support reconstruction workflows without turning cascade reports into compression or carrier formats.
- `UN-MATRIX` follow-up design: refine stack integration, N-dimensional geometry, cascade, CLI/file, and browser boundaries after the Sprint 19 through Sprint 28 pure utilities, signed envelopes, certificate objects, committed region descriptors, and validation-only cutout certificate bindings.
- Sprint 32 `UN-TRIAD-MIX` channel emission: add opt-in rotate/value, swap/position, rule/mix, and explain/debug emission while preserving existing stream behavior.
- Sprint 33 opt-in stream compatibility: define a new instruction stream version or transform integration tests for triad-mix output without changing legacy streams by default.
- `UN-ND` docs-only design: define N-dimensional point support and angle derivation without changing existing 3D helpers.

## Medium-Term Sprints

- `UN-CERT` follow-up: refine certificate policy, target bindings, and interop boundaries without turning certificates into production authentication or public-key cryptography.
- `UN-STENCIL` / `UN-CUTOUT` follow-up: refine overlay and cutout design for original-vs-shifted layers with context-bound XOR stencil material. GWM integration, stack integration, cascade integration, file wrappers, browser behavior, and CLI behavior remain future scope.
- v3 CLI/file wrappers: file and command wrappers around already specified v3 primitives, without changing legacy API behavior.

## Long-Term / Experimental

- `UN-CASCADE`: candidate search, optimization, and richer reconstruction descriptor workflows remain future scope.
- `UN-STEG`: geometric steganography branch for carrying packet, stack, or descriptor material in carrier media.
- Matrix ratchets: deterministic key-state evolution over matrix material with signed transition records and explicit policy. Sprint 20 mutation recipes do not provide automatic or safe key evolution by themselves.
- Stream/session mode: explicit session state, packet commitments, frame counters, and replay/misuse boundaries.
- Hybrid crypto envelope: wrap v3 experimental material inside standard authenticated encryption instead of presenting raw modes as secure encryption. This remains future scope and should preserve the geometry-key lab framing rather than flattening the project into "just use AES."

## Disclaimers

Unobtainium v3 is an experimental cipher lab. Raw `UN-GWM`, `UN-ROTATE`, `UN-SWAP`, and stack modes are not production encryption.

Fitting, cascade, matrix, mutation, certificate, stencil, cutout, triad-mix, and steganography work are research branches. They must not be presented as proof of compression, secrecy, authenticity, tamper resistance, safe key evolution, or production security.

`UN-MATRIX-MUTATE` is explicit, deterministic, replayable, bounded, and commitment-backed only. `UN-MATRIX-MUTATE-SIGNED` adds signer intent over committed recipes only. `UN-MATRIX-COMBINE` adds pure committed tiled combine recipes only. `UN-MATRIX-COMBINE-SIGNED` adds signer intent over committed combine recipes only. `UN-CERT` adds split validation certificate objects and Sprint 28 validation-only cutout bindings only. `UN-CUTOUT` / `UN-STENCIL` adds committed region descriptors only. `UN-TRIAD-MIX` adds deterministic feature extraction only; contextual dependency is not cryptographic uncertainty, and more feature mixing does not automatically mean more security. Signing does not make hidden mutation acceptable and does not prove secrecy, strength, authenticity of a real-world identity, authorization, safe key evolution, certificate authority trust, asymmetric encryption, or production authentication. Matrix combine remains explicit, deterministic, replayable, and commitment-backed. Combining public/private-looking tiles does not create real asymmetric cryptography, certificates prove only that supplied material satisfies a committed validation relationship, and cutout-bound certificate verification proves only that supplied hidden spans and payloads satisfy committed reconstruction checks. Cutout descriptors are not secure redaction by themselves, and public payloads may leak information through size, position, structure, fill patterns, labels, metadata, and surrounding context. Secure redaction, redaction/unredaction workflows, N-dimensional angle math, matrix mutation integration for triad mixing, GWM integration, stack integration, cascade integration, transform instruction emission, CLI/file wrappers, and browser playground work remain future scope.

Generation and residual relations are reconstruction tools. A residual may be the same size as the target, and diagnostics such as residual score or estimated JSON size are not compression metrics.

Side demo repositories are archaeology and playground inspiration. They do not override this repository's v3 docs and tests.
