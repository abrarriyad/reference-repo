# One-time input: how to split a description into fields

The user describes a character in one passage; you split it into the fields of `intake-template`, fill in what is missing yourself, then `intake-check` produces a confirmation table to show the user.
**Do not ask item by item.** Ask only when age, gender or era cannot be inferred — if any of those three is wrong, the whole set of images is wrong.

## Language

`lang` is the language of the confirmation table and report, filled in as the language the user speaks: `zh` / `en` / `ja` are built in. For other languages (French, Korean…):

```bash
node scripts/character-refs.mjs ui-template fr
```

Translate the printed English copy item by item (keeping the placeholders `{n}` `{x}` as they are), and put the whole block into the intake's `ui` field. If any item is missing, `intake-check` reports an error.

Each field has two pieces of text: `en` goes into the image-generation prompt and is **written in English whatever `lang` is** (image models take English most reliably); `text` is for people to read, written in the `lang` language.
The `zh` written by old inputs is still recognized.

## Fields

| Field | Goes into which images | What to write |
| --- | --- | --- |
| `identity` | All | Age (integer), gender (female / male), ethnicity, era, status. `en` is written as one complete sentence introducing the person |
| `face` | All | Face shape, eyes, brows, nose, mouth, skin tone, distinctive facial features |
| `hair` | All | Hair colour, length, style, hair ornaments |
| `build` | Full-body views | Build and posture. May be omitted |
| `skin` | All | Skin condition. May be omitted; if omitted, a default is given by age |
| `outfit.top` | All (the headshot uses only this item of clothing) | The top, including the state of the collar and sleeves |
| `outfit.bottom` | Full-body views | The bottoms, with shoes and socks |
| `outfit.details` | Tier three | Four slots `hair` / `neck` / `sleeve` / `feet`, each describing only that body part itself |
| `backCue` | Back | Only what can be seen from the back. May be omitted; if omitted, it is assembled from hairstyle and clothing |

Clothing is split into top and bottom because **the headshot can carry only the top**: if trousers and shoes are written in the prompt, the edit model pulls the shot back to draw them.

## Source markers

Each field carries a `source`:

- `stated` — it is in the user's own words
- `inferred` — you inferred it from the status and era (a 1920s tea-picking girl → black cloth trousers, straw sandals)
- `default` — a conventional default (skin, back)

**Mark honestly.** The confirmation table flags the inferred and default items, and the user needs to look only at those. Marking an inference as the user's own words amounts to making the decision for the user without saying so.

## How to write the English

- Write things that can be drawn: "wary eyes" works, "a girl who has been through a lot" does not
- **No character names, no art-style words** (anime, photorealistic, cinematic…) — the style layer adds them uniformly, and writing them into the character makes them fight it
- Write small features as real conditions: for a scar write "an old healed scar: thin, flat, slightly paler, barely raised", otherwise it gets drawn as a pink fresh wound
- How far to take the skin is a character attribute, not an art style: writing a uniform "flushed, blemished" makes a nineteen-year-old girl come out looking ill
- If ethnicity cannot be inferred, default to East Asian, and land it in specific facial features

## Detail images

**The content of the details is understood by the model according to the character, not a fixed four things.** The order of picking:

1. **Those the user names first** (`source: stated`) — "the details I want are the jade pendant at the waist and the silver ring on the left hand"
2. If none are named, pick **the places that make this character most recognizable**: accessories, things hanging at the waist, special shoes, a distinctive patch on the clothing
3. If there really is nothing special, fall back on the four default slots below

At most 8. **What is in a detail must already be written in the appearance or clothing** — details decide only which close-ups to shoot, and do not add new things to the character;
to add a new accessory, first change the clothing field (which makes the whole set stale, because the person has changed). Adding, deleting or changing a detail itself affects only that one detail image.

### Default slots

Four, all tested to come out stably:

| Slot | What to write | Example |
| --- | --- | --- |
| `hair` | One spot of hair ornament, braid end or hair bun | the knot of her faded blue cotton headscarf at the nape |
| `neck` | The collar and the topmost **one** button | the small standing collar and the single cloth-knot button at her throat |
| `sleeve` | One cuff | the indigo cotton sleeve rolled up above the wrist, with tea stains on the edge |
| `feet` | Shoes and ankles | woven straw sandals and the trouser hems tied at the ankles |

Write only the body part itself, **with no framing words like "close-up"**; the framing is added by the script.

**Keep the part small enough to be seen whole at a glance.** Write "the diagonal placket and a row of cloth buttons" — the diagonal placket opens from the collar all the way to the armpit — and the model frames the whole chest (found in testing); write "the small standing collar and the single cloth-knot button below the throat" and it is right. For the collar write only the collar plus the topmost button, and for the cuff only one sleeve.

### Custom details

Beyond the default slots use `slot: "custom"`, with an extra `id` (lowercase English) and `part`. The English likewise **writes only the body part itself**, with the framing added by the script per `part`.
Custom details are marked "untested" in the confirmation table and report, and you must look at the image after generating.

| part | Framing | Tested (Qwen, 2 seeds) |
| --- | --- | --- |
| `hands` | Only one hand, the hand filling the frame | Green-stained fingertips: 2/2 |
| `waist` | Only the waist, no face and no legs | A short jacket's hem pressing the trouser waist: 2/2 (coarse cloth has a velvet-like sheen) |
| `body` | Only this one spot, no face and no full body | A fountain pen on the chest: 2/2 (framing too wide, reaching the chin) |
| `hair` / `neck` / `feet` | Same as the default slot of the same name | — |

**Facial features (glasses, scars, moles) do not get detail images**; write them into the `face` field: the front headshot already shows them clearly;
in Qwen testing, three phrasings × 2 seeds all came out as a whole headshot (validation blocks `part: face`). When the user explicitly asks for a facial close-up, explain it this way.

Other things found unstable in testing: large-area buttons such as double-breasted ones (framing too far out).

Old inputs with a custom detail written as a whole sentence starting with `Zoom in to ` are still recognized and used as they are.

## Details take only what grows on the character

Hair ornaments, collar, cuff, shoes, accessories. **Props are not accepted** — suitcases, letters and knives belong to novel-art; character images should be "empty-handed", since a hand holding something contaminates the reference image.
