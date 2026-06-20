# Legacy Demo Repositories

Status: archaeology and reference material. These repositories capture earlier interactive demos and browser workflows, but they are not source-of-truth for v3 core behavior.

Current v3 behavior is governed by this repository's docs and tests. Old demo mechanics should not override v3 specs without a deliberate migration decision.

## UnDemo-Builder

Repository: `dabbodev/UnDemo-Builder`

Live demo reference: <https://undemo-builder.web.app/>

Purpose: visual mask mechanics demo.

`UnDemo-Builder` is the original visual mechanics playground. It shows the old idea in a form that is easy to inspect: users manually enter 3D point rows, generate a visible mask, shift local hex data up or down, and copy the output back into the input for round-trip experiments.

Important behaviors to preserve as archaeology:

- Manual point table: users can enter at least three 3D points and see the point rows as the key material for the demo.
- "I'm Feelin Lucky": a random-point helper that quickly populates point data for visual experimentation.
- Local file chunk import: the demo reads a local file from the browser and displays a chunk of its hex data without uploading it.
- Visible signed mask generation: users can inspect generated mask values before applying them.
- Up/Down ring16 behavior: the demo shifts hex characters through the 16-value ring in the forward or reverse direction.
- Copy target back to input: users can copy output into input to run the reverse operation and demonstrate the reversible mechanics.

Why it matters for a future v3 playground:

- It demonstrates the learning loop a v3 playground should keep: enter or generate points, inspect derived instructions or masks, apply a transform, and reverse it.
- It shows which old affordances made the mechanics understandable: visible point rows, visible masks, local-only input, and explicit forward/reverse controls.
- It should inform UI and demo ergonomics, not define v3 core semantics.

## undemo-encryptor

Repository: `dabbodev/undemo-encryptor`

Live demo reference: <https://undemo-encryptor.web.app/>

Purpose: browser file/key encrypt/decrypt demo.

`undemo-encryptor` is the browser-oriented file workflow demo. It pairs local key handling with browser-only file encrypt/decrypt operations and demonstrates how the old mechanics were presented to end users.

Important behaviors to preserve as archaeology:

- Browser-only local file workflow: files are selected and processed in the browser without being uploaded to a server.
- Key JSON import/export: users can save and reload JSON key material.
- STL import behavior: the demo accepts STL model input as key material for the old point extraction path.
- File encrypt/decrypt flow: users can run local file encryption and decryption from the browser UI.
- Hex/ring16 mechanics: the demo reflects the original hex-character ring shifting model.
- Local-only/no-upload promise: the browser demo is built around the explicit expectation that selected files remain local.

Why it matters for a future v3 playground:

- It identifies browser workflows that are still useful: local key generation, key import/export, STL/key import experiments, local file selection, and downloadable output.
- It gives the future v3 playground a compatibility target for user expectations while still allowing v3 to expose stacks, packets, commitments, gates, and descriptors.
- It is reference material only. Any behavior migrated into v3 should be specified in this repository, covered by tests where appropriate, and framed with current security disclaimers.

## Authority Boundary

The side repositories are demo/mechanics archaeology. They may help explain where an idea came from and what a future playground might make visible, but they do not define v3 behavior.

For v3:

- Current repository docs and tests are authoritative.
- Legacy demo behavior should not override v3 specs.
- Any migration from old demos into v3 should be an explicit design decision with updated docs and tests.
- Browser demos should keep the local-only privacy expectation clear, but that promise is separate from cryptographic security.
