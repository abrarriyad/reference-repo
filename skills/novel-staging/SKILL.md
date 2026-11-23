---
name: novel-staging
version: 1.0.1
description: |
  Plans the opening blocking for every scene of an AI short drama: first it recognizes what can be stood on or sat on from the scene image (reckoned onto a top-down plan),
  then, following the script, for each scene it plans who is at which side of which object, sitting or standing, facing which way, and whether there are extras,
  and the program writes each scene's opening blocking sentence, which the storyboard copies verbatim for that scene's first segment.
  The default deliverable is an HTML tool report in which you can drag to adjust positions, with staging.json exportable from the page; the JSON is also saved as working data, and Markdown is exported on demand.
  All 8 quality gates are checked deterministically by script (number of items recognized from the image, items on the image, cast neither more nor fewer,
  people present land on recognized items, no stacking of people on one side, extras say where…). It takes novel-script's script.json and novel-art's art.json to prefill the skeleton.
  Zero dependencies, zero API key.
  Use when asked for blocking, opening blocking, ensemble blocking, who sits where, seating plans, staging, or staging for AI short drama.
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - Glob
triggers:
  - novel-staging
  - blocking
  - opening blocking
  - ensemble blocking
  - seating plan
  - staging
  - blocking
  - staging
metadata:
  license: Apache-2.0
  requires:
    bins:
      - node          # >= 18, standard library only, no npm dependencies
  runtimes:
    - claude-code
    - codex
---

## novel-staging

Plans the **opening blocking** for every scene of an AI short drama: when this scene begins, where each person who appears is relative to which object, whether sitting or standing, and facing which way.

**Why plan it separately**: every video segment of a short drama is an independent generation, and each segment decides for itself who sits where. In an ensemble scene with six people around a long table, the first segment grows five nameless guests at the table, and in the third segment the person seated serving wine is wearing the lead's clothes. The storyboard's blocking sentences are handed from one segment to the next, but the sentence for each scene's **first segment** is invented by the storyboard itself, where people cannot see it or change it. So before the storyboard, each scene gets a blocking plan fixed first, and the storyboard copies it.

| Deliverable | What it solves |
| --- | --- |
| Image-recognition result (4–20 items per location) | Blocking lands only next to things that really are on the image — a raised platform written in the prompt but not drawn in the image, with someone seated on it, comes out different in every video segment |
| Top-down plan | On a perspective scene image, "the north side of the table" is only a thin strip behind the table, and front-to-back depth is unclear; laid flat and viewed from above, the compass directions are obvious at a glance |
| Opening blocking (per scene) | Who is there from the start and who comes in later; sitting or standing follows the script; the head seat, opposition and isolation are said through position |
| Opening blocking sentence | Written by the program from the blocking, handed to the storyboard word for word: "胡二爷 sits on the third row of bench boards, facing north; the other seats are empty, and there is no one else." |
| An adjustable report | People are dragged on the page, with sit/stand and facing changed, and exporting afterwards gives a new staging.json, with no hand-editing of JSON |

`{baseDir}` = the directory this file is in. The script is `{baseDir}/scripts/novel-staging.mjs`, zero dependencies, run directly with `node`.

**Boundaries (what it does not do)**: no storyboard, no script, no image generation. It handles only **the opening moment** — who stands up midway and where they walk is the storyboard's business, and the storyboard continues from this moment onward.

---

### Step 0 — Settle the input

- **script.json** (output of novel-script) — a hard prerequisite: which scenes there are, which location each is in, who appears, how the script is written
- **art.json** (output of novel-art) — the locations' names; when there is no image yet, reckon from its anchors and main-view prompts
- **outline.json** (output of novel-outline) — the names for the character numbers (C01 → 沈知微)
- **Scene images** — one per location, placed at `images/<location name>-sheet.png` (novel-art's sheet layout, the main view at upper left). **Better to have**: blocking should land next to things that really are on the image. It can be planned without images, but only as a draft (see Step 2)

### Step 1 — Seed the skeleton

```bash
node {baseDir}/scripts/novel-staging.mjs seed <script.json> --art <art.json> --outline <outline.json> > <workdir>/staging.json
```

Deterministic transfer: locations (in order of first appearance), each scene's episode and scene number, which location it is in, lighting time of day, the people who appear, and an empty blocking entry per person. **Do not make the model re-derive these facts.** To do only some episodes, add `--eps 1-3`.

### Step 2 — Image recognition (once per location)

One task per location; concurrent where possible. Read `{baseDir}/references/read-pass.md` and follow it: look at the scene image's main view and recognize what people would stand next to or sit on; for each, write the name, the name in another language, its box on the image (`box`), its position on the plan (`plan`), whether it can be sat on (`on`), and whether it is round (`round`); 4–20 items, with `readFrom` set to `picture`.

The two heaviest rules: **do not write what cannot be seen in the image** (anything in the prompt but not on the image is never written); **`plan` is reckoned from perspective**, not copied from `box`.

**When there is no image yet**: reckon from art.json's anchors and main-view prompt, write `readFrom` as `prompt`, and write no `box`. The report marks it; once the image exists, recognize again and check the blocking.

### Step 3 — Plan the blocking (once per scene)

One task per scene; concurrent where possible (consecutive scenes in the same location are planned in order, to keep positions continuous). Read `{baseDir}/references/staging-pass.md`, take this scene's script, the people who appear and the items recognized for this location, and fill in each person in `places`: whether they are present at the opening (`present`), at which side (`side`) of which item (`item`), how far along that side (`along`), sitting or standing (`posture`), facing which way (`facing`); then fill in the extras (`extras` / `extrasWhere`) and one `why` sentence.

The three heaviest rules: **a person who comes in later is not present at the opening**; **if the script does not say anyone else is there, there are no extras**; **use only the items recognized**.

### Step 4 — Validate ⛔ do not skip

```bash
node {baseDir}/scripts/novel-staging.mjs validate <staging.json> --script <script.json> --art <art.json>
```

All 8 quality gates are code: each location has image recognition done and 4–20 items, item names are not duplicated and boxes are valid (those recognized from an image must have a `box`), every scene's location has a recognition result, the cast is neither more nor fewer (with `--script`, it is also checked against the script), every person has been decided present or not and at least one person is present, people present land on recognized items with valid side / posture / facing, no stacking of people on one side, extra counts are integers and say where.

**Fix every violation one by one, re-run after each fix, until it passes.**

### Step 5 — The default deliverable is the HTML tool report

```bash
cd <output directory>
node {baseDir}/scripts/novel-staging.mjs render staging.json > staging-report.html
```

**The default main deliverable is `staging-report.html`; when finished, give the user the report link or path directly, and do not return only JSON, Markdown or a chat summary.** When `render` is given no format it outputs HTML directly, and an explicit `--html` is still supported. `staging.json` is saved as working data for validation, re-rendering and later handoff; only when the user wants a text version do you run `render staging.json --md > staging.md`.

`staging-report.html` opens with a double-click, with one top-down plan per scene:

- **Drag** a person to change position; on release they land on the nearest side of the nearest item; dragging back into the tray below means not present at the opening, and dragging in from the tray means present
- **Click** a person to adjust sitting / standing and facing (eight compass directions)
- Add or remove extras, and write where they are; the opening blocking sentence and this scene's checks update in real time
- Changes are stored in the browser and survive a refresh; **"Export JSON"** downloads the edited staging.json

Overwrite staging.json with the exported file, and **run Step 4 once more**. The report UI is Chinese by default, and `--lang en` gives an English UI (the blocking sentences then use the names in the other language that were written during image recognition). If the images are elsewhere, point to them with `--images <directory>`.

The user can also ask for an adjustment in one sentence ("move 胡二爷 to the bow"): change it by "Adjust by one sentence" in `staging-pass.md`, touching only the people mentioned, then validate.

### Step 6 — Hand it to the storyboard

```bash
node {baseDir}/scripts/novel-staging.mjs blocking staging.json            # one line per scene: scene + opening blocking sentence
node {baseDir}/scripts/novel-staging.mjs blocking staging.json --lang en  # English
```

When the storyboard writes the opening blocking of each scene's **first segment** (novel-storyboard's `blocking`), it copies this sentence; after that, the segments continue as usual from the previous segment's end-of-segment blocking.

First provide the HTML tool report link or path, then say in one sentence: how many locations (how many recognized from images, how many reckoned from prompts), how many scenes, how many scenes have someone absent at the opening, how many extras; say plainly which gates did not pass. The JSON is companion working data, and Markdown is not a default deliverable.

Final layout:

```
<output directory>/
├── staging-report.html            ← default main deliverable, opens with a double-click, drag to adjust and export JSON
├── staging.json                   ← working data, for validation, rendering and later handoff
└── images/                        ← this skill does not write this directory
    └── <location name>-sheet.png   ← put novel-art's scene sheets here; both recognition and the report use them
```

---

## Position in the pipeline

```
novel-outline    → outline.json (character names)
novel-art        → art.json     (locations + scene images)
novel-script     → script.json  (who appears in each scene, how it is played)
novel-staging    → staging.json (who is where at the opening of each scene)
novel-storyboard → storyboard.json (each scene's first-segment opening blocking copies staging)
```

seed takes script.json, `--art` gives the location names, and `--outline` gives the character names. novel-storyboard currently **does not read** staging.json automatically: use the sentences printed by the `blocking` command and write them into the `blocking` of the first segment of each scene in the storyboard.

## Boundaries

- It plans only the opening moment; position changes midway belong to the storyboard
- This skill does not generate images; scene images are placed in `images/` after novel-art's sheets have been generated
- Compass directions are always given by the scene (north, east, south, west, next to which item), not by the frame (left and right) — frame left/right is derived from the camera position and flips whenever the camera changes

## Self-test

```bash
node {baseDir}/scripts/selftest.mjs
```

99 assertions, no model calls, no quota spent. Every one of the 8 quality gates has a test that defeats it; plane geometry, drag landing points, blocking sentences, seed and the report (Chinese and English UI, escaping, embedded images) are all covered; it also separately rebuilds a copy from the source of the algorithm embedded in the page and checks that it computes the same as the command line. Run this first after changing the script.

## Bundled sample

`{baseDir}/examples/渡口-staging.json`: the opening blocking for nine scenes across three locations of *The Ferry* (《渡口》) (the ferry pier, the ferry cabin, the reed flat on the far bank), with every quality gate passing (against the sample script and art). The sample has no scene images, and all three locations are reckoned from the design prompts (`readFrom: prompt`). It serves as the quality baseline and also as the self-test fixture.
