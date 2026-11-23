# script.json structure

One script file covers a range of episodes (usually a batch of ≤ 3 episodes), top level:

```json
{
  "source": "渡口",
  "params": { "charsPerSecond": 4.5, "actionSeconds": 2.5, "tolerance": 0.15, "maxLineChars": 35 },
  "episodes": [ ... ]
}
```

`params` may be omitted, in which case defaults apply. Write any of the four keys only when you need to deviate from the default.

## episode

| Field | Type | Description |
| --- | --- | --- |
| `ep` | int | Episode number, a positive integer, no duplicates within one file |
| `targetSeconds` | number | Target seconds. seed computes it from the outline's `minutesPerEpisode × 60` |
| `hook` | string | A description of the opening hook — what pins people down in this episode's first few beats. **Required** |
| `cliff` | string | A description of the closing suspense — what the last beat leaves so people click the next episode. **Required** |
| `beatsClaimed` | string[] | The outline beat `type`s it claims (e.g. `"身份揭破"`, "identity exposed"). Use an empty array if none, but **the field itself must be present** |
| `hookBeat` | [int, int] | **The claimed position of the hook's concrete form** `[scene, beat]`: if the hook says the suitcase, which beat actually gives the suitcase. It must fall within the first `hookWindow` (default 3) beats of the episode — the cold-open rule, with the gate checking the position |
| `scenes` | scene[] | Scenes, in story order |

`hook` / `cliff` are **descriptions, not dialogue** — they describe the effect the opening and ending must achieve, and the concrete drama is written in the scenes. The description works with the `hookBeat` claim: **the description is for people to read, the claim is for machines to check** — if the hook does not connect with the beginning of the first scene, the claim is the missing link.

## scene

| Field | Type | Description |
| --- | --- | --- |
| `sceneId` | string | `S01` format, reconciled against art.json's scenes |
| `lighting` | string | The lighting state name used in this scene; must be a state registered for that scene in art.json. May be omitted |
| `characters` | string[] | Characters appearing in this scene (`C01` format, reconciled against outline.json). Use an empty array for an empty shot |
| `props` | string[] | Narrative props used in this scene (`P01` format, reconciled against art.json). May be omitted |
| `flow` | beat[] | The beat flow, **alternating action and dialogue**, in order of occurrence |

## beat — one of two

**Action beat**:

```json
{ "action": "沈知微 slams her hand down on the lid. The motion is too fast for a lady's, more like a beast guarding its young." }
```

**Dialogue beat**:

```json
{ "speaker": "C01", "line": "不劳烦。它跟我。", "delivery": "voice very soft, but not up for discussion" }
```

| Field | Description |
| --- | --- |
| `action` | Narrative description of the image, one thing per beat. **Quoted dialogue is not allowed** (not 「」『』“” either) — once dialogue is mixed into the action it can neither be timed nor fed to TTS |
| `speaker` | A character id from this scene's `characters`, or `"VO"` (voice-over / inner voice — whose inner voice goes into delivery) |
| `line` | The dialogue itself, colloquial, a single line ≤ 35 characters (counting non-whitespace characters) |
| `delivery` | Performance note: tone, accompanying action, subtext. May be omitted, but writing it is recommended |

A beat cannot have both `action` and `line`; having neither is not allowed either.

## Duration conversion (deterministic)

- Dialogue seconds = non-whitespace character count ÷ `charsPerSecond` (punctuation counts as time — pauses are time too)
- Action seconds = number of action beats × `actionSeconds`
- Each episode's estimate = the sum over all scenes, and it must fall within `targetSeconds × (1 ± tolerance)`

Reference volume for a three-minute (180-second) episode: about 45–55 beats, of which around 30 are lines of dialogue. For two minutes (120 seconds), about 35 beats and around 20 lines of dialogue.

## ID discipline

Characters use outline.json's `C` numbers (not cast.json's names), and scenes and props use art.json's `S` / `P` numbers. When the report is rendered with `--outline` / `--art` given, the numbers are automatically shown as names — **store numbers in the data, see names on the interface**.
