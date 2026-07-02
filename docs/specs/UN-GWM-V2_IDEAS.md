# UN-GWM-V2 Ideas

Status: Sprint 47 static mock-data/demo architecture checkpoint. `UN-GWM-V2` is an explicit experimental wrapper around the existing descriptor, source-point commitment, triad stream commitment, supplied adapter-plan binding, optional supplied transform-proof binding, and opt-in mode wrapper utilities. Sprint 46 added a future visual/demo bridge plan in `docs/specs/UN-GWM-V2_VISUAL_DEMO_IDEAS.md`; Sprint 47 adds static fixture/data-shape architecture and `docs/examples/gwm-v2-visual-demo-fixture.json` only. It does not implement default `UN-GWM-V2` behavior, does not add a default migration from `UN-GWM`, does not change existing `UN-GWM`, does not change legacy runtime behavior, and does not add runtime feature behavior.

`UN-GWM-V2` is experimental deterministic transformation machinery. It is not production cryptography, not authenticated encryption, not asymmetric cryptography, not identity proof, not ownership proof, not secure redaction, not compression, not steganography, not tamper-proofing, and not production-safe cryptography.

## Purpose

`UN-GWM-V2` is an explicit opt-in geometric walk mask experiment. Its design goal is to use the existing `UN-TRIAD-MIX` pipeline as a successor path for ordered triad-as-instruction-cell experiments without replacing the current `UN-GWM` path.

The mode should make the future boundary clear:

- `UN-GWM` remains the v1/default legacy-compatible v3 geometric walk path.
- `UN-GWM-V2` is a separate mode with its own format marker, version marker, descriptor shape, payload commitment, and test-vector surface.
- A caller must explicitly request `UN-GWM-V2` through the Sprint 44 mode wrapper API or through a future stack recipe that names the mode.
- No existing instruction stream, stack, cascade, certificate, cutout, CLI/file, browser, or legacy runtime path should silently start using triad transforms.

The research purpose is key-as-mechanism exploration: ordered geometry, deterministic walks, triadic instruction/control machinery, and committed transformation descriptions. It is not a claim that raw geometric masks are safe for production security use.

## Sprint 46 Visual/Demo Bridge Plan

Sprint 46 adds a docs-only plan for a future explanatory visual/demo bridge in `docs/specs/UN-GWM-V2_VISUAL_DEMO_IDEAS.md`. The planned bridge is a playground for showing the "3D hex Enigma-like" thought experiment and making key-as-mechanism visible through ordered points, walk options, selected triads, feature extraction, instruction channels, stream descriptors, adapter descriptors, isolated proof roundtrips, and explicit mode commitments.

The plan is not an implementation. It does not add browser code, CLI code, file wrappers, WebGL/canvas code, transform behavior, stack/cascade/cert/cutout integration, or changes to `UN-GWM`. Any future demo must describe deterministic mechanics and commitments rather than promise secrecy, must label raw modes as experimental, and must not present more geometry, triads, channels, or dimensions as automatic security.

## Sprint 47 Static Demo Fixture Plan

Sprint 47 adds a static mock-data architecture layer for the future visual bridge. The fixture at `docs/examples/gwm-v2-visual-demo-fixture.json` defines a compact future demo state with `points`, `walkOptions`, `selectedTriads`, `triadFeatures`, `instructionChannels`, `triadStream`, `adapterPlan`, `transformProofSummary`, `gwmV2Descriptor`, `gwmV2Mode`, `notes`, and `securityFraming`.

The fixture separates raw inputs from derived descriptors, commitments, and explanatory summaries. It gives a future local demo stable panel inputs before any UI, browser, canvas/WebGL, file import, STL import, CLI wrapper, or runtime integration exists. The commitments are deterministic integrity/check artifacts generated from existing helper APIs; they are not proof of secrecy, production authentication, ownership, identity, secure redaction, compression, steganography, tamper-proofing, or production-safe cryptography.

Future browser work should remain local-first and opt-in. Static HTML or JSON-driven panels may come later, but the fixture itself must not become a runtime path, default `UN-GWM-V2` trigger, stack/cascade/cert/cutout integration, or migration path from existing `UN-GWM`.

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

## Sprint 44 Opt-In Mode Wrapper

Sprint 44 adds `GWM_V2_MODE_FORMAT`, `GWM_V2_MODE_VERSION`, `gwmV2ModePayload()`, `gwmV2ModeCommitment()`, `createGwmV2Mode()`, `verifyGwmV2Mode()`, and `assertGwmV2Mode()` under `packages/core/src/gwm-v2.js`. The wrapper assembles a committed `UN-GWM-V2` descriptor, descriptor commitment, source point commitment, triad stream commitment, supplied adapter plan commitment, adapter binding commitment, optional supplied transform proof commitment, optional proof binding commitment, canonical context, canonical metadata, and a mode commitment into one explicit object.

Supported creation paths are intentionally narrow:

- descriptor plus supplied adapter plan, with optional supplied transform proof;
- source points plus walk options plus supplied adapter plan, with optional supplied transform proof.

The wrapper validates and binds supplied adapter plans. When a transform proof is supplied, it validates and binds that supplied proof. Creation rejects a descriptor that declares `transformProofCommitment` when no transform proof material is supplied; `verifyGwmV2Mode()` reports that condition as a non-throwing invalid result. Sprint 44 does not generate adapter plans automatically, does not generate transform proofs automatically, does not apply transform proofs, and does not apply `UN-ROTATE`, `UN-SWAP`, or permutation transforms.

`modeCommitment` is a deterministic domain-separated SHA-256 commitment over the canonical mode payload, excluding `modeCommitment` itself. It changes when descriptor, source point, triad stream, adapter plan, transform proof, adapter binding, proof binding, context, metadata, format, or version inputs change. It is a reproducibility and exact-shape validation artifact only, not production authentication or a security proof.

The wrapper remains opt-in. It does not replace existing `UN-GWM`, does not become default behavior, and does not integrate with stack, cascade, cert, cutout, CLI/file wrappers, browser paths, root package behavior, or the legacy runtime. Future transform application remains explicit and opt-in.

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

## Sprint 41 Adapter Plan Binding

Sprint 41 adds opt-in `UN-GWM-V2` adapter-plan binding helpers for supplied `UN-TRIAD-MIX-ADAPTER` instruction plans:

- `verifyGwmV2AdapterPlan()` validates a descriptor and supplied adapter plan, computes the supplied adapter plan commitment, compares it to the descriptor's `adapterPlanCommitment`, and returns an explicit result object instead of throwing for expected mismatch cases.
- `bindGwmV2AdapterPlan()` returns a deterministic binding object when the descriptor and supplied adapter plan match.
- `createGwmV2DescriptorFromPointsAndAdapter()` derives the source point commitment and triad stream commitment from supplied points and walk options, validates a supplied adapter plan, rejects plans whose `sourceStreamCommitment` does not match the generated triad stream commitment, and creates a descriptor using the supplied plan commitment.
- `assertGwmV2AdapterBinding()` asserts the same binding relationship for callers that prefer exceptions on invalid binding.

Adapter-plan binding proves only that a supplied adapter plan matches the descriptor's committed adapter plan and source triad stream. It is an integrity/check relationship for reproducibility and diagnostics, not production authentication, not a security proof, and not proof of secrecy, identity, ownership, authorization, secure redaction, compression, steganography, asymmetric cryptography, tamper-proofing, or production-safe cryptography.

Sprint 41 does not generate adapter plans automatically from triad streams. It does not apply transform proofs. It does not apply `UN-ROTATE`, `UN-SWAP`, or permutation transforms. It does not modify existing `UN-GWM`, existing `UN-GWM` behavior, stack/cascade/cert/cutout paths, CLI/file wrappers, browser paths, default runtime behavior, or legacy runtime behavior. Future transform proof integration must remain explicit and opt-in. More triadic feature mixing does not automatically mean more security.

## Sprint 42 Transform Proof Binding

Sprint 42 adds opt-in `UN-GWM-V2` transform-proof binding helpers for supplied `UN-TRIAD-MIX-TRANSFORM-PROOF` objects:

- `verifyGwmV2TransformProof()` validates a descriptor and supplied transform proof, requires the descriptor's `transformProofCommitment` to be present and non-null, computes the supplied proof commitment, compares it to the descriptor's committed proof, checks the proof's `sourcePlanCommitment` against the descriptor's `adapterPlanCommitment`, and returns an explicit result object instead of throwing for expected mismatch cases.
- `bindGwmV2TransformProof()` returns a deterministic binding object when the descriptor and supplied transform proof match.
- `createGwmV2DescriptorFromPointsAdapterAndProof()` derives the source point commitment and triad stream commitment from supplied points and walk options, validates a supplied adapter plan, validates a supplied transform proof, rejects adapter plans whose `sourceStreamCommitment` does not match the generated stream, rejects transform proofs whose `sourcePlanCommitment` does not match the supplied adapter plan commitment, and creates a descriptor using the supplied adapter and proof commitments.
- `assertGwmV2ProofBinding()` asserts the same binding relationship for callers that prefer exceptions on invalid binding.

Transform-proof binding proves only that a supplied proof object matches the descriptor's committed transform proof and, where exposed by the proof object, the descriptor's committed adapter plan. It is an integrity/check relationship for reproducibility and diagnostics, not production authentication, not a security proof, and not proof of secrecy, identity, ownership, authorization, secure redaction, compression, steganography, asymmetric cryptography, tamper-proofing, or production-safe cryptography.

Sprint 42 does not create transform proofs automatically. It does not apply transform proofs. It does not apply `UN-ROTATE`, `UN-SWAP`, or permutation transforms. It does not generate adapter plans automatically. It does not modify existing `UN-GWM`, existing `UN-GWM` behavior, stack/cascade/cert/cutout paths, CLI/file wrappers, browser paths, default runtime behavior, or legacy runtime behavior. Future runtime/default integration must remain explicit and opt-in. More triadic feature mixing does not automatically mean more security.

## Sprint 43 Consolidation and Mode-Readiness

Sprint 43 is a checkpoint over the Sprint 38-42 `UN-GWM-V2` arc. The current implemented surface has descriptor utilities, source point commitments, opt-in triad stream generation from supplied points and walk options, supplied adapter-plan binding, and supplied transform-proof binding.

The readiness boundary is intentionally narrow. Existing `UN-GWM` remains unchanged. There is no default migration from `UN-GWM` to `UN-GWM-V2`. There is no default `UN-GWM-V2` mode, no automatic adapter plan generation, no automatic transform proof generation, no transform proof application, no transform application, no CLI/file wrapper behavior, and no browser playground behavior.

Sprint 44 implements the true explicit opt-in `UN-GWM-V2` mode wrapper as a versioned mode object and API trigger. Sprint 45 verifies that descriptor/source/stream/binding/proof-binding/wrapper surface is coherent and commit-ready. Runtime transform application, default behavior, and stack/CLI/browser integration remain future scope rather than being hidden inside descriptor or wrapper creation.

## Pipeline Stages

A future `UN-GWM-V2` pipeline should be explicit, ordered, and test-vector-friendly:

1. Ordered points: normalize or validate the source point set, or validate the declared point commitment.
2. Walk schedule: derive the deterministic point walk from explicit options such as start state, horizon, count, ring/window settings, and walk mode.
3. Ordered triads: select ordered triads from the point walk. Triad order is part of mode identity.
4. Triad feature extraction: use existing `UN-TRIAD-MIX` feature extraction for point, edge, whole-triangle, order, and optional walk-context material.
5. Instruction-channel emission: emit deterministic rotate/value, position, rule/mix, and explain/debug descriptor channels.
6. Triad stream descriptor: package ordered channel records into a `UN-TRIAD-MIX-STREAM` descriptor and stream commitment.
7. Adapter instruction plan: bind a supplied adapter plan commitment, preserving skipped or unsupported records in that supplied plan.
8. Optional transform proof: when requested by tests or research callers, bind a supplied isolated proof object to the descriptor's committed transform proof without creating or applying the proof.
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

Sprint 44 confirms the pure descriptor, source-point stream, supplied adapter-plan binding, supplied transform-proof binding, and true opt-in mode wrapper subset below. Adapter-plan creation, transform proof creation, transform proof application, and transform application remain separate explicit calls or future scope.

```javascript
const GWM_V2_FORMAT = "UN-GWM-V2-DESCRIPTOR";
const GWM_V2_VERSION = 1;

function assertGwmV2SourcePoints(points) {}
function gwmV2SourcePointPayload(points) {}
function gwmV2SourcePointCommitment(points) {}
function createGwmV2TriadStream(points, walkOptions, context) {}
function createGwmV2DescriptorFromPoints(points, options) {}
function verifyGwmV2AdapterPlan(descriptor, adapterPlan) {}
function bindGwmV2AdapterPlan(descriptor, adapterPlan) {}
function createGwmV2DescriptorFromPointsAndAdapter(points, walkOptions, adapterPlan, options) {}
function assertGwmV2AdapterBinding(descriptor, adapterPlan) {}
function verifyGwmV2TransformProof(descriptor, transformProof) {}
function bindGwmV2TransformProof(descriptor, transformProof) {}
function createGwmV2DescriptorFromPointsAdapterAndProof(points, walkOptions, adapterPlan, transformProof, options) {}
function assertGwmV2ProofBinding(descriptor, transformProof) {}
const GWM_V2_MODE_FORMAT = "UN-GWM-V2-MODE";
const GWM_V2_MODE_VERSION = 1;
function gwmV2ModePayload(mode) {}
function gwmV2ModeCommitment(payloadOrMode) {}
function createGwmV2Mode(input) {}
function verifyGwmV2Mode(mode) {}
function assertGwmV2Mode(mode) {}
function createGwmV2Descriptor(options) {}
function gwmV2Payload(descriptor) {}
function gwmV2Commitment(payloadOrDescriptor) {}
function assertGwmV2Descriptor(descriptor) {}
```

Future naming should distinguish payload creation, commitment calculation, validation, stream generation, adapter plan generation, and transform application. Transform application, if ever added, should use a separate explicit helper name rather than hiding work inside descriptor creation.

## Non-Goals

- Sprint 39 implements pure descriptor utilities only.
- Sprint 40 implements source point commitments and opt-in triad stream descriptor generation only.
- Sprint 41 implements supplied adapter-plan binding for `UN-GWM-V2` descriptors only.
- Sprint 42 implements supplied transform-proof binding for `UN-GWM-V2` descriptors only.
- Sprint 43 is consolidation and mode-readiness only.
- Sprint 44 implements a true opt-in mode wrapper only.
- Sprint 45 is consolidation and commit-readiness only.
- No changes to legacy runtime.
- No changes to root package export behavior.
- No changes to existing `UN-GWM`.
- No default `UN-GWM-V2`.
- No default migration from `UN-GWM`.
- No default triad stream derivation from points.
- No automatic stream-to-instruction-plan adaptation.
- No automatic adapter plan generation.
- No automatic transform proof generation.
- No transform proof application.
- No transform application.
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
- Sprint 41: added opt-in `UN-GWM-V2` adapter-plan binding for supplied adapter plans only.
- Sprint 42: added opt-in `UN-GWM-V2` transform-proof binding for supplied transform proofs only.
- Sprint 43: consolidated exports, result shapes, descriptor-chain tests, and docs for mode-readiness only.
- Sprint 44: added a true explicit opt-in `UN-GWM-V2` mode wrapper that assembles and verifies committed descriptor, adapter-binding, and optional proof-binding relationships without applying transforms or adding runtime integration.
- Sprint 45: verifies the Sprint 38-44 descriptor/source/stream/binding/proof-binding/mode-wrapper arc for exports, result shapes, docs, tests, and repo hygiene without adding runtime behavior.
- Sprint 46: adds `docs/specs/UN-GWM-V2_VISUAL_DEMO_IDEAS.md` as a docs-only plan for a future local explanatory visual/demo bridge, without browser implementation, CLI/file wrappers, transform behavior, GWM behavior changes, or runtime integration.
- Sprint 47: adds static mock-data/demo architecture documentation plus `docs/examples/gwm-v2-visual-demo-fixture.json`, without UI, CLI/file wrappers, WebGL/canvas, new transform behavior, runtime integration, or existing `UN-GWM` changes.
- Later: explicit transform application and stack integration only if requested.

Each future slice should preserve legacy runtime behavior, keep `UN-GWM` unchanged unless explicitly requested, and keep security framing conservative.
