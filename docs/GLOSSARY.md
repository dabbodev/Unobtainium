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

UNSTACK-SIGNED: A proposed signed stack manifest that provides provenance or tamper evidence for stack metadata. It is future scope and is not implemented yet.

UN-GATE: A proposed policy gate that rejects unsafe modes, weak geometry, unknown stack versions, or missing sealed-mode requirements.

UNPATCH: A proposed patch format for explicit, controlled malleability or delta workflows.

UN-PERMUTE: The broader v3 position-permutation family. The current runtime implements only the pair-swap subset through UN-SWAP. Block-local shuffle, Fisher-Yates shuffle, interleave, and braid modes remain future scope.

UN-SWAP: The pair-swap position-permutation primitive. UN-SWAP consumes a swap plan and exchanges payload positions according to ordered swap pairs. It is supported as a standalone transform and as an unsigned UNSTACK layer.

swap plan: A deterministic `UN-SWAP-PLAN` object generated from a mesh, walk state, payload length, swap count, window size, minimum shift, and walk mode. It records metadata, ordered swap pairs, and before/after walk states.

swap pair: A two-integer position pair `[a, b]` inside a swap plan. Applying the pair exchanges payload positions `a` and `b`. A self-swap such as `[3, 3]` is a valid no-op.

swap plan commitment: A stable SHA-256 hex digest over the canonical plain-data representation of a swap plan. Ordered swaps and plan metadata affect the commitment. It is not a signature and does not create secrecy by itself.

positional permutation: A transform that changes where payload values sit while preserving the values themselves. UN-SWAP provides first-pass positional permutation through ordered pair swaps.

reverse swap transform: The inverse UN-SWAP operation. It applies the same swap pairs in reverse order to restore data that was transformed by the matching forward swap plan.

UN-GEN: A proposed deterministic generative geometry mode for creating ordered point clouds from reproducible parameters.

UN-FIT: A proposed mode for fitting or adapting point clouds to target constraints.

UN-CASCADE: A proposed mode for chaining multiple point-cloud masks.

UN-STEG: A proposed mode for embedding point packets or stack data into a carrier medium.

UN-KEYFILE: A proposed canonical key file format for ordered point clouds, normalization rules, metadata, and fingerprints.

sealed mode: A future mode that authenticates data and metadata before returning obtained data.

malleable mode: A mode that intentionally allows controlled changes or patches and does not promise tamper rejection.

mask horizon: The number of mask steps before the walk state and mask pattern repeat for a given point cloud and parameter set.
