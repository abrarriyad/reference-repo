# Skeleton · cut lines / merge people / arrange beats

Take all the volume summaries (or the short piece's source text) + the user's parameters, and produce the **four skeleton blocks** of outline.json: `adaptation` / `characters` / `scenes` / `beats`. Episode synopses are **not written in this step** — writing episodes before the skeleton is signed off wastes everything if the direction is wrong.

## The order is the method

1. **Cut lines.** A short drama holds only one main line + at most one secondary line. Write what is cut into `adaptation.cut`, each with a why. When `adaptMode` is not faithful, cutting nothing is blocked by validate.
2. **Merge people.** Merge functionally duplicate characters into one face (two messengers → one), recording the change in `characters[].from` ← the change log. Then **tier** them (`tier`): lead group `lead` 1–5 people, named important supporting `support` ≤ 10, functional roles `functional` ≤ 10. A functional role takes up a face but not a name — `name` uses a label ("emergency doctor"), and there is no need to write a character arc. Nameless background people do not go in the table.
3. **Reduce the scenes.** The main-scene cap scales with episode count (4 + ⌈episodes/10⌉, clamped to 5–15: 6 episodes get 5, 60 episodes get 10); go by the number `validate` reports. This is the relaxed AI-short-drama version — scenes are generated, so opening a few more scenes to buy visual interest is worth it; do not cram all the drama into one room. A scene that appears only once in the original should either be cut or given a `reusePlan` (which existing environment asset to reuse, and what time of day/weather to change to make it).
4. **Arrange the beats.** First decide in which episodes the major (big-reveal) beats fall, then fill the gaps with minor ones. Hard rules: adjacent gap ≤ 3 episodes, no vacuum at the start or end, the earliest major cannot be in the last episode. `type` follows genre — a female-audience face-slap and a male-audience warrior's rise are not the same kind of beat; see `params.genre`.
5. **Reduce the props.** **Placing this after the beats is not arbitrary** — the criterion for a narrative prop is "which beat does it hold up", and until the beats are set you cannot tell which object is a prop and which is mere dressing. Cap of 8, the same order of magnitude as the number of leads. Write each one's `function` (what it carries in the drama) and `beatIds` (which beats it holds up); episodes reference them with `propIds`.

   **One question settles whether a thing belongs in this table: if it broke, got lost or was swapped, would the plot collapse?** If it would, it is a narrative prop (the suitcase, the inkstone, that letter); if it would not, it is set dressing (the cabin's hanging lamp, the teabowl on the table), handled by `novel-art`'s scene anchors and not in this table. If you cannot fill in `function`, do not admit it — **what cannot be filled in is not a prop, it is background**.

Every step draws on the raw material in the volume summaries. **For key trade-offs, attach `evidence` (a verbatim source passage) in `adaptation.keep`** — the outline must be able to point back to the source, not be adapted from impressions.

After cutting and merging, add one sentence of conclusion for each: `adaptation.cutNote` states the meaning of the cut ("this means: the endpoint of the whole show is…"), and `adaptation.mergeNote` states why the lead group was chosen (who has a complete arc of change). These two sentences appear in the "Key decisions" block at the very top of the report, and are the core content shown to the user at sign-off.

## The two-round rule ⛔

The skeleton must run for two rounds:

- **Round one, the quick version**: fill in all four blocks, stop as soon as it can pass `validate --stage beats`, and **hand it to the user to sign off**. Which line was cut, which people were merged, in which episode the big reveal lands — without the user's nod on these three things, everything after is wasted work.
- **Round two, the detailed version**: refine after absorbing the user's feedback, then pass `validate --stage beats` once more.

The point of the quick version is that it is cheap — a mistake costs one round of skeleton, not 60 episodes of synopses.

## Self-check

When done, run:

```bash
node scripts/novel-outline.mjs validate <outline.json> --stage beats
```

Fix every violation one by one, re-run after each fix, and only proceed to the episodes once it passes.
