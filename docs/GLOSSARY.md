# Glossary

mesh: A 3D model representation made from vertices, edges, faces, or triangles. In this project, a mesh is only useful after it is converted into an ordered point cloud.

ordered point cloud: A sequence of 3D points where order is part of the key material. Reordering identical points can change the mask stream.

walk state: The current cursor state used to choose points from the ordered point cloud. In v2 this is tracked by point, shift, and gap.

point/shift/gap: The three v2 cursor values. `point` chooses the first point, `shift` offsets the second point, and `gap` offsets the third point.

three-hand walk: A walk that advances three cursor roles over the point ring to select a triangle-like sample for each mask step.

ring/window: The finite ordered point list treated as a wraparound ring, and the current selected window of points used to derive a mask value.

turns/rotation depth: The number of completed advances through the point ring or deeper walk cycles.

minShift: A proposed v3 name for the minimum nonzero mask shift. The v2 option `floor` plays this role for byte shifts.

point packet: A proposed packet envelope that records payload bytes plus the geometry, walk, and mode metadata needed to reproduce or verify a transform.

UN-GWM: Unobtainium Geometric Walk Mask, the raw family of modes that derive mask values from an ordered 3D point-cloud walk.

UNPKT: A proposed packet format for carrying masked data and explicit walk metadata.

UNSTACK: A proposed manifest for composing multiple transforms or packets in a declared order.

UNSTACK-SIGNED: A proposed signed stack manifest that provides provenance or tamper evidence for stack metadata.

UN-GATE: A proposed policy gate that rejects unsafe modes, weak geometry, unknown stack versions, or missing sealed-mode requirements.

UNPATCH: A proposed patch format for explicit, controlled malleability or delta workflows.

UN-GEN: A proposed deterministic generative geometry mode for creating ordered point clouds from reproducible parameters.

UN-FIT: A proposed mode for fitting or adapting point clouds to target constraints.

UN-CASCADE: A proposed mode for chaining multiple point-cloud masks.

UN-STEG: A proposed mode for embedding point packets or stack data into a carrier medium.

UN-KEYFILE: A proposed canonical key file format for ordered point clouds, normalization rules, metadata, and fingerprints.

sealed mode: A future mode that authenticates data and metadata before returning obtained data.

malleable mode: A mode that intentionally allows controlled changes or patches and does not promise tamper rejection.

mask horizon: The number of mask steps before the walk state and mask pattern repeat for a given point cloud and parameter set.

