# Unobtainium v3 Checkpoint Draft

Status: Sprint 53 static visual demo consolidation checkpoint for future `UN-GWM-V2` / `UN-TRIAD-MIX` visual demo planning.

This checkpoint covers the current v3 lab modules under `packages/core`, the supporting docs, and a minimal static fixture viewer. Sprint 53 consolidates the Sprint 46-52 static visual demo arc for commit readiness only. It does not change the legacy root runtime, does not replace existing `UN-GWM`, does not add default runtime integration for the triad pipeline, does not add a default `UN-GWM-V2` mode, and does not implement live core execution, CLI/file wrappers, WebGL/canvas surfaces, file upload/import, generated-data bridges, dependencies, or new transform behavior.

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

- Sprint 22-23 aligned package metadata, license framing, and generated/dependency artifact hygiene.
- Root package import still returns the legacy `Unobtainium` constructor.
- Existing `UN-GWM` behavior remains unchanged.
- Default `UN-GWM-V2` behavior, default migration from `UN-GWM`, default triad integration, transform application, CLI/file wrappers, browser playground state management, WebGL/canvas implementation, file import, STL import, stack/cascade/cert/cutout integration for triad proof output, and `UN-ND` remain future scope.
- A local generated-data bridge remains future scope and is not part of Sprint 53.

## Security Framing

Unobtainium v3 is an experimental geometry-key transformation lab and computational thought experiment. The future visual/demo bridge, Sprint 47 fixture, Sprint 50 static scaffold, Sprint 51-52 panel refinements, and Sprint 53 consolidation are explanatory playground material for the "3D hex Enigma-like" idea, not production tools. Sprint 53 keeps the demo static and fixture-only; the fixture is not a security test vector. Raw v3 modes are not production cryptography, secure encryption, authenticated encryption, asymmetric cryptography, identity proof, ownership proof, secure redaction, compression, steganography, tamper-proofing, homomorphic behavior, or production authentication. Fixture commitments are integrity/check artifacts, not proof of secrecy.

## Validation Snapshot

- `npm test`: 783 passing tests on 2026-07-05 after refining the second-half static visual demo panels.
- Acceptance floor: at least 783 tests.
- Legacy runtime files `unobtainium.js` and root `index.js` are intentionally unchanged for this checkpoint.
- Generated `.un` outputs, `out/*.un`, dependency trees, logs, temp files, and `node_modules/` should remain untracked.
