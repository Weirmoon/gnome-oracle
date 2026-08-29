# Authored critter models

Drop `.glb` files here to replace a critter's all-primitive model with a real
one. Each file is opt-in: add an entry to
`components/oracle/critters/critterModels.ts` pointing at the file, and that
critter switches over. Missing or broken files fall back to the procedural
model automatically, so you can fill these in one at a time.

## Authoring guidelines

| Property | Target |
|---|---|
| **Format** | `.glb` (binary glTF), embedded textures. Uncompressed, or Draco — if Draco, tell us so the decoder gets wired in. |
| **Up axis** | Y-up (glTF standard). |
| **Facing** | Ground critters (wolf, fox, deer, …) face **+X**. Fliers (owl, bat) face **+Z**. Use the `yaw` field in `critterModels.ts` to correct a model authored facing another way. |
| **Origin** | Between the feet, on the ground. Use the `y` field to nudge. |
| **Scale** | Roughly match the reference sheets against the gnome (his head radius is ~0.46, he stands ~2.2 units). A wolf is shoulder-height to him; a chameleon is knee-height. Fine-tune with the `scale` field rather than re-exporting. |
| **Budget** | A few thousand triangles is plenty. Keep textures ≤ 512px. Target ≤ ~200 KB per file. |
| **Materials** | Standard PBR (`KHR_materials` / metallic-roughness). The scene lights are a soft key + warm accent rim — bake nothing. |
| **Animation** (optional) | One looping idle/flap clip. Put its name in the `clip` field. |

## Source

The reference art is in `assets/critter-reference-lowpoly-2/critter-01..12.png`
(wolf, bobcat, fox, rabbit, raccoon, owl, bat, squirrel, hedgehog, goat,
porcupine, chameleon — in that order). Model from those, or run them through an
image-to-3D service and clean up the export.
