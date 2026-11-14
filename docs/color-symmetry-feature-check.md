# Color symmetry feature check

This page checks every item of `FEATURES.md` against the code of branch `color-symmetry`, commit `f63c09a`.
The rule: every feature survives. Each item is "kept as is", "moved to …", "changed: …" or "new".

Method. I read the diff `1807baf..f63c09a` (14 commits, 30 files).
The diff adds new files (`src/heavy/*`, `src/patterns/farris*.ts`, `src/color-sym.ts`, `src/color-sym-tile.ts`, `src/components/ColorSymmetryPanel.vue`, `src/components/ColorSymHowItsMade.vue`, `docs/review/color-symmetry-how-its-made.md`) and their tests.
It changes six old files: `src/components/PatternPanel.vue`, `src/state.ts`, `src/state-share.ts`, `src/state-export.ts`, `src/share.ts` and `src/pairing.ts`.
For each changed file I read every hunk and checked that no label, state, key or output was removed.
The diff does not touch `src/App.vue`, `src/studio/` or `src/builder/`.
An item in a file that the diff does not touch is "kept as is", with no line cited.
Line numbers are for commit `f63c09a`.

Four checks hold the Patterns page unchanged with Color symmetry off:

- Color symmetry needs a symmetry kind, no image and no patchwork (`colorSymActive`, `src/state.ts:335`). The visitor must turn it on. The default is off (`src/color-sym.ts:15`).
- With it off, `svgForSeed` returns the same tile as before: the new branch returns nothing (`src/state.ts:617`).
- With it off, the link writes no new key (`src/share.ts:310`). A design without it compares as before (`src/state-share.ts:83`). Old links have no `cs`, so they open with it off (`src/share.ts:324`).
- With it off, the size badge lines, the "Other formats" reason and the contrast surfaces are the old ones (`src/state-export.ts:161,172`, `src/pairing.ts:55`).

## Counts

| Status     | Rows |
| ---------- | ---- |
| Kept as is | 34   |
| Moved      | 0    |
| Changed    | 5    |
| New        | 5    |
| Missing    | 0    |

A row can group several small items with the same status.

## 1. Core

| Feature | Status | Where now |
| --- | --- | --- |
| Site header (Patterns, Studio, Builder): brand, tool switch, narrow screens, tagline, "GitHub", palette carry-over with `pn` or `pc` | kept as is | `src/components/SiteHeader.vue` |
| Palette strip (Patterns toolbar, Studio toolbar, Builder fill fold) | kept as is | `src/components/PaletteStrip.vue` |
| Full screen (Patterns, Studio) | kept as is | `src/shortcuts.ts` |
| Single-key shortcuts (Patterns, Studio): R, F, off switch, corner hint | kept as is. R gives a new seed, so with Color symmetry on it gives a new recipe | `src/shortcuts.ts` |
| Undo and redo (Patterns, Builder) | kept as is. The Patterns history stores the design. If Color symmetry is on, the design carries it | `src/history.ts`, `src/state-share.ts:83,122` |
| Size, weight grade and CO2 badge (all three pages) | changed: with the Smooth wheel on, the grade chip tooltip adds the line "Tile: WebP image, X KB" (or PNG). All old lines stay | `src/state-export.ts:161` |
| Copy feedback (all three pages) | kept as is | `src/App.vue`, `src/studio/StudioApp.vue`, `src/components/ExportActions.vue` |
| Export actions block (Builder) | kept as is | `src/components/ExportActions.vue` |
| Layout and platform: sticky toolbar, footer, footprint line, dark mode, reduced motion, touch, JavaScript-off text, privacy notes | kept as is | `src/css/app.css`, `src/components/PageFootprint.vue` |

## 2. Patterns page

`src/App.vue` is not in the diff. `src/components/PatternPanel.vue` gains one async import and one tag. No old control was removed or renamed.

| Feature | Status | Where now |
| --- | --- | --- |
| Toolbar: "Design actions" | kept as is. "Download SVG" keeps its name `fractal-{kind}-{seed}.svg` | `src/App.vue` |
| Preview (the hero) | kept as is. It still shows the exported CSS. If Color symmetry is on, that CSS has the bands or the wheel | `src/App.vue` |
| Tabs | kept as is | `src/App.vue` |
| Pattern tab | changed: for a symmetry kind (no image), the Color symmetry card shows between the library and the tile size presets. All old controls stay | `src/components/PatternPanel.vue:12,116` |
| Repetition tab | changed: "Reduce repetition" does not apply while the bands show (`!colorSymActive`). The symmetry kinds were never in its list of kinds that vary, so no old state is lost | `src/state.ts:566` |
| Layout tab | kept as is | `src/components/` |
| Colors tab: "Colors and contrast" | changed: with Color symmetry on, the contrast check adds each of the 5 band colors as a surface under the text. Off, the surfaces are the old ones | `src/pairing.ts:20,55`, `src/state.ts:355,747` |
| Image tab: "From image" | kept as is. With an image, the Color symmetry card hides | `src/components/ImagePanel.vue` |
| Export tab | changed: if Color symmetry is on, "Other formats" gives the reason "Color symmetry draws color bands; these formats draw lines." If it is off, the old reasons stay | `src/state-export.ts:172` |
| Footer | kept as is | `src/App.vue` |

## 3. Wallpaper Studio (studio.html)

`src/studio/` is not in the diff.

| Feature | Status | Where now |
| --- | --- | --- |
| Toolbar: "Wallpaper actions" | kept as is | `src/studio/StudioApp.vue` |
| Preview | kept as is | `src/studio/StudioApp.vue` |
| Design panel | kept as is | `src/studio/StudioApp.vue` |
| Repeat panel | kept as is | `src/studio/StudioApp.vue` |
| Motif families panel | kept as is | `src/studio/StudioApp.vue` |
| Breed panel | kept as is. It keeps its own worker. The shared heavy worker is a separate file | `src/studio/BreedPanel.vue`, `src/studio/breed.worker.ts` |
| Your own motif panel | kept as is | `src/studio/StudioApp.vue` |

## 4. Builder (builder.html)

`src/builder/` is not in the diff, and no Builder file imports the Color symmetry code.

| Feature | Status | Where now |
| --- | --- | --- |
| Toolbar: "Builder actions" | kept as is | `src/builder/BuilderApp.vue` |
| Stage | kept as is | `src/builder/` |
| Shapes card | kept as is. "Math patterns" keeps drawing lines | `src/builder/` |
| Selected shape card | kept as is | `src/builder/` |
| Tile card | kept as is | `src/builder/` |
| Export card | kept as is | `src/builder/ExportPanel.vue` |

## 5. Behind the interface

| Feature | Status | Where now |
| --- | --- | --- |
| Link keys: Patterns, all old keys | kept as is. The new keys come last. If Color symmetry is off, the page does not write them (see New) | `src/share.ts:156` |
| Link keys: Wallpaper Studio | kept as is | `src/studio/studio-share.ts` |
| Link keys: Builder (none) | kept as is | `src/builder/` |
| Stored in the browser (`fp-shortcut`, `fp-builder-design-v1`, `fp-builder-snap-v1`, `fp-tab`, `fp-lib`) | kept as is. Color symmetry stores nothing in the browser | `src/shortcuts.ts`, `src/builder/` |
| Export outputs: Patterns CSS, HTML, script and other formats, Studio CSS, Builder CSS, SVG and design file | kept as is. With Color symmetry on, `--fp-tile` holds the bands SVG or the wheel image in an SVG | `src/state.ts:617` |
| Speed and CO2 rules shown to visitors | kept as is | `src/co2.ts` |
| Studio genes and gallery | kept as is | `src/studio/genes.ts`, `src/studio/gallery.ts` |

## New

| Feature | Status | Where now |
| --- | --- | --- |
| Color symmetry (Pattern tab, Symmetry groups): a card for the symmetry kinds only, loaded on demand. "Draw the group with" "Lines" or "Color symmetry". (state: Patchwork on) the switch is disabled with "Color symmetry draws one tile; turn off Patchwork to use it." (state: on) "Waves" 2 to 8, "Detail" 1 to 6, "New recipe" (a new seed), "Color order" N of 10 with "Previous color order" and "Next color order", "Balance color areas", "Render": "Bands · vector SVG" or "Smooth wheel · WebP image" | new | `src/components/ColorSymmetryPanel.vue`, `src/color-sym.ts` |
| Fold "How it's made" under the controls, with MathML formulas | new | `src/components/ColorSymHowItsMade.vue`, `docs/review/color-symmetry-how-its-made.md` |
| Status (state: Smooth wheel) a polite line "Growing…" while the wheel image grows | new | `src/components/ColorSymmetryPanel.vue:49`, `src/state.ts:364` |
| Link keys `cs` (1), `cw` waves, `cd` detail, `cb` balance, `cm` render (b or w), `co` color order. If Color symmetry is off, the page writes none of them. If it is on, it writes `cs` and each setting that differs from its default. Undo and redo carry them | new | `src/share.ts:156,310,324`, `src/state-share.ts:83,122` |
| Farris color field for the 17 groups, bands renderer, wheel renderer and encoder, and the shared heavy-task Web Worker (loaded on demand, used by the Smooth wheel) | new | `src/patterns/farris.ts`, `src/patterns/farris-bands.ts`, `src/patterns/farris-wheel.ts`, `src/patterns/farris-wheel-encode.ts`, `src/patterns/farris-wheel-task.ts`, `src/color-sym-tile.ts`, `src/heavy/` |
