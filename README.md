# Fractal Patterns

Live: https://patterns.pierreguilbert.com/ ([studio](https://patterns.pierreguilbert.com/studio.html))

Sponsor: [github.com/sponsors/guilbep](https://github.com/sponsors/guilbep)

Fractal Patterns is a one-page generator of repeating SVG background tiles, made from seeded math or from your own image. It tests the colors against the WCAG 2.2 contrast thresholds and estimates the CO2 cost of the result.

## Live site

The site is at <https://patterns.pierreguilbert.com/>. It has two pages:

- The pattern page, at the site root: <https://patterns.pierreguilbert.com/>.
- The Wallpaper Studio, next to it: <https://patterns.pierreguilbert.com/studio.html>.

## What it does

### Page layout

The header is shared by both tools: the Fractal Patterns logo and name, a switch between the two tools (Patterns and Wallpaper Studio, each with its own icon), the current tool's tagline, and a GitHub link. The toolbar under it has these buttons, in order:

- Shuffle: draws a new seed for the current kind.
- Random pattern: picks a different kind and a new seed, and goes back to a single pattern. It also sets the Repetition tab at random: when the kind can vary, "Reduce repetition" is on half of the time, with a light to wide strength and only the options that apply to that kind (empty cells stay at 0). The second layer is on one time in three, with a size factor away from 1, a turn of 0, 30, 45 or 90 degrees, and a strength from 0.4 to 0.8. The colors, plate, spacing, motion, soft fade, sections and parallax stay. One Undo brings back the state before the click.
- Undo and Redo.
- Reset.
- Copy CSS.
- Download SVG.
- Copy link.

The toolbar ends with a palette strip and two badges. The strip shows the colors of the current palette, with buttons for the previous palette, the next palette, and a random palette. The first badge shows the worst text contrast and an AA pass or fail. The second badge shows the CO2 footprint of the export.

The hero is the large preview under the toolbar. It uses the exported `.fp-pattern` class, so it shows what you copy. Six tabs hold the controls:

- Pattern: the library, the seed, the depth, the tile size, the stroke width, the patchwork layout, and the R key option.

Two single-key shortcuts work in both pages: R shuffles, and F shows the preview full screen (Esc or F leaves it). A toolbar button does the same as F. One checkbox turns both shortcuts off, and the choice is stored for both pages.

- Repetition: the "Reduce repetition" switch with a picture for each option, the second layer, the soft fade, and the angle per section. The tab shows a mark while one of them is on.
- Layout: the spacing, and the transform and motion controls.
- Colors: the colors and contrast, the APCA value, the palettes, and the Second opinion panel.
- Image: the trace from your image.
- Export: the performance settings and the "Use it" panel.

The library is a row of family tabs plus "All". The page draws only the previews of the open tab. The open tab follows the pattern when it changes through Random pattern, undo, or a link.

The tool switch in the header opens the Wallpaper Studio, a second page, with the same palette. See [Wallpaper Studio](#wallpaper-studio).

### Pattern library

The page draws 76 pattern kinds in six families:

| Family | Kinds | Names |
| --- | --- | --- |
| Fractals | 8 | Carpet, Quadtree, Tree, Folded curve, Hilbert curve, Koch lattice, Sierpinski, H-tree |
| Line art | 4 | Curve stitching, Whirl, Rosette, Spirals |
| Surfaces | 13 | Running bond, Stack bond, Herringbone, Basket weave, Honeycomb, Triangular net, Nested boxes, Dot grid, Hatch, Crosshatch, Zigzag, Fish scales, Waves |
| Symmetry groups | 17 | p1 translation, p2 half turn, pm mirror, pg glide, cm mirror and glide, pmm two mirrors, pmg mirror and glide, pgg two glides, cmm two mirrors, centered, p4 quarter turn, p4m quarter turn and mirrors, p4g quarter turn and glides, p3 third turn, p3m1 third turn and mirrors, p31m third turn, mirrors off center, p6 sixth turn, p6m sixth turn and mirrors |
| Themes | 27 | Topography, Maze, Circuit, Waves (seigaiha), Rain, Mountain ridges, Constellations, Roots, Cracked earth, Knotwork, Roof tiles, Feathers, Chain and fence, Pipes, Chladni figures, Clouds, Moons, Storm, Leaves, River, Thorns, Nest, Railway, Quilt, Lanterns, Basketwork, Garden paths |
| Quasicrystals | 7 | Penrose rhombs, Penrose arcs, Penrose rhombs and arcs, Eightfold rhombs, Eightfold stars, Twelvefold rhombs, Twelvefold stars |

A wallpaper group is one of the 17 ways to repeat a motif over a plane with mirrors, turns and glides. The page has all 17. The 12 square groups use a square tile. The 5 hexagonal groups are p3, p3m1, p31m, p6 and p6m. They use a rectangular tile, 1 wide by the square root of 3 high. A hexagonal lattice repeats in that rectangle.

A quasicrystal tiling is a tiling with five-, eight- or twelvefold order that never repeats. A CSS background must repeat, so the page draws a periodic approximant: a tile that repeats exactly and looks like the tiling that never repeats. The Penrose kinds use a rectangular tile. The eightfold and twelvefold kinds use a square tile.

A rectangular tile turns off some features for now: the patchwork layout (its cells are square), the spacing controls, and Reduce repetition. The panels say "Not available for this pattern yet." The kinds with a rectangular tile are the 5 hexagonal groups and the 3 Penrose kinds.

Each kind has its own maximum depth, the number of recursion or detail levels. The other controls are tile size and stroke width.

Some kinds give a large tile at their highest depth. For most kinds, the depth limit keeps the worst case near or under 20,000 characters of SVG at precision 1. The hexagonal groups go up to about 70,000. The page does not hide this cost: the Export tab shows the bytes and the CO2 badge shows the footprint for every design.

### Free and compatible layouts

All 13 Surfaces kinds have two layouts. In the free layout, the seed also chooses the layout. In the compatible layout, the layout is fixed for each depth, so tiles with different seeds can sit next to each other without a seam. The page uses the free layout. There is no separate control: Reduce repetition switches these kinds to the compatible layout, and the panel says so.

### Seeds and events

A seed is a number that starts the random generator. The same seed and the same controls always give the same tile. The seed is a whole number from 0 to 4294967295.

These user events draw a new random seed:

- A click on the Shuffle button.
- A click on the pattern in the hero, the large preview at the top of the page.
- A press on the R key. The page ignores the key in a text field and with Ctrl, Cmd or Alt.

A checkbox turns the R key shortcut off, as WCAG 2.1.4 requires for single-key shortcuts. The page keeps this choice after a reload. Shuffle applies to math patterns only.

Shuffle changes only the seed. Random pattern also changes the kind.

The Undo and Redo buttons step through the history of the design. Ctrl+Z or Cmd+Z undoes a change. Ctrl+Shift+Z or Cmd+Shift+Z redoes it. In a form field, the browser text undo applies instead. The Reset button returns all values to the first-load state.

The page does not keep the undo history after a reload. The design stays, because the URL holds it.

### Patchwork

The patchwork layout splits the tile into a grid of cells, and each cell gets a different kind. The grid is 2 by 2, 3 by 3 or 4 by 4. You choose the families that the cells can use. You can pin a kind to a cell. Shuffle keeps the kind of a pinned cell. The new seed can give the other cells new kinds. An option draws frame lines between the cells. The maximum depth is 3 for a 2 by 2 grid and 2 for the larger grids.

### Spacing

- Zoom: scales the pattern inside the tile from 0.5 to 3, and wraps the parts that leave the tile to the opposite side.
- Gap: adds 0 to 120 px of empty space between the repeats of the tile.
- Mirror: puts four mirrored copies of the content in the tile, so any content repeats without a seam.
- Fit: for an image, Cover fills the tile and crops the longer side. Contain shows the whole image and leaves an empty strip.

The spacing controls are off with Reduce repetition, with Smooth curves, and for a kind with a rectangular tile.

### Repetition

A repeating tile shows the same picture again at a fixed distance, and the eye finds the grid. The Repetition panel has four ways to make that less visible. It sits in the Pattern tab and in the Image tab.

Reduce repetition puts several seeded variants of the kind into one larger tile. No two neighbor cells show the same variant, also across the tile edge. It needs a math pattern with a single layout. It applies to the 22 kinds whose edges match between seeds: Carpet, Quadtree, Tree, Folded curve, Koch lattice, Sierpinski, H-tree, Curve stitching, Whirl and the 13 Surfaces kinds, which use their compatible layout here. The panel shows the bytes of the larger tile against the bytes of one tile. The options:

| Option | What it does | Kinds |
| --- | --- | --- |
| Strength | Light: 2 variants, 2 by 2. Medium: 4 variants, 4 by 4. Wide: 4 variants, 6 by 6. Strong: 6 variants, 6 by 6. | All 22 |
| Line weight | Varies the stroke weight softly across the tile. | All 22 |
| Turn and flip each cell | Turns or mirrors each cell, at no extra path. | Carpet, Tree, Folded curve, Koch lattice, H-tree, Curve stitching, Whirl, Dot grid |
| Empty cells | Leaves up to 50% of the cells empty. | Carpet, Tree, Folded curve, Koch lattice, H-tree, Curve stitching, Whirl, Dot grid |
| Offset | None, Half-drop or Brick: shifts every second column or row by half a cell. | Carpet, Tree, Folded curve, H-tree, Curve stitching, Whirl |
| Mix two depths | Draws half of the variants one depth lower. | Carpet, Tree, Folded curve, H-tree, Curve stitching, Whirl, Dot grid |
| Shift and scale | A small shift and size change per cell. | Carpet, Tree, Folded curve, H-tree, Curve stitching, Whirl |

Reduce repetition also works for a traced image. The larger tile is then a grid of the same picture, 2 by 2, 4 by 4 or 6 by 6, and the variation comes from each cell: Turn and flip, Offset, Shift and scale, Line weight and Empty cells. Mix two depths is not available, because an image has one picture only. The SVG writes the traced path once and places it in each cell with `<use>`, so a 4 by 4 grid costs little more than one tile. The edges of a traced picture do not match, so seams can show unless Seamless edges is on, and the mode needs the straight trace: turn off Smooth curves first.

Second layer adds a second copy of the tile on top of the first. Its size is coprime with the first size, so the two layers together repeat only at a much larger distance. Two whole numbers are coprime if no number above 1 divides both. The panel gives that distance. "Own color for the second layer" draws the second layer in its own color; a palette sets it to its accent color. The second tile then has its own data URI, so the export grows a little. The contrast check also counts the second color alone and where it crosses the first layer. The color vision panel simulates the second color too and checks the same surfaces. The controls:

- Shift right and Shift down: 0 to 100% of the second tile.
- Turn: -180 to 180 degrees.
- Size: 0.5 to 3 times the first tile.
- Strength: 10 to 100%.
- Depth: 0.25 to 4. With drift on, it changes the speed of the second layer. Below 1 the layer moves slower and looks farther away.

With two layers, the text can sit on a spot where both layers cross. Let o be the pattern opacity and p the strength of the second layer. The page then gives that spot a stroke opacity of 1 - (1 - o) × (1 - o × p). The contrast badge takes the worst of the plain background, one layer and the crossing.

Parallax on scroll is an option of the second layer. On scroll, the two layers move at different speeds, set by the Depth value. The exported CSS uses scroll-driven animations. A comment in the export gives the browser support: Chrome or Edge 115, Safari 26, or Firefox 159. Other browsers show the two layers without the effect. The CSS sits inside a `prefers-reduced-motion: no-preference` media query, so it is off for visitors who ask for reduced motion.

Soft fade adds two large radial gradient masks with coprime sizes over the pattern. They dim the pattern unevenly, so the grid is harder to see. It is CSS only, with no extra image. A mask only lowers the alpha, so the text contrast never gets worse.

Different angle per section adds three helper classes to the CSS: `fp-a`, `fp-b` and `fp-c`. Each turns the pattern by a different angle (137, 95 and 52 degrees). Put them next to `fp-pattern` on successive sections of a page. The preview does not change.

### From image

The page can trace the edges of your image and turn them into tile lines. An edge detector is a filter that finds the places where the brightness changes quickly. The page has seven detectors:

- Sobel.
- Prewitt.
- Roberts cross.
- Laplacian.
- Canny, the default.
- Scharr: a gradient filter like Sobel, with weights that respond more evenly at all angles. It helps on fine edges at an angle.
- XDoG (ink lines), the extended difference of Gaussians: it marks the places that are darker than their surroundings, relative to the local brightness. It helps on drawings and dark outlines, and reads a stroke the same in shadow and in light.

The controls are the edge detector, the threshold, the detail, the minimum line length, the fit and the resolution. The resolution is 128, 192 or 256 px on the longer edge. The vectorizer then follows the edge pixels and turns them into simplified polylines in tile coordinates.

Smooth curves replaces the straight segments with cubic Bézier curves. A Bézier curve is a smooth curve set by a few control points. The page smooths the pixel chains, fits the curves by least squares, and then moves them onto the strongest edges. The tile is smoother and usually 1.3 to 3 times larger. The panel shows the bytes with curves against the bytes with straight segments.

The Image tab has four built-in examples: brick wall, rounded stones, roof tiles and grass tufts. The app draws them in memory. They are not photos, and nothing is downloaded.

Your image stays in your browser. The page uploads nothing. Use only images that you own or have a license for.

A traced tile repeats without a seam only with Mirror or with a source image that already repeats. The Image tab has the same switch as Seamless edges (mirror): it puts the picture at half size into each quarter of the tile, mirrored left to right and top to bottom, so every edge meets its own mirror image. With Reduce repetition on, each cell of the grid is this mirrored block, so the grid is seamless too and the path is still written once. The switch is not available with Smooth curves yet.

### Colors

The page has 24 palettes: 16 light and 8 dark. The app generates them by rule in the OKLCH color space. OKLCH describes a color by its lightness, chroma and hue, in steps that look even to the eye. Each palette has five colors: paper, ink, stroke, accent and soft. The default palette is Lagoon. The "Random palette" button draws a new palette inside the same rules.

The rules follow two studies of color preference:

- Schloss and Palmer (2011), "Aesthetic response to color combinations: preference, harmony, and similarity", Attention, Perception and Psychophysics 73, 551-571, https://pmc.ncbi.nlm.nih.gov/articles/PMC3037488/ . People prefer pairs of close hues, pairs with more lightness contrast, cool pairs, and a warm figure on a cool ground. They like saturated figures and dislike saturated grounds.
- Palmer and Schloss (2010), "An ecological valence theory of human color preference", PNAS 107, 8877-8882, https://pmc.ncbi.nlm.nih.gov/articles/PMC2889342/ . Blue and cyan are the most liked hues. Dark yellow (olive) and dark orange (brown) are the least liked.

So the stroke and soft colors share the base hue. The accent is 35 degrees from the base, or warm (hue 40) on a cool base. Paper and soft have low chroma. The accent has the highest chroma the screen can show at its lightness, up to 0.19, and the stroke 60 percent of that. Hues 60 to 115 move to amber (50) or green (130), so no palette has olive or brown. Most bases are blue or cyan. The exact numbers are our own choice from these findings, not values from the papers. On a dark palette the dark paper is the background and the stroke is the pattern.

The tile uses three color roles:

- Background: fills the tile.
- Pattern: the strokes, drawn at the pattern opacity.
- Text: the text that sits on top of the tile.

When you click a palette, the page assigns the roles by contrast. The pair of colors with the highest contrast becomes background and text. The lighter color of the pair is the background. The pattern is the remaining color that stays visible and keeps the best text contrast. You can also set each role with a color picker, a hex field or the chips of the current palette. The "Swap background and text" button exchanges the two colors.

The text plate is a box with a background color behind the text. It has three modes:

- Plate: the heading and the paragraph sit on the plate.
- Split: only the paragraph sits on the plate, and the heading sits on the bare pattern. This is the default.
- Direct: there is no plate.

The plate has its own opacity, corner radius and blur.

### Fill

The Fill group in the Colors tab fills the closed shapes of the pattern with a second color. A closed shape is a line that ends where it starts. "Fill closed shapes" has three modes:

- Off, the default.
- All closed shapes.
- Every second shape.

With a fill on, the group shows a Fill color role and a Fill opacity from 0 to 100%. The default fill is `#c3eaec` at 100%. If the pattern has no closed shape, the group says so.

Text can sit on the fill, so the page checks the contrast on the fill too. The contrast results get a line "On the fill". The Fix buttons lower the fill opacity first, in steps of 0.05 down to 0.15. If that is not enough, they go on with the fixes below.

Fills are not available with Reduce repetition, with Smooth curves, or for a kind with a rectangular tile. The group then says "Not available in this mode yet."

The Second opinion panel does not count the fill. Its lightness difference, in-between warning and color vision preview use the background, pattern and text colors only.

### Contrast

A contrast ratio is a number from 1 to 21 that compares the luminance of two colors. The page uses the WCAG 2.2 formulas.

Text crosses both the plain background and the strokes. The page computes text on background, and text on the pattern blended over the background at its opacity. The lower of the two ratios is the worst case, and the page judges the text by it. A plate lowers the opacity of the strokes that the text sees.

| Level | Normal text | Large text |
| --- | --- | --- |
| AA | 4.5 | 3 |
| AAA | 7 | 4.5 |

The pattern is decorative, so it is exempt from WCAG 1.4.11. The page shows a pattern visibility ratio for information only. See the W3C Understanding pages:

- [Understanding 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), the AA level for text.
- [Understanding 1.4.6](https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html), the AAA level for text.
- [Understanding 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), non-text contrast.

There are two Fix buttons: "Fix contrast for AA (4.5:1)" and "Fix contrast for AAA (7:1)". When a level passes, its button reads "AA passes, nothing to fix" or "AAA passes, nothing to fix". The fix depends on the plate mode:

- Direct: the fix moves the text toward black or white. If that is not enough, it lowers the pattern opacity in steps of 0.05 and tries again.
- Plate: the fix raises the plate opacity in steps of 0.05. At a full plate, it changes the text color. The pattern opacity stays.
- Split: the fix first brings the heading to the large-text level on the bare pattern. Then it fixes the paragraph with the plate. It can change the text color, the pattern opacity and the plate opacity.

After a fix, the page names what it changed. If the fix cannot reach the target, the page applies the best result and tells you.

The Second opinion panel adds three checks:

- Lightness difference: the difference in CIE L*, a lightness scale from 0 to 100, between the text and each surface.
- In-between warning: the page warns when the text is darker than one surface and lighter than the other. The strokes then cross the letters with reversed polarity.
- Color vision preview: the colors as people with protan, deutan or tritan color vision see them, after Machado, Oliveira and Fernandes (2009).

### APCA

The Colors panel shows the APCA™ Lc value next to the WCAG 2 ratio, for information only. APCA™ (Accessible Perceptual Contrast Algorithm): APCA™ is the candidate contrast method for WCAG 3, and is currently in public beta. WCAG 3 is still in development and subject to changes prior to adoption. APCA is not part of WCAG 2: WCAG 2.2 stays the check of this tool, and the page does not show Lc as a pass or a fail.

- What is shown: the worst-case Lc over the same surfaces as the WCAG check (on the plate, directly on the pattern, on the fill), rounded to a whole number, with its polarity. A positive Lc is dark text on light, a negative Lc is light text on dark. The APCA guidance levels (Lc 90, 75, 60, 45, 30, 15) with their reference font sizes are listed next to it.
- Raise: a button raises the worst absolute Lc to a chosen level (Lc 60, 75 or 90). It takes the same steps as the WCAG fix (plate opacity, pattern opacity in steps of 0.05, text color) and keeps the polarity: dark text moves toward black, light text toward white. In the split layout the heading on the bare pattern aims at the next lower level (90 gives 75, 75 gives 60, 60 gives 45); this is our reading of the guidance levels, not an APCA rule.
- How: the tool calls the official npm package [apca-w3](https://www.npmjs.com/package/apca-w3) (`sRGBtoY` and `APCAcontrast`), unmodified. The page shows the version in use.
- License: apca-w3 is under its own license, the "Limited W3 License" (<https://github.com/Myndex/apca-w3/blob/master/LICENSE.md>), which is not MIT. The code of this tool stays MIT. See THIRD-PARTY-NOTICES.md.
- APCA™ is a trademark of Myndex Research and Andrew Somers. This tool is not certified by them and claims no APCA or WCAG 3 compliance.
- Disclaimer required by the APCA documents: “APCA is a method for predicting text contrast on self-illuminated displays for web-based content. Some use-cases are prohibited by license, including the following: use in medical, clinical evaluation, human safety related, aerospace, transportation, automotive, military applications, are strictly prohibited without a specific license in writing granting such use.”
- Links: <https://git.apcacontrast.com/>, [Why APCA](https://git.apcacontrast.com/documentation/WhyAPCA), [minimum compliance](https://git.apcacontrast.com/documentation/minimum_compliance.html).

### Transform and motion

The Layout tab starts with a row of examples: "Plain" (no transform, no motion), "Diagonal" (rotate 45, scale 1.2), "Tilted floor" (tilt 55, scale 1.4) and "Slow drift" (diagonal drift, 24 s per tile, rotate -12). An example also sets the spacing back to its defaults. "Random layout" draws a rotation, a scale, and sometimes a skew or a tilt. It never turns drift on: motion costs energy on the visitor's device, so it stays a deliberate choice. Each click is one Undo step.

The pattern sits on a `::before` layer, so it moves while the text stays still. The controls are these:

- Rotate: from -180 to 180 degrees.
- Scale: from 0.5 to 3.
- Skew: from -45 to 45 degrees.
- Perspective tilt: from 0 to 70 degrees.
- Drift: moves the pattern along x, y or both, with a speed from 2 to 30 seconds per tile.

When the visitor asks the system for reduced motion, the exported CSS stops the drift. The class `fp-paused` pauses the drift, and the Pause motion button uses it.

Drift repaints the pattern layer on every frame. When drift is on, the panel gives an order of magnitude for this cost. It assumes 0.5 W of extra power and a world average grid of 480 g CO2 per kWh. With these values, one minute of drift is about 4 mg of CO2. The panel also tells how many times the transfer footprint this is. These two values are assumptions, not measurements. A phone can use 0.1 W and a large laptop screen 2 W. Real grids differ several times in both directions. The constants are `DRIFT_WATTS` and `GRID_G_PER_KWH` in `src/co2.ts`.

### Export

The "Use it" panel gives the design in three parts:

- CSS: the `.fp-pattern` class with the custom properties `--fp-bg`, `--fp-ink`, `--fp-tile` and `--fp-size`. With a plate, it also has the `.fp-plate` class. The Copy CSS button puts it on the clipboard.
- HTML: a sample section with the `fp-pattern` class and a paragraph with the `fp-plate` class.
- Script: an optional script with 2 to 5 tile variants. On click, each click on the pattern shows the next tile. On load, each page load shows a random tile.

Put the script after the markup. The script looks for the `.fp-pattern` elements only once, when it runs.

The "Other formats (experimental)" part of the Export tab gives the design in two more formats:

| Format | What it is | Limits |
| --- | --- | --- |
| Canvas script | A script that draws the tile with JavaScript on a canvas. | It is larger than the CSS export and needs JavaScript. Use it only as a base for a pattern that changes or never repeats. |
| CSS Paint worklet | A worklet, a small script that the browser runs to paint a background, for the CSS Paint API. Save it as `fp-pattern.worklet.js` and register it with `CSS.paintWorklet.addModule`. | It works in Chrome and Edge only. Other browsers show the fallback background color. |

Both formats draw one layer of straight lines. They are not available, and the panel gives the reason, in these cases:

- Smooth curves are on.
- The kind draws arcs, as Penrose arcs does.
- Reduce repetition is on.
- A second layer is on.

### Sharing

The page keeps the design in the URL hash. The hash holds the kind, seed, controls, colors, plate, spacing, motion, patchwork and repetition settings. The hash does not hold the pinned patchwork cells, the palette name or the image. The Copy link button puts the URL on the clipboard.

The hash writes only the values that differ from the default. The key `fi` holds the fill: the mode (`c` for all closed shapes, `a` for every second shape), the color without `#` and the opacity, joined by `_`. It is empty when the fill is off. These keys hold the repetition settings:

| Key | Meaning | Default |
| --- | --- | --- |
| `v` | Reduce repetition, `1` or `0` | `0` |
| `vo` | Options of Reduce repetition: cells, count, turn and flip, offset (`n`, `h` or `b`), mix of depths, shift and scale, line weight, empty cells, joined by `_` | 4 cells, 4 variants, all options off |
| `l2` | Second layer, `1` or `0` | `0` |
| `l2s` | Second layer settings: shift right, shift down, turn, size, strength, depth, joined by `_` | `0_0_0_1_1_1` |
| `px` | Parallax on scroll, `1` or `0` | `0` |
| `fd` | Soft fade, `1` or `0` | `0` |
| `sx` | Different angle per section, `1` or `0` | `0` |
| `l2c` | Own color of the second layer, without `#`; written only when it is on | absent (the pattern color) |

The page reads the hash as untrusted input. A missing or broken value takes its default, and a number outside its range is clamped. The older keys keep their meaning, so older links still work.

### Performance settings and CO2

The "Performance settings" panel controls the coordinate precision, from 0 to 3 decimals. Fewer decimals and less depth give a smaller tile.

The panel shows these sizes: "CSS" (raw and compressed), "SVG tile, as a file" and "Footprint". With the script on, it also shows "Script" (raw and compressed). The SVG tile is the raw SVG text; inside the CSS the tile is a data URI, which is larger. The toolbar badge shows the compressed total, for example "0.705 KB gz". On hover or keyboard focus it shows the same lines in a tooltip. Gzip is a standard compression format that web servers use. The footprint counts the exported CSS plus the script, each compressed with gzip. The browser computes the gzip size with its `CompressionStream` API.

The CO2 estimate is rough. It is a straight line from the gzipped size. The constant comes from the `inject-co2.mjs` script of pierreguilbert.com. That script uses one websitecarbon.com measurement of pierreguilbert.com: 5.76 KB gives 0.001144 g of CO2. The panel shows the value in milligrams with 1 decimal from 1 mg up, and with 1 significant digit below 1 mg.

The estimate counts one transfer of the export. It does not count these costs:

- The rest of your page.
- Browser caching. A repeat visit transfers nothing.
- The energy to draw the pattern on the visitor's device.

### Sizes

The goal is a small tile. Heavier options are allowed: a deep kind, Reduce repetition, a second layer, Smooth curves. The page always states the bytes and the CO2 of the result, so you can weigh the cost.

Some measured examples of the studio tile SVG, with seed 1, the Straight repeat, a 300 px tile and all families on:

| Theme | Density 0.4 (default) | Density 0.5 |
| --- | --- | --- |
| Floral | 11,846 bytes | 13,142 bytes |
| Sea | 10,068 bytes | 12,300 bytes |
| Orchard | 11,981 bytes | 13,045 bytes |

### Logo and favicon

The logo is one of the app's own patterns: the Whirl kind, seed 1, in the Lagoon, mono colors. `src/logo.ts` draws it. The command `make logo` writes it to `public/favicon.svg`.

While the page is open, the browser tab icon follows the current kind, seed and colors. With an image or a patchwork, the icon keeps the last single pattern.

## Wallpaper Studio

The Wallpaper Studio is a second page, `studio.html`. It makes original wallpapers from a seed. It has three themes, each with six motif families:

| Theme | Motif families |
| --- | --- |
| Floral | Leaf, Frond, Flower, Bud, Berries, Sprig |
| Sea | Kelp, Coral, Shell, Starfish, Fish, Bubbles |
| Orchard | Pear, Apple, Cherries, Lemon, Blossom, Leaf |

In the Orchard theme each plant (a stem with its branches) carries one kind of fruit, as a tree does. The plants are dealt the enabled fruit in turn, from a seeded shuffle, so several plants show several kinds. Leaves, blossom and the cherries that float in the gaps are shared by all plants.

The page builds a tile in these steps:

1. The stems. The first stem, the vine, runs through the tile and joins itself across the repeat, so it has no visible start or end. At high density there are two vines. Every other stem branches from an existing stem, between 20 and 80% of its length. With the Mirror repeat, one root stem replaces the vine.
2. The large motifs. Each plant gets one large motif at its tip. The vine has no tip, so its large motif sits at the end of a short side stalk. If the place is taken, the motif shrinks, then moves back along its stem, and the stem gets shorter.
3. The smaller motifs. They sit along each stem on alternating sides, one for each step of stem length, so a longer stem carries more of them. The step is 12% of the tile side at density 0.2, 9% at 0.5 and 7% at 0.9. Each plant also gets one short side branch with a small motif at its end.
4. The twigs. The page measures the largest empty areas. An area above 9% of the side gets a twig, a stalk with one or two small motifs, from the nearest stem. If no twig fits, a small filler motif goes there instead. There are at most 2 + 6 × density of them.
5. The filler. A few small filler motifs go in the larger gaps that are left.

Motifs keep a gap from the stems and motifs of other plants. The code generates every motif from plain geometry and the seed. The tool contains no copy of an existing design.

The controls:

- Seed and Shuffle.
- Theme: Floral, Sea or Orchard.
- Palette: the same 24 palettes as the pattern page.
- Density: 0 to 100%.
- Tile size: 200 to 500 px in steps of 20.
- Preview zoom: 50 to 200%. It changes only the preview.
- Show stems. The sea theme starts without stems, and the layout stays the same.
- Repeat: Straight, Half-drop, Brick or Mirror.
- Motif families: the six families of the theme. At least one stays on.

The page names the number of placements, motif definitions and colors. The toolbar shows the size of the SVG and its CO2 footprint. Download SVG saves the tile. Copy CSS puts a `.wallpaper` rule with the background color and the tile on the clipboard. If the browser blocks the clipboard, the page shows the rule to copy by hand.

### Your own motif

You can turn your own image or SVG file into a motif. A sample flower lets you try it without an image. The page reads the image twice: at 256 px on the longer side for Color shapes, and at 600 px for Ink and Line drawing, because line art loses its fine lines at 256 px.

The page has three methods:

| Method | What it does | Good for |
| --- | --- | --- |
| Color shapes | Groups the pixels into 2 to 6 colors and turns each color into one flat vector shape. The shapes stack in order. | Photos and flat art. |
| Ink | Splits the ink from the paper with a threshold and traces the outline of the ink. A loop inside a loop is a hole. | Line art in one color. |
| Line drawing | Finds the edges with an edge detector and draws them as lines. | Drawings where the edges matter. |

When you add an image, the page picks a method for you. It measures how dark the ink is against the paper (the contrast, from 0 to 1) and the share of pixels that are ink (the coverage). With a contrast of 0.35 or more and a coverage under 35%, it picks Ink. Otherwise it picks Color shapes. You can change the method.

The controls:

| Control | Range | Default | Method |
| --- | --- | --- | --- |
| Colors | 2 to 6 | 4 | Color shapes |
| Edge detector | the seven detectors of the pattern page | XDoG (ink lines) | Line drawing |
| Threshold | 0.05 to 0.9 | 0.3 | Line drawing |
| Shortest line | 2 to 40 px | 8 px | Line drawing |
| Detail | 0.15 to 1.2 | 0.6, or 0.3 for Ink | All |
| Smooth curves | on or off | off | All, for an image |
| Ink color or Line color | a color | the mean color of the ink | Ink and Line drawing |
| Size | 0.4 to 3 | 1, or 1.6 for Ink | All |
| Sits on the stem by | Its base or Its center | Its base for Color shapes, Its center for the others | All |
| Use it as | Large motifs, Leaves along the stems, or Both | Large motifs | All |
| Keep the image's colors | on or off | on | All |

A change of method resets Detail, Size and Sits on the stem by to the defaults of that method. If a drawing is very detailed, the page coarsens the detail and says so: "The drawing is very detailed. Detail was coarsened to ... to keep the motif at a workable size." The panel shows the number of shapes and the bytes.

An SVG file is read as vector shapes, not as a picture. The importer reads the `path`, `rect`, `circle`, `ellipse`, `line`, `polyline` and `polygon` elements and their fill, stroke and stroke width. It never copies markup. It keeps only numbers and colors and builds every path again from them. So a file cannot bring code or links into the tile. The importer skips these parts and lists what it skipped:

- Scripts, style blocks, event attributes such as `onclick`, and links to outside files (`href`).
- Definitions and references: `defs`, `symbol`, `use`, clip paths, masks, filters, patterns, gradients and markers.
- Text, images, foreign objects and nested `svg` elements.
- Elements with a transform, and shapes with units or percentages.

For an SVG file read as vector shapes, the page hides the method and tracing controls. A gradient or an unknown color is drawn black. If the file does not give a good result, the "Trace it as an image instead" button traces it with the three methods above.

The panel shows two notices:

- Use only images that you own or have a license for.
- Your image stays in your browser. Nothing is uploaded.

### Studio link

The page keeps the design in the URL hash. The link does not carry your own motif.

The studio has the same palettes as the pattern tool. The palette strip in the toolbar shows the five colors and the name, with previous, next and a random palette. The Palette select in the Design panel groups the palettes as Light and Dark; a random palette shows as "Random". The "Patterns" segment of the tool switch in the header opens the pattern tool with the same palette, and the "Wallpaper Studio" segment does the same in the other direction (keys `pn` and `pc` in the hash).

| Key | Meaning | Default |
| --- | --- | --- |
| `s` | Seed | `1` |
| `r` | Repeat: `0` Straight, `1` Half-drop, `2` Brick, `3` Mirror | `0` |
| `d` | Density, 0 to 1 | `0.4` |
| `z` | Tile size in px, 200 to 500 | `300` |
| `st` | Show stems, `1` or `0` | `1` |
| `t` | Theme: `f` Floral, `s` Sea, `o` Orchard | `f` |
| `f` | Motif families, a bit mask in the order of the theme's families, as in the table above | all |
| `pn` | Palette name, for example `Fern` | `Lagoon` |
| `pc` | A random palette: its five colors (paper, ink, stroke, accent, soft) as 6-digit hex, joined with a dot. Read when `pn` is absent or unknown | none |

Links made before the palette names used `p`, an index into the old 24 palettes. The page still reads it and opens the nearest palette by base hue (a best match), but never writes it.

## Building blocks not yet in the page

The repository holds tested modules that the pages do not use yet, or use only in part:

| Module | What it does | In the pages |
| --- | --- | --- |
| `src/motifgrid.ts` | A tile made of a grid of small motifs, each defined once and placed with `<use>`. | Only helpers: the variant order and the path check |
| `src/custom.ts` | A custom motif: strokes you draw in a square, repeated by a wallpaper group. | No |
| `src/wang.ts` | Wang tiles: square tiles with edge codes, laid out so that every shared edge matches. The styles are pipes, weave and paths. | The three styles, as the Pipes, Basketwork and Garden paths kinds |
| `src/penrose.ts` | A finite patch of the true Penrose tiling, next to the periodic approximant. | Only the approximant, as the Penrose kinds |
| `src/isolines.ts` | Contour lines of the smoothed brightness, kept only where an edge is strong. | Only the contour step, in the studio Color shapes and Ink methods |

The two-layer export is in the page, as Second layer. The fills are in the page, as the Fill group. The canvas script and the paint worklet are in the page, under "Other formats (experimental)".

## Requirements

You need these tools:

- Node.js 24 or later, from `engines` in `package.json`.
- npm.

## Quick start

Install the dependencies:

```sh
make install    # npm ci
```

Start the development server:

```sh
make dev        # npm run dev
```

The other targets:

```sh
make help       # list the targets
make typecheck  # npm run typecheck
make test       # npm test
make build      # npm run build
make preview    # npm run build, then npx vite preview
make ci         # lint, format check, typecheck, test and build, like the GitHub workflow
make clean      # remove dist
```

## Lint and format

A linter finds likely bugs and style problems in code. The project uses oxlint 1.91.0 for this. A formatter rewrites code to one layout. The project uses oxfmt 0.76.0. Both versions are pinned in `package.json`.

```sh
make lint          # npm run lint
make format        # npm run format
make format-check  # npm run format:check
make logo          # npm run logo
```

`make format` writes the changes. `make format-check` only reports the files that need a change.

oxfmt does not format the `.vue` files. It changed the text that the page shows, so `.oxfmtrc.json` ignores them.

To choose a new mark, write a contact sheet of candidates:

```sh
npm run logo -- candidates
```

The script writes `candidates.svg` in the current folder. Give a path after `candidates` to write the sheet there.

## Project layout

The pattern page:

| File | Role |
| --- | --- |
| `src/main.ts` | Mounts the Vue app, loads the stylesheet and keeps the favicon in step with the pattern. |
| `src/App.vue` | Header, toolbar, badges, hero, tabs and the R key. |
| `src/logo.ts` | The logo mark and its default kind, seed and colors. |
| `src/app-name.ts` | The app name. |
| `src/state.ts` | Reactive state, user actions and derived values for the page. |
| `src/state-export.ts` | The exported CSS and script, and their gzip size and footprint. |
| `src/state-share.ts` | The design in the URL hash and the undo history. |

Patterns:

| File | Role |
| --- | --- |
| `src/fractal.ts` | The kinds, families, labels, depths, tile shapes and layouts, and the SVG output. |
| `src/patterns/fractals.ts` | Generators of the Fractals family. |
| `src/patterns/lineart.ts` | Generators of the Line art family. |
| `src/patterns/surfaces.ts` | Generators of the Surfaces family, with the free and compatible layouts. |
| `src/patterns/symmetry.ts` | Generators of the 17 wallpaper groups. |
| `src/patterns/themes.ts` | Generators of Topography, Maze and Circuit. |
| `src/patterns/themes-water.ts` | Generators of Waves (seigaiha), Rain and Mountain ridges. |
| `src/patterns/themes-earth.ts` | Generators of Constellations, Roots and Cracked earth. |
| `src/patterns/themes-craft.ts` | Generators of Knotwork and Roof tiles. |
| `src/patterns/themes-air.ts` | Generators of Feathers and Chain and fence. |
| `src/patterns/themes-pipes.ts` | Generators of Pipes, Basketwork and Garden paths, from Wang tiles. |
| `src/patterns/themes-chladni.ts` | The Chladni figures generator. |
| `src/patterns/themes-sky.ts` | Generators of Clouds, Moons and Storm. |
| `src/patterns/themes-wild.ts` | Generators of Leaves, River, Thorns and Nest. |
| `src/patterns/themes-home.ts` | Generators of Railway, Quilt and Lanterns. |
| `src/patterns/util.ts` | Seeded random generator, tile placement and periodic clipping. |
| `src/penrose.ts` | Penrose tilings from de Bruijn's pentagrid, and the periodic approximant. |
| `src/quasi.ts` | Eightfold and twelvefold periodic approximants. |
| `src/wang.ts` | Wang tile layouts and styles. |
| `src/patchwork.ts` | The patchwork grid of cells. |
| `src/spacing.ts` | Zoom with wrap, gap and mirror tiling. |

Repetition:

| File | Role |
| --- | --- |
| `src/supertile.ts` | The larger tile of seeded variants, and the kinds that can vary. |
| `src/repetition.ts` | The options of Reduce repetition for each kind, and the measurement behind them. |
| `src/variants.ts` | The strengths and default options of Reduce repetition. |
| `src/layers.ts` | The second layer: coprime size, repeat distance and the stroke opacity at crossings. |
| `src/fade.ts` | The Soft fade masks. |

Image tracing:

| File | Role |
| --- | --- |
| `src/samples.ts` | The four built-in example pictures for the tracer, drawn in memory. |
| `src/trace.ts` | Image pixels to a binary edge map with seven detectors. |
| `src/vectorize.ts` | Edge map to simplified polylines in tile coordinates. |
| `src/smoothtrace.ts` | Image to smooth Bézier curves, for Smooth curves. |
| `src/curvefit.ts` | Curve fitting of point chains with cubic Bézier curves. |
| `src/isolines.ts` | Contour lines of the brightness, and the edge-snapped isoline tracer. |

Wallpaper Studio:

| File | Role |
| --- | --- |
| `studio.html` | The page shell that loads `src/studio/main.ts`. |
| `src/studio/main.ts` | Mounts the studio app. |
| `src/studio/StudioApp.vue` | The studio page: toolbar, preview, controls and Your own motif. |
| `src/studio/motifs.ts` | The generated motifs and families of the Floral theme. |
| `src/studio/motifs-sea.ts` | The generated motifs and families of the Sea theme. |
| `src/studio/motifs-orchard.ts` | The generated motifs and families of the Orchard theme. |
| `src/studio/compose.ts` | The themes, and a whole tile from a seed: stems, motifs, twigs and filler. |
| `src/studio/scatter.ts` | Seeded placement of motifs on a tile that wraps around. |
| `src/studio/model.ts` | The tile as layers of placed motifs with a repeat type, written as one SVG. |
| `src/studio/colortrace.ts` | Color tracing of an image into flat stacked shapes. |
| `src/studio/inktrace.ts` | The Ink method: the ink threshold and the outlines of the ink. |
| `src/studio/linetrace.ts` | The Line drawing method: edges of an image as lines. |
| `src/studio/svg-import.ts` | Reads an SVG file as vector shapes and rebuilds every path from numbers. |
| `src/studio/own-motif.ts` | The choice of method, the defaults of each method and the ink color. |
| `src/studio/studio-share.ts` | The studio design in the URL hash and back. |
| `src/css/studio.css` | Studio styles. |

Export, colors and the rest:

| File | Role |
| --- | --- |
| `src/motion.ts` | Transform, drift and parallax CSS on the `::before` and `::after` layers. |
| `src/export.ts` | The exported CSS, HTML sample and script. |
| `src/scene.ts` | A tile as ordered layers of polylines, written as SVG or drawn on a canvas. |
| `src/fills.ts` | Fills of closed shapes and the text contrast over every surface. |
| `src/canvas-export.ts` | The canvas script and CSS Paint worklet exports. |
| `src/alt-export.ts` | When the canvas script and the paint worklet can draw the design, and why not. |
| `src/motifgrid.ts` | The motif grid. The page uses only its helpers. |
| `src/custom.ts` | The custom motif engine, not yet in the page. |
| `src/palettes.ts` | The 24 generated palettes and the random palette rules. |
| `src/oklch.ts` | OKLCH to hex conversion. |
| `src/contrast.ts` | WCAG luminance, contrast ratio, color blend and levels. |
| `src/apca.ts` | APCA Lc through the apca-w3 package, unmodified: the worst Lc over the WCAG surfaces. |
| `src/css/apca.css` | Layout of the APCA block in the Colors panel. |
| `src/pairing.ts` | Role choice, worst-case ratio, plate ratio and contrast fixes. |
| `src/vision.ts` | CIE L* difference, in-between check and color vision simulation. |
| `src/css.ts` | SVG to data URI, CSS background and plate CSS. |
| `src/co2.ts` | Raw size, gzip size, CO2 estimate and drift energy. |
| `src/share.ts` | Design to URL query and back, with defaults and clamps. |
| `src/history.ts` | Linear undo and redo history. |
| `src/components/PatternPanel.vue` | Kind, layout, patchwork, seed, depth, tile size and stroke width. |
| `src/components/ImagePanel.vue` | Image drop and the trace controls. |
| `src/components/SpacingPanel.vue` | Zoom, gap and mirror. |
| `src/components/ColorPanel.vue` | Color roles, plate, contrast results, fix buttons and palettes. |
| `src/components/RoleInput.vue` | Color picker, hex field and chips for one role. |
| `src/components/VisionPanel.vue` | The Second opinion panel. |
| `src/components/MotionPanel.vue` | Transform and motion controls. |
| `src/components/OutputPanel.vue` | Performance settings, footprint and the export. |
| `src/css/app.css` | Page styles. |
| `src/env.d.ts` | Type declarations for Vite and `.vue` files. |
| `src/**/*.test.ts` | Unit tests, one file beside each logic module. |
| `scripts/make-logo.ts` | Writes `public/favicon.svg`, or a contact sheet of logo candidates. |
| `public/favicon.svg` | The static favicon. Vite copies it into `dist`. |
| `index.html` | The page shell that loads `src/main.ts`. |
| `vite.config.ts` | The Vite settings, with the two pages as build inputs. |
| `Makefile` | The make targets. |
| `.oxlintrc.json` | The oxlint rules. |
| `.oxfmtrc.json` | The oxfmt settings. |
| `.github/workflows/deploy.yml` | The build and deployment workflow. |

## Tests

The tests use the Node test runner, `node --test`, with no extra test library. Node strips the TypeScript types and runs the files directly. Type stripping removes the type annotations without a build step.

Each test file sits beside its module, for example `src/co2.test.ts` beside `src/co2.ts`. The imports use explicit `.ts` extensions because Node does not guess file extensions.

Run the tests:

```sh
make test       # npm test
```

There are 581 tests now: 579 pass and 2 are skipped. If the environment variable `FP_REFERENCE_SVG` points to a reference SVG file, the two skipped tests run:

- `src/motifgrid.test.ts` reads 7 motifs and 49 placements from that file, rebuilds the grid with `src/motifgrid.ts`, and checks that the result reproduces the file.
- `src/studio/svg-import.test.ts` reads the file with the SVG importer and checks that it reports the skipped `use` elements, or rejects the file.

Run them like this:

```sh
FP_REFERENCE_SVG=/path/to/reference.svg npm test
```

## Deployment

The workflow `.github/workflows/deploy.yml` runs on each push to `main`. You can also start it by hand from the Actions tab.

The build job does these steps:

1. Checks out the repository.
2. Installs Node 24 with the npm cache.
3. Runs `npm ci`.
4. Runs `npm run lint`.
5. Runs `npm run format:check`.
6. Runs `npm run typecheck`.
7. Runs `npm test`.
8. Runs `npm run build`.
9. Configures GitHub Pages.
10. Uploads `dist` as the GitHub Pages artifact.

The deploy job then publishes that artifact to GitHub Pages.

Do these steps one time, before the first deployment:

1. Open the repository on GitHub.
2. Go to Settings, then Pages.
3. Set Source to GitHub Actions.

The build writes two pages: `dist/index.html`, the pattern page, and `dist/studio.html`, the Wallpaper Studio.

`vite.config.ts` sets `base: './'`. The built page then loads its assets with relative paths. The site works under the `/fractal-patterns/` path without the repository name in the build.

## Credits

- Contrast formulas: [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- APCA™ Lc value: the npm package [apca-w3](https://github.com/Myndex/apca-w3) by Andrew Somers and Myndex Research, used unmodified under its own license (not MIT).
- Color vision simulation: Machado, Oliveira and Fernandes, "A Physiologically-based Model for Simulation of Color Vision Deficiency", IEEE TVCG 15(6), 2009.
- OKLab color space: [Björn Ottosson](https://bottosson.github.io/posts/oklab/).
- CO2 model: [pierreguilbert.com](https://pierreguilbert.com).

The code implements these published methods. The references name the sources and claim no endorsement:

- Penrose and other quasicrystal tilings: based on the pentagrid method of N. G. de Bruijn, "Algebraic theory of Penrose's non-periodic tilings of the plane", 1981.
- Eightfold tiling: after the Ammann-Beenker tiling, from the work of Robert Ammann and F. P. M. Beenker.
- Chladni figures: after the nodal figures of vibrating plates, Ernst Chladni, 1787.
- Wang tiles: after Hao Wang, 1961.
- Smooth curves: based on the curve fitting method of Philip J. Schneider, "An Algorithm for Automatically Fitting Digitized Curves", Graphics Gems, 1990.
- XDoG detector: after Winnemöller, Kyprianidis and Olsen, "XDoG: An eXtended difference-of-Gaussians compendium", 2012.
- Ink threshold: after the method of Nobuyuki Otsu, "A Threshold Selection Method from Gray-Level Histograms", IEEE Transactions on Systems, Man, and Cybernetics, 1979.

## License

MIT. See LICENSE.

The dependency apca-w3 has its own license, which is not MIT. See THIRD-PARTY-NOTICES.md.
