# Security Framing

Unobtainium raw UN-GWM mode is experimental. It is a geometry-driven masking experiment, not production-grade encryption. Do not use the current raw mode to protect secrets, credentials, private files, regulated data, or adversarial communications.

This project should avoid security claims until a future sealed mode has a precise construction, tests, misuse-resistant defaults, authentication, stable serialization, and independent review.

## Current Raw Mode Risks

- Mask reuse: using the same point cloud and walk start for multiple messages can expose relationships between plaintexts.
- Weak key misuse: small, repeated, hand-picked, or predictable point clouds can produce weak or short mask patterns.
- Unauthenticated malleability: the current byte-shift transform has no integrity check. Modified masked bytes can produce modified obtained bytes without detection.
- Float instability: STL parsing and geometric calculations use floating-point values. Platform, parser, precision, or normalization differences can change derived masks.
- Biased masks: geometric angle buckets and coordinate arithmetic may produce non-uniform shift distributions.
- Degenerate points: duplicate points, collinear samples, zero-length triangle edges, too few points, or NaN angles can create invalid or weak mask values.
- Known plaintext: if an attacker knows or guesses plaintext and masked output at the same position, they can infer the mask value for that position.
- Package metadata should continue to match the repository `LICENSE` file before publishing or depending on the package.

## Language Guidance

Use terms like experimental, masking, obfuscation, research mode, and legacy behavior for the current raw mode.

Avoid terms like secure encryption, military grade, unbreakable, production safe, authenticated, tamper-proof, or cryptographically proven for the current raw mode.

For v3 matrix, certificate, and cutout work, describe commitments as deterministic integrity/check artifacts for reproducibility and diagnostics. Describe signed envelopes as signer-intent wrappers over exact committed payloads, not production authentication, identity proof, ownership proof, asymmetric cryptography, or certificate authority trust.

The current v3 line includes matrix utilities, matrix mutation, signed mutation, matrix combine, signed combine, split certificates, cutout descriptors, certificate-bound cutout verification, first-pass `UN-TRIAD-MIX` feature extraction plus instruction-channel, stream, adapter, and transform-proof descriptors, a Sprint 38 `UN-GWM-V2` mode specification, Sprint 39 pure `UN-GWM-V2` descriptor utilities, and Sprint 40 `UN-GWM-V2` source point commitment plus opt-in triad stream generation utilities. These are experimental object, recipe, validation, feature, descriptor, and data-transformation primitives. Default `UN-GWM-V2` behavior, adapter/proof integration, runtime integration, CLI/file wrappers, browser playground work, and hybrid production crypto envelopes remain future scope.

`UN-TRIAD-MIX` is a pure deterministic triad feature extraction, instruction-channel descriptor, opt-in stream descriptor, opt-in adapter descriptor, and isolated opt-in transform proof branch as of Sprint 35. Sprint 38 defines `UN-GWM-V2` as a future explicit opt-in geometric walk mask mode powered by that pipeline. Sprint 39 adds pure committed descriptor utilities. Sprint 40 adds source point commitments and opt-in triad stream descriptor generation for `UN-GWM-V2` descriptors only: it does not generate adapter plans or transform proofs automatically; it does not apply `UN-ROTATE`, `UN-SWAP`, or permutation transforms; it does not replace or modify existing `UN-GWM`; and existing `UN-GWM` behavior remains unchanged. Source point commitments, triad stream commitments, and descriptor commitments are deterministic integrity/check artifacts, not proof of secrecy, key strength, identity, ownership, production authentication, authorization, secure redaction, compression, steganography, asymmetric cryptography, tamper-proofing, or production-safe cryptography. Transform proof output is deterministic, not random, not production cryptography, and not a source of cryptographic uncertainty. More point, edge, triangle, walk-state, matrix, channel, or N-dimensional feature mixing does not automatically mean more security. Sprint 35 uses triad adapter output to drive existing reversible transforms in an isolated opt-in helper. Sprint 40 does not create a production cipher mode and does not integrate with stack, cascade, certificate, cutout, CLI/file, browser, or legacy runtime paths. Future integration would require a separate explicit versioned mode and tests.

## Future Safety Direction

A future sealed mode should authenticate packets or stacks before exposing obtained data. It should also define canonical key serialization, reject degenerate geometry, require nonces or unique walk domains, and document exactly what security property it attempts to provide. A future hybrid production crypto envelope may wrap v3 experimental material, but it should not flatten the project into "just use AES" or recast raw v3 primitives as production cryptography.
