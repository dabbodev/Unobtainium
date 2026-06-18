# Known Legacy Issues

This list documents known issues in the current v2 code. It is not exhaustive and does not change runtime behavior.

- Raw mode is unauthenticated and malleable.
- The same key and starting walk state can be reused without nonce or domain separation.
- Small point clouds can produce short mask horizons.
- Degenerate geometry can produce division by zero, `NaN`, or weak shift values.
- Buffer writes wrap values modulo 256 through Node Buffer assignment behavior.
- `read(data)` stores the input by reference, so `obscure()` and `obtain()` mutate the caller-provided buffer.
- Constructor option defaults use truthiness, so falsy explicit values are indistinguishable from omitted values.
- The `.json` loader is detected by checking whether the filename suffix is `son`.
- `consume()` and `getSignature()` are declared `async` but perform synchronous work internally.
- `index.js` instantiates the CLI shell during package import because `yargs.argv` is always an object.
- `package.json` declares `ISC`, while `LICENSE` contains GPL-3.0 text.
- `package-lock.json` currently reports package version `1.1.0`, while `package.json` reports `2.0.0`.

