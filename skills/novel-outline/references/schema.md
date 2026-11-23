# outline.json structure

The carrier for the five pieces. **The model only fills in this JSON**; Markdown and report.html are rendered by `render`, and the asset list is aggregated by script — the five pieces are four written by the model + one computed.

```json
{
  "source": "Book title",
  "lang": "zh",
  "params": { "episodes": 60, "minutesPerEpisode": 2, "genre": "女频逆袭", "adaptMode": "抽核", "preferences": [] },
  "adaptation": { "core": "…", "keep": [], "cut": [], "merge": [], "risks": [] },
  "characters": [ { "id": "C01", "name": "…", "role": "…", "arc": "…", "from": ["original…", "merged: …"] } ],
  "scenes": [ { "id": "S01", "name": "…", "primary": true, "reusePlan": "…" } ],
  "beats": [ { "id": "B01", "type": "打脸", "weight": "major", "episode": 3, "setup": "…", "payoff": "…" } ],
  "episodes": [ { "ep": 1, "synopsis": "…", "hook": "…", "suspense": "…", "sceneIds": ["S01"], "characterIds": ["C01"], "propIds": ["P01"], "crowdPlan": "…", "warnings": [] } ]
}
```

## params

| Field | Required | Description |
| --- | --- | --- |
| `episodes` | Yes | Total episode count, a positive integer. The number of episodes must match it |
| `minutesPerEpisode` | Yes | Per-episode length (minutes) |
| `genre` | Yes | Genre, **which decides the beat types**; it may not be missing. Differences between distribution platforms get no field of their own and show up directly in `thresholds` |
| `adaptMode` | Yes | `忠实` (faithful) / `抽核` (extract the core) / `借壳` (borrow the shell); only these three |
| `preferences` | No | Characters and scenes the user names to keep |
| `thresholds` | No | Overrides quality-gate thresholds item by item: `maxLeads`(5) / `maxSupport`(10) / `maxFunctional`(10) / `maxBeatGap`(3) / `maxPrimaryScenes` (the default is not a constant but **dynamic with episode count**: 4 + ⌈episodes/10⌉ clamped to 5–15, 60 episodes → 10. Set for AI short drama — scenes are generated, and the cap guards consistency assets, not set-building cost). For short runs, tightening the cast tiers is advisable |

## adaptation notes

`core` is the one-sentence core, required. `keep` / `cut` / `merge` entries are each `{what, why}`, with at least one `keep`; **when `adaptMode` is not faithful, `cut` cannot be empty**. `keep` may carry `evidence` — a **verbatim source passage**; this is the countermeasure against inventing from the title: key trade-offs must be able to point back to the source. Each of `risks` is `{what, plan}`.

Two optional **decision annotations**, which the "Key decisions" block of the report shows:

- `cutNote` — a conclusion sentence for the cut ("this means: the endpoint of the whole show is… the last 30 chapters of the original are basically unused"), making clear what the story's endpoint becomes after cutting
- `mergeNote` — an annotation for the merge, usually the reason the lead group was chosen (who has a complete arc of change)

If given, it cannot be an empty string; `validate` will block it. The big-reveal placement list **does not need to be written** — the report computes it automatically from `beats`.

## characters cast table

Every field follows the validator, not one more and not one less:

| Field | Required | Description |
| --- | --- | --- |
| `id` | Yes | `C01` format, globally unique, referenced by the episodes |
| `name` | Yes | Name; functional roles use a label ("emergency doctor") |
| `role` | Yes | Positioning in one sentence: female lead / disruptive supporting / the ferry's timekeeper… |
| `tier` | Yes | One of three tiers, see the table below |
| `arc` | Required for lead / support | Character arc; may be omitted for functional — the doctor is only there to stitch a wound |
| `from` | Yes | **← change log**, a non-empty array: who it corresponds to in the original, who was merged in; for a purely original character write `["original"]` |

- `tier` has only three tiers — a one-size-fits-all cast cap confuses "who the audience must remember" with "how many faces production must maintain", and tiering separates them:

  | tier | Who | Cap | Rule |
  | --- | --- | --- | --- |
  | `lead` | Lead group (male and female leads + main villain) | 1–5 people | `arc` required |
  | `support` | Named important supporting (relatives, best friend, secondary villain) | ≤ 10 | `arc` required |
  | `functional` | Functional roles (doctor, secretary, shop assistant) | ≤ 10 | **Takes up a face but not a name**: `name` uses a label ("emergency doctor"); `arc` may be omitted — the doctor is only there to stitch a wound |

  Nameless background people do not go in the table, are not tracked, and are not capped.

  **This table is the cast list for the downstream novel-characters**: who goes in, who stays out and who is in the lead group is fixed here, and character design follows it without judging again who matters (`tier` maps onto what used to be `importance`: `lead` → protagonist, `support` → supporting, `functional` → minor). Conversely, if you already have a cast.json it can be mapped in: protagonist/major → `lead`, supporting → `support`, minor → `functional`

## scenes

- `id` format `S01`, globally unique; `name` required; `primary` a required boolean (the main-scene cap scales with episode count, see `thresholds`)
- **A scene that appears only once in the whole show must carry a `reusePlan`** (the workaround: which existing environment asset to reuse, and what time of day/weather to change to make it)

## props narrative props

- **Optional field.** If not written, all quality gates pass as usual (the `prop-cap` and `refs` gates say plainly that they were skipped); if written, it is checked as below
- `id` format `P01`, globally unique; `name` required
- **`function` is required — the one thing this layer must settle: what this object carries in the drama.** If it cannot be filled in, it is not a narrative prop but set dressing, which belongs to `novel-art`'s scene anchors and not in this table
- `beatIds` optional: which beats it holds up. If written, it must point to ids that really exist in `beats`
- The cap `maxProps` defaults to 8 (override it by putting it in `params.thresholds`). The same order of magnitude as the number of leads — **only those with close-ups, cross-episode appearances and plot-carrying weight**
- Episodes reference it with `episodes[].propIds`. **A prop no episode references will be named by the `refs` gate** — the same criterion as an unemployed character or an idle scene

Boundary: scale, anchors, state variants and white-background prompts are all `novel-art`'s job and are not settled here. This table answers "which objects carry the plot and what each one carries", and the art layer answers "what it looks like and how to guarantee it looks the same across six episodes".

## beats beat table

- `id` format `B01`; `type` free text (face-slap / exposure / reversal…); `weight` only `major` / `minor` (defaulting to minor)
- `episode` is the **single source of data** — episodes no longer list beatIds, and both the rhythm bar and the asset list are computed from here
- Hard rules: adjacent beat gap ≤ `maxBeatGap`, no vacuum at the start or end; **at least one major, and the earliest major cannot fall in the last episode**

## episodes synopses

- `ep` numbered consecutively from 1, the total equal to `params.episodes`
- `synopsis` / `hook` / `suspense` — all three columns are **required**; an empty [hook] or [suspense] counts as unfinished
- **Narrative voice**: quoted dialogue with `「」『』“”` in any of the three columns means you are writing a script, which is overstepping, and validate will block it
- `sceneIds` / `characterIds` are required and must point to registered ids; every character must appear in at least one episode and every scene be used at least once
- `propIds` optional (meaningful only if `props` is written), must point to registered prop ids; every prop must appear in at least one episode
- An episode with `characterIds` ≥ 3 must write `crowdPlan` (the three-in-frame breakdown plan). **Validation judges by headcount, a proxy** — if the three are not actually in frame together in this episode (they are in different scenes), just write that fact as the plan: "three people in two separate scenes, never in frame together, shot scene by scene", and it passes just the same
- `warnings`: when the synopsis scan finds generation-difficulty keywords (rain scene / physical contact / crowd / hand close-up) they must be listed; better to over-report

## Validation

```bash
node scripts/novel-outline.mjs validate outline.json --stage skeleton|beats|full
node scripts/novel-outline.mjs checkup outline.json   # only prints the 14 quality gates ✓/✗
```

stage is the process gate: before the skeleton is signed off, pass `skeleton`; **before writing the episodes, `beats` must pass** (if the beat gaps and major timing are wrong, finishing the episodes wastes everything); before delivery, pass `full`.
