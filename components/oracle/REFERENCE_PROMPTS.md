# Avatar reference-image prompts

Prompts for generating **modelling reference art** for the procedural 3D crystal
gnome (`components/oracle/`). These are not final assets — nothing is loaded at
runtime — they exist so the geometry in `parts/*.tsx`, `GnomeModel.tsx`, and the
materials in `parts/materials.ts` can be tuned against a consistent art target.

Generate them **in order**. Lock #1 first, then paste that image back into the
chat as a reference before each later sheet so the style doesn't drift.

Enum coverage (must all appear across the sheets):

| Category | File | Values |
|---|---|---|
| Hats | `parts/hats.tsx` | wizard, gnome, fedora, cork, cowboy, none |
| Torsos | `parts/torsos.tsx` | robe, lab-coat, chef-coat, yellow-shirt, martial-gi, beach-shirt, collared-shirt, fry-cook, pirate-coat, tactical-suit, detective-coat, field-vest, space-robe, mechanic-coveralls |
| Hair | `parts/hair.tsx` | none/bald, spiky-blue, nervous-brown, orange-ears, square-porous, pirate-dreads |
| Face features | `parts/faceFeatures.tsx` | none, goggles, sunglasses, round-glasses, mask, beard-stache, eye-patch |
| Held items | `parts/heldItems.tsx` | portal-gun, flask, fossil-brush, rock-hammer, telescope, red-flashlight, spatula, compass, sword, wrench, book, microphone, plant-shears |
| Back items | `parts/backItems.tsx` | turtle-shell, twin-swords, dino-tail, star-cape, weather-vane, backpack |
| Accessories | `parts/accessories.tsx` | glasses, pirate-sash, sword, portal-gadget, martial-belt, spatula, lab-goggles, telescope, fossil-badge, mask, cape, microphone, book, plant, wrench, star-map |
| Patterns | `parts/patterns.tsx` | stars, fossil-bones, scales, bubbles, lightning, circuit-lines, leaf-veins |
| Phases | `animation/poses.ts` | idle, thinking, answerBurst, speaking, flourish |
| Moods | `animation/poses.ts` / persona meta | excited, grumpy, wise, sleepy, dramatic/mystical |

---

## Master style block — paste at the top of *every* prompt

```
3D character reference sheet for a small game avatar. STYLE: chunky low-poly
"crystal / gemstone" look — semi-translucent polygonal facets, a soft inner
glow in ONE accent colour, smooth clay-like forms. Cozy polished mobile-game
vibe (Fantasy Life, Moonlighter, Alba). CHIBI proportions: head ~1/3 of total
height, short stout body, tiny hands, stubby legs. Must read at thumbnail size:
bold silhouette, few large shapes, almost no fine detail. LIGHTING: one key
light upper-left, soft cool fill, warm rim light in the accent colour. Plain
flat light-grey background (#e8e8ee), soft round contact shadow. Orthographic
front view unless noted. Small tidy labels under each item, no other text.
Identical scale, camera and lighting across the whole sheet.
```

---

## 1 — Base character (do this first, then reuse it)

```
[master style block]
ONE gnome-oracle character. Turnaround in a row: front, 3/4, side. Then a
separate front T-pose (arms straight out) and a face close-up showing eye /
brow / nose / mouth / cheek placement. Deep-purple faceted amethyst robe, tall
pointed wizard hat, long white beard, big friendly rounded eyes, small round
nose, rosy cheeks. Gold accent inner glow. This is the definitive model sheet —
clean, neutral pose, correct proportions.
```

## 2 — Phase / expression sheet

```
[master style block]
Same crystal gnome, head-and-shoulders, 6-cell grid, labelled:
"idle" calm gentle smile;
"thinking" eyes up, one hand stroking the beard, brow furrowed;
"surprised" eyes wide, brows up, mouth open — an idea just arrived;
"speaking" mid-word, mouth open, leaning slightly forward;
"flourish" triumphant, hat tipping, sparkles around;
"sleepy" half-lidded eyes, head drooping.
```

## 3 — Mood sheet

```
[master style block]
Same crystal gnome, FULL body, 5 in a row, labelled:
"excited" bouncy, bright; "grumpy" arms crossed, scowl, slumped;
"wise" serene, upright, glowing eyes; "dramatic" theatrical arm sweep,
swirling robe; "cozy" relaxed, soft posture.
```

## 4 — Hats (6)

```
[master style block]
6 hats, each on a plain grey head form, front + 3/4, faceted-crystal material,
labelled: "wizard" tall pointed cone with stars; "gnome" long floppy pointed
cap, white pom-pom, no brim; "fedora" creased crown + accent band;
"cork" wide-brim bush hat with dangling corks; "cowboy" curled brim, creased
crown; "none" bare head with 2-3 small floating sparkles.
```

## 5 — Costumes / torsos — split into 2 images of 7

```
[master style block]
Waist-up front view on the same crystal-gnome body. 7-cell grid, labelled,
each recognisable by shape + 2-3 colours:
IMAGE A: wizard robe; lab coat; chef coat; yellow t-shirt with blue shorts;
martial-arts gi with belt; open beach shirt; collared shirt with tie.
```

```
[master style block] - IMAGE B, same body and style:
fast-food uniform; pirate coat with red sash; black tactical suit; tan
detective trench coat; khaki field vest with pockets; star-patterned space
robe; blue-grey mechanic coveralls.
```

## 6 — Hair (7)

```
[master style block]
On the same grey head form, front + 3/4, labelled: "bald/none"; blue anime
spikes; short nervous brown mop with cowlick; big orange animal ears; square
yellow sponge-textured block; black pirate dreadlocks with red bandana.
```

## 7 — Face features (7)

```
[master style block]
Small props on a neutral crystal-gnome face, front view, labelled: "none";
welding/aviator goggles; dark rectangular sunglasses; small round spectacles;
ninja half-mask (eyes only); curly grey handlebar moustache; pirate eye-patch.
```

## 8 — Held items (14) — split into 2 images of 7

```
[master style block]
Hand props, each ISOLATED 3/4 view, chunky stylised, SOLID painted material
(not crystal), scaled to fit a tiny hand, labelled:
IMAGE A: portal gun with glowing muzzle; conical lab flask with bubbling
liquid; soft archaeology brush; rock hammer; brass telescope; red-lensed
flashlight; kitchen spatula.
```

```
[master style block] - IMAGE B, same treatment:
brass compass; short crystal sword; monkey wrench; thick spellbook; retro
stage microphone; garden shears; small potted succulent.
```

## 9 — Back items (7)

```
[master style block]
Worn on the back of the crystal gnome, 3/4 rear-ish view, labelled: green
turtle shell; X-crossed twin swords; spiky dinosaur tail; flowing
star-spangled cape; tall weathervane on a pole; chunky backpack;
star-map amulet on a cord.
```

## 10 — Body-worn accessories (the rest, ~6)

```
[master style block]
Small isolated items, solid material, labelled: diagonal pirate sash with
knot; martial-arts belt with square buckle; round fossil badge/pin; rolled
parchment star map; lab goggles (worn high on forehead); telescope on a
shoulder strap.
```

## 11 — Costume patterns (7)

```
[master style block]
Decorative motifs to sit flat on a robe front, drawn in ONE gold accent colour
on transparent/grey, iconic and low-detail, labelled: scattered 5-point stars;
fossil bones; fish scales; rising bubbles; lightning bolt; circuit traces;
leaf veins.
```

## 12 — Assembled personas (combo sanity check)

```
[master style block]
The same crystal gnome ASSEMBLED as 6 full-body front-view characters,
labelled:
a) senile wizard - purple robe, wizard hat, glowing-orb staff, spellbook;
b) garden gnome - green robe, red floppy hat, potted plant;
c) pirate captain - maroon coat, wide hat, dreads, eye-patch, compass;
d) sci-fi grandpa - no hat, blue lab coat, spiky white-blue hair, goggles,
   portal gun;
e) astronomer - deep-blue star robe, wizard hat, telescope, star cape;
f) undersea fry cook - yellow uniform, square sponge hair, spatula, cowboy hat.
```

## 13 — Material & lighting study

```
[master style block] - but use DRAMATIC lighting here.
Close-up shading studies of the faceted crystal material on (1) a simple
sphere and (2) a simple robe cone. Show: key light catching facet edges, the
accent-colour inner glow, the warm rim light, the soft round ground shadow.
3 lighting angles per shape. This is a shading reference, not a character.
```

---

## Working notes

- **Consistency is the whole game.** After #1 looks right, every later prompt
  should start: *"Use the attached character and style exactly — same
  proportions, same crystal material:"* then the master block, then the sheet.
- **Grids muddy past ~7-9 cells** — that's why costumes and held items are split.
- **Part sheets = flat light + plain background + orthographic** so the forms are
  traceable. Only the persona composites (#12) and material study (#13) get
  dramatic lighting.
- The held items / accessories say *solid painted material, not crystal* on
  purpose — crystalline tools would be visual noise; only the gnome's
  body / robe / hat are crystal.
- If a sheet drifts off-style, regenerate with *"match the proportions and
  material of the attached reference exactly."*

---

# Critter / side-event reference

Reference art for the **ambient critters** feature (`components/oracle/CRITTERS_PLAN.md`):
small creatures that wander in, provoke a reaction, and leave. Generate the base
gnome (sheet #1 above) first — the critters are sized and styled *against* him.

Critters use a **different** master block: they are soft painted living things,
the warm contrast to the faceted crystal gnome — never crystal themselves.

## Critter master style block

```
3D creature reference sheet for a cozy storybook game. STYLE: soft painted
low-poly — rounded chunky forms, gentle gradient shading, hand-painted feel
(Spiritfarer, Ori, Sky). Reads at thumbnail size: bold silhouette, few shapes,
minimal detail. These share a scene with a chibi faceted-crystal wizard gnome
(attached) and are the warm LIVING contrast to him — NOT crystal. LIGHTING:
soft key upper-left, cool fill, gentle rim. Plain flat light-grey background
(#e8e8ee), soft round contact shadow. Small tidy labels, no other text. The
gnome's head height (attached) is the size reference; keep scale consistent.
```

## C1 — Fairy

```
[critter master block]
Palm-sized fairy (about the gnome's hand). Iridescent dragonfly wings, trailing
glow-dust, cheeky grin, pointed ears. 4 views: hovering idle (turnaround front
+ 3/4 + back), then two action poses labelled "tugging a beard hair, smug" and
"dodging a spell bolt mid-air, tongue out".
```

## C2 — Dragon

```
[critter master block]
Small pot-bellied dragon, about knee-to-thigh height on the gnome, dog-sized.
Stubby wings, short horns, huge friendly eyes, wisps of smoke from the
nostrils. 4 views: standing turnaround (front + 3/4 + back), then poses
labelled "landing hard, wings flared, dust puff" and "sitting, head tilted,
sheepish/curious".
```

## C3 — Deer

```
[critter master block]
Young slender deer, shoulder-height to the gnome. Oversized soft ears, gently
dappled coat, tiny antler nubs, big dark eyes. 4 views: alert standing
turnaround, then poses labelled "head lowered, nibbling" and "looking straight
at the viewer, calm and still".
```

## C4 — Will-o'-wisp

```
[critter master block]
A floating soft flame-orb, a bit smaller than the gnome's head, with a faint
simple face and a wispy trailing tail. Pale blue-green glow. 3 poses labelled
"drifting, gentle", "split into two smaller wisps", "bobbing away shyly,
half-faded".
```

## C5 — Imp

```
[critter master block]
Knee-high mischievous goblin-imp. Big bat ears, pointed tail, bandy legs,
gap-tooth grin, clutching a small stolen trinket. 4 views: sneaking-crouch
turnaround, then poses labelled "cackling, trinket held up" and "caught
red-handed, cringing away".
```

## C6 — Raincloud

```
[critter master block]
A small grumpy cartoon storm-cloud with a simple scowling face, roughly the
gnome's head size, with light rain streaks beneath it and one tiny lightning
fork. 3 poses labelled "light drizzle, sulky", "full downpour, angry",
"puffing away, deflated and thin".
```

## C7 — Luna moth

```
[critter master block]
Large pale mint-green moth, wingspan about the gnome's two hands. Feathery
antennae, soft dusty glow, long hindwing tails. 3 poses labelled "wings spread,
landing", "fluttering upward toward a light", "at rest, wings closed".
```

## C8 — Snail

```
[critter master block]
Plump garden snail, about the size of the gnome's fist. Glossy spiral shell in
warm amber, sleepy stalked eyes, faint sparkle trail. 3 poses labelled "fully
extended, crawling", "retracted into the shell", "eyestalks up, looking at the
viewer".
```

## C9 — Crow

```
[critter master block]
Glossy blue-black crow, slightly oversized clever head, bright knowing eye,
holding a tiny pointed wizard hat in its beak. 4 views: perched turnaround,
then poses labelled "taking off, hat in beak, wings down" and "hopping away,
hat held high, smug".
```

## C10 — Firefly swarm

```
[critter master block]
A loose cluster of about 8 fireflies drawn as ONE group — small soft bug
bodies with warm glowing abdomens, faint motion trails. 3 group poses labelled
"dispersed, drifting", "gathering into a rough spiral", "arranged into a small
star shape".
```

## C11 — Dust gust

```
[critter master block]
A stylised swirl of wind: curved translucent motion ribbons, a few tumbling
leaves and dust motes, a faint spiral suggestion of a face. Roughly the
gnome's height. 3 poses labelled "gentle eddy", "strong gust, leaves
streaming", "dissipating into scattered motes".
```

## C12 — Toad

```
[critter master block]
Fat cute toad, about two fists wide, sitting low. Warty but appealing, jewel-
bright copper eyes, soft mottled green-brown. 3 poses labelled "sitting,
mid-blink", "mid-hop, legs out", "throat puffed, croaking".
```

## C13 — Gnome-reacting composite scenes (dramatic lighting)

```
[crystal master block for the gnome] + [critter master block for the creature].
Use DRAMATIC lighting. 5 full scenes, the same crystal gnome + the relevant
critter, labelled:
1) "casting" — gnome turned toward a fleeing fairy, staff thrust forward, a
   stream of gold spell-bolts in the air, fairy recoiling shocked; his beard
   and robe swept by the motion.
2) "wary" — gnome standing tall, staff raised defensively, looking UP at the
   landed dragon; not attacking; one bead of sweat.
3) "calm" — gnome leaning down slightly, bob stilled, soft expression, watching
   a deer that watches back; a single firefly hanging between them.
4) "robbed" — gnome, hand slapped to his bare head, glaring at a crow flying
   off with his hat, other fist shaking.
5) "impatient" — gnome, arms crossed, tapping a foot, rolling his eyes, as a
   snail inches across in front of him.
```

## C14 — Spell / gesture VFX study

```
[crystal master block]. DRAMATIC lighting. VFX studies for the gnome's
reactions, no full character needed beyond a hand/staff:
- "spell-bolt stream": small faceted gold shards leaving the staff orb in a
  slight arc with spread — 3 frames labelled "charge" (orb bright, gathering),
  "fire" (muzzle flash + bolts streaming out), "impact" (small burst where
  they land).
- "shoo gust": a translucent fan of curved motion lines sweeping from a waving
  hand.
- "glitter trail": the fine sparkling dust a fairy leaves behind in the air.
```

## Critter working notes

- One critter per image (except the firefly swarm and the composites). Grids of
  poses within a sheet are fine — 3–4 cells.
- Always attach the locked base-gnome image so scale and world stay consistent.
- Part sheets (C1–C12) = flat light, plain background. Only C13/C14 get drama.
- Colours in `catalog.ts` `tint` should roughly match each critter's glow, so
  keep the generated critter's accent colour noted for each.

