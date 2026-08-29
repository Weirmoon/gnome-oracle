# Adding a critter

The repeatable checklist for a new ambient-critter species. Critters render in
**both** the 3D avatar (`OracleAvatar3D` → `CritterStage` → `models.tsx`) and the
2D fallback (`components/OracleCanvas.tsx`). The ambient loop + `summon` are owned
by `components/oracle/OracleAvatar.tsx` (`useCritterEvents`), shared by both.

## 1. Reference art

Generate a sheet with the **critter master style block** from
`../REFERENCE_PROMPTS.md` ("Critter master style block" — soft painted low-poly,
the warm contrast to the faceted crystal gnome). Include a turnaround plus 2–3
action poses. **Always attach the locked base-gnome image** (sheet #1) so scale
and world stay consistent.

```
[critter master block]
<Species>, <size relative to the gnome>. <key silhouette features>, <coat/skin>,
<eyes>. 4 views: standing/hover turnaround (front + 3/4 + back), then poses
labelled "<action A>" and "<action B>".
```

Save the PNG to `assets/critter-reference-lowpoly/` with the **next `Cxx`
number** and add a row to the index below. Note the critter's accent / glow
colour — it becomes `catalog.ts` `tint`.

### Sheet index (`assets/critter-reference-lowpoly/`)

The `Cxx` filenames do **not** match the old `C1..C14` headings in
`REFERENCE_PROMPTS.md`. Actual contents:

| File | Contents |
|---|---|
| C01 | Imp turnaround + poses |
| C02 | Dust gust |
| C03 | Raincloud |
| C04 | Toad |
| C05 | Luna moth |
| C06 | Composite scenes (painted, **red** dragon, deer, fairy, crow, snail) |
| C07 | Snail |
| C08 | VFX studies (spell bolt / shoo gust / fairy dust) |
| C09 | Crow (with stolen hat) |
| C10 | Fireflies swarm |
| C11 | Dust gust (alt / turnaround) |
| C12 | Toad (alt turnaround) |
| C13 | Composite scenes (low-poly, **green** dragon, deer, fairy, crow, snail) — **the dragon's canonical colour** |
| C14 | Imp turnaround + spell-bolt / shoo-gust / fairy-trail VFX |

There is no dedicated deer or dragon sheet — both appear only inside the C06 /
C13 composites.

## 2. `catalog.ts` — client-safe metadata

Add the id to the `CritterId` union and a `CRITTERS` row:

```ts
newcritter: {
  id: "newcritter", name: "New Critter", emoji: "🦫",
  reaction: "calm",      // one of the 7: zap|swat|startle|calm|guard|grab-hat|wait
  path: "walk",          // flit|swoop|walk|drift|burst|descend
  side: "right",         // left|right|top|front
  durationMs: 9000,      // whole event: enter + react + exit
  tint: "#a0b070",       // the noted glow colour — also the spell-particle colour
  sfx: "soft",           // sparkle|rumble|soft|buzz|gust|caw
  weight: 8,             // ambient random-picker weight
},
```

`isCritterId` and `pickCritter` pick it up automatically.

## 3. `prompts.server.ts` — server-only prose

Add a `CRITTER_PROMPTS` row: a `hint` (appended to the persona system prompt) and
3+ `fallbackLines` (used when Ollama is down). TypeScript errors until this row
exists — that is the reminder. This file is never shipped to the browser.

## 4. 3D model — `models.tsx`

Two ways in, and they coexist — the glTF wins when present, the procedural one is
the fallback.

**Preferred: an authored glTF.** Drop `<id>.glb` into `public/critters/` and add
an entry to `critterModels.ts` (`file`, `scale`, `yaw`, `y`, optional `clip`).
See `public/critters/README.md` for the authoring contract (Y-up, ground critters
face +X / fliers +Z, origin between the feet, ≤ ~200 KB). `CritterModel` loads it
through `GltfCritter` with Suspense + an error boundary, so a missing or broken
file silently degrades to the procedural model.

**Fallback: a procedural model.** Add a function returning a `<group scale={S}>`
of primitive meshes — reuse the shared module-scope geometry (`ball`, `cone`,
`capsule`, `wingGeo`), the `soft()` / `glow()` helpers, `<Eyes>`, the
`Quadruped()` / `QuillBeast()` bases — and a `case` in `ProceduralCritter`.
Author around a roughly unit-tall origin; the wrapping `scale` does the world
sizing (gnome head radius ~0.46, he stands ~2.2 units; a shoulder-height critter
wants `scale` ≈ 1.1, a palm-sized one ≈ 0.35).

## 5. 2D model — `components/OracleCanvas.tsx`

Add a `case` to `drawCritter(ctx, id, t)` — ~15–45 `ctx` path ops around a local
origin, **facing +x**, sized to read against the ~52px gnome head. Flat fills
only (this is the low-power renderer); pull colours from the `CC` palette so 2D
and 3D look like the same creature. If the new critter is small, add it to
`CRITTER_SCALE`. If it stands on the ground rather than hovers, add it to
`GROUNDED`.

`critterView()` already handles enter/hold/exit travel from the `side`, the head
turn, `grab-hat` hat-hiding and the `zap` spell sparkles — no change needed there
unless the critter needs a genuinely new motion.

## 6. `CritterStage.tsx` — only if the path/side is new

If the `path` or `side` isn't already in the `ENTRY` / `HOLD` tables (or needs
its own idle wobble), add an entry.

## 7. Verify

- `npm run dev` → type `/<id>` as the whole ask input, or use Settings →
  **Summon**. Check in **both** 3D and 2D (Settings → Avatar → 2D).
- Ollama up → persona-voiced quip in the small caption; Ollama down → a fallback
  line. Never in the main answer bubble, never in `/history`.
- Ambient fires only while idle; asking a real question despawns it instantly.
- Cycle every critter via Summon watching `renderer.info.memory` (3D) for leaks.
- `npm run build` green; `/` First Load JS unchanged (`catalog.ts` must stay free
  of `three` and browser/node-only APIs).
