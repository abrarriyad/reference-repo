# Seedance video prompt · writing spec (internalized)

The methodology is learned from ByteDance's 《Doubao Seedance 2.0 系列提示词指南》, **internalized into a document bundled with this skill, depending on no external page**. **For how to write the body content see `shot-writing.md`** (one camera move per cut, actions must be completable, dialogue verbatim, layered sound, no visual style); this document covers only Seedance's specific syntax, symbols and taboos.

The difference from H3 is not a matter of phrasing preference but of protocol: H3 pins reference images to seconds through the body text; Seedance is an "omni-modal director" that splits input into a spatial layer (what is in the picture) and a temporal layer (how it changes over time), **expressing the temporal layer through shot order, not through seconds**.

## Language: Chinese throughout

The official examples are all in Chinese, and the symbolic conventions for dialogue, sound effects and music were designed around Chinese too. Write the whole body in Chinese, and use the Chinese terms from `schema.md`'s vocabulary for camera moves. **Keep the dialogue language consistent and avoid mixing Chinese and English** (except for proper nouns).

## The official advanced formula

> Precise subject + action detail + scene environment + light and colour tone + camera move + visual style + image quality + constraints

Where each item lands in this pipeline:

| Formula item | Where it lands |
| --- | --- |
| Precise subject, action detail, scene environment, camera move | **Each cut's body** (this document covers this) |
| Light and colour tone | Write the light direction and mood in each cut's body, **without naming a colour grade** — colour grade belongs to the style layer |
| Visual style, image quality | **The style layer**, appended by the caller at submission time; not written in the body |
| Constraints | **Global constraints**, assembled at the end by the program: supplied by the caller with `--constraints <file>` (one per line), then the program adds "no subtitles" and, for multiple people in frame, "no twins" |

## The temporal layer: shot order, no seconds

The official wording: "the model's support for precise timing (such as 0–3 seconds) is unstable, and forcibly limiting the duration may cause abnormal generation results", "do not force a limit on each segment's duration; let the model generate the rhythm naturally according to the plot".

So in the body:

- **Do not write** timings like `0–3 秒`, `第 3 秒` or `00:03.000` — the total duration is controlled by the interface parameter, and the rhythm is left to the model
- **Do not write** headings like `【镜头1】` — the program adds them in cut order, and writing them duplicates them
- **Do not write** `@图片N`, `<Picture k>` or `[Shot k]` — reference-image numbering is added by the program in the real attachment order
- Each cut writes only what happens in these seconds: **camera move or transition → subject action and expression → position or spatial change**. Composition does not rely on adjectives but on `schema.md`'s quantified fields (focal length / camera position / composition / eyeline / focus / stability); sound goes into the soundscape/score fields

## Which fields you write

| Position in the prompt | Field |
| --- | --- |
| The "画面：" (picture) line | Each cut's `shot` (Chinese, generic identity) |
| 【人物关系与构图逻辑】(character relationship and composition logic) | Each segment's `blocking` |
| Focal length / camera position / composition / eyeline / focus / stability | Each cut's `lens` / `cameraPosition` / `composition` / `eyeline` / `focus` / `stability` |
| Sound-effect line, light line | Each cut's optional `sfx` / `lighting` |
| `<音景>` / `（配乐）` | Each segment's `soundscape` / `music` (without symbols; the program wraps them) |
| Camera move, shot size | Each cut's `camera` / `size` enum; the program converts them to Chinese terms |
| Dialogue `{}` | Not written by you — the program takes it verbatim from the beats claimed from the script |

`render --html`'s prompt panel has a Seedance tab, and `export --protocol seedance` produces the production pack (one `seedance.md` per segment + attachments, plus `seedance-manifest.json` at the root).

## The shape the program assembles (illustrative; you do not write this)

One structured shot table per segment. Reference images are declared first, then segment-level blocking, then each shot expanded by fixed fields, and numbering constraints at the end:

```
@[图片1] = 正厅
@[图片2] = 张三
@[图片3] = 李四

【人物关系与构图逻辑】
张三坐于榻沿，李四立于榻前约两步，两人面对面。张三在画面左侧，李四在右侧。

【镜头1】
焦距：50mm 标准，中浅景深
机位：双人 + 平视正面
构图：三分法
运镜：缓慢推镜
景别：中景
画面：一名年轻书生猛地从榻上坐起，双肩后缩；一名铁灰袍中年男子举刀立于榻前。
台词：{}
视线落点：对方手中的刀
焦点：锁定年轻书生上半身
稳定性：稳定
音效：被褥摩擦声

【镜头2】
焦距：85mm 长焦，极浅景深
机位：中年男子 + 平视正面
构图：中心构图
运镜：固定镜头
景别：近景
画面：中年男子举刀不动，下颌绷紧。
台词：{逆子！连状元都敢买，你要江家满门陪你掉脑袋？}
视线落点：对方面部
焦点：锁定中年男子面部
稳定性：稳定

<被褥摩擦声、压抑的呼吸声，刀刃细微的金属颤音>
（低沉鼓点与克制的弓弦持续音）

视觉风格：<画风层>

【约束】
1. <video.seedance.prompt 逐句拆成编号>
```

Each line appears only when it has content: with no `sfx` there is no "音效：" line, and with no dialogue write `台词：{}`. The `（构图参考 @图片N）` in parentheses after `画面：` appears only when this shot has a frame; with reference-only generation there is none and composition rests entirely on the fields above — which is exactly why they exist.

## Symbol conventions (official rules; both the program and the gate follow them)

| Information type | Symbol | Example |
| --- | --- | --- |
| Dialogue | `{}` | 舍友笑着问 {考得怎么样呀，过了吗} |
| Sound effect | `<>` | `<远处传来狗叫声>` |
| Music | `（）` | `（背景中播放着快节奏的摇滚乐）` |
| Subtitles | `【】` | **Not used** — this pipeline does not want subtitles; they are banned in the global constraints |

- **Dialogue goes verbatim into `{}`**, not a punctuation mark changed; the speaker's identity, tone and whether it is a voice-over go outside `{}` (voice-over writes "以画外音说"). No `<d>`, language tags or `(S1)` numbering
- Dialogue in a minority language must be tagged with the language: `用日语说道{こんにちは}`
- Sound effects and music are wrapped in symbols by the program from the soundscape/score fields; do not restate them in the body

## Camera moves

Use the standard terms directly (中景、特写、全景、缓慢推镜、平稳横移、固定镜头 …). **Specify only one camera move per shot** — the official wording: "do not ask for push, pull, pan and tilt at the same time; it increases the instability of the picture".

## Actions (the official four points, already merged into `shot-writing.md`)

Limb specificity + quantified degree; prefer low, slow, continuous small actions; supply transitions between actions; externalise emotion concretely. These are protocol-independent and apply to H3 equally, so they live in the common layer.

## Reference images and subjects

- The storyboard path passes **the frames + the previous segment's last frame**, and each carries only the role the program assigns it in "asset responsibilities"
- **Do not use turnarounds / multi-view images as character references** — the official docs say plainly they will be recognised as multiple subjects, worsening ID drift and "twins". Character references use a headshot + a full-body shot; the frames this pipeline produces are single-viewpoint anyway
- Keep the total number of assets to 4–5; **do not use the full limit**, or the model cannot tell which has priority
- Assets that need more precise referencing go earlier
- With multiple people in frame, ban twins in the global constraints: "视频全程禁止出现外形、着装、配饰完全一致的人物"

## Known pitfalls (from the official FAQ)

- **Style drift**: if the reference images are realistic and no style word is written, the output drifts to live-action realism. So the style layer must be appended, and even "photorealistic" must be stated explicitly
- **Subtitles**: cannot be 100% avoided, only made less likely — constraint words "保持无字幕" and "避免生成任何文字或字幕"; landscape orientation produces subtitles noticeably less often than portrait
- **Chinese pronunciation**: polyphonic and rare characters are easily misread; in dialogue you may substitute a common homophone ("螭龙山" → "吃龙山")
- **End-of-clip noise**: videos with narration may have truncated noise at the end; fade it out in post
