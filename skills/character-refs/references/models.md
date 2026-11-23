# Image models

Four, chosen in `config`. The main image (anchor) and the derived images can be set separately, and regenerating a single image can switch temporarily with `gen --model`.
The adapters are all in `scripts/models.mjs`, with a unified interface: given `{text, negative, ratio, refs[file paths], seed}`, they return PNG bytes.

Three sizes (shared by all four models, all satisfying gpt-image-2's size rules and all falling within the intersection of video-model reference images):

| Ratio | Size | Used for |
| --- | --- | --- |
| 2:3 | 1056×1584 | Front full-body, profile, back |
| 4:5 | 1152×1440 | Headshot |
| 1:1 | 1328×1328 | Detail |

The intersection of video-model reference images (H3 / Wan / Seedance): each side 300–5760 pixels, aspect ratio 0.4–2.5, a single image ≤20MB. The check gates check by this.

## qwen — Qwen Image 2.1 (your own ComfyUI)

- Connection: `COMFY_URL`, and if there is authentication also `COMFY_USER` / `COMFY_PASS` (Basic). Put them in environment variables, or `config --qwen-env-file <.env>`
- Workflow: `UNETLoader` (`qwen_image_2.1_int8_convrot.safetensors`) → `ModelSamplingAuraFlow` (shift 3.1) →
  `KSampler` (euler / simple, 20 steps, cfg 2.5); `CLIPLoader` (`qwen3vl_8b_int8_convrot.safetensors`, type `qwen_image`);
  `VAELoader` (`qwen_image_2.1_vae_bf16.safetensors`); `EmptySD3LatentImage` for the size
- The anchor uses `CLIPTextEncode` text-to-image; derived images use `TextEncodeQwenImageEditPlus`, with reference images connected to `image1..3` (at most 3; this skill attaches at most 2)
- Reference images are first sent with `POST /upload/image`, then `POST /prompt`, polling `/history/<id>`, and fetching the image from `/view`
- If the model file names on the server differ, change `unet` / `clip` / `vae` of `models.qwen` in `config.local.json`
- Tested: 25–50 seconds per image, exact sizes, good identity consistency; angle and framing depend entirely on the first sentence of the prompt (see `prompting.md`)

## codex — codex built-in image generation (GPT)

- Calls the local `codex exec`, attaches reference images through `-i`, and gives the prompt on standard input; it automatically finds the highest-version codex, which can also be specified with `--codex-bin`
- **No API key needed, but it uses ChatGPT subscription quota**: Plus caps out at about 25 images (`usage_limit_reached`), recovering after a few hours. It is not enough for a show with many characters,
  so use it for anchors or to rescue a single image, and leave bulk derived images to qwen / openai
- The built-in tool takes no size parameter, so the ratio is written into the prompt; testing produced strict 2:3 and 4:5
- 80–160 seconds per image. An expired login reports 401; `codex logout && codex login`
- **The output is a transparent-background PNG** (image viewers show it as a white background, but it is actually transparent black). It is automatically flattened onto white before saving, with a note kept in the record — how a video model would handle the background of a transparent image cannot be predicted
- Tested: the most accurate angles (45° is closer to 45°), and the best material rendering in detail images

## openai — OpenAI Images API (GPT Image 2)

- Key: `OPENAI_API_KEY`, in an environment variable or `config --openai-env-file <.env>`; the endpoint defaults to `https://api.openai.com/v1`,
  and relays compatible with the OpenAI format use `--openai-base-url` (or `OPENAI_BASE_URL` in `.env`)
- The anchor goes through `POST /images/generations`; derived images go through `POST /images/edits` (multipart, with reference images as `image[]`)
- Defaults to `gpt-image-2`, `quality: high`. gpt-image-2 takes any size (both sides multiples of 16, total pixels 655,360–8,294,400),
  reference images are always high fidelity, and `input_fidelity` is not accepted; there is no negative-prompt parameter, so negative words are appended to the end of the prompt as `Avoid: …`
- Switching to the `gpt-image-1` family would send `input_fidelity=high`, but they support only 1024×1024 / 1024×1536 / 1536×1024,
  and this skill's sizes would be rejected by the endpoint — use only gpt-image-2
- **The request format has been verified only against a local fake server, and has not been run with a real key.** The first time you use it, generate one anchor to confirm

## custom:<name> — custom command

```bash
node scripts/character-refs.mjs config --custom 'mine=mytool --prompt-file {prompt_file} --neg-file {negative_file} --ref {refs} --size {width}x{height} --out {out}'
node scripts/character-refs.mjs config --model custom:mine
```

Placeholders (all automatically quoted, unknown ones left as they are):

| Placeholder | Value |
| --- | --- |
| `{prompt}` / `{negative}` | The prompt / negative-prompt body; the Windows command line folds newlines into spaces, so use the file placeholders below when newlines must be kept |
| `{prompt_file}` / `{negative_file}` | The path of the written text file (more reliable for long prompts) |
| `{refs}` | Reference image paths, space-separated; empty when the anchor has no reference images |
| `{ref1}` `{ref2}` `{ref3}` | A single reference image; an empty string if there is none |
| `{out}` | The command must write the PNG here |
| `{width}` `{height}` `{ratio}` | Size and ratio |
| `{seed}` | Seed |

The same template must handle both the case with reference images and the case without (the anchor has none). If `{out}` does not exist after the command exits, it counts as a failure, and the error carries the first 300 characters of stderr.

## Switching models

Consistency comes from the same anchor image, not from the same model. Tested combinations (沈知微, 1 seed each):

| Anchor | Derived | Result |
| --- | --- | --- |
| Qwen | GPT | 7/7 all correct on the first try, best detail images |
| GPT | Qwen | Usable, and Qwen follows the GPT anchor's design completely (even the three-quarter sleeves come out as given) |
| Qwen | Qwen + GPT mixed | Connects up, with a slight brightness difference between detail images |

Recommended: derived images default to qwen (fast, uses no quota), and for a single image that does not come out well, regenerate with `gen <view> --model codex`.
