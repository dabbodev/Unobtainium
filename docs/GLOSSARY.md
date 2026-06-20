# Glossary

mesh: A 3D model representation made from vertices, edges, faces, or triangles. In this project, a mesh is only useful after it is converted into an ordered point cloud.

ordered point cloud: A sequence of 3D points where order is part of the key material. Reordering identical points can change the mask stream.

walk state: The current cursor state used to choose points from the ordered point cloud. In v2 this is tracked by point, shift, and gap.

point/shift/gap: The three v2 cursor values. `point` chooses the first point, `shift` offsets the second point, and `gap` offsets the third point.

three-hand walk: A walk that advances three cursor roles over the point ring to select a triangle-like sample for each mask step.

ring/window: The finite ordered point list treated as a wraparound ring, and the current selected window of points used to derive a mask value.

turns/rotation depth: The number of completed advances through the point ring or deeper walk cycles.

minShift: A proposed v3 name for the minimum nonzero mask shift. The v2 option `floor` plays this role for byte shifts.

geometry oracle: The deterministic geometry layer that converts a selected point triple into measured properties such as side lengths, angle, and degeneracy status. It is an oracle in the design sense only; it is not a security boundary.

angle bucket: A stable named range for a triangle angle. Sprint 3 preserves the legacy-inspired angle boundaries while adding an explicit `degenerate` bucket for triples that should not produce ordinary angle-derived rules.

coordinate rule: A data-driven formula that maps a primary point's coordinates to a raw integer shift value, such as `floor(x + y + z)` or `ceil(x - y - z)`, before ring and minShift adjustment.

degenerate triple: A selected three-point sample that cannot form a useful triangle because points repeat, an edge has zero length, coordinates are non-finite, or the geometry collapses into an impossible or zero-area triangle.

mask instruction: A deterministic v3 object describing one UN-GWM mask step: selected indices and points, angle or degeneracy status, bucket and rule IDs, raw shift, adjusted shift, window parameters, mode, and before/after walk states. A mask instruction describes what a later transform should do; it does not mutate payload data by itself.

instruction stream: An ordered list of mask instructions generated from an initial mesh, walk state, window, minimum shift, bucket table, and rule table. The stream records the starting walk state and final walk state so a transform can be reproduced without hidden mutable runtime state.

UN-ROTATE: The first v3 in-memory data transform. UN-ROTATE consumes a mask instruction stream and applies reversible ring rotations to payload values. It is experimental and is not a security claim.

rotate transform: The Sprint 4 transform layer that applies each instruction's `shift` and `windowSize` to the corresponding data position. It consumes instructions and ring helpers, not triangle geometry internals.

transform direction: The declared direction for a rotate transform. `up` applies a positive ring rotation and `down` applies the inverse rotation.

transform turns: The integer rotation multiplier applied to each instruction shift before ring rotation. Turns normalize through the instruction window, so a full ring of turns is identity for that window.

point packet: An ordered 3D coordinate packet derived from context, nonce, or random material. Point packets may be public. They perturb, bind, diversify, and contextualize a private mesh, but they do not provide secrecy by themselves.

UNPKT: The v3 working packet family for ordered point packets. Current first-pass UNPKT packets contain packet metadata, ordered fixed-point integer point triples, and a stable commitment over canonical packet fields.

UNPKT-CONTEXT: A deterministic point packet derived from supplied context material, such as public session or application context.

UNPKT-NONCE: A deterministic point packet derived from supplied nonce bytes or a nonce string.

UNPKT-RANDOM: A point packet derived from cryptographic random bytes by default. It can accept an injected random-byte source for deterministic tests.

point packet commitment: A stable SHA-256 digest over canonical packet fields: packet type, version, point count, scale, coordinate range, and ordered point triples. The commitment excludes source functions and does not create secrecy by itself.

packet graft: The process of combining a base mesh with a point packet's ordered points to produce an effective mesh for instruction generation.

append graft: A packet graft mode that places base mesh points first and packet points after them.

prepend graft: A packet graft mode that places packet points first and base mesh points after them.

sandwich graft: A packet graft mode that splits packet points into two ordered halves, places the first half before the base mesh, and places the second half after the base mesh.

anchored walk state: A deterministic `{ point, shift, gap }` state derived from a point packet commitment and a target mesh point count. It anchors instruction-stream generation to packet material without mutating the packet.

UN-GWM: Unobtainium Geometric Walk Mask, the raw family of modes that derive mask values from an ordered 3D point-cloud walk.

UNSTACK: The v3 unsigned stack recipe format for composing multiple ordered transform layers. The current runtime supports `format: "UNSTACK"`, `version: 1`, a shared window size, stack metadata, and ordered `UN-ROTATE` and `UN-SWAP` layers.

stack layer: One ordered entry in a stack recipe. A layer declares a supported transform type, mesh, optional packet graft, walk state mode, minimum shift, and walk mode. `UN-ROTATE` layers add direction and turns. `UN-SWAP` layers add swap count.

stack recipe: The deterministic plain-data description of an unsigned stack. Recipe fields are intended to be inspectable and hashable; runtime-only fields and random source functions are not part of the recipe.

stack canonicalization: The deterministic serialization of a stack recipe for hashing. Object keys are sorted, array order is preserved, unsupported values are rejected, and known runtime-only fields are excluded.

stack commitment: A stable SHA-256 hex digest over a canonical stack recipe. It changes when recipe metadata, layer order, layer parameters, or packet commitments change. It is not a signature and does not create secrecy by itself.

layer order: The declared order in which stack layers apply. Reversal uses the same recipes in reverse order. Layer order is part of stack canonicalization and changes the stack commitment. Mixed `UN-ROTATE` and `UN-SWAP` stacks also make layer order payload-relevant because rotate changes values at positions while swap changes positions of values.

stack reversal: The operation that undoes a stack by applying each supported layer's reverse transform in reverse layer order.

unsigned stack: A stack recipe with no signature material. Sprint 6 implements unsigned stacks only.

UNSTACK-SIGNED: The v3 signed stack envelope format. Sprint 9 supports a first-pass envelope around an unsigned `UNSTACK` recipe, with format/version context, stack commitment, signer ID, purpose, metadata, Ed25519 public key, signature algorithm, signature value, and payload commitment.

signed stack envelope: A plain-data object that carries a normalized unsigned stack plus the signature fields needed to verify that stack commitment and related intent metadata. It protects recipe integrity and intent, not raw-mode cryptographic security by itself.

stack signature: The Ed25519 signature over the canonical signature payload for a signed stack envelope. The signature does not include its own signature value.

signer ID: A stable string naming the signer within the envelope, such as `owner:test`. Sprint 9 treats it as signed metadata only; it does not resolve identities, certificates, trust roots, or authorization.

signature payload: The canonical signed data for `UNSTACK-SIGNED`: signed-stack format/version context, stack commitment, signer ID, purpose, metadata, and algorithm. It intentionally signs the stack commitment rather than raw runtime objects or functions.

payload commitment: A SHA-256 hex digest over the canonical signature payload. It aids diagnostics and reproducibility checks, but it is not a substitute for signature verification.

owner-signed stack: A signed stack whose purpose marks the recipe as intended by an owner or controlling signer. Sprint 9 uses `owner-signed-stack` as the default purpose string without adding trust policy or authorization semantics.

layer-signed stack: A future-scope design direction where individual stack layers may carry signatures. It is not implemented in Sprint 9.

gate-signed stack: A future-scope design direction where policy gates or gate decisions may carry signatures. It is not implemented in Sprint 9.

patch-signed stack: A future-scope design direction where patch or delta material may influence stack policy. It is not implemented in Sprint 12.

UN-GATE: A proposed policy gate that rejects unsafe modes, weak geometry, unknown stack versions, or missing sealed-mode requirements.

UNPATCH: A v3 committed patch format for explicit, controlled malleability or delta workflows. Sprint 11 supports only bounded `"add"` patches and does not grant authorization by itself.

UNPATCH-SIGNED: The v3 signed patch envelope format. Sprint 12 supports a first-pass envelope around a committed `UNPATCH` object, with format/version context, patch commitment, signer ID, purpose, metadata, Ed25519 public key, signature algorithm, signature value, and payload commitment.

signed patch envelope: A plain-data object that carries a committed patch plus the signature fields needed to verify that patch commitment and related intent metadata. It protects signed patch intent and integrity, not authorization, decryption, or filesystem mutation rights.

patch signature: The Ed25519 signature over the canonical signed patch payload for a signed patch envelope. The signature does not include its own signature value.

signed patch payload: The canonical signed data for `UNPATCH-SIGNED`: signed-patch format/version context, explicit `UNPATCH-SIGNED:v1` domain separation, patch commitment, signer ID, purpose, metadata, and algorithm. It intentionally signs the patch commitment rather than raw runtime objects or functions.

patch payload commitment: A SHA-256 hex digest over the canonical signed patch payload. It aids diagnostics and reproducibility checks, but it is not a substitute for signature verification.

owner-signed patch: A signed patch whose purpose marks the committed patch as intended by an owner or controlling signer. Sprint 12 uses `owner-signed-patch` as the default purpose string without adding trust policy or authorization semantics.

patch authorization intent: The signed statement that a signer endorsed an exact committed patch for a purpose. It is not a full authorization policy; patch gates, capability checks, external trust policy, and production authorization semantics remain future scope.

add patch: The Sprint 11 UNPATCH operation that adds declared integer deltas to corresponding data positions modulo the patch window size.

patch commitment: A domain-separated SHA-256 hex digest over a canonical patch payload. It covers format/version, object ID, operation, range, deltas, window size, base object commitment, base slice commitment, signed-stack bindings, and metadata, but not the `patchCommitment` field itself.

base object commitment: The full-object commitment for the exact bytes a patch was created against.

base slice commitment: The slice commitment for the exact bounded range a patch was created against.

controlled malleability: An explicitly bounded workflow where changes are represented by committed patch objects. It is dangerous unless authorized by a higher-level policy and is not a cryptographic security claim.

patch gates/capability checks: Future-scope policy mechanisms that may decide whether a patch is allowed. Sprint 12 signed patches do not implement these checks.

patch decryption grant: A capability that would grant decryption or plaintext access. `UNPATCH-SIGNED` does not provide decryption grants.

patch inclusion proof: A future-scope Merkle or similar inclusion proof for patch sets or logs. Sprint 12 does not implement Merkle trees or inclusion proofs.

filesystem patching: Future-scope patch application against files or CLI workflows. Sprint 12 patch helpers operate in memory only.

patch reversal: The inverse of an add patch. It subtracts the committed deltas modulo the same window size to restore the pre-patch data when the matching object and patch are used.

UN-PERMUTE: The broader v3 position-permutation family. The current runtime implements only the pair-swap subset through UN-SWAP. Block-local shuffle, Fisher-Yates shuffle, interleave, and braid modes remain future scope.

UN-SWAP: The pair-swap position-permutation primitive. UN-SWAP consumes a swap plan and exchanges payload positions according to ordered swap pairs. It is supported as a standalone transform and as an unsigned UNSTACK layer.

swap plan: A deterministic `UN-SWAP-PLAN` object generated from a mesh, walk state, payload length, swap count, window size, minimum shift, and walk mode. It records metadata, ordered swap pairs, and before/after walk states.

swap pair: A two-integer position pair `[a, b]` inside a swap plan. Applying the pair exchanges payload positions `a` and `b`. A self-swap such as `[3, 3]` is a valid no-op.

swap plan commitment: A stable SHA-256 hex digest over the canonical plain-data representation of a swap plan. Ordered swaps and plan metadata affect the commitment. It is not a signature and does not create secrecy by itself.

positional permutation: A transform that changes where payload values sit while preserving the values themselves. UN-SWAP provides first-pass positional permutation through ordered pair swaps.

reverse swap transform: The inverse UN-SWAP operation. It applies the same swap pairs in reverse order to restore data that was transformed by the matching forward swap plan.

UN-KEYFILE: A v3 in-memory key material derivation format that turns normalized bytes, strings, buffers, typed arrays, or byte arrays plus optional passphrase, context, salt, and label into an ordered fixed-point 3D point cloud and descriptor commitment.

keyfile-derived mesh: The ordered point array produced by UN-KEYFILE. It can be used directly as mesh input for instruction streams, UN-ROTATE, UN-SWAP, packet grafts, and stack layers.

key mesh descriptor: A plain-data descriptor for a keyfile-derived mesh. It records format/version, derivation parameters, source type, input and optional material commitments, ordered points, and a mesh commitment.

input commitment: A SHA-256 hex digest over the normalized input bytes used by a key mesh descriptor.

mesh commitment: A SHA-256 hex digest over the canonical key mesh descriptor fields that define the derived mesh, excluding the `meshCommitment` field itself.

context key: Public, semi-public, or application-specific material used to diversify or bind a keyfile-derived mesh without necessarily providing secrecy by itself.

weak/public keyfile: Keyfile input that is public, predictable, reused, low entropy, or otherwise not secret. It can still be useful for context, demos, decoys, watermarks, puzzles, or reproducible tests, but it should not be treated as strong secret material.

strong/private keyfile: Keyfile input that is secret or difficult to predict, usually strengthened by appropriate passphrase, salt, or context choices. Sprint 13 records deterministic material only and does not certify strength.

UN-GEN: The v3 in-memory generation primitive that creates a blank substrate and materializes generated data by applying an existing UNSTACK recipe. It is not compression, steganography, fitting, optimization, filesystem support, or CLI support.

UN-GEN-DESCRIPTOR: The v3 generation manifest format for blank-substrate generation and residual reconstruction checks. It records generation settings, stack or signed-stack bindings, generated/target/residual commitments, metadata, and a descriptor commitment.

generation descriptor: A plain-data manifest for reproducing and checking `blank + stack -> generated` and, when residual material is supplied externally, `generated + residual -> target`.

generation manifest: A descriptive synonym for generation descriptor. It records committed settings and commitments, not compressed payload data or steganographic carrier data.

descriptor commitment: A domain-separated SHA-256 hex digest over the canonical generation descriptor payload, excluding the `descriptorCommitment` field itself. It validates recipe/materialization metadata and is not a production cryptographic security claim.

generated commitment: A SHA-256 hex digest over generated data values under the descriptor window.

residual commitment: A SHA-256 hex digest over normalized residual values under the descriptor window. A residual may be the same size as the target and is not a compression claim.

target commitment: A SHA-256 hex digest over target data values under the descriptor window.

UN-FIT: The broader working name for fitting or adapting point-cloud generation material to target constraints. Sprint 16 implements only supplied-candidate evaluation, not optimization or search.

UN-FIT-NAIVE: The Sprint 16 v3 deterministic evaluator that generates output from caller-supplied candidate stacks, computes residuals against a target, scores those residuals, and ranks candidates. It does not search, optimize, compress, or hide data.

candidate generation stack: A supplied unsigned UNSTACK recipe or UNSTACK-SIGNED envelope used by UN-FIT-NAIVE to materialize generated output from a blank substrate. It is an input candidate, not something Sprint 16 creates.

residual score: A diagnostic score object computed from residual values. It includes residual length, zero and nonzero counts, ring-aware absolute delta sum/mean/max, estimated JSON byte length, and exact-zero status. It is not a compression or security metric.

fit report: A deterministic UN-FIT-NAIVE-REPORT object containing target commitment, evaluation settings, candidate count, ranked candidate summaries, metadata, and a report commitment.

candidate ranking: The best-first order produced by UN-FIT-NAIVE: lowest nonzero residual count, then lowest sum of ring-aware absolute deltas, then lowest estimated JSON byte size, then candidate ID.

exact zero residual: A residual whose entries are all zero, meaning the candidate generated exactly the target under the declared ring and evaluation settings.

estimated JSON size: The UTF-8 byte length of JSON.stringify over residual values. It is only a diagnostic size estimate and is not a compression claim.

UN-CASCADE: A proposed mode for chaining multiple point-cloud masks.

UN-STEG: A proposed mode for embedding point packets or stack data into a carrier medium.

UN-ND: A future branch for N-dimensional point support. It would generalize current 3D point-cloud keys while preserving deterministic geometry, explicit degeneracy handling, and stable commitments.

N-dimensional point: An ordered coordinate vector with `N` numeric dimensions. Three N-dimensional points can still define an angle by using Euclidean vector differences, dot product, and vector lengths.

matrix key: A future key shape where key material is represented as a matrix, commonly with rows as points and columns as dimensions. Matrix keys would need explicit shape metadata and commitments.

matrix mutation: An explicit deterministic transition from one committed matrix key state to another, such as growing or pruning rows, changing dimensions, swapping axes, rotating rows or columns, or transposing shape where allowed.

key-state commitment: A commitment that binds a key state, transition recipe, or post-mutation state so verifiers can detect hidden or accidental key evolution.

UN-MATRIX-COMBINE: A future matrix recipe family for combining two equal-sized matrix keys into a larger tiled key, such as a 2x2 quadrant layout with declared flips, rotations, transposes, and placement policy.

tiled key: A matrix key built from source matrix tiles under an explicit placement and transform recipe.

public key tile: The public matrix tile in a split validation design. It may be inspected by observers but should not be enough to reconstruct the combined validation key by itself.

secret key tile: The private matrix tile supplied by an authorized verifier in a split validation design.

split validation certificate: A future certificate form that binds a public tile, secret tile commitment, signed combine recipe, combined key commitment, and data or gate commitments.

UN-CERT: A future split validation certificate branch where public and secret matrix tiles plus a signed combine recipe reconstruct a combined validation key for stack or gate checks.

UN-STENCIL: A future overlay branch where original and shifted/generated layers are related by committed region rules and context-bound stencil material.

UN-CUTOUT: A future redaction or reveal branch built on selected regions/cutouts between an original layer and a shifted/generated underlayer.

XOR stencil: Reversible stencil material defined by `X = P XOR S`, where `P` is an original layer and `S` is a shifted or generated layer. It must be context-bound and must not be reused across objects, ranges, certificates, recipes, or purposes.

cutout region: A declared byte, element, or geometric region where a stencil/cutout recipe changes whether original or shifted/generated material is visible.

shifted underlayer: The shifted or generated layer placed underneath an original layer for stencil or cutout experiments.

sealed mode: A future mode that authenticates data and metadata before returning obtained data.

malleable mode: A mode that intentionally allows controlled changes or patches and does not promise tamper rejection.

mask horizon: The number of mask steps before the walk state and mask pattern repeat for a given point cloud and parameter set.
