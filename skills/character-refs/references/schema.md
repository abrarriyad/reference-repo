# asset.json

One file per character, placed at `<output directory>/<character name>/asset.json`, with image paths all relative to it. **Read and written by the script; do not hand-edit `views`.**
To change the description: change the intake and `new` again (a new asset), or directly change the text in `layers` / the look — after the change, every image produced from the old text is marked stale.

```jsonc
{
  "name": "阿禾",                     // used only for file names, identifiers and the report; does not go into prompts
  "source": "sample · tea mountain",  // may be omitted
  "lang": "zh",                       // language of the confirmation table and report; if the field is absent, zh is assumed
  "ui": { … },                        // present only for non-built-in languages: the self-translated UI copy
  "layers": {                         // character layer: unchanged even when the look changes
    "identity": { "age": 16, "gender": "female", "en": "…", "text": "…", "source": "stated" },
    "face":  { "en": "…", "text": "…", "source": "stated" },   // en goes into the prompt; text is for people to read (old assets use zh, still recognized)
    "hair":  { … },
    "build": { … },                   // may be omitted
    "skin":  { … },                   // may be omitted; if omitted, filled in by age
    "backCue": { … }                  // may be omitted; if omitted, assembled from hairstyle and clothing
  },
  "outfits": {                        // look layer; v1 has only default
    "default": {
      "label": "everyday · tea-picking outfit",
      "top":    { "en": "…", "text": "…", "source": "stated" },
      "bottom": { … },
      "details": [ { "slot": "hair", "en": "…", "text": "…", "source": "stated" }, … ],
      "overrides": {},                // character-layer fields this look changes, e.g. a hairstyle change: { "hair": { … } }
      "look": { "id": "anime", "label": { "zh": "动漫", "en": "Anime", "ja": "アニメ" }, "medium": "drawn",
                "style": "…", "clean": "…", "neg": "…" },   // art-style snapshot; medium: photo = photograph / drawn = drawn
      "upgrades": [ { "tier": 2, "reason": "E03 has a facial close-up", "at": "…" } ],
      "views": {
        "front-full": {
          "current": 2,               // the version currently in effect
          "versions": [ { … v1 … }, { … v2 … } ]   // regeneration only appends, never deletes
        }
      }
    }
  }
}
```

## A version

```jsonc
{
  "v": 1,
  "id": "阿禾/default/front-full/v1",          // identifier: character/look/view/version
  "file": "default/front-full.v1.png",
  "sha256": "…",                               // hash of the file after the identifier was written
  "model": "qwen",                             // the model this image used; mixing within a set is only flagged
  "seed": 1980929016,
  "prompt": "…", "negative": "…",              // the prompts actually sent
  "refs": [ { "view": "front-full", "v": 1, "sha256": "…" } ],   // which reference images were actually attached
  "notes": [],                                 // e.g. "face-front missing or stale, this image attached only the anchor"
  "layersHash": "…",                           // fingerprint of the text description at generation time
  "lookHash": "…",                             // fingerprint of the art-style snapshot at generation time
  "gates": [ { "id": "size", "label": "…", "ok": true, "detail": "1056×1584" }, … ],
  "createdAt": "…",
  "confirmed": true, "confirmedAt": "…"        // anchor only: false = awaiting confirmation / true = confirmed / "auto" = configured not to confirm
}
```

The same identifier, model and reference images are also written into the PNG's iTXt fields (`shuohao:id`, `shuohao:model`, `shuohao:refs`).

## Views

| id | Tier | Ratio | Reference image |
| --- | --- | --- | --- |
| `front-full` | 1 (anchor) | 2:3 | None |
| `face-front` | 2 | 4:5 | Anchor |
| `side-full` | 2 | 2:3 | Anchor |
| `back-full` | 2 | 2:3 | Anchor |
| `detail-hair` / `detail-neck` | 3 | 1:1 | Anchor + headshot |
| `detail-sleeve` / `detail-feet` | 3 | 1:1 | Anchor |
| `detail-<id>` (custom) | 3 | 1:1 | When `part` is hair / neck, anchor + headshot, otherwise only the anchor; marked "untested" |
| `face-45` | 4 | 4:5 | Anchor |

## Staleness

An image's current version is stale if any one of these holds (`check` exits 1, the report marks a red outline):

- The text-description fingerprint changed: if the description of the person themself changed (identity, age, gender, face, hair, build, skin, top and bottoms, back), all become stale;
  if a single detail changed, only that detail image becomes stale; adding or deleting details does not affect the other images
- The art-style snapshot changed
- One of the images it referenced changed version (regenerate the anchor → all the rest go stale; regenerate the headshot → details attached to the headshot go stale)

Only marked, never deleted; just regenerate that one image. After the anchor is regenerated it must be confirmed again.
