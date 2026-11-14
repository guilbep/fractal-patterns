# Phase 5a feature check

This page checks every item of `FEATURES.md` against the code of branch `phase5a`, commit `3ae45b0`.
The rule: every feature survives. Each item is "kept as is", "moved to …", "changed: …" or "new".

Method. I read the diff `main..phase5a` (40 files) and every changed component.
For each item I searched the code for its label or its logic.
If phase 5a did not change a file and the text is still there, its items are "kept as is".

Update after the design pass. The first check was for commit `242682f`.
After it, the header, the toolbar, the Patterns preview and Pattern tab, the Studio controls and the Builder sections were rebuilt to match the design canvas.
I read the diff `242682f..3ae45b0` (30 files) and updated each row it touches.
Line numbers in the rows this update touched are for commit `3ae45b0`.
The other rows keep the numbers of commit `242682f`. Their files changed little or not at all, but a number can be off by a few lines.

## Counts

| Status | Rows |
| --- | --- |
| Kept as is | 92 |
| Moved | 11 |
| Changed | 49 |
| New | 6 |
| Missing | 0 |

A row can group several small items with the same status.

## 1. Core

| Feature | Status | Where now |
| --- | --- | --- |
| Brand: logo and "Fractal Patterns" | changed: the logo is the Truchet tile, the name is the same | `src/components/SiteHeader.vue`, `src/logo.ts`, `src/app-name.ts:1` |
| Tool switch with marks, current page marked | changed: a segmented control with words only, no marks; the current page is still marked with `aria-current="page"` | `src/components/SiteHeader.vue:38-42`, `src/css/site-header.css:53` |
| Narrow screens hide "Wallpaper", then marks, then "GitHub" below 420 px | changed: the tagline hides below 800 px; below 600 px "Wallpaper" and "GitHub" hide and the name "Fractal Patterns" stays for screen readers only; there are no marks to hide | `src/css/site-header.css:105-140` |
| Tagline and "GitHub" link | kept as is, "GitHub" is now the last item, after the "?" button | `src/components/SiteHeader.vue:43,45` |
| "?" button that opens the keyboard panel | changed: new item in the header, now a round button next to "GitHub" | `src/components/SiteHeader.vue:44`, `src/key-help.ts:91` |
| Palette carry-over with `pn` or `pc` | kept as is | `src/state-share.ts:156-161`, `src/studio/studio-share.ts:76-78` |
| Palette strip: previous, next, swatches, name, random dice | changed: one toolbar group in the order ‹, swatches, name, ›, dice; the dice is an icon; the swatches show the palette name as a tooltip | `src/components/PaletteStrip.vue:20-24` |
| Full screen button "Full screen (F)", Esc, no-op without element full screen | moved to the preview corner on Patterns and Studio, same F key and same title "Full screen (F)" | `src/App.vue:196`, `src/studio/StudioApp.vue:405`, `src/shortcuts.ts` |
| R and F keys | kept as is | `src/shortcuts.ts`, `src/App.vue`, `src/studio/StudioApp.vue:288` |
| Keys do nothing in a form field or with Ctrl, Cmd, Alt | changed: they also do nothing inside the keyboard panel dialog | `src/shortcuts.ts:37` |
| Off switch (WCAG 2.1.4), shared by two pages, key `fp-shortcut` | moved to the keyboard panel behind the "?" button | `src/key-help.ts:62-79`, `src/components/SiteHeader.vue:16-27`, `src/shortcuts.ts:3` |
| Corner hint "R shuffle · F full screen" or "exit full screen", shown with shortcuts on | kept as is | `src/components/ShortcutHint.vue:17`, `src/App.vue:157`, `src/studio/StudioApp.vue:359` |
| Corner hint hides on touch | kept as is | `src/css/shortcut-hint.css:40-43` |
| Undo and redo: Ctrl or Cmd + Z, Shift to redo, form fields keep text undo, disabled buttons | changed: the Studio now has them too; on the three pages they are icon buttons with `aria-label` "Undo" and "Redo" and the key in the title | `src/App.vue:150-151`, `src/builder/BuilderApp.vue:77-78`, `src/studio/StudioApp.vue:283,380-381` |
| Patterns 50 steps and 300 ms, Builder 100 steps | kept as is | `src/history.ts:12`, `src/builder/store.ts`, Studio uses 50 and 300 ms in `src/studio/studio-history.ts:31` |
| Size badge, Patterns form | changed: one wording `[grade] 6.6 kB · 1.3 mg CO₂` (compressed size in kB with one decimal); the raw and gzip bytes, the grade line, the scale and the breakdown are in the tooltip; the screen reader text says "Weight grade …, N kilobytes compressed, …" | `src/components/SizeBadge.vue:40-56`, `src/co2.ts:105-115`, `src/App.vue:162` |
| Size badge, Studio and Builder form | changed: same wording as Patterns, "N bytes, M gzipped" and the scale moved into the tooltip | `src/components/SizeBadge.vue:35-38`, `src/studio/StudioApp.vue:387`, `src/builder/BuilderApp.vue:88`, `src/builder/ExportPanel.vue` |
| "compressing" and "gzip size unknown" | kept as is; the grade chip keeps its place while compressing, so the text does not move | `src/co2.ts:108-109`, shown by `src/components/SizeBadge.vue:50-52` |
| Copy status line for screen readers, clears after about 2 s | kept as is | `src/App.vue:43-50`, `src/studio/StudioApp.vue:324`, `src/components/ExportActions.vue:23`, `src/builder/BuilderApp.vue:23-29` |
| Page failure texts, for example "Could not copy the link. …" | kept as is | `src/App.vue:51-52`, `src/studio/StudioApp.vue:324`, `src/components/ExportActions.vue:23` |
| Export actions block: "Download SVG", "Copy SVG", "Copy CSS", status, "CSS background" box | kept as is | `src/components/ExportActions.vue` |
| Toolbar stays in view, height measured | kept as is | `src/App.vue`, `src/studio/StudioApp.vue:365-368` |
| Toolbar order | changed: three groups on the three pages: make (Shuffle, Undo, Redo, Reset or Start again, palette), stats, then out ("Copy link" on Patterns, "Download SVG", "Copy CSS", "Use it…") | `src/App.vue:146-172`, `src/studio/StudioApp.vue:377-395`, `src/builder/BuilderApp.vue:75-98` |
| "Copy link" and "Download SVG" buttons | changed: quiet buttons, icon only below 1536 px with a tooltip; the words stay the accessible name | `src/App.vue:166-167`, `src/studio/StudioApp.vue:390`, `src/builder/BuilderApp.vue:92`, `src/css/app.css:356-365` |
| Footer "Source on GitHub" and sponsor banner | kept as is | `src/App.vue:203`, `src/studio/StudioApp.vue:541`, `src/components/SponsorBanner.vue:7-8` |
| Dark mode follows the system | changed: new color tokens, same system rule | `src/css/app.css:32` |
| Reduced motion stops transitions and animations | kept as is | `src/css/app.css:970` |
| Touch: shortcut switch hides | changed: the switch is in the keyboard panel, which a touch visitor can open | `src/key-help.ts:62`, `src/css/site-header.css:101` |
| Touch: header targets grow to 44 px | kept as is, and the "?" button too | `src/css/site-header.css:101-108` |
| Text for visitors with JavaScript off | kept as is | `index.html:53`, `studio.html:53`, `builder.html:53` |
| Privacy notes "Use only images …" and "Your image stays …" | kept as is | `src/components/ImagePanel.vue:49-50`, `src/studio/StudioApp.vue:452-453` |
| New drop zone privacy line "Stays on your device. Nothing is uploaded." | changed: shown in the Patterns Image tab (next to the old notes) and the Builder, hidden in the Studio | `src/components/UiFileDrop.vue:37`, `src/studio/StudioApp.vue:457` |
| Color, radius and spacing tokens, button variants, shared switch and segmented control | changed: new shared styles; a segmented option that is not available now shows muted, not struck through | `src/css/app.css`, `src/css/controls.css`, `src/components/UiSwitch.vue`, `src/components/UiSegmented.vue` |

## 2. Patterns page

| Feature | Status | Where now |
| --- | --- | --- |
| "Shuffle" (primary), disabled for a traced image unless more pictures | kept as is | `src/App.vue:125` |
| "Random pattern", "Undo", "Redo", "Reset" | changed: "Random pattern" keeps its words; Undo, Redo and Reset are icon buttons with `aria-label` and a title | `src/App.vue:149-152` |
| "Copy CSS", "Copy link", "Download SVG" | moved to the out group at the end of the toolbar, order Copy link, Download SVG, Copy CSS | `src/App.vue:166-168` |
| Copy CSS failure "Copy failed. Copy the CSS from the Export tab." | kept as is | `src/App.vue:52` |
| File names `fractal-…`, `patchwork-…`, `traced-…` | kept as is | `src/state.ts:433-436` |
| Palette strip and full screen in the toolbar | moved: the palette strip stays in the toolbar; full screen moved to the preview corner (see Core) | `src/App.vue:154,196` |
| Contrast chip, short form on narrow screens | changed: the visible form is short on every width, for example "✓ 14.1:1 · AA" or "✕ … · fails AA" (one decimal, rounded down); the long sentence "Contrast N:1 AA pass" stays for screen readers | `src/App.vue:158-162`, `src/state.ts:528-531` |
| Size badge | changed: see Core | `src/App.vue:162` |
| Preview uses the exported CSS, click shuffles, no text select | kept as is | `src/App.vue:176-189` |
| Heading and caption "Pattern: …" | changed: the visible caption is short, "{Kind} · {size} px · seed {seed}" (a traced image has no seed); the old sentence "Pattern: …" stays visually hidden for screen readers | `src/App.vue:45-48,190-193` |
| Three plate modes | kept as is | `src/components/ColorPanel.vue:45` |
| "Pause motion" stops the drift | kept as is | `src/components/MotionPanel.vue:63` |
| Six tabs, arrow keys, session key `fp-tab`, Repetition dot | changed: underline tabs, same six tabs, keys and session key | `src/App.vue:201`, `src/css/app.css:501-528` |
| Image tab loads on first open | kept as is | `src/App.vue:31,193` |
| Pattern tab heading "Pattern" and legend "Library" | changed: both are visually hidden; the tab names the panel on screen | `src/components/PatternPanel.vue:86,88` |
| Library family tabs, counts, session key `fp-lib`, thumbnails as one radio group | changed: the family tabs are pills, the thumbnails are cards with a check mark on the picked one; same radio group and key | `src/components/PatternPanel.vue:21,91-104`, `src/css/library.css`, `src/fractal.ts:64` |
| Patchwork and image notes in the library | kept as is | `src/components/PatternPanel.vue:88-89` |
| Tile size presets, "Tile size", "Exported tile: W by H px" | changed: in one settings card; the presets are first (legend "Tile size"), the slider and the "Exported tile" line come after Seed | `src/components/PatternPanel.vue:110-132`, `src/sizes.ts:1` |
| "Seed" and "New seed", "Depth", "Stroke width" | changed: same controls in the settings card, order Depth, Seed, Tile size, Stroke width | `src/components/PatternPanel.vue:115-137` |
| Fold "Patchwork": layout, grid size, families, frame lines, cell pins, "Clear pins" | kept as is, shown as a card | `src/components/PatternPanel.vue:140-173` |
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
| "Use it": Download SVG, CSS and HTML blocks | kept as is; the new toolbar button "Use it…" opens the Export tab and moves focus to its tab | `src/components/OutputPanel.vue:60`, `src/App.vue:103-108,169` |
| Script option, "When", "Variants", "Copy script", byte line | kept as is | `src/components/OutputPanel.vue:65-89` |
| "Other formats (experimental)" | kept as is | `src/components/OutputPanel.vue:92-99` |
| Footer note on palettes and WCAG | kept as is | `src/App.vue:202` |

## 3. Wallpaper Studio

| Feature | Status | Where now |
| --- | --- | --- |
| "Shuffle" (primary) | kept as is | `src/studio/StudioApp.vue:340` |
| "Undo" and "Redo" | changed: new icon buttons and keys | `src/studio/StudioApp.vue:380-381`, `src/studio/studio-history.ts` |
| "Download SVG" `wallpaper-{repeat}-{seed}.svg` | moved to the out group, a quiet button before Copy CSS (see Core) | `src/studio/StudioApp.vue:390`, file name at `:223` |
| "Copy CSS", label turns to "Copied" | moved to the out group after the size badge | `src/studio/StudioApp.vue:391` |
| Copy failure text and the CSS box | kept as is; the new "Use it…" button shows the CSS box, scrolls to it and focuses it | `src/studio/StudioApp.vue:326,357-363,392,408-412` |
| Palette strip, full screen, size badge | moved: the palette strip and the badge stay in the toolbar (badge wording changed, see Core); full screen moved to the preview corner | `src/studio/StudioApp.vue:384,387,405` |
| Preview label "Wallpaper preview, …" | kept as is | `src/studio/StudioApp.vue:400` |
| Shortcut hint, R and F | kept as is | `src/studio/StudioApp.vue:399` |
| Preview chips | new: a caption chip "{Theme} · seed N · N px" and the balance chip in the preview corner | `src/studio/StudioApp.vue:401-404` |
| Balance line | moved to the balance chip in the preview corner, same text and tooltip | `src/studio/StudioApp.vue:403` |
| Theme | changed: picture cards; the select became a radio group with the same themes and hint | `src/studio/StudioApp.vue:418-428` |
| Seed | changed: a "↻" button next to the field shuffles (accessible name "Shuffle") | `src/studio/StudioApp.vue:429-435` |
| Tile size | changed: presets 200, 300, 400, 500 as a segmented control, plus the slider | `src/studio/StudioApp.vue:343,445-449` |
| Palette, Density, Preview zoom | kept as is | `src/studio/StudioApp.vue:436-457` |
| Options: Balance automatically, Ground layer, Large tile, Show stems | changed: a folded section "Options" with a one-line summary, same controls | `src/studio/StudioApp.vue:460-472` |
| Shortcut switch in the Design panel | moved to the keyboard panel behind the "?" button | `src/key-help.ts:62-79` |
| Repeat panel: Straight, Half-drop, Brick, Mirror | changed: a folded section "Repeat", its summary is the current repeat | `src/studio/StudioApp.vue:473-485` |
| Motif families, at least one on, summary | changed: a folded section "Motif families", summary "N of M" | `src/studio/motifs-sea.ts:16`, `src/studio/motifs-orchard.ts:11`, `src/studio/StudioApp.vue:486-498` |
| Your own motif panel | changed: a folded section "Your own motif" with a summary; same controls inside | `src/studio/StudioApp.vue:499-588` |
| "Image" file input (images and SVG) | changed: now the shared drop zone, label "Image", `image/*,.svg`, also takes a dropped file | `src/studio/StudioApp.vue:457` |
| "Try a sample flower", bad file error | kept as is | `src/studio/StudioApp.vue:458-460` |
| Vector read note, "Not read" list, "Trace it as an image instead" | kept as is | `src/studio/StudioApp.vue:463-467` |
| Method, Colors, detector, threshold, line, detail, color, size | kept as is | `src/studio/StudioApp.vue:80-81` and the motif fields |
| "Sits on the stem by", "Use it as", "Smooth curves", "Keep the image's colors" | kept as is | `src/studio/StudioApp.vue:510-526` |
| Preview "N shapes, N bytes", "Remove my motif", "Your motif is not part of the link." | kept as is | `src/studio/StudioApp.vue:534-536` |

## 4. Builder

| Feature | Status | Where now |
| --- | --- | --- |
| "Undo", "Redo", "Start again", "Open an example", load error | changed: Undo and Redo are icon buttons with `aria-label`; the example select now has a visible label "Example" (it was a hidden "Examples") | `src/builder/BuilderApp.vue:42,77-84,97` |
| Toolbar size badge, "Copy CSS" and "Download SVG" | changed: new in the toolbar; "Download SVG" is a quiet button (see Core); "Use it…" scrolls to the Export section and focuses it | `src/builder/BuilderApp.vue:33-40,86-94`, `src/builder/builder-css.ts` |
| No palette strip, no full screen, no R or F | kept as is | `src/builder/BuilderApp.vue` |
| "Snap" and "Grid" (4, 8, 12, 16), key `fp-builder-snap-v1` | changed: a switch and a segmented control, same key and values, with the tile size readout "W × H" | `src/builder/BuilderStage.vue:14-16,323-327` |
| Faint grid dots, dashed tile edge, veil on neighbors | kept as is | `src/builder/BuilderStage.vue:377-378,441` |
| Mouse and touch: select, drag, mirror drag, multi-select, rectangle, handle, Alt | kept as is | `src/builder/BuilderStage.vue` (not changed in 5a outside the snap bar and hint) |
| Keys: select all, N, P, arrows, Delete, D, F, [ ], minus and plus, Page Up and Down, Esc | kept as is, and also listed in the keyboard panel | `src/builder/BuilderStage.vue`, `src/key-help.ts:20-38` |
| Editor region with key help label | kept as is | `src/builder/BuilderStage.vue:337` |
| Live line "No shape selected", "{name}, shape k of n", "N shapes selected" | kept as is | `src/builder/BuilderStage.vue:255-258,393` |
| Focus outline | kept as is | `src/builder/BuilderStage.vue:427` |
| Hint under the stage | changed: the phone line is the same, the wide-screen key list is replaced by "Keyboard keys: see the ? button at the top." | `src/builder/BuilderStage.vue:394-395` |
| Shapes section | changed: a section with a summary, open at load | `src/builder/StampPanel.vue:125-127` |
| "In this tile", basic shapes | kept as is | `src/builder/StampPanel.vue` |
| "Studio drawings", "Loading…", "Other drawings" | changed: a fold with the drawing count as summary; same texts | `src/builder/StampPanel.vue:141-144` |
| "Math patterns", Family, "Other variant" | changed: a fold with the family count as summary; same controls | `src/builder/StampPanel.vue:155-158` |
| "Your own files": "Add SVG files or an image", several files | changed: now the shared drop zone in a fold "Your own files", summary "SVG or one image"; same label, `image/*,.svg`, multiple, also takes drops | `src/builder/StampPanel.vue:177-179` |
| Own files status: "Added N shapes.", "could not be read as shapes", "Over 5 MB, not read" | moved outside the "Your own files" fold, so it shows while the fold is closed; same texts | `src/builder/StampPanel.vue:110-117,183` |
| Selected shape card: empty text, one shape, parts, several shapes | changed: a section with a heading "Selected · {name}" or "Selected shapes (N)"; same contents | `src/builder/ItemPanel.vue:64-72` |
| "Colors in this design", Duplicate, Delete | kept as is | `src/builder/ItemPanel.vue:122,128,138` |
| Flip | changed: a toggle button with `aria-pressed`, same id `item-flip` (it was a checkbox) | `src/builder/ItemPanel.vue:127` |
| Order buttons (To front, Forward, Backward, To back) | changed: inside an "Order" menu (a `details` element); same four buttons and the same disabled rules | `src/builder/ItemPanel.vue:129-137` |
| Tile card: Width, Height, Repeat, Overlap, Background, Line width | changed: a section "Tile", folded at load | `src/builder/TilePanel.vue:129-131` |
| Fold "Fill the tile with a grid" and all its controls | changed: its own section, folded at load; same controls | `src/builder/TilePanel.vue:181-183` |
| Export card: size badge, export actions, `pattern-builder.svg` | changed: a section "Export", folded at load; same contents | `src/builder/ExportPanel.vue:46-48` |
| "CSS and design file": CSS box, design download and open, status texts | kept as is | `src/builder/ExportPanel.vue:54-63` |

## New

These are not in `FEATURES.md`. The owner asked to list them.

| Feature | Status | Where now |
| --- | --- | --- |
| "T" button in the Patterns preview corner: shows or hides the sample text | new: a real button, `aria-label` "Show the text", `aria-pressed`, reachable with the keyboard; not stored, not in the link; the hidden text uses `visibility: hidden`, so it stays in the page and the contrast check keeps measuring it | `src/App.vue:42-43,185,195`, `src/css/app.css:176-179`, `e2e/preview.spec.ts` |
| Dashed one-tile marker in the Patterns preview | new: decorative (`aria-hidden`), one tile of the pattern layer, or one cell of the super tile with variants | `src/App.vue:49-53,183` |
| "Use it…" toolbar button (ink style) on the three pages | new: opens the Export tab (Patterns), the CSS box (Studio) or the Export section (Builder) | `src/App.vue:169`, `src/studio/StudioApp.vue:392`, `src/builder/BuilderApp.vue:94` |
| Studio preview caption chip | new: "{Theme} · seed N · N px" | `src/studio/StudioApp.vue:402` |

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
| `fp-tab`, `fp-lib` (session) | kept as is | `src/App.vue`, `src/components/PatternPanel.vue:21` |
| The T button state | new: not stored and not in the link | `src/App.vue:42-43` |
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
- "Copy link" stays in the Patterns toolbar for good. The design board leaves it out by mistake. This is the owner's decision.
- Grade B uses the warn color (the `mid` band), as spec section 3 says. The Studio board shows B in green. The code follows the spec.
- "Download SVG" is still in the toolbar on the three pages, as a quiet button. The design canvas has it inside "Use it". It moves there in a later phase.
- The contrast chip and the size badge now use the short form at every width. The long sentences are for screen readers and the tooltip.
- In the Builder, the Tile, Fill and Export sections are folded at load. A visitor must open them to see their controls. The e2e tests now open Tile and Export first.

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
- The quiet "Copy link" and "Download SVG" buttons: words above 1536 px, icon and tooltip below.
- The full screen button in the preview corner on Patterns and Studio, with the mouse, the keyboard and the F key.
- The T button: Tab reaches it, Space toggles it, a screen reader says pressed or not pressed.
- The dashed one-tile marker lines up with the tile seams, with and without variants.
- The Studio theme cards with arrow keys, and the folded sections with their summaries.
- The Builder Order menu with the keyboard (open, pick, Esc), and the Flip toggle state.
- The grade chip colors for each grade band, in light and dark mode.
- Studio undo and redo after a slider drag: one drag is one step.

# Phase 5b feature check

This section checks the "Use it" panel of branch `phase5b`, commit `023b9e3`, against `FEATURES.md` and spec section 4.
The rule is the same: every feature survives.

Method. I read the diff `phase5a..phase5b` (21 files) and every changed component.
The rows below list only the items that phase 5b touches, and the new items.
The other rows of the phase 5a check are still true: phase 5b did not change their files, or changed other lines.
Line numbers are for commit `023b9e3`.

## Counts, phase 5b

| Status | Rows |
| --- | --- |
| Kept as is | 9 |
| Moved | 8 |
| Changed | 9 |
| New | 12 |
| Missing | 0 |

## Rows, phase 5b

| Feature | Status | Where now |
| --- | --- | --- |
| Toolbar order (Core) | changed: the out group is now "Copy link" (Patterns only), "Copy CSS", "Use it…"; "Download SVG" left the toolbar on the three pages | `src/App.vue:184-188`, `src/studio/StudioApp.vue:419-420`, `src/builder/BuilderApp.vue:129-130` |
| "Copy link" (Patterns toolbar) | kept as is; it stays in the toolbar for good (owner's decision) | `src/App.vue:185` |
| "Download SVG" quiet toolbar button (Core) | moved to Use it on the three pages: under "Website background", and as the "SVG" size of "Clothing & fabric" and "Paper & gift wrap" | `src/components/UseIt.vue:168-171`, `src/use-it.ts:83,95` |
| Export actions block: "Download SVG", "Copy SVG", "Copy CSS", status, "CSS background" box | kept as is (file not changed in 5b); in the Builder it now shows under Use it › Website background | `src/components/ExportActions.vue`, `src/builder/ExportPanel.vue` |
| "Use it…" toolbar button | changed: it opens the Use it tab (Patterns) or the Use it view (Studio, Builder), and focus moves to the tab or to the step "1 · What is it for?" | `src/App.vue:105-110`, `src/studio/StudioApp.vue:363-373`, `src/builder/BuilderApp.vue:44-52` |
| Patterns "Copy CSS", "Copy link", "Download SVG" | changed: "Download SVG" moved into Use it (see Core); "Copy CSS" and "Copy link" stay in the toolbar | `src/App.vue:185-186` |
| Copy CSS failure "Copy failed. Copy the CSS from the Export tab." | changed: now "Copy failed. Copy the CSS from the Use it tab.", because the tab has a new name | `src/App.vue:67` |
| File names `fractal-…`, `patchwork-…`, `traced-…` | kept as is; a PNG adds the size, see New | `src/state.ts:433-436` |
| Six tabs, session key `fp-tab` | changed: the sixth tab is "Use it" (id `use`); a stored value `export` opens "Use it" | `src/shell.ts:1,7`, `src/App.vue:76` |
| Patterns preview | changed: while the Use it tab is open, the device preview takes the stage; the pattern stays mounted under it, hidden | `src/App.vue:197,217` |
| Export "Performance settings": Depth link, precision, stats | moved to Use it › Website background, unchanged | `src/App.vue:258`, `src/components/OutputPanel.vue` |
| "Use it": Download SVG, CSS and HTML blocks | moved to Use it › Website background, unchanged | `src/App.vue:258`, `src/components/OutputPanel.vue` |
| Script option, "When", "Variants", "Copy script", byte line | moved to Use it › Website background, unchanged | `src/App.vue:258`, `src/components/OutputPanel.vue` |
| "Other formats (experimental)" | moved to Use it › Website background, unchanged | `src/App.vue:258`, `src/components/OutputPanel.vue` |
| Studio "Download SVG" `wallpaper-{repeat}-{seed}.svg` | moved to Use it › Website background, same file name; also the SVG sizes of fabric and paper | `src/studio/StudioApp.vue:459` |
| Studio "Copy CSS" in the toolbar | kept as is | `src/studio/StudioApp.vue:419` |
| Studio copy failure text and the CSS box | changed: a failed copy still shows the old box with the same text; "Use it…" no longer opens this box | `src/studio/StudioApp.vue:320-330,469-473` |
| Studio design controls | kept as is; hidden, not destroyed, while Use it is open | `src/studio/StudioApp.vue:475` |
| Builder toolbar: size badge, "Copy CSS", "Download SVG" | changed: "Download SVG" left the toolbar; the badge and "Copy CSS" stay | `src/builder/BuilderApp.vue:120-130` |
| Builder Export card: size badge, export actions, `pattern-builder.svg` | moved to Use it › Website background; it is no longer a folded section, the contents are the same | `src/builder/ExportPanel.vue:45-47`, `src/builder/BuilderApp.vue:164` |
| Builder "CSS and design file" fold, all status texts | moved with the Export card, unchanged | `src/builder/ExportPanel.vue:48-58` |
| Builder Shapes, Selected, Tile and Fill sections | kept as is; hidden, not destroyed, while Use it is open | `src/builder/BuilderApp.vue:145-149` |
| `fp-tab` (session) | changed: the old value `export` maps to `use` | `src/shell.ts:7` |
| Patterns CSS, HTML, script and other formats | kept as is (files not changed in 5b) | `src/export.ts` |
| Studio CSS rule | kept as is; it also shows in the new "CSS rule" box | `src/studio/StudioApp.vue:221,464` |
| Builder CSS lines, SVG and design file | kept as is (files not changed in 5b) | `src/builder/builder-css.ts` |
| Use it panel, three steps: "1 · What is it for?", "2 · Which size?", "3 · Get it" | new: the same panel on the three pages | `src/components/UseIt.vue:113-190` |
| Eight destinations with presets and a how-to line | new: phone, desktop, website, video call, fabric, paper, game texture, slides; sizes as in spec section 4 | `src/use-it.ts:26-119` |
| PNG download at the chosen size | new: the renderer loads on demand; the file name is `{base}-{w}x{h}.png`; the status says "Saved W × H PNG." | `src/components/UseIt.vue:65-90`, `src/png-export.ts`, `src/use-it.ts:130-132` |
| "Keep the clock readable" | new: phone only, on by default; it fades the top 32 % of the PNG to the background color | `src/components/UseIt.vue:154-160`, `src/png-plan.ts:30-32` |
| "This phone (detected)" and "This screen (detected)" | new: screen size times device pixel ratio, portrait for a phone, landscape for a screen | `src/use-it.ts:122-127` |
| "Custom size…" | new: phone and desktop; width and height are clamped to 16 to 8192 px | `src/use-it.ts:134-138`, `src/components/UseIt.vue:142-153` |
| Device previews | new: the tile on a phone with a clock, a laptop, a browser, a call, fabric, paper, a texture or slides, drawn with CSS and inline SVG | `src/components/UseItPreview.vue` |
| "Send to my phone (QR)" | new: shown, but marked unavailable (`aria-disabled`, title "Coming later") | `src/components/UseIt.vue:177` |
| PNG warnings | new: on touch devices, a size over 16.7 M px shows "This size may be too large for a phone browser." with a "Download SVG" link; a failed PNG also offers "Download SVG" | `src/components/UseIt.vue:179-187`, `src/png-plan.ts` |
| Last destination, for the session only | new: keys `fp-use`, `fp-use-studio`, `fp-use-builder` in sessionStorage; "Website background" at first | `src/App.vue:111`, `src/studio/StudioApp.vue:378`, `src/builder/BuilderApp.vue:64` |
| Studio and Builder Use it view | new: "‹ Back to the design" and Esc close it, and focus returns to "Use it…"; not stored, not in the link | `src/studio/StudioApp.vue:373-376,437,441-442`, `src/builder/BuilderApp.vue:53-58,151` |
| Studio Website background: second "Copy CSS" and "CSS rule" box | new: a "Copy CSS" button and a "CSS rule" box that is always visible in the panel | `src/studio/StudioApp.vue:455-465` |

## Missing, phase 5b

None found.

Search method: for each label the old Export tab, the Studio export area and the Builder Export card show, I searched it in `src` on `phase5b`.
Each one is still reachable, under Use it › Website background or in the toolbar.

## Points for the owner, phase 5b

- The Patterns Copy CSS failure text changed from "the Export tab" to "the Use it tab". This change is on purpose, because the tab has a new name. It waits for your confirmation.
- "Download SVG" left the toolbar on the three pages, as the design canvas shows. It now takes one more click.
- The "Hero only" size of "Website background" changes only the preview. The CSS and the export content are the same as for "Repeating CSS".
- Spec section 4 says the panel is a bottom sheet on a phone. I found no bottom sheet in the code. On a phone the panel takes the controls column.
- "Send to my phone (QR)" shows, but it does nothing. Its title says "Coming later".
- The PNG is drawn on one canvas. The strip plan in `src/png-plan.ts` exists, but the renderer does not use it yet. A3 (3508 × 4961) and large custom sizes can fail on iOS Safari. The panel then offers the SVG.
- In the Studio, "Use it…" no longer shows the old CSS box. That box now shows only after a failed copy.
- In the Builder, Esc closes Use it only when focus is in the controls column. In the Studio, Esc also works from the preview.

## Not checked by reading code, phase 5b

To make sure of these, a person must look in a browser.

- The eight device previews, in light and dark mode and at phone width.
- A PNG download on iOS Safari and on Android, at A3 and at a large custom size.
- The clock fade in the PNG, on a light and on a dark background.
- The detected size on a real phone and on a high-density screen.
- Focus: it moves to "1 · What is it for?" when the view opens, and back to "Use it…" after Back or Esc.
- Full screen and the F key while Use it is open, on Patterns and Studio.
- A screen reader on the destination cards, whose radio buttons are visually hidden.
- The "Send to my phone (QR)" button: a screen reader says it is not available.
- The session memory: the last destination comes back after a reload, and not in a new tab.

# Phase 5c feature check

This section checks the phone layout, the folded sections and the Builder coach of branch `phase5c`, commit `3b3afad`.
The rule is the same: every feature survives.

Method. I read the diff `phase5b..phase5c` (23 files) and every changed component and style sheet.
The rows below list only the items that phase 5c touches, and the new items.
The other rows of the 5a and 5b checks are still true: phase 5c did not change their files, or changed other lines.
Line numbers are for commit `3b3afad`.
"Phones" means a window narrower than 600 px. Wider windows look as in phase 5b, except the folded sections.

## Counts, phase 5c

| Status | Rows |
| --- | --- |
| Kept as is | 6 |
| Moved | 10 |
| Changed | 17 |
| New | 5 |
| Missing | 0 |

## Rows, phase 5c

| Feature | Status | Where now |
| --- | --- | --- |
| Patterns toolbar: "Shuffle", "Undo", "Redo", "Use it…" | moved to the phone bottom bar, cells Shuffle · Undo · Redo · Palette · Use it; same disabled rules, labels and key titles | `src/App.vue:231-239`, `src/components/BottomBar.vue` |
| Patterns "Random pattern", "Reset", "Copy CSS", "Copy link" | moved on phones to the palette sheet, group "More"; the sheet has its own status line for the copy texts | `src/App.vue:240-251` |
| Palette strip (Patterns and Studio toolbar) | moved on phones to the palette sheet; the bar's Palette cell shows four squares of the palette | `src/App.vue:240-241`, `src/studio/StudioApp.vue:452-453`, `src/components/PaletteSheet.vue` |
| Patterns contrast chip and size badge | moved on phones to the preview corner, one chip per row; in the 150 px strip only the contrast chip shows, top right | `src/App.vue:274-281`, `src/css/app.css:330-350` |
| Studio toolbar: "Shuffle", "Undo", "Redo", "Use it…" | moved to the phone bottom bar, the same five cells as Patterns | `src/studio/StudioApp.vue:443-451` |
| Studio "Copy CSS" | moved on phones to the palette sheet ("More") and to Use it › Website background | `src/studio/StudioApp.vue:452-460,486-510` |
| Studio size badge | moved on phones to the preview corner chips | `src/studio/StudioApp.vue:472` |
| Builder "Undo", "Redo", "Start again" | moved to the phone bottom bar | `src/builder/BuilderApp.vue:150-153` |
| Builder "Open an example" | moved on phones to the bar's Examples cell, a native select named "Examples"; same five examples | `src/builder/BuilderApp.vue:154-157` |
| Builder size badge and "Copy CSS" | moved on phones to Use it › Website background (the export card) | `src/builder/BuilderApp.vue:149,160-176` |
| Builder example load error | kept as is; it is outside the hidden toolbar groups, so it also shows on phones | `src/builder/BuilderApp.vue:146` |
| "?" button, full screen and T buttons, corner hint | kept as is; "?" stays in the header, full screen and T stay in the preview corner | `src/components/SiteHeader.vue`, `src/css/app.css:356-359` |
| Toolbar stays in view, narrow-screen wrapping | changed: on phones the toolbar has no height and its groups hide; its live regions stay in the page | `src/css/app.css:317-329` |
| "Use it…" on the three pages | changed: on phones it opens a bottom sheet (modal dialog); Patterns and Studio move their one panel into it, so its choices stay | `src/App.vue:142-146,252-255,320`, `src/studio/StudioApp.vue:374-381,486`, `src/builder/BuilderApp.vue:52-55,160-176` |
| Six tabs, arrow keys | changed: on phones a 3 × 2 grid, still one tablist; Down and Up also step in reading order; the "Use it" tab opens the sheet on a click, arrow keys only focus it | `src/App.vue:126-147,296`, `src/css/app.css:759-790` |
| `fp-tab` (session) | changed: on phones a stored `use` opens the Pattern tab, because "Use it" is a sheet there | `src/App.vue:107-115` |
| Heading and caption "Pattern: …" | changed: on phones the short caption hides; the full sentence stays for screen readers | `src/css/app.css:350-356` |
| Repetition card | changed: a folded section, open at load, now titled "Reduce repetition" (was "Repetition"); summary "on · strength · N by N", "off" or "not available" | `src/components/RepetitionPanel.vue:78-90,95` |
| "More ways to hide the repeat" | changed: its own folded section, closed; heading h3 to h2; summary lists what is on, or "none" | `src/components/RepetitionPanel.vue:183` |
| Layout "Examples" | changed: a folded section, open; summary "random · 4 examples" | `src/components/LayoutPresets.vue:8` |
| Spacing | changed: a folded section, closed; summary zoom, gap and mirror | `src/components/SpacingPanel.vue:9,13` |
| Transform and motion | changed: a folded section, closed; it opens itself when drift turns on, so "Pause motion" stays in view | `src/components/MotionPanel.vue:23-33,42` |
| Colors and contrast | changed: a folded section, open; summary of the contrast result | `src/components/ColorPanel.vue:62` |
| Text plate modes, opacity, radius, blur | changed: a folded section "Text plate", closed, with a summary | `src/components/ColorPanel.vue:157` |
| APCA Lc, "Raise to Lc N", guidance fold | changed: a folded section "APCA™ Lc value"; the "Raise to Lc" result sits next to its button; the "informational" tag moved to the value line | `src/components/ColorPanel.vue:182-224` |
| "Start from a palette" | changed: a folded section, summary the palette name or "custom colors"; group headings h4 to h3 | `src/components/ColorPanel.vue:226-244` |
| "Second opinion" | changed: a folded section, summary "cvd N/M · L* N" | `src/components/VisionPanel.vue:48-56` |
| Image tab controls | changed: "From image" is a folded section, open; the detector and trace controls are a second section "Trace options", shown once an image is loaded, as before | `src/components/ImagePanel.vue:49,114` |
| Form fields in two columns | changed: a field stays in its grid column; the Image tab's Edge detector no longer overlaps Threshold (older bug) | `src/css/app.css:1297-1303` |
| Phone preview | new: 270 px, the controls sheet overlaps it by 12 px; scrolling into the controls leaves a 150 px strip | `src/css/app.css:696-810`, `src/App.vue:80-86` |
| Phone bottom bar | new: five cells on each page, no scroll; body padding keeps content above it | `src/components/BottomBar.vue:22-23` |
| Palette sheet | new: a modal dialog; Esc, Close and a backdrop click close it, and focus returns to the opener | `src/components/PaletteSheet.vue` |
| Builder first-run coach | new: three steps (the wrap, the handle, the folds), Skip, Next, Done and Esc; non-modal; it never shows over a changed design or a design opened from a file | `src/builder/BuilderCoach.vue`, `src/builder/coach.ts` |
| `fp-builder-coach-v1` | new: stored key, value `done` after Skip, Done or Esc | `src/builder/coach.ts:3` |
| Link keys of the three pages | kept as is (files not changed in 5c) | `src/state-share.ts`, `src/studio/studio-share.ts` |
| Other stored keys (`fp-shortcut`, `fp-builder-design-v1`, `fp-builder-snap-v1`, `fp-lib`, `fp-use…`) | kept as is | see the 5a and 5b rows |
| Export outputs (Patterns CSS, HTML, script, Studio CSS, Builder CSS and SVG) | kept as is (files not changed in 5c) | `src/export.ts`, `src/builder/builder-css.ts` |
| Builder sections, Studio folds | kept as is (files not changed in 5c); the Builder column fits 1440 × 900 with only Shapes open | `src/builder/StampPanel.vue`, `src/studio/StudioApp.vue` |

## Missing, phase 5c

None found.

Search method: for each control the phone layout hides, I looked for its phone place: the bottom bar, a sheet, the preview corner or Use it.
Each one has one. Every folded section keeps all its controls; only the open or closed state at load changed.

## Points for the owner, phase 5c

- The APCA "Raise to Lc" result moved inside its folded section, next to its button. You accepted this.
- Headings changed level (h4 to h3, h3 to h2) to keep the heading order inside the new sections.
- The Repetition section title is now "Reduce repetition". The tab name stays "Repetition".
- The phone Colors tab uses the desktop card, not the board's compact role rows.
- The size chip text includes "CO₂", so the two chips cannot share one row at 360 px. They stack, one per row.
- The "Use it" sheet is taller than the Builder board's short sheet, because it holds the full panel.
- On phones the Builder coach sits at the top of the controls sheet, not over the preview.
- The Builder checks the phone width once at load. A window that widens later keeps the phone Use it sheet and coach place.
- The preview shrinks while the page scrolls into the controls, not when a section opens.
- Without scroll-driven animations (Firefox, older Safari) the strip shows the bottom 150 px of the preview. The same happens with reduced motion.
- No existing e2e selector changed. The new tests are `e2e/phone.spec.ts` and `e2e/builder-coach.spec.ts`.
- The phone tests run at 375 px. The 360 px screenshots show no sideways scroll. Nothing checks 402 px.

## Not checked by reading code, phase 5c

To make sure of these, a person must look in a browser.

- The bottom bar and sheets on a real iPhone and Android phone, with the safe area at the bottom.
- The 270 to 150 px shrink while scrolling, in Chrome, Safari and Firefox.
- A screen reader on the palette sheet and the Use it sheet: the title is read, focus returns to the opener.
- The 3 × 2 tab grid with a screen reader: it is still announced as tabs.
- The contrast of the folded section summaries and the coach card, in light and dark mode.
- The coach with the keyboard: Tab order, Esc, and focus after Done.
- The native Examples select on iOS and Android.
- Touch targets of at least 44 px in the bottom bar and the sheets.
