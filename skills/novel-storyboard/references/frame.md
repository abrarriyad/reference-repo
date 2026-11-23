# Frame prompt and reference-image contract

This skill **does not generate images**; the deliverable is the picture prompt for each frame and which reference images it should carry. Generation is downstream;
the model and style are chosen downstream, and the aspect ratio must follow the top-level `aspectRatio` of storyboard.json.

The two sections below are the contract for downstream: "what references to attach" decides whether this frame lines up with the upstream assets.
Miss even one and the model will invent it on the spot (hit in production).

## What a frame is

One keyframe per cut, with the aspect ratio taken from the top-level `aspectRatio` of storyboard.json: `16:9` by default, `9:16` for a vertical drama. All frames in the same storyboard must keep the same aspect ratio. **One folder per segment**: `<segment id>/f<cut index>.png` (f1 = the master frame), and `export` writes the H3 prompt as `prompt.md` in the same folder (its header table states plainly that f1.png is the first frame and which second each image pins) — drag the whole folder to H3 and that is one generation. The first cut is the **master frame** (the H3 alignment instruction pins it at 0.00s), and the rest are **sub-frames** (each pinned at its own cut mark) — every frame's composition in a segment is controlled by the images, not gambled on text. **It is asset composition, not drawing from nothing**: what the scene, characters and props look like has already been settled by the upstream sheets, and the frame is only responsible for arranging them into the same image per this frame's composition.

## Attaching reference images (the lifeline)

The list of reference images each frame should carry at generation time — this list is one of this skill's deliverables, and the report's "generation batch list" is exactly it:

1. **Scene sheet** (`novel-art`'s `images/<scene name>-sheet.png`) — always; the sole standard for environment, material and light
2. **A sheet for each character in frame** (`novel-characters`' `images/<character name>-sheet.png`) — one per character present
3. **A sheet for each narrative prop in frame** (`novel-art`'s `images/<prop name>-sheet.png`) — attach when available
4. **Chained reference**: when a character has no sheet, first generate the frame where they are seen most clearly, then use that image as the identity reference for every later frame containing them (the prompt states plainly the SAME face, same clothes as this reference) — a face must not change person within an episode. The segment's master frame is also worth keeping attached, to lock the world and the thickness of the fog
5. **Attach references by "what is in the picture", not by "which scene the segment belongs to"**: the segment may be on the bridge, but if a ferry appears in frame its sheet must be attached too — no attachment = a new boat invented every frame (hit in production). The same applies to any "large asset that gets into frame" such as boats, carriages or gatehouses
6. **The prompt must state each character's current position state**: already aboard / inside the cabin / standing on the bridgehead — across cuts a character's position is a continuous story state, and writing only composition without state will make the model draw a character who has boarded back onto the bank (hit in production)

The prompt should state at the start what each reference image is for (which is the environment / whose face to match / which prop to match); do not make the model guess.

## A fixed sentence at the end of the prompt

`No text, no watermark, no borders — a single clean full-bleed frame.`

A frame is a clean single image, not a model sheet — no grid borders. Leave this out and the model will draw after the upstream model boards,
with their dividing rules.

## At downstream generation time (written for the consumer)

- **One call per shot, never batched**
- **Generate the whole first segment first by default** (master + sub-frames, 3–5 images) to show the user the result — once the style, asset consistency
  and shot–reverse-shot composition are right, fill in the rest. An episode of about 30–40 frames is the same number of calls, and a wrong direction means redoing the whole batch
- Skip a single failure without blocking; summarise at the end

## Glance over the image when you get it (acceptance criteria)

- Is it the same world as the scene sheet (material, light, degree of weathering)
- Do the character's face and clothing match the character sheet
- Is the shot size right (the prompt says close-up but a wide comes out → regenerate)
- Are there extra people (background onlookers are the commonest contamination) — with extra people, regenerate
