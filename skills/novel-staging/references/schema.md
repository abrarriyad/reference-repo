# staging.json format

One staging.json records, for a show (or some of its episodes), who is where at **the opening moment** of each scene. Changes of position midway are not recorded — that is the storyboard's business, and the storyboard continues from this moment onward.

```json
{
  "source": "渡口",
  "lang": "zh",
  "locations": [ … ],
  "scenes": [ … ]
}
```

| Field | Type | Description |
| --- | --- | --- |
| `source` | string | Show title, carried over by `seed` from script.json |
| `lang` | `zh` / `en` | Working language: which language item names, person names and blocking sentences are written in. The report UI also follows it by default |
| `locations` | location[] | One per location (art scene): the items recognized from its scene image |
| `scenes` | scene[] | One per scene (a script scene): the opening blocking |

## Coordinate system

All compass directions are given by the **scene**, not by the frame:

- The **main view** (the scene image's standard framing) has its camera on the **south side**, looking north. So the left of the image is west and the right is east; the higher up (farther away), the farther north, and the lower down (closer), the farther south.
- The **plan** (`plan`) is the room laid flat and viewed from directly above: north at the top, west on the left, 0 to 1, measured from the northwest corner — horizontally from the west wall (0) to the east wall (1), vertically from the north wall (0) to the south camera side (1).
- A person's position is written as "which side of which item, and how far along that side", not as plan coordinates. The point on the plan is computed by the program from that statement, so what is drawn and what is written are always one and the same thing.

## location

| Field | Type | Description |
| --- | --- | --- |
| `sceneId` | string | `S01` format, reconciled against art.json's scenes |
| `name` | string | Location name, carried over by `seed` from art.json; the report finds the image by it (`images/<name>-sheet.png`) |
| `readFrom` | `picture` / `prompt` / null | `picture`: recognized by looking at the scene image; `prompt`: there is no image yet, reckoned from art.json's anchors and main-view prompt. null = not yet recognized |
| `items` | item[] | 4–20, ordered from north to south |

### item

| Field | Type | Description |
| --- | --- | --- |
| `name` | string | Written in the working language, within ten characters, as a term that can be said aloud in blocking; things of the same kind are told apart by direction or feature ("north-end head-seat armchair", "east-side floor-to-ceiling window"). No duplicates |
| `alt` | string | The same item in the other language; English blocking sentences use it |
| `box` | [left, top, right, bottom] | Its position on the image, 0–1, with the whole image's width and height as 1. Required when `readFrom` is `picture`; with `prompt` there is no image, so do not write it |
| `plan` | [west, north, east, south] | The place it occupies on the plan, 0–1. Reckoned from perspective, not copied from box |
| `on` | boolean | A person can sit or stand on it (chair, long bench, bed, platform, steps, boat plank) |
| `round` | boolean, optional | Round when viewed from directly above (round table, round rug): drawn as a circle, with people in a ring around it; if not written, it depends on whether the name contains "圆" (round) |

## scene

| Field | Type | Description |
| --- | --- | --- |
| `ep` | number | Episode number |
| `scene` | number | Which scene of this episode, from 1, reconciled against the order of `episodes[].scenes[]` in script.json |
| `sceneId` | string | In which location, reconciled against `locations[].sceneId` |
| `lighting` | string, optional | The time-of-day lighting the script writes, carried over by `seed`, for people to read only |
| `cast` | {id, name}[] | The people who appear in this scene, carried over by `seed` from the script, not to be changed |
| `places` | place[] | Exactly one entry per person who appears; the order is the order of the blocking sentence |
| `extras` | number | How many extras there are besides those who appear. If the script does not say anyone else is there, it is 0 |
| `extrasWhere` | string / null | Where the extras are ("south end, west side of the long table"); write null when `extras` is 0 |
| `why` | string, optional | One sentence: why it was planned this way. Shown in the report, for reference when people change it |

### place

| Field | Type | Description |
| --- | --- | --- |
| `id` / `name` | string | Copied from `cast` |
| `present` | boolean | Whether this person is there at the opening. Write false for those who come in later |
| `item` | string / null | Copy one of the names in this location's `items`; write null if not present |
| `side` | `north` / `east` / `south` / `west` / `on` / null | Which side of this item; write `on` for on top of it (only items with `on: true` allow it) |
| `along` | number / null | Position along this side, 0–1: on the east and west sides from the north end (0) to the south end (1); on the north and south sides from the west end (0) to the east end (1). Write 0.5 when `side` is `on` |
| `posture` | `sit` / `stand` | Sitting or standing; may be null if not present |
| `facing` | one of eight directions | `north` / `northeast` / `east` / `southeast` / `south` / `southwest` / `west` / `northwest`; may be null if not present |

## Opening blocking sentence

The `blocking` command and the report write each scene's opening blocking from the data above: one sentence for each person present, in the order of `places`, and the last sentence accounts for whether anyone else is there.

> 沈知微 stands on the earth slope at the shore end, facing north; 老周 sits on the ferry moored at the shore, facing south; the other seats are empty, and there is no one else.

For several people who land on the same side of the same item within the same stretch, the later person carries "、XX south side" to make the order clear. When the storyboard writes this scene's first-segment opening blocking, it copies this sentence.
