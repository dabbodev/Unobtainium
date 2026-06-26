# UN-TRIAD-MIX / UN-GWM-V2 Ideas

Status: Sprint 32 first-pass implementation. `UN-TRIAD-MIX` now has pure feature extraction utilities and pure multi-channel instruction emission utilities under `packages/core/src/triad-mix.js`. Sprint 32 emits instruction-channel descriptors only. It does not apply `UN-ROTATE`, `UN-SWAP`, or permutation transforms, and it does not change legacy runtime behavior, existing `UN-GWM` behavior, instruction streams, stack/cascade/cert/cutout integration, CLI behavior, browser behavior, or file behavior.

`UN-TRIAD-MIX` is experimental deterministic feature extraction and instruction-channel description. It is not production cryptography, not cryptographic randomness, not authenticated encryption, not asymmetric cryptography, not secure redaction, not compression, not steganography, not tamper-proofing, and not a production-safe cipher claim.

## Purpose

`UN-TRIAD-MIX` is an opt-in successor research path for first-point-heavy geometric mask generation. The current geometric walk chooses an ordered point triple, but the value path can be dominated by a primary point while the other two points mainly provide contextual angle behavior. `UN-GWM-V2` should instead treat the ordered triad itself as the instruction cell.

Sprint 31 implemented the deterministic bundle of point, edge, triangle, order, and optional walk-context features. Sprint 32 adds deterministic descriptor emission for rotate/value, position, rule/mix, and explain/debug channels. These channels describe possible future transform parameters; they are not applied transforms and they are not integrated into any current transform runtime.

This is deterministic feature extraction and deterministic instruction-channel emission, not randomness. Identical inputs, options, and walk context reproduce identical feature payloads, instruction-channel payloads, and commitments. Contextual dependency should not be marketed as cryptographic uncertainty. More feature mixing does not automatically mean more security. Any future transform that consumes emitted instructions remains responsible for reversibility and bounds.

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

Feature extraction keeps feature groups visible so test vectors can explain which part of the triad influenced the payload. Sprint 31 exposed point, edge, triangle, and optional walk-context material. Sprint 32 uses those helpers to emit descriptor channels without duplicating feature extraction logic and without producing executable `UN-ROTATE`, `UN-SWAP`, or permutation instructions.

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

Potential future channels include gate hints, cutout hints, certificate hints, cascade hints, or stack policy hints. These are future-only and are not integrated by Sprint 32. Hints must not be described as authorization, secure redaction, identity proof, ownership proof, or production authentication.

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

`UN-TRIAD-MIX` instruction-channel emission is opt-in. Existing v3 instruction streams must not change unless a new version, format, or explicit generator option is introduced.

Potential compatibility paths:

- emit existing `UN-ROTATE` instruction fields from the rotate/value channel, while adding a new format/version marker or separate generator name;
- emit `UN-SWAP` pair material or positional plan material from the swap/position channel;
- emit future `UN-PERMUTE` instruction material after permutation formats are specified;
- emit an explain/debug object beside instructions for test vectors and deterministic inspection.

Existing `UN-GWM` instruction stream generation remains its own compatibility path and is unchanged by Sprint 32. `UN-GWM-V2` should not reinterpret existing streams, silently change stack layer meaning, or alter existing transform behavior. Future integration must be opt-in through a new instruction stream version or explicit wrapper.

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

Sprint 31 test vectors include compact triads, expected point summaries, edge summaries, whole-triangle summaries, context commitment changes, and degenerate cases. Sprint 32 adds selected pattern IDs, emitted channel values, commitments, bounds checks, degenerate/repeated-point checks, export checks, and explain/debug output. Tests should avoid brittle prose assertions.

## Security Framing

`UN-TRIAD-MIX` is experimental. It is not production cryptography.

More feature mixing does not automatically mean more security. N-dimensional, matrix-derived, signed, certified, cutout-bound, or mutation-derived features do not automatically mean more security. Deterministic contextual dependency should not be marketed as cryptographic uncertainty.

This is a design probe for key-as-mechanism and geometry-as-instruction. It explores whether an ordered triad can be a clearer instruction cell than a first-point-heavy mask generator. It does not prove secrecy, integrity, authentication, authorization, identity, ownership, redaction safety, compression, steganography, tamper resistance, or production-safe encryption.

If future work wants production safety, it should define a sealed construction with authentication, stable serialization, misuse boundaries, reviewable security goals, and external cryptographic review. Raw `UN-TRIAD-MIX` channels should remain lab material.

## Non-Goals

- Sprint 32 implements pure instruction-channel descriptor emission only.
- No changes to legacy runtime.
- No changes to root package export behavior.
- No changes to existing `UN-GWM` behavior.
- No transform application.
- No integration with existing instruction streams.
- No integration with existing `UN-GWM`.
- No `UN-ROTATE`, `UN-SWAP`, or permutation transform application.
- No integration into `UNSTACK`, `UN-CASCADE`, `UN-CERT`, `UN-CUTOUT`, gates, patches, or descriptor pipelines.
- No N-dimensional angle implementation.
- No matrix mutation integration.
- No CLI work.
- No file wrapper work.
- No browser work.
- No new runtime feature behavior.
- No cryptographic security claims.

## Roadmap

Suggested future slices only:

- Sprint 31: added pure `UN-TRIAD-MIX` feature extraction utilities with explicit feature groups, stable degenerate handling, no transform integration, and deterministic test vectors.
- Sprint 32: added pure multi-channel instruction emission descriptors for rotate/value, position, rule/mix, and explain/debug channels while preserving existing instruction stream compatibility.
- Sprint 33: add an opt-in instruction stream version or transform integration tests that prove bounds and downstream reversibility without changing legacy streams by default.

These suggestions should be revisited against the repository state at the start of each sprint.
