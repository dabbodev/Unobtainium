# Unobtainium v3 Checkpoint Draft

Status: Sprint 54 checkpoint reproducibility and release hygiene for the Sprint 0-53 experimental lab history.

This checkpoint covers the current v3 lab modules under `packages/core`, the supporting docs, and a minimal static fixture viewer. Sprint 54 corrects the Sprint 0-53 history, strengthens non-production framing, makes Git-index tests context-aware, and repairs the dependency lockfile within the existing declared ranges. It is cleanup and validation work only. It does not change the legacy root runtime, replace existing `UN-GWM`, add default runtime integration for the triad pipeline, add a default `UN-GWM-V2` mode, or implement live core execution, CLI/file wrappers, WebGL/canvas surfaces, file upload/import, generated-data bridges, dependencies, or new transform behavior.

## Matrix, Certificate, and Cutout Work

- Sprint 19-21 added `UN-MATRIX`, `UN-MATRIX-MUTATE`, and `UN-MATRIX-MUTATE-SIGNED` helpers for deterministic matrix descriptors, explicit mutation recipes, commitments, and signer-intent envelopes over committed mutation payloads.
- Sprint 24-25 added `UN-MATRIX-COMBINE` and `UN-MATRIX-COMBINE-SIGNED` helpers for deterministic tiled combine recipes and signer-intent envelopes over committed combine payloads.
- Sprint 26-28 added `UN-CERT`, `UN-CUTOUT` / `UN-STENCIL`, and validation-only certificate bindings for committed cutout descriptors and supplied hidden spans.
- These modules are experimental recipe, validation, descriptor, and data-transformation primitives. Certificates and commitments prove only committed validation relationships in this lab context.

## Triad Pipeline Work

- Sprint 30 documented `UN-TRIAD-MIX` / future `UN-GWM-V2` ideas.
- Sprint 31-33 added deterministic triad feature extraction, instruction-channel descriptors, and opt-in stream descriptors.
- Sprint 34 added opt-in triad adapter descriptors that translate stream records into rotate/swap descriptor objects without applying transforms.
- Sprint 35 added an isolated opt-in transform proof helper that applies supported adapter descriptors through existing reversible helper APIs and proves reverse roundtrip.
- Sprint 36 consolidated triad docs, exports, and tests while keeping default integration as future scope.

## GWM-V2 Readiness Work

- Sprint 38 defined the `UN-GWM-V2` descriptor and future explicit opt-in mode boundary in docs only.
- Sprint 39 added pure committed descriptor utilities.
- Sprint 40 added source point commitments and opt-in triad stream generation from supplied points and walk options.
- Sprint 41 added supplied adapter-plan binding for descriptors only.
- Sprint 42 added supplied transform-proof binding for descriptors only.
- Sprint 43 checks exports, result shapes, descriptor-chain readiness, and docs for those layers.
- Sprint 44 adds a true opt-in `UN-GWM-V2` mode wrapper that assembles and verifies committed descriptor, supplied adapter binding, and optional supplied proof binding relationships. It does not generate adapter plans, generate transform proofs, apply transform proofs, apply transforms, replace existing `UN-GWM`, become default behavior, or add runtime integration.
- Sprint 45 verifies exports, verification result shapes, docs, tests, root export behavior, and repo hygiene for the Sprint 38-44 arc. It is commit-readiness work only and adds no new runtime feature behavior.
- Sprint 46 adds `docs/specs/UN-GWM-V2_VISUAL_DEMO_IDEAS.md`, a docs-only plan for a future explanatory visual/demo bridge over ordered point clouds, selected triads, features, instruction channels, stream records, adapter plans, isolated proof roundtrips, and descriptor/mode commitments.
- Sprint 47 adds static mock-data/demo architecture documentation plus `docs/examples/gwm-v2-visual-demo-fixture.json`. The fixture is small, deterministic, readable, and intended for future local JSON-driven panels only.
- Sprint 48 adds a lightweight validation checkpoint for that static fixture. The checkpoint validates parseability, top-level shape, non-production framing, and absence of `.un` output-path references without treating the fixture as a security test vector.
- Sprint 49 adds a minimal static demo scaffold specification only. The spec defines future local/static file layout, panel responsibilities, fixture-field mapping, fixture-first loading, exact safety label concepts, local-first constraints, and suggested future implementation slices. It does not create browser files or implement HTML/CSS/JS.
- Sprint 50 adds a minimal static local fixture viewer under `demo/gwm-v2-visual/`. The scaffold renders overview/safety, ordered points, walk options, selected triads, triad features, rotate/position/rule channels, triad stream, adapter plan, transform proof summary, and GWM-V2 descriptor/mode commitment panels from the checked-in fixture only.
- Sprint 51 refines the existing static fixture viewer's ordered point list, walk option, selected triad, and triad feature panels. It makes source point order, deterministic walk inputs, ordered `A`/`B`/`C` triad records, source point references, and single-point/pairwise-edge/whole-triangle feature summaries easier to inspect while remaining fixture-only.
- Sprint 52 refines the existing static fixture viewer's triad stream, adapter plan, transform proof, and GWM-V2 descriptor/mode commitment panels. It makes record order, feature/instruction commitments, rotate/position/rule summaries, adapter rotate/swap descriptor summaries, skipped/warning fields, isolated proof commitments, and explicit opt-in wrapper commitments easier to inspect while remaining fixture-only.
- Sprint 53 verifies the visual demo scaffold, fixture, lightweight tests, docs, and staging state for commit readiness. It keeps the demo static, local, fixture-only, and non-production.

## Repo Hygiene and Framing

- Sprint 22 aligned package metadata, license framing, and repository hygiene.
- Sprint 23 removed tracked dependency trees and generated `.un` artifacts and added checks intended to prevent their return.
- Sprint 54 makes those Git-index checks explicit about whether tracked state can actually be determined.
- Root package import still returns the legacy `Unobtainium` constructor.
- Existing `UN-GWM` behavior remains unchanged.
- Default `UN-GWM-V2` behavior, default migration from `UN-GWM`, default triad integration, transform application, CLI/file wrappers, browser playground state management, WebGL/canvas implementation, file import, STL import, stack/cascade/cert/cutout integration for triad proof output, and `UN-ND` remain future scope.
- A local generated-data bridge remains future scope and is not part of this checkpoint.
- `mustache` remains declared and locked for this checkpoint. No checked-in use was found outside package metadata, so removal is deferred to a future package-cleanup sprint.

## Security Framing

Unobtainium v3 is an experimental geometry-key transformation lab and computational thought experiment. The future visual/demo bridge, Sprint 47 fixture, Sprint 50 static scaffold, Sprint 51-52 panel refinements, and Sprint 53 consolidation are explanatory playground material for the "3D hex Enigma-like" idea, not production tools. Sprint 53 keeps the demo static and fixture-only; the fixture is not a security test vector. Raw v3 modes are not production cryptography, secure encryption, authenticated encryption, asymmetric cryptography, identity proof, ownership proof, secure redaction, compression, steganography, tamper-proofing, homomorphic behavior, or production authentication. Fixture commitments are integrity/check artifacts, not proof of secrecy.

## Validation Context

### Full Git Checkout

- On 2026-07-11, `npm ci --ignore-scripts` completed, `npm audit --omit=dev` reported zero known vulnerabilities, and `npm ls --depth=0` reported a clean top-level dependency tree.
- `npm test` discovered 788 tests: 788 passed, none failed, and none were skipped. The Git-index hygiene assertions ran in this context.
- The root import returned `function Unobtainium`.
- `git ls-files node_modules`, `git ls-files 'out/*.un'`, and `git ls-files '*.un'` returned no tracked paths.
- Staged and unstaged diffs for legacy runtime files `unobtainium.js` and root `index.js` were empty.

### Source Archive Without `.git`

- In an external archive-like copy with no `.git` metadata, `npm ci --ignore-scripts` completed and `npm test` discovered 788 tests: 785 passed, none failed, and 3 were skipped.
- The only skips were the three Git-index assertions. Each reported: `Git-index assertion skipped: tracked state cannot be verified without Git metadata.`
- All normal legacy runtime, v3 core, package metadata, fixture, and static-demo tests still ran.
- A source archive can validate its included files and runtime behavior, but it cannot establish tracked-file state, staged state, or commit-relative diffs.
