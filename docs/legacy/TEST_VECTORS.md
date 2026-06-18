# Legacy Test Vectors

These vectors capture current v2 behavior from `unobtainium.js`. They are regression fixtures, not security examples.

## Shared Object Key

```json
{ "poly": [[0,0,0],[1,0,0],[0,1,0],[0,0,1]] }
```

## Roundtrip

Input buffer:

```text
00 01 02 0f 10 7f ff
```

Expected behavior:

1. `obscure()` mutates the buffer.
2. `obtain()` on the same instance restores the original bytes.
3. With default `keepPosition=false`, the walk state is reset to `point=0`, `shift=0`, `gap=0` after each operation.

## Position Reset

Input buffer:

```text
01 02 03 04 05
```

With `keepPosition=false`, `obscure()` leaves:

```text
point=0 shift=0 gap=0
```

With `keepPosition=true`, `obscure()` leaves:

```text
point=1 shift=1 gap=0
```

## Floor Difference

Input buffer:

```text
01 02 03 04 05 06 07 08
```

With `floor=0`, `obscure()` currently produces:

```text
01 01 02 03 05 07 06 07
```

With `floor=1`, `obscure()` currently produces:

```text
00 00 03 04 04 08 07 06
```

