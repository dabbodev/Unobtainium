# Unobtainium v3 Roadmap

Status: planning document for an experimental cipher lab. Raw v3 modes are not production encryption. Fitting, cascade, matrix, certificate, stencil, and steganography branches are research directions, not compression or security claims.

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

## Near-Term Recommended Sprints

- Demo archaeology docs complete: finish documenting side demos as reference material and keep the authority boundary clear.
- v3 browser playground planning: design a browser-only playground that rebuilds old demo affordances using v3 abstractions.
- `UN-CASCADE` descriptor/reconstruction follow-up: sketch how external generated data, descriptors, and final residual material could support reconstruction workflows without turning cascade reports into compression or carrier formats.
- `UN-MATRIX` follow-up design: refine combine, certificate, stack integration, signed mutation envelope, and N-dimensional geometry boundaries after the Sprint 19 and Sprint 20 pure utilities.
- `UN-ND` docs-only design: define N-dimensional point support and angle derivation without changing existing 3D helpers.

## Medium-Term Sprints

- `UN-MATRIX-COMBINE`: combine equal-sized matrix keys through explicit 2x2 tiling recipes with transforms and commitments.
- `UN-CERT`: split validation certificates that bind public and secret key tiles through signed combine recipes.
- Signed mutation envelopes: signer intent and provenance around committed `UN-MATRIX-MUTATE` recipes.
- `UN-STENCIL` / `UN-CUTOUT`: overlay and cutout design for original-vs-shifted layers with context-bound XOR stencil material.
- v3 CLI/file wrappers: file and command wrappers around already specified v3 primitives, without changing legacy API behavior.

## Long-Term / Experimental

- `UN-CASCADE`: candidate search, optimization, and richer reconstruction descriptor workflows remain future scope.
- `UN-STEG`: geometric steganography branch for carrying packet, stack, or descriptor material in carrier media.
- Matrix ratchets: deterministic key-state evolution over matrix material with signed transition records and explicit policy. Sprint 20 mutation recipes do not provide automatic or safe key evolution by themselves.
- Stream/session mode: explicit session state, packet commitments, frame counters, and replay/misuse boundaries.
- Hybrid crypto envelope: wrap v3 experimental material inside standard authenticated encryption instead of presenting raw modes as secure encryption.

## Disclaimers

Unobtainium v3 is an experimental cipher lab. Raw `UN-GWM`, `UN-ROTATE`, `UN-SWAP`, and stack modes are not production encryption.

Fitting, cascade, matrix, mutation, certificate, stencil, cutout, and steganography work are research branches. They must not be presented as proof of compression, secrecy, authenticity, tamper resistance, safe key evolution, or production security.

`UN-MATRIX-MUTATE` is explicit, deterministic, replayable, bounded, and commitment-backed only. Signed mutation envelopes, matrix combine, certificates, N-dimensional angle math, GWM integration, stack integration, cascade integration, CLI/file wrappers, and browser playground work remain future scope.

Generation and residual relations are reconstruction tools. A residual may be the same size as the target, and diagnostics such as residual score or estimated JSON size are not compression metrics.

Side demo repositories are archaeology and playground inspiration. They do not override this repository's v3 docs and tests.
