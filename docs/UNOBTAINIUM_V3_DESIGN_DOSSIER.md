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

UNSTACK is the working name for a sequence of ordered transform layers. The current first-pass runtime supports unsigned recipes with `UN-ROTATE` layers only. `UN-SWAP` exists as a standalone transform but is not integrated into `UNSTACK` yet. Future stacks may combine geometric masking with compression, padding, permutation, patching, or steganographic placement.

UNSTACK-SIGNED is a future stack variant where the stack manifest and selected packet fields are signed. It is not implemented yet. The signature goal is provenance and tamper evidence, not secrecy.

Composable stacks should be explicit, inspectable, canonical, and hashable. Hidden transform order creates fragile behavior and makes security review harder.

## Gates

UN-GATE is a proposed policy layer that decides whether a transform may run. Gates can enforce key fingerprints, minimum point counts, mask horizon limits, sealed-mode requirements, accepted stack versions, or known-bad geometry rejection.

Gates are meant to prevent accidental misuse. They are not a substitute for cryptographic authentication.

## Controlled Malleability

Raw v2-style byte shifting is malleable: changing masked bytes can predictably affect obtained bytes. v3 should treat malleability as an explicit mode decision.

Sealed mode should reject tampered packets through authentication. Malleable mode may intentionally allow local edits, patches, or reversible deltas for research workflows. UNPATCH is the working name for patch packets that intentionally describe changes against a masked or unmasked stream.

## Future Generative Geometry Modes

UN-GEN is the working name for deterministic point-cloud generation from seeds, prompts, parameters, or procedural geometry. UN-FIT is the working name for fitting or adapting point clouds to target constraints. UN-CASCADE is the working name for chaining multiple point-cloud masks. UN-STEG is the working name for carrying point packets inside another medium.

These modes are future research directions. They should not be exposed as security claims. The first requirement is reproducibility: identical inputs must produce identical ordered point clouds across supported runtimes.

## Non-Goals for Sprint 0 and Sprint 1

- No rewrite of `unobtainium.js`.
- No change to the current package import behavior.
- No claim that raw UN-GWM is production-grade encryption.
- No attempt to hide the known legacy weaknesses.
- No new packet runtime until the legacy behavior is covered by tests.
