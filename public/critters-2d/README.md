# 2D critter sprites — "Sprite" avatar mode

Drop `<id>.png` here and add an entry to
`components/oracle/critters/sprites.ts` (`CRITTER_SPRITES`). In **Sprite** avatar
mode `OracleCanvas` draws the image instead of the faceted `drawCritter` trace;
anything missing or still loading falls back to the trace, so fill these in one
critter at a time.

The gnome itself stays procedurally drawn in every 2D mode — only the critters
change between **2D** (faceted traces) and **Sprite** (these PNGs).

## Cropping guide

| | |
|---|---|
| **Source** | `assets/critter-reference-lowpoly/` (original 12: fairy, dragon, deer, wisp, imp, raincloud, moth, snail, crow, fireflies, gust, toad) and `assets/critter-reference-lowpoly-2/` (wolf, bobcat, fox, rabbit, raccoon, owl, bat, squirrel, hedgehog, goat, porcupine, chameleon). |
| **Pose** | One clean **side / profile** pose (the "SIDE VIEW" cell is ideal), facing right. It's mirrored automatically when the critter appears on the gnome's other side. |
| **Background** | Fully transparent — knock out the flat grey. |
| **Trim** | Tight crop to the critter (no empty margin); square-ish canvas is fine. |
| **Size** | ~256–512 px on the long edge. Keep files small (< ~80 KB); PNG-8 with alpha is plenty. |

## Placing it

After adding the file, add its config and tune in the browser at
`/lab/critters?sprite2&only=<id>` (or just switch the app to Sprite mode):

```ts
fox: { file: "fox.png", h: 54 },          // h = drawn height in canvas units
owl: { file: "owl.png", h: 46, anchorY: 0.6 },  // raise anchorY for a tall standing pose
```

- `h` — drawn height; a critter reads at ~40–60 against the ~52 px gnome head.
- `anchorY` — 0…1, where the image sits vertically at the hold point. 0.5 (centre)
  matches the traces; raise toward 0.7 for a tall pose so it doesn't float.
