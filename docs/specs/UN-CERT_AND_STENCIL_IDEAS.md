# UN-CERT and UN-STENCIL Ideas

Status: Sprint 26 implements first-pass `UN-CERT` split validation certificate objects. Sprint 27 adds first-pass `UN-CUTOUT` / `UN-STENCIL` committed region descriptors. Sprint 28 extends `UN-CERT` so certificates can bind ordered `UN-CUTOUT` descriptors and cutout commitments.

These ideas do not make raw mode production-secure. `UN-CERT` is a validation artifact only. `UN-CUTOUT` / `UN-STENCIL` descriptors are structural validation primitives only. Cutout-bound certificates are validation artifacts only. They are experimental and not production cryptography.

## Split Validation Certificates

`UN-CERT` is a first-pass split validation certificate object built around matrix tiles and a signed combine recipe. It binds public matrix tile material or commitments, private tile slots and expected private tile commitments, a signed matrix combine envelope or signed combine commitment, an expected effective/output matrix commitment, optional target commitments, optional ordered cutout bindings, metadata, context, and a deterministic certificate commitment.

Core parts:

- public matrix tile B: conceptual public-side matrix material that can be shared with observers;
- private matrix tile A: conceptual private-side matrix material supplied later by a claimant;
- signed matrix-combine recipe: a signed recipe that declares how tile A and tile B combine;
- combined validation matrix: the reconstructed matrix output checked against the certificate commitment;
- data/object/slice commitments: commitments that bind the certificate to exact data, ranges, or validation targets.

Public observer capability:

- verify certificate structure and public commitments;
- verify the public matrix tile B commitment;
- verify an embedded signed combine envelope when present;
- confirm which object, range, label, context, or other target commitments the certificate claims to bind;
- not reconstruct the combined validation matrix without private tile A.

Completion verifier capability:

- verify all public observer checks;
- supply private matrix tile A;
- verify the private tile commitment;
- reconstruct the combined validation matrix through the signed matrix combine envelope;
- verify the computed output matrix commitment against the certificate's expected output matrix commitment.
- optionally supply cutout material and verify that public payloads plus hidden spans satisfy the certificate's committed cutout bindings.

## Certificate Verification Flow

1. Verify the certificate shape and certificate commitment.
2. Verify the public tile commitment.
3. Verify the embedded signed matrix combine envelope if present.
4. Verify the private tile commitment if private tile material is supplied.
5. Reconstruct the combined validation matrix from public tile B, private tile A, and the signed combine recipe.
6. Verify the combined output matrix commitment.
7. Verify any supplied cutout material against ordered certificate cutout bindings.
8. Return a validation result object. Sprint 28 does not use the combined matrix or cutout material for stack or gate validation.

The certificate can bind relevant object commitments, range or slice commitments, label/context commitments, signed combine commitments, public tile commitments, private tile commitments, expected output matrix commitment, ordered cutout plan commitments, original payload commitments, public payload commitments, hidden span commitments, metadata, and context. Sprint 28 does not bind certificates into `UN-GATE`, `UNSTACK`, `UN-CASCADE`, file wrappers, browser paths, CLI paths, or legacy runtime paths.

## Sprint 26 Boundaries

`UN-CERT` proves only that supplied material satisfies a committed validation relationship. It does not prove legal ownership, human identity, production authentication, secrecy, key strength, asymmetric encryption, certificate authority trust, compression, steganography, tamper-proofing, or production-safe cryptography.

Public/private matrix tile language is conceptual. It must not be described as real public-key cryptography.

## UN-STENCIL / UN-CUTOUT

Sprint 27 adds first-pass `UN-CUTOUT` / `UN-STENCIL` committed region descriptors for byte-like payloads. A cutout plan declares ordered ranges, replaces those ranges in a public payload with a deterministic fill byte, commits to the original payload and hidden span material, and supports later verification when the hidden spans are supplied.

This is not secure redaction by itself. Public payloads may leak information through size, position, structure, fill patterns, labels, metadata, and surrounding context. A successful verification proves only that supplied hidden spans satisfy committed reconstruction checks. It does not prove legal ownership, human identity, production authentication, secrecy, key strength, asymmetric encryption, certificate authority trust, compression, steganography, tamper-proofing, or production-safe cryptography.

The broader stencil model still compares an original layer and a shifted or generated layer, then reveals or masks selected regions by explicit region rules. Sprint 27 implements only the committed byte-region descriptor subset.

## Sprint 28 Cutout-Bound Certificates

Sprint 28 connects the existing `UN-CERT` split validation certificate object to existing committed `UN-CUTOUT` descriptors. A certificate may include an ordered `cutouts` array. Each binding records a label, cutout plan commitment, original payload commitment, public payload commitment, expected hidden span commitments, and optional context or metadata. Binding order is part of certificate identity.

Structure-only verification validates the certificate and cutout binding shapes, including commitment string syntax and duplicate labels, without requiring hidden spans. Completion verification accepts supplied cutout material and uses the existing `UN-CUTOUT` verification checks to confirm that the supplied plan, public payload, hidden spans, and reconstruction commitments match the certificate binding. A successful verification proves only that supplied hidden spans and payloads satisfy committed reconstruction checks.

Tiny non-production certificate cutout binding concept:

```javascript
{
  cutouts: [{
    label: 'body',
    cutoutPlanCommitment: '...',
    originalPayloadCommitment: '...',
    publicPayloadCommitment: '...',
    spanCommitments: ['...'],
    context: { purpose: 'split-validation-demo' }
  }]
}
```

Cutout-bound certificates remain validation artifacts only. Cutout descriptors are not secure redaction by themselves. Public payloads may leak information through size, position, structure, fill patterns, labels, metadata, and surrounding context. A cutout-bound certificate does not prove legal ownership, human identity, production authentication, secrecy, key strength, asymmetric encryption, certificate authority trust, compression, steganography, tamper-proofing, or production-safe cryptography.

Sprint 28 does not add file wrappers, browser behavior, CLI behavior, GWM integration, stack integration, cascade integration, real encryption, steganography, secure redaction, production authentication, N-dimensional angle math, or legacy runtime changes.

Core parts:

- original layer `P`;
- shifted or generated layer `S`;
- selected regions or cutouts;
- region commitments and context;
- optional certificate or gate bindings.

Candidate region splice modes:

- original outside, shifted inside: keep original data outside selected regions and use shifted/generated data inside selected regions.
- shifted outside, original inside: keep shifted/generated data outside selected regions and reveal original data inside selected regions.

XOR stencil relation:

- `X = P XOR S`
- `P = S XOR X`
- `S = P XOR X`

The XOR relation is useful for describing reversible stencil material. It is also dangerous if reused or weakly bound.

## XOR Stencil Warnings

XOR mask or stencil material must be context-bound. Reusing the same stencil material across objects, ranges, certificates, recipes, or purposes can leak relationships between layers.

A future stencil descriptor should bind at least:

- `objectId`;
- exact byte or element range;
- certificate commitment when used with `UN-CERT`;
- gate commitment when used with `UN-GATE`;
- recipe or descriptor commitment;
- purpose;
- nonce or context material;
- layer/frame identifier.

## Boundaries

Sprint 27 `UN-CUTOUT` / `UN-STENCIL` work is limited to pure committed region descriptor utilities. Sprint 28 adds validation-only `UN-CERT` cutout bindings. These do not add file wrappers, browser behavior, CLI behavior, GWM integration, stack integration, cascade integration, real encryption, steganography, secure redaction, production authentication, or N-dimensional angle math.

File wrappers, browser playground work, N-dimensional angle math, GWM integration, stack integration, cascade integration, and richer original-vs-shifted stencil relations remain future scope.

They do not make raw mode production-secure, and they should not be described as authenticated encryption, safe redaction, secure access control, production authentication, asymmetric cryptography, ownership proof, identity proof, compression, steganography, or tamper-proofing without a future sealed construction and external review.
