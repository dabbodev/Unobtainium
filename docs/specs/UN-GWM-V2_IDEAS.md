# UN-GWM-V2 Ideas

Status: Sprint 40 source point commitment and opt-in triad stream generation utilities. `UN-GWM-V2` is a proposed future opt-in geometric walk mask mode powered by the existing `UN-TRIAD-MIX` feature, instruction-channel, stream, adapter, and transform-proof pipeline. Sprint 38 was docs-only. Sprint 39 added committed descriptor object helpers only. Sprint 40 adds ordered source point commitments and an explicit helper that derives a `UN-TRIAD-MIX` stream commitment from supplied points and walk options for `UN-GWM-V2` descriptors only; it does not implement default `UN-GWM-V2` behavior, does not change existing `UN-GWM`, does not change legacy runtime behavior, and does not add runtime feature behavior.

`UN-GWM-V2` is experimental deterministic transformation machinery. It is not production cryptography, not authenticated encryption, not asymmetric cryptography, not identity proof, not ownership proof, not secure redaction, not compression, not steganography, not tamper-proofing, and not production-safe cryptography.

## Purpose

`UN-GWM-V2` is a future explicit opt-in geometric walk mask mode. Its design goal is to use the existing `UN-TRIAD-MIX` pipeline as a successor path for ordered triad-as-instruction-cell experiments without replacing the current `UN-GWM` path.

The mode should make the future boundary clear:

- `UN-GWM` remains the v1/default legacy-compatible v3 geometric walk path.
- `UN-GWM-V2` would be a separate mode with its own format marker, version marker, descriptor shape, payload commitment, and test-vector surface.
- A caller would have to explicitly request `UN-GWM-V2` through a future API call or a future stack recipe that names the mode.
- No existing instruction stream, stack, cascade, certificate, cutout, CLI/file, browser, or legacy runtime path should silently start using triad transforms.

The research purpose is key-as-mechanism exploration: ordered geometry, deterministic walks, triadic instruction/control machinery, and committed transformation descriptions. It is not a claim that raw geometric masks are safe for production security use.

## Relationship to Existing UN-GWM

Existing `UN-GWM` behavior remains unchanged. Existing instruction stream behavior remains unchanged. Existing tests for `UN-GWM`, root package import behavior, and legacy runtime behavior must continue to pass unchanged.

Future `UN-GWM-V2` work must use a new format, version, and mode marker. It must not reinterpret existing `UN-GWM` streams, mutate existing instruction stream meaning, or migrate callers by default. There is no default migration from `UN-GWM` to `UN-GWM-V2`.

A future implementation must be explicitly requested by API call or stack recipe. Examples of acceptable future trigger shapes are:

- a direct descriptor creation call such as `createGwmV2Descriptor(...)`;
- a future stack layer that names `mode: "UN-GWM-V2"` and an explicit `format`/`version`;
- a future test helper that constructs a `UN-GWM-V2` descriptor for deterministic vectors.

Implicit triggers are not acceptable. Existing `UN-GWM`, current instruction streams, default stack layers, cascade reports, certificate validation, cutout descriptors, CLI/file paths, browser paths, and legacy runtime paths must not begin consuming `UN-TRIAD-MIX` output unless a later sprint explicitly requests and tests that integration.

## Proposed Mode Shape

A future `UN-GWM-V2` descriptor should be a plain-data object with a canonical payload and a domain-separated mode commitment. Conceptual fields:

```javascript
{
  format: GWM_V2_FORMAT,
  version: GWM_V2_VERSION,
  mode: "UN-GWM-V2",
  sourcePointCommitment: "hex commitment for external or separately committed point material",
  walkOptions: {
    // point/shift/gap start, horizon, count, walk mode, ring/window settings
  },
  triadStreamCommitment: "hex commitment to the ordered UN-TRIAD-MIX stream",
  adapterPlanCommitment: "hex commitment to the future adapter plan",
  transformProofCommitment: "optional hex commitment to an isolated proof object",
  context: {
    // optional deterministic context, labels, bounds, payload length, or metadata
  },
  metadata: {
    // optional caller-facing notes that are included only if canonicalized
  },
  descriptorCommitment: "domain-separated commitment over the canonical GWM-V2 descriptor payload"
}
```

Sprint 40 defines the first source point set commitment helper for supplied ordered 3D points. Source point commitments are deterministic integrity/check artifacts over the normalized ordered point payload, not proof of secrecy, key strength, identity, ownership, production authentication, authorization, secure redaction, compression, steganography, asymmetric cryptography, or production-safe cryptography. Ordered point identity matters: changing a coordinate, reordering points, changing point count, or changing the point payload format/version changes the source point commitment.

`descriptorCommitment` binds format, version, mode, source point commitment, walk options, triad stream commitment, adapter plan commitment, optional transform proof commitment, context, and metadata. It excludes the `descriptorCommitment` field itself.

## Sprint 39 Pure Descriptor Utilities

Sprint 39 adds `packages/core/src/gwm-v2.js` with first-pass helpers for deterministic `UN-GWM-V2` descriptor objects:

- `GWM_V2_FORMAT` and `GWM_V2_VERSION`;
- `createGwmV2Descriptor()`;
- `normalizeGwmV2Descriptor()`;
- `gwmV2Payload()`;
- `gwmV2Commitment()`;
- `assertGwmV2Descriptor()`.

The Sprint 39 descriptor format is `UN-GWM-V2-DESCRIPTOR`, version `1`, with mode `UN-GWM-V2`. Required fields are source point commitment, walk options, triad stream commitment, and adapter plan commitment. `transformProofCommitment` is optional and canonicalizes to `null` when absent. `context` and `metadata` are optional canonical plain-data objects and canonicalize to `{}` when absent.

Walk options are descriptor identity, not executable walk state in this sprint. `point`, `shift`, and `gap` are required non-negative safe integers and allow zero. Optional `horizon` and `ring` are positive safe integers when supplied. Supplied walk option values are preserved in the descriptor payload; Sprint 39 does not normalize them through point-count modulo behavior because it does not know or inspect a point set.

Descriptor commitments are deterministic integrity/check artifacts for reproducibility, diagnostics, and exact-shape validation. They are not proof of secrecy, identity, ownership, production authentication, authorization, secure redaction, tamper-proofing, compression, steganography, asymmetric cryptography, or production-safe cryptography.

Sprint 39 does not create triad streams, adapter plans, or transform proofs automatically. It does not derive triad streams from points. It does not adapt streams to instruction plans. It does not apply transform proofs. It does not apply `UN-ROTATE`, `UN-SWAP`, or permutation transforms.

## Sprint 40 Source Points and Triad Streams

Sprint 40 adds opt-in helpers for deriving `UN-GWM-V2` descriptor commitments from supplied ordered source points:

- `assertGwmV2SourcePoints()` validates and normalizes ordered 3D source points using the same `[x, y, z]` and `{ x, y, z }` point forms and finite-number rules as `UN-TRIAD-MIX`.
- `gwmV2SourcePointPayload()` and `gwmV2SourcePointCommitment()` create deterministic source point payloads and domain-separated SHA-256 commitments.
- `createGwmV2TriadStream()` validates source points and Sprint 39 walk options, then uses the existing `UN-TRIAD-MIX` walk stream helper to emit a deterministic triad instruction stream and stream commitment.
- `createGwmV2DescriptorFromPoints()` creates a `UN-GWM-V2` descriptor bound to the derived source point commitment and triad stream commitment.

Sprint 40 requires at least three source points for triad stream generation and uses distinct walk selection when adapting `UN-GWM-V2` walk options to the existing `UN-TRIAD-MIX` walk stream helper. `point`, `shift`, and `gap` remain required non-negative safe integers and may be zero. Optional `horizon` and `ring` remain positive safe integers; `horizon` controls the generated triad count when supplied, and `ring` is included in the stream context when supplied.

Sprint 40 does not apply `UN-ROTATE`, `UN-SWAP`, or permutation transforms. It does not generate adapter plans automatically, does not apply transform proofs, and does not create transform proofs. `createGwmV2DescriptorFromPoints()` requires a supplied `adapterPlanCommitment` and only accepts an optional supplied `transformProofCommitment`.

Existing `UN-GWM` remains unchanged. Future adapter/proof integration must remain explicit and opt-in. Stack, cascade, certificate, cutout, CLI/file wrapper, browser, default runtime, matrix mutation, and `UN-ND` integration remain future scope. More triadic feature mixing does not automatically mean more security.

Existing `UN-GWM` remains unchanged. Future implementation must be explicit and opt-in. Stack, cascade, certificate, cutout, CLI/file wrapper, browser, default runtime, matrix mutation, and `UN-ND` integration remain future scope. More triadic feature mixing does not automatically mean more security.

## Pipeline Stages

A future `UN-GWM-V2` pipeline should be explicit, ordered, and test-vector-friendly:

1. Ordered points: normalize or validate the source point set, or validate the declared point commitment.
2. Walk schedule: derive the deterministic point walk from explicit options such as start state, horizon, count, ring/window settings, and walk mode.
3. Ordered triads: select ordered triads from the point walk. Triad order is part of mode identity.
4. Triad feature extraction: use existing `UN-TRIAD-MIX` feature extraction for point, edge, whole-triangle, order, and optional walk-context material.
5. Instruction-channel emission: emit deterministic rotate/value, position, rule/mix, and explain/debug descriptor channels.
6. Triad stream descriptor: package ordered channel records into a `UN-TRIAD-MIX-STREAM` descriptor and stream commitment.
7. Adapter instruction plan: translate stream records into an explicit adapter plan commitment, preserving skipped or unsupported records.
8. Optional transform proof: when requested by tests or research callers, bind an isolated proof object that applies and reverses supported descriptors through existing helper conventions.
9. Future opt-in transform application: only a later explicit mode implementation may apply transforms to caller payloads, and only when the caller requests `UN-GWM-V2`.

Each stage should have a declared input, output, validation contract, and commitment boundary. Hidden mutation of walk state, point sets, stack recipes, matrices, certificates, cutouts, or payload data is outside the mode shape.

## Versioning and Compatibility

Existing `UN-GWM` should be treated as the v1/default legacy-compatible v3 path. Its behavior, instruction stream format, and runtime integration remain unchanged.

`UN-GWM-V2` has its own explicit descriptor constants and payload format as of Sprint 39. Future code should avoid overloaded names or boolean switches that make a v1 call behave like v2. Sprint 39 implements descriptor creation, payload, commitment, normalization, and assertion helpers only.

Future instruction stream integration must be additive. If a future stack or transform path supports `UN-GWM-V2`, it should add a new explicit mode branch rather than changing the meaning of existing `UN-GWM`, `UN-ROTATE`, `UN-SWAP`, `UNSTACK`, cascade, certificate, cutout, CLI/file, browser, or legacy runtime paths.

Existing tests must continue to pass unchanged. A future implementation should include explicit unchanged-behavior tests for `UN-GWM` and root package export behavior.

## Security Framing

`UN-GWM-V2` is experimental. It is not production cryptography.

Triadic feature mixing does not automatically mean more security. Contextual dependency is deterministic and should not be marketed as cryptographic uncertainty. More channels, matrices, dimensions, signatures, commitments, or descriptor layers do not automatically improve security.

`UN-GWM-V2` should be described as deterministic transformation machinery for key-as-mechanism exploration. Commitments support reproducibility, diagnostics, and exact-shape validation; they are not a proof of secrecy, authentication, authorization, ownership, identity, secure redaction, compression, steganography, tamper-proofing, or production-safe encryption.

If future production safety is ever desired, it should be handled by a separate sealed construction with authentication, stable serialization, misuse boundaries, reviewable security goals, and external cryptographic review.

## Test-Vector Strategy

Future implementation tests must prove deterministic behavior and compatibility boundaries before any transform path is trusted:

- same points, options, and context produce the same mode commitment;
- changing point order changes output, stream commitment, adapter commitment, proof commitment when present, or mode commitment;
- changing walk options changes output or commitment;
- changing the triad stream changes output or commitment;
- adapter plans are deterministic for the same stream and adapter context;
- opt-in `UN-GWM-V2` mode does not change existing `UN-GWM`;
- transform proof roundtrips remain isolated and reversible;
- malformed points, walk options, stream descriptors, adapter plans, context, metadata, and proof descriptors are rejected;
- no legacy runtime behavior changes;
- root `require("./")` continues to return the legacy `Unobtainium` constructor;
- generated descriptors defensively copy caller-supplied points, options, context, and metadata where the existing core patterns expect defensive copies.

Tests should prefer exact descriptor fields, commitments, and validation errors over brittle prose assertions.

## Future API Sketch

Sprint 40 implements the pure descriptor and source-point stream subset below. Adapter-plan creation and transform application remain future scope.

```javascript
const GWM_V2_FORMAT = "UN-GWM-V2-DESCRIPTOR";
const GWM_V2_VERSION = 1;

function assertGwmV2SourcePoints(points) {}
function gwmV2SourcePointPayload(points) {}
function gwmV2SourcePointCommitment(points) {}
function createGwmV2TriadStream(points, walkOptions, context) {}
function createGwmV2DescriptorFromPoints(points, options) {}
function createGwmV2Descriptor(options) {}
function gwmV2Payload(descriptor) {}
function gwmV2Commitment(payloadOrDescriptor) {}
function assertGwmV2Descriptor(descriptor) {}
```

Future naming should distinguish payload creation, commitment calculation, validation, stream generation, adapter plan generation, and transform application. Transform application, if ever added, should use a separate explicit helper name rather than hiding work inside descriptor creation.

## Non-Goals

- Sprint 39 implements pure descriptor utilities only.
- Sprint 40 implements source point commitments and opt-in triad stream descriptor generation only.
- No changes to legacy runtime.
- No changes to root package export behavior.
- No changes to existing `UN-GWM`.
- No default `UN-GWM-V2`.
- No default triad stream derivation from points.
- No stream-to-instruction-plan adaptation.
- No transform proof application.
- No changes to existing instruction stream behavior.
- No default transform integration.
- No stack integration.
- No cascade integration.
- No certificate integration.
- No cutout or stencil integration.
- No CLI work.
- No file wrapper work.
- No browser work.
- No `UN-ND`.
- No matrix mutation integration.
- No hidden key-state evolution.
- No default migration from `UN-GWM`.
- No production cryptographic claims.

## Roadmap

Suggested future slices:

- Sprint 39: added `UN-GWM-V2` pure descriptor utilities only.
- Sprint 40: added opt-in `UN-GWM-V2` source point commitments and triad stream generation from point walks.
- Sprint 41: opt-in `UN-GWM-V2` adapter/transform proof integration tests.
- Later: explicit stack integration only if requested.

Each future slice should preserve legacy runtime behavior, keep `UN-GWM` unchanged unless explicitly requested, and keep security framing conservative.
