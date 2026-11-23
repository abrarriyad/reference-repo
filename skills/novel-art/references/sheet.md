# Layout spec for design sheets (scenes + props)

`image.sheet` is the **complete layout instruction for the image model**; this skill is only responsible for writing it correctly and **is not responsible for generating images**.
Image generation is downstream (it requires choosing a model, an art style and an aspect ratio, and this layer can answer none of the three).

The constraints below must each be written into the English body of `image.sheet`.

## One image per scene, one per prop

### Scenes

A 16:9 landscape composition, a large master-view image + an **L-shaped detail border along the bottom and right**, separated by thin lines:

```
┌─────────────────────────────┬─────────┐
│                             │ Detail 1 │
│   Master view (standard      ├─────────┤
│   framing)                   │ Detail 2 │
│   What the scene normally    │          │
│   looks like                 │          │
│   ~72% wide × 70% high       │          │
├──────────┬──────────┬────────┼─────────┤
│ Detail 3 │ Detail 4 │ Detail 5│         │
└──────────┴──────────┴────────┴─────────┘
```

- **Main area (upper left, about 72% wide × 70% high)**: master view = the scene's standard framing + the first lighting state; this is the one standard answer to "what does this scene look like"
- **Right column + bottom row**: all **detail close-ups** — close views of the consistency anchors and key materials, about 2 cells in the right column and 3 in the bottom row
- Every detail cell must be a cropped, enlarged piece of the master view's space, **and nothing may appear that is not in the master view** — write `nothing invented that is not present in the master view` into the prompt

### Props

The same L-shaped layout, with three differences: a **pure white background** (in every panel, for cutting out), the main view is a three-quarter angle of the main state, and the bottom row holds **other states + orthographic side views**. The whole image has **no people and no hands** — a hand holding the prop is the most common contamination, and if one appears, regenerate. The scale phrase (handheld scale etc.) must be in the prompt, or the suitcase will be drawn as a wardrobe.

The prompt field is `image.sheet`. By default `render` looks for `images/<slug>-sheet.png` next to art.json (the `slug` command generates safe file names);
if the images are elsewhere, point to them with `--images <directory>`. This skill does not produce these files; once downstream has generated the images, re-run `render` and it will pick them up.

## Three hard requirements

1. **The whole image is an empty scene with no people.** `Absolutely no people anywhere` must be in the prompt, and the negative prompt banning people must be there too. If a single figure appears in a generated image, regenerate — a person inside an environment asset cannot be washed out.
2. **Only one space can be in an image.** Character sheets are most prone to "two different faces in one image"; the environment sheet's equivalent failure is **panels that do not agree on the space** (six rows of bench seats on the left, four rows in the upper right). Write `THE SPACE MUST BE IDENTICAL ACROSS ALL PANELS` into the prompt. When you receive the image, check the anchors first: can each anchor be found in the master view?
3. **Keep the perspective stable.** The most common wasted environment image has melting geometry and skewed perspective. `warped perspective, melted geometry` must be in the negative prompt (the preset includes it).

## Variant scenes: the prompt must hook onto the parent scene

For a `variantOf` scene, `image.sheet` is written as **the parent scene's master view + a description of the `changes`**, plus one sentence,
`keep the structure, materials and wear identical to the reference image` — that sentence is written for downstream:
when generating this image, the parent scene's finished image is attached as a reference. **That is the whole point of the variant mechanism**; generating from scratch cannot be consistent.

## Art style is not here

All the scenes in one show should look as if one art department drew them. This relies on two things, **and neither is written into an individual prompt**:
the surface-treatment sentence is a fixed set (see the item "what to carry over in full is the surface treatment" in `scene-pass.md`),
and the art style is appended by downstream, as the same instruction for the whole batch, at generation time. Writing it here only fights whichever tier gets chosen at the time,
and changing style means editing prompts one by one.
