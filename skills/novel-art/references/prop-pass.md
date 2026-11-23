# Prop design · how to fill it in

You are given everything the text/outline says about props. First **select**, then **fill in**. **Output JSON only — no explanation, no fences.** For the structure see the props section of `schema.md`.

## Select first: what qualifies as a narrative prop

It is selected only if **all three** conditions hold: **it gets a close-up, it recurs across episodes, and it carries the plot**. A show usually has 3–8, the same order of magnitude as the number of leads.

| Type | Disposition | Examples |
| --- | --- | --- |
| **Narrative prop** | Selected; gets its own asset | The suitcase (whole-show suspense), the old inkstone (the physical embodiment of the big reveal) |
| Set dressing | Already covered by scene anchors; not selected | Bronze bell, paper lantern, mooring stone post |
| One-off hand prop | Solved by shot-level prompts; not selected | A bowl of tea, a newspaper |

When unsure, ask: has the camera ever been shoved up against this thing? Will the audience remember it? Would the plot stall without it? If none of the three is true, do not select it.

## Hard rules

1. **A prop's form is written for this show's dynasty.** The document-level `dynasty` in `art.json` is already set — carry it over: vessel shape, material, craft, pattern and mounting all differ by dynasty, and a prop that drifts by a century exposes the scene that shares a frame with it. **Vague words like "ancient" are not allowed** (reason in rule 1 of `scene-pass.md`). If there is no `dynasty` yet, infer a specific one from the existing scenes.

2. **`summary` states dramatic function, not product description.** "The suspense core of who tips over whose face" is a dramatic function; "brown cowhide material" is just a material. Say what it does in the show first.

3. **Anchors must withstand a close-up.** A prop's anchors are smaller and finer than a scene's: a fresh scratch on the verdigris copper clasp, a crescent wear mark at the edge of the ink well. A close-up blows these up to full screen, so **a missing one is exposed at once, and too many cannot be checked** — still 3–5.

4. **Derive state variants backwards from the plot.** The suitcase has closed/open, the petition has hidden/spread out — a prop's state arc follows the plot, one English prompt per state, each generating its own reference. A prop with no state change gets one main state.

5. **Scale must be pinned down.** `scale` has three tiers (手持级 handheld / 桌面级 tabletop / 家具级 furniture), and `image.prompt` and `image.sheet` **must contain the matching English phrase** (handheld scale / tabletop scale / furniture scale) — AI drawing a handheld prop at furniture size is a frequent accident, and validate checks for it.

6. **White background, no people, no hands.** Prop reference images get pasted into all kinds of shots and must have a pure white background that can be cut out; **a hand holding the prop is the most common contamination**, and the negative prompt must ban hands/fingers. validate checks all three.

7. **Hook up the associations.** `relatedScenes` lists the scenes it mainly appears in (ids must exist), `carriedBy` says who carries it (free text). Both go into the report and serve as an index when scheduling generation tasks, to look up "what should be on the table in this scene".

8. **Prompts are always English and never contain character names** — image models will paint in any name they know. The surface-treatment sentence uses the same two tiers as scenes: copy one of the two passages under "what to carry over in full is the surface treatment" in `scene-pass.md` verbatim — choose by this item's level of upkeep; an imperially bestowed seal and a boatman's bamboo pole are not the same tier; art style is likewise never written into the prompt.

## Input format

```
Candidate prop leads (excerpted from text/outline):
- 沈知微 is always hugging an old leather suitcase, knuckles white (episodes 1–6; opening it is the closing reveal)
- Something hard in 陆行远's pocket; in episode 3 he pulls out an old inkstone with the county yamen's seal carved on the bottom
- 胡二爷's two crates of goods (carried on a shoulder pole, no close-up)
Existing scenes: S01 ferry cabin, S02 ferry pier, S03 reed flat on the far bank
```

The third item above should be dropped — it appears but has no close-up and carries no plot turn.
