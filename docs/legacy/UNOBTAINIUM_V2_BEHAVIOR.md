# Unobtainium v2 Legacy Behavior

This document summarizes the behavior currently implemented in `unobtainium.js`. It is descriptive only. It is not a security claim and does not propose a refactor.

## Construction

The exported class accepts a key source and an optional options object. A string ending in `.stl` is parsed as a binary STL file. A string ending in `son` is loaded with `require`, which covers `.json` by checking the final three letters. A plain object is used directly as the key.

The expected object key shape is:

```json
{ "poly": [[0, 0, 0], [1, 0, 0], [0, 1, 0]] }
```

The constructor initializes:

- `data` to `null`
- `point`, `shift`, and `gap` from options or `0`
- `keepPosition` from options or `false`
- `floor` from options or `0`

Falsy option values are treated as defaults.

## STL Consumption

Binary STL data is read from byte offset 80. The triangle count is read as little-endian `Uint32`. Each triangle contributes three vertex points. Negative coordinates are normalized by adding the absolute value of the smallest coordinate per axis.

## Data Flow

`read(data)` stores the provided data object by reference in `this.data`. The common path uses a `Buffer`.

`obscure()` mutates `this.data` in place by applying a point-derived shift to each byte-like element.

`obtain()` mutates `this.data` in place by applying the inverse operation for each byte-like element.

Both methods return a `Promise` that resolves after the synchronous loop completes.

`writeTo(file)` writes `this.data` asynchronously with Node's `fs.writeFile`.

## Geometric Mask Step

For each byte, v2 selects:

- point 1: `point`
- point 2: `(point + shift + 1) % poly.length`
- point 3: `(point + shift + gap + 2) % poly.length`

`triangulate()` computes distances between those points and returns an angle in degrees using the law of cosines. The angle selects one of eight arithmetic branches. Each branch combines the current point's x, y, and z values with either `Math.floor` or `Math.ceil`, then applies modulo `(15 - floor)` and adds `floor`.

For angles below 75 degrees, `obscure()` adds the shift. For angles at or above 75 degrees, `obscure()` subtracts the shift. `obtain()` reverses those directions.

## Walk Advancement

After each byte, if `point` is at the final point, `shift` advances modulo `poly.length - 1`. If `shift` was at `poly.length - 2`, `gap` also advances modulo `poly.length - 2`. Then `point` advances modulo `poly.length`.

If `keepPosition` is false, `point`, `shift`, and `gap` are reset to `0` after `obscure()` or `obtain()`. If `keepPosition` is true, the final walk state is retained.

## Package Entry

`index.js` requires `yargs`, defines a CLI shell, instantiates that shell when `yargs.argv` is present, and then exports the Unobtainium class. In normal package use, `require('unobtainium-enc')` returns the constructor but may also run the current CLI initialization path.

