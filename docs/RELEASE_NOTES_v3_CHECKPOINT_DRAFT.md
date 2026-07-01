# Unobtainium v3 Checkpoint Draft

Status: Sprint 45 consolidation and commit-readiness checkpoint for the Sprint 38-44 `UN-GWM-V2` arc.

This checkpoint covers the current v3 lab modules under `packages/core` and the supporting docs. It does not change the legacy root runtime, does not replace existing `UN-GWM`, does not add default runtime integration for the triad pipeline, and does not add a default `UN-GWM-V2` mode.

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

## Repo Hygiene and Framing

- Sprint 22-23 aligned package metadata, license framing, and generated/dependency artifact hygiene.
- Root package import still returns the legacy `Unobtainium` constructor.
- Existing `UN-GWM` behavior remains unchanged.
- Default `UN-GWM-V2` behavior, default migration from `UN-GWM`, default triad integration, transform application, CLI/file wrappers, browser playground behavior, stack/cascade/cert/cutout integration for triad proof output, and `UN-ND` remain future scope.

## Security Framing

Unobtainium v3 is an experimental geometry-key transformation lab and computational thought experiment. Raw v3 modes are not production cryptography, secure encryption, authenticated encryption, asymmetric cryptography, identity proof, ownership proof, secure redaction, compression, steganography, tamper-proofing, homomorphic behavior, or production authentication.

## Validation Snapshot

- `npm test`: 778 passing tests on 2026-07-01.
- Acceptance floor: at least 778 tests.
- Legacy runtime files `unobtainium.js` and root `index.js` are intentionally unchanged for this checkpoint.
- Generated `.un` outputs, `out/*.un`, dependency trees, logs, temp files, and `node_modules/` should remain untracked.
