---
name: novel-storyboard
version: 2.0.0
description: |
  Storyboarding for AI short drama: a three-level structure — segment (one video generation, ≤15s) → cut (a 2–5s edit inside the segment, claiming script beats)
  → frame (one keyframe per cut: the master frame pinned at 0.00s, sub-frames pinned at their own cut marks).
  Each segment carries one MiniMax H3 video prompt (official spec defaults to English, one shot per line; promptLang can switch to Chinese): the alignment instruction and
  [Shot k] cut times are derived from the cut structure and audited verbatim, dialogue goes verbatim into <d> blocks (the writing spec is internalized in
  references/h3-prompt.md, no external skill needed).
  Outputs storyboard.json + Markdown + a single-page review report (cut rhythm strip / per-episode storyboard table / generation batch list /
  audio alignment list, with Export JSON). No image generation — the deliverable is the picture prompt for each frame and which reference images it should carry.
  All 18 quality gates are checked deterministically by script (the 18th, shot-recipe, is optional: checked only when a shot-recipes card library is mounted, otherwise the skip is stated);
  export produces an H3 production pack in one command (every segment's prompt + the frame list in Picture order). Zero dependencies, zero API key, uses the current session's quota.
  Use when asked to storyboard, produce a shot list, cut shots, or build a storyboard for AI short drama.
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - Glob
triggers:
  - novel-storyboard
  - 分镜
  - 出分镜
  - 镜头表
  - 切镜
  - 首帧
  - storyboard
  - shot list
metadata:
  license: Apache-2.0
  requires:
    bins:
      - node          # >= 18, standard library only, no npm dependencies
  runtimes:
    - claude-code
    - codex
---

## novel-storyboard

Storyboards for AI short drama — the first layer in the pipeline that faces the video model directly. **The premise is burned in: shots are generated, so one more cut costs almost nothing** — so this layer is not precious about the number of shots; the only cap is the video model's single-generation duration (15s by default).

**Core mechanism: shots claim beats.** Every shot declares which consecutive beats of which scene in the script it covers (`sceneIndex` + `beats: [from, to]`), and a shot may not cross scenes — changing location always means a new shot. That makes the relationship between storyboard and script mechanically auditable:

| Deliverable | What it solves |
| --- | --- |
| Beat claiming | Every beat is claimed by exactly one shot, in order — re-run validate after a script change and the invalidated shots are named on the spot |
| Single shot ≤ 15s | The AI video single-generation cap; long dialogue is forcibly split into shots here (`params.maxShotSeconds` per model) |
| Dialogue fits | The dialogue seconds of the claimed beats ≤ the shot seconds — checked shot by shot, not guessed |
| Frame prompt + shot body | The frame prompt (`frame`, Chinese, names characters directly) drives the image model together with the sheets; the shot body (`shot`, Chinese, generic identity) writes what happens in these seconds. Shot size is an enum, and the Chinese shot-size word must appear in the frame prompt |
| **H3 video prompt (one per segment)** | MiniMax H3's I2VA structure: fixed alignment instruction + integrated_multimodal_description + overall_soundscape + non_diegetic_music. **Dialogue of the claimed beats goes verbatim into `<d>[Chinese] …</d>` blocks** — dialogue, soundscape and music all carried in one prompt |
| **Seedance video prompt (one per segment, assembled by program)** | Parallel to H3. Assembled by script per the official structure: reference-image declarations, segment-level blocking, per-shot quantified fields, dialogue `{}`, sound effects `<>`, music `（）`, numbering constraints. The model writes only each cut's `shot`, not seconds, numbers or image references |
| Composition quantified fields | Per segment `blocking` (who is left, who is right, spacing), per shot focal length / camera position / composition / eyeline / focus / stability — with no frames, these are the entire source of composition |
| Generation batch list | Shots in the same scene + same lighting form one batch sharing one environment reference image — the AI equivalent of a shooting-order sheet, auto-summarised by script |
| Audio alignment list | Every dialogue line mapped to a shot number — which video segment a TTS clip attaches to, auto-summarised by script |

`{baseDir}` = the directory this file lives in. The script is `{baseDir}/scripts/novel-storyboard.mjs`, zero dependencies, run it directly with `node`.

**Boundaries (what it does not do)**: does not write or rewrite dialogue (that is `novel-script`'s job), does not generate scene / character / prop sheets (that is `novel-art` / `novel-characters`' job), does not do video generation or editing. Lip / mouth sync is out of scope for now — that belongs to the generation pipeline.

---

### Step 0 — Set inputs and scope

**script.json is a hard prerequisite** — a storyboard without a script is meaningless, and validate/render must both be given `--script`. Use the other upstream inputs when available:

- `--outline` / `--cast`: the prompt no-names check + C01 shown as a name in the report
- `--art`: S01 shown as a scene name in the report + scene sheets embedded in the batch list
- `--shots <cards dir>`: **optional** mounting of the shot-recipes shot recipe card library (point at `shot-recipes/references/cards`, accepts a directory only, not an exported JSON), enabling the 18th `shot-recipe` gate. Do not pass it without shot-recipes installed — this skill is self-contained and does not depend on it

**How many episodes at a time**: follow the script's batches (cut as far as the script is written), by default ≤ 3 episodes per batch.

**Set the aspect ratio first**: the top-level `aspectRatio` in storyboard.json is the formal contract shared by the storyboard and downstream image generation, and accepts only `16:9` or `9:16`. Use `16:9` when there is no special requirement; vertical short drama states `9:16` explicitly.

### Step 1 — Seed the worksheet

```bash
node {baseDir}/scripts/novel-storyboard.mjs seed <script.json> --eps 1-3 --aspect 16:9 > <workdir>/storyboard.json
```

Deterministic expansion: each scene's beat list (number, action/dialogue, seconds per beat, speaker) goes into `seedScenes`, which is the worksheet for cutting; `--aspect` is also written into the top-level `aspectRatio`, defaulting to `16:9` when omitted. **How many seconds each beat is, is computed — do not let the model re-estimate.** shots stay empty; cutting shots is the model's job.

### Step 2 — Segment and cut, episode by episode

One task per episode, concurrent if possible. Each task receives:

- `{baseDir}/references/storyboard-pass.md` and `{baseDir}/references/schema.md` (read them and follow them)
- That episode's seedScenes worksheet + scene cards (art.json's anchors and lighting prompts) + character cards (cast.json's look points)

Process: **first segment by story unit** (9–15s each, never crossing scenes), **then cut 2–5s cuts inside the segment** (dialogue shot–reverse-shot, key-action insert close-ups, the three-shot entrance — the cutting grammar is all in storyboard-pass.md), and for each cut write one frame prompt (Chinese, naming characters directly), one shot body `shot` (Chinese, generic identity) and the six composition fields; for each segment write `blocking`, `soundscape`, and `music` if there is score. All frames and downstream generated images must keep the same aspect ratio specified by the top-level `aspectRatio`.

**Write each segment's shot body per `{baseDir}/references/shot-writing.md`** (protocol-agnostic: one camera move per cut, actions must be completable, dialogue verbatim, layered sound, no visual style). Whichever video service you send it to, layer that protocol's syntax on top: MiniMax H3 see `{baseDir}/references/h3-prompt.md`, Seedance see `{baseDir}/references/seedance-prompt.md`.

**Write one `h3Prompt` per segment**, per `{baseDir}/references/h3-prompt.md` (an internalized version of the official methodology, **depending on no external skill**). The official spec defaults to English (`promptLang` can switch to Chinese), **one line per shot**. Key points: the first-line alignment instruction and the `[Shot k]` cut times **are derived from the cut seconds, and not one character may drift** (validate audits verbatim); claimed dialogue goes **verbatim** into `<d>[Chinese] …</d>`; each cut's camera-move term goes into its own line; soundscape and music go into the last two fields — **soundscape is also an action instruction; when the picture changes the soundscape changes with it**.

**Do not write the Seedance prompt**: the prompt panel in the `render` report and `export --protocol seedance` both assemble it from the fields above. Visual style is appended by the caller at submission time; global constraints are given with `--constraints <file>`.

Once done cutting, delete `seedScenes`.

### Step 3 — Validate ⛔ Do not skip

```bash
node {baseDir}/scripts/novel-storyboard.mjs validate <storyboard.json> \
  --script <script.json> --outline <outline.json> --cast <cast.json> \
  [--shots </path/to/cards>]
```

The 18 quality gates are all code: full beat coverage (at cut level, exactly once, in order, contiguous), segment 0 < total seconds ≤ 15, **every cut 2–5s**, dialogue fits within the shot, each episode's total duration within ±15% of the script target, ≤ 3 people in frame (more requires a breakdown note), segment numbers in E01-01 format and sequential, the Chinese shot-size word in the frame prompt, camera moves drawn from the H3 vocabulary and inside their own [Shot k] passage, **the H3 alignment instruction derived from the cut structure and audited verbatim + every cut time checked one by one**, **claimed dialogue verbatim inside `<d>` blocks**, **prompt language matching promptLang** (checked both ways: Chinese written as English, and English mixed into Chinese, both blocked), frame prompts Chinese and non-empty, **video prompts containing no character names** (H3 body regardless of language, and the Seedance shot body; frame prompts naming characters are allowed), **composition quantified fields complete**, **Seedance shot body compliant** (Chinese and non-empty, with no timings, shot numbers, image references or protocol symbols), scenes / characters / props audited against the script, **shot recipe audit** (optional gate, see below).

The structure check also validates the optional `aspectRatio`: accepts only `16:9` or `9:16`. It belongs to the storyboard.json contract check and does not count as a separate quality gate.

**Fix each violation as reported, re-run after fixing, until it passes.**

**The 18th gate `shot-recipe` (optional mount)**: checked only when `--shots` is given; when not given, say plainly that it is skipped. A cut may carry an optional `recipe` (a recipe card id, **at cut level not segment level**, **a multi-cut recipe expressed as consecutive cuts sharing the id**, not an array); the gate checks three things — the id exists in the card library, every one of the card's `must_phrases` appears in that cut's `frame` (lowercased on both sides, `includes`), and when the card's `cuts` lower bound ≥ 2 the number of consecutive cuts sharing the id must not fall below that bound. The card's **suggested shot size and camera move are not gated**, only flagged as a deviation in the report's "Recipe" column and at the end of `checkup`: a recipe is vocabulary, not law, and an optional mount that turns strict is one nobody mounts.

### Step 4 — Output and report back

```bash
cd <output dir>
node {baseDir}/scripts/novel-storyboard.mjs render <title>-storyboard.json --md \
  --script <script.json> --outline <outline.json> --art <art.json> > <title>-storyboard.md
node {baseDir}/scripts/novel-storyboard.mjs render <title>-storyboard.json --html \
  --script <script.json> --outline <outline.json> --art <art.json> > storyboard-report.html
```

The report UI language is set with `--lang zh|en` (priority `--lang` > the JSON top-level `lang` field > Chinese default) — it switches UI labels only, and is independent of `promptLang` (the H3 prompt language). The master frame and sub-frame strip are laid out per the top-level `aspectRatio`; older data's `_meta.orientation` and the aspect tag at the end of a frame are kept for compatibility only. `render` finds frames with `--frames <dir>` (`<dir>/<segment id>/f<cut index>.png`, current directory by default) and the batch list's scene sheets with `--images <dir>` (`<dir>/<scene slug>-sheet.png`, `./images` by default); both can point at any path — **this skill does not produce these files**; once downstream has generated the images, re-run render and they will be embedded in the report. `export --frames <dir>` copies every frame it can find into the production pack, so you need not place them by hand. The report contains: KPI band, cut rhythm strip (thick separators = segment boundaries, slice width = cut duration share, colour depth = shot size distance, click to jump to the segment card), per-episode storyboard table (master frame + sub-frame strip + per-cut storyboard rows + frame / H3 prompt copy buttons), generation batch list, audio alignment list, quality gates, export JSON. The Markdown version attaches the full H3 prompt to each segment, ready to copy and use.

Report back in one sentence: how many episodes and shots, total duration vs target, how many generation batches, the report path; and state plainly any gate that did not pass.

**Do not say "images generated"** — that step does not exist here; the deliverable is prompts and the list of images to attach.

Final layout:

```
<output dir>/
├── <title>-storyboard.json
├── <title>-storyboard.md
├── storyboard-report.html         ← double-click to open
├── manifest.json                  ← produced by export
└── E01-01/                        ← one folder per segment = all materials for one H3 generation
    ├── f1.png                     ← master frame (downstream puts it here once generated)
    ├── f2.png …                   ← sub-frames
    └── prompt.md                  ← H3 prompt (produced by export)
```

---

## The relay across the five skills (the pipeline closes here)

```
novel-outline    → outline.json    (what: structure and episodes)
novel-characters → cast.json       (who: character sheets)
novel-art        → art.json        (where: scene / prop sheets)
novel-script     → script.json     (the drama: scenes, beats, dialogue)
novel-storyboard → storyboard.json (how to shoot: shots, first frames, batches)
```

The storyboard is the consumer end: seed eats script.json, frame generation (downstream) uses art's and characters' sheets as references, the H3 prompt goes straight to the video model as an order, and the audio alignment list connects to the TTS output of script's line book. Each of the five JSON files' reports carries an export button, and the output can be fed back into its own render/validate.

## Boundaries

- The report UI ships built in Chinese and English (`--lang`, Chinese default); the prompt language is controlled separately by `promptLang` (English default)
- Seconds are a **generation duration ordered from the video model**, not an estimate — change the segment cap with `params.maxSegmentSeconds` per your model, and the cut rhythm range with `min/maxCutSeconds`
- Lip / mouth sync is out of scope for now — that belongs to the generation pipeline
- Frames are not expected to be right first time — they are the composition anchor for the video model; right composition and right assets are enough, and fine-tuning is left to regeneration

## Gate failures accumulate

Every `validate` and `checkup` appends the gate results to `.gates.jsonl` in the **current directory**; run `stats` to summarise:

```bash
node {baseDir}/scripts/novel-storyboard.mjs stats
```

It answers three things: **which gate fires most often** (that rule is the one the model most often ignores — the wording is what should change), **which gate has never fired** (possibly a dead gate, or possibly a rule already internalized), **what the failure details look like** (the class of problem that recurs without a gate can only be found by a human reading them).

Pass `--no-log` to skip logging; if it cannot be written the step is skipped silently and validation is unaffected.

## Self-test

```bash
node {baseDir}/scripts/selftest.mjs
```

336 assertions, no model calls, no quota spent. All 18 quality gates have a defeating case. Run this first after changing the script.

## Bundled sample

`{baseDir}/examples/渡口-storyboard.json`: the complete storyboard for episode 1 of 《渡口》 — 10 segments and 34 cuts claiming all 35 script beats, 3.5s per cut on average, 119s total / 120s target, 2 generation batches, each segment carrying a complete H3 video prompt (multi-image alignment + all cut times audited and passing). It serves as a quality baseline and as a self-test fixture.
