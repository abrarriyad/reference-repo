# storyboard-report.html design conventions

The same visual language as the other four reports. Read this before changing styles; do not improvise.

## Tone

- Cold grey stock + rust-red seal: `--paper:#eceded` `--panel:#f5f6f5` `--seal:#8a3324` `--seal-2:#c56a4e` `--ok:#3d6b4f`. The palette has been through a visualisation validator; do not change colours on your own
- Page width 1600, serif headings + sans-serif body, zero external dependencies, opens offline by double-click
- Every character the model produces goes through `esc()`; `<` in embedded JSON becomes `<` to prevent `</script` truncation

## Section order

KPI band → 01 cut rhythm strip → 02 per-episode storyboard table → 03 generation batch list → 04 audio alignment list → 05 quality gates.

## Cut rhythm strip (the signature chart)

- One row per episode: `E01 | colour band | total`. The band is grouped by **generation segment** (`.rseg` thick separator = segment boundary = one generation), with one slice per cut inside a group, **slice width = cut duration ÷ episode duration**, colour = rust red tiered by shot size using opacity (extreme wide 0.25 → extreme close 1.0) — alternating depth and alternating length is what makes a good rhythm, readable at a glance
- Slices are `<a href="#seg-<segment id>">`; clicking jumps to the segment card; the hover title carries segment id#cut index / seconds / shot size / camera move

## Per-episode storyboard table

- One block per episode, **segment cards** in a two-column grid (`repeat(2,minmax(0,1fr))`, stepping down on narrow screens); the segment card area is clipped at 760px by default with a fade and a "show all segments / collapse" toggle, and episodes that are not too tall after loading open automatically with the button removed
- Segment card: segment header (segment id + total seconds · cut count badge + scene/lighting chips + beat claim range) → **master frame** laid out per the top-level `aspectRatio` (16:9 by default, 9:16 for a vertical drama; a vertical master frame is narrowed and centred, while the batch card's scene sheet is always 16:9; older data's `_meta.orientation` and the tag at the end of frame are compatibility only) (`<segment id>/f1.png`; when missing, show "master frame · #1 not generated" + a prompt placeholder — **never guess, never pretend**) → **sub-frame strip** (`.subs` four-column thumbnail grid, frame by frame from f2, with a small placeholder when missing. The class name is `subf` — `sub` collides with the header's `.sub`, hit in production) → **50/50 split** (`.duo`, `repeat(2,minmax(0,1fr))`): left column is the cut rows (#index, `from 0.00s · 3s`, shot size · camera move, character/prop chips, picture summary **brought out automatically from the beats claimed from the script**, hover shows a frame-prompt copy), right column is the **prompt panel** — two tabs side by side: H3 (`h3Prompt` as-is) and Seedance (assembled by program), H3 by default, the copy button reads the currently active tab, and a long list gets its own thin scrollbar. Below the cut head, the cut row gets one more row of composition quantified fields (`.scomp`, focal length · camera position · composition · eyeline · focus · stability); below the frame, the segment card shows blocking (`.seg-block`)
- `imageExists` is injected by the CLI (checking the working directory at render time); renderHtml itself never touches the filesystem — testability

## Generation batch list

- Same scene + same lighting form one batch, in two-column cards; with `--art` and a scene sheet found in the directory given by `--images` (`./images` by default), embed the image (click to enlarge)
- Batch card: number + scene/lighting chips + segment id chips (clickable to jump) + one line "Needs: whose character sheets · which props"

## Audio alignment list

- One table: segment id#cut index (clickable) / speaker / dialogue (serif) / dialogue seconds — which segment and cut each TTS clip lands on, all auto-summarised

## Quality gates and interaction

- Header badge + lesion banner + a list at the end of the document; when an audit gate lacks upstream input, say so in small print: "skipped (treated as passing)"
- Lightbox enlarges an image on click (shared by first frames and batch scene images), Esc closes
- Copy buttons `.copy[data-copy]` with event delegation; export JSON embedded Blob download, `revokeObjectURL` delayed 10 seconds
- `@media print`: expand all clipped areas, hide buttons, two-column shot cards, white background; `prefers-reduced-motion` disables animation
