# Layout spec for the character model sheet

`image.sheet` is the **complete layout instruction for the image model**; this skill is only responsible for writing it correctly, **not for generating the image**.
Generation is downstream (it has to pick a model, a style and an aspect ratio, and this layer cannot answer any of those three).

The constraints below must all be written into the English body of `image.sheet` one by one. They were all hammered out by real output —
left unwritten, the model improvises, and always breaks in the same direction.

## One image per character

One landscape canvas, split left and right internally:

```
┌──────────┬────────────────────────────┐
│          │   front   side    back      │
│  bust    │                            │
│ portrait ├────────────────────────────┤
│ (ID photo)│  detail · detail · detail · detail │
│  facial  │                            │
│ baseline │                            │
│   ~34%   │                            │
└──────────┴────────────────────────────┘
                    16:9
```

The bust portrait in the left column is the **facial design baseline**, and the faces in the right-hand turnaround are drawn to match it.

## Subject information must not shrink in the layout

The subject paragraph of `image.sheet` must carry over from `image.prompt` the age, identity-appropriate clothing, fabric quality, hair ornament, carried objects and bearing; it must not retain only clothing colour and a hair bun. All three zones are the same identity, the same occasion and the same outfit; a plain-clothes, disguised or down-and-out state stated in the source is likewise kept, and must not be replaced with formal dress without cause. The detail strip prioritises features that identify this person, and must not add patches, wear or ornaments out of thin air just to fill the detail cells.

## Background: white

Always a **pure white background**. There are three reasons: clean cut-out, it prints the way a model sheet should, and it stays readable inside a dark report.
Hard-wire `plain pure white background` in `image.sheet`; do not change it to a grey or scene background.

## Per-zone lighting

A model sheet wants flat light (cut-out, proportion measurement), while volume wants directional light. These conflict, so **solve it per zone**: give the left-column bust portrait a soft
directional key light + ambient occlusion, and keep the right-hand turnaround and detail strip in flat orthographic light. In the prompt these are two separate sentences,
`LIGHTING IN THE LEFT ZONE ONLY` / `LIGHTING IN THE RIGHT ZONES`; **do not merge them into one global lighting sentence**.

## Proportions ⚠️

The thing that most easily breaks in this layout is proportion — to fit the detail strip in, the model will squash or stretch the three full-body figures. Hard-wire
`PROPORTIONS ARE CRITICAL`, `no stretching, squashing or foreshortening`,
`the detail studies give way, not the figures`.

## Closing off the left column ⚠️

By default the model will crop the shoulders on either side of the bust portrait and give the bottom edge rounded corners or a fading vignette, which looks awkward. Explicitly forbid it:
shoulders complete, space on both sides, bottom edge cut flat and level. **Leave this out and it will always go wrong.**

## Facial consistency ⚠️

Two faces in one image is the problem that most easily arises in this layout — one person drawn in the left column, another on the right. Hard-wire
`must match the bust portrait exactly — same features, same hairstyle, same expression`.

## Visual style is not here

**Do not write visual style in `image.sheet`.** Style is a layer the caller prepends to the prompt for the whole batch at generation time; written in here it only fights whatever style was chosen then, and changing style would mean editing every entry. For detail see `profile-pass.md`.

Style consistency across a batch of characters is therefore also downstream work: share one style instruction across the whole batch, and when necessary use the first finished image
as a reference to hold it in place. This layer handles "what this person looks like, and how this sheet is laid out".

## Filenames

`render` looks for images at `images/<slug>-sheet.png` next to cast.json by default, and embeds them into report.html when found;
if the images are elsewhere, point at them with `--images <dir>`. This skill does not produce these files; once downstream has generated the images, re-run `render` and it picks them up.
`node scripts/novel-characters.mjs slug "<character name>"` produces a safe filename (Chinese is preserved).
