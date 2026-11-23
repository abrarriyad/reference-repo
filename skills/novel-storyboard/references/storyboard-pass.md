# Cutting: how to segment an episode and how to cut it

One task cuts one episode. You are given the seedScenes worksheet (each scene's beat list: number, action/dialogue, seconds per beat, speaker), the scene cards and the character cards. Deliverable: cut this episode's `segments` from empty to full, then delete `seedScenes`.

## Segment first, then cut

1. **A segment = one generation call**, ≤ 15s, never crossing scenes. First group each scene's beats by story unit (one exchange, one entrance, one wrap-up); each group of 9–15s is one segment.
2. **Cut shots inside the segment**, each cut 2–5s (hard gate), aiming around 3s. A segment is usually 3–5 cuts.
3. **One frame per cut**: the first cut is the master frame (pinned at 0.00s), the rest are sub-frames pinned at their own cut marks. At generation time the full set is fed to H3, so every frame's composition inside the segment is controlled by the image, not gambled on text.

## Hard rules

1. **Claiming is the foundation.** Every shot declares `beats:[from,to]`, a contiguous interval across the whole scene, no overlap and no gap. After cutting, run through it mentally: is every scene's beat 1 through the last beat claimed?
2. **Seconds are an order, not an estimate.** The cut seconds directly determine the cut times and the alignment instruction — changing seconds requires changing `h3Prompt` in step, validate audits verbatim, and changing one side is always blocked.
3. **Dialogue must fit.** The dialogue seconds of the claimed beats ≤ the shot seconds. A 4.4s line gets a 5s cut.
4. **The shot-size phrase goes into the frame prompt; the camera-move term goes into this cut's own shot body.** One camera move per cut, written as a natural action sentence. **Which language the camera-move term uses follows this storyboard's `promptLang`**: English mode uses the official English terms (Push In / Pan Left / Tracking Shot …, `a slow push in toward…`), Chinese mode uses the Chinese terms from `schema.md`'s vocabulary (推 / 摇 / 跟拍 …, "the camera slowly pushes in on the knuckles pressed white"). The gate audits per cut according to `promptLang`, and the wrong language is blocked on the spot — do not treat one protocol's language as the default for all storyboards.
5. **The frame prompt names characters directly; the video body always uses generic identities.** The two halves have opposite rules, because the people who set them are not the same:
   - **The frame prompt (`frame`) writes names** (张三, 王五). It is the only one generated together with the sheets — the scene sheet, character sheets and prop sheets are all attached to the prompt and listed by name, so a name there is **an address pointing at a particular reference sheet**, not an omitted description of appearance. With two young men in frame, a generic identity cannot say which face goes with which action.
   - **The video body (the shot lines of `h3Prompt`, Seedance's `shot`) writes no names** and uses generic identities (an old ferryman, a middle-aged man in an iron-grey robe). **This is a hard requirement of the MiniMax H3 and Seedance official prompt guides**, not something we can relax. Names may appear only inside the dialogue text.
   The prompts for character sheets, scene sheets and prop sheets likewise ban names — those are **grown from text**, have no reference sheet to point at, and a name there would be a hole where appearance should have been written.
6. **Composition goes into quantified fields; segments have blocking.** Per shot fill `lens` / `cameraPosition` / `composition` / `eyeline` / `focus` / `stability`; per segment fill `blocking` (at the opening, who is left, who is right, facing, spacing). For how to write them see `shot-writing.md`, "Composition must be quantified". This is the information that substitutes for the frame: without frames they are the entire source of composition, and with frames they make the image and the body describe the same shot.

## Directorial camera feel (not gated, but it decides whether it looks like a professional storyboard)

- **A cut every 3 seconds is the breathing of short drama.** That is the granularity of a vertical-video audience's attention — cut faster and the information breaks, cut slower and they leave. The rhythm strip should alternate light and dark, long and short.
- **Cut dialogue shot–reverse-shot.** Give the asker a close-up, cut to the answerer's close-up, jump back and forth; whoever's line carries more information gets the closer face. Resolve it inside one segment, one generation.
- **The three-shot entrance: the first cut gives the moving subject.** Every episode's first cut must have subject motion (tracking a run through the fog, or a person moving inside a locked-off frame) — opening on a still-life close-up is a dead frame; save it for the second beat. Then establish the new space: moving subject → extreme wide establishing shot → key-detail close-up. The audience knows within three seconds who is moving, where, and what they are looking at.
- **Key actions become their own cut.** A moment like "she slams a hand on the chest lid" deserves its own 2-second insert close-up — it is the rhythmic accent.
- **Reaction shots are free drama.** After a heavy line, cut to the listener's face for 2–3s without writing a word. VO over an empty shot or a close-up naturally saves on lip sync.
- **Cut on motion.** The momentum at the end of the previous cut (a hand reaching for the chest) takes up the momentum at the start of the next (the hand pinned down); the continuity within a segment is left to H3, so choose the cut point mid-action rather than after it completes.
- **The last cut of a segment leaves a hook.** Each segment's final shot is either a concrete image of suspense (a pocket, a brass button, a lamp) or the lead-in to the next segment — the joins between segments are edit points too.
- **Camera restraint.** A locked-off shot is the default; push in for emotion, pull out to close, track for movement. More than two camera moves in one segment should make you ask whether you are showing off.

## Reference-image discipline (half of frame quality lives here)

Frame generation = prompt + reference images. While cutting, decide which references each frame will carry:

- The scene sheet (this segment's scene + lighting state) — always
- A sheet for each character in frame — one per character present
- A sheet for each narrative prop in frame — attach when available

When the prompt and the reference image conflict, the model follows the reference — so the prompt concentrates on composition, **the current position state** (already aboard / inside the cabin / on the bridgehead) and pose, leaving looks and material to the reference. Large assets appearing in the picture (boats, carts, gatehouses) must carry their own sheets too, or each frame will look different.

## Common diseases

| Disease | Symptom | Cure |
| --- | --- | --- |
| Stage-play disease | One cut held for the whole segment | Cut dialogue shot–reverse-shot; give actions insert close-ups |
| Evenness disease | Every cut is a 3-second medium shot | Alternating light and dark, long and short is what makes rhythm |
| Second drift | Changed the cut seconds and forgot the prompt | validate blocks it: the alignment instruction and cut times are audited verbatim |
| Dialogue overflow | A 4.4s line crammed into a 3s cut | Add seconds or split the cut |
| Soundscape left behind | The picture changed to handing off a load, but the ambient sound still says a bell clanging | **Soundscape is also an action instruction** — when the script action changes, the description, the soundscape and the Chinese comparison change together (hit in production: the video really did act out the impact) |
| Close-up amnesia | The prop in an extreme close-up looks different from its sheet | Attach the prop sheet as a reference, and mention the anchor feature in the prompt |
| Location change without a new segment | One segment cuts from the bridge into the cabin | A location change always starts a new segment — one environment anchor per segment |
| Changed one cut without reading its neighbours | Cut 1 changed to running along the bank path, cut 2 still says the bridge only just came into view, but the image is drawn on the bridge | When changing one cut, read the ones before and after, and compare image and text frame by frame — position is a continuous state |
