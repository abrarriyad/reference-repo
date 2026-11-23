# AGENTS.md

## Behavior rules

- A skill must be self-contained and copyable on its own: it must not depend on any third-party skill (official skills included). External methodology is learned, internalized into this repository's own references documents, and the source of the learning is noted.
- **Settle the story of the sample data first, then the storyboard.** Doing it the other way round welds you in: once the picture becomes concrete ("a letter on the table, the father pressing it down and refusing to hand it over"), every later "change of story" merely gives the same action a different motive, and three versions sound like the same version. Until the story is settled, do not write the storyboard, and above all do not generate images.
- **Each skill's sample data must be its own**, never borrowing a sibling skill's sample. A borrowed sample is both a broken link (a skill must be copyable away whole) and able to showcase only someone else's single genre.
- Rendered artifacts (`gallery.html`, `*-report.html`) are not under version control; every `render` can regenerate them.
- **Accumulating gate failures (`.gates.jsonl` + `stats`) currently exists only on novel-storyboard.** This is deliberate: use it in real projects for a while first, confirm that what `stats` produces really points at rules that should change, and only then decide whether to roll it out to the other five. **If nobody opens it for a long time, the feature should not have been built, and rolling it out would only copy the mistake five times.** Do not bring up rolling it out on your own initiative.
