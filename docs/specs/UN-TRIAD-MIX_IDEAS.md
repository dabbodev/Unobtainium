# UN-TRIAD-MIX / UN-GWM-V2 Ideas

Status: Sprint 45 consolidation and commit-readiness checkpoint after the Sprint 31-35 triad pipeline work, Sprint 38 `UN-GWM-V2` design specification, Sprint 39 pure `UN-GWM-V2` descriptor utilities, Sprint 40 source point commitment plus opt-in triad stream generation utilities, Sprint 41 supplied adapter-plan binding utilities, Sprint 42 supplied transform-proof binding utilities, Sprint 43 `UN-GWM-V2` consolidation/readiness checks, and Sprint 44 true opt-in `UN-GWM-V2` mode wrapper. `UN-TRIAD-MIX` now has pure feature extraction utilities, pure multi-channel instruction emission utilities, an opt-in triad instruction stream descriptor under `packages/core/src/triad-mix.js`, an opt-in adapter under `packages/core/src/triad-adapter.js` that translates stream records into rotate/swap descriptor objects, and an isolated proof helper under `packages/core/src/triad-transform-proof.js` that can apply supported adapter descriptors through existing reversible transform helpers when explicitly called. `packages/core/src/gwm-v2.js` assembles descriptor/source/stream/binding/proof-binding relationships into an explicit opt-in mode wrapper only. Sprint 45 adds no default runtime feature behavior and does not replace or modify existing `UN-GWM`; existing `UN-GWM` behavior remains unchanged. It does not change legacy runtime behavior, existing instruction streams, stack/cascade/cert/cutout integration, CLI behavior, browser behavior, or file behavior.

`UN-TRIAD-MIX` is experimental deterministic feature extraction and instruction-channel description. It is not production cryptography, not cryptographic randomness, not authenticated encryption, not asymmetric cryptography, not secure redaction, not compression, not steganography, not tamper-proofing, and not a production-safe cipher claim.

## Purpose

`UN-TRIAD-MIX` is an opt-in successor research path for first-point-heavy geometric mask generation. The current geometric walk chooses an ordered point triple, but the value path can be dominated by a primary point while the other two points mainly provide contextual angle behavior. `UN-GWM-V2` should instead treat the ordered triad itself as the instruction cell.

Sprint 31 implemented the deterministic bundle of point, edge, triangle, order, and optional walk-context features. Sprint 32 adds deterministic descriptor emission for rotate/value, position, rule/mix, and explain/debug channels. Sprint 33 wraps ordered channel records into a standalone `UN-TRIAD-MIX-STREAM` descriptor with a stream commitment. Sprint 34 adds a pure opt-in adapter from those stream descriptors to existing-style rotate/swap instruction descriptor objects. Sprint 35 adds an opt-in testable proof wrapper that uses adapter output to drive existing reversible rotate and swap helpers in memory. These channels, streams, adapter plans, and proof objects remain isolated from default transform runtimes.

This is deterministic feature extraction, deterministic instruction-channel emission, and deterministic stream creation, not randomness. Identical inputs, options, walk context, stream context, and triad order reproduce identical feature payloads, instruction-channel payloads, stream payloads, and commitments. Contextual dependency should not be marketed as cryptographic uncertainty. More feature mixing does not automatically mean more security. Any future transform that consumes emitted instructions remains responsible for reversibility and bounds.

## Design Principles

- Ordered geometry matters. `A -> B -> C` is not interchangeable with `A -> C -> B`, `B -> A -> C`, or any other ordering.
- Every emitted instruction should materially depend on all three points, or on pairwise and whole-triangle relationships derived from all three points.
- Triads should reduce first-point dominance by avoiding rules where point A alone can determine the main output channel.
- The same coordinates in a different order should be able to produce different instruction material.
- The generator may be non-reversible when it only emits instructions. Downstream transforms must remain reversible when their contracts require reversibility.
- All behavior must be deterministic, replayable, bounded, and test-vector-friendly.
- No hidden mutation. Feature extraction and instruction emission should not mutate meshes, walk state objects, matrix descriptors, packets, stack recipes, or payload data.
- Degenerate geometry must be explicit. Degenerate triads should produce declared degenerate feature values or rejected output, not `NaN` or accidental fallback behavior.

## Feature Families

Feature extraction keeps feature groups visible so test vectors can explain which part of the triad influenced the payload. Sprint 31 exposed point, edge, triangle, and optional walk-context material. Sprint 32 uses those helpers to emit descriptor channels without duplicating feature extraction logic and without producing executable `UN-ROTATE`, `UN-SWAP`, or permutation instructions. Sprint 33 uses the same helpers to build ordered stream records without replacing existing `UN-GWM` streams. Sprint 34 translates those records into rotate/swap descriptor objects. Sprint 35 proves those descriptors can drive existing reversible helpers only when a caller explicitly uses the transform proof helper.

### Single-Point Features

Single-point features are coordinate-derived values from each ordered point:

- point A coordinate sums, differences, products, parity, signs, magnitudes, and bounded projections;
- point B coordinate sums, differences, products, parity, signs, magnitudes, and bounded projections;
- point C coordinate sums, differences, products, parity, signs, magnitudes, and bounded projections;
- per-point normalized or fixed-point forms when the input is already normalized by existing v3 point helpers.

Single-point features should not be used in isolation for emitted instruction-channel material unless another feature from B, C, an edge, the whole triangle, or walk state also participates.

### Pairwise Features

Pairwise features are edge-derived values from the ordered edges:

- `AB`: vector delta, length-like signature, coordinate deltas, coordinate sums, parity, and direction sign material;
- `BC`: vector delta, length-like signature, coordinate deltas, coordinate sums, parity, and direction sign material;
- `CA`: vector delta, length-like signature, coordinate deltas, coordinate sums, parity, and direction sign material.

The edge cycle should preserve order. `AB`, `BC`, and `CA` describe the closed ordered traversal `A -> B -> C -> A`; reversing the traversal can change signs, orientation, selected mixes, or channel values.

### Whole-Triangle Features

Whole-triangle features are derived from the triad as a unit:

- angle bucket or degenerate bucket;
- centroid-like signature such as bounded combinations of `(A + B + C)`;
- orientation or sign where the coordinate space supports a stable orientation relation;
- perimeter-like values from the three edge signatures;
- area-like values where the dimensional setting and degeneracy rules make that stable;
- shape class or spread diagnostics that distinguish collapsed, skinny, balanced, or broad triangles.

These features should be deterministic and bounded. Any floating-point-derived value should be normalized into a stable integer or bucket before it is used in emitted instruction material.

### Walk-State Features

Walk-state features connect the triad to its stream position:

- walk index or instruction index;
- horizon or repeat-period diagnostics;
- ring length and selected point indexes;
- current point, shift, gap, or successor schedule;
- optional shift or point schedule values that explain how the next triad is selected.

Walk-state features should diversify repeated geometry without hiding mutable state. The emitted explain/debug channel should be able to record the walk inputs that affected an instruction.

### Future Matrix or Mutation Context

Matrix, N-dimensional, or mutation-derived context is future-only. Sprint 32 does not define matrix integration, N-dimensional angle implementation, matrix mutation integration, or hidden key-state evolution.

If future matrix material participates, it should enter through explicit descriptors or committed context. Matrix rows-as-points, tile commitments, mutation recipe commitments, or certificate bindings must not be silently folded into GWM behavior.

## Channel Model

`UN-TRIAD-MIX` now includes a first-pass multi-channel instruction descriptor emitter. Sprint 32 descriptors include `rotate`, `position`, `rule`, and `explain` channels plus a domain-separated instruction-channel commitment.

### Rotate / Value Channel

The rotate/value channel emits bounded value material suitable for future `UN-ROTATE` use. Sprint 32 does not call or apply `UN-ROTATE`. The channel records a bounded `delta`, deterministic `direction`, `ring`, source feature names, and selected mix pattern. If no ring is supplied, the descriptor uses the documented default ring `256`; emitted deltas stay within ring bounds.

### Swap / Position Channel

The position channel emits bounded position material suitable for future `UN-SWAP`, pair-swap plans, or future permutation plans. Sprint 32 does not call or apply `UN-SWAP`. When `span` or `payloadLength` is supplied in context, emitted indexes stay within that bound. When no bound is supplied, the channel emits a deterministic abstract seed with `null` indexes and an explain note.

### Rule / Mix Channel

The rule/mix channel selects deterministic mixing patterns. It uses feature commitments, point summaries, edge summaries, triangle summaries, and context to pick a named pattern. The selected pattern is recorded by ID so test vectors can assert the selection without re-deriving prose behavior.

### Explain / Debug Channel

The explain/debug channel emits stable diagnostic material for deterministic tests and inspection. Sprint 32 records the feature commitment, selected pattern, point-order sensitivity flag, degenerate flag, and compact notes without dumping all feature internals.

The debug channel is not a security disclosure boundary. If future sealed formats hide key material, they should not expose raw debug details in production artifacts.

### Future-Only Channels

Potential future channels include gate hints, cutout hints, certificate hints, cascade hints, or stack policy hints. These are future-only and are not integrated by Sprint 33. Hints must not be described as authorization, secure redaction, identity proof, ownership proof, or production authentication.

## Sprint 33 Stream Descriptor

Sprint 33 adds a standalone `UN-TRIAD-MIX-STREAM` descriptor. A stream contains a format/version marker, normalized context, ordered records, and a domain-separated stream commitment. Each record preserves its index, normalized triad, triad feature commitment, triad instruction commitment, and deterministic rotate, position, rule, and explain channel summaries.

Direct stream creation accepts an ordered array of raw or normalized triads. Empty streams are rejected so every stream commitment identifies at least one record. A walk adapter can also select ordered triads from points with the existing walk helpers, but it remains a thin opt-in adapter and does not alter existing `UN-GWM` generation.

`triadStreamPayload` returns the canonical stream payload excluding the top-level stream commitment. `triadStreamCommitment` hashes that canonical payload with stream-specific domain separation. Triad order is part of stream identity: changing a triad, reordering triads, changing context, changing emitted channel material, or changing the stream format/version changes the commitment.

Sprint 33 emits stream descriptors only. It does not apply `UN-ROTATE`, `UN-SWAP`, or permutation transforms. It does not replace or modify existing `UN-GWM`. Future transform integration must be opt-in through a new adapter or wrapper.

## Sprint 34 Adapter Descriptor

Sprint 34 adds a standalone `UN-TRIAD-MIX-ADAPTER` descriptor. The adapter validates a `UN-TRIAD-MIX-STREAM`, preserves record order, and emits deterministic rotate-like `UN-ROTATE` descriptor objects plus bounded swap-like `UN-SWAP` descriptor objects. It records the source stream commitment, adapter context, skipped records, and a domain-separated adapter commitment.

Adapter output is deterministic, not random. Contextual dependency should not be marketed as cryptographic uncertainty, and more feature mixing does not automatically mean more security. The adapter emits instruction descriptors only. It does not apply `UN-ROTATE`, `UN-SWAP`, pair-swap plans, or permutation transforms. It does not replace or modify existing `UN-GWM`; existing `UN-GWM` behavior remains unchanged.

When a stream record has a bounded position channel, the adapter emits a swap descriptor with `a`, `b`, `span`, and `seed` copied from the channel. When the position channel is unbounded because no `span` or `payloadLength` was supplied, the adapter skips the swap descriptor and records a deterministic warning in `skippedRecords`. Rotate descriptors preserve `delta`, `direction`, `ring`, source triad instruction commitment, source triad feature commitment, and mix pattern.

`triadAdapterPayload` returns the canonical adapter payload excluding the adapter commitment. `triadAdapterCommitment` hashes that payload with adapter-specific domain separation. Changing the source stream commitment, record order, rotate descriptors, swap descriptors, skipped records, context, format, or version changes the adapter commitment.

Future default transform integration must be opt-in through a separate explicit versioned mode and test path. N-dimensional angles, matrix mutation integration, CLI/file wrappers, browser playground work, stack/cascade/cert/cutout integration, and runtime integration remain future scope.

## Sprint 35 Transform Application Proof

Sprint 35 adds `UN-TRIAD-MIX-TRANSFORM-PROOF`, an isolated opt-in helper that consumes a validated `UN-TRIAD-MIX-ADAPTER` instruction plan and a byte-like payload. It maps supported rotate descriptors to the existing `UN-ROTATE` helper conventions, maps bounded swap descriptors to the existing `UN-SWAP` helper conventions, applies operations in deterministic source-record order, and can reverse the operations in reverse order to recover the original payload.

Transform proof output is deterministic, not random. The proof records source plan, input payload, output payload, applied operation summaries, skipped adapter records, optional context, and a domain-separated proof commitment. The proof payload excludes raw output bytes from the canonical commitment payload and commits to payload bytes through deterministic payload commitments.

Active swap descriptors must be bounded. If a position channel was unbounded, the adapter must have already moved it into `skippedRecords`; a null or unbounded swap descriptor in the active `swapInstructions` list is rejected by the proof path. A swap descriptor whose span does not match the current payload length is also rejected.

Sprint 35 does not create a production cipher mode. It does not replace or modify existing `UN-GWM`; existing `UN-GWM` behavior remains unchanged. It does not integrate with `UNSTACK`, `UN-CASCADE`, `UN-CERT`, `UN-CUTOUT`, CLI/file wrappers, browser paths, or legacy runtime. Future default integration would require a separate explicit versioned mode and tests.

## Sprint 38 UN-GWM-V2 Mode Spec

Sprint 38 adds a separate docs-only `UN-GWM-V2` mode specification in `docs/specs/UN-GWM-V2_IDEAS.md`. That document narrows the future mode boundary: `UN-GWM-V2` would be an explicit opt-in geometric walk mask mode powered by the existing `UN-TRIAD-MIX` pipeline, not a replacement for existing `UN-GWM`.

The proposed future mode has its own format/version/mode markers, source point set or point commitment, walk options, triad stream commitment, adapter plan commitment, optional transform proof commitment, optional context/metadata, and mode commitment. Existing `UN-GWM` remains the v1/default legacy-compatible v3 path. No default migration, silent behavior change, stack/cascade/cert/cutout integration, CLI/file/browser work, matrix mutation integration, or `UN-ND` work is part of Sprint 38.

`UN-GWM-V2` remains experimental deterministic transformation machinery. Triadic feature mixing does not automatically mean more security, contextual dependency is deterministic rather than cryptographic uncertainty, and more channels, matrices, or dimensions do not automatically improve security.

## Sprint 39 UN-GWM-V2 Descriptor Utilities

Sprint 39 adds pure committed `UN-GWM-V2` descriptor utilities under `packages/core/src/gwm-v2.js`. The descriptor binds format/version/mode, a source point commitment, explicit walk options, a triad stream commitment, an adapter plan commitment, optional transform proof commitment, optional context, optional metadata, and a descriptor commitment.

Sprint 39 does not create triad streams, adapter plans, or transform proofs automatically. It does not derive triad streams from points, adapt streams to instruction plans, apply `UN-ROTATE`, apply `UN-SWAP`, apply permutation transforms, or integrate with existing `UN-GWM`, stack, cascade, certificate, cutout, CLI/file, browser, default runtime, matrix mutation, or `UN-ND` paths. Existing `UN-GWM` behavior remains unchanged, and any future implementation must be explicit and opt-in.

Descriptor commitments are deterministic integrity/check artifacts for reproducibility, diagnostics, and exact-shape validation only. They do not prove secrecy, identity, ownership, production authentication, authorization, secure redaction, compression, steganography, tamper-proofing, asymmetric cryptography, or production-safe cryptography. More triadic feature mixing does not automatically mean more security.

## Sprint 40 UN-GWM-V2 Source Point Stream Utilities

Sprint 40 adds `UN-GWM-V2` source point commitment and stream generation helpers that reuse the existing `UN-TRIAD-MIX` stream machinery. The new helpers accept ordered 3D points in the same `[x, y, z]` and `{ x, y, z }` forms used by `UN-TRIAD-MIX`, normalize them deterministically, preserve point order as identity, and reject malformed, empty, or too-small source point sets.

For GWM-V2 stream generation, Sprint 40 requires at least three source points and adapts the validated Sprint 39 flat walk options into the existing triad walk helper with distinct point selection. `point`, `shift`, and `gap` are required non-negative safe integers and may be zero. Optional `horizon` and `ring` are positive safe integers; `horizon` selects the generated triad count when supplied, and `ring` is bound into stream context when supplied.

Source point commitments and triad stream commitments are deterministic integrity/check artifacts for reproducibility and diagnostics. They are not proof of secrecy, key strength, identity, ownership, production authentication, authorization, secure redaction, compression, steganography, asymmetric cryptography, tamper-proofing, or production-safe cryptography.

Sprint 40 does not apply `UN-ROTATE`, `UN-SWAP`, or permutation transforms. It does not generate adapter plans or transform proofs automatically. Descriptor creation from points requires a supplied adapter plan commitment and can only bind an optional supplied transform proof commitment. Future adapter/proof integration must remain explicit and opt-in. Existing `UN-GWM` behavior remains unchanged, and stack/cascade/cert/cutout/CLI/browser/default runtime integration remains future scope.

## Sprint 41 UN-GWM-V2 Adapter Plan Binding

Sprint 41 adds opt-in adapter-plan binding helpers for `UN-GWM-V2` descriptors only. A caller supplies a descriptor and a `UN-TRIAD-MIX-ADAPTER` instruction plan. The helper validates both objects, computes the supplied adapter plan commitment, checks it against the descriptor's `adapterPlanCommitment`, and checks that the plan's `sourceStreamCommitment` matches the descriptor's triad stream commitment.

This binding proves only that the supplied adapter plan matches the descriptor's committed adapter plan and source stream. It is a deterministic integrity/check relationship, not production authentication and not a security proof. It does not prove secrecy, identity, ownership, authorization, secure redaction, compression, steganography, asymmetric cryptography, tamper-proofing, or production-safe cryptography.

Sprint 41 does not generate adapter plans automatically from triad streams. It does not apply transform proofs. It does not apply `UN-ROTATE`, `UN-SWAP`, or permutation transforms. It does not integrate with existing `UN-GWM`, `UNSTACK`, `UN-CASCADE`, `UN-CERT`, `UN-CUTOUT`, CLI/file wrappers, browser paths, default runtime behavior, or legacy runtime behavior. Future transform proof integration must remain explicit and opt-in. More triadic feature mixing does not automatically mean more security.

## Sprint 42 UN-GWM-V2 Transform Proof Binding

Sprint 42 adds opt-in transform-proof binding helpers for `UN-GWM-V2` descriptors only. A caller supplies a descriptor and a `UN-TRIAD-MIX-TRANSFORM-PROOF` object. The helper validates both objects, requires the descriptor to carry a non-null `transformProofCommitment`, computes the supplied proof commitment, checks it against the descriptor's committed proof, and checks the proof's `sourcePlanCommitment` against the descriptor's `adapterPlanCommitment`.

This binding proves only that the supplied proof object matches the descriptor's committed transform proof. It is a deterministic integrity/check relationship, not production authentication and not a security proof. It does not prove secrecy, identity, ownership, authorization, secure redaction, compression, steganography, asymmetric cryptography, tamper-proofing, or production-safe cryptography.

Sprint 42 does not create transform proofs automatically. It does not apply transform proofs. It does not apply `UN-ROTATE`, `UN-SWAP`, or permutation transforms. It does not generate adapter plans automatically. It does not integrate with existing `UN-GWM`, `UNSTACK`, `UN-CASCADE`, `UN-CERT`, `UN-CUTOUT`, CLI/file wrappers, browser paths, default runtime behavior, or legacy runtime behavior. Future runtime/default integration must remain explicit and opt-in. More triadic feature mixing does not automatically mean more security.

## Sprint 43 UN-GWM-V2 Consolidation

Sprint 43 checks that the Sprint 38-42 `UN-GWM-V2` descriptor, source point, triad stream, supplied adapter-plan binding, and supplied transform-proof binding layers are exported, documented, and internally coherent. It is mode-readiness work only.

Existing `UN-GWM` remains unchanged. No default migration exists. The true explicit opt-in `UN-GWM-V2` mode wrapper exists only as wrapper machinery. CLI/file wrappers, browser playground behavior, transform application, and default integration remain future scope.

Sprint 43 does not generate adapter plans automatically, generate transform proofs automatically, apply transform proofs, apply `UN-ROTATE`, `UN-SWAP`, or permutation transforms, integrate with `UNSTACK`, `UN-CASCADE`, `UN-CERT`, or `UN-CUTOUT`, or add new runtime feature behavior.

## Mixing Patterns

Sprint 32 implements a small named set of deterministic, test-vector-friendly pattern concepts.

### Point-Balanced Mix

Combines bounded contributions from A, B, and C with equal structural weight. A point-balanced mix should make it easy to prove that changing any one point can change at least one channel.

### Edge-Weighted Mix

Combines features from `AB`, `BC`, and `CA`, possibly giving different channels different edge weights. The weights must be deterministic and recorded by pattern ID or explicit parameters.

### Orientation-Selected Mix

Uses orientation or sign material to choose between named sub-patterns. Orientation should select the recipe, not create hidden mutation or non-deterministic branching.

### Centroid-Coupled Mix

Combines single-point and edge features with a centroid-like signature. This helps tie channel output to the whole triad rather than a single primary point.

### Walk-Index-Coupled Mix

Couples triad features with walk index, horizon, ring, or point/shift/gap schedule values. This can distinguish repeated triads at different stream positions while remaining deterministic and replayable.

## Instruction Stream Compatibility

`UN-TRIAD-MIX` instruction-channel emission and Sprint 33 stream descriptor creation are opt-in. Existing v3 instruction streams must not change unless a new version, format, or explicit generator option is introduced.

Potential compatibility paths:

- emit existing `UN-ROTATE` instruction fields from the rotate/value channel, while adding a new format/version marker or separate generator name;
- emit `UN-SWAP` pair material or positional plan material from the swap/position channel;
- emit future `UN-PERMUTE` instruction material after permutation formats are specified;
- emit an explain/debug object beside instructions for test vectors and deterministic inspection.

Existing `UN-GWM` instruction stream generation remains its own compatibility path and is unchanged by Sprint 38. `UN-GWM-V2` should not reinterpret existing streams, silently change stack layer meaning, or alter existing transform behavior. Sprint 34's adapter is a standalone opt-in descriptor path only. Sprint 35's transform proof is a standalone opt-in application wrapper only. Sprint 38's `UN-GWM-V2` spec requires a separate explicit mode marker, payload format, and commitment boundary. Future default transform integration must be opt-in through a separate explicit versioned mode and test path.

## Test-Vector Strategy

Tests should prove deterministic feature extraction and deterministic descriptor emission before any transform integration is trusted.

Required future test properties:

- the same triad, options, walk state, and input bounds produce the same feature bundle and channel output;
- changing A changes at least one channel or declared feature digest;
- changing B changes at least one channel or declared feature digest;
- changing C changes at least one channel or declared feature digest;
- changing ordered traversal changes output when the coordinates are otherwise the same;
- changing the angle bucket changes the selected mix pattern or at least one channel output;
- future generated `UN-ROTATE` instructions stay within ring/window bounds;
- future generated `UN-SWAP` or future permutation instructions stay within payload bounds;
- degenerate triads are stable and explicit;
- downstream transform reversibility remains tested in the transform layer, not assumed from the mixer.

Sprint 31 test vectors include compact triads, expected point summaries, edge summaries, whole-triangle summaries, context commitment changes, and degenerate cases. Sprint 32 adds selected pattern IDs, emitted channel values, commitments, bounds checks, degenerate/repeated-point checks, export checks, and explain/debug output. Sprint 33 adds ordered stream records, stream commitments, context/order sensitivity, defensive-copy checks, empty-stream rejection, walk-adapter determinism, public export checks, and unchanged `UN-GWM` behavior checks. Sprint 34 adds adapter descriptor tests for rotate/swap translation, skipped unbounded position channels, commitment sensitivity, defensive-copy behavior, malformed-stream rejection, public exports, unchanged root legacy export, unchanged `UN-GWM` behavior, and no transform application. Sprint 35 adds transform proof tests for apply/reverse roundtrip, deterministic rotate/swap application, operation ordering, proof commitment sensitivity, malformed plans, unsupported descriptor types, invalid payloads, active null swap rejection, defensive-copy behavior, unchanged root legacy export, and unchanged `UN-GWM` behavior. Sprint 41 adds `UN-GWM-V2` tests for supplied adapter-plan verification, binding commitments, descriptor creation from points plus supplied adapter plans, malformed descriptor/plan handling, source-stream mismatch rejection, defensive copies, public exports, unchanged root legacy export, unchanged `UN-GWM`, and no automatic adapter generation or transform application. Sprint 42 adds supplied transform-proof binding tests. Sprint 43 adds descriptor-chain readiness and result-shape consistency checks without adding runtime integration. Tests should avoid brittle prose assertions.

## Security Framing

`UN-TRIAD-MIX` is experimental. It is not production cryptography.

More feature mixing does not automatically mean more security. N-dimensional, matrix-derived, signed, certified, cutout-bound, or mutation-derived features do not automatically mean more security. Deterministic contextual dependency should not be marketed as cryptographic uncertainty.

This is a design probe for key-as-mechanism and geometry-as-instruction. It explores whether an ordered triad can be a clearer instruction cell than a first-point-heavy mask generator. It does not prove secrecy, integrity, authentication, authorization, identity, ownership, redaction safety, compression, steganography, tamper resistance, or production-safe encryption.

If future work wants production safety, it should define a sealed construction with authentication, stable serialization, misuse boundaries, reviewable security goals, and external cryptographic review. Raw `UN-TRIAD-MIX` channels should remain lab material.

## Non-Goals

- Sprint 35 implements an isolated opt-in triad transform application proof only.
- Sprint 38 implements a docs-only `UN-GWM-V2` mode specification only.
- Sprint 39 implements pure committed `UN-GWM-V2` descriptor utilities only.
- Sprint 40 implements source point commitments and opt-in `UN-GWM-V2` triad stream descriptor generation only.
- Sprint 41 implements supplied adapter-plan binding for `UN-GWM-V2` descriptors only.
- Sprint 42 implements supplied transform-proof binding for `UN-GWM-V2` descriptors only.
- Sprint 43 is consolidation and mode-readiness only.
- Sprint 44 implements a true opt-in `UN-GWM-V2` mode wrapper only.
- Sprint 45 is consolidation and commit-readiness only.
- No changes to legacy runtime.
- No changes to root package export behavior.
- No changes to existing `UN-GWM` behavior.
- No default transform integration.
- No default `UN-GWM-V2`.
- No default migration from `UN-GWM`.
- No default triad stream creation from `UN-GWM-V2` descriptors.
- No automatic adapter plan creation from `UN-GWM-V2` descriptors.
- No automatic transform proof generation from `UN-GWM-V2` descriptors.
- No automatic transform proof application from `UN-GWM-V2` descriptors.
- No transform application from `UN-GWM-V2` descriptors.
- No production cipher mode.
- No replacement or mutation of existing instruction streams.
- No integration with existing `UN-GWM`.
- No replacement of `UN-GWM` with triad proof output.
- No integration into `UNSTACK`, `UN-CASCADE`, `UN-CERT`, `UN-CUTOUT`, gates, patches, or descriptor pipelines.
- No N-dimensional angle implementation.
- No matrix mutation integration.
- No CLI work.
- No file wrapper work.
- No browser work.
- No default transform integration.
- No new runtime feature behavior.
- No cryptographic security claims.

## Roadmap

Suggested future slices only:

- Sprint 31: added pure `UN-TRIAD-MIX` feature extraction utilities with explicit feature groups, stable degenerate handling, no transform integration, and deterministic test vectors.
- Sprint 32: added pure multi-channel instruction emission descriptors for rotate/value, position, rule/mix, and explain/debug channels while preserving existing instruction stream compatibility.
- Sprint 33: added pure opt-in `UN-TRIAD-MIX-STREAM` descriptors that package ordered triad instruction-channel records without applying transforms or changing legacy streams.
- Sprint 34: added pure opt-in `UN-TRIAD-MIX-ADAPTER` descriptors that translate triad stream records to rotate/swap descriptor objects without applying transforms or changing legacy streams.
- Sprint 35: added an isolated opt-in transform application proof that applies supported adapter rotate/swap descriptors through existing reversible helpers and proves reverse roundtrip without changing legacy streams by default.
- Sprint 38: added `docs/specs/UN-GWM-V2_IDEAS.md` as a focused docs-only specification for a future explicit opt-in `UN-GWM-V2` mode powered by the existing triad pipeline.
- Sprint 39: added `UN-GWM-V2` pure descriptor utilities.
- Sprint 40: added opt-in `UN-GWM-V2` source point commitments and triad stream generation from point walks.
- Sprint 41: added opt-in `UN-GWM-V2` adapter-plan binding for supplied adapter plans only.
- Sprint 42: added opt-in `UN-GWM-V2` transform-proof binding for supplied transform proofs only.
- Sprint 43: consolidated GWM-V2 exports, result shapes, descriptor-chain checks, and docs for mode-readiness only.
- Sprint 44: added a true explicit opt-in `UN-GWM-V2` mode wrapper that assembles and verifies committed descriptor, supplied adapter binding, and optional supplied proof binding relationships without applying `UN-ROTATE`, `UN-SWAP`, or permutation transforms.
- Sprint 45: verifies the Sprint 38-44 `UN-GWM-V2` descriptor/source/stream/binding/proof-binding/mode-wrapper arc for exports, result shapes, docs, tests, and repo hygiene without adding runtime behavior.
- Later: explicit transform application and stack integration only if requested. Default transform integration, N-dimensional angles, matrix mutation integration, CLI/file wrappers, and browser playground work remain separate future scopes.

These suggestions should be revisited against the repository state at the start of each sprint.
