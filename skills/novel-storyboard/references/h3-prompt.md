# H3 video prompt · writing spec (internalized)

The methodology is learned from the MiniMax-H3 official prompt guide (I2VA / multi-image alignment mode) and **internalized into a document bundled with this skill — depending on no external skill**. Write each segment's `h3Prompt` per this document; the structural parts are audited verbatim by a quality gate.

**For how to write the body content (one camera move, actions must be completable, dialogue verbatim, layered sound, no visual style) see `shot-writing.md`; this document covers only H3's specific syntax and fields.**

## Language split

- **English throughout by default** (`promptLang: 'en'`) — the official spec's position: body, alignment instruction, field names and shot markers all in English, character names banned (use generic identities like an old ferryman)
- Three things keep the source language (official rule): **dialogue** (`<d>[Chinese] …</d>`, verbatim original, not a single punctuation mark may change, a gate watches it), lyrics, and text visible in the picture (quoted as-is in English double quotes)
- `promptLang: 'zh'` switches the whole prompt to Chinese (the alignment instruction, field names and shot markers all have Chinese versions) — an alternative to the official recommendation; if Chinese proves unstable in testing, go back to English. **The ban on character names does not change with language**: it comes from the official spec, and Chinese mode likewise uses generic identities

## Structure (the parts validate audits verbatim)

```text
How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot 2) aligns with the 3.00-second mark of the target video; ….
(a single-shot segment instead uses the official I2VA fixed sentence: For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.)

integrated_multimodal_description:
[Shot 1] Anchor the characters and states to <Picture 1>'s composition, then write what happens in these seconds, how the camera moves, who says what (all English, **no style sentence** — style is appended uniformly by the caller).
[Shot 2] At 00:03.000, the camera cuts to <Picture 2>: …… (**one line per shot**, starting with the cut time, equal to the running sum of prior cut seconds)

overall_soundscape: 1–4 English sentences: ambient sound, action sound, non-verbal vocal sound. Do not restate dialogue.

non_diegetic_music: 1–3 English sentences on instrumentation and tempo (inaudible to the characters, audible only to the audience). Write N/A if there is none.
```

The Chinese mode (promptLang=zh) corresponding tokens: `参考图与目标视频的对齐——` / `整体视听描述：` / `[镜头 k] 于 00:0X.XXX，`, and "none" for music is written `无`.

The first-line alignment instruction and the cut times **are derived from the cut seconds**; change the seconds and forget the prompt, and validate blocks it on the spot.

## Camera-move terms follow the language

The content rule (one camera move per cut, written as an action sentence) is in `shot-writing.md`. What is H3-specific is **the language of the terms**: English mode uses the official terms (static shot / push in / tracking shot …), Chinese mode uses the vocabulary's Chinese terms (固定/推/拉/跟拍 …) — the gate checks per `promptLang`, and the term **must land on its own line**.

## Speakers and dialogue

- Dialogue verbatim, identity written outside the dialogue (see `shot-writing.md`). What is H3-specific is **the marking**: dialogue goes into `<d>[Chinese] …</d>`, and `<d>` holds only the language tag and the dialogue text
- Speaker numbering `(S1)` `(S2)` stays stable across the segment; on first appearance give enough identifying information (identity, age range, timbre, pace); for two speakers at once use `(S1,S2)`
- **Voice-over**: Chinese writes "以画外音说（唇形完全闭合）"; English uses the official phrasing `says in an off-screen voiceover … while their lips remain completely closed`
- Text genuinely visible in the picture (signboards, notes) is quoted as-is in English double quotes, not translated

## The sound field names

For how the three layers split see `shot-writing.md`. Landing in H3's fields: dialogue, singing and in-world music → the shot line of `integrated_multimodal_description`; ambient and action sound → `overall_soundscape`; score → `non_diegetic_music` (write `N/A` if none; Chinese mode writes `无`).

## How keyframes are referenced in H3

The master frame (f1) is pinned at 0.00s and is the complete reference for this segment's world; each `[Shot k]` first writes `<Picture k>` to anchor this cut's composition and character states, then writes the action unfolding. Whether the action can be completed, and where the character is at this moment, must match the image; see `shot-writing.md`.
