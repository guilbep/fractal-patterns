# Phase 5a feature check

This page checks every item of `FEATURES.md` against the code of branch `phase5a`, commit `242682f`.
The rule: every feature survives. Each item is "kept as is", "moved to …" or "changed: …".

Method. I read the diff `main..phase5a` (40 files) and every changed component.
For each item I searched the code for its label or its logic.
If phase 5a did not change a file and the text is still there, its items are "kept as is".
Line numbers are for commit `242682f`.

## Counts

| Status | Rows |
| --- | --- |
| Kept as is | 115 |
| Moved | 6 |
| Changed | 21 |
| Missing | 0 |

A row can group several small items with the same status.

## 1. Core

| Feature | Status | Where now |
| --- | --- | --- |
| Brand: logo and "Fractal Patterns" | changed: the logo is the Truchet tile, the name is the same | `src/components/SiteHeader.vue`, `src/logo.ts`, `src/app-name.ts:1` |
| Tool switch with marks, current page marked | changed: the Studio and Builder marks use the logo's ink and paper | `src/components/SiteHeader.vue:40`, `public/favicon-*.svg` |
| Narrow screens hide "Wallpaper", then marks, then "GitHub" below 420 px | kept as is | `src/css/site-header.css:110-143` |
| Tagline and "GitHub" link | kept as is | `src/components/SiteHeader.vue:46` |
| New "?" button that opens the keyboard panel | changed: new item in the header | `src/components/SiteHeader.vue:45`, `src/key-help.ts:91` |
| Palette carry-over with `pn` or `pc` | kept as is | `src/state-share.ts:156-161`, `src/studio/studio-share.ts:76-78` |
| Palette strip: previous, next, swatches, name, random dice | kept as is | `src/components/PaletteStrip.vue:19-23` |
| Full screen button "Full screen (F)", Esc, no-op without element full screen | kept as is | `src/App.vue:134`, `src/studio/StudioApp.vue:347`, `src/shortcuts.ts` |
| R and F keys | kept as is | `src/shortcuts.ts`, `src/App.vue`, `src/studio/StudioApp.vue:288` |
| Keys do nothing in a form field or with Ctrl, Cmd, Alt | changed: they also do nothing inside the keyboard panel dialog | `src/shortcuts.ts:37` |
| Off switch (WCAG 2.1.4), shared by two pages, key `fp-shortcut` | moved to the keyboard panel behind the "?" button | `src/key-help.ts:62-79`, `src/components/SiteHeader.vue:16-27`, `src/shortcuts.ts:3` |
| Corner hint "R shuffle · F full screen" or "exit full screen", shown with shortcuts on | kept as is | `src/components/ShortcutHint.vue:17`, `src/App.vue:157`, `src/studio/StudioApp.vue:359` |
| Corner hint hides on touch | kept as is | `src/css/shortcut-hint.css:40-43` |
| Undo and redo: Ctrl or Cmd + Z, Shift to redo, form fields keep text undo, disabled buttons | changed: the Studio now has them too | `src/App.vue:127-128`, `src/builder/BuilderApp.vue:67-68`, `src/studio/StudioApp.vue:279-287,341-342` |
| Patterns 50 steps and 300 ms, Builder 100 steps | kept as is | `src/history.ts:12`, `src/builder/store.ts`, Studio uses 50 and 300 ms in `src/studio/studio-history.ts:31` |
| Size badge, Patterns form | changed: one wording `[grade] N KB gz · ≈ x mg CO₂`, grade line, scale and breakdown in the tooltip | `src/components/SizeBadge.vue:45-55`, `src/co2.ts:107-114`, `src/App.vue:141` |
| Size badge, Studio and Builder form | changed: same wording as Patterns, "N bytes, M gzipped" and the scale moved into the tooltip | `src/components/SizeBadge.vue:35-38`, `src/studio/StudioApp.vue:349`, `src/builder/ExportPanel.vue` |
| "compressing" and "gzip size unknown" | kept as is | `src/co2.ts:108-109`, shown by `src/components/SizeBadge.vue:51` |
| Copy status line for screen readers, clears after about 2 s | kept as is | `src/App.vue:43-50`, `src/studio/StudioApp.vue:324`, `src/components/ExportActions.vue:23`, `src/builder/BuilderApp.vue:23-29` |
| Page failure texts, for example "Could not copy the link. …" | kept as is | `src/App.vue:51-52`, `src/studio/StudioApp.vue:324`, `src/components/ExportActions.vue:23` |
| Export actions block: "Download SVG", "Copy SVG", "Copy CSS", status, "CSS background" box | kept as is | `src/components/ExportActions.vue` |
| Toolbar stays in view, height measured | kept as is | `src/App.vue:99`, `src/studio/StudioApp.vue:332` |
| Toolbar order | changed: one shared order on the three pages (actions, stats, then copy and download) | `src/App.vue:123-148`, `src/studio/StudioApp.vue:338-355`, `src/builder/BuilderApp.vue:66-87` |
| Footer "Source on GitHub" and sponsor banner | kept as is | `src/App.vue:203`, `src/studio/StudioApp.vue:541`, `src/components/SponsorBanner.vue:7-8` |
| Dark mode follows the system | changed: new color tokens, same system rule | `src/css/app.css:32` |
| Reduced motion stops transitions and animations | kept as is | `src/css/app.css:970` |
| Touch: shortcut switch hides | changed: the switch is in the keyboard panel, which a touch visitor can open | `src/key-help.ts:62`, `src/css/site-header.css:101` |
| Touch: header targets grow to 44 px | kept as is, and the "?" button too | `src/css/site-header.css:101-108` |
| Text for visitors with JavaScript off | kept as is | `index.html:53`, `studio.html:53`, `builder.html:53` |
| Privacy notes "Use only images …" and "Your image stays …" | kept as is | `src/components/ImagePanel.vue:49-50`, `src/studio/StudioApp.vue:452-453` |
| New drop zone privacy line "Stays on your device. Nothing is uploaded." | changed: shown in the Patterns Image tab (next to the old notes) and the Builder, hidden in the Studio | `src/components/UiFileDrop.vue:37`, `src/studio/StudioApp.vue:457` |
| Color, radius and spacing tokens, button variants, shared switch and segmented control | changed: new shared styles | `src/css/app.css`, `src/css/controls.css`, `src/components/UiSwitch.vue`, `src/components/UiSegmented.vue` |

## 2. Patterns page

| Feature | Status | Where now |
| --- | --- | --- |
| "Shuffle" (primary), disabled for a traced image unless more pictures | kept as is | `src/App.vue:125` |
| "Random pattern", "Undo", "Redo", "Reset" | kept as is (secondary button style) | `src/App.vue:126-129` |
| "Copy CSS", "Copy link", "Download SVG" | moved to the third toolbar row, after the stats, order Copy CSS, Copy link, Download SVG | `src/App.vue:143-147` |
| Copy CSS failure "Copy failed. Copy the CSS from the Export tab." | kept as is | `src/App.vue:52` |
| File names `fractal-…`, `patchwork-…`, `traced-…` | kept as is | `src/state.ts:433-436` |
| Palette strip and full screen in the toolbar | kept as is | `src/App.vue:133-134` |
| Contrast chip, short form on narrow screens | kept as is | `src/App.vue:136-139` |
| Size badge | changed: see Core | `src/App.vue:141` |
| Preview uses the exported CSS, click shuffles, no text select | kept as is | `src/App.vue:154-170` |
| Heading and caption "Pattern: …" | kept as is | `src/App.vue:164` |
| Three plate modes | kept as is | `src/components/ColorPanel.vue:45` |
| "Pause motion" stops the drift | kept as is | `src/components/MotionPanel.vue:63` |
| Six tabs, arrow keys, session key `fp-tab`, Repetition dot | kept as is | `src/App.vue:63` |
| Image tab loads on first open | kept as is | `src/App.vue:31,193` |
| Library family tabs, counts, session key `fp-lib`, thumbnails as one radio group | kept as is | `src/components/PatternPanel.vue:21`, `src/fractal.ts:64` |
| Patchwork and image notes in the library | kept as is | `src/components/PatternPanel.vue:88-89` |
| Tile size presets, "Tile size", "Exported tile: W by H px" | kept as is | `src/components/PatternPanel.vue:111-116`, `src/sizes.ts:1` |
| "Seed" and "New seed", "Depth", "Stroke width" | kept as is | `src/components/PatternPanel.vue:125-136` |
| Fold "Patchwork": layout, grid size, families, frame lines, cell pins, "Clear pins" | kept as is | `src/components/PatternPanel.vue:142-173` |
| Shortcut switch under the Pattern panel | moved to the keyboard panel behind the "?" button | `src/key-help.ts:62-79`, old line removed at `src/App.vue:177` |
| Hints "Or click the pattern, or press R." and "Shuffle applies to math patterns only." | kept as is | `src/App.vue:177` |
| Repetition hints (Smooth curves, kind that cannot vary) | kept as is | `src/components/RepetitionPanel.vue:82-83` |
| "Reduce repetition" and "Turn on Seamless edges" | kept as is | `src/components/RepetitionPanel.vue:97` |
| Strength levels | kept as is | `src/variants.ts:42` |
| "Turn and flip each cell", "Mix two depths", Offset, Shift by, sliders, "Reset variants" | kept as is | `src/repetition-previews.ts:41,56-57`, `src/components/RepetitionPanel.vue:164` |
| "More ways to hide the repeat": second layer and its settings, parallax, "Reset second layer" | kept as is | `src/components/RepetitionPanel.vue:168-215` |
| "Soft fade", "Slow change across the page", "Faint end", "Different angle per section" | kept as is | `src/components/RepetitionPanel.vue:219-237` |
| Layout examples, "Random layout" | kept as is | `src/random-design.ts:55` |
| Spacing: Zoom, Gap, Mirror, "Reset spacing", "Not combined …" notes | kept as is | `src/components/SpacingPanel.vue:13` |
| Transform and motion: Rotate, Scale, Skew, Perspective tilt, Drift, Speed, "Reset transform" | kept as is | `src/components/MotionPanel.vue:47-64` |
| Drift energy note, WCAG 2.2.2 note, reduced-motion note | kept as is | `src/components/MotionPanel.vue:66-73` |
| Three color roles with picker, Hex field and error, palette chips "already used by X" | kept as is | `src/components/RoleInput.vue:61-72` |
| "Pattern opacity", "Fill closed shapes" | kept as is | `src/components/ColorPanel.vue:67-73` |
| "Adjusted: the X color …", "Swap background and text" | kept as is | `src/components/ColorPanel.vue:95-97` |
| Text plate modes, plate opacity, radius, blur | kept as is | `src/components/ColorPanel.vue:45,116` |
| Paragraph contrast, Pass or Fail, fix buttons, per-surface lines | kept as is | `src/components/ColorPanel.vue:135-159` |
| APCA Lc, "Raise to Lc N", "APCA guidance levels" fold | kept as is | `src/components/ColorPanel.vue:168-183` |
| Heading contrast line, nearly invisible warning, WCAG links note | kept as is | `src/components/ColorPanel.vue:204` |
| "Start from a palette" | kept as is | `src/components/ColorPanel.vue:218-220` |
| "Second opinion": lightness difference, color vision preview | kept as is | `src/components/VisionPanel.vue:51-54`, `src/vision.ts:31` |
| Image tab privacy notes | kept as is | `src/components/ImagePanel.vue:49-50` |
| "Try an example" with four samples | kept as is | `src/components/ImagePanel.vue:54`, `src/samples.ts:9` |
| Drop zone "Choose an image or drop it here", file button, drag highlight | changed: now the shared drop zone, same label, `image/*`, first file only, the button reads "Choose a file" | `src/components/ImagePanel.vue:65`, `src/components/UiFileDrop.vue:23-38` |
| Bad file messages | kept as is | `src/state.ts:163-167` |
| "More pictures for Reduce repetition", "Remove", limit message | kept as is | `src/components/ImagePanel.vue:68-80` |
| "Smooth curves" and its hints | kept as is | `src/components/ImagePanel.vue:85` |
| Image controls: math or image, "Remove image", detector, levels, detail, fit, resolution, seamless | kept as is | `src/components/ImagePanel.vue:93-138`, `src/detectors.ts:16` |
| Stats "Lines kept", "SVG size", no-line warning, notes | kept as is | `src/components/ImagePanel.vue:145-148` |
| Export "Performance settings": Depth link, precision, stats | kept as is | `src/components/OutputPanel.vue:28-31` |
| "Use it": Download SVG, CSS and HTML blocks | kept as is | `src/components/OutputPanel.vue:60` |
| Script option, "When", "Variants", "Copy script", byte line | kept as is | `src/components/OutputPanel.vue:65-89` |
| "Other formats (experimental)" | kept as is | `src/components/OutputPanel.vue:92-99` |
| Footer note on palettes and WCAG | kept as is | `src/App.vue:202` |

## 3. Wallpaper Studio

| Feature | Status | Where now |
| --- | --- | --- |
| "Shuffle" (primary) | kept as is | `src/studio/StudioApp.vue:340` |
| "Undo" and "Redo" | changed: new buttons and keys | `src/studio/StudioApp.vue:341-342`, `src/studio/studio-history.ts` |
| "Download SVG" `wallpaper-{repeat}-{seed}.svg` | moved to the end of the toolbar, after Copy CSS | `src/studio/StudioApp.vue:352`, file name at `:223` |
| "Copy CSS", label turns to "Copied" | moved after the size badge | `src/studio/StudioApp.vue:351` |
| Copy failure text and the CSS box | kept as is | `src/studio/StudioApp.vue:324,363-367` |
| Palette strip, full screen, size badge | kept as is (badge wording changed, see Core) | `src/studio/StudioApp.vue:346-349` |
| Preview label "Wallpaper preview, …" | kept as is | `src/studio/StudioApp.vue:360` |
| Shortcut hint, R and F | kept as is | `src/studio/StudioApp.vue:359` |
| Seed, Balance line, Theme, Palette, Density, Tile size, Preview zoom | kept as is | `src/studio/StudioApp.vue:376-406` |
| Options: Balance automatically, Ground layer, Large tile, Show stems | kept as is | `src/studio/StudioApp.vue:412-418` |
| Shortcut switch in the Design panel | moved to the keyboard panel behind the "?" button | `src/key-help.ts:62-79` |
| Repeat panel: Straight, Half-drop, Brick, Mirror | kept as is | `src/studio/StudioApp.vue:28-31` |
| Motif families, at least one on, summary | kept as is | `src/studio/motifs-sea.ts:16`, `src/studio/motifs-orchard.ts:11`, `src/studio/StudioApp.vue:215` |
| "Image" file input (images and SVG) | changed: now the shared drop zone, label "Image", `image/*,.svg`, also takes a dropped file | `src/studio/StudioApp.vue:457` |
| "Try a sample flower", bad file error | kept as is | `src/studio/StudioApp.vue:458-460` |
| Vector read note, "Not read" list, "Trace it as an image instead" | kept as is | `src/studio/StudioApp.vue:463-467` |
| Method, Colors, detector, threshold, line, detail, color, size | kept as is | `src/studio/StudioApp.vue:80-81` and the motif fields |
| "Sits on the stem by", "Use it as", "Smooth curves", "Keep the image's colors" | kept as is | `src/studio/StudioApp.vue:510-526` |
| Preview "N shapes, N bytes", "Remove my motif", "Your motif is not part of the link." | kept as is | `src/studio/StudioApp.vue:534-536` |

## 4. Builder

| Feature | Status | Where now |
| --- | --- | --- |
| "Undo", "Redo", "Start again", "Open an example", load error | kept as is (secondary style) | `src/builder/BuilderApp.vue:42,67-73` |
| Toolbar size badge, "Copy CSS" and "Download SVG" | changed: new in the toolbar, the Export card is unchanged | `src/builder/BuilderApp.vue:78-87`, `src/builder/builder-css.ts` |
| No palette strip, no full screen, no R or F | kept as is | `src/builder/BuilderApp.vue` |
| "Snap" and "Grid" (4, 8, 12, 16), key `fp-builder-snap-v1` | changed: a switch and a segmented control, same key and values | `src/builder/BuilderStage.vue:14-16,324-325` |
| Faint grid dots, dashed tile edge, veil on neighbors | kept as is | `src/builder/BuilderStage.vue:377-378,441` |
| Mouse and touch: select, drag, mirror drag, multi-select, rectangle, handle, Alt | kept as is | `src/builder/BuilderStage.vue` (not changed in 5a outside the snap bar and hint) |
| Keys: select all, N, P, arrows, Delete, D, F, [ ], minus and plus, Page Up and Down, Esc | kept as is, and also listed in the keyboard panel | `src/builder/BuilderStage.vue`, `src/key-help.ts:20-38` |
| Editor region with key help label | kept as is | `src/builder/BuilderStage.vue:337` |
| Live line "No shape selected", "{name}, shape k of n", "N shapes selected" | kept as is | `src/builder/BuilderStage.vue:255-258,393` |
| Focus outline | kept as is | `src/builder/BuilderStage.vue:427` |
| Hint under the stage | changed: the phone line is the same, the wide-screen key list is replaced by "Keyboard keys: see the ? button at the top." | `src/builder/BuilderStage.vue:394-395` |
| "In this tile", basic shapes | kept as is | `src/builder/StampPanel.vue:124` |
| "Studio drawings", "Loading…", "Other drawings" | kept as is | `src/builder/StampPanel.vue:134-144` |
| "Math patterns", Family, "Other variant" | kept as is | `src/builder/StampPanel.vue:148-165` |
| "Your own files": "Add SVG files or an image", several files | changed: now the shared drop zone, same label, `image/*,.svg`, multiple, also takes drops | `src/builder/StampPanel.vue:171` |
| Own files status: "Added N shapes.", "could not be read as shapes", "Over 5 MB, not read" | kept as is | `src/builder/StampPanel.vue:110-112` |
| Selected shape card: empty text, one shape, parts, several shapes | kept as is | `src/builder/ItemPanel.vue:66-113` |
| "Colors in this design", Duplicate, Delete, order buttons | kept as is | `src/builder/ItemPanel.vue:119-131` |
| Tile card: Width, Height, Repeat, Overlap, Background, Line width | kept as is | `src/builder/TilePanel.vue:15,145-157` |
| Fold "Fill the tile with a grid" and all its controls | kept as is | `src/builder/TilePanel.vue:163-229` |
| Export card: size badge, export actions, `pattern-builder.svg` | kept as is | `src/builder/ExportPanel.vue` |
| "CSS and design file": CSS box, design download and open, status texts | kept as is | `src/builder/ExportPanel.vue:29-55` |

## 5. Behind the interface

| Feature | Status | Where now |
| --- | --- | --- |
| Patterns link keys (`k`, `s`, `d`, … `fi`), defaults left out | kept as is (file not changed in 5a) | `src/state-share.ts` |
| Palette from another page `pn`, `pc` | kept as is | `src/state-share.ts:156-161` |
| Not in the link: pins, image, APCA target, script, open tab | kept as is | `src/state-share.ts` |
| Welcome design, pasted link applies and can be undone | kept as is | `src/state-share.ts`, `src/main.ts` |
| Studio link keys `s r d z st t f pn pc lg ba gr`, old `p` | kept as is (file not changed in 5a) | `src/studio/studio-share.ts:2-4,96` |
| Studio pasted link | changed: it also resets the new undo history | `src/studio/StudioApp.vue:248-252` |
| Builder: no link keys | kept as is | none |
| `fp-shortcut` | kept as is, now set from the keyboard panel | `src/shortcuts.ts:3` |
| `fp-builder-design-v1` | kept as is | `src/builder/store.ts:10` |
| `fp-builder-snap-v1` | kept as is | `src/builder/BuilderStage.vue:14` |
| `fp-tab`, `fp-lib` (session) | kept as is | `src/App.vue:63`, `src/components/PatternPanel.vue:21` |
| Patterns CSS, HTML, script and other formats | kept as is (files not changed in 5a) | `src/export.ts` |
| Studio CSS rule | kept as is | `src/studio/StudioApp.vue` |
| Builder CSS lines, SVG and design file | kept as is, the CSS moved to a shared module | `src/builder/builder-css.ts:8` |
| CO₂ line and weight grade scale, "not the Website Carbon rating" | kept as is, shown in the badge tooltip on all pages | `src/co2.ts:101-103` |
| Drift cost, byte comparisons, cost hints | kept as is | `src/components/MotionPanel.vue`, panels above |

## Missing

None found.

Search method: for each item I searched its exact label or key in `src`, `index.html`, `studio.html` and `builder.html`.
Every label was found, except two built from template strings ("Fix contrast for AA", "and N more parts").
I found those by their parts: `src/components/ColorPanel.vue:135` and `src/builder/ItemPanel.vue:111`.

## Points for the owner

These are not missing, but they change what a visitor sees.

- On touch devices the shortcut switch was hidden. Now it is in the keyboard panel, and a touch visitor can open that panel.
- The Patterns Image tab keeps its two old privacy notes. The drop zone's own line is hidden there (`hide-privacy`), as in the Studio, so the same fact is not said twice.
- The Studio and Builder badges no longer show "N bytes, M gzipped" on the page. That text is in the tooltip.
- The drop zone's `accept` filter does not apply to dropped files. The code that reads the file still checks it.

## Not checked by reading code

To make sure of these, a person must look in a browser.

- The size badge tooltip text, its position, and Esc to hide it.
- The keyboard panel: focus moves into it, Esc closes it, focus returns to the "?" button.
- The shortcut switch in the panel: its on or off state matches `fp-shortcut` after a reload.
- The corner hint hides on a real touch device.
- Drag highlight on the three drop zones, and a drop of a wrong file type in each.
- The toolbar order and wrapping at phone width on the three pages.
- The new color tokens in dark mode, and the contrast of the secondary buttons.
- The Truchet logo and the three favicons.
- The Builder Snap switch and the Grid segmented control with the keyboard.
- Studio undo and redo after a slider drag: one drag is one step.
