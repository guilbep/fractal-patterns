# Phase 7 feature check (Ornament engine)

This page checks every item of `FEATURES.md` against the code of branch `plan7-ornament`, commit `ba40fc1`.
The rule: every feature survives. Each item is "kept as is", "moved to …", "changed: …" or "new".

Method. I read the diff `9dbe39b..ba40fc1`. It holds 12 commits. One of them, `c58250f` ("Group the textures by weight"), is not part of phase 7. It changes only `src/components/TexturePanel.vue` and `e2e/texture-groups.spec.ts`, so this page leaves those two files out. Phase 7 is then 11 commits and 38 files.
The diff adds four engine files in `src/patterns/` (`tilings.ts`, `stars.ts`, `regions.ts`, `interlace.ts`).
It adds two loaders (`src/regions-tile.ts`, `src/interlace-tile.ts`) and two controls (`RegionsControl.vue`, `InterlaceControl.vue`).
It adds their tests and three e2e specs.
It changes 8 old source files.
The UI files: `src/components/PatternPanel.vue`, `src/components/ImagePanel.vue` (one line).
The logic files: `src/fractal.ts`, `src/state.ts`, `src/state-share.ts`, `src/share.ts`, `src/pairing.ts`, `src/preferred.ts`.
For each changed file I read every hunk and checked that no label, state, key or output was removed. Every hunk adds lines or widens a type. No old line loses a label, key or output.
Seven old e2e specs changed. Six only add `exact: true` to the "Pattern" tab locator, because the new family tab "Star patterns" also contains the word "Pattern". The tab itself is not renamed. One spec (`e2e/color-symmetry-wheel.spec.ts`) also changes line breaks only.
The diff does not touch `src/studio/` or the Builder source. It changes one Builder test (`src/builder/pattern-stamps.test.ts`): the Math patterns fold now has 85 patterns, and the 65 old paths stay the same.
An item in a file that the diff does not touch is "kept as is", with no line cited.

With the new features off, four checks hold the Patterns page unchanged:

- Region colours and interlace are off by default. The contact angle shows only for a star kind.
- With them off, the link writes no new key. `snapshot()` in `src/state-share.ts` adds `angle` only for a star kind at a non-default angle, `regions` only when not "Off", and `interlace` only when on. `encodeDesign` in `src/share.ts` writes `ca`, `rc`, `rk`, `il`, `iw`, `ig` only from these fields. Old links open the same: `decodeDesign` gives no `regions` without `rc=1|2`, no `interlace` without `il=1`, and the default angle for other kinds.
- With them off, the tile SVG is the old one: `tileSvg` in `src/state.ts` adds region paths or ribbons only when they are not empty.
- With them off, the contrast surfaces are the old ones: the new branch needs `r.regions?.length` (`src/pairing.ts`), and `checkedRoles.regions` is null when there are no regions and no ribbons.

## Counts

| Status     | Rows |
| ---------- | ---- |
| Kept as is | 39   |
| Moved      | 0    |
| Changed    | 4    |
| New        | 5    |
| Missing    | 0    |

A row can group several small items with the same status.

## 1. Core

| Feature | Status | Where now |
| --- | --- | --- |
| Site header (Patterns, Studio, Builder): brand, tool switch, narrow screens, tagline, "GitHub", palette carry-over with `pn` or `pc` | kept as is | `src/components/SiteHeader.vue` |
| Palette strip (Patterns toolbar, Studio toolbar, Builder fill fold) | kept as is | `src/components/PaletteStrip.vue` |
| Full screen (Patterns, Studio) | kept as is | `src/shortcuts.ts` |
| Single-key shortcuts (Patterns, Studio): R, F, off switch, corner hint | kept as is | `src/shortcuts.ts` |
| Undo and redo (Patterns, Builder) | kept as is. The Patterns history stores the design. The design now carries the angle, region colours and interlace when set | `src/history.ts`, `src/state-share.ts` |
| Size, weight grade and CO2 badge (all three pages) | kept as is. The tile SVG holds the regions or ribbons when on, so the badge counts their bytes. No line of the badge changed | `src/components/SizeBadge.vue`, `src/state-export.ts` |
| Copy feedback (all three pages) | kept as is | `src/App.vue`, `src/studio/StudioApp.vue`, `src/components/ExportActions.vue` |
| Export actions block (Builder) | kept as is | `src/components/ExportActions.vue` |
| Layout and platform: sticky toolbar, footer, footprint line, dark mode, reduced motion, touch, JavaScript-off text, privacy notes | kept as is. The Image tab adds a third note (see Changed, Image tab) | `src/css/app.css`, `src/components/PageFootprint.vue` |

## 2. Patterns page

`src/App.vue` is not in the diff. No old control was removed or renamed.

| Feature | Status | Where now |
| --- | --- | --- |
| Toolbar: "Design actions" | kept as is | `src/App.vue` |
| Preview (the hero) | kept as is. It still shows the exported CSS. The caption names a star kind like any kind, for example "4.8.8 stars" | `src/App.vue` |
| Tabs | kept as is. The tab is still named "Pattern" | `src/App.vue` |
| Pattern tab | changed: the Library has a seventh family tab "Star patterns" with 5 kinds. "All" is now 85. It was 80 before this phase. `FEATURES.md` v2.5.0 says 78. Under "Stroke width", a "Contact angle" slider for star kinds. Under the sliders, the "Color each region" and "Interlace" cards (see New). All old controls stay | `src/fractal.ts`, `src/components/PatternPanel.vue` |
| Color symmetry (Pattern tab, Symmetry groups) | kept as is. With Color symmetry on, the region and interlace cards say why they are off | `src/components/ColorSymmetryPanel.vue` |
| Repetition tab | kept as is. With Reduce repetition on, the region and interlace cards say why they are off | `src/components/RepetitionPanel.vue` |
| Layout tab | kept as is | `src/components/` |
| Colors tab: "Colors and contrast" | changed: the contrast check adds each region colour as a surface, bare and under a stroke, seen through the plate. With interlace on, it adds the ribbon fill at the stroke opacity over the background. With both off, the surfaces are the old ones | `src/pairing.ts`, `src/state.ts` (`checkedRoles`) |
| Texture (Colors tab, under Background) | kept as is. Phase 7 does not change it. (`c58250f` groups the kinds by weight, outside this phase) | `src/components/TexturePanel.vue` |
| Image tab: "From image" | changed: a third note "You can trace an image made with any tool, AI included." between the two privacy notes. The two privacy notes stay | `src/components/ImagePanel.vue:53` |
| Export tab | kept as is. The SVG tile in the CSS, HTML and download holds the regions and ribbons when on | `src/state-export.ts`, `src/state.ts` |
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
| Breed panel | kept as is | `src/studio/BreedPanel.vue`, `src/studio/breed.worker.ts` |
| Your own motif panel | kept as is | `src/studio/StudioApp.vue` |

## 4. Builder (builder.html)

The Builder source is not in the diff.

| Feature | Status | Where now |
| --- | --- | --- |
| Toolbar: "Builder actions" | kept as is | `src/builder/BuilderApp.vue` |
| Stage | kept as is | `src/builder/` |
| Shapes card | changed: the "Math patterns" fold lists the 5 star kinds too, at the default contact angle, so 85 patterns. The 65 old stamp paths are the same (`src/builder/pattern-stamps.test.ts`) | `src/builder/pattern-stamps.ts`, `src/fractal.ts` |
| Selected shape card | kept as is | `src/builder/` |
| Tile card | kept as is | `src/builder/` |
| Export card | kept as is | `src/builder/ExportPanel.vue` |

## 5. Behind the interface

| Feature | Status | Where now |
| --- | --- | --- |
| Link keys: Patterns, all old keys | kept as is. The new keys `ca`, `rc`, `rk`, `il`, `iw`, `ig` are written only when set (see New) | `src/share.ts` |
| Link keys: Wallpaper Studio | kept as is | `src/studio/studio-share.ts` |
| Link keys: Builder (none) | kept as is | `src/builder/` |
| Stored in the browser (`fp-shortcut`, `fp-builder-design-v1`, `fp-builder-snap-v1`, `fp-tab`, `fp-lib`) | kept as is. Phase 7 stores nothing new in the browser. `fp-lib` can now hold the value of the new family tab | `src/shortcuts.ts`, `src/library.ts`, `src/builder/` |
| Export outputs: Patterns CSS, HTML, script and other formats, Studio CSS, Builder CSS, SVG and design file | kept as is. With region colours on, the tile SVG draws the regions under the lines. With interlace on, the ribbons replace the lines. Off, the SVG is the old one | `src/state.ts` (`tileSvg`) |
| Speed and CO2 rules shown to visitors | kept as is | `src/co2.ts` |
| Studio genes and gallery | kept as is | `src/studio/genes.ts`, `src/studio/gallery.ts` |

## Moved

Nothing moved in phase 7.

## New

| Feature | Status | Where now |
| --- | --- | --- |
| Star patterns: the family "Star patterns". It has 5 kinds: `star-square`, `star-hex`, `star-488`, `star-3636`, `star-4612`. They draw Hankin stars on 5 periodic tilings. (state: a star kind, no image, no patchwork) "Contact angle" 20 to 85°, default 78 | new | `src/patterns/tilings.ts`, `src/patterns/stars.ts`, `src/fractal.ts`, `src/components/PatternPanel.vue` |
| Color each region (Pattern tab): "Off", "By shape", "Neighbours differ". (state: on) "Colors" 2, 3 or 4 with swatches. (state: colours not enough) "N colors are not enough here: neighbours may share a color." (state: too many or too slow) "N regions are too many to color: lines only." or "Finding the regions took N ms, too slow: lines only." (state: not available) a reason line for an image, a patchwork, Color symmetry, Reduce repetition, or the Penrose arcs. The code loads with the first coloured tile | new | `src/components/RegionsControl.vue`, `src/patterns/regions.ts`, `src/regions-tile.ts`, `src/state.ts` |
| Over-under interlace (Pattern tab): the "Interlace" switch, hint "Lines pass over and under in turn at every crossing." (state: on) "Ribbon width" 2 to 16 px, shown "auto · N px" by crossing density at the default, "Gap" 0 to 8 px. (state: some strands cannot alternate) "N strands cannot alternate here; they are drawn without gaps." (state: not available) a reason line, also "Interlace draws lines only; set the fill to none to use it." and "Interlace needs crossing lines; this pattern's lines only touch." The ribbon fill is the accent or the background, whichever differs more from the stroke. The code loads on demand | new | `src/components/InterlaceControl.vue`, `src/patterns/interlace.ts`, `src/interlace-tile.ts`, `src/state.ts` |
| Link keys `ca` (contact angle, star kinds only, not at 78), `rc` (1 by shape, 2 neighbours differ), `rk` (colour count, not at 4), `il` (1), `iw` (ribbon width, not at 6), `ig` (gap, not at 1.5). Undo and redo carry them. Reset clears them | new | `src/share.ts`, `src/state-share.ts`, `src/state.ts` |
| Image tab note "You can trace an image made with any tool, AI included." | new | `src/components/ImagePanel.vue:53` |
