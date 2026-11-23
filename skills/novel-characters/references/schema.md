# Character card structure

`cast.json` top level:

```json
{
  "source": "渡口",
  "lang": "zh",
  "summary": "民国年间的清晨，一条河的渡口浓雾未散。摆渡四十年的老船夫照常开船，先后上船的是……",
  "characters": [ /* character cards */ ]
}
```

| Top-level field | Required | Notes |
| --- | --- | --- |
| `source` | Yes | Book / piece title, used as the report title |
| `lang` | Yes | Report language, `zh` by default |
| `ui` | Conditional | UI string translations. **Not needed** when `lang` is `zh`/`en`/`ja` (built in); **required** for any other language, otherwise `validate` fails. Generate a skeleton with `ui-template <lang>` and translate it. Partial key coverage is allowed; missing keys fall back to the built-in English |
| `summary` | Yes | **Story summary**, 3–5 sentences in Chinese. Gives the time and place, the core situation, and the reason these people are together. Shown at the top of the report so the reader knows how these characters relate without reading the source. Do not spoil the ending, and do not write it as a blurb |
| `characters` | Yes | Array of character cards |

A missing `summary` is flagged as a violation by `validate` — the top of the report would be blank.

A single character card:

```json
{
  "name": "老周",
  "aliases": ["老伯"],
  "importance": "major",
  "oneLiner": "在渡口摆渡四十年的老船夫，一只眼睛是白的。",

  "persona": {
    "gender": "男",
    "ageRange": "约七十岁（推断）",
    "identity": "渡口船夫",
    "appearance": "背驼得像一张拉满的弓。左眼被风沙磨得只剩一层白翳。……",
    "personality": ["沉默", "耐性", "老练"],
    "temperament": "开口时嗓子里像卡着半口江水，含混、发沉。……",
    "motivation": "把船开过去。雾再厚也照常开船。",
    "arc": "静止。他是这条河的一部分。",
    "relationships": [{ "name": "沈知微", "relation": "向他问路的年轻渡客" }],
    "evidence": ["雾一厚，连自己的手都看不清。"]
  },

  "image": {
    "prompt": "Character design sheet of an elderly Chinese ferryman ...",
    "promptLocal": "角色设定图：约七十岁的中国老船夫……",
    "negativePrompt": "young face, smooth poreless skin, perfectly symmetrical face, dead eyes without catchlights, helmet hair, extra fingers, ...",
    "tags": ["character sheet", "three-quarter view", "neutral background"],
    "sheet": "Single character model sheet on ONE 16:9 landscape canvas ... LEFT ZONE ... about 34% ... one bust portrait ... RIGHT-TOP ZONE ... three FULL-BODY views ... PROPORTIONS ARE CRITICAL ... RIGHT-BOTTOM ZONE ... four to five small isolated close-up studies ..."
  },

  "voice": {
    "timbre": "沙哑低沉的男中低音，喉音重",
    "pitch": "低",
    "pace": "缓慢，字与字之间拖着气口",
    "accent": "南方水乡口音，尾音含混",
    "emotion": "疲惫而平静",
    "referenceHint": "像一个在同一个渡口喊了四十年「开船」的人",
    "prompt": "An elderly male voice, around seventy-five. Low bass-baritone ..."
  }
}
```

## Language split

"Local language" = the language given by the top-level `lang`, Chinese by default.

| Field | Type | Language | Notes |
| --- | --- | --- | --- |
| `name` | string | source | The form used most often in the source |
| `aliases` | string[] | source | Other forms of address; occupational nouns (e.g. "peddler") belong in `identity`, not here |
| `importance` | enum | — | `protagonist` / `major` / `supporting` / `minor`, **only these four** |
| `oneLiner` | string | **local language** | Captures this person in one sentence |
| `persona.*` | — | **local language** | `personality` 3–5 words |
| `persona.evidence` | string[] | **source language** | **Verbatim quotes**, never translated — translated, they are no longer evidence. Empty array if none |
| `image.prompt` | string | **English** | A single character image; **character names forbidden**; **must state ethnicity / era / region and keep the visible design that matches identity**, without specifying a rendering style |
| `image.promptLocal` | string | local language | Translation of the above; omit when `lang=en`; **character names forbidden here too** |
| `image.negativePrompt` | string | **English** | Comma-separated |
| `image.tags` | string[] | **English** | 4–8 retrieval tags: subject, era, palette, material, lighting. **No style tags** (`semi-realistic`, `painterly` and the like); style is decided at generation time |
| `image.sheet` | string | **English** | **The character model sheet**, 16:9 three-zone layout: about 34% on the left for the bust portrait (facial baseline) / full-body turnaround top right / detail strip bottom right, separated by thin rules; **character names forbidden**; **must state ethnicity / era / region** |
| `voice.timbre/pitch/pace/accent/emotion/referenceHint` | string | **local language** | The easiest place to drift; watch it |
| `voice.prompt` | string | **English** | For the TTS voice-design engine. **There is no `promptLocal` counterpart, and this is intentional** — the six fields above are already in the local language, and another paragraph of Chinese prose would only make people copy the wrong one and feed it to TTS (hit in production) |

**English fields do not follow `lang`.** Image models and TTS engines are steadiest with English, regardless of the report language.

## The model sheet's three-zone layout

16:9 landscape, split into three blocks by thin rules:

- **Left (about 34%)** the bust portrait serves as the **facial design baseline** — large, with finely drawn features, directly usable for expression design
- **Top right** the turnaround handles silhouette, proportion and clothing; the face is drawn to match the left column
- **Bottom right** the detail strip, small close-ups of 4–5 key details (accessories, props, scars, footwear …)

The two places it most easily breaks: **two different faces appearing in one image**, and **squashing the figure to fit in the detail**. Both must be hard-wired in the prompt — if the detail will not fit, extend along the right edge, and **it is always the detail that gives way, never the figures**.

## Validation

`scripts/novel-characters.mjs validate <cast.json> <book.txt>` checks: structural integrity, the `importance` enum, **verbatim quotes**, **no character names in image prompts**, **language split**. Violations are listed one by one and it exits 1.

The script does not judge whether the clothing suits the character's identity. That item is done by the identity–appearance semantic self-check in `profile-pass.md` when the card is generated; passing structural validation does not mean the look's semantics have passed.
