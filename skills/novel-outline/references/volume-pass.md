# Volume summaries · intermediate product

You are given one volume of the source text (several chapters) and produce the adaptation raw material for that volume. **Output JSON only — no explanation, no markdown fences.**

The person who builds the outline afterwards **cannot see the source text, only the summary you write** — so the leads must be put down on paper; do not count on "looking it up in the book later".

## Output format

```json
{
  "plotlines": [
    { "name": "沈知微's case-reversal line", "events": "What happens on this line in this volume, in order, specifically", "hookPotential": "Moments on this line that can serve as beats" }
  ],
  "characters": [
    { "name": "老周", "aliases": ["老伯"], "doing": "What he does in this volume and who he becomes connected with" }
  ],
  "beatMaterial": [
    { "moment": "陆行远 pulls out his pocket in front of everyone", "type": "身份揭破 (identity exposed)", "evidence": "What was in the pocket was an old inkstone, not a gun" }
  ],
  "settings": ["ferry cabin", "county-town pawnshop"]
}
```

## Rules

- `plotlines` are organized by line, not by chapter — chapters are a physical split, while lines are the unit of adaptation
- `beatMaterial.evidence` is **copied verbatim from the source passage, keeping the source language**. Beat material must be able to point back to the source; this is how "no inventing content from the title" is enforced
- `characters.aliases` collects every form of address that appears in this volume; cross-volume merging relies on it
- `settings` lists only places where drama actually took place; places that are mentioned but where no action happens do not count
- Make no judgements about what to keep — cutting lines and merging people is the next step; this step is only responsible for making the raw material complete
