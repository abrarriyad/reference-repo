# script-report.html design conventions

The same visual language as the reports of novel-characters / novel-outline / novel-art. Read this before changing styles; do not improvise by feel.

## Tone

- Cool-grey stamp paper + rust-red seal marks: `--paper:#eceded` `--panel:#f5f6f5` `--seal:#8a3324` `--seal-2:#c56a4e` `--ok:#3d6b4f`. This palette has been run through the visualization validator; do not change colors on your own
- Page width 1600, serif headings (Song-family) + sans-serif body, restrained sectioned layout, like an industry review document
- **Zero external dependencies**: all styles inline, graphics pure CSS/SVG, opens offline with a double-click
- Every character the model produces goes through `esc()`; `<` in embedded JSON is escaped as `<` so `</script` cannot truncate it

## Block order

KPI band → 01 duration gauge → 02 per-episode script → 03 scene master table → 04 dialogue book → 05 quality gates. Duration is money, so the gauge goes first; the dialogue book is TTS's work list and goes after the tables.

## Duration gauge

- One row per episode: `E01 | track | value`, three layers in the track — the target band (`--band`, semi-transparent green), the dialogue segment (`--seal`), and the action segment (`--seal-2`)
- The horizontal scale is uniform globally (the maximum across all episodes × 1.08), so rows can be compared in length directly
- Values on target use `--ok` green, over/under use `--seal` red in bold and state how many seconds off — the problem must be named, not just a change of color

## Per-episode script

- **Two episodes per row**: `.eps{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}`, a single episode adds `.solo` for one column, dropping to one column on narrow screens
- In each episode card the **scene area is at most 300px by default** (`.scenes.clip{max-height:300px}` + a fade at the bottom), while the episode header / hook / suspense are always visible; "Expand all scenes / Collapse scenes" is a **toggle**, and collapsing scrolls back to the card's position. After the page loads, episodes that are not too tall are opened automatically and the button removed (judged by `scrollHeight`)
- A dialogue line is a three-column grid `150px minmax(0,1fr) auto`: speaker (name + delivery stacked), line, and a copy button that appears on hover. **Scroll/grid containers always use `minmax(0,1fr)`** so that long Chinese words do not squeeze the column into one character per line
- Scene header chips: scene id+name, lighting (seal-2 outline), characters, props (seal outline). Names are shown only when `--outline` / `--art` is given, otherwise bare IDs — never guess

## Dialogue book

- **Two per row** (the `.casts` grid, same rule as `.eps`), one card per character, the group header carrying line count / character count / approximate seconds + "Copy all dialogue" (the whole group's lines joined by newlines, to feed straight to TTS)
- The list is **at most 6 rows high** (`max-height:186px`) scrolling vertically, with a thin scrollbar; when printing, scrolling is released and everything expanded
- VO forms its own group, shown as "Voice-over"

## Quality gates

- Header badge `✓ Quality gates n / n`; when any fail, a problem banner (`.galert`) hangs under the KPI band listing each failing gate and its details
- When upstream files are missing, reconciliation gates show small text "skipped (counted as passing)" — **a skip must be stated plainly; silent passing and lying are one step apart**

## Interaction and printing

- Copy buttons uniformly use `.copy[data-copy]` event delegation, the text changing on success and reverting after 1.6 seconds; failure also needs feedback
- `@media print`: collapsed sections fully expanded, buttons all hidden, white background
- `prefers-reduced-motion` turns off all animation
- JSON export: the data is embedded in `<script type="application/json">`, the export wraps it in a Blob for download, and `revokeObjectURL` is delayed 10 seconds (Safari revokes the blob before the download starts)
