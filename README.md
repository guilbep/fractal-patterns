# Fractal Patterns

Fractal Patterns is a one-page generator of repeating SVG background tiles, made from seeded math or from your own image. It tests the colors against the WCAG 2.2 contrast thresholds and estimates the CO2 cost of the result.

## Live site

The site will be at <https://guilbep.github.io/fractal-patterns/> after the first deployment.

## What it does

### Pattern library

The page draws 37 pattern kinds in four families:

| Family | Kinds | Names |
| --- | --- | --- |
| Fractals | 8 | Carpet, Quadtree, Tree, Folded curve, Hilbert curve, Koch lattice, Sierpinski, H-tree |
| Line art | 4 | Curve stitching, Whirl, Rosette, Spirals |
| Surfaces | 13 | Running bond, Stack bond, Herringbone, Basket weave, Honeycomb, Triangular net, Nested boxes, Dot grid, Hatch, Crosshatch, Zigzag, Fish scales, Waves |
| Symmetry groups | 12 | p1 translation, p2 half turn, pm mirror, pg glide, cm mirror and glide, pmm two mirrors, pmg mirror and glide, pgg two glides, cmm two mirrors, centered, p4 quarter turn, p4m quarter turn and mirrors, p4g quarter turn and glides |

A wallpaper group is one of the 17 ways to repeat a motif over a plane with mirrors, turns and glides. The page has the 12 groups that fit a square tile. The 5 hexagonal groups are not included, because the tile is square.

Each kind has its own maximum depth, the number of recursion or detail levels. The other controls are tile size and stroke width.

### Seeds and events

A seed is a number that starts the random generator. The same seed and the same controls always give the same tile. The seed is a whole number from 0 to 4294967295.

These user events draw a new random seed:

- A click on the Shuffle button.
- A click on the pattern in the hero, the large preview at the top of the page.
- A press on the R key. The page ignores the key in a text field and with Ctrl, Cmd or Alt.

A checkbox turns the R key shortcut off, as WCAG 2.1.4 requires for single-key shortcuts. The page keeps this choice after a reload. Shuffle applies to math patterns only.

The Undo and Redo buttons step through the history of the design. Ctrl+Z or Cmd+Z undoes a change. Ctrl+Shift+Z or Cmd+Shift+Z redoes it. In a form field, the browser text undo applies instead. The Reset button returns all values to the first-load state.

### Patchwork

The patchwork layout splits the tile into a grid of cells, and each cell gets a different kind. The grid is 2 by 2, 3 by 3 or 4 by 4. You choose the families that the cells can use. You can pin a kind to a cell, and Shuffle then keeps that cell. An option draws frame lines between the cells. The maximum depth is 3 for a 2 by 2 grid and 2 for the larger grids.

### Spacing

- Zoom: scales the pattern inside the tile from 0.5 to 3, and wraps the parts that leave the tile to the opposite side.
- Gap: adds 0 to 120 px of empty space between the repeats of the tile.
- Mirror: puts four mirrored copies of the content in the tile, so any content repeats without a seam.
- Fit: for an image, Cover fills the tile and crops the longer side. Contain shows the whole image and leaves an empty strip.

### From image

The page can trace the edges of your image and turn them into tile lines. An edge detector is a filter that finds the places where the brightness changes quickly. The page has five detectors:

- Sobel.
- Prewitt.
- Roberts.
- Laplacian.
- Canny, the default.

The controls are the edge detector, the threshold, the detail, the minimum line length, the fit and the resolution. The resolution is 128, 192 or 256 px on the longer edge. The vectorizer then follows the edge pixels and turns them into simplified polylines in tile coordinates.

Your image stays in your browser. The page uploads nothing. Use only images that you own or have a license for.

A traced tile repeats without a seam only with Mirror or with a source image that already repeats.

### Colors

The page has 24 palettes. The app generates them by rule from a hue and a harmony scheme in the OKLCH color space. OKLCH describes a color by its lightness, chroma and hue, in steps that look even to the eye. The six hues are Brick, Ochre, Moss, Lagoon, Indigo and Plum. The four schemes are mono, analogous, complement and triad. The default palette is Lagoon, mono.

The tile uses three color roles:

- Background: fills the tile.
- Pattern: the strokes, drawn at the pattern opacity.
- Text: the text that sits on top of the tile.

When you pick a palette, the page chooses the roles by contrast. You can also set each role with a color picker, a hex field or the chips of the current palette. The Swap button exchanges background and text.

The text plate is a box with a background color behind the text. It has three modes:

- Plate: the heading and the paragraph sit on the plate.
- Split: only the paragraph sits on the plate, and the heading sits on the bare pattern. This is the default.
- Direct: there is no plate.

The plate has its own opacity, corner radius and blur.

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

The Fix buttons target AA or AAA. The fix depends on the plate mode:

- Direct: the fix moves the text toward black or white. If that is not enough, it lowers the pattern opacity in steps of 0.05 and tries again.
- Plate: the fix raises the plate opacity in steps of 0.05. At a full plate, it changes the text color.
- Split: the fix first brings the heading to the large-text level on the bare pattern. Then it fixes the paragraph with the plate.

If the fix cannot reach the target, the page applies the best result and tells you.

The Second opinion panel adds three checks:

- Lightness difference: the difference in CIE L*, a lightness scale from 0 to 100, between the text and each surface.
- In-between warning: the page warns when the text is darker than one surface and lighter than the other. The strokes then cross the letters with reversed polarity.
- Color vision preview: the colors as people with protan, deutan or tritan color vision see them, after Machado, Oliveira and Fernandes (2009).

### APCA

The tool does not include APCA, the Accessible Perceptual Contrast Algorithm. Its license does not fit an MIT-licensed project, see <https://git.apcacontrast.com/>.

### Transform and motion

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

### Sharing

The page keeps the design in the URL hash. The hash holds the kind, seed, controls, colors, plate, spacing, motion and patchwork settings. The hash does not hold the pinned patchwork cells, the palette name or the image. The Copy link button puts the URL on the clipboard.

### Performance settings and CO2

The "Performance settings" panel controls the coordinate precision, from 0 to 3 decimals. Fewer decimals and less depth give a smaller tile.

The panel shows the size of the export and a footprint. Gzip is a standard compression format that web servers use. The footprint counts the exported CSS plus the script, each compressed with gzip. The browser computes the gzip size with its `CompressionStream` API.

The CO2 estimate is rough. It is a straight line from the gzipped size. The constant comes from the `inject-co2.mjs` script of pierreguilbert.com. That script uses one websitecarbon.com measurement of pierreguilbert.com: 5.76 KB gives 0.001144 g of CO2. The panel shows the value in milligrams with 1 decimal from 1 mg up, and with 1 significant digit below 1 mg.

The estimate counts one transfer of the export. It does not count these costs:

- The rest of your page.
- Browser caching. A repeat visit transfers nothing.
- The energy to draw the pattern on the visitor's device.

## Requirements

- Node.js `>= 26 || ^24 || ^22.12`, from `engines` in `package.json`.
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
make ci         # typecheck, test and build, like the GitHub workflow
make clean      # remove dist
```

## Project layout

| File | Role |
| --- | --- |
| `src/main.ts` | Mounts the Vue app and loads the stylesheet. |
| `src/App.vue` | Page layout, hero, Shuffle, Reset, Undo, Redo, Copy link and the R key. |
| `src/app-name.ts` | The app name. |
| `src/state.ts` | Reactive state, user actions and derived values for the page. |
| `src/state-export.ts` | The exported CSS and script, and their gzip size and footprint. |
| `src/state-share.ts` | The design in the URL hash and the undo history. |
| `src/fractal.ts` | The kinds, families, labels and depths, and the SVG output. |
| `src/patterns/fractals.ts` | Generators of the Fractals family. |
| `src/patterns/lineart.ts` | Generators of the Line art family. |
| `src/patterns/surfaces.ts` | Generators of the Surfaces family. |
| `src/patterns/symmetry.ts` | Generators of the 12 square wallpaper groups. |
| `src/patterns/util.ts` | Seeded random generator, tile placement and periodic clipping. |
| `src/patchwork.ts` | The patchwork grid of cells. |
| `src/spacing.ts` | Zoom with wrap, gap and mirror tiling. |
| `src/trace.ts` | Image pixels to a binary edge map with five detectors. |
| `src/vectorize.ts` | Edge map to simplified polylines in tile coordinates. |
| `src/motion.ts` | Transform and drift CSS on the `::before` layer. |
| `src/export.ts` | The exported CSS, HTML sample and script. |
| `src/palettes.ts` | The 24 generated palettes. |
| `src/oklch.ts` | OKLCH to hex conversion. |
| `src/contrast.ts` | WCAG luminance, contrast ratio, color blend and levels. |
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
| `src/*.test.ts` | Unit tests, one file beside each logic module. |

## Tests

The tests use the Node test runner, `node --test`, with no extra test library. Node strips the TypeScript types and runs the files directly. Type stripping removes the type annotations without a build step.

Each test file sits beside its module, for example `src/co2.test.ts` beside `src/co2.ts`. The imports use explicit `.ts` extensions because Node does not guess file extensions.

Run the tests:

```sh
make test       # npm test
```

There are 188 tests now.

## Deployment

The workflow `.github/workflows/deploy.yml` runs on each push to `main`. You can also start it by hand from the Actions tab.

The build job does these steps:

1. Installs Node 24 and runs `npm ci`.
2. Runs `npm run typecheck`, `npm test` and `npm run build`.
3. Uploads `dist` as the GitHub Pages artifact.

The deploy job then publishes that artifact to GitHub Pages.

Do these steps one time, before the first deployment:

1. Open the repository on GitHub.
2. Go to Settings, then Pages.
3. Set Source to GitHub Actions.

`vite.config.ts` sets `base: './'`. The built page then loads its assets with relative paths. The site works under the `/fractal-patterns/` path without the repository name in the build.

## Credits

- Contrast formulas: [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- Color vision simulation: Machado, Oliveira and Fernandes, "A Physiologically-based Model for Simulation of Color Vision Deficiency", IEEE TVCG 15(6), 2009.
- OKLab color space: [Björn Ottosson](https://bottosson.github.io/posts/oklab/).
- CO2 model: [pierreguilbert.com](https://pierreguilbert.com).

## License

MIT. See LICENSE.
