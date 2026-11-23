# Image recognition: recognizing what can be stood on or sat on from the scene image

Do this once per location (art scene), and every scene in the same location uses this one result. The recognized list is all the items that can be used when planning blocking: each person lands at one side of one of them. So the list must agree with the image, and **only what is in the image gets written**.

Why look at the image and not the prompt: the image only draws part of what the prompt says, and things written in the prompt but not drawn in the image are common (found in a real test: the prompt had a head-seat platform at the north end, the image did not, and the blocking sat a person on a platform that does not exist, so the resulting video differed in every segment). The video and the storyboard images are both generated from this image, so the blocking must land on this image.

## Which part to look at

novel-art's scene sheet is a 16:9 layout: **the upper-left about 72% wide × 70% high is the main view**, and the right column and bottom row are detail close-ups. Recognize items from the main-view block only; `box` is still measured against the **whole image's** width and height (upper left 0,0, lower right 1,1), and the report draws the box on the whole image.

The main view's camera is on the south side looking north: the left of the image is west and the right is east; the higher up (farther away), the farther north, and the lower down (closer), the farther south.

## What to write

1. **Write only things people will stand beside, sit on, or walk to**: tables, chairs, long benches, sofas, beds, counters, platforms, steps, doors, windows, screens, staircases, railings, pillars, boat planks, large furnishings. Pictures on a wall, teacups on a table, lamps and the like are not written, unless it is the only thing in the space that can serve as a reference.
2. **Do not write what cannot be seen in the image.** art.json's scene prompt and anchors are used only to help you identify what a thing in the image is called — anything written in the prompt but not on the image is never written; anything on the image but not in the prompt is written as seen.
3. **One entry per item.** A ring of chairs around a table is not written separately — a person seated at the table is written at some side of the table, and the table speaks for them; only the head-seat chair, and chairs, sofas and stools standing alone away from the table, get an entry each (the head seat decides who takes the head seat).
4. **Write names as terms that can be said aloud in blocking**, within ten characters, with things of the same kind told apart by direction or feature ("north-end head-seat armchair", "east-side floor-to-ceiling window", "sofa by the west wall"). Do not write people's names. The name in the other language goes in `alt`.
5. A large open area in the middle of the room or a spot by the door, if there is no furniture to serve as a reference, can be written as one entry ("open floor at the hall's centre"), boxing that patch of floor.
6. **`box`** boxes the place the item occupies on the image; for one partly hidden by something in front, box the visible part plus the rough extent of the hidden part.
7. **`plan`** is the room laid flat and viewed from directly above: north at the top, south at the bottom (the camera side), west on the left, east on the right. Reckon the real position and size from perspective — an item that is smaller and higher up in the image is farther north on the plan; a long table stretching from near to far is a trapezoid in the image and a north–south strip on the plan; something against the left wall is toward the west on the plan. **Items in the same location must not overlap each other**, and between a table and the chairs around it leave room for people to sit.
8. **`on`**: write true if a person can sit or stand on it (chair, long bench, bed, platform, steps, deck), otherwise false.
9. **`round`**: write true if it is round or oval viewed from directly above (round table, round rug, round flower bed). People stand or sit in a ring around a round item.

Count: 4 to 20, ordered from north (the top of the image, far away) to south (the bottom, close). Too few and people cannot be placed; too many is most likely because cups, bowls and plates were written in.

## When done

Write `readFrom` as `picture`.

```json
{"sceneId":"S01","name":"渡船船舱","readFrom":"picture","items":[
  {"name":"船头撑篙台","alt":"bow poling deck","box":[0.30,0.10,0.55,0.22],"plan":[0.30,0.02,0.70,0.10],"on":true}
]}
```

## When there is no image yet

novel-art delivers only prompts and generates no images. While the image does not exist yet, you can first **reckon from art.json**: the large items written in the main-view prompt or present in the anchors, placed on the plan by the directions given in the prompt. Blocking planned this way is only a draft — once the image exists, the things in the scene are not necessarily the same as in the prompt, so recognize again and check the blocking.

How to write the reckoned version: write `readFrom` as `prompt` and no `box` (there is no image to box), with the other rules as before. The report marks this location "no image, reckoned from the design prompt".
