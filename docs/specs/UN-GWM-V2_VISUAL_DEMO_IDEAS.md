# UN-GWM-V2 Visual Demo Ideas

Status: Sprint 47 static mock-data/demo architecture checkpoint. This document sketches a future explanatory visual/demo bridge for the `UN-GWM-V2` / `UN-TRIAD-MIX` pipeline and defines a small static fixture at `docs/examples/gwm-v2-visual-demo-fixture.json`. It does not implement browser code, CLI code, file wrappers, WebGL/canvas code, transform behavior, stack/cascade/cert/cutout integration, or changes to existing `UN-GWM`.

## Purpose

The future visual/demo bridge should be an explanatory playground, not a production tool. Its purpose is to make key-as-mechanism visible: ordered points, walks, selected triads, feature extraction, instruction channels, stream descriptors, adapter descriptors, proof descriptors, and opt-in `UN-GWM-V2` mode commitments should be inspectable as deterministic machinery.

The demo can frame Unobtainium v3 as a "3D hex Enigma-like" thought experiment: a software lab asking what it might look like if ordered 3D geometry acted like a visible mechanism for deriving deterministic instructions. The visual should emphasize the mechanism, not promise secrecy.

This bridge should explain how `UN-TRIAD-MIX` feeds `UN-GWM-V2` without replacing legacy `UN-GWM`. It should show what is committed, what is merely descriptive, and what remains future-only.

## Sprint 47 Static Fixture Architecture

Sprint 47 adds static mock-data architecture only. The fixture is intentionally small, deterministic, readable, and JSON-driven so a later demo can build panels against a stable state shape before any browser surface exists. Static data helps separate information architecture from rendering choices: the project can decide what a point panel, triad panel, channel panel, adapter panel, proof panel, and mode-wrapper panel need to display before adding HTML, canvas, WebGL, file import, or runtime integration.

The fixture is explanatory, not a security example. It is not a `.un` output, does not include generated binary blobs, and does not ask the test suite to depend on long prose or fragile generated artifacts. Its commitments are helper-generated deterministic integrity/check artifacts for describing relationships between supplied points, stream descriptors, adapter plans, proof summaries, and mode wrappers.

### Demo Data Model

The future visual demo state should keep these categories visibly separate:

- Raw inputs: `points` and `walkOptions`.
- Selected raw/derived bridge state: `selectedTriads`, which records ordered `A`, `B`, and `C` samples and point indexes for display.
- Derived descriptors: `triadFeatures`, `instructionChannels`, `triadStream`, `adapterPlan`, `transformProofSummary`, `gwmV2Descriptor`, and `gwmV2Mode`.
- Commitments/check artifacts: source point, feature, instruction, stream, adapter, proof, descriptor, binding, and mode commitments.
- Explanatory summaries: `notes` and `securityFraming`.

The fixture fields are expected to be stable panel inputs, not executable instructions for a default runtime. Future demos may regenerate them through explicit helpers, but should not silently use them to alter legacy `UN-GWM`, stacks, cascade reports, certificate/cutout paths, CLI behavior, browser behavior, or file wrappers.

### Panel Mapping

- Point cloud/list panel: `points`, `walkOptions`, and `gwmV2Descriptor.sourcePointCommitment`.
- Selected triad panel: `selectedTriads`.
- Features panel: `triadFeatures`.
- Rotate/position/rule channels panel: `instructionChannels`.
- Triad stream panel: `triadStream` plus per-record commitments in `triadFeatures` and `instructionChannels`.
- Adapter plan panel: `adapterPlan`.
- Transform proof panel: `transformProofSummary`.
- GWM-V2 descriptor/mode wrapper panel: `gwmV2Descriptor` and `gwmV2Mode`.
- Safety/framing panel: `notes` and `securityFraming`.

### Future Implementation Notes

Future browser work should be local-first. File import remains future scope. STL import remains future scope. WebGL/canvas remains future scope. Static HTML or JSON-driven panels can come later only as an explicit UI sprint. A later implementation should treat the JSON fixture as read-only explanatory state unless that sprint explicitly adds a new opt-in helper or fixture generation path.

## Non-Production Framing

Any future demo must state plainly:

- This is not production cryptography.
- The demo must not present raw Unobtainium modes as secure encryption.
- The demo should show deterministic transformation mechanics and commitments, not promise secrecy.
- More geometry, triads, channels, matrices, dimensions, signatures, cutouts, or descriptor layers do not automatically mean more security.
- Commitments are reproducibility, diagnostics, and exact-shape validation artifacts. They are not proof of secrecy, authentication, authorization, ownership, identity, secure redaction, compression, steganography, tamper-proofing, homomorphic behavior, or production-safe encryption.

The demo should use labels such as "experimental", "deterministic", "descriptor", "commitment", "roundtrip proof", and "future opt-in mode". It should avoid labels such as "secure", "military grade", "unbreakable", "authenticated", "tamper-proof", "private-key proof", "public-key proof", or "production safe".

## Demo Storyboards

### Ordered Point Cloud / Point List Panel

Shows the source point set as an ordered list and, optionally, a simple point-cloud view. The panel should make order visible with stable indexes and selected walk positions. Reordering identical coordinates should be shown as identity-changing, not as a cosmetic operation.

### Selected Triad Panel

Shows the currently selected ordered triad as `A`, `B`, and `C`. It should display the selected point indexes, normalized coordinates, and order-sensitive traversal `A -> B -> C -> A`.

### Edge / Triangle Feature Panel

Shows derived feature families: point summaries, edge summaries for `AB`, `BC`, and `CA`, whole-triangle values, degenerate status, and feature commitment. This should explain that the values are deterministic feature material, not random output.

### Angle Bucket / Mix Pattern Panel

Shows the current angle bucket or degenerate bucket and the selected mix pattern. It should connect the bucket and mix pattern to deterministic rule selection without presenting bucket complexity as a security claim.

### Rotate Channel Panel

Shows the emitted rotate/value channel: bounded delta, direction, ring, source feature names, and selected mix pattern. It should explicitly say this is descriptor material unless a separate proof/helper applies it.

### Position Channel Panel

Shows bounded swap-like position material when span or payload length is supplied, or an unbounded abstract seed when not supplied. Unbounded records should visibly become skipped adapter records rather than active swaps.

### Triad Stream Record Panel

Shows one stream record per ordered triad: record index, normalized triad, triad feature commitment, triad instruction commitment, rotate summary, position summary, rule summary, and explain summary.

### Adapter Plan Panel

Shows a supplied or fixture adapter plan as a descriptor: source stream commitment, rotate descriptors, bounded swap descriptors, skipped records, adapter context, and adapter commitment. The panel should make clear that Sprint 47 does not implement adapter generation or application.

### Isolated Proof Roundtrip Panel

Shows an isolated transform proof object from static fixture material or future explicit calls: input payload commitment, output payload commitment, operation summaries, skipped records, proof commitment, and reverse-roundtrip result. It should be labeled as deterministic reversibility evidence, not a security proof.

### GWM-V2 Descriptor / Mode Commitment Panel

Shows the `UN-GWM-V2` descriptor and mode wrapper commitment chain: source point commitment, walk options, triad stream commitment, adapter plan commitment, optional transform proof commitment, descriptor commitment, adapter binding commitment, optional proof binding commitment, and mode commitment.

## Pipeline Visualization

A future visualization can use this ordered flow:

1. Ordered points: validate and normalize the ordered source point set.
2. Walk options: show point/shift/gap, horizon, ring, and any future declared walk mode.
3. Triad selection: select ordered `A`, `B`, and `C` samples from the walk.
4. Feature extraction: derive point, edge, whole-triangle, angle bucket, degenerate, and walk-context features.
5. Instruction channels: emit rotate/value, position, rule/mix, and explain/debug descriptor channels.
6. Stream descriptors: package ordered records into a `UN-TRIAD-MIX-STREAM` descriptor and stream commitment.
7. Adapter descriptors: bind supplied adapter descriptors that translate stream records into rotate/swap descriptor objects.
8. Transform proof: display an isolated proof object and reverse-roundtrip check when supplied.
9. Opt-in GWM-V2 wrapper: display the explicit `UN-GWM-V2` descriptor and mode commitments.

Each visual step should have a visible input, output, and commitment boundary. Hidden mutation of point sets, walk state, matrices, stacks, certificates, cutouts, payload data, or legacy runtime state is out of scope.

## Legacy Demo Archaeology Alignment

Old demo concepts are useful inspiration only. They do not override this repository's v3 docs, tests, or runtime boundaries.

Potential inspirations:

- hex/ring16 shifting as a visible way to explain finite ring movement;
- visible masks that show the generated shift pattern;
- point entry and lucky point generation as lightweight input affordances;
- local file demo concepts that read from the user's device without uploading by default;
- STL and point-cloud import ideas for future point-set material.

Any future bridge should rebuild these ideas against the current repository's v3 docs and tests rather than treating old side repos as source of truth.

## Future Demo Data Model Sketch

These are future plain-data state sketches only. Sprint 47 adds one static JSON fixture and does not implement a demo runtime for them.

### Point Set State

```javascript
{
  points: [[0, 0, 0], [1, 2, 3], [4, 5, 6]],
  orderVisible: true,
  sourcePointCommitment: "hex commitment",
  warnings: []
}
```

### Walk Options State

```javascript
{
  point: 0,
  shift: 1,
  gap: 2,
  horizon: 8,
  ring: 256,
  walkMode: "distinct"
}
```

### Selected Triad State

```javascript
{
  index: 0,
  pointIndexes: { A: 0, B: 1, C: 2 },
  triad: { A: [0, 0, 0], B: [1, 2, 3], C: [4, 5, 6] }
}
```

### Triad Feature State

```javascript
{
  featureCommitment: "hex commitment",
  angleBucket: "bucket-id",
  degenerate: false,
  pointSummary: {},
  edgeSummary: {},
  triangleSummary: {}
}
```

### Instruction Channel State

```javascript
{
  rotate: { delta: 0, direction: "up", ring: 256, mixPattern: "pattern-id" },
  position: { a: 0, b: 1, span: 16, seed: "position-seed" },
  rule: { pattern: "pattern-id" },
  explain: { notes: [], pointOrderSensitive: true }
}
```

### Stream State

```javascript
{
  format: "UN-TRIAD-MIX-STREAM",
  records: [],
  streamCommitment: "hex commitment"
}
```

### Adapter Plan State

```javascript
{
  format: "UN-TRIAD-MIX-ADAPTER",
  sourceStreamCommitment: "hex commitment",
  rotateInstructions: [],
  swapInstructions: [],
  skippedRecords: [],
  adapterCommitment: "hex commitment"
}
```

### Proof State

```javascript
{
  format: "UN-TRIAD-MIX-TRANSFORM-PROOF",
  sourcePlanCommitment: "hex commitment",
  inputPayloadCommitment: "hex commitment",
  outputPayloadCommitment: "hex commitment",
  proofCommitment: "hex commitment",
  roundtrip: "passed"
}
```

### Descriptor / Mode State

```javascript
{
  mode: "UN-GWM-V2",
  sourcePointCommitment: "hex commitment",
  triadStreamCommitment: "hex commitment",
  adapterPlanCommitment: "hex commitment",
  transformProofCommitment: null,
  descriptorCommitment: "hex commitment",
  modeCommitment: "hex commitment"
}
```

## Safety and Scope Rules

Any future demo must:

- run locally if browser-based;
- avoid uploading user files by default;
- clearly label experimental outputs;
- preserve legacy runtime behavior;
- avoid claiming secure encryption or secure redaction;
- avoid silently replacing existing `UN-GWM` behavior;
- avoid default integration with stack, cascade, cert, cutout, CLI/file wrappers, or legacy runtime paths;
- use fixture data or explicit opt-in helpers when showing adapter plans and proof objects;
- keep raw debug details out of any future production-looking artifact.

## Future Implementation Roadmap

Suggested future slices only:

- Sprint 47: adds static mock-data/demo architecture documentation and a small JSON fixture only.
- Sprint 48: minimal static HTML/demo scaffold, if explicitly requested.
- Sprint 49: point/triad visualization panel.
- Sprint 50: stream/adapter/proof visualization panel.

These suggestions are not commitments. A later sprint should re-check repository state, acceptance criteria, and safety framing before implementing any demo surface.

## Non-Goals

- No browser implementation in Sprint 47.
- No CLI implementation.
- No file wrappers.
- No WebGL or canvas implementation.
- No new transform behavior.
- No changes to existing GWM behavior.
- No legacy runtime changes.
- No stack/cascade/cert/cutout integration.
- No production cryptography.
- No claims of cryptographic security, asymmetric encryption, secure redaction, ownership proof, identity proof, compression, steganography, homomorphic behavior, or production authentication.
