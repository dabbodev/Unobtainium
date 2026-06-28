# Unobtainium v3 Design Dossier

Status: design groundwork. This document describes a future experimental cipher lab and does not describe production-grade encryption.

## Sprint 2 Core Skeleton

Sprint 2 adds a small v3 core skeleton beside the legacy implementation under `packages/core`. It introduces deterministic helpers for finite ring rotation, integer fixed-point point normalization and serialization, triple-horizon estimates, and a minimal point/shift/gap walk state. This skeleton is intentionally separate from `unobtainium.js` and does not replace the legacy API, implement angle math, add packet formats, or make new security claims.

## Sprint 3 Mask Instructions

Sprint 3 adds the first v3 UN-GWM mask instruction generator beside the legacy runtime. The new core modules derive a deterministic instruction object from a mesh point list, walk state, ring window, minimum shift, angle buckets, and coordinate rules. The instruction records selected point indices, copied point values, triangle angle or degenerate status, bucket and rule identifiers, raw geometry-derived shift, ring-adjusted shift, and before/after walk states.

This layer is intentionally descriptive only. It does not mutate mesh data, transform buffers or files, define point packets, add signed stacks, implement permutations or swaps, or change the legacy package API. Degenerate triples are represented explicitly through a stable degenerate bucket and fallback coordinate rule so later transform layers can decide how to handle them without receiving `NaN`.

## Sprint 4 UN-ROTATE Transform

Sprint 4 adds the first v3 transform layer beside the legacy runtime. `UN-ROTATE` consumes an instruction stream produced from Sprint 3 mask instructions and applies reversible in-memory ring rotations to arrays, `Uint8Array` instances, or Node `Buffer` instances. The transform uses each instruction's `shift` and `windowSize`, a declared direction, and an integer turn count. It does not inspect triangle geometry internals.

Instruction streams are deterministic lists of mask instructions with explicit starting and ending walk states. Generating a stream does not mutate the input mesh or input state. Applying a rotate transform does not mutate input data unless requested with a mutable option.

`UN-PERMUTE` and `UN-SWAP` remain future scope. Sprint 4 does not add filesystem transforms, packet formats, STL parsing, CLI support, signed stacks, gates, patching, generative geometry, fitting, steganography, or new cryptographic security claims.

## Sprint 5 UNPKT Point Packets

Sprint 5 adds first-pass v3 `UNPKT` point packets beside the legacy runtime. A point packet is an ordered set of deterministic fixed-point integer 3D coordinates derived from context material, nonce material, or cryptographic random bytes. Context and nonce packets are reproducible from their supplied material. Random packets use Node's cryptographic random source by default and also support deterministic byte-source injection for tests.

Point packets can be grafted onto a base mesh with append, prepend, sandwich, or none modes. The resulting effective mesh can feed the existing instruction stream and `UN-ROTATE` transform pipeline. A packet commitment records a stable SHA-256 digest over canonical packet fields so packet-derived anchored walk states can be reproduced from the packet metadata without mutating the packet.

Point packets may be public. They perturb, bind, diversify, and contextualize a private mesh, but they do not provide secrecy by themselves and are not a cryptographic security claim. Sprint 5 does not change `unobtainium.js`, the root package import, the legacy API, CLI behavior, filesystem transforms, STL parsing, signed stacks, future gate/patch/generation/fit/steganography modes, or permutation/swap layers.

## Sprint 6 UNSTACK Unsigned Transform Stacks

Sprint 6 adds first-pass v3 `UNSTACK` recipes beside the legacy runtime. An unsigned stack is a deterministic, ordered list of transform layers with stack-level metadata and a shared window size. The current implementation supports only `UN-ROTATE` layers. Each layer can use a base mesh, an optional `UNPKT` point packet graft, explicit or packet-anchored walk state, direction, turn count, minimum shift, and walk mode.

Stacks are applied in listed layer order and reversed by running the same layer recipes in reverse order. A stack layer derives its effective mesh, generates an instruction stream equal to the payload length, and applies the existing in-memory rotate transform. Stack application preserves Array, `Buffer`, and `Uint8Array` inputs where practical and does not mutate payload data unless requested through a mutable option.

Sprint 6 also defines stack canonicalization and stack commitments. Canonicalization serializes recipe objects with sorted object keys while preserving array order, excludes known runtime-only fields, and rejects unsupported values such as functions, `undefined`, non-finite numbers, symbols, and circular references. The stack commitment is a SHA-256 hex digest over the canonical stack recipe. Layer order, layer parameters, packet commitments, and stack metadata all affect the commitment.

This sprint implements unsigned stacks only. `UNSTACK-SIGNED`, signatures, `UN-PERMUTE`, `UN-SWAP`, filesystem transforms, CLI support, STL parsing, gates, patching, generative geometry, fitting, steganography, and new cryptographic security claims remain future scope.

## Sprint 7 UN-SWAP Pair-Swap Permutation

Sprint 7 adds first-pass v3 `UN-SWAP` positional permutation support beside the legacy runtime. A swap plan is generated deterministically from the existing mask instruction stream by producing two instructions per requested swap and mapping each instruction's raw shift value into a payload position. The result is an ordered list of swap pairs such as `[0, 3]`, where each pair exchanges payload positions while leaving payload values unchanged.

`UN-SWAP` is currently implemented as a standalone in-memory pair-swap transform for Array, `Uint8Array`, and Node `Buffer` inputs. Applying a swap plan runs pairs in listed order. Reversing a swap plan runs the same pairs in reverse order. Self-swaps are valid deterministic no-ops. Swap plans also have stable SHA-256 commitments over their canonical plain-data representation, including metadata and ordered swaps.

This sprint does not integrate `UN-SWAP` into `UNSTACK`. Direct function composition with `UN-ROTATE` is supported for tests and experiments, but stack recipes still accept `UN-ROTATE` layers only. Broader `UN-PERMUTE` modes such as block-local shuffle, Fisher-Yates shuffle, interleave, and braid remain future scope. Sprint 7 does not change `unobtainium.js`, the root package import, the legacy API, CLI behavior, filesystem transforms, STL parsing, signatures, signed stacks, gates, patching, generative geometry, fitting, steganography, or cryptographic security claims.

## Sprint 8 Mixed UNSTACK Rotate and Swap Layers

Sprint 8 integrates standalone `UN-SWAP` pair-swap layers into unsigned `UNSTACK` beside the existing `UN-ROTATE` stack runtime. Stack recipes can now contain ordered `UN-ROTATE` and `UN-SWAP` layers. Application runs layers in listed order, and reversal regenerates each layer's deterministic instruction stream or swap plan while undoing layers in reverse order.

`UN-ROTATE` changes payload values at their current positions. `UN-SWAP` changes the positions of payload values. Mixed stacks therefore make layer order payload-relevant, not only commitment-relevant: rotating before swapping can produce different output than swapping before rotating when per-position rotate instructions differ.

`UN-SWAP` stack layers support explicit or packet-anchored walk state, optional point-packet grafting, layer-level or stack-level window size, minimum shift, permissive or distinct walk mode, and a non-negative integer swap count. This remains the pair-swap subset only. Broader `UN-PERMUTE` modes such as block-local shuffle, Fisher-Yates shuffle, interleave, and braid remain future scope. Sprint 8 does not add signatures, `UNSTACK-SIGNED`, filesystem transforms, CLI behavior, STL parsing, gates, patching, generative geometry, fitting, steganography, or cryptographic security claims.

## Sprint 9 UNSTACK-SIGNED Recipe Envelopes

Sprint 9 adds first-pass v3 `UNSTACK-SIGNED` envelopes beside the legacy runtime. A signed stack envelope binds a normalized unsigned `UNSTACK` recipe to a signer ID, purpose, metadata, public key, signature algorithm, stack commitment, and payload commitment. The initial implementation supports Ed25519 signatures using Node's built-in `crypto` module.

The signature payload covers signed-stack format/version context, the canonical stack commitment, signer ID, purpose, metadata, and algorithm. The stack commitment still protects stack meaning: layer order, layer parameters such as turns and swap count, packet commitments, and stack metadata all affect the unsigned recipe commitment. The payload commitment is a SHA-256 digest of the canonical signature payload for diagnostics and reproducibility checks.

Sprint 9 signs stack recipes only. It does not implement scoped gates, patches, identity PKI, external certificate handling, trust policy, authorization semantics, layer signatures, gate signatures, patch signatures, filesystem transforms, CLI behavior, STL parsing, `UN-GATE`, `UNPATCH`, `UN-GEN`, `UN-FIT`, or `UN-STEG`.

Signed stacks protect recipe integrity and signer intent for the envelope. They do not make raw UN-GWM modes cryptographically secure by themselves, and they do not prove that a signer is trusted unless a future policy layer says so.

## Sprint 10 UN-GATE Scoped Validation

Sprint 10 adds first-pass v3 `UN-GATE` validation-only capability objects beside the legacy runtime. A validation gate binds an object ID, full object commitment, byte range, slice commitment, signed stack commitment, signed stack payload commitment, metadata, and gate commitment. The only supported permission is `"validate"`.

Object commitments and slice commitments are domain-separated SHA-256 hex digests over byte data plus explicit length or range metadata. The gate commitment is a SHA-256 hex digest over a canonical gate payload using the same stable object serialization used by stack commitments, excluding the `gateCommitment` field itself. Changing the object ID, range, object commitment, slice commitment, signed stack commitments, permission, or metadata invalidates the gate commitment.

Gate verification answers whether the gate metadata is intact, whether an optional supplied `UNSTACK-SIGNED` envelope matches the bound stack commitments, and whether optional supplied object bytes match the full object and scoped slice commitments. Full-data verification checks both the selected range and the whole object, so tampering outside the gated range still fails when full data is supplied.

Sprint 10 supports validation-only gates. Gates do not grant decryption, mutation rights, patch rights, or authorization beyond the literal `"validate"` permission. Merkle inclusion proofs, `UNPATCH`, mutation rights, decryption grants, external PKI, trust policy, and production authorization semantics remain future scope. Gate verification depends on the commitments supplied and does not make raw UN-GWM modes production-secure.

## Sprint 11 UNPATCH Additive Patch Objects

Sprint 11 adds first-pass v3 `UNPATCH` objects beside the legacy runtime. A patch is a committed additive delta over an exact byte/index range of ciphertext-like data. The current implementation supports only `operation: "add"` and records format/version context, object ID, range, deltas, ring window size, base object commitment, base slice commitment, optional signed-stack commitments, metadata, and a patch commitment.

Patch commitments are domain-separated SHA-256 hex digests over the canonical patch payload, excluding the `patchCommitment` field itself. Changing the object ID, operation, range, deltas, window size, base commitments, signed-stack bindings, or metadata invalidates the patch commitment. Base object and slice commitments bind the patch to the exact transformed object bytes used when the patch was created.

`UNPATCH` apply and reverse helpers operate in memory on arrays, `Uint8Array` instances, and Node `Buffer` instances. Applying an add patch adds each delta modulo the declared window size inside the bounded range. Reversing the patch subtracts the same deltas modulo the same window and should restore the pre-patch transformed data when the matching object and patch are used.

Sprint 11 is not an authorization system. Patches do not grant mutation rights, decryption rights, or policy approval by themselves. Patch signatures, patch gates or external authorization policy, Merkle inclusion proofs, filesystem or CLI patching, decryption grants, and non-add operations such as replace, delete, or move remain future scope. Controlled malleability is dangerous unless it is explicitly authorized and bounded by a higher-level policy.

## Sprint 12 UNPATCH-SIGNED Intent Envelopes

Sprint 12 adds first-pass v3 `UNPATCH-SIGNED` envelopes beside the legacy runtime. A signed patch envelope binds a committed `UNPATCH` object to a signer ID, purpose, metadata, public key, signature algorithm, patch commitment, and payload commitment. The initial implementation supports Ed25519 signatures using Node's built-in `crypto` module and reuses the same key style as signed stacks.

The signed patch payload covers signed-patch format/version context, explicit `UNPATCH-SIGNED:v1` domain separation, the patch commitment, signer ID, purpose, metadata, and algorithm. The signature signs the patch commitment rather than raw runtime objects or functions, so the existing `UNPATCH` commitment remains responsible for binding range, deltas, window size, base object commitment, base slice commitment, signed-stack bindings, operation, object ID, and patch metadata.

Sprint 12 signs patch intent only. Signed patches do not implement full authorization policy, patch gates, capability checks, decryption grants, external trust policy, Merkle inclusion proofs, filesystem patching, CLI patching, STL parsing, or non-add patch operations. A patch signature can show that a signer endorsed an exact committed patch for a stated purpose, but it does not prove that the signer is trusted or allowed to mutate an object unless a future policy layer says so.

Controlled malleability remains dangerous unless explicitly authorized and bounded by higher-level policy. Patch gates and capability checks are future scope. Patch signatures do not grant decryption. Merkle inclusion proofs and filesystem/CLI patching are future scope.

## Sprint 13 UN-KEYFILE In-Memory Key Mesh Derivation

Sprint 13 adds first-pass v3 `UN-KEYFILE` support beside the legacy runtime. `UN-KEYFILE` normalizes in-memory `Buffer`, `Uint8Array`, byte-array, or UTF-8 string input and derives deterministic ordered fixed-point 3D point triples from the normalized bytes. Optional passphrase, context, salt, label, point count, scale, and coordinate range are bound into the derivation so the same input can intentionally produce different key material in different contexts.

The first-pass key mesh descriptor records format/version, point count, scale, coordinate range, source type, optional label, input commitment, optional passphrase/context/salt commitments, ordered points, and a mesh commitment. The input commitment is a SHA-256 digest of the normalized input bytes. Optional passphrase, context, and salt commitments are SHA-256 digests over deterministic canonical material and do not expose raw values. The mesh commitment is a SHA-256 digest over the canonical descriptor fields that define the mesh, excluding `meshCommitment` itself.

Derived points are ordinary mesh arrays and can feed existing `generateInstructionStream()`, `UN-ROTATE`, `UN-SWAP`, packet grafting, and unsigned or signed stack recipes. Points are derived from normalized bytes plus derivation options; descriptor commitments also bind the declared source type. This means equivalent bytes can produce the same points while still producing different descriptors when the caller intentionally records a different source type.

`UN-KEYFILE` does not decide whether a keyfile is strong or weak. A keyfile-derived mesh is only as strong as the secrecy, unpredictability, and context of its input bytes and optional passphrase, salt, or context. Public or weak keyfiles can still be useful as context keys, demos, decoys, watermarks, puzzle keys, or reproducible test material. Sprint 13 is in-memory only: filesystem and CLI keyfile loading, keyfile storage formats beyond the in-memory descriptor, STL parsing, compression, steganography, `UN-GEN`, `UN-FIT`, and `UN-STEG` remain future scope.

## Sprint 14 UN-GEN Blank-Substrate Generation

Sprint 14 adds first-pass v3 `UN-GEN` blank-substrate generation beside the legacy runtime. A caller creates an in-memory blank substrate with a declared length, ring window, data type, and fill value, then materializes generated data by applying an existing `UNSTACK` recipe to that blank substrate. This reuses the existing `UN-ROTATE`, `UN-SWAP`, packet grafting, and keyfile-derived mesh stack behavior rather than adding a new transform family.

Sprint 14 also adds residual reconstruction helpers. Given generated data and target data in the same ring, the residual is computed position by position as `target - generated mod window`. Applying that residual reconstructs the target as `generated + residual = target mod window`. This is a reconstruction relation, not a compression claim.

`UN-GEN` is in-memory only. It does not read or write files, add CLI behavior, parse STL data, or change the legacy runtime. It does not implement fitting, optimization, search, compression, steganography, filesystem support, `UN-FIT`, `UN-CASCADE`, or `UN-STEG`. A residual may be the same size as the target and should not be described as compressed data.

## Sprint 15 UN-GEN-DESCRIPTOR Generation Manifests

Sprint 15 adds first-pass v3 `UN-GEN-DESCRIPTOR` support beside the legacy runtime. A generation descriptor is a committed in-memory manifest for the Sprint 14 reconstruction relation: generation settings plus a stack commitment or signed-stack binding produce generated data, and an optional residual can reconstruct target data from that generated data.

The descriptor commitment covers the descriptor format/version, blank-substrate length, window size, output type, fill value, stack commitment, optional signed stack payload commitment, generated commitment, optional target commitment, optional residual commitment, and metadata. It intentionally excludes the `descriptorCommitment` field itself. This lets later work validate that recipe and materialization metadata stayed stable without embedding generated, target, or residual material in the descriptor.

Sprint 15 creates committed generation manifests only. It is not compression, steganography, fitting, optimization, search, filesystem support, or CLI support. `UN-FIT`, `UN-CASCADE`, and `UN-STEG` remain future scope. Descriptor commitments validate recipe/materialization metadata and reproducibility checks; they are not production cryptographic security claims.

## Sprint 16 UN-FIT-NAIVE Candidate Evaluation

Sprint 16 adds first-pass v3 `UN-FIT-NAIVE` support beside the legacy runtime. Given target data and caller-supplied candidate generation stacks, the evaluator materializes each candidate from a blank substrate with `UN-GEN`, computes the ring residual between generated output and the target, scores that residual, and ranks candidates best-first.

`UN-FIT-NAIVE` evaluates supplied candidates only. It does not invent stacks, search parameter space, optimize geometry, evolve candidates, compress data, hide data, read or write files, add CLI behavior, implement `UN-CASCADE`, or implement `UN-STEG`. A candidate generation stack may be an unsigned `UNSTACK` recipe or a `UNSTACK-SIGNED` envelope; when both are supplied, their stack commitments must match.

Residual scoring is diagnostic. It records residual length, zero and nonzero counts, ring-aware absolute delta totals, mean and max deltas, exact-zero status, and an estimated JSON byte size for the residual values. `estimatedJsonSize` is only the byte length of `JSON.stringify(residual)` under UTF-8 and must not be described as compressed size or compression performance.

Fit reports commit to the target, evaluation settings, ranked candidate summaries, and report metadata for reproducibility checks. These commitments are deterministic diagnostics, not cryptographic security claims about raw UN-GWM strength or candidate quality outside the supplied evaluation inputs.

## Sprint 17 Roadmap and Demo Archaeology

Sprint 17 is documentation-only. It consolidates the v3 roadmap, records legacy demo repository archaeology, and captures future design branches before adding more implementation. The legacy runtime, root package import, v3 core source, and tests remain untouched by this sprint.

New references:

- `docs/legacy/DEMO_REPOS.md` documents `UnDemo-Builder` and `undemo-encryptor` as archaeology and future playground reference material.
- `docs/roadmap/V3_ROADMAP.md` summarizes completed sprints, current modules, and recommended future sprint sequencing.
- `docs/specs/UN-MATRIX_IDEAS.md` captures `UN-ND`, matrix-shaped key material, matrix mutation, `UN-MATRIX-COMBINE` recipe boundaries, and `UN-MATRIX-COMBINE-SIGNED` signer-intent envelopes.
- `docs/specs/UN-CERT_AND_STENCIL_IDEAS.md` captures first-pass split validation certificates, Sprint 27 committed cutout/stencil region descriptors, Sprint 28 validation-only certificate cutout bindings, and future overlay integration ideas.

Future branches now explicitly include `UN-ND` and `UN-STENCIL`. `UN-MATRIX-COMBINE-SIGNED` is the signed combine envelope branch, limited to signer intent over explicit committed combine recipes. Sprint 26 adds first-pass `UN-CERT` split validation certificate objects only. Sprint 27 adds first-pass `UN-CUTOUT` / `UN-STENCIL` committed region descriptors only. Sprint 28 extends `UN-CERT` to bind `UN-CUTOUT` descriptors and cutout commitments as validation artifacts only.

## Sprint 18 UN-CASCADE Deterministic Residual Layering

Sprint 18 adds first-pass v3 `UN-CASCADE` support beside the legacy runtime. A cascade starts with an original target, evaluates caller-supplied generation candidates in their exact supplied order, computes the residual between the current target and each candidate's blank-substrate generated output, scores that residual, and carries the residual forward as the next layer's current target.

The implementation records deterministic layer summaries with candidate IDs, candidate commitments, input target commitments, generated commitments, residual commitments, residual scores, generation descriptor commitments, candidate metadata, and signed stack payload commitments when a candidate uses `UNSTACK-SIGNED`. The cascade report wraps the run in a domain-separated SHA-256 report commitment over canonical payload fields and excludes the `reportCommitment` field itself.

`UN-CASCADE` does not search for candidates, optimize candidate order, compress data, hide data, read files, add CLI behavior, or implement `UN-STEG`. Residual improvement is diagnostic only. A better residual score says only that a supplied candidate left a smaller residual under the current scoring rules; it is not a compression claim, security claim, or steganography claim.

## Sprint 19 UN-MATRIX Pure Utilities

Sprint 19 adds first-pass `UN-MATRIX` pure utilities beside the legacy runtime. A matrix key descriptor records `UN-MATRIX` format/version context, row count, column count, ordered safe-integer values, canonical metadata, and a deterministic matrix commitment. Row order, column order, matrix shape, values, and metadata all affect the commitment.

The helpers normalize matrix values, clone values defensively, expose copied rows and columns, transpose rectangular or square matrices, flip rows or columns, rotate rectangular matrices by 180 degrees, rotate square matrices by 90 or 270 degrees, and flatten rows as ordered N-dimensional point vectors. They do not mutate caller input or hidden key state, and they do not call the existing 3D geometry helpers or implement N-dimensional angle math.

`UN-MATRIX` is not production cryptography. Matrix commitments do not prove secrecy, strength, authenticity, safe key evolution, tamper-proofing, compression, steganography, or production-safe encryption. Certificate integration into matrix/GWM/stack runtime paths, N-dimensional angle math, stack integration, cascade integration, CLI/file wrappers, and browser playground work remain future scope.

## Sprint 20 UN-MATRIX-MUTATE Committed Recipes

Sprint 20 adds first-pass `UN-MATRIX-MUTATE` pure utilities beside the Sprint 19 matrix helpers. A matrix mutation recipe is an explicit ordered list of supported operations: row or column swaps, row or column reversals, row or column rotations, transpose, horizontal or vertical flips, 180-degree rotation, and square-only 90/270-degree rotations.

Mutation recipes record `UN-MATRIX-MUTATE` format/version context, source matrix commitment, target matrix commitment, normalized operations, canonical metadata, and a domain-separated recipe commitment. Operation order, operation type, operation parameters, declared source commitment, declared target commitment, and metadata all affect the recipe commitment.

Mutation is explicit, deterministic, replayable, bounded, and commitment-backed. Bounds are checked at the time each operation is applied because earlier operations can change matrix shape. The helpers defensively clone caller data and return new matrix results; they do not mutate caller input or hidden key state.

`UN-MATRIX-MUTATE` is experimental and not production cryptography. Mutation recipes do not prove secrecy, strength, authenticity, or safe key evolution. Certificate integration into matrix/GWM/stack runtime paths, N-dimensional angle math, GWM integration, stack integration, cascade integration, CLI/file wrappers, and browser playground work remain future scope.

## Sprint 21 UN-MATRIX-MUTATE-SIGNED Intent Envelopes

Sprint 21 adds first-pass `UN-MATRIX-MUTATE-SIGNED` envelopes beside the Sprint 20 matrix mutation helpers. A signed matrix mutation envelope binds an explicit normalized `UN-MATRIX-MUTATE` recipe to signer ID, purpose, metadata, public key material, Ed25519 algorithm context, the mutation recipe commitment, source matrix commitment, target matrix commitment when declared, and a deterministic signed-envelope commitment.

The signature proves signer intent over the committed mutation recipe only. It does not prove matrix secrecy, key strength, authenticity of a real-world identity, authorization, safe key evolution, or production-safe cryptography. Matrix mutation remains explicit, deterministic, replayable, bounded, and commitment-backed; signing does not make hidden mutation acceptable.

Applying a signed matrix mutation verifies the envelope before applying the underlying recipe. The source matrix must match the signed source commitment, and the computed target matrix must match any signed target commitment. Sprint 21 does not integrate matrix mutation into GWM, stacks, cascade, CLI/file wrappers, browser paths, certificates, combine recipes, or N-dimensional angle math.

## Sprint 24 UN-MATRIX-COMBINE Committed Recipes

Sprint 24 adds first-pass `UN-MATRIX-COMBINE` pure committed combine recipes beside the Sprint 19 matrix helpers. A combine recipe takes named source matrix tiles and an ordered placement list, applies a supported transform to each placed tile, and assembles a larger rectangular `UN-MATRIX` key.

Recipe commitments cover the combine format/version, normalized tile names and matrix commitments, ordered placements, placement coordinates, placement transforms, and canonical metadata. Placement order is part of recipe identity even if two placement orders would assemble the same final matrix values.

Sprint 24 requires all source tiles to have the same base shape, rejects missing or unknown tile references, rejects overlapping placements, rejects unsupported transforms, rejects unsafe or negative placement coordinates, rejects transformed shapes that do not fit the output cell shape, and rejects unfilled cells in the zero-based output tile grid. `rotate90` and `rotate270` are square-only in this first pass.

`UN-MATRIX-COMBINE` is experimental and not production cryptography. Combining public/private-looking tiles does not create real asymmetric cryptography. Combine recipe commitments do not prove secrecy, key strength, identity, certificate validity, authorization, safe key evolution, or production-safe cryptography. Sprint 24 does not add `UN-CERT`, N-dimensional angle math, GWM integration, stack integration, cascade integration, CLI/file wrappers, browser paths, or legacy runtime changes.

## Sprint 25 UN-MATRIX-COMBINE-SIGNED Intent Envelopes

Sprint 25 adds first-pass `UN-MATRIX-COMBINE-SIGNED` envelopes beside the Sprint 24 matrix combine helpers. A signed matrix combine envelope binds an explicit normalized `UN-MATRIX-COMBINE` recipe to signer ID, purpose, metadata, public key material, Ed25519 algorithm context, the combine recipe commitment, input tile commitments, an output matrix commitment when available or declared, and a deterministic signed-envelope commitment.

The signature proves signer intent over the committed combine recipe only. It does not prove matrix secrecy, key strength, asymmetric encryption, authenticity of a real-world identity, certificate validity, authorization, or production authentication. Matrix combine remains explicit, deterministic, replayable, and commitment-backed; combining public/private-looking tiles does not create real asymmetric cryptography.

Applying a signed matrix combine verifies the envelope before applying the underlying recipe. Supplied tiles must match the signed tile commitments, and the computed output matrix must match any signed output commitment. Sprint 25 does not integrate matrix combine into GWM, stacks, cascade, CLI/file wrappers, browser paths, certificates, `UN-CERT`, `UN-STENCIL`, `UN-CUTOUT`, or N-dimensional angle math.

## Sprint 26 UN-CERT Split Validation Certificates

Sprint 26 adds first-pass `UN-CERT` certificate objects beside the v3 matrix modules. A certificate binds public matrix tile material or commitments, private tile slots and expected private tile commitments, a signed matrix combine envelope or signed combine commitment, an expected output matrix commitment, optional target commitments, metadata, context, and a deterministic certificate commitment.

`UN-CERT` is a validation artifact only. Structure-only verification checks the certificate shape, commitment syntax, certificate commitment, and any embedded signed matrix combine envelope. Completion verification accepts supplied private tiles, checks them against expected private tile commitments, applies the signed combine recipe with public plus private tile material, and compares the computed output matrix commitment to the certificate expectation.

A certificate proves only that supplied material satisfies a committed validation relationship. It does not prove legal ownership, human identity, production authentication, secrecy, key strength, asymmetric encryption, certificate authority trust, compression, steganography, tamper-proofing, or production-safe cryptography. Public/private matrix tile wording is conceptual and must not be described as real public-key cryptography.

Sprint 26 does not implement `UN-STENCIL`, `UN-CUTOUT`, redaction/unredaction, N-dimensional angle math, GWM integration, stack integration, cascade integration, CLI/file wrappers, browser playground behavior, legacy runtime changes, or production authentication.

## Sprint 27 UN-CUTOUT / UN-STENCIL Committed Region Descriptors

Sprint 27 adds first-pass `UN-CUTOUT` / `UN-STENCIL` pure utilities beside the v3 core modules. A cutout plan describes ordered byte ranges removed or masked from a payload, records a deterministic fill byte for the public payload, commits to hidden span bytes, commits to the original payload, and produces a deterministic cutout plan commitment over canonical plan fields.

The helpers operate in memory on `Buffer`, `Uint8Array`, and byte-array input. `applyCutout()` returns a public payload with cutout ranges filled, hidden span records, original and public payload commitments, and the cutout plan commitment. `verifyCutout()` checks descriptor shape, public payload length and fill, supplied hidden span commitments, and reconstructed payload commitment when enough material is supplied. `restoreCutout()` reconstructs the original byte payload only after validation succeeds.

`UN-CUTOUT` / `UN-STENCIL` is experimental and not production cryptography. Cutout descriptors are not secure redaction by themselves. Public payloads may leak information through size, position, structure, fill patterns, labels, metadata, and surrounding context. A successful verification proves only that supplied hidden spans satisfy committed reconstruction checks. It does not prove legal ownership, human identity, production authentication, secrecy, key strength, asymmetric encryption, certificate authority trust, compression, steganography, tamper-proofing, or production-safe cryptography.

Sprint 27 does not implement file wrappers, browser behavior, CLI behavior, `UN-CERT` integration, GWM integration, stack integration, cascade integration, real encryption, steganography, secure redaction, N-dimensional angle math, or legacy runtime changes.

## Sprint 28 UN-CERT Cutout Bindings

Sprint 28 extends `UN-CERT` so a certificate can bind ordered `UN-CUTOUT` descriptors and cutout commitments. A cutout binding records a label, cutout plan commitment, original payload commitment, public payload commitment, expected hidden span commitments, and optional context or metadata. The ordered binding list is part of the certificate commitment, so adding, removing, reordering, or changing a binding changes certificate identity.

Verification remains validation-only. Structure-only verification validates certificate and binding shape without hidden spans. Completion verification accepts supplied cutout material, uses the existing `UN-CUTOUT` verification checks, and confirms that the supplied plan, original payload commitment, public payload commitment, and hidden span commitments match the certificate binding. `applyCertificateCutout()` can restore the original payload for a named binding when valid material is supplied, but it does not persist state or create a file wrapper.

A successful cutout-bound certificate verification proves only that supplied hidden spans and payloads satisfy committed reconstruction checks. Cutout descriptors are not secure redaction by themselves, and public payloads may leak information through size, position, structure, fill patterns, labels, metadata, and surrounding context. A cutout-bound certificate does not prove legal ownership, human identity, production authentication, secrecy, key strength, asymmetric encryption, certificate authority trust, compression, steganography, tamper-proofing, or production-safe cryptography.

Sprint 28 does not implement file wrappers, browser behavior, CLI behavior, N-dimensional angle math, GWM integration, stack integration, cascade integration, real encryption, steganography, secure redaction, or legacy runtime changes.

## Sprint 30 UN-TRIAD-MIX / UN-GWM-V2 Design Spec

Sprint 30 is documentation-only. It adds `docs/specs/UN-TRIAD-MIX_IDEAS.md` as a focused future design specification for `UN-TRIAD-MIX` / `UN-GWM-V2`, a next-generation geometric walk mask concept where the ordered triad is the instruction cell.

The design explores deterministic feature families from points A, B, C, ordered edges `AB`, `BC`, `CA`, whole-triangle features, and walk state. It sketches multi-channel instruction emission for rotate/value, swap/position, rule/mix, and explain/debug material while preserving existing v3 instruction streams unless a future opt-in version or format is introduced.

Sprint 30 does not implement code, add `packages/core/src/triad-mix.js`, change legacy runtime behavior, change existing `UN-GWM` behavior, integrate with stacks, cascade, certificates, cutouts, CLI/file paths, or browser paths, or add cryptographic security claims.

## Sprint 31 UN-TRIAD-MIX Feature Extraction

Sprint 31 adds first-pass `UN-TRIAD-MIX` pure feature extraction utilities under `packages/core/src/triad-mix.js`. The helpers normalize ordered 3D triads from array or `{ x, y, z }` point forms, derive deterministic point, edge, whole-triangle, and optional walk-context features, and commit to the canonical feature payload with domain-separated SHA-256.

This sprint is feature extraction only. It does not emit `UN-ROTATE`, `UN-SWAP`, or permutation instructions; does not apply transforms; does not integrate with `UN-GWM`, instruction streams, stacks, cascade, certificates, cutouts, CLI/file wrappers, or browser paths; and does not change existing `UN-GWM` behavior or legacy runtime behavior.

`UN-TRIAD-MIX` remains experimental and not production cryptography. Feature extraction is deterministic, not random. Contextual dependency should not be marketed as cryptographic uncertainty, and more point, edge, triangle, context, matrix, or N-dimensional mixing does not automatically mean more security. Multi-channel instruction emission, N-dimensional angles, matrix mutation integration, transform integration, CLI/file wrappers, and browser playground work remain future scope.

## Sprint 32 UN-TRIAD-MIX Instruction Channels

Sprint 32 adds first-pass pure `UN-TRIAD-MIX` multi-channel instruction emission utilities under `packages/core/src/triad-mix.js`. The helpers convert deterministic triad feature objects, or raw triads through the existing feature extraction path, into descriptor channels for rotate/value, position, rule/mix, and explain/debug material.

This sprint emits descriptors only. It does not apply `UN-ROTATE`, `UN-SWAP`, or permutation transforms; does not integrate with existing `UN-GWM`, instruction streams, `UNSTACK`, `UN-CASCADE`, `UN-CERT`, `UN-CUTOUT`, CLI/file wrappers, or browser paths; and does not change existing `UN-GWM` behavior or legacy runtime behavior. Future integration must be opt-in through a new instruction stream version or explicit wrapper.

Instruction emission is deterministic, not random. Contextual dependency should not be marketed as cryptographic uncertainty, and more feature mixing does not automatically mean more security. N-dimensional angles, matrix mutation integration, CLI/file wrappers, browser playground work, and default transform integration remain future scope.

## Sprint 33 UN-TRIAD-MIX Stream Descriptors

Sprint 33 adds a pure opt-in `UN-TRIAD-MIX-STREAM` descriptor under `packages/core/src/triad-mix.js`. The stream adapter accepts ordered raw or normalized triads, reuses the existing `UN-TRIAD-MIX` feature extraction and instruction-channel emission helpers, and emits one committed record per triad with rotate, position, rule, and explain channel summaries.

Stream creation is deterministic, not random. Contextual dependency should not be marketed as cryptographic uncertainty, and more feature mixing does not automatically mean more security. Empty streams are rejected so each stream commitment identifies at least one ordered record. The optional walk adapter selects triads from points through the existing walk helpers, but it does not alter existing `UN-GWM` behavior.

Sprint 33 emits stream descriptors only. It does not apply `UN-ROTATE`, `UN-SWAP`, stack, cascade, certificate, cutout, or permutation transforms; does not replace or modify existing `UN-GWM`; does not add CLI/file wrappers or browser paths; and does not change legacy runtime behavior or root package export behavior. N-dimensional angles, matrix mutation integration, default transform integration, and broader runtime wrappers remain future scope. Future transform integration must be opt-in through a new adapter or wrapper.

## Purpose

Unobtainium v3 is intended to explore geometry-driven masking systems built around ordered 3D point-cloud keys. The current v2 code walks a list of points and derives byte shifts from triangle geometry. v3 keeps that creative center but treats the project as a lab for packet formats, stackable transforms, authentication boundaries, and controlled malleability experiments.

Raw UN-GWM mode is experimental. It must not be represented as secure encryption unless future versions add rigorous analysis, authenticated constructions, misuse resistance, stable serialization, and external review.

## Core Model

The key material is an ordered point cloud: a sequence of 3D points where both coordinates and order matter. A walk state selects three points from that sequence using point, shift, and gap cursors. Those three points form a geometric sample that maps to a mask value.

The v3 model names this family UN-GWM: Unobtainium Geometric Walk Mask. UN-GWM produces a mask stream from:

- an ordered 3D point cloud
- a deterministic walk state
- a finite ring rotation over the point list
- a configurable minimum shift
- optional packet and stack metadata

The output mask is applied to bytes or packets by a selected transform. Raw byte shifting remains useful for compatibility experiments, but it is not enough for a sealed mode.

## Ordered 3D Point-Cloud Keys

A v3 key is not just a mesh file. It is the canonical ordered point cloud extracted from, generated by, or stored alongside that file. Two meshes with identical visual shape can produce different masks if their vertex order differs. Two key files with identical coordinates can also differ if float precision, normalization, or serialization differs.

`UN-KEYFILE` is the first-pass in-memory path for deriving an ordered point cloud directly from arbitrary bytes or text. It intentionally separates normalized input bytes, descriptor metadata, commitments, and derived points so future file loading, generation, fitting, or steganographic experiments can reuse the same commitment model without treating filesystem paths as key material.

The design target is a key format that records:

- point coordinate values
- point order
- normalization rules
- precision and quantization rules
- metadata needed to reproduce the walk
- optional signatures or fingerprints

## Geometric Walk Masks

The walk mask is the stream of point-derived shift values. v2 uses a three-hand walk: point advances every byte, shift advances after each full point ring, and gap advances after deeper cycles. v3 should preserve that vocabulary while allowing alternative walk strategies.

The mask horizon is the distance before a walk state repeats under a given point cloud and parameter set. A short horizon increases reuse risk. A v3 implementation should expose horizon calculations and reject obviously degenerate configurations in sealed modes.

## Finite Ring Rotation

The point cloud is treated as a finite ring. Cursors wrap by modulo arithmetic. Rotation depth, or turns, describes how far the walk has advanced through the ring cycles. v3 should make rotation explicit so packets and stacks can resume, split, or audit mask generation without relying on hidden mutable object state.

## Point Packets

Point packets are ordered 3D coordinate packets that let public, session, nonce, context, or random material enter the v3 geometry pipeline. A point packet can be grafted onto a private base mesh to form an effective mesh, or it can derive an anchored walk state for the mesh that will generate an instruction stream.

Current first-pass point packet fields include:

- packet type
- packet version
- point count
- fixed-point scale
- coordinate range
- ordered point triples
- stable packet commitment

`UNPKT-CONTEXT`, `UNPKT-NONCE`, and `UNPKT-RANDOM` are current first-pass packet types. UNPKT point packets may be public. They do not provide secrecy alone; they are contextual geometry material for reproducibility, binding, perturbation, and future sealed modes.

## Composable and Signed Stacks

UNSTACK is the working name for a sequence of ordered transform layers. The current first-pass runtime supports unsigned recipes with `UN-ROTATE` and `UN-SWAP` layers. Future stacks may combine geometric masking with compression, padding, permutation, patching, or steganographic placement.

UNSTACK-SIGNED is a signed envelope around an unsigned stack recipe. The current first-pass form signs the canonical stack commitment plus signer ID, purpose, metadata, algorithm, and signed-stack format/version context. The signature goal is recipe integrity, provenance, and tamper evidence, not secrecy or authorization.

UNPATCH-SIGNED is a signed envelope around a committed patch object. The current first-pass form signs the canonical patch commitment plus signer ID, purpose, metadata, algorithm, signed-patch format/version context, and explicit `UNPATCH-SIGNED:v1` domain separation. The signature goal is patch intent and integrity, not authorization, decryption, or filesystem mutation rights.

UN-MATRIX-MUTATE-SIGNED is a signed envelope around an explicit committed matrix mutation recipe. The first-pass form signs the normalized mutation recipe payload and commitment plus signer ID, purpose, metadata, algorithm, public key material, signed-envelope format/version context, source matrix commitment, target matrix commitment when declared, and explicit domain separation. The signature goal is signer intent over that recipe only, not secrecy, key strength, real-world identity, authorization, or safe key evolution.

UN-MATRIX-COMBINE-SIGNED is a signed envelope around an explicit committed matrix combine recipe. The first-pass form signs the normalized combine recipe payload and commitment plus signer ID, purpose, metadata, algorithm, public key material, signed-envelope format/version context, input tile commitments, output matrix commitment when available or declared, and explicit domain separation. The signature goal is signer intent over that recipe only, not secrecy, key strength, asymmetric encryption, real-world identity, certificate validity, authorization, or production authentication.

Composable stacks should be explicit, inspectable, canonical, and hashable. Hidden transform order creates fragile behavior and makes security review harder.

## Gates

UN-GATE is currently a validation-only scoped commitment object. The first-pass form does not decide whether transforms may run, grant decryption, or grant mutation. It records enough canonical commitment material to validate that a supplied object, byte range, and signed stack envelope match the values the gate was created for.

Future gates may grow into broader policy objects that enforce key fingerprints, minimum point counts, mask horizon limits, sealed-mode requirements, accepted stack versions, or known-bad geometry rejection. That broader authorization layer is not part of Sprint 10. Gates are meant to prevent accidental misuse and support scoped validation. They are not a substitute for a production authenticated encryption design, external trust policy, or cryptographic review.

## Controlled Malleability

Raw v2-style byte shifting is malleable: changing masked bytes can predictably affect obtained bytes. v3 should treat malleability as an explicit mode decision. Sprint 11 exposes only a committed, bounded add-patch form for experiments; Sprint 12 can sign the intent for that committed patch. Neither form makes malleability safe or authorized by itself.

Sealed mode should reject tampered packets through authentication. Malleable mode may intentionally allow local edits, patches, or reversible deltas for research workflows. UNPATCH is the working name for patch packets that intentionally describe changes against a masked or unmasked stream.

## Future Generative Geometry Modes

Sprint 14 uses `UN-GEN` for blank-substrate materialization through existing stacks. Broader deterministic point-cloud generation from seeds, prompts, parameters, or procedural geometry remains future scope. UN-FIT is the working name for fitting or adapting point clouds to target constraints. UN-CASCADE is the working name for chaining multiple point-cloud masks. UN-STEG is the working name for carrying point packets inside another medium.

Future key-shape branches include `UN-ND` for broader N-dimensional geometry support. Sprint 19 `UN-MATRIX` is limited to pure matrix descriptors and value transforms. Sprint 20 `UN-MATRIX-MUTATE` is limited to explicit committed mutation recipes. Sprint 21 `UN-MATRIX-MUTATE-SIGNED` is limited to signed envelopes over those explicit committed recipes. Sprint 24 `UN-MATRIX-COMBINE` is limited to pure committed tiled combine recipes. Sprint 25 `UN-MATRIX-COMBINE-SIGNED` is limited to signed envelopes over explicit committed combine recipes. Sprint 26 `UN-CERT` is limited to split validation certificate objects. Sprint 27 `UN-CUTOUT` / `UN-STENCIL` is limited to committed byte-region descriptors. Sprint 28 is limited to validation-only `UN-CERT` bindings for those descriptors and commitments. Sprint 30 defines `UN-TRIAD-MIX` / `UN-GWM-V2` as a docs-only successor path for triad-as-instruction-cell mask generation. Sprint 31 adds pure `UN-TRIAD-MIX` feature extraction only. Sprint 32 adds pure `UN-TRIAD-MIX` instruction-channel descriptors only. Sprint 33 adds pure opt-in `UN-TRIAD-MIX-STREAM` descriptors only. Future validation and overlay branches include context-bound original-vs-shifted layer experiments and opt-in integration with GWM, stacks, and cascade reports.

These modes are future research directions. They should not be exposed as security claims. The first requirement is reproducibility: identical inputs must produce identical ordered point clouds across supported runtimes.

## Glossary

`UN-GEN`: The Sprint 14 v3 in-memory generation primitive that creates a blank substrate and materializes generated data by applying an existing `UNSTACK` recipe. It is not compression, steganography, fitting, optimization, filesystem support, or CLI support.

`UN-GEN-DESCRIPTOR`: The Sprint 15 v3 generation manifest format. It records blank-substrate settings, stack or signed-stack bindings, generated/target/residual commitments, metadata, and a descriptor commitment.

`UN-TRIAD-MIX`: The Sprint 31 pure feature extraction, Sprint 32 pure instruction-channel descriptor, and Sprint 33 pure stream descriptor branch for treating an ordered point triad as deterministic point, edge, triangle, context, and descriptor material. It does not apply transform instructions, does not integrate with existing `UN-GWM`, and is not production cryptography.

`UN-GWM-V2`: A future opt-in successor path for geometric walk mask generation using `UN-TRIAD-MIX` concepts. Existing `UN-GWM` streams must not change unless a future explicit version or format is introduced.

`UN-FIT`: The broader working name for fitting or adapting point-cloud generation material to target constraints. Sprint 16 implements only the supplied-candidate evaluator subset.

`UN-FIT-NAIVE`: The Sprint 16 v3 deterministic evaluator that generates output from caller-supplied candidate stacks, computes residuals against a target, scores those residuals, and ranks candidates. It does not search, optimize, compress, or hide data.

Generation descriptor: A plain-data manifest for reproducing and checking `blank + stack -> generated` and, when residual material is supplied externally, `generated + residual -> target`.

Generation manifest: A descriptive synonym for generation descriptor. The manifest records commitments and settings, not compressed payload data or steganographic carrier data.

Descriptor commitment: A domain-separated SHA-256 hex digest over the canonical `UN-GEN-DESCRIPTOR` payload, excluding the `descriptorCommitment` field itself.

Generated commitment: A SHA-256 hex digest over generated data values under the descriptor window. It lets verification compare regenerated or supplied generated data to the descriptor.

Residual commitment: A SHA-256 hex digest over normalized residual values under the descriptor window. It commits to external residual material without claiming that residuals are compressed.

Target commitment: A SHA-256 hex digest over target data values under the descriptor window. It lets verification compare supplied target data to the descriptor.

Candidate generation stack: A supplied unsigned `UNSTACK` recipe or `UNSTACK-SIGNED` envelope used by `UN-FIT-NAIVE` to materialize generated output from a blank substrate. It is an input candidate, not something Sprint 16 creates.

Residual score: The diagnostic score object computed from a residual. It includes zero/nonzero counts, ring-aware absolute delta metrics, estimated JSON byte length, and exact-zero status. It is not a compression or security metric.

Fit report: A deterministic `UN-FIT-NAIVE-REPORT` object containing target commitment, evaluation settings, candidate count, ranked candidate summaries, metadata, and a report commitment.

Candidate ranking: The best-first order produced by `UN-FIT-NAIVE`, sorted by lowest nonzero residual count, then lowest sum of ring-aware absolute deltas, then lowest estimated JSON byte size, then candidate ID.

Exact zero residual: A residual whose entries are all zero, meaning the candidate generated exactly the target under the declared ring and evaluation settings.

Blank substrate: A newly created in-memory Array, `Uint8Array`, or `Buffer` of a declared length whose fill value is normalized into the active ring/window before stack materialization.

Generated data: The output produced by applying a `UNSTACK` recipe to a blank substrate. Generated data preserves the requested substrate type where practical.

Geometry materialization: The process of turning a blank substrate into generated data by running geometry-derived stack layers such as `UN-ROTATE` and `UN-SWAP`.

Residual: The per-position ring difference between target data and generated data, computed as `target - generated mod window`.

Residual reconstruction: Rebuilding target data by applying a residual to generated data, position by position, as `generated + residual mod window`.

Target reconstruction: The deterministic check that `generated + residual = target mod window` for all positions. It is a reconstruction relation and must not be treated as a compression claim.

`UN-KEYFILE`: A v3 in-memory key material derivation format that turns normalized bytes, strings, buffers, typed arrays, or byte arrays plus optional passphrase, context, salt, and label into an ordered fixed-point 3D point cloud and descriptor commitment.

Keyfile-derived mesh: The ordered point array produced by `UN-KEYFILE`. It can be used directly as mesh input for instruction streams, `UN-ROTATE`, `UN-SWAP`, packet grafts, and stack layers.

Key mesh descriptor: A plain-data descriptor for a keyfile-derived mesh. It records format/version, derivation parameters, source type, input and optional material commitments, ordered points, and a mesh commitment.

Input commitment: A SHA-256 hex digest over the normalized input bytes used by a key mesh descriptor.

Mesh commitment: A SHA-256 hex digest over the canonical key mesh descriptor fields that define the derived mesh, excluding the `meshCommitment` field itself.

Context key: Public, semi-public, or application-specific material used to diversify or bind a keyfile-derived mesh without necessarily providing secrecy by itself.

Weak/public keyfile: Keyfile input that is public, predictable, reused, low entropy, or otherwise not secret. It can still be useful for context, demos, decoys, watermarks, puzzles, or reproducible tests, but it should not be treated as strong secret material.

Strong/private keyfile: Keyfile input that is secret or difficult to predict, usually strengthened by appropriate passphrase, salt, or context choices. Sprint 13 records deterministic material only and does not certify strength.

`UN-MATRIX`: The Sprint 19 v3 pure utility family for rectangular safe-integer matrix descriptors, deterministic matrix commitments, defensive copies, basic matrix transforms, and row-as-point flattening.

`UN-MATRIX-MUTATE`: The Sprint 20 v3 pure utility family for explicit committed matrix mutation recipes. It is deterministic, replayable, bounded, and commitment-backed, but it does not prove secrecy, strength, authenticity, or safe key evolution.

Matrix mutation recipe commitment: A domain-separated SHA-256 hex digest over the canonical mutation recipe payload. Operation order, operation type, operation parameters, declared source commitment, declared target commitment, and metadata affect it.

`UN-MATRIX-MUTATE-SIGNED`: The Sprint 21 v3 signed envelope for explicit committed matrix mutation recipes. It proves signer intent over the committed recipe only and does not prove secrecy, strength, real-world identity, authorization, or safe key evolution.

Signed matrix mutation commitment: A domain-separated SHA-256 hex digest over the canonical signed matrix mutation payload. It aids reproducibility and diagnostics for the signed envelope.

`UN-MATRIX-COMBINE`: The Sprint 24 v3 pure committed recipe family for combining supplied matrix tiles into a larger tiled `UN-MATRIX` key. It is experimental and not production cryptography.

Matrix combine recipe: A deterministic `UN-MATRIX-COMBINE` object containing named source tile descriptors, ordered placements, optional canonical metadata, and a recipe commitment. It is a reproducibility record, not a secrecy, strength, identity, certificate, or authorization proof.

Matrix combine recipe commitment: A domain-separated SHA-256 hex digest over the canonical combine recipe payload. Tile names, tile matrix commitments, placement order, placement coordinates, placement transforms, and metadata affect it.

`UN-MATRIX-COMBINE-SIGNED`: The Sprint 25 v3 signed envelope for explicit committed matrix combine recipes. It proves signer intent over the committed recipe only and does not prove secrecy, strength, asymmetric encryption, real-world identity, certificate validity, authorization, or production authentication.

Signed matrix combine commitment: A domain-separated SHA-256 hex digest over the canonical signed matrix combine payload. It aids reproducibility and diagnostics for the signed envelope.

`UN-CERT`: The Sprint 26 v3 split validation certificate object, extended in Sprint 28 with optional ordered cutout bindings. It binds public tile descriptors or material, private tile slots and expected commitments, signed matrix combine material, an expected output matrix commitment, optional target commitments, optional cutout plan and payload commitments, metadata, context, and a certificate commitment.

Certificate commitment: A domain-separated SHA-256 hex digest over the canonical `UN-CERT` payload, excluding the `certificateCommitment` field itself. Public tile commitments, private slot names, expected private commitments, signed combine commitment, expected output matrix commitment, target commitments, ordered cutout bindings, metadata, and context affect it.

Split validation certificate: A validation artifact proving only that supplied material satisfies a committed relationship. It does not prove legal ownership, human identity, production authentication, secrecy, key strength, asymmetric encryption, certificate authority trust, compression, steganography, or tamper-proofing.

Cutout-bound certificate: A Sprint 28 `UN-CERT` certificate with ordered `UN-CUTOUT` bindings. It proves only that supplied hidden spans and payloads satisfy committed reconstruction checks, not secure redaction, legal ownership, human identity, production authentication, secrecy, key strength, asymmetric encryption, certificate authority trust, compression, steganography, or production-safe cryptography.

`UN-CUTOUT` / `UN-STENCIL`: The Sprint 27 v3 committed region descriptor utilities for byte-like payloads. A plan records ordered hidden ranges, deterministic fill settings, span commitments, payload commitments, label/context/metadata, and a plan commitment. It is not secure redaction, secrecy, production authentication, asymmetric cryptography, compression, steganography, or production cryptography.

Cutout plan commitment: A domain-separated SHA-256 hex digest over the canonical `UN-CUTOUT` plan payload, excluding the `cutoutPlanCommitment` field itself. Span order, offsets, lengths, labels, span commitments, original payload commitment, fill settings, context, and metadata affect it.

Cutout verification: A structural check that supplied public payload and hidden spans satisfy committed reconstruction checks. It does not prove legal ownership, human identity, certificate authority trust, secrecy, key strength, production authentication, asymmetric encryption, compression, steganography, or secure redaction.

`UN-GATE`: A v3 validation-only capability object that binds an object ID, byte range, object commitment, slice commitment, signed stack commitments, metadata, and a canonical gate commitment.

`UNPATCH`: A v3 committed patch object for explicit, bounded malleability experiments. Sprint 11 supports only additive `"add"` patches over an exact range.

`UNPATCH-SIGNED`: A v3 signed patch intent envelope that binds a committed `UNPATCH` object to a signer ID, purpose, metadata, public key, signature algorithm, signature value, and payload commitment.

Signed patch envelope: A plain-data object that carries a committed patch plus signature fields needed to verify the patch commitment and signed intent metadata.

Add patch: The Sprint 11 `UNPATCH` operation that adds declared integer deltas to corresponding data positions modulo the patch window size.

Patch commitment: A domain-separated SHA-256 hex digest over the canonical patch payload. It covers format/version, object ID, operation, range, deltas, window size, base commitments, signed-stack bindings, and metadata, but not the `patchCommitment` field itself.

Patch signature: The Ed25519 signature over the canonical signed patch payload. It does not include its own signature value and does not grant authorization or decryption.

Signed patch payload: The canonical signed data for `UNPATCH-SIGNED`: signed-patch domain and format/version context, patch commitment, signer ID, purpose, metadata, and algorithm.

Patch payload commitment: A SHA-256 hex digest over the canonical signed patch payload. It aids diagnostics and reproducibility checks, but it is not a substitute for signature verification.

Owner-signed patch: A signed patch whose purpose marks the committed patch as intended by an owner or controlling signer. Sprint 12 uses `owner-signed-patch` as the default purpose string without adding trust policy or authorization semantics.

Patch authorization intent: The signed statement that a signer endorsed an exact committed patch for a purpose. It is intent metadata only; full authorization policy, patch gates, and capability checks are future scope.

Base object commitment: The full-object commitment for the data bytes that a patch was created against.

Base slice commitment: The slice commitment for the exact patch range in the data bytes that a patch was created against.

Controlled malleability: An explicitly bounded mode where changes are represented as committed patch objects. It is dangerous unless authorized by a higher-level policy and is not a security claim.

Patch reversal: The in-memory inverse of an add patch. It subtracts the committed deltas modulo the same window size to restore the pre-patch data when the matching object and patch are used.

Validation gate: The Sprint 10 `UN-GATE` form whose only supported permission is `"validate"`. It can confirm scoped commitment matches but does not grant decryption, mutation, patching, or broader authorization.

Gate commitment: A SHA-256 hex digest over the canonical gate payload. It covers format/version, permission, object ID, range, object commitment, slice commitment, signed stack commitment, signed stack payload commitment, and metadata, but not the `gateCommitment` field itself.

Object commitment: A domain-separated SHA-256 hex digest over the full supplied object bytes plus object length metadata.

Slice commitment: A domain-separated SHA-256 hex digest over the selected byte range plus object length and range metadata. Including the range prevents identical bytes at different offsets from implying the same scoped commitment.

Scoped validation: Verification that a gate applies to a specific object, exact byte range, exact signed stack envelope commitments, and expected data slice.

Validation-only permission: The literal `"validate"` permission supported by Sprint 10 gates. It is not a decryption grant, mutation grant, patch right, or production authorization decision.

## Non-Goals for Sprint 0 and Sprint 1

- No rewrite of `unobtainium.js`.
- No change to the current package import behavior.
- No claim that raw UN-GWM is production-grade encryption.
- No attempt to hide the known legacy weaknesses.
- No new packet runtime until the legacy behavior is covered by tests.
