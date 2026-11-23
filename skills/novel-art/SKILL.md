---
name: novel-art
version: 2.0.0
description: |
  Produces an art bible (scenes + narrative props) for AI short drama: for scenes, design intent,
  consistency anchors, lighting/time-of-day variants and empty-scene prompts; for props, dramatic function,
  state variants, scale reference and white-background no-hands prompts.
  Outputs art.json + Markdown + a single-page review report (with JSON export).
  Designed for AI generation, not live-action shooting: environments and props are generated assets, so the
  deliverable is a consistency plan that keeps them looking the same across episodes;
  all 10 quality gates are checked deterministically by script (3–5 anchors, no people or hands, white background
  that can be cut out, scale phrase, English prompts…).
  If you have a novel-outline outline.json, use seed to prefill the scene list and episode appearances.
  Zero dependencies, zero API key, no image generation: the deliverable is prompts; image generation happens downstream.
  Use when asked for scene design, scene bibles, environment bibles, scene consistency, or scene bibles for AI short drama.
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - Glob
triggers:
  - novel-art
  - art bible
  - scene design
  - scene and props
  - environment design
  - prop design
  - scene bible
  - prop sheet
metadata:
  license: Apache-2.0
  requires:
    bins:
      - node          # >= 18, standard library only, no npm dependencies
  runtimes:
    - claude-code
    - codex
---

## novel-art

Produces the **art bible** for an AI short drama: scenes + narrative props. **The premise is built in: this is AI generation, not live-action shooting** — there is no location scouting, set building, dressing or prop purchasing; environments and props are assets that must be generated dozens of times and still look the same, so every deliverable revolves around consistency:

| Deliverable | What it solves |
| --- | --- |
| Consistency anchors (3–5 per scene) | Viewers recognize the scene by them; QC checks generated shots against them for drift |
| Lighting / time-of-day variants | For AI, changing time of day means regenerating, not relighting; each state becomes a complete prompt |
| Empty-scene image prompts | Environment and characters are two separate asset layers; a person in the reference image ruins consistency |
| Variant mechanism (variantOf) | Generating a new scene is cheap, but variants that reuse the parent scene's assets stay more consistent |
| Prop state variants | A suitcase closed and open are two reference images — props have state arcs, scenes do not |
| Prop scale reference | AI often draws handheld props at furniture size, so prompts must carry a scale phrase |
| Prop white background, no hands | Prop images get pasted into all kinds of shots and must be cut out cleanly; a hand holding the prop is the most common contamination |

`{baseDir}` = the directory this file is in. The script is `{baseDir}/scripts/novel-art.mjs`, zero dependencies, run directly with `node`.

**Boundaries (what it does not do)**: no storyboarding, no screenwriting, no characters (that is `novel-characters`' job), no outline (that is `novel-outline`'s job). **Props are narrative props only** (those with close-ups, that recur across episodes and carry the plot — typically 3–8) — set dressing belongs to scene anchors, and one-off hand props are handled by shot-level prompts; neither gets its own asset.

---

### Step 0 — Decide the input

Three kinds of input, highest priority first:

1. **outline.json** (output of novel-outline) — best; the scene list, episode appearances, the payoffs each scene carries and the reuse plan are all ready-made
2. The novel text — summarize the scene list yourself (main stages first; follow novel-outline's main-scene cap and don't be greedy)
3. A scene list the user wrote by hand

If you also have cast.json (output of novel-characters), bring it along — it is needed to check that prompts contain no character names.

### Step 1 — Seed the skeleton (only if you have outline.json)

```bash
node {baseDir}/scripts/novel-art.mjs seed <outline.json> > <workdir>/art.json
```

Deterministic transfer: scene id / name / main-scene flag / episode appearances / payoffs carried. Scenes with a reuse plan get a `seedNote` hint to make them variants. **Do not make the model re-derive these facts.**

If there is no outline.json, build the list yourself following `references/schema.md`.

### Step 2 — Fill in each scene's design + extract narrative props

One task per scene; run them concurrently where possible. Each task receives:

- `{baseDir}/references/scene-pass.md` and `{baseDir}/references/schema.md` (read them and follow them)
- The scene's skeleton + everything the text/outline says about this space
- **The names of the other scenes in the same batch** (the spaces must feel distinct; don't write them all in the same worn-down way)

The core requirements are all in scene-pass.md; the three heaviest are: anchors must be **drawable, recognizable and checkable** ("patched boat awning" is an anchor, "an atmosphere of age" is an adjective); lighting states are **derived backwards from the episodes**, not a full set nobody uses; and **if a variant will do, do not open a new scene**.

**Narrative props draw on the outline first**: since 1.1.0, `outline.json` carries `props`, and `seed` brings the prop table over together with "what it carries", "which payoffs it supports" and "which episodes it appears in"; this layer only fills the design fields (scale, anchors, state variants, white-background prompt). **If the outline has no props, extract them from the text**, in which case this step is the model's job: take only those with **close-ups, cross-episode appearances and plot-carrying weight**, typically 3–8, the same order of magnitude as the number of leads. Fill each one per `references/prop-pass.md`: dramatic function, anchors, state variants, scale, white-background no-hands prompt. A suitcase — a "prop that travels with a person" — belongs here; stuffing it into scene anchors or a character profile is wrong either way.

### Step 3 — Validate ⛔ do not skip

```bash
node {baseDir}/scripts/novel-art.mjs validate <art.json> --cast <cast.json>
```

All 10 quality gates are code. Scenes + 6 shared gates: anchors 3–5, lighting states ≥1, **no people**, prompts entirely English, no character names (only checked when --cast is given), variant references complete. Props have 4 gates of their own: **states ≥1**, **scale phrase written into the prompt**, **negative prompt bans hands**, **model sheet on a pure white background**.

**Fix every violation one by one, re-run after each fix, until it passes.**

### Step 4 — Output and report

```bash
cd <output directory>
node {baseDir}/scripts/novel-art.mjs render <title>-art.json --md   > <title>-art.md
node {baseDir}/scripts/novel-art.mjs render <title>-art.json --html > art-report.html
```

The report UI is Chinese by default; if the user wants an English UI add `--lang en` (or write `"lang": "en"` at the top level of art.json; `--lang` wins). By default `render` looks for `images/<slug>-sheet.png` next to art.json (for both scenes and props); if the images are elsewhere, point to them with `--images <directory>` — **this skill does not produce those files**; once downstream has generated the images, re-run render to embed them in the report. The report contains: KPI band, scene list, scene cards, prop list, prop cards (anchor checklist / state variants / prompt pack, all with copy buttons), quality-gate panel, and JSON export (the download is art.json verbatim).

Report in one sentence: how many scenes (how many main / variant), how many props, the total number of anchors, and the report path; say plainly which gates did not pass.

**Do not say "images generated"** — that step no longer exists; the deliverable is prompts.

Final layout:

```
<output directory>/
├── <title>-art.json
├── <title>-art.md
├── art-report.html                ← opens with a double-click
└── images/                        ← this skill does not write this directory
    └── <slug>-sheet.png           ← put images here after downstream generation; render will pick them up
```

---

## The three skills in sequence

```
novel-outline    → outline.json (what: structure and episodes)
novel-characters → cast.json    (who: character assets)
novel-art        → art.json     (where + what is held: art assets)
```

seed takes the scene and prop blocks from outline.json (when the outline has no `props`, the props are left empty and the model extracts them from the text), and `--cast` takes cast.json. All three JSONs' reports carry an export button, and after editing, each can be fed back to its own render/validate.

## Boundaries

- The report UI has built-in Chinese and English (`--lang`, Chinese by default, or follow the `lang` field of art.json); image prompts are always English
- **This skill does not generate images.** `image.sheet` is a layout instruction for downstream; see `references/sheet.md` for the layout spec
- There is no hard cap on the number of scenes — the cap is governed by novel-outline's main-scene gate; what this skill governs is the quality of each asset
- Props are narrative props only, 3–8 is ideal — every extra one adds one more cross-episode consistency burden

## Self-test

```bash
node {baseDir}/scripts/selftest.mjs
```

151 assertions, no model calls, no quota spent. Every one of the 10 quality gates has a test that defeats it. Run this first after changing the script.

## Bundled sample

`{baseDir}/examples/渡口-art.json`: the full design of *The Ferry* (《渡口》) — three scenes + two narrative props (an old suitcase, a county-yamen inkstone) — with every quality gate passing (including the character-name check against the novel-characters sample cast). It serves as the quality baseline and also as the self-test fixture.
