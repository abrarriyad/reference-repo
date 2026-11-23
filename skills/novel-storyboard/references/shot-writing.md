# Shot body · writing spec (protocol-agnostic)

Each cut's body says **what happens in these seconds**. It has nothing to do with the video service: the same body, sent to MiniMax H3, gets wrapped in `h3-prompt.md` syntax; sent to Seedance, it gets wrapped in `seedance-prompt.md` syntax. **Protocol syntax lives in those two documents; this one handles content only.** Both protocol specs take this document as their premise and no longer restate it.

## One primary camera move per cut

Pick one from the camera vocabulary in `schema.md`, write it into this cut's own body as a natural action sentence ("the camera slowly pushes in on the knuckles pressed white"), and you may add amplitude (small/large) and speed (slow/fast). **One camera move per cut, never stacked** — push in then pan, or track while orbiting, and the model will only do one of them, and not necessarily the one you wanted.

## Actions must be completable within these seconds

However many seconds this cut has, the action can only be what fits in those seconds. **Follow novel-script's common-action principle**: actions the model has seen millions of times, such as hoisting a carrying pole onto a boat, lending a hand to unload it, or looking up toward the bank; do not write precise physical interactions, micro-expressions or fine finger movements — they will not be drawn correctly, and they only crowd out the one beat that really needs acting.

**How to write actions** (learned from the Seedance official guide; equally valid for H3):

- **Limb specificity + quantified degree**: down to hands, legs, head, shoulders and back, with amplitude and speed — "slowly raises a hand", "snaps the head around", "drives the foot into the ground", "lowers the head slightly"
- **Prefer slow, continuous small actions**: walking slowly, raising a hand gently, sitting down smoothly; avoid high-burst actions like sprinting, big jumps or violent tumbling
- **Write the hand-off between actions**: "using the momentum of turning, raises a hand in the same motion", "naturally transitions from a pause to raising a hand", so the action stays continuous
- **Externalise emotion into body detail**, do not write "very sad" or "furious": sadness is a lowered head, shoulders trembling slightly, fingers gripping a hem; nervousness is checking a watch repeatedly, fingers drumming the desk, eyes darting; anger is fists clenched, jaw tight, chest heaving

## Where the character is now must match the frame

A character's **position state** in the body (already aboard / still on the bank / inside the cabin) must match this cut's frame. When image and text disagree the model follows the image, and the action goes wrong. The frame pins the instant this cut begins; the body writes forward from that instant.

## Dialogue is kept verbatim; identity is written outside the dialogue

Claimed dialogue **may not have a single punctuation mark changed** and goes into the body verbatim. The speaker's identity, age range, timbre, tone and whether it is a voice-over go **outside** the dialogue, not inside it. How the dialogue is marked (`<d>` tags or Chinese quotation marks) is decided by the protocol spec; this document only handles "the original must not change".

## Do not write character names; use generic identities

In the body write "a middle-aged man in an iron-grey robe looks up toward the doorway", not "张三 looks up toward the doorway".

**This is the video services' own requirement, not our preference**: both the MiniMax H3 and Seedance official prompt guides require
generic identities for characters. Names may appear only inside the dialogue text (how it is wrapped is decided by the protocol spec), dialogue is kept verbatim,
and the forms of address inside it are the script's business.

Note the contrast with the **frame prompt**: that side is exactly the opposite, and must name characters directly — the frame is generated together with the character sheets,
and the name there points at the attached reference sheet. The rules on the two sides differ because the two specs were not written by the same people.

## Composition must be quantified, not just a shot size

The frame has been quietly doing one job for the body: saying **how close, how full, who is where, where the eyes look**. With reference-only generation there is no such image,
so this information must either be written down or simply vanish — and in testing it is exactly this that vanishes: the shot size drifts wide, the action drifts small, and the blocking becomes arbitrary.

So every shot, besides the body, must also fill in these fields (`schema.md`):

- **Focal length + depth of field** (`lens`): `50mm standard, medium-shallow depth of field`, `85mm telephoto, very shallow depth of field`. Focal length decides "how close", depth of field decides "whether the background is blurred"
- **Camera position** (`cameraPosition`): facing whom + at what angle. `李四 + eye-level front`, `two-shot + 30° high angle`
- **Composition** (`composition`): rule of thirds / centred / diagonal / symmetrical — one per shot
- **Eyeline** (`eyeline`): the other's face / the object in hand / eyes closed. Eyeline is half of the performance
- **Focus** (`focus`): what is locked. Often different from the eyeline: the eyes look at the other person, the focus is on the knife in hand
- **Stability** (`stability`): stable / slight shake / handheld. It is a separate matter from the camera move — a locked-off camera can still shake slightly

At segment level add one more, **character relationship and composition logic** (`blocking`): at the opening instant, who is on the left of frame, who is on the right, which way they face,
how far apart they are (in centimetres or paces). It is the whole segment's spatial foundation, and every shot starts from it; write it once only.

The body (`frame` / shot body) writes the action and state of the moment as before, and **no longer relies on adjectives to carry composition** —
leave words like "medium shot" and "close-up" to `size`, and leave "how close" to `lens`.

## Reference images lock identity, not composition

Reference images of characters, scenes and props are for locking **identity, face shape, clothing, scene structure, prop shape**. Do not copy the reference image's composition, layout or viewpoint into the body — this cut's composition is decided by this cut's frame and body. How to reference images in the body (`<Picture k>` or `@图片N`, or added by the program) is decided by the protocol spec.

## Sound splits into three layers, each in its place

- **Dialogue, singing, in-world music** (audible to the characters) → write into the shot body
- **Ambient sound, action sound, non-verbal vocal sound** (panting, footsteps, a bronze bell) → the soundscape field, without restating dialogue
- **Score** (inaudible to the characters, audible only to the audience) → the music field, writing instrumentation and tempo; if there is none, write "none" per the protocol spec

**Soundscape is also an action instruction**: when the picture's action changes, the soundscape must change with it. Write "the bronze bell clangs on impact" in the soundscape and the video really will act out the impact.

## What not to write

- **Do not add** characters, props, actions, dialogue or visible on-screen text that the script does not have. A storyboard is asset composition, not drawing from nothing.
- **Do not write visual style**. "Cinematic", "cold grey-green grade" and "semi-realistic" are the rendering layer's business, appended uniformly by the caller at image/video generation time; written into the body they only fight whatever style was chosen.
- **Do not write era words outside the dynasty**. "Ancient" and "period costume" are not pictures; the dress system, objects and architectural forms are, and those are already settled in the sheets.
