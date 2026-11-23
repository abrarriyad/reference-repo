# art.json structure

The carrier for the art bible (scenes + narrative props). `dynasty` is document-level — one specific, real dynasty or era for the whole show (`明` / `北宋` / `民国`; i.e. Ming / Northern Song / Republic of China), and the form and patterns of scenes and props are written to it; vague values like "ancient" or "fictional" are not allowed, reason in rule 1 of `scene-pass.md`. **The model fills only the design fields**; the episode appearances and payoffs carried by scenes and props are transferred by `seed` from outline.json; when the outline has no `props`, the prop table is left empty for the model to extract from the text per `prop-pass.md`. Markdown and the report are rendered by `render`.

```json
{
  "source": "渡口",
  "dynasty": "民国",
  "scenes": [{
    "id": "S01", "name": "渡船船舱", "primary": true,
    "summary": "Design intent: what story this space tells ……",
    "anchors": [{ "name": "补丁船篷", "desc": "……" }],
    "lighting": [{ "state": "晨雾", "prompt": "dense white morning fog ..." }],
    "image": { "prompt": "…", "negativePrompt": "…", "sheet": "…", "tags": [] },
    "variantOf": "S02", "changes": "swap the backdrop + reed foreground",
    "usage": { "episodes": [1, 6], "beats": ["悬念钩"] }
  }],
  "props": [{
    "id": "P01", "name": "旧皮箱", "scale": "手持级",
    "summary": "Dramatic function: the suspense core of the whole show ……",
    "anchors": [{ "name": "绿锈铜扣", "desc": "……" }],
    "states": [{ "state": "合上", "prompt": "the suitcase closed ..." }],
    "relatedScenes": ["S01"], "carriedBy": ["沈知微"],
    "image": { "prompt": "…", "negativePrompt": "…", "sheet": "…", "tags": [] },
    "usage": { "episodes": [1, 6], "beats": ["悬念钩"] }
  }]
}
```

(The sample is the Chinese-language story *The Ferry*; the values `渡口`, `旧皮箱` etc. are story content in the source language. `手持级` means "handheld scale".)

## Top level

| Field | Required | Description |
| --- | --- | --- |
| `source` | Yes | Show / book title |
| `scenes` | Yes | Array of scenes |
| `props` | No | Array of **narrative props** — only those with close-ups, cross-episode, plot-carrying (3–8 is ideal); set dressing belongs to scene anchors. How to choose: see `prop-pass.md` |

## A single scene (the validator is the authority)

| Field | Required | Language | Description |
| --- | --- | --- | --- |
| `id` | Yes | — | `S01` format, globally unique. When using seed, keep the outline's scene id |
| `name` | Yes | Source language | Scene name |
| `primary` | Yes | — | Whether it is a main scene |
| `summary` | Yes | Source language | **Design intent**: what story the space tells and what feeling it should have, not a floor-plan description |
| `anchors` | 3–5 | Source language | **Consistency anchors** `{name, desc}`: recognizable features that must appear in every generation. Used to recognize the scene and also by QC on generated shots |
| `lighting` | ≥1 | state in source language / prompt in English | **Lighting states**: for AI, changing time of day means regenerating, not relighting, and every state must become a complete prompt |
| `image.prompt` | Yes | **English** | Single-image prompt for the main view; **must state it is an empty scene with no people** |
| `image.negativePrompt` | Yes | **English** | **Must ban people** (people/figure/…); this is the hard guarantee of an empty scene |
| `image.sheet` | Yes | **English** | Complete layout instruction for the environment sheet (see `sheet.md`); must contain, as a whole passage, one of the two surface-treatment sentences in `scene-pass.md` |
| `image.tags` | Yes | English | Tag array: genre, materials, lighting, palette. No art-style tags, see `scene-pass.md` |
| `variantOf` | No | — | Parent scene id of a variant. Generating a new scene with AI is cheap, but **a variant that reuses the parent scene's assets is more consistent** — scenes with a reusePlan in the outline should be made variants first |
| `changes` | Required with variantOf | Source language | What changed relative to the parent scene (time of day / weather / foreground / removed props) |
| `usage` | No | — | `{episodes, beats}`, filled automatically by seed; hand-written is fine too |

## A single prop (the validator is the authority)

| Field | Required | Language | Description |
| --- | --- | --- | --- |
| `id` | Yes | — | `P01` format, globally unique |
| `name` | Yes | Source language | Prop name |
| `scale` | Yes | Enum | `手持级` (handheld) / `桌面级` (tabletop) / `家具级` (furniture); the matching English phrase must appear in the prompts |
| `summary` | Yes | Source language | **Dramatic function**: what plot this prop carries |
| `anchors` | 3–5 | Source language | Detail features that withstand a close-up (a fresh scratch on the copper clasp, a crescent wear mark on the ink well) |
| `states` | ≥1 | state in source language / prompt in English | **State variants**: closed/open, hidden/spread out — one reference per state |
| `relatedScenes` | No | — | Ids of the scenes it mainly appears in; must exist |
| `carriedBy` | No | Source language | Who carries it, free text |
| `image.prompt` | Yes | **English** | White background, main view; **must carry the scale phrase, no people, no hands** |
| `image.negativePrompt` | Yes | **English** | **Must ban people and hands** (hands/fingers) |
| `image.sheet` | Yes | **English** | Sheet layout instruction; **must state pure white background** + one of the same two surface-treatment sentences |
| `usage` | No | — | `{episodes, beats}` |

## Hard rules (10 quality gates, all code)

1. Anchors 3–5 — fewer and it cannot be recognized, more and it cannot be checked
2. Lighting states ≥1, each with an English prompt
3. **Empty scene**: the negative prompt must ban people. Environment and characters are two asset layers, and mixing them in one image ruins consistency
4. Image prompts (main / negative / sheet / lighting) are all English
5. Prompts contain no character names (only checked with `validate --cast cast.json`; if not given, it says so and skips)
6. Variant references complete: `variantOf` points to an existing scene and carries `changes`

Four prop-specific gates:

7. States ≥1, each with an English prompt
8. Scale reference written into the prompts (the English phrase matching the scale enum)
9. Negative prompt bans hands — a hand holding the prop is the most common contamination
10. Sheet on a pure white background that can be cut out

## Validation

```bash
node scripts/novel-art.mjs validate art.json --cast cast.json
node scripts/novel-art.mjs checkup art.json               # only prints the 10 gates ✓/✗
```
