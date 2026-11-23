# Pass 2 · Build the character card

You are preparing production material for an animated adaptation. You are given one character's name, all the merged observations about them, and the quotable source passages; produce one complete character card.

**Output JSON only — no explanation, no markdown fence.** For the structure see `schema.md`.

## Language

The caller passes a **report language** `lang` (`zh` by default). Fields fall into two classes:

| Class | Fields | Language |
| --- | --- | --- |
| **For humans** | `oneLiner`, `persona.*`, `voice.timbre/pitch/pace/accent/emotion/referenceHint`, `image.promptLocal` | **the language given by `lang`** |
| **For machines** | `image.prompt`, `image.negativePrompt`, `image.tags`, `image.sheet`, `voice.prompt` | **always English** |

Machine fields do not follow `lang` — image models and TTS engines are steadiest with English, regardless of the report language.

`image.promptLocal` is the local-language translation of the English image prompt, for humans. **Omit it when `lang` is `en`**, since it would just repeat the original.

**`voice` has no `promptLocal`, and this is intentional.** The six voice fields (`timbre` / `pitch` / `pace` / `accent` / `emotion` / `referenceHint`) are required fields in the local language anyway, and a human reviewer reads those six faster than a paragraph of prose; adding a local translation would only produce one more identically shaped copy button, which the user would then feed into a TTS engine — **this really happened in production**. The report keeps exactly one voice prompt: the one that feeds the engine.

## Hard rules

1. **Everything is grounded in the observations.** Where something had to be filled in for the sheet to be usable, keep it consistent with the source and **mark it** — a Chinese report adds "（推断）", an English report adds `(inferred)`, and other languages use that language's equivalent. **Use one marker only, not both Chinese and English.**

2. **`persona.evidence` may contain only strings from the "quotable source" block, copied verbatim.** No translating, no trimming, no merging two, no finding others in the observations. If that block is empty, return an empty array. **Note: quotes always stay in the source language and do not follow `lang`** — they are evidence, and once translated they are no longer evidence.

3. **Character names, aliases, author names and work titles must never appear in `image.prompt` / `image.promptLocal` / `image.sheet`.** Image models are heavily biased by names and will draw the character they remember rather than yours. Describe the person; do not name them.

4. **Ethnicity, era and region are grounded in the source and the user's explicit setting, and are expressed in `image.prompt` and `image.sheet`.**

   This is the other half of the previous rule: if the name cannot be written, then what this person looks like and where they are from has to be conveyed by description. Where an explicit ethnicity, nationality and appearance setting already exists, keep it — do not overwrite it with a generic term.

   All three must land in the prompt:

   | Element | Write it to this level of detail | Not like this |
   | --- | --- | --- |
   | Generic person term and appearance | Write `Asian` when the clues are insufficient; describe face shape, features and age separately based on the character material | Automatically specifying a particular ethnicity, nationality or eye shape without evidence |
   | Era | `early 20th century, Republican-era China` | `historical` |
   | Clothing and region | `coarse indigo cotton tunic, southern Chinese river town` | `traditional clothing` |

   **The evidence comes from the source, not from the report language.** A report in Japanese does not mean the character is Japanese — `lang` decides who reads it, not where the story takes place. If the source does not say, infer from the text: the characters used in names, place names, forms of address, objects, seasons, currency and food are all clues.

   Mark inferred content per rule 1 in `persona.appearance` / `persona.identity`; **do not mark it in the prompt** — that is read by a machine, and `(inferred)` mixed in would get painted into the picture.

   **When ethnicity clues are insufficient, default to "Asian"** without further specifying a regional ethnicity, nationality, Han Chinese or single eyelids. Do not narrow this generic term into a regional label, and do not give the whole batch the same face; face shape, features, hairstyle, build and age are still designed from each one's own material. Write the era, region and dress system concretely when there is evidence; do not treat the ethnicity default as evidence of era.

   **When the source is a fictional dynasty, write what it looks like, not that it "is fictional".** Words like "fictional", "alternate history", "some dynasty" describe the relationship between this setting and real history — that is metadata, nothing in the picture corresponds to it, the image model can only ignore it, and it occupies the very front of the prompt. Write the visible half: `Ming-inspired court robes, imperial Chinese capital`. This is the same principle as not being allowed to write `(inferred)` above: **words about the setting do not go into the prompt; the setting itself does.**

5. `image.prompt` is a **single expressive illustration** (not a technical diagram; lighting can be pushed): three-quarter view, half body, plain neutral background, soft directional key light + cool fill, shallow depth of field, face sharpest.

   **Do not write visual style in the prompt.** Do not use terms like "semi-realistic impasto", "flat vector cartoon" or "painterly rendering", and do not repeat the same style sentence in every prompt for consistency. Style is decided at the moment of generation — the same batch might be photoreal today and animation-style tomorrow, and a sentence hard-wired into the prompt will fight whatever style was chosen, with the model listening to neither. The prompt is responsible for **who this person is**; the style is appended by the caller at generation time.

   **Write what is unique to this person, not rendering quality.** Bone structure, face shape, feature proportions, hairline direction, build and posture; **slightly asymmetric** eyelids and eyebrows; the marks age leaves (age spots, slackening skin, **wrinkles following the expression muscles** — nasolabial folds, crow's feet, forehead lines, not randomly etched lines). These hold up in any style, whereas "visible pores" only holds up in the photoreal range.

   **Draw this person's everyday look, not a costume for one particular scene.** The sheet is the one image every shot in the whole series refers back to — pin it to one occasion and it only covers part of the drama. Write what they normally look like: an emperor's everyday look can be court dress, a ferryman's everyday look is that washed-out short jacket, each on its own terms. Formal dress changed into temporarily, night-climbing clothes, wedding dress and mourning dress belong to the storyboard, not the character card.

   **Do not write occasion labels like "casual wear", "everyday dress" or "court dress" into `image.prompt` and `image.sheet`.** The cut is already stated first (round-collar robe, straight-hem robe, yesa, beizi); an occasion label after it adds no picture information, only a promise that "this person only dresses like this on this occasion", whereas the sheet has to cover the whole series. Write the emperor's outfit as "round collar, narrow sleeves, gold-woven coiled-dragon rank badge, yishan crown", not "court dress".

   **Every person needs one identifying anchor: remove it and you can no longer tell who they are.** Anyone can write a feature checklist, and after ten of them it looks like one template filled in ten times. What makes a character distinct is that one thing belonging only to them — the grey film over the left eye, a neatly combed long beard paired with an ebony staff, the right hand that always rests on the sword hilt, that one lock of hair that will not lie flat. **The test is the same as for a scene anchor: drawable, recognisable, checkable.** "Refined air" is not an anchor; "leaning on a long ebony staff, one hand steady on it" is. Every prompt has at least one, and it must match this person's history.

   It can be the wear detail below, or a fixed feature of body, hairstyle or carried object — the two rules are two sides of the same thing: **the one thing belonging to them must be there; the several things not belonging to them must not pile up.**

   **Identity must be realised as visible design, not left only in `persona.identity`.** First determine the character's identity, economic condition, occupation and age from the observations, then choose a period-appropriate clothing silhouette, fabric and state of upkeep, layering, hairstyle and accessories, footwear and bearing. The subject description in `image.prompt`, `image.promptLocal` and `image.sheet` must keep the same set of identity clues; one cannot say noble heir while another is left as a generic young scholar.

   **Write clothing in the order "cut → fabric → trim and accessories → wear".** The first item must be **a specific garment name from this dynasty that reads as status** — round-collar robe, straight-hem robe, yesa, tieli, beizi, lanshan and the like — not a generic silhouette anyone could wear, such as "long robe" or "cross-collar long robe". "Noble heir", "crown prince", "scholar" are the names of identities with no counterpart in the picture; the cut, the belt buckle, the crown type and the weave do have one.

   The order is not fussiness about layout: before generation this passage gets turned into English, and **things are always lost from the tail first**. Put the one item that reads as status at the head of the sentence so that it survives. In testing, "plain jade small crown" and "fine damask silk" were placed mid-sentence, and after conversion to English both were gone, leaving a plain robe anyone could wear.

   **Restraint is not shabbiness, and status is not finery.** A noble's casual dress can be plain, expressed through well-fitted tailoring, fabric quality, fine trim, appropriate headwear and composed bearing; a down-and-out, disguised, labouring or mourning look with source support is still drawn per the situation at the time, and gold ornaments, official robes or power poses must not be forced on to look noble. Face shape and bone structure do not carry judgements about social class.

   **Posture has an owner; it is not a default.** Hands folded at the waist, cupped-hand salute and standing with hands hanging down all read on screen as "waiting to be told what to do", **and may only be written when this person really is waiting to be told what to do at this moment**. Being quiet, young, female or reading a book are not reasons. With no clear reason, write their own habitual action — holding a page down, hands behind the back, toying with a carried object, one hand propped on the desk.

   **Overall dress and plot detail constrain separately and hold at the same time.** Overall cut, material, tailoring and layering express identity and occasion; local wear, ink stains, plain ornament and specific hand poses express plot and habits of use. A locally whitened cuff does not mean the whole robe is coarse and old, a plain hairpin does not mean a maid's outfit, and a folded-hands pose does not mean servant status; a single local detail must not be expanded into a conclusion about the whole person's identity, and explicit plot detail must not be deleted to reinforce identity. When updating an existing character card, read the existing look material, keep these details and complete the overall design. Mark as a conflict only requirements that are genuinely mutually exclusive, and do not substitute a single detail or a class stereotype for judgement.

   **Write concrete fabric and state of use for clothing, not rendering quality.** Well maintained, crisp and flat, fine weave and neat seams are equally life detail. Mark inferred clothing design per rule 1; do not write an inference as source fact, and do not splice the everyday look and a temporary costume into one outfit.

   **At most one wear mark, and you must be able to say who caused it.** Wear, patches, fading, stains and ink marks are not default required fields — if the source, the occupation or the current situation cannot account for it, do not write it. One is detail; three is a different person: a whitened cuff + ink on the index finger + cloth boots piled together draws a copyist, no matter how many times you wrote "marquis's heir" earlier.

   **Run an identity–appearance semantic self-check before delivery.** Against the observations and `persona.identity/appearance`, check whether the three image texts have lost key identity clues or lowered clothing quality or changed age/occupation without support; if inconsistent, correct all three descriptions together. This judgement cannot be replaced by a word list like "nobles must wear finery" or "patches mean servant". The script's structural validation cannot prove this semantic consistency.

   `negativePrompt` **bans picture defects only, not style.** Do not write style words like `photorealistic` / `3d render` / `anime` — they clash head-on with whatever style is chosen at generation time. What should be banned is "fake" and "wrong": all characters with the same face, childish oversized eyes, over-smoothed skin, perfectly symmetrical faces, dead eyes without catchlights, helmet-like hair with no loose strands, stiff mannequin poses, extra fingers and mangled limbs.

6. **`image.sheet` is the character model sheet — one 16:9 landscape canvas, internally split into three zones.** This is the complete layout instruction for the image model, and the proportions must be hard-wired; it must not be left to improvise:

   ```
   ┌──────────┬────────────────────────────┐
   │          │   front   side    back      │
   │  bust    │                            │
   │ portrait ├────────────────────────────┤
   │          │  detail · detail · detail · detail │
   │   ~34%   │                            │
   └──────────┴────────────────────────────┘
              16:9
   ```

   | Zone | Content |
   | --- | --- |
   | **Left**, about 34% | **Bust portrait**: head and shoulders, front, centred, like an ID photo. The face is drawn fully and finely — this is the baseline for facial design. **Both shoulders complete**, bottom edge **cut flat and level** |
   | **Top right** | **Full-body turnaround**: front / side / back side by side, sharing one ground line |
   | **Bottom right** | **Detail strip**: small close-ups of 4–5 key details, spaced evenly in a row, clearly smaller than the full-body figures |

   Separate the three zones with **thin rules**. Pure white background over the whole image, even margins on all sides.

   **Write the lighting per zone** — this is the contradiction between a model sheet and photorealism:
   - **Left-column bust portrait**: soft directional key light from upper left, natural falloff, ambient occlusion under the chin / in the eye sockets / where collar meets neck — the face must have volume
   - **The two right-hand zones**: flat orthographic lighting, no directional key, no cast shadows — **cut-out and proportion measurement depend on it**

   Hard-wire it as `LIGHTING IN THE LEFT ZONE ONLY: ...` and `LIGHTING IN THE RIGHT ZONES: flat even orthographic lighting ...`. A uniform flat light across the whole image makes the whole thing look "illustrated", while a uniform directional light across the whole image makes cut-out impossible.

   **Proportion is where this layout breaks most easily.** The prompt must hard-wire it: all three full-body views the same height, consistent head-to-body ratio, correct limb lengths and head-to-body ratio, both feet on the same ground line, margin above the head and below the feet — and **never stretch or squash the figure to fit anything else in**.

   **If the detail will not fit**: if one row along the bottom will not hold them, extend downward along the right edge of the canvas into a column. **But it is always the detail that gives way, never the figures** — the prompt must say plainly `the detail studies give way, not the figures`.

   **Only one face may appear in the image.** The turnaround's face matches the left-column bust portrait — same features, same hairstyle, same expression. The left column is the baseline; the right side is drawn to match it.

   The prompt must state each of these explicitly: `ONE 16:9 landscape canvas`, `LEFT ZONE ... about 34% of the canvas width`, `RIGHT-TOP ZONE`, `RIGHT-BOTTOM ZONE`, `thin hairline rules`, `PROPORTIONS ARE CRITICAL`, `the detail studies give way, not the figures`.

7. `voice.prompt` is for the TTS voice-design engine: describe **the instrument itself**, not a performance of one line. Gender, perceived age, timbre, pitch range, resonance, breathiness, pace, rhythm, accent, energy, default emotion.

   **Voice design is a static vocal identity.** The engine wants "what this voice is like", not "how he says this sentence". Four kinds of thing make it worse when written in, and each was hit in production:

   | ✗ Do not write | Example | Why |
   | --- | --- | --- |
   | **Literary metaphor** | "weighs each word like silver on a scale", "a mouth you can hear smiling but can never trust" | The engine cannot map it to any acoustic parameter; it purely dilutes the signal |
   | **Performance direction** | "never raises his voice when threatening — quieter and slower instead" | That is a director's note to an actor. A voice does not change with the plot |
   | **Conditional branching** | "can switch to passable mandarin in the courtroom" | One voice has one accent. Writing "switches" only makes the output unstable |
   | **Quoted dialogue** | "murderous intent hidden inside pleasantries like 'rules are rules'" | Some engines treat the words inside quotes as text to be read aloud. **`validate` blocks this one** |

   Of the four, only quoted dialogue is gated — it is cleanly decidable. The other three rely on the discipline of whoever writes the card: **keyword scanning would false-positive on normal description** ("when speaking" and "low register" both contain trigger characters), and a gate that blocks wrongly is worse than no gate.

   **Write it as a compact parameter string, not prose. `validate` caps it at 400 characters.** A voice design engine wants parameter density; sprawling English prose dilutes it — in production, the same character was tested with 500 characters of prose against a 230-character parameter string, and **the latter was clearly better**. The 400 cap is measured: the four bundled sample characters run 218–245 characters, the version judged redundant prose ran 490–514, so there is plenty of headroom. It blocks "writing an essay", not "writing in detail".

   Fixed parameter order — copy this shape:

   ```
   〔age, gender〕, 〔timbre〕, 〔register〕, 〔resonance/support〕, 〔dynamic range〕.
   〔volume〕, 〔pace〕, 〔intonation habits〕. 〔accent〕. 〔default emotion〕.
   ```

   ```
   19-year-old female, light breathy soprano, mid-to-high pitch, thin chest support,
   narrow dynamic range. Quiet volume, slightly hesitant pace, rising inflection at
   phrase ends. Standard Mandarin, no regional accent. Tentative and watchful.
   ```

   **It describes this voice from start to finish, not one line of drama.**

   ### Which engine this prompt is for

   **Only engines that design a voice directly from text can use it**; for others it is useless:

   | Engine | Uses `voice.prompt`? |
   | --- | --- |
   | **Qwen3-TTS Voice Design** · ElevenLabs Voice Design · MiniMax speech | **Yes.** Feed the whole block in |
   | CosyVoice 2/3 instruct | **No voice.** Its instruct adds style control on top of zero-shot cloning; the timbre still comes from reference audio |
   | IndexTTS / IndexTTS2 | **No.** Timbre comes only from reference audio; IndexTTS2's text channel handles emotion only, so it can be fed the `voice.emotion` sentence |

   With a clone-family engine this prompt does not help — you pick reference audio using `referenceHint` and the six fields. **This is not a badly written prompt; it is that this class of engine has no such input.**

8. **Characters in the same batch must be distinguishable, and this is now gated.** You will be given the names of the other characters in the batch; do not make their looks and voices the same.

   **`validate` computes word-level similarity of `image.prompt` against `voice.prompt` pairwise, and fails outright above 75%, naming the pair.** The threshold is measured: the bundled sample's four characters peak at 39% pairwise, while the near-duplicate case that "only changes age and clothing colour" is 98% — plenty of headroom.

   **The commonest form is not copying but laziness**: short individual description, with the rest all photorealism boilerplate (pores, capillaries, subsurface scattering, iris fibres) and a fixed composition-and-lighting tail. Two characters of similar age and gender written that way come out as the same person. **Distinctiveness has to land in the individual description** — face shape, feature proportions, build, the concrete fabric and wear of the clothing, and that one detail unique to this person.

   `image.sheet` is deliberately not checked: the three-zone layout spec is a long fixed block, and real characters genuinely overlap 63%, so a gate would necessarily false-positive.

## Input format

```
Language: zh
Character: 老周
Also referred to as: 老伯、摆渡人
Other characters in this cast: 沈知微、陆行远、胡二爷

Observations gathered from the source text:
1. ...
2. ...

Verbatim quotes — the ONLY strings allowed in `persona.evidence`:
- ...
- ...
```
