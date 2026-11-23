---
name: novel-characters
description: |
  Breaks a novel or short story into a cast list, character profiles, image prompts and voice prompts,
  where the image prompt carries the full layout instruction for a character model sheet (left bust portrait
  + right full-body turnaround + detail strip), and outputs JSON + Markdown + an interactive report.html.
  The report language is configurable (--lang), Chinese by default, any language supported; zero dependencies,
  zero API key, no image generation.
  Use when asked to break a novel into characters, analyse the cast, generate character cards, or build character sheets from a novel.
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - Glob
metadata:
  version: 2.0.0
  triggers:
    - novel-characters
    - 拆角色
    - 拆书角色
    - 小说角色
    - 人物画像
    - 角色卡
    - 三视图
    - character sheet from novel
  license: Apache-2.0
  requires:
    bins:
      - node          # >= 18, standard library only, no npm dependencies
  runtimes:
    - claude-code
    - codex
---

## novel-characters

Takes a novel / short story and outputs, for each character: a profile, an image prompt, a voice prompt, and the layout instruction for a character model sheet.

**This skill does not generate images, it only produces prompts.** Image generation is downstream work — it has to pick a model, a visual style and an aspect ratio, and this layer cannot answer any of those three.

`{baseDir}` = the directory this file lives in. The script is `{baseDir}/scripts/novel-characters.mjs`, zero dependencies, run it directly with `node`.

**Runtime**: Claude Code and codex both work, with no difference — this pipeline is all node scripts plus model reads and writes, and never touches a local executable.

---

### Step 0 — Decide the report language

The user can specify a language, e.g. "use English", "--lang en", "日本語で". **If none is given, it is Chinese (`zh`).**

This `lang` is passed all the way down: the second pass uses it to decide which language the human-readable fields are written in, and `validate` and `render` both need it too.

**UI strings come in two cases:**

- `zh` / `en` / `ja` — built in, nothing to do
- **Any other language** — you translate a copy on the spot. Run

  ```bash
  node {baseDir}/scripts/novel-characters.mjs ui-template <lang>
  ```

  It prints an English skeleton; translate every value into the target language and put the whole block into the `ui` field at the top level of `cast.json`. Rendering merges it over the built-in table.

  **Without `ui`, `validate` fails outright** — otherwise the report ends up half-baked, with French character content and English UI labels.

Supported languages are not limited by the built-in table; French, Korean and Spanish all produce a fully localized report.

### Step 1 — Locate the input

If the user gives a file path, use it directly. If they paste the text in, **first save it to a temporary .txt** — the later check for "is the quote verbatim" compares against the source, and without a source file that step cannot be done.

Decide the output directory: use the one the user specifies; if none, use the directory holding the source book.

**If there is an `outline.json` (novel-outline's output), ask for it too and go through seed** — the outline sits upstream of the character design, and its `characters` block has already settled the roster:

```bash
node {baseDir}/scripts/novel-characters.mjs seed <outline.json> > <workdir>/seed.json
```

What comes across is what the outline has already decided; what is left blank is the design this layer owes:

| outline field | after seed |
| --- | --- |
| `id` | kept as the character code — downstream script / storyboard use it to reference characters |
| `name` | the cast list follows this, **you no longer decide who is in** |
| `tier` | mapped to `importance`: `lead` → `protagonist`, `support` → `supporting`, `functional` → `minor` |
| `arc` | goes straight into `persona.arc` |
| `role` / `from` | go into `seedNote` — the positioning (female lead / villain) and "which source characters were merged into this one", so you know which storylines to collect when scanning the source |

Left blank to fill in: `aliases` (needs the source text), `oneLiner`, the rest of `persona`, `image`, `voice`. **What seed produces is a skeleton, not a finished product** — running `validate` straight away reports a pile of missing fields, which is expected; Steps 2–6 exist to fill it in.

Two conventions to hold to:

- **Do not overturn the tiers the outline decided.** Who matters is settled at the adaptation stage; this layer is only responsible for deepening the people already settled. If a tier really looks wrong, go fix the outline — do not quietly change it to something different here
- **You may subdivide within the lead group.** The outline's `lead` is one whole group of "male lead + female lead + main antagonist", corresponding to the `protagonist` and `major` tiers; seed assigns everyone `protagonist`; using the positioning in `seedNote`, change the non-leads to `major` — that does not count as overturning the tiers

**It runs fine without an `outline.json`**, too — this skill does not depend on it. Skip seed and start from Step 2, building the roster from the source yourself.

### Step 2 — Chunk

```bash
node {baseDir}/scripts/novel-characters.mjs chunk <book.txt> <workdir>
```

Prints `{"chunks": N, ...}`.

- **N == 1**: skip Step 3, read the source in the current session for pass 1, and write the result yourself to `<workdir>/roster-00.json`
- **N > 1**: go to Step 3
- `truncated: true`: tell the user explicitly that the tail was not scanned — do not keep quiet about it

### Step 3 — Pass 1 scan (only when N > 1)

**Run concurrently if the current environment supports sub-agents** (Claude Code's Task, codex's subagent): one sub-agent per chunk, and **all calls in the same message** is what makes it actually concurrent. If unsupported, read chunk by chunk serially — same result, just slower.

Each sub-agent's task:
1. Read `{baseDir}/references/roster-pass.md` and follow it
2. Read `<workdir>/chunk-NN.txt`
3. Write the roster JSON to `<workdir>/roster-NN.json`
4. Reply with one line only: "done NN, extracted X characters"

### Step 4 — Merge + review

```bash
node {baseDir}/scripts/novel-characters.mjs merge <workdir> | tee <workdir>/merged.json
```

Writing to `merged.json` is not just for the record: Step 6's assemble relies on it for the screen-time order of characters in the same tier.

Converge by exact name + alias (if one chunk lists "陆" as an alias of "陆行远", the two merge into one person); notes accumulate, quotes are de-duplicated, sorted by number of chunks seen descending — the more chunks a character appears in, the heavier the screen time.

Output is `{ "characters": [...], "mergeCandidates": [...] }`. **Review `mergeCandidates` one by one**: exact matching can only converge cases where two chunks happen to write the same form of address; the rest is a semantic judgement a script cannot make. Candidates come from name containment (`「陆」⊂「陆行远」`) — a strong signal, not a verdict; same-surname fathers and sons, or brothers, must not be merged. Same-person cases you spot yourself outside the candidates ("陆先生" and "行远" have no containment relation, so they never appear as candidates) must be merged too.

To merge, write a merges.json and apply it:

```json
{ "merges": [{ "keep": "陆行远", "absorb": ["陆", "陆先生"] }] }
```

```bash
node {baseDir}/scripts/novel-characters.mjs merge <workdir> --apply merges.json | tee <workdir>/merged.json
```

`keep`/`absorb` locate by name or any alias; if not found it fails outright. The output still carries `mergeCandidates`; confirm the rest really are different people (or clear them) before moving on. If there is nothing to merge, just go on — but `merged.json` must be kept.

### Step 5 — Casting

Take the top N. 30 by default; if the user says something, do what they say. Mention the rest in the final report: "X more characters were identified but not profiled".

### Step 6 — Pass 2, produce the cards

One per character; again concurrent if possible.

Each task receives:
- `{baseDir}/references/profile-pass.md` and `{baseDir}/references/schema.md` (read them and follow them)
- **The report language `lang`** (set in Step 0)
- That character's merged `name` / `aliases` / `notes` / `quotes`
- **The names of the other characters in the same batch** (to avoid clashing looks and voices)

Complete the identity–appearance semantic self-check per `profile-pass.md` before handing a card over: the profile, the image prompt, the local translation and the sheet's subject must not each describe a different identity. The outline decides the roster and the adaptation choices; source observations supply the physical evidence — do not give only the outline and skip the Step 2–4 source scan.

Write each character card JSON to `<workdir>/card-<slug>.json`. **Resumable**: characters whose `card-<slug>.json` already exists need not be re-run.

**Also write a story summary**: in the language `lang` specifies, 3–5 sentences, giving the time and place, the core situation, and the reason these people are together. For a short piece, write it from the source directly; for a long one, summarise from each chunk's roster note. Do not spoil the ending or write it as a blurb. Write it to `<workdir>/summary.txt`. For a non-built-in language, save the whole `ui` block translated in Step 0 as `<workdir>/ui.json`.

Then assemble cast.json — **use assemble, do not hand-build it** (hand-building drops fields and writes the wrong top-level key):

```bash
node {baseDir}/scripts/novel-characters.mjs assemble <workdir> \
  --source <book name> --lang <lang> \
  --out <output dir>/<book name>-cast.json
```

Bad cards are named one by one — if a `card-*.json` is bad, re-run only that character; the others need not change.

The order of characters within a tier is screen-time order, taken from the `<workdir>/merged.json` left by Step 4 (assemble reads it automatically; you can also point `--order` at another file). The numbering in the report's left rail, "sorted by screen time", depends on it — if you see the warning "characters in the same tier will be ordered by filename", merged.json is lost; go back to Step 4 and regenerate it.

### Step 7 — Validate ⛔ Do not skip

```bash
node {baseDir}/scripts/novel-characters.mjs validate <cast.json> <book.txt>
```

Remember to pass `--lang` (set in Step 0). It checks: structure, the `importance` enum, **verbatim quotes**, **no character names in image prompts**, **language split** (human fields follow `lang`; image / TTS prompts are always English), and **non-built-in languages must carry `ui`**.

**Fix each violation as reported, re-run after fixing, until it passes.** Models really do make these four kinds of mistake — this set of checks was hammered out by real output.

### Step 8 — Output

```bash
cd <output dir>
node {baseDir}/scripts/novel-characters.mjs render <cast.json> --md   > <book name>-cast.md
node {baseDir}/scripts/novel-characters.mjs render <cast.json> --html > report.html
```

The language comes from `lang` in `cast.json`; to override temporarily, add `--lang <code>`.

`render` looks for images at `images/<slug>-sheet.png` next to cast.json by default; if the images are elsewhere, point at them with `--images <dir>` (any path). **This skill does not produce these files** — once downstream has generated the images, re-run render and it will embed them into the report.

For the report.html style conventions see `{baseDir}/references/report-style.md` — read it before changing styles, and do not turn it back into a generic card wall.

Final layout:

```
<output dir>/
├── <book name>-cast.json
├── <book name>-cast.md
├── report.html                    ← double-click to open
└── images/                        ← this skill does not write this directory
    └── <slug>-sheet.png           ← downstream puts generated images here; render picks them up
```

### Step 9 — Report back

In one sentence: the number of characters and the report path. If validation failed once, say what was fixed. If the source was truncated, state that explicitly.

**Do not say "images generated" or "model sheets generated"** — that step does not exist here; the deliverable is prompts.

---

## Boundaries

- A single run is capped at 24 chunks (~930k characters net), beyond which it explicitly reports `truncated` rather than silently cutting
- Human-readable fields follow `--lang` (Chinese by default); image and TTS prompts are **always English**, since those engines are steadiest with English
- **This skill does not generate images.** `image.sheet` is the layout instruction for downstream; the places where layout most often breaks (two faces in one image, squashing the figure to fit detail, closing off the left column) are held down by a few hard-wired sentences in the prompt, see `references/sheet.md`
- Wanting a live-editable, watch-it-as-it-runs interface is a different thing, and not part of this skill

## Self-test

```bash
node {baseDir}/scripts/selftest.mjs
```

329 assertions, no model calls, no quota spent, covering all the deterministic logic in chunking / merging / assembly / localisation / validation / rendering. Run this first after changing the script.

## Bundled sample

`{baseDir}/examples/渡口.txt` is a short story with 4 characters, where the peddler is only ever referred to by a nickname and the ferryman is only ever addressed as "老伯" — it exists specifically to exercise alias merging. Its outputs `渡口-cast.json` / `渡口-cast.md` serve as a quality baseline and as validation fixtures.
