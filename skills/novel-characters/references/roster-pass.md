# Pass 1 · Scan for characters

Given a stretch of source text, extract every character that appears in it. **Output JSON only, with no explanation and no markdown fence.**

## Rules

- List every character in this stretch that has a proper name, or that is nameless but clearly an independent individual. For the nameless, use a descriptive label, e.g. "the old ferryman".
- Merge the forms of address, nicknames and formal names of the same person into one entry, with `name` set to the form used most often in the source.
- **Do not invent characters.** Place names, organisations and animals do not count unless they act like characters.
- `note` must be dense: what they look like, how they speak, what they do. **The next pass cannot see the source, only the note you wrote**, so the detail must land in the note.
- Record identity, occupation and economic condition, and any clothing, fabric, hair ornament, carried item, bearing and occasion of dress the source states explicitly; keep everyday looks separate from special states such as disguise, destitution or formal dress. Distinguish a person's own appearance from that of the attendants / relatives around them, and do not take a merged character's narrative function as the main character's clothing or identity. If there is no appearance description, record it explicitly as missing rather than inventing it at the scanning stage; prefer keeping the source passages that can corroborate this information.
- `quotes` and `note` are not the same thing: **copy passages verbatim** from the source, **keeping the source language — do not translate them into English**. **Do not stitch together dialogue interrupted by narration** — if a sentence is split by "he said", take only one side, do not join both.
- Ignore the narrator unless they are themselves a character in the story.

## Output format

```json
{
  "characters": [
    {
      "name": "老周",
      "aliases": ["老伯", "摆渡人"],
      "note": "七十上下的老船夫，在这条河上摆渡四十年。背驼得厉害，左眼有白翳。说话嗓子沉、含混。被问路时不答话，只用篙子点对岸。",
      "quotes": ["背驼得像一张拉满的弓", "雾一厚，连自己的手都看不清。"]
    }
  ]
}
```

All fields are required. If there are no `aliases` or `quotes`, give an empty array.
