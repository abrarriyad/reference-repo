---
name: novel-script
version: 2.0.0
description: |
  Writes the screenplay for an AI short drama: turns the episode synopses of novel-outline into structured scenes + a beat flow (action beats alternating with dialogue lines),
  every line of dialogue carrying its speaker and delivery, with per-episode duration deterministically converted from speaking rate. Outputs script.json + Markdown + a single-page review report
  (duration gauge / per-episode script / scene master table / per-character dialogue book, with JSON export).
  The script handles the drama, the storyboard handles the shooting — this skill does no shots, has no shot numbers, and writes no generation prompts; those are the next layer's storyboard skill.
  All 10 quality gates are checked deterministically by script (per-episode duration ±15%, single line ≤35 characters, valid speaker, hook and suspense on paper,
  the concrete hook delivered within the first 3 beats (hookBeat claims the cold open), at least one action beat per scene, beat claims,
  characters / scenes / lighting / props reconciled with upstream…).
  With an outline.json, use seed to prefill each episode's skeleton; give --art to reconcile lighting states as well.
  Zero dependencies, zero API key, uses the current session's quota.
  Use when asked to write a screenplay, produce a script, write dialogue, write scenes, write the drama, or screenwriting for AI short drama.
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - Glob
triggers:
  - novel-script
  - screenplay
  - write a script
  - produce a script
  - write dialogue
  - scenes
  - write the drama
  - screenplay
  - script
metadata:
  license: Apache-2.0
  requires:
    bins:
      - node          # >= 18, standard library only, no npm dependencies
  runtimes:
    - claude-code
    - codex
---

## novel-script

Writes the **screenplay** for an AI short drama. **The premise is built in: the script handles the drama, the storyboard handles the shooting** — "is it satisfying" and "how to shoot it" iterate at two different rhythms; dialogue has to be overturned and rewritten again and again, and tying it to a shot breakdown would mean reshuffling shots for every changed line. So this layer has only episodes, scenes and a beat flow, with no shot numbers; shots, first-frame prompts and generation batches are the next layer's storyboard skill.

There is one bottom line, though: **dialogue must be structured data, not prose**. Each line is its own entry (speaker + line + delivery), and each action is its own beat — this is the foundation of all the deterministic checks:

| Deliverable | What it solves |
| --- | --- |
| Per-episode duration budget | A three-minute episode is three minutes: dialogue is converted by speaking rate and actions estimated by beat, so over- and under-writing is stopped on the spot instead of being found only at the generation stage |
| Beat flow (action ⇄ dialogue) | Dialogue connects directly to line-by-line TTS generation; an action beat is what has to happen on screen. Mixed into prose, neither can be fed into the pipeline |
| At least one action beat per scene | A scene of pure dialogue is a radio play — there is no image to write when AI generates |
| Opening hook + closing suspense | The life-or-death line of short drama; every episode must put both on paper; **the hook is not a label but the first beat** — `hookBeat` claims the concrete position, which must fall within the first 3 beats of the episode (cold open) |
| Beat claims | The outline says this episode has a big reveal, and the script must have a scene that claims it — guarding against the reveal being edited away along the way |
| Upstream reconciliation | Scenes / lighting / props against art.json, characters against outline.json; writing a lighting state the art did not register is reported on the spot |

`{baseDir}` = the directory this file is in. The script is `{baseDir}/scripts/novel-script.mjs`, zero dependencies, run directly with `node`.

**Boundaries (what it does not do)**: no shots, no shot numbers, no image-generation prompts, no image generation, no music — none of the storyboard layer's work is touched. It does not change the outline's structure (cutting lines and merging people is `novel-outline`'s job); it does not design characters or scenes (that is for `novel-characters` / `novel-art`).

---

### Step 0 — Settle the input and scope

**outline.json is the script's direct upstream** (the episode synopses, beat placements and per-episode length are all in it), and the standard flow starts from it. If there is none, first ask the user whether to run `novel-outline`; if the user insists on writing directly, ask the number of episodes and per-episode minutes, build the skeleton by hand, and the reconciliation gates will say plainly that they are skipped.

**How many episodes at a time**: by default, a batch is ≤ 3 episodes. The script is the layer that changes the most across the whole pipeline, so produce small batches, get sign-off quickly, then write further. If the user explicitly wants the whole show, it is also produced in batches, with a validation pass for each batch.

Bring these along (all optional; names are reconciled/shown only if given):

- `--outline`: character-reference reconciliation + beat-claim check + C01 shown as a person's name in the report
- `--art`: scene / lighting state / prop reconciliation + S01 shown as the scene's name in the report

### Step 1 — Seed the skeleton

```bash
node {baseDir}/scripts/novel-script.mjs seed <outline.json> --eps 1-3 > <workdir>/script.json
```

Deterministic transfer: target seconds (per-episode minutes × 60), hook, suspense, the beats this episode must claim, candidate scenes and people (into `seedNote`). **Do not make the model re-derive these facts.** scenes are left empty — that is the work of writing the drama.

### Step 2 — Write the drama, episode by episode

One task per episode; concurrent where possible. Each task receives:

- `{baseDir}/references/script-pass.md` and `{baseDir}/references/schema.md` (read them and follow them)
- That episode's seed skeleton + the outline's synopsis / beats / crowd plan for this episode
- The scene cards used by that episode (anchors and lighting states in art.json) and character information (temperament, way of speaking — better with a cast.json)
- **The previous episode's closing suspense** (this episode's opening must connect to it)

The core requirements are all in script-pass.md; the four heaviest are: **action beats use only common actions** (carrying a pole onto a boat, helping unload the pole — things AI has seen tens of millions of times; delicate actions like thrusting a pole to block or eyelashes trembling will always collapse in generation); **the duration budget comes before everything** (a three-minute episode is about 50 beats; after writing, run validate yourself to see the seconds); dialogue is colloquial, each line fits in one breath, **and each person sounds like themselves** (with a cast.json, take the character's temperament and way of speaking); **beat 1 of every episode is a cold open that gives the concrete form of the hook** (claimed by `hookBeat`, with the gate checking its position), and the last beat must be suspense.

Delete the `seedNote` when done writing.

### Step 3 — Validate ⛔ do not skip

```bash
node {baseDir}/scripts/novel-script.mjs validate <script.json> \
  --outline <outline.json> --art <art.json>
```

All 10 quality gates are code: per-episode duration within the target ±15% (dialogue at 4.5 characters/second, action at 2.5 seconds/beat, adjustable via `params`), single line ≤ 35 characters, speaker in the scene's characters or marked `VO`, hook and suspense on paper for every episode, **the concrete hook delivered within the first 3 beats of the episode** (claimed by `hookBeat`, `params.hookWindow` adjustable), at least one action beat per scene, action narration not mixed with quoted dialogue, beat claims, character reconciliation, scene / lighting / prop reconciliation.

**Fix every violation one by one, re-run after each fix, until it passes.** If you wrote too much, cut action beats first, then compress dialogue; if too little, add drama without padding — add conflict, not pleasantries. If you need a lighting state the art did not register, go and add the state in art.json and come back; do not go around the gate.

### Step 4 — Output and report

```bash
cd <output directory>
node {baseDir}/scripts/novel-script.mjs render <title>-script.json --md \
  --outline <outline.json> --art <art.json> > <title>-script.md
node {baseDir}/scripts/novel-script.mjs render <title>-script.json --html \
  --outline <outline.json> --art <art.json> --cast <cast.json> > script-report.html
# English UI: add --lang en (Chinese by default, or follow the top-level lang field of script.json)
```

The report contains: KPI band (including dialogue share), duration gauge (each episode's bar set against the target band, with over/under marked red), per-episode script (two episodes per row, scene information fading and truncating past 300px, click to expand), scene master table, **dialogue book** (two per row, aggregated by character, the list six rows high and scrollable, whole-group copy; with `--cast`, each character group header carries a **voice prompt** button — dialogue and voice together on one page, ready to run TTS), quality-gate panel, and JSON export (the download is script.json verbatim).

Report in one sentence: how many episodes, scenes and lines of dialogue, estimated total duration vs. target, which episodes hug the edge of the tolerance, and the report path; say plainly which gates did not pass.

Final layout:

```
<output directory>/
├── <title>-script.json
├── <title>-script.md
└── script-report.html             ← opens with a double-click
```

---

## The four skills in sequence

```
novel-outline    → outline.json (what: structure and episodes)
novel-characters → cast.json    (who: character assets)
novel-art        → art.json     (where + what is held: art assets)
novel-script     → script.json  (the drama: scenes, beats, dialogue)
```

seed takes outline.json; the `--outline` and `--art` of validate/render handle reconciliation and name display. All four JSONs' reports carry an export button, and after editing, each can be fed back to its own render/validate. The next layer down is the storyboard: shot numbers, per-shot duration, first-frame prompts and generation batch sheets are all there.

## Boundaries

- The report UI has built-in Chinese and English (`--lang`, Chinese by default, or follow the `lang` field of script.json); the dialogue language follows the show
- Duration is an **estimate, not a stopwatch** — the ±15% tolerance is left for exactly that; `params.charsPerSecond` is adjustable to the dubbing rate
- `VO` is the single marker for voice-over, and whose inner voice it is goes in `delivery`; VO forms its own group in the dialogue book
- There is no per-episode cap on scenes — AI scene changes are free, so the count of scene changes only enters the KPI statistics and has no gate

## Self-test

```bash
node {baseDir}/scripts/selftest.mjs
```

154 assertions, no model calls, no quota spent. Every one of the 10 quality gates has a test that defeats it. Run this first after changing the script.

## Bundled sample

`{baseDir}/examples/渡口-script.json`: the **complete 6-episode script** of *The Ferry* (《渡口》) (9 scenes, 123 lines of dialogue, every episode's cold open delivering its hook, all within 120 seconds ±15%), with every quality gate passing against the novel-outline and novel-art samples. It serves as the quality baseline and also as the self-test fixture.
