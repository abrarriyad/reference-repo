# Prompts: which phrasings were found by testing

Prompts are assembled per view by `buildPrompt` (`scripts/core.mjs`), and **the model does not write prompts, it only fills in the character fields**.
Read this before changing the templates — every item here was bought by some round of failed testing.

Test environment: Qwen Image 2.1 (ComfyUI, `TextEncodeQwenImageEditPlus` with attached reference images) and codex built-in image generation (GPT),
with characters covering a 19-year-old Republic-era schoolgirl, a 70-year-old old boatman, a 28-year-old soldier and a 16-year-old tea-picking girl, with multiple seeds.

## Overall structure

| View | First sentence | Reference image | Ratio |
| --- | --- | --- | --- |
| Front full-body (anchor) | Full-body front view: she stands naturally facing the camera… | None, text-to-image | 2:3 |
| Front headshot | Zoom in to an extreme close-up head-and-shoulders portrait, passport-photo framing… | Anchor | 4:5 |
| 90° profile | Full-body side profile… both face the right edge of the image | Anchor | 2:3 |
| Back | Rotate the camera 180 degrees around her… | Anchor | 2:3 |
| Detail | Zoom in to an extreme close-up of only … | Anchor (hair / face / collar also attach the headshot) | 1:1 |
| 45° headshot | Same as the front headshot, plus a geometric description of 45° | Anchor | 4:5 |

The anchor writes all the character fields as a complete description; derived images write only "what change to make" + one short consistency list + the art-style layer.

## The edit model listens only to the first sentence

The reference image's compositional pull is very strong, and by default the model redraws something close to the reference. **Only when the first sentence explicitly asks for a change of composition does it change.**

- Headshot: the first sentence must be `Zoom in to an extreme close-up head-and-shoulders portrait, passport-photo framing`,
  then write quantifiable framing: the top of the head close to the upper edge, the chin at the exact middle of the frame height, the lower edge cutting at the collarbone. Writing only close-up comes out as a half-body
- **The front also has to be written as geometry**: the anchor says "shoulders, hips and feet all squarely facing the camera, the nose on the midline of the face, both ears equally visible", and the negative words ban three-quarter view / turned body / contrapposto.
  With only "facing the camera" written, the anime art style draws the anchor slightly turned, in the habit of an "official character image", and the headshot edited from the anchor turns 20–30° too, almost the same as the 45° one (found in testing).
  The front headshot is likewise written as geometry with profile banned; **put the framing before the geometry, and restate the framing again at the end** — long geometry dilutes the "zoom in" at the start, and the camera backs off to a half-body (found in testing)
- Back: `Rotate the camera 180 degrees around her`, then write **only what can be seen from the back** (the braid hanging down the back, the back of the clothes, the heels),
  with the negative words banning face / buttons / pockets. Without these, Qwen comes out as the front
- Profile: write that the whole body and head both face the right side of the frame, only the right half of the face is visible, and she does not look at the camera. Without "does not look at the camera" she looks back
- 45°: use geometric cues — the nose tip pointing to the left of the frame, the left ear visible, the right ear hidden. On Qwen it falls short (about 30°), and GPT is more accurate
- Detail: the first sentence `Zoom in to an extreme close-up of only <part>`, then write the frame boundaries (filling the frame, no face visible / only the feet and ankles visible)

## Keep the consistency list short, taking layers by view

- **Do not repeat the anchor's long description whole in the derived images.** One sentence, "Keep her exactly the same person as in the reference image: face, hairstyle, top, bottoms", is enough
- **The headshot writes only face, hair and top.** If bottoms and shoes are written, the model pulls the shot back to draw them (found in testing: with all the clothing and the four details included, the headshot came out as a half-body)
- **Detail images do not list the whole outfit**, only one sentence, `Same person, same clothing and materials as in the reference image`.
  The first round of detail images failed 8/8 because the consistency passage listed the whole outfit, and the model drew the whole person
- The negative words of detail images ban face / head / portrait / full body / standing figure / wide shot / medium shot;
  for details next to the face (hair, things on the face), ban only full body / whole face

## Realistic (art-style layer "option four")

The baseline settled by the user (2026-09-26). The whole passage is in `DEFAULT_LOOK`, printed by `look-template`:

- Do not write photorealistic, ultra-HD or shallow depth of field — the former drifts toward CG rendering. Write directly `A real photograph, not a render` + full frame, 85mm, f/5.6, true white balance, no retouching or beautifying, slight grain
- Light is written as a directional key light + a weak fill (giving the face and clothes volume), with the background still a seamless backdrop paper blown out to pure white
- The negative words suppress the AI look: CGI, plastic skin, waxy skin, baby face, over-symmetry, HDR, oversaturation, flat light
- **How rough the skin is does not belong to the art-style layer**, it belongs to the character's `skin`: writing a uniform "flushed, minor blemishes" makes young characters come out looking ill
- **Write the effect of the light, not the light source**: writing window draws the window into the frame

## Anime (art-style layer `anime`)

The **default art style** (settled by the user on 2026-09-26). For realistic use `--look 写实`.

On 2026-09-26, Aho (阿禾) was run through all four tiers on Qwen (9 images), all passing the gates, and viewing the images the angles, framing and clothing consistency were all right:

- Written as "an official character image from a Japanese TV anime": clean, even-weight linework, cel colouring with one layer of soft shadow and a few hard highlights, flat fills, anime-style eyes, simplified nose and mouth
- **Do not write model sheet / turnaround / character sheet** — these words make the model draw several views in one image; the negative words also specifically suppress character sheet and multiple views
- The negative words suppress realism: photograph, photorealistic, pores, film grain, 3D render, semi-realistic
- `medium: drawn`: **the character's skin layer is not written in the prompt** (pores and freckles drag the image toward realism), and hair detail does not write macro photo
- The problem in the realistic version of Qwen drawing coarse collar cloth like velvet did not appear in the anime version
- The 45° headshot likewise does not turn enough (about 20–30°), the same as the realistic version, a Qwen issue

The art-style layer governs only "how to draw"; "who to draw" is entirely in the character layer. With the same Aho input, switching the preset gives two ways of drawing, without changing any character field.

## Skin exposed in detail images

When Qwen draws collars, cuffs and ankles, the exposed skin tends to be drawn old (with no face as a reference, the sense of age is lost).
The three kinds of details — collar, cuff, shoes — have the sentence `Any visible skin is the skin of a 16-year-old.` added (the age taken from the character field).
On the 16-year-old sample, the skin at the cuff and ankle came out right.

## Custom details (2026-09-26, Qwen)

Custom details take their framing by `part`, the same routine as the default slots (the first sentence writes only this body part and states the frame boundaries clearly):

- Hand (green-stained fingertips) 2/2, waist (a short jacket's hem pressing the trouser waist) 2/2, body (a fountain pen on the chest) 2/2 all came out right; the pen's framing is wide and reaches the chin
- **Facial parts (glasses) failed entirely**: three phrasings (plain, writing it hard that "the hairline, chin and ears are all out of frame", and attaching only the anchor and not the headshot) × 2 seeds all drew a whole headshot.
  Facial features are already clearly visible in the front headshot, so `part: face` is not opened up

## Known weak spots

- Small scars: writing "an old healed scar: thin, flat, slightly paler, barely raised" improves it, but it still occasionally looks like a freshly stitched wound
- Large-area details such as double-breasted buttons: both seeds framed too far out
- Writing the detail part too large ("the diagonal placket and a row of buttons") frames the whole chest — write it small ("the small standing collar and a button below the throat")
- Qwen's collar details draw coarse cloth with fold highlights, like velvet (it has happened with two characters); GPT renders the same material correctly, so if the collar is unsatisfactory, regenerate that one with `--model codex`
- Mixing Qwen and GPT within one set of derived images: it connects up, with a slight brightness difference between detail images

## How to attach reference images

- **An image references only the anchor**, with hair / face / collar details also adding the confirmed headshot. Images are not chained to one another — chaining accumulates drift and would make a single regeneration drag a string of others along
- When the headshot is missing or stale, these images fall back to attaching only the anchor, without blocking, with a note left in the record
- A pre-assembled multi-view sheet is not used as a reference: for a single person Qwen can tell it is the same person, but it pulls the framing toward full-body and the face comes out small; attaching them separately is the closest likeness
- **Multi-person frames can use even less of a stitched image** (2026-09-26, Qwen's old encoding node, two people in two shots, 2 seeds each): with a stitched "headshot + turnaround" image per person,
  3 of 4 images drew 3–4 people (each view in the stitched image was treated as a person), and the female lead was swallowed by the male lead. Attaching only the anchor per person also cross-contaminates: one person's face and clothes bled onto another.
  Only the group "female lead's headshot + anchor, male lead's anchor" was 4/4 all correct. Stitched reference images were therefore not built into the skill
