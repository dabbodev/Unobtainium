# UN-GWM-V2 Visual Demo Ideas

Status: Sprint 55 reproducible generated-fixture checkpoint. This document describes the explanatory local/static visual demo for the `UN-GWM-V2` / `UN-TRIAD-MIX` pipeline and the canonical fixture at `docs/examples/gwm-v2-visual-demo-fixture.json`. Sprint 50 added the minimal static viewer under `demo/gwm-v2-visual/`; Sprint 51-52 refined its fixture-backed panels; Sprint 53 consolidated the static demo arc; and Sprint 54 reconciled checkpoint history and reproducibility framing. Sprint 55 replaces the hand-curated fixture with deterministic format-v2 output from private offline Node tooling while the browser continues to render checked-in JSON only. It does not add public APIs, browser core execution, file wrappers, WebGL/canvas code, default/runtime integration, stack/cascade/cert/cutout integration, dependencies, or changes to existing `UN-GWM`.

## Purpose

The visual/demo bridge is an explanatory local/static visualization, not production tooling. Its purpose is to make key-as-mechanism visible: ordered points, walks, selected triads, feature extraction, instruction channels, stream descriptors, adapter descriptors, proof descriptors, and opt-in `UN-GWM-V2` mode commitments should be inspectable as deterministic machinery.

The demo can frame Unobtainium v3 as a "3D hex Enigma-like" thought experiment: a software lab asking what it might look like if ordered 3D geometry acted like a visible mechanism for deriving deterministic instructions. The visual should emphasize the mechanism, not promise secrecy.

This bridge should explain how `UN-TRIAD-MIX` feeds `UN-GWM-V2` without replacing legacy `UN-GWM`. It should show what is committed, what is merely descriptive, and what remains future-only.

The browser scaffold loads the checked-in fixture and never performs live generation. Sprint 55 generation is an offline developer step over a fixed non-secret sample. Neither path includes user file import, STL import, encryption claims, production-security claims, generated `.un` artifacts, runtime integration, or remote network behavior.

## Sprint 47 Static Fixture Architecture

Sprint 47 added static mock-data architecture, and Sprint 48 added a lightweight validation checkpoint around that fixture shape. Sprint 55 retains the small, readable, JSON-driven panel contract but replaces the hand-curated format-v1 file with canonical format-v2 output. The fixture records `introducedInSprint: 47`, `generatedInSprint: 55`, the stable generation context, the fixed sample length, and successful mode verification without adding volatile timestamps.

The fixture is explanatory, not a security example or security test vector. It is not a `.un` output and does not include raw input, transformed, or restored payload bytes or full runtime proof objects. Its commitments are helper-generated deterministic integrity/check artifacts for describing relationships between supplied points, stream descriptors, adapter plans, proof summaries, and mode wrappers.

### Demo Data Model

The visual demo state keeps these categories visibly separate:

- Raw inputs: `points` and `walkOptions`.
- Selected raw/derived bridge state: `selectedTriads`, which records ordered `A`, `B`, and `C` samples and point indexes for display.
- Derived descriptors: `triadFeatures`, `instructionChannels`, `triadStream`, `adapterPlan`, `transformProofSummary`, `gwmV2Descriptor`, and `gwmV2Mode`.
- Commitments/check artifacts: source point, feature, instruction, stream, adapter, proof, descriptor, binding, and mode commitments.
- Explanatory summaries: `notes` and `securityFraming`.

The fixture fields are stable panel inputs, not executable instructions for a default runtime. Sprint 55 regenerates them only through explicit private offline tooling. Neither the generator nor the viewer may silently alter legacy `UN-GWM`, stacks, cascade reports, certificate/cutout paths, CLI behavior, browser behavior, or file wrappers.

### Sprint 50 Static Scaffold

Sprint 50 creates the minimal static demo scaffold:

- `demo/gwm-v2-visual/index.html`
- `demo/gwm-v2-visual/styles.css`
- `demo/gwm-v2-visual/demo.js`
- `demo/gwm-v2-visual/README.md`

The scaffold renders fixture data only from `../../docs/examples/gwm-v2-visual-demo-fixture.json` when served from the repository root. It does not fetch remote data, upload user data, import files, parse STL, call runtime transforms, create `.un` outputs, or mutate legacy runtime state.

### Sprint 51 Panel Refinement

Sprint 51 keeps the same static fixture-only implementation and improves readability in the existing viewer:

- Ordered point list panel: displays source order, stable point references, compact coordinates, walk-start marking, and source point commitment framing.
- Walk options panel: displays fixture walk fields as deterministic demo inputs, without implying randomness or security.
- Selected triads panel: displays ordered `A`, `B`, and `C` nodes, source point indexes, point references, coordinates, and the order-sensitive `A -> B -> C` path.
- Feature extraction panel: groups fixture-backed feature summaries into single-point, pairwise-edge, and whole-triangle sections, with deterministic extraction language and fixture commitments kept separate from security claims.

Sprint 51 does not import package core modules, generate new commitments, mutate fixture data, add file input, add dependencies, add network behavior beyond loading the local fixture, or create live transform/runtime behavior.

### Sprint 52 Second-Half Panel Refinement

Sprint 52 keeps the same static fixture-only implementation and improves the existing viewer's second-half pipeline panels:

- Triad stream panel: displays deterministic stream descriptor metadata, fixture context, stream commitment, record order/index, triad feature commitment, triad instruction commitment, and rotate/position/rule summaries.
- Adapter plan panel: displays adapter descriptor metadata, source stream binding, rotate descriptor summaries, swap descriptor summaries, skipped-record/warning fields where fixture data is available, and adapter commitment.
- Transform proof panel: displays isolated proof summary fields, input/output payload commitments, source plan commitment, applied/skipped/warning counts, proof commitment, and an operation-count summary without presenting the proof as a production cipher mode.
- GWM-V2 descriptor/mode commitment panel: displays the opt-in wrapper commitment chain for source points, triad stream, adapter plan, proof, descriptor, and mode commitments, while making clear this is not default `UN-GWM`.

Sprint 52 does not import package core modules, run live transform logic, generate commitments, mutate fixture data, add file input, add dependencies, add network behavior beyond loading the local fixture, or create CLI/file/WebGL/canvas/runtime behavior.

### Sprint 55 Reproducible Fixture Bridge

Sprint 55 adds a private Node-only `buildGwmV2VisualDemoFixture(scenario)` path outside the root and core public APIs. Its canonical scenario uses the existing four ordered points and walk options, fixed bytes `[0,1,2,3,4,5,6,7]`, context ID `gwm-v2-visual-demo-v2`, and matching metadata.

The builder composes existing public helpers in this order: GWM-V2 triad stream generation, triad adapter-plan generation, reversible plan roundtrip, GWM-V2 descriptor/mode assembly, and mode verification. It derives selected point indexes through the existing distinct-walk helpers and rejects any mismatch with the generated stream triads. Generation fails unless the payload is restored and the mode verifies.

The output projects only the fields needed by the static viewer: points, walk options, selected triads, compact feature/channel summaries, stream and adapter counts, proof summary and commitments, descriptor commitments, mode commitments, provenance notes, and security framing. It omits raw payload bytes, transformed/restored bytes, applied operation bodies, full adapter instructions, and full runtime proof objects.

From the repository root, `npm run demo:gwm-v2:generate` rewrites only the canonical fixture after successful construction. `npm run demo:gwm-v2:check` performs no writes and exits nonzero when checked-in bytes differ from canonical two-space JSON with LF endings and a final newline. The browser calls neither command and continues to fetch the checked-in JSON fixture only.

### Panel Mapping

- Overview / safety framing panel: explains the local/static fixture scope and displays safety labels.
- Ordered point list panel: displays ordered source points, stable point references, compact coordinates, source order, walk-start marking, and the source point commitment.
- Triad selection panel: displays selected ordered `A`, `B`, and `C` samples, selected point indexes, and record order.
- Feature extraction panel: displays triad feature records grouped as single-point, pairwise-edge, and whole-triangle summaries, plus angle buckets, degeneracy flags, mix patterns, source feature families, and feature commitments.
- Rotate channel panel: displays per-record rotate deltas, directions, rings, and mix patterns from the instruction channel records.
- Position channel panel: displays per-record position fields, bounded spans, and deterministic seeds from the instruction channel records.
- Rule/mix channel panel: displays per-record rule material, angle buckets, degeneracy flags, and mix patterns.
- Triad stream panel: displays stream format/version, record count, context, stream commitment, record order/index, feature/instruction commitments, and rotate/position/rule summaries.
- Adapter plan panel: displays adapter descriptor format/version, source stream commitment, rotate/swap/skipped counts, rotate descriptor summaries, swap descriptor summaries, warning/skipped fields where available, and adapter commitment.
- Transform proof panel: displays transform-proof summary fields, source plan/input/output/proof commitments, applied/skipped/warning counts, and deterministic roundtrip framing as an isolated proof summary only.
- GWM-V2 descriptor/mode commitment panel: displays descriptor fields, source point/stream/adapter/proof/descriptor/mode commitment chain, adapter/proof binding commitments, and explicit opt-in mode wrapper framing.

### Fixture Mapping

| Fixture field | Panel use |
| --- | --- |
| `fixture` | Overview / safety framing panel: fixture format/version, Sprint 47 introduction, Sprint 55 generation, stable generation context, fixed sample length, raw-byte omission, purpose, and verified status. |
| `points` | Ordered point list panel: source point rows and visible order. |
| `walkOptions` | Ordered point list panel and triad selection panel: point/shift/gap/horizon/ring walk context. |
| `selectedTriads` | Triad selection panel: ordered triad samples and point indexes. |
| `triadFeatures` | Feature extraction panel and triad stream panel: angle buckets, degenerate flags, mix patterns, summaries, and feature commitments. |
| `instructionChannels` | Rotate, position, and rule/mix channel panels; triad stream panel for instruction commitment references. |
| `triadStream` | Triad stream panel: stream descriptor metadata, context, record count, and stream commitment. |
| `adapterPlan` | Adapter plan panel: adapter descriptor metadata, source stream binding, operation counts, skipped count, and adapter commitment. |
| `transformProofSummary` | Transform proof panel: proof metadata, payload commitments, operation counts, warnings, skipped count, and proof commitment. |
| `gwmV2Descriptor` | GWM-V2 descriptor/mode commitment panel: descriptor metadata and descriptor commitment chain. |
| `gwmV2Mode` | GWM-V2 descriptor/mode commitment panel: adapter binding, proof binding, and mode commitment. |
| `notes` | Overview / safety framing panel: explanatory scope notes. |
| `securityFraming` | Overview / safety framing panel: non-production flags and disallowed claim categories. |

The spec intentionally does not require exact generated commitment values in prose. The viewer displays fixture-provided values as data instead of copying them into narrative documentation.

### Safety Labels

The Sprint 50 UI includes these visible label concepts:

- "Experimental"
- "Not production cryptography"
- "Deterministic demonstration"
- "No security guarantee"
- "Local/static fixture"
- "No file upload"

### Local-First Constraints

This scaffold should:

- run from static files;
- avoid network calls except loading the local fixture;
- avoid uploading user data;
- avoid bundling generated `.un` artifacts;
- use the checked-in fixture rather than live browser-generated data;
- not modify legacy runtime behavior;
- not replace or silently alter existing `UN-GWM`;
- not add CLI/file wrapper behavior as part of the scaffold.

### Future Implementation Notes

Future browser work should remain local-first. File import remains future scope. STL import remains future scope. WebGL/canvas remains future scope. Live browser-generated state remains future scope. Sprint 55's generated-data bridge is private offline Node tooling; the browser continues to treat the JSON fixture as read-only explanatory state.

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

## Implementation History and Future Work

Completed visual-demo slices and remaining future work:

- Sprint 47: added static mock-data/demo architecture documentation and a small JSON fixture only.
- Sprint 48: validated the static fixture shape only; no browser demo, CLI/file wrapper, WebGL/canvas code, runtime integration, or new transform behavior.
- Sprint 49: defined the minimal static scaffold specification only; no browser files, HTML/CSS/JS implementation, CLI/file wrapper, WebGL/canvas code, runtime integration, or new transform behavior.
- Sprint 50: created minimal static scaffold files with fixture rendering only.
- Sprint 51: refined point, walk, triad, and feature presentation in the static fixture viewer only.
- Sprint 52: refined stream, adapter, proof, and descriptor/mode commitment presentation in the static fixture viewer only.
- Sprint 53: consolidated the Sprint 46-52 static visual demo files, fixture, tests, docs, and staging hygiene for commit readiness only.
- Sprint 54: reconciled checkpoint history, non-production framing, lockfile reproducibility, and Git/source-archive validation context without adding demo behavior.
- Sprint 55: added deterministic private offline generation and no-write drift checking for the canonical format-v2 fixture while preserving the static read-only browser viewer.
- Future: optionally add live browser-generated state only through a separately specified opt-in sprint.

These suggestions are not commitments. A later sprint should re-check repository state, acceptance criteria, and safety framing before implementing any demo surface.

## Non-Goals

- No live browser playground state management in Sprint 55.
- No live browser or public runtime generated-data bridge; Sprint 55 generation is private offline developer tooling for the fixed fixture only.
- No file import or STL import in Sprint 55.
- No CLI implementation.
- No file wrappers.
- No WebGL or canvas implementation.
- No new transform behavior.
- No changes to existing GWM behavior.
- No legacy runtime changes.
- No stack/cascade/cert/cutout integration.
- No production cryptography.
- No claims of cryptographic security, asymmetric encryption, secure redaction, ownership proof, identity proof, compression, steganography, homomorphic behavior, or production authentication.
