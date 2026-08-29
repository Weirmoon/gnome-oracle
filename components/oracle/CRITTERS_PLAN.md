# Plan: ambient critter side-events

## Context

The 3D oracle avatar (Steps 0–7, see `~/.claude/plans/are-you-capable-...md`) is
built and the responding-animation infra (phase machine, `Particles`, pose
blending, lip-sync) is in place. This adds **ambient critters**: small whimsical
creatures that wander into the scene while the oracle is idle, get a short
Ollama-generated in-persona reaction line, provoke a gnome animation (cast
spells, wave away, pause fondly, …), then leave.

Purely cosmetic flavour. A critter event **never** blocks or delays a real
question and is cancelled the instant the user asks one. This work slots in
**after** Step 7 as Steps 8–11.

### Decisions taken (flag if wrong)

- **3D only.** The 2D `OracleCanvas` fallback ignores critters. (A cheap
  emoji-sprite version is a later stretch.)
- **Manual trigger = type `/fairy` (or `/dragon`, …) as the whole ask input** →
  intercepted in `ask()` before it hits `/api/ask`. Plus a "Summon" button row
  in Settings for showcasing.
- **Ambient loop on by default**, random 60–150 s while idle; Settings toggle
  `gnome.critters`; force-off under `prefers-reduced-motion`.
- Quips are **spoken via TTS** (respecting the voice toggle) and shown in a
  small caption near the stage — **not** the main answer bubble, and **not**
  written to history.
- **Offline-safe:** if Ollama is unreachable, each critter has a small list of
  hard-coded fallback lines so ambient events still feel alive.
- Tone stays whimsical/comedic — no genuinely hostile or scary beats.

---

## Data model — `components/oracle/critters/catalog.ts`

```ts
export type CritterId =
  | "fairy" | "dragon" | "deer" | "wisp" | "imp" | "raincloud"
  | "moth" | "snail" | "crow" | "fireflies" | "gust" | "toad";

export type CritterReaction =
  | "zap"      // turn, cast bolts at it, shoo — brows down, muttering
  | "swat"     // big sweeping hand waves, head shake, lean back
  | "startle"  // jump + scale pop + eyes wide, settle into a glare
  | "calm"     // slow down, head tracks it gently, soft smile, no attack
  | "guard"    // staff raised and HELD, weight back, tense stillness
  | "grab-hat" // hat parents to the critter; hand to bare head; fist shake
  | "wait";    // foot/hand tap loop, eye-roll, one big exasperated sigh

export interface Critter {
  id: CritterId;
  name: string;
  emoji: string;
  reaction: CritterReaction;
  path: "flit" | "swoop" | "walk" | "drift" | "burst" | "descend";
  side: "left" | "right" | "top" | "front";
  durationMs: number;          // whole event: enter + react + exit
  tint: string;                // critter glow + its particle colour
  sfx: "sparkle" | "rumble" | "soft" | "buzz" | "gust" | "caw";
  promptHint: string;          // appended to the persona system prompt
  fallbackLines: string[];     // used when Ollama is down
  weight: number;              // ambient random-picker weight
}
```

### Roster (12)

| id | reaction | path | note |
|---|---|---|---|
| `fairy` | zap | flit / left | tugs his beard, dodges the bolts, sticks tongue out |
| `imp` | zap | burst / right | swipes a trinket, cackles |
| `raincloud` | swat | drift / top | parks overhead and drizzles on him |
| `dragon` | guard | descend / front | lands with a thud, snorts smoke; he's wary, not attacking |
| `crow` | grab-hat | swoop / top | snatches the hat, hops off smug |
| `gust` | startle | burst / left | sudden wind, nearly takes the hat |
| `deer` | calm | walk / right | wanders up, watches quietly — a soft beat |
| `moth` | calm | flit / top | drawn to the staff-orb light |
| `fireflies` | calm | drift / front | a swarm gathers into a shape |
| `toad` | calm | walk / front | sits, blinks, croaks once |
| `snail` | wait | walk / front | inches across; he addresses it as his pet (persona callback) |
| `wisp` | startle | drift / right | bobs up behind him, then drifts away shyly |

`promptHint` examples:
- fairy: `"A tiny glowing fairy is buzzing round your head, yanking your beard. React with brief, playful exasperation and a mock threat. ONE short line."`
- dragon: `"A dog-sized dragon just thudded down in front of you, snorting smoke. You're wary but acting unbothered. ONE short line."`
- deer: `"A gentle deer wandered up and is watching you. Pause and react softly, almost fondly. ONE short line."`
- snail: `"A snail is very slowly crossing in front of you. React with fond impatience — you may call it your pet. ONE short line."`
- crow: `"A crow just stole your hat and is hopping away with it. React, outraged. ONE short line."`

---

## API — `app/api/quip/route.ts`

Near-clone of `app/api/ask/route.ts`:

- body `{ characterId: number, critterId: CritterId, mood?: string }`
- system prompt = `persona.system_prompt + MOOD_PROMPTS[mood] + critter.promptHint +
  " Stay fully in character. No asterisk stage directions. Exactly one short line."`
- `streamChat({ messages, temperature: persona.temperature + 0.1, numPredict: 60 })`
- streams plain text through `ndjsonToTextStream` (reuse), **no** history write,
  **no** `X-History-Id`
- on `streamChat` throw → `textResponse(pickRandom(critter.fallbackLines))`

Validate `critterId` against the catalog; 400 otherwise.

---

## Client — `components/oracle/critters/useCritterEvents.ts`

Hook owned by `OracleAvatar3D`.

State: `active: { critter: Critter; phase: "enter" | "react" | "exit"; t: number } | null`
and `dir: {x: number; y: number}` (normalised direction from gnome → critter,
fed to `GnomeModel`).

- **Ambient loop:** `setTimeout(rand(60_000, 150_000))`; on fire, start a critter
  **only if** `phaseRef === "idle"` (from `useOraclePhase`), `document` visible,
  toggle on, tier not `low`, and `active == null`. Pick by `weight`.
- **`summon(id)`** — imperative, ignores the idle guard (manual = always plays).
- **Sequence** (driven from the frame loop via a small ref clock):
  1. `enter` — critter model animates along `path` toward a hover/stand point;
     `sound.critterCue(critter.sfx)`.
  2. `react` — fire `/api/quip`; stream → small caption + `tts.feed()`; set
     `GnomeModel`'s `critterReaction = critter.reaction` and keep `dir` updated
     from the critter's live position. For `zap`/`guard`, `GnomeModel` also
     calls `particles.beam(...)` on each staff thrust.
  3. `exit` — critter leaves along the reverse path; caption fades; reaction
     clears back to `idle` pose.
- **Hard cancel:** if `streaming` rises (real question) → despawn critter
  immediately, clear caption, `tts.cancel()` only if it was a quip (track a flag).

---

## Triggers

**`app/page.tsx` `ask()`** — before the fetch:
```ts
const slash = /^\/([a-z]+)\s*$/i.exec(question.trim());
if (slash && isCritterId(slash[1].toLowerCase())) {
  critterApi.current?.summon(slash[1].toLowerCase() as CritterId);
  setQuestion("");
  return;
}
```
`critterApi` is a ref passed down to `OracleAvatar` → `OracleAvatar3D` and
populated via `useImperativeHandle` on the critter hook.

**Settings panel** — new rows:
- toggle **"Ambient critters"** → `localStorage["gnome.critters"]` (default `"1"`,
  coerced to off when `prefers-reduced-motion`).
- a wrap of small **summon buttons** (one per catalog entry, emoji + name).

---

## Animation — `GnomeModel.tsx`

New optional props: `critterReaction?: CritterReaction | null`, `critterDir?: {x;y}`.

In the single `useFrame`, when `critterReaction` is set it **overrides** the phase
pose (it's higher priority than idle, lower than a real `thinking`/`speaking` —
in practice critters only fire from idle so no conflict):

| reaction | rig drive |
|---|---|
| `zap` | `torso.rotation.y` + `head` turn toward `dir`; right arm/staff thrusts forward on a 0→1→0 curve, 2–3 times over the window; `particles.beam(orbWorldPos, critterWorldPos, tint, 10)` per thrust; brows furrowed; mouth muttering via lipSync sine |
| `swat` | near hand big sweeping arcs (`sin` on `armX.rotation.z` + `.x`); head shake (`headYaw` oscillation); slight lean back |
| `startle` | one-shot: `root.scale` pop + `root.position.y` spike, `eyeWide → 1`; then ease into a glare (`brow → -0.8`, lean toward `dir`) |
| `calm` | `bobRate ×0.5`; `head` eased to track `dir`; `brow → +0.3`, tiny mouth curve; **no** arm motion |
| `guard` | right arm/staff eased to a raised hold; `lean` back; `head` tracks `dir`; slow sway; no thrust |
| `grab-hat` | on enter-react edge: reparent `hat` group under the critter (or hide + spawn a copy on the critter); hand shoots to head; then `headYaw` frustrated shake |
| `wait` | `handR`/foot tap loop; periodic `headRoll` eye-roll; one slow full `jaw` open (sigh) mid-window |

**`Particles.tsx`** gains a directed mode:
```ts
beam(from: Vector3, to: Vector3, color: string, n: number): void
```
— spawn `n` shards along `from→to` with forward velocity toward `to` + small
spread + short life; on arrival a 4-shard `pop` at `to`. Reuses the existing
pool; reads as a spell-bolt stream.

---

## Sound — `lib/sound.ts`

- `critterCue(kind)` — oscillator-synth per `sfx`: `sparkle` rising arp, `rumble`
  low sine + slow tremolo, `soft` gentle pad chord, `buzz` fast AM square,
  `gust` filtered-noise whoosh, `caw` two short square blips.
- `spellZap()` — fast downward pitch sweep + tiny noise burst, fired per bolt
  thrust.

All match the existing per-persona `SfxTheme` gain bus and volume controls.

---

## Steps (append to the plan as 8–11)

### Step 8 — infra, no critter models
- `critters/catalog.ts` with 3 seed rows (fairy, dragon, deer) + `isCritterId`.
- `app/api/quip/route.ts` + offline fallback lines.
- `critters/useCritterEvents.ts` (ambient loop + `summon`), imperative handle
  threaded `page.tsx → OracleAvatar → OracleAvatar3D`.
- `/fairy` interception in `ask()`; Settings toggle + summon buttons.
- `GnomeModel`: `swat` reaction only, driven for every critter.
- Critter = a labelled placeholder sphere that flies in and out.
- **Done:** typing `/fairy` (Ollama up or down) → the oracle mutters a line in a
  caption + waves; ambient fires only while idle; toggle stops it.

### Step 9 — the fairy, end to end
- `critters/Fairy.tsx` — model + `flit` path + `recoil()`.
- `zap` reaction channel in `GnomeModel`; `Particles.beam`; `critterCue` +
  `spellZap`.
- `<CritterStage>` component that lazy-mounts the active critter model.
- **Done:** `/fairy` plays a full cast-and-shoo with spell bolts and the fairy
  dodging; this is the template.

### Step 10 — roster rollout
- Remaining 9 critter models + catalog rows + fallback lines.
- Reaction channels `calm`, `guard`, `startle`, `grab-hat`, `wait`.
- **Done:** all 12 summonable; each recognisable, each a distinct beat.

### Step 11 — polish
- Ambient weighting + interval tuning; per-session no-repeat.
- Gating: `low` tier → fewer critters, simpler paths, no `beam` spread;
  reduced-motion → ambient fully off; mobile → longer intervals.
- Caption styling (`.critter-quip`, fades, sits under the stage).
- Don't-interrupt: never fire within 8 s of an answer finishing.
- `renderer.info` leak check cycling every critter; dispose models on despawn.

---

## Verification

- `/fairy`, `/dragon`, `/deer` — **Ollama down** (fallback lines) and **up**
  (persona-voiced quips). Line is short, in character, spoken, in the small
  caption — never in the main bubble, never in `/history`.
- Ambient: fires only while idle + tab visible + toggle on; **never** mid-answer;
  asking a question mid-critter despawns it instantly with no residue.
- Settings toggle off → ambient stops, `/fairy` still works.
- `prefers-reduced-motion` on → no ambient critters at all.
- `npm run build` green; `/` First Load JS unchanged (critter code rides the
  existing lazy `three` chunk).
- Cycle all 12 via summon buttons → no console errors, no GPU-memory growth.

## Files

- new: `components/oracle/critters/` (`catalog.ts`, `useCritterEvents.ts`,
  `CritterStage.tsx`, one model per critter)
- new: `app/api/quip/route.ts`
- edit: `components/oracle/GnomeModel.tsx` (reaction channels),
  `components/oracle/Particles.tsx` (`beam`),
  `components/oracle/OracleAvatar3D.tsx` + `OracleAvatar.tsx` (thread the handle),
  `app/page.tsx` (`/slash` intercept, Settings rows),
  `lib/sound.ts` (`critterCue`, `spellZap`),
  `app/globals.css` (`.critter-quip`)
