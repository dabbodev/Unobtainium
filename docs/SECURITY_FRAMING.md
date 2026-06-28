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

The current v3 line includes matrix utilities, matrix mutation, signed mutation, matrix combine, signed combine, split certificates, cutout descriptors, certificate-bound cutout verification, and first-pass `UN-TRIAD-MIX` feature extraction plus instruction-channel and stream descriptors. These are experimental object, recipe, validation, feature, descriptor, and data-transformation primitives. `UN-GWM-V2` runtime integration, CLI/file wrappers, browser playground work, and hybrid production crypto envelopes remain future scope.

`UN-TRIAD-MIX` is a pure deterministic triad feature extraction, instruction-channel descriptor, and opt-in stream descriptor branch as of Sprint 33. It is not random, not production cryptography, and not a source of cryptographic uncertainty. More point, edge, triangle, walk-state, matrix, or N-dimensional feature mixing does not automatically mean more security. Sprint 33 emits descriptors only; it does not apply `UN-ROTATE`, `UN-SWAP`, or permutation transforms, does not replace existing `UN-GWM`, and does not change existing `UN-GWM` behavior.

## Future Safety Direction

A future sealed mode should authenticate packets or stacks before exposing obtained data. It should also define canonical key serialization, reject degenerate geometry, require nonces or unique walk domains, and document exactly what security property it attempts to provide. A future hybrid production crypto envelope may wrap v3 experimental material, but it should not flatten the project into "just use AES" or recast raw v3 primitives as production cryptography.
