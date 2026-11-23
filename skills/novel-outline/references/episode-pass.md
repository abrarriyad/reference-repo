# Episode synopses · written in batches

This step comes only after the skeleton is signed off. You are given: the four skeleton blocks as signed off + the episode range you are responsible for (e.g. episodes 11–20) + the beats that fall in this range. Produce the `episodes` entries for those episodes. **Output a JSON array only — no explanation, no fences.**

## Three columns per episode; missing one means it is not finished

| Column | What to write |
| --- | --- |
| `synopsis` | What happens in this episode. **Narrative voice** — quoted dialogue with `「」“”` means you are writing a script, and validate will block it |
| `hook` | [Hook] the question that makes people click the next episode |
| `suspense` | [Suspense] the buried thread left unresolved |

## Hard rules

- For every beat that lands in your range (`beats[].episode`), the synopsis of that episode must actually play out the setup/payoff — if the beat table says episode 13 has a face-slap, episode 13's synopsis must contain the face-slap
- `sceneIds` / `characterIds` may only use ids registered in the skeleton
- When three or more people share a frame, write `crowdPlan` (the breakdown plan: how the camera splits them, who is handled with back views and over-the-shoulder shots). Validation judges by the number of `characterIds`, which is a proxy — for a transition episode where the three are not actually in frame together, write the fact as the plan ("three people in two separate scenes, never in frame together, shot scene by scene"); do not leave it empty
- When the synopsis contains rain, hugging, crowds or hand close-ups — generation difficulties — put them in `warnings` (enum: 雨戏 rain scene / 肢体接触 physical contact / 人群 crowd / 手部特写 hand close-up). Better to over-report
- Write only the range you are responsible for; do not overstep to fill in other people's episodes — they are sorted by ep and spliced together on merge

## Batch size

At most 10 episodes per batch. Writing 60 episodes in one go will always collapse in the back half — the pacing sags, hooks repeat, characters drift. Batches are aligned with each other through the skeleton and the beat table, not through the previous batch's text.
