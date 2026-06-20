# UN-CERT and UN-STENCIL Ideas

Status: future design notes only. No `UN-CERT`, `UN-STENCIL`, or `UN-CUTOUT` implementation exists yet.

These ideas do not make raw mode production-secure. They are planning notes for validation, redaction, and overlay experiments that would require explicit commitments, signatures, misuse boundaries, and review before implementation.

## Split Validation Certificates

`UN-CERT` is a future split validation certificate idea built around matrix tiles and a signed combine recipe.

Core parts:

- public key tile B: a matrix tile that can be shared with observers;
- secret key tile A: a private matrix tile supplied only by an authorized verifier;
- signed matrix-combine recipe: a signed recipe that declares how tile A and tile B combine;
- combined validation key: the reconstructed matrix key used for stack or gate validation;
- data/object/slice commitments: commitments that bind the certificate to exact data, ranges, or validation targets.

Public observer capability:

- verify certificate structure and public commitments;
- verify the public key tile B commitment;
- verify the signed combine recipe if the signer policy is available;
- confirm which object, range, gate, or stack commitments the certificate claims to bind;
- not reconstruct the combined validation key without secret tile A.

Authorized verifier capability:

- verify all public observer checks;
- supply secret key tile A;
- verify the secret tile commitment;
- reconstruct the combined validation key;
- verify the combined key commitment;
- use the combined key for stack or gate validation.

## Certificate Verification Flow

1. Verify the certificate commitment and signature.
2. Verify the public tile commitment.
3. Verify the secret tile commitment if the secret tile is supplied.
4. Reconstruct the combined matrix key from public tile B, secret tile A, and the signed combine recipe.
5. Verify the combined key commitment.
6. Use the combined key for stack or gate validation.

The certificate should bind the relevant object ID, object commitment, slice commitment, signed stack commitment, gate commitment, combine recipe commitment, public tile commitment, secret tile commitment, combined key commitment, purpose, and context.

## UN-STENCIL / UN-CUTOUT

`UN-STENCIL` and `UN-CUTOUT` are future overlay/redaction ideas. The core model compares an original layer and a shifted or generated layer, then reveals or masks selected regions by explicit region rules.

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

These are future designs only. No implementation exists yet.

They do not make raw mode production-secure, and they should not be described as authenticated encryption, safe redaction, or secure access control without a future sealed construction and external review.
