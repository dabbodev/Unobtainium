# UN-GWM-V2 Static Visual Demo

This is a minimal static local fixture viewer for the `UN-GWM-V2` /
`UN-TRIAD-MIX` visual explanation. It renders the checked-in fixture at
`docs/examples/gwm-v2-visual-demo-fixture.json` and highlights ordered source
points, deterministic walk options, selected ordered triads, and deterministic
feature summaries. It also displays fixture-backed stream records, adapter
descriptors, isolated proof summary fields, and the explicit opt-in
`UN-GWM-V2` descriptor/mode commitment chain.

## Run Locally

Serve the repository root with any simple static server, then open:

```text
http://localhost:PORT/demo/gwm-v2-visual/
```

For example:

```text
npx http-server .
```

Some browsers block `fetch()` from `file://` pages, so opening
`index.html` directly may fail to load the JSON fixture. Serving the repo
root keeps the relative fixture path available:

```text
../../docs/examples/gwm-v2-visual-demo-fixture.json
```

## Scope

- Uses static fixture data only.
- Experimental and not production cryptography.
- Shows ordered geometry as part of fixture key identity.
- Treats walk options and feature extraction as deterministic demo material.
- Treats stream, adapter, proof, descriptor, and mode-wrapper panels as
  deterministic descriptors and summaries, not applied transforms.
- Does not upload files.
- Does not provide file import controls.
- Does not provide CLI/file wrappers.
- Does not perform live encryption or run core transform logic.
- Does not generate commitments or `.un` artifacts.
- Does not use external CDN resources, WebGL, canvas, or build tooling.

Live generated-data bridges, STL import, file import, WebGL/canvas views,
and a browser playground remain future scope.
