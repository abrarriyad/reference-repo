---
name: novel-outline
version: 2.0.0
description: |
  Adapts a novel into a five-piece short-drama outline: adaptation notes, cast, beat table, per-episode synopses, asset list,
  and outputs outline.json + Markdown + a single-page review report (KPI band, key decisions, beat timeline, scheduling matrix, scene overview, quality gates).
  All 14 quality gates are checked deterministically by script (cast tier caps, main-scene cap that scales with episode count, beat gap ≤3 episodes, mandatory hook and suspense per episode…), not left to the model's diligence;
  supports a checkup mode: paste in an existing outline and run only the quality gates for a diagnosis.
  Zero dependencies, zero API key, uses the current session's quota.
  Use when asked for an adaptation outline, short-drama outline, outline breakdown, novel to short drama, or adaptation outline.
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - Glob
triggers:
  - novel-outline
  - adaptation outline
  - short-drama outline
  - break down the outline
  - novel to short drama
  - outline checkup
  - adaptation outline
metadata:
  license: Apache-2.0
  requires:
    bins:
      - node          # >= 18, standard library only, no npm dependencies
  runtimes:
    - claude-code
    - codex
---

## novel-outline

Input a novel + target parameters; output the five-piece short-drama adaptation outline. **Four pieces are written by the model, one is computed by script** (the asset list is aggregated automatically from the episode data).

`{baseDir}` = the directory this file is in. The script is `{baseDir}/scripts/novel-outline.mjs`, zero dependencies, run directly with `node`.

**Boundaries (what it does not do)**: no script dialogue, no storyboards, no image/TTS prompts. Synopses are narrative; quoted dialogue is overstepping — `validate` will block it. Breaking character designs (portraits / look prompts / model sheets) out of a novel is `novel-characters`' job.

---

### Step 0 — Collect parameters ⛔ do not start without them

Ask everything at once; do not interrogate in turns. Two things must be asked, and two get defaults to confirm:

| Parameter | Handling |
| --- | --- |
| **Total episodes × per-episode length** | **Must ask**; there is no sensible default |
| **Genre** | **Must ask**; it decides the beat types, and a wrong guess wastes the whole thing |
| Adaptation degree | Default **extract-the-core** (faithful / extract-the-core / borrow-the-shell); just tell them |
| Existing preferences | Default none (which character to keep, which scene) |

If the platform's thresholds differ, bring `params.thresholds` to override them (defaults: lead group ≤ 5, important supporting ≤ 10, functional roles ≤ 10, beat gap ≤ 3 episodes). **The main-scene cap needs no configuring; it is computed from episode count**: 4 + ⌈episodes/10⌉, clamped to 5–15 (60 episodes → 10). This is the AI short-drama number — scenes are generated with no set-building cost, so relaxing it buys visual interest; only an explicit `maxPrimaryScenes` overrides it. **For short runs (20–30 episodes) tightening the cast-tier thresholds is advisable**, since the defaults are set for 60+ episodes.

**The cast table is broken out from the source text** — the outline is upstream of character design, and the tiers, character arcs and sources fixed by the `characters` block are taken straight by the downstream `novel-characters` as its cast list, with no need to judge again who matters.

The exception is when the user already has a `cast.json` (from running `novel-characters` separately earlier): then use it as the source material for characters — roles, aliases and relationships are ready-made, so there is no need to re-break the source text. Map tiers back by `importance`: protagonist/major → `lead`, supporting → `support`, minor → `functional`.

### Step 1 — Locate the input

Material priority, fixed:

1. The **close-read chapters** the user names
2. **Chapter table of contents + synopsis**
3. The full text's **volume summaries** (Step 2)

**It is forbidden to invent content from the book's title** — every judgement is based on the text provided. The enforcement mechanism: key trade-offs in `adaptation.keep` must carry `evidence` (a verbatim passage from the source).

If the user pastes the body text directly, save it as a .txt first. Output directory: use the user's if specified, otherwise the same directory as the original book.

### Step 2 — Volume summaries (only needed for long texts)

**This step is scaffolding, not a deliverable** — volume summaries compress the text for a model that has not read it. In two cases, skip straight to Step 3:

- A short piece that fits in one volume
- **The current session has already read the whole text** — no need to compress it again, and no need to backfill the files afterwards

For a long work you have not read:

```bash
node {baseDir}/scripts/novel-outline.mjs chunk <book.txt> <workdir>
```

It splits into volumes by chapter heading (15 chapters per volume by default, adjustable with `--per-volume`), and by character count if no chapters are recognized. It prints `{"volumes": N, ...}`; if `truncated: true`, tell the user plainly that the tail was not scanned — do not sit on it.

One sub-agent per volume (if concurrency is supported, **send them all in the same message**): read `{baseDir}/references/volume-pass.md`, read `<workdir>/vol-NN.txt`, write the volume summary to `<workdir>/summary-NN.json`, and reply with just "done NN".

### Step 3 — Quick skeleton → user signs off ⛔

Read `{baseDir}/references/outline-pass.md` and `{baseDir}/references/schema.md` and follow them. Produce the four skeleton blocks (adaptation / characters / scenes / beats), written to `<workdir>/outline.json`.

```bash
node {baseDir}/scripts/novel-outline.mjs validate <workdir>/outline.json --stage beats
```

Once it passes the beats stage, **put three things in front of the user to sign off: which line was cut, which people were merged, and in which episode the big reveal lands**. Without their nod, do not enter Step 4 — if the quick version is wrong you lose only one round of skeleton, but finding the direction wrong after the episodes are written wastes everything.

### Step 4 — Detailed skeleton

Absorb the user's feedback and revise the skeleton, then pass `validate --stage beats` once more. If the user has no feedback, go straight to Step 5.

### Step 5 — Episode synopses (in batches)

**At most 10 episodes per batch**, concurrent where possible. Each sub-agent gets: the four skeleton blocks as signed off, its own episode range, and the beats that fall in that range; it reads `{baseDir}/references/episode-pass.md` and writes by it, with output written to `<workdir>/eps-NN.json`.

When merging, sort by ep and splice into the `episodes` of outline.json.

### Step 6 — Validate ⛔ do not skip

```bash
node {baseDir}/scripts/novel-outline.mjs validate <output directory>/<title>-outline.json
```

All 14 quality gates are code, not a checklist for you to read: lead group 1–5 people, important supporting ≤ 10, functional roles ≤ 10, main scenes within the cap (dynamic with episode count, 60 episodes → 10), narrative props ≤ 8, one-off scenes have a workaround, beat gap ≤ 3 episodes with no vacuum, episode 1 has a hook, the big reveal does not sit in the last episode, every episode has all three columns, three-in-frame has a breakdown, generation difficulties go into warnings, references complete (no unemployed characters, no idle scenes, no zero-episode props), narrative with no dialogue.

**Fix every violation one by one, re-run after each fix, until it passes.**

### Step 7 — Output and report

```bash
cd <output directory>
node {baseDir}/scripts/novel-outline.mjs render <title>-outline.json --md   > <title>-outline.md
node {baseDir}/scripts/novel-outline.mjs render <title>-outline.json --html > outline-report.html
```

The report UI is Chinese by default; if the user wants an English UI add `--lang en` (or write a `lang` field at the top level of outline.json; `--lang` wins). Only the UI copy is translated; the data content (beat types, synopses, quality-gate text) comes out as authored.

The report includes: KPI band, key decisions (the three sign-off items, with the big-reveal list and character-slot counts computed automatically), beat timeline (gaps marked on the axis, turning red when over threshold), per-episode scheduling matrix, scene overview cards, asset-volume conversion, quality gates (✓/✗ baked into the page, with a problem banner when any fail), and an export JSON button (the download is outline.json verbatim).

Report in one sentence: how many episodes, how many characters and scenes, the beat distribution, and the report path; say plainly if anything was truncated or any gate did not pass.

Final layout:

```
<output directory>/
├── <title>-outline.json
├── <title>-outline.md
└── outline-report.html            ← opens with a double-click
```

---

## Checkup mode

When the user pastes an **existing outline** and only wants a diagnosis: convert it into outline.json (ask the user about missing fields or mark them missing), then:

```bash
node {baseDir}/scripts/novel-outline.mjs checkup <outline.json>   # terminal ✓/✗
node {baseDir}/scripts/novel-outline.mjs render <outline.json> --html > outline-report.html
```

The quality-gate panel is the diagnosis. Failing gates do not stop rendering — the whole point is to lay the problems out to be seen.

## Linked updates

When the user changes anything upstream, run `validate` once; the errors name where downstream broke: which episodes still reference a deleted ID after characters were merged, which episodes sit idle after scenes were cut, where a vacuum appears after beats were moved. **Do not rely on memory to prompt linked updates; rely on the validator.**

## Boundaries

- Single-run cap is 60 volumes (15 chapters per volume, about 900 chapters). Beyond that it reports `truncated` plainly and never truncates silently
- Thresholds are parameters, not edicts: when the platform differs, override with `params.thresholds` rather than changing the code
- The report UI has built-in Chinese and English (`--lang`, Chinese by default, or follow the `lang` field of outline.json): UI copy and quality-gate labels are translated, while the data content (beat types, synopses, names) and gate failure details stay as authored
- The fifth of the five pieces (the asset list) is always computed; a hand-written one by the model will always miss things

## Self-test

```bash
node {baseDir}/scripts/selftest.mjs
```

249 assertions, no model calls, no quota spent. Every one of the 14 quality gates has a test that defeats it — proving it really blocks. Run this first after changing the script.

## Bundled sample

`{baseDir}/examples/渡口-outline.json`: the short story *The Ferry* (《渡口》, the bundled sample of novel-characters) adapted into a miniature outline of 6 episodes × 2 minutes, with four characters, three scenes and four beats, and every quality gate passing. It serves as the quality baseline and also as the self-test fixture.
