# storyboard.json structure

Three levels: **episode → segment → cut**.

- **Segment** = one video generation call, total duration ≤ `maxSegmentSeconds` (15s by default), never crossing scenes — a location change always starts a new segment
- **Cut** = one edit inside a segment, `minCutSeconds`–`maxCutSeconds` (2–5s by default), each claiming script beats, carrying a shot size, a camera move and one frame
- **Frame** = one keyframe per cut: the first cut is the **master frame** (pinned at 0.00s), the rest are **sub-frames** (each pinned at its own cut mark). **One folder per segment**: `<segment id>/f<cut index>.png` + `prompt.md` (produced by export, whose content is the h3Prompt)

```json
{
  "source": "渡口",
  "aspectRatio": "16:9",
  "promptLang": "zh",
  "params": { "maxSegmentSeconds": 15, "minCutSeconds": 2, "maxCutSeconds": 5, "maxOnScreen": 3, "tolerance": 0.15 },
  "episodes": [ { "ep": 1, "segments": [ ... ] } ]
}
```

`aspectRatio` is the formal aspect-ratio contract shared by the storyboard and downstream image generation, accepting only `"16:9"` or `"9:16"`; it may be omitted, defaulting to `"16:9"`. The report lays out the master frame and sub-frame strip according to it, and every frame generated downstream must use the same aspect ratio. Older data's `_meta.orientation` and the aspect tag at the end of `frame` are kept for compatibility only; do not keep writing them in new data.

`promptLang` may be omitted (**defaults to `en` — the official spec's position**): English throughout, with dialogue keeping its original language inside `<d>[Chinese]`. Setting it to `zh` switches the whole prompt to Chinese (the alignment instruction, field names and shot markers all have Chinese versions) — an alternative to the official recommendation. **The name ban does not change with language**: the H3 body in both modes uses generic identities.

**The Seedance video prompt is not stored in the JSON**: the program assembles it on the fly from `shot`, the composition quantified fields, `blocking`, `soundscape`, `music` and the script dialogue (structure in `references/seedance-prompt.md`), and both the report and `export --protocol seedance` use the same assembly.

## segment

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Segment id `E01-01`: episode number + two-digit sequence, **numbered consecutively in order**. It is the asset filename (`E01-01.mp4` / `E01-01-f1.png`) |
| `sceneIndex` | int | Which scene in that episode of the script this segment is (starting at 1). All cuts in the segment share the same scene |
| `cuts` | cut[] | The cuts in the segment, in time order. The segment's total seconds = the sum of the cut seconds, **not stored separately** — one less piece of redundancy to drift |
| `h3Prompt` | string | **One H3 video prompt per segment**; body language follows `promptLang` (Chinese by default); structure in `references/h3-prompt.md` |
| `blocking` | string | **Character relationship and composition logic**: at the opening instant, who is on the left of frame, who is on the right, which way they face, how far apart they are (centimetres or paces). One per segment, and every shot starts from it. With reference-only generation this is the only place that says clearly "where the people are". **Required** (`composition` gate) |
| `soundscape` | string | **The soundscape for Seedance** (Chinese): ambient sound, action sound, non-verbal vocal sound, without restating dialogue. The program wraps it in `<>`; do not write them yourself |
| `music` | string | **The score for Seedance** (Chinese), writing instrumentation and tempo. Omit this field if there is none. The program wraps it in `（）` |
| `note` | string | Note, optional |

## cut

| Field | Type | Notes |
| --- | --- | --- |
| `beats` | [int, int] | Claims which beat through which beat of the scene (inclusive). **Every beat must be claimed by exactly one cut**, in order and contiguous |
| `seconds` | number | Cut duration, 2–5s — the short-drama attention rhythm is a hard gate. The dialogue seconds of the claimed beats must fit |
| `size` | enum | Shot size: `extreme-wide` 大远景 / `wide` 全景 / `medium` 中景 / `close` 特写 / `extreme-close` 大特写 |
| `camera` | enum | Camera move, **using the official H3 vocabulary directly** (as literal strings): `Static Shot` `Push In` `Pull Out` `Zoom In/Out` `Pan Left/Right` `Truck Left/Right` `Tilt Up/Down` `Pedestal Up/Down` `Arc Shot` `Tracking Shot` `Shake Slightly/Strongly` `POV` `Roll Clockwise/Counterclockwise` |
| `characters` | string[] | Characters in frame (C numbers), must be ⊆ the scene's characters in the script; an empty shot gets an empty array. Above `maxOnScreen` a `note` is required |
| `props` | string[] | Props in frame (P numbers), must be ⊆ the scene's props in the script. May be omitted |
| `frame` | string | **Frame prompt** (Chinese): this frame's subject, position state, action instant, light and mood. The Chinese shot-size word must appear in it; **name characters directly** (it points at the attached sheet) |
| `shot` | string | **Shot body** (Chinese): what happens in these seconds — camera move or transition → subject action and expression → position or spatial change; for how to write it see `shot-writing.md`. **Use generic identities, no character names**; no seconds, shot numbers, image references, dialogue or `{}` `<>` `（）` — the program adds those. This is the "画面：" (picture) line of the Seedance prompt |
| `lens` | string | Focal length + depth of field: `50mm 标准，中浅景深` / `85mm 长焦，极浅景深`. These six composition fields **are required per shot** (`composition` gate) |
| `cameraPosition` | string | Camera position: facing whom + at what angle, `李四 + 平视正面` / `双人 + 俯视 30°` |
| `composition` | string | Composition: `三分法` / `中心构图` / `对角线` / `对称` |
| `eyeline` | string | Eyeline landing point: `对方面部` / `手中衬衫` / `闭眼` |
| `focus` | string | What the focus locks: `锁定李四上半身` |
| `stability` | enum | `stable` 稳定 / `slight-shake` 微晃 / `handheld` 手持 |
| `sfx` | string | This shot's own sound effect, beyond the segment-level soundscape; optional |
| `lighting` | string | Light and shadow specific to this shot, beyond the scene level; optional |
| `recipe` | string | Shot recipe card id, optional. Checked only when `--shots <cards dir>` is mounted (`shot-recipe` gate). **At cut level, not segment level** — a segment may span several recipes; **a multi-cut recipe is expressed as consecutive cuts sharing the same id**, not an array |
| `note` | string | Note, optional |

`recipe` is an **optional mount**: without `--shots` the whole gate is skipped. With it, three things are checked — the id exists in the card library, every one of the card's `must_phrases` appears in that cut's `frame` (lowercased on both sides, `includes`), and when the card's `cuts` lower bound ≥ 2 the number of consecutive cuts sharing the id must not fall below that bound. The card's **suggested shot size and camera move are not gated**, and deviations are only flagged in the report: a recipe is vocabulary, not law.

## The structure of h3Prompt (three gates watch it; two things audited verbatim)

For how to write it see `references/h3-prompt.md` (an internalized version of the official methodology; this skill is self-contained and depends on no external skill). Skeleton:

```text
How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot 2) aligns with the 3.00-second mark of the target video; ….

integrated_multimodal_description:
[Shot 1] …（first-frame anchoring → action → camera move → dialogue; no style sentence）
[Shot 2] At 00:03.000, the camera cuts to …（one line per shot, starting with the cut time）

overall_soundscape: …（ambient and action sound, 1–4 sentences）

non_diegetic_music: …（1–3 sentences; N/A if none）
```

The five deterministic checks:

1. **The first-line alignment instruction is derived line by line from the cut structure according to `promptLang`** (`h3AlignmentLine`): a multi-cut segment pins each frame at its own cut second; a single-cut segment uses the fixed phrasing. validate **audits verbatim** — change the cut seconds and the old instruction immediately fails to match
2. The three field names are all present and in order; the description body has `[Shot 1]`
3. **Every `[Shot k]` (k ≥ 2) must carry the cut time `At 00:0X.XXX,`, equal to the running sum of prior cut seconds** — the rhythm written on paper must agree with the prompt
4. Every line of dialogue in the claimed beats goes **verbatim** into `<d>[Chinese] …</d>`; the speaker's identity, timbre and tone are written in English outside `<d>`; voice-over uses `says in an off-screen voiceover` with a note that the lips stay closed
5. The body language outside the `<d>` blocks matches `promptLang` (Chinese written as English, and English mixed into Chinese, are both blocked); both modes ban character names (official spec, not changing with language); each shot's camera-move term (Chinese terms like "推" and "固定" in Chinese, the official terms in English) must appear inside **its own [Shot k] passage**

## The duration constraint chain

Dialogue seconds (converted at the script's reading pace) ≤ the cut's `seconds` ≤ 5s; a segment's Σcuts ≤ 15s; an episode's Σsegments falls within the script's `targetSeconds` ±15%. All audited level by level by validate.
