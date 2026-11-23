# Planning blocking: who is where when a scene opens

Plan the opening blocking for each scene: when this scene begins, where each person who appears is relative to which item in this location, sitting or standing, and facing which way. The storyboard copies it for this scene's first-segment opening blocking, and the blocking of the later segments continues downward from this sentence — once it is fixed, who sits where within the same scene does not change from segment to segment.

Why plan first: every video segment of a short drama is an independent generation, and each segment decides for itself who sits where. In an ensemble scene with six people around a long table, the first segment grows five nameless guests at the table, and in the third segment the person seated serving wine is wearing the lead's clothes — handing the blocking sentences over word for word is no use either, because the sentence for each scene's first segment is invented by the storyboard itself.

For each scene you receive: this scene's script (the scene's `flow`), the people who appear (`cast`), and the items recognized for this location (`locations[].items`).

## Rules

1. **Read this scene's script first, and tell who is there from the start and who comes in later.** A person who comes in later is not present at the opening (`present: false`). If the script does not say someone enters, treat them as there from the start.
2. **Sitting or standing follows the script**: if everyone is eating, meeting, drinking tea or riding a boat at the start, they are seated; a person standing needs a reason — just came through the door, is serving, is poling the boat, is being made to stand as punishment, is about to make trouble. Do not make a seated scene stand up for the sake of a nicer image.
3. **Arrange positions by status and relationship**, so the audience understands the power relations at a glance:
   - Elders and those in power sit at the head seat (the position facing the entrance, at the highest ground or in the most central place).
   - Opposing sides face each other across the table, or one sits and one stands; the lead and those standing with them are on the same side.
   - Those who are isolated or looked down on sit in the last position (farthest from the head seat, at the end by the door), or simply stand.
4. **Leave a path for the camera**: do not put a third person between the two people who have the most dialogue in this scene; do not put all the important people on the same side with their backs to the entrance.
5. **Facing**: seated people generally face the table (people on the east side face west); the person at the head seat faces the whole room; standing people face the person or direction they are looking at or speaking to at the start.
6. **Extras**: if the script does not say there is anyone else, there is no one else, and the other seats are empty (`extras: 0`) — do not add people for "liveliness"; the video model will draw the extra positions as faces one by one. Only when the script writes a hall full of guests or a crowd of onlookers do you give a number of extras and where they are.
7. **Use only the items that were recognized for blocking** — do not invent furniture that is not in the recognition result, and do not use things the script mentions that are not on the image. Several people on the same side are spread along that side (`along` at least 0.12 apart), and not stacked on a single point. Only an item with `on: true` may be written as `on`. People seated around a table land at some side of that table item ("seated at the east side of the long dining table"), and not on "the chairs".
8. **Consecutive scenes in the same location** (a whole trip by boat, one meal split across several scenes): if no plot makes anyone change position, plan it as in the previous scene, changing only facing and sitting/standing. The audience remembers who sits where.
9. **Write one `why` sentence**: why it was planned this way (who is absent at the opening, who takes the head seat, why someone stands). It is shown to people in the report, so that when they change it they know the original reasoning.

## Adjust by one sentence

When someone says "move 胡二爷 to the bow" or "change 萧老太太 to standing", that is **a change to the current blocking as requested**, not a re-plan: only the people and items the request mentions move, and every other person's `item`, `side`, `along`, `posture`, `facing` and the extras are copied as they currently are. The request is a person's decision, and when it conflicts with the script or the rules above, the request wins; if an item the request names is not in the recognition result, land on the closest one and say so in `why`. Run `validate` as usual after the change.

A quicker way is to drag directly on the report page: see Step 5 of SKILL.md.

## How to write it

```json
{
  "ep": 1, "scene": 2, "sceneId": "S01",
  "cast": [{"id":"C01","name":"沈知微"}, {"id":"C04","name":"胡二爷"}],
  "places": [
    {"id":"C01","name":"沈知微","present":false,"item":null,"side":null,"along":null,"posture":null,"facing":null},
    {"id":"C04","name":"胡二爷","present":true,"item":"第三排坐板","side":"on","along":0.5,"posture":"sit","facing":"north"}
  ],
  "extras": 0,
  "extrasWhere": null,
  "why": "沈知微 comes into the cabin afterwards and is absent at the opening; 胡二爷 sits in the third row with his load."
}
```

`cast` is carried over by `seed` and not changed; `places` has exactly one entry for each person who appears. For the full description of the fields see `schema.md`.
