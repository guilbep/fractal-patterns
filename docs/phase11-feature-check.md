# Phase 11 feature check

This page checks every item of `FEATURES.md` against the code of branch `phase11`, commit `b070045`.
The rule: every feature survives. Each item is "kept as is", "moved to …", "changed: …" or "new".

Method. I read the diff `2fa78d5..b070045` (4 commits, 25 files).
The diff touches only the Studio genes, the Breed fold, the gallery generator and the page footprint line.
Its other files are tests (`src/studio/*.test.ts`, `e2e/breed.spec.ts`, `e2e/footprint.spec.ts`), `Makefile`, `.gitignore` and `src/css/app.css` (7 lines for the footprint line).
For each changed file I read every hunk and checked that no label, state, key or output was removed.
An item in a file that the diff does not touch is "kept as is", with no line cited.
Line numbers are for commit `b070045`.

Two checks hold the Studio unchanged without genes:

- If a gene is absent, `band(r, g)` in `src/studio/genes.ts:36` returns the random draw `r` itself. So every draw in `motifs.ts`, `motifs-sea.ts`, `motifs-orchard.ts` and `compose.ts` is the same as before.
- If the color roles gene is absent, `composeColors(palette, genes)` keeps the old color roles (`src/studio/compose.ts:1057`).
- The test "old links (no g) open the same wallpaper as before genes" pins the SVG hashes of 14 old links (`src/studio/genes.test.ts:34`).

## Counts

| Status     | Rows |
| ---------- | ---- |
| Kept as is | 35   |
| Moved      | 0    |
| Changed    | 2    |
| New        | 5    |
| Missing    | 0    |

A row can group several small items with the same status.

## 1. Core

| Feature | Status | Where now |
| --- | --- | --- |
| Site header (Patterns, Studio, Builder): brand, tool switch, narrow screens, tagline, "GitHub", palette carry-over with `pn` or `pc` | kept as is | `src/components/SiteHeader.vue`, `src/studio/studio-share.ts` |
| Palette strip (Patterns toolbar, Studio toolbar, Builder fill fold) | kept as is | `src/components/PaletteStrip.vue` |
| Full screen (Patterns, Studio) | kept as is | `src/shortcuts.ts` |
| Single-key shortcuts (Patterns, Studio): R, F, off switch, corner hint | kept as is | `src/shortcuts.ts`, `src/components/ShortcutHint.vue` |
| Undo and redo (Patterns, Builder) | kept as is | `src/history.ts`, `src/builder/store.ts` |
| Size, weight grade and CO2 badge (all three pages) | kept as is | `src/components/SizeBadge.vue`, `src/co2.ts` |
| Copy feedback (all three pages) | kept as is | `src/App.vue`, `src/studio/StudioApp.vue`, `src/components/ExportActions.vue` |
| Export actions block (Builder) | kept as is | `src/components/ExportActions.vue` |
| Layout and platform: sticky toolbar, dark mode, reduced motion, touch, JavaScript-off text, privacy notes | kept as is | `src/css/app.css`, `index.html`, `studio.html`, `builder.html` |
| Footer: "Source on GitHub" and the sponsor banner | changed: a footprint line now sits above the sponsor banner on all three pages (see New). the old footer text is unchanged | `src/App.vue:358`, `src/studio/StudioApp.vue:731`, `src/builder/BuilderApp.vue:250` |

## 2. Patterns page

The only change to `src/App.vue` is the import and the tag of the footprint line. No Patterns panel changed.

| Feature | Status | Where now |
| --- | --- | --- |
| Toolbar: "Design actions" | kept as is | `src/App.vue` |
| Preview (the hero) | kept as is | `src/App.vue` |
| Tabs | kept as is | `src/App.vue` |
| Pattern tab | kept as is | `src/components/` |
| Repetition tab | kept as is | `src/components/` |
| Layout tab | kept as is | `src/components/` |
| Colors tab: "Colors and contrast" | kept as is | `src/components/ColorPanel.vue` |
| Image tab: "From image" | kept as is | `src/components/ImagePanel.vue` |
| Export tab | kept as is | `src/components/` |
| Footer (palettes and WCAG note) | kept as is | `src/App.vue` |

## 3. Wallpaper Studio (studio.html)

`src/studio/StudioApp.vue` gains the Breed fold, its async import, the gene count and the footprint line. No old control was removed or renamed.

| Feature | Status | Where now |
| --- | --- | --- |
| Toolbar: "Wallpaper actions" (Shuffle, Download SVG, Copy CSS, palette strip, full screen, size badge) | kept as is | `src/studio/StudioApp.vue` |
| Preview (label, shortcut hint) | kept as is | `src/studio/StudioApp.vue` |
| Design panel (seed, balance, theme, palette, density, tile size, zoom, options) | kept as is. With no gene set, a palette gives the same color roles | `src/studio/StudioApp.vue`, `src/studio/compose.ts:1057` |
| Repeat panel | kept as is | `src/studio/StudioApp.vue` |
| Motif families panel | kept as is. The new Breed fold follows it | `src/studio/StudioApp.vue:614` |
| Your own motif panel, "Your motif is not part of the link." | kept as is. The fold now comes after Breed | `src/studio/StudioApp.vue:634` |

## 4. Builder (builder.html)

The only change to `src/builder/BuilderApp.vue` is the import and the tag of the footprint line.

| Feature | Status | Where now |
| --- | --- | --- |
| Toolbar: "Builder actions" | kept as is | `src/builder/BuilderApp.vue` |
| Stage | kept as is | `src/builder/` |
| Shapes card | kept as is | `src/builder/` |
| Selected shape card | kept as is | `src/builder/` |
| Tile card | kept as is | `src/builder/` |
| Export card | kept as is | `src/builder/ExportPanel.vue` |

## 5. Behind the interface

| Feature | Status | Where now |
| --- | --- | --- |
| Link keys: Patterns | kept as is | `src/state-share.ts` |
| Link keys: Wallpaper Studio, all old keys | changed: new key `g` (genes). If no gene is set, the page does not write it. The old keys are read and written as before | `src/studio/studio-share.ts:74,112` |
| Link keys: Builder (none) | kept as is | `src/builder/` |
| Stored in the browser (`fp-shortcut`, `fp-builder-design-v1`, `fp-builder-snap-v1`, `fp-tab`, `fp-lib`) | kept as is. Breed stores nothing | `src/shortcuts.ts`, `src/builder/` |
| Export outputs: Patterns CSS, HTML, script and other formats, Studio CSS, Builder CSS, SVG and design file | kept as is. The Studio CSS is still one `.wallpaper` rule, and genes change only the SVG in it | `src/studio/compose.ts` |
| Speed and CO2 rules shown to visitors | kept as is. The footprint line reuses `formatFootprint` | `src/co2.ts:55` |

## New

| Feature | Status | Where now |
| --- | --- | --- |
| Studio genes and gallery: 20 named genes, values 0 to 15 or absent, threaded through the motif makers and `compose` (option `genes`, `composeColors(palette, genes)`). Design field `genes`. Link key `g` | new | `src/studio/genes.ts:7,36,43,62`, `src/studio/compose.ts:73,316,1057`, `src/studio/motifs.ts`, `src/studio/motifs-sea.ts`, `src/studio/motifs-orchard.ts`, `src/studio/studio-share.ts:51,74,112,130` |
| Breed panel: fold "Breed" between "Motif families" and "Your own motif", loaded on first open. Summary "N genes set" or "from this one" | new | `src/studio/StudioApp.vue:46-47,626-631`, `src/studio/BreedPanel.vue`, `src/studio/breed.ts`, `src/studio/breed.worker.ts` |
| Breed panel controls: 3 by 3 children as toggle buttons "Child N" or "Child N, growing". "More similar ↔ More different" slider. "Breed next generation", "Use the picked one", "Undo generation", "Clear genes". Polite status "Growing generation N: k of 9 ready.", "Generation N ready. …", "Child N is now the wallpaper.", "Back to generation N." | new | `src/studio/BreedPanel.vue:66,77,90,97,112-136,138` |
| Studio genes and gallery: generator `make gallery` writes the committed `public/gallery/studio.json` and thumbnails in `public/gallery/studio/` (not committed) | new | `src/studio/gallery.ts`, `scripts/studio-gallery.ts`, `Makefile:31`, `.gitignore:13` |
| Footer footprint line on all three pages: "This page so far: ≈ X mg CO₂ / visit · Y KB compressed. Counted from the files your browser loaded, with the same estimate as the size badge." ("measuring…" before the first count) | new | `src/components/PageFootprint.vue:89`, `src/css/app.css:124` |
