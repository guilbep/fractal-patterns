# Textures feature check

This page checks every item of `FEATURES.md` against the code of branch `textures`, commit `185c988`.
The rule: every feature survives. Each item is "kept as is", "moved to …", "changed: …" or "new".

Method. I read the diff `ad7c1a6..185c988` (12 commits, 35 files).
The diff adds new files (`src/texture.ts`, `src/textures/*`, `src/draw-cost.ts`, `src/components/TexturePanel.vue`, `docs/research/textures-baseline.md`, `docs/review/draw-cost-formula.md`) and their tests.
It changes 10 old source files and two e2e specs.
The UI files: `src/App.vue` (one line), `src/components/ColorPanel.vue`, `src/components/RepetitionPanel.vue`, `src/css/repetition.css`.
The logic files: `src/heavy/tasks.ts` (one task), `src/state.ts`, `src/state-share.ts`, `src/state-export.ts`, `src/share.ts`, `src/pairing.ts`.
For each changed file I read every hunk and checked that no label, state, key or output was removed.
The diff does not touch `src/studio/` or `src/builder/`.
An item in a file that the diff does not touch is "kept as is", with no line cited.
Line numbers are for commit `185c988`.

Grain is not in `FEATURES.md` v2.5.0. It came in a later phase. This phase moves it, so this page lists it under "Moved", and the Textures phase adds it to `FEATURES.md` with the move note.

Four checks hold the Patterns page unchanged with no texture:

- The default is "None": grain off and texture off. The visitor must pick a texture.
- With no texture other than grain, the link writes no new key. The design leaves `texture` out (`src/state-share.ts`, "Off (or grain, which travels as gr) leaves it out"). For a texture other than grain, the page writes `te` (`src/share.ts:160,363`). Otherwise it writes no `te`.
- Grain still travels as `gr`. Every old grain link opens byte-identically. `src/state-texture.test.ts` pins this. A link with both `te` and `gr` keeps `te` and drops `gr` (`src/share.ts:470`).
- With no texture, the contrast surfaces are the old ones: the new branch needs `r.texture?.length` (`src/pairing.ts:57`).

## Counts

| Status     | Rows |
| ---------- | ---- |
| Kept as is | 38   |
| Moved      | 1    |
| Changed    | 3    |
| New        | 4    |
| Missing    | 0    |

A row can group several small items with the same status.

## 1. Core

| Feature | Status | Where now |
| --- | --- | --- |
| Site header (Patterns, Studio, Builder): brand, tool switch, narrow screens, tagline, "GitHub", palette carry-over with `pn` or `pc` | kept as is | `src/components/SiteHeader.vue` |
| Palette strip (Patterns toolbar, Studio toolbar, Builder fill fold) | kept as is | `src/components/PaletteStrip.vue` |
| Full screen (Patterns, Studio) | kept as is | `src/shortcuts.ts` |
| Single-key shortcuts (Patterns, Studio): R, F, off switch, corner hint | kept as is | `src/shortcuts.ts` |
| Undo and redo (Patterns, Builder) | kept as is. The Patterns history stores the design. If a texture is on, the design carries it | `src/history.ts`, `src/state-share.ts` |
| Size, weight grade and CO2 badge (all three pages) | changed: on Patterns the grade chip tooltip adds "Once: N kB". With a live layer (grain or a live texture) it adds "While visible: none/low/high, ≈ X mg CO₂ per minute (estimate, measured on this device)", or "While visible: measuring…" first. With a texture it adds "Texture: {name}, {route} X KB". All old lines stay. When the page is idle, the cost model loads | `src/state-export.ts:216,225`, `src/draw-cost.ts:46` |
| Copy feedback (all three pages) | kept as is | `src/App.vue`, `src/studio/StudioApp.vue`, `src/components/ExportActions.vue` |
| Export actions block (Builder) | kept as is | `src/components/ExportActions.vue` |
| Layout and platform: sticky toolbar, footer, footprint line, dark mode, reduced motion, touch, JavaScript-off text, privacy notes | kept as is | `src/css/app.css`, `src/components/PageFootprint.vue` |

## 2. Patterns page

`src/App.vue` changes one line: the Repetition panel can open the Colors tab. No old control was removed or renamed, except the grain controls, which moved (see Moved).

| Feature | Status | Where now |
| --- | --- | --- |
| Toolbar: "Design actions" | kept as is | `src/App.vue` |
| Preview (the hero) | kept as is. It still shows the exported CSS. With a texture, the CSS draws it between the background and the pattern | `src/App.vue` |
| Tabs | kept as is | `src/App.vue` |
| Pattern tab | kept as is | `src/components/PatternPanel.vue` |
| Color symmetry (Pattern tab, Symmetry groups) | kept as is | `src/components/ColorSymmetryPanel.vue` |
| Repetition tab | changed: the grain switch and its controls left "More ways to hide the repeat". In their place: "Grain moved to Colors › Texture." with an "Open Colors" button. All other controls stay | `src/components/RepetitionPanel.vue:317` |
| Layout tab | kept as is | `src/components/` |
| Colors tab: "Colors and contrast" | changed: under "Background", the "Texture" group (see New). The contrast check adds each texture color as a surface: the darkest or lightest of a baked texture, or the stated bounds of a live or vector one. With no texture, the surfaces are the old ones | `src/components/ColorPanel.vue:84`, `src/pairing.ts:57` |
| Image tab: "From image" | kept as is | `src/components/ImagePanel.vue` |
| Export tab | kept as is. The stats use the same size breakdown, so they show the new lines too | `src/state-export.ts` |
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

`src/builder/` is not in the diff.

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
| Link keys: Patterns, all old keys | kept as is. `gr` (grain) is unchanged. The new key `te` comes last. With no texture other than grain, the page does not write it (see New) | `src/share.ts:160` |
| Link keys: Wallpaper Studio | kept as is. Its `gr` (ground) is a Studio key, not the grain | `src/studio/studio-share.ts` |
| Link keys: Builder (none) | kept as is | `src/builder/` |
| Stored in the browser (`fp-shortcut`, `fp-builder-design-v1`, `fp-builder-snap-v1`, `fp-tab`, `fp-lib`) | kept as is. Textures store nothing in the browser | `src/shortcuts.ts`, `src/builder/` |
| Export outputs: Patterns CSS, HTML, script and other formats, Studio CSS, Builder CSS, SVG and design file | kept as is. A texture takes the grain's slot in the CSS: background < texture < pattern < accent. The SVG and PNG draw the texture at the file's tile size | `src/state-export.ts`, `src/state.ts` |
| Speed and CO2 rules shown to visitors | kept as is. The new "Once" and "While visible" lines are added (see Core) | `src/co2.ts`, `src/draw-cost.ts` |
| Studio genes and gallery | kept as is | `src/studio/genes.ts`, `src/studio/gallery.ts` |

## Moved

| Feature | Status | Where now |
| --- | --- | --- |
| Grain (was Repetition › "More ways to hide the repeat"): the "Grain" choice with the hint "A fine noise behind the pattern. Its own repeat hides the tile's.", "Amount" N %, "Size" fine / medium / coarse, "Tone" Dark / Light, the line "A N px tile, about N bytes. The contrast check counts its darkest or lightest specks.", link key `gr`, the Repetition tab summary word "grain" | moved to Colors › Background › Texture. Same ids (`grain`, `grain-amount`, `grain-size`, `grain-tone`, `grain-hint`) and labels. The switch is now the radio "Grain" in the Texture list. The hint now starts "Grain: ". The e2e specs `e2e/grain.spec.ts` and `e2e/css-colors.spec.ts` changed their selectors on purpose | `src/components/TexturePanel.vue` |

## New

| Feature | Status | Where now |
| --- | --- | --- |
| Texture (Colors tab, under Background): "Texture" with "None" and 11 kinds: "Grain", "Paper", "Cold-press", "Linen", "Plaster", "Washi", "Kraft", "Sand", "Riso", "Terrazzo", "Stipple". One layer at a time. Loaded on demand. (state: a texture other than grain) "Strength" 0 to 100 %, "Scale" 0.5 to 2× in quarter steps, "Seed N" with "Another", "Tone" Dark / Light (not for Washi, Kraft, Terrazzo, Stipple), "Route" "Baked" / "Live" (Paper, Cold-press, Linen, Plaster, Sand, Riso), "Bake it" (state: live, a baked route exists), a polite status "Baking…" | new | `src/components/TexturePanel.vue`, `src/texture.ts` |
| Link key `te`: `kind.strength.quarters.seed.tone.route`. Written only for a texture other than grain. Undo and redo carry it. A link with `te` and `gr` keeps `te` | new | `src/share.ts:160,470`, `src/state-share.ts`, `src/texture.ts` |
| Size badge lines "Once: N kB" and "While visible: none/low/high, ≈ X mg CO₂ per minute (estimate, measured on this device)", and "Texture: {name}, {route} X KB". The formula is in `docs/review/draw-cost-formula.md` | new | `src/draw-cost.ts`, `src/state-export.ts:216,225` |
| Texture engines: surfaces (paper, coldpress, linen, plaster, sand, riso) on periodic noise, fibers (washi, kraft), vector (terrazzo, stipple), live SVG filters, and WebP baking in the shared heavy worker (task `bakeTexture`) | new | `src/textures/`, `src/heavy/tasks.ts:10` |
