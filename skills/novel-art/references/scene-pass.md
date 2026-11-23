# Scene design · how to fill it in

You are given one scene's skeleton (seed prefilled id / name / main-scene flag / episode appearances / payoffs carried) + everything the text or outline says about this space, and you produce the complete scene design. **Output JSON only — no explanation, no fences.** For the structure see `schema.md`.

## Think it through first: this is AI short drama, not live-action

A scene is not "find a place to shoot"; it is an **environment asset that must be generated dozens of times and still look the same**. Every field you write serves consistency:

| Field | What it solves |
| --- | --- |
| Anchors | What makes the audience recognize "we're back here"; what QC uses to judge that a generated shot has not drifted |
| Lighting states | Changing time of day = changing the prompt and regenerating, not relighting on set |
| Empty scene | People are a separate layer (novel-characters handles them); a person in an environment reference ruins consistency |
| Dynasty | The one baseline shared by architectural form, furniture, objects and patterns; without it, each scene picks a different century |

## Hard rules

1. **Set the dynasty first, then write the scenes.** The whole show gets **one** specific, real dynasty or era, written into the document-level `dynasty`: `明` (Ming), `北宋` (Northern Song), `民国` (Republic of China), `唐` (Tang).

   **Words like "ancient", "period costume", "some dynasty" or "fictional" are not allowed.** They have no counterpart in the image — a model reading "ancient mansion" can only pick one itself, so the courtyard comes out Song, the study Ming and the props Qing, and together they do not look like one show. This is the same rule as not writing "fictional": statements about the setting cannot get into the image; only the setting itself does.

   If the text does not say, infer from clues, and **infer a specific one — do not write something vague just because you are unsure**: official titles, dress codes, objects, currency, forms of address, architectural forms, seasonal customs and weights and measures are all clues. When the source is a fictional setting, write which dynasty it **resembles** — `Ming-style` — rather than writing that it is fictional.

   Once set, `image.prompt`, `image.sheet`, anchor descriptions and lighting states are all written to that dynasty: bracket-set style, furniture leg profile, window-lattice pattern, lamp form and floor paving all differ by dynasty.

2. **`summary` states design intent, not floor-plan facts.** "An interrogation room so small that people cannot avoid each other's eyes" is design intent; "about ten square metres, six rows of bench seats" is just measurement data. A space serves the drama, so say which scene it exists for first.

3. **Anchors must be "drawable, recognizable and checkable".** Good anchors: a patched boat awning, the broken seventh bridge plank, a verdigris copper bell — findable at a glance in a generated image, and their absence noticed at once. Bad anchors: "an atmosphere of age", "traces of time" — something that cannot be checked is an adjective, not an anchor. Each anchor's `name` is short enough to go in the checklist, and `desc` states position and features clearly.

4. **Derive lighting states backwards from the episodes.** Write whichever times of day and weather this scene goes through in the episodes it appears in. Do not conjure a full "day / night / dusk" set out of nothing — a state nobody uses is a maintenance burden.

5. **Prompts are always English, and always an empty scene.** `image.prompt` must say empty scene / no people explicitly, and `negativePrompt` must ban people. **Never include character names, author names or work titles** — image models will paint in anything they recognize.

6. **Do not write a rendering style in the prompt, only this place's condition.** Do not use sentences like `Semi-realistic environment concept art` / `painterly rendering`, and do not tag `image.tags` with style tags like `semi-realistic` or `painterly`. Art style is decided at the moment of image generation, and the one style instruction shared by the whole batch is appended by the caller — writing it into every prompt only fights whatever style is chosen then, and changing style means editing prompts one by one.

   What to carry over in full is the **surface treatment**, which says who uses this space and for how long, and holds true under any art style.
   **Choose one of two tiers, by this space's actual level of upkeep** — these are not two art styles but two facts:

   **A · Everyday use** (dwellings, inns, docks, workshops, houses long unrepaired):
   ```
   Weathered, lived-in materials: chipped paint, water stains, patina on metal, worn wood grain, dust in corners and light shafts; fabric and paper props show creases and age; nothing looks factory-new. Atmospheric depth with haze or volumetric light where the space allows
   ```

   **B · Continuously maintained** (palaces, government offices, the front halls of grand residences, newly built or recently refurbished spaces):
   ```
   Well-kept, actively maintained materials: sound lacquer with an even sheen, swept stone and timber, polished metal fittings, tight joinery, no peeling paint and no water staining; wear confined to the traffic a space like this really takes — thresholds, handrails, the stone directly inside a doorway. Atmospheric depth with haze or volumetric light where the space allows
   ```

   **Do not treat A as the default.** Put the whole show on A and the imperial throne hall comes out as a leaking, ruined hall — in a real test on 《状元是买的》 (*The Top Scholar Was Bought*), S06, the throne hall, received "peeling lacquer" and "faint water stains on the lower door frame", in the best-maintained building in the country. This is the same mistake as "every prompt must contain the same art-style sentence verbatim": a fact that should be decided per subject was written as a constant that is true of nothing in particular.

   Even with B you still write wear, only **worn where it should wear**: the middle of the threshold, the handrails, the stair treads — worn by people walking, not by years of disrepair.

   Baseline negative prompt (add to it per scene):
   ```
   people, human figures, characters, crowds, silhouettes of people, oversaturated colours, sterile showroom cleanliness, warped perspective, melted geometry, floating objects, text, watermark, signature
   ```

   Baseline `image.tags`: `environment sheet`, `weathered materials`, `cinematic` — describing what kind of image this is and what condition it is in, not what brushwork it is drawn with.

   **The negative prompt must never ban art-style words** (`photorealistic`, `3d render`, `anime` and the like) — the style chosen at generation time may be exactly one of them, and banning it means fighting yourself.

7. **If a variant will do, do not open a new scene.** Generating a new environment with AI is cheap, but **every extra independent environment adds one more consistency burden**. For scenes with a reuse plan in the outline (the seedNote will say so), attach them to the parent scene with `variantOf` + `changes`: change the time of day, change the weather, change the foreground, remove props, and assets such as bridge-plank details are reused directly.

8. **Do not bring in the character skill's surface treatment.** Pores and subsurface scattering are about skin; an environment's believability comes from **materials that have been used**: peeling paint, water stains, patina, wood grain worn pale. The two tiers under "what to carry over in full is the surface treatment" are already written; pick the one matching this space's level of upkeep and copy it verbatim.

## Input format

```
Scene: S01 ferry cabin (main scene)
Episodes: 1–6　Payoffs carried: suspense hook, identity exposed, reversal, closing

What the text/outline says about this space:
- ……
- ……

Other scenes in the same batch: S02 ferry pier, S03 reed flat on the far bank
```

You need to know the names of the other scenes in the batch — the spaces must feel distinguishable; do not write every scene in the same kind of "worn-down".
