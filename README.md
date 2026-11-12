# Fractal Patterns

Fractal Patterns is a one-page generator of repeating SVG background tiles made of seeded fractals. It tests the tile colors against the WCAG 2.2 contrast thresholds and estimates the CO2 cost of the tile.

## Live site

The site will be at <https://guilbep.github.io/fractal-patterns/> after the first deployment.

## What it does

### Patterns and controls

A seed is a number that starts the random generator. The same seed and the same controls always give the same tile.

The page draws four fractal kinds:

- Carpet: a 3 by 3 grid with square holes in the centre cell and in random cells.
- Quadtree: a square split by off-centre crosses, with random cells split again.
- Tree: a binary tree with random branch angles and lengths.
- Folded curve: a paperfolding curve of the dragon family, with cut corners.

The Pattern panel has these controls:

- Fractal: one of the four kinds, each with a live preview.
- Seed: a whole number from 0 to 4294967295.
- Depth: the number of recursion levels, from 1 to 3 for Carpet, 6 for Quadtree, and 10 for Tree and Folded curve.
- Tile size: 40 to 240 px.
- Stroke width: 0.5 to 6 px.

Each change to a control redraws the tile at once. These user events draw a new random seed:

- A click on the Shuffle button.
- A click on the pattern itself.
- A press on the R key. The page ignores the key in a text field and with Ctrl, Cmd or Alt.

The Reset button returns all values to the first-load state, including the seed drawn at load.

### Palettes and color roles

The page has 35 palettes from <https://hookagency.com/website-color-schemes>. The default palette is Classic Double Blue.

The tile uses three color roles:

- Background: fills the tile.
- Pattern: the fractal strokes, drawn at the pattern opacity.
- Text: the text that sits on top of the tile.

When you pick a palette, the pair of colors with the highest contrast becomes background and text. The lighter color of the pair becomes the background. The pattern gets the remaining color with the highest contrast against the text. You can also set each role with a color picker, a hex field or the chips of the current palette. The Swap button exchanges background and text.

### Contrast

A contrast ratio is a number from 1 to 21 that compares the luminance of two colors. The page uses the WCAG 2.2 formulas.

Text crosses both the plain background and the strokes. The page computes two ratios:

- Text on background.
- Text on pattern, with the pattern blended over the background at its opacity.

The lower of the two is the worst-case ratio, and the page judges the text by it. The page shows the ratio truncated to two decimals, so 4.499 shows as 4.49.

| Level | Normal text | Large text |
| --- | --- | --- |
| AA | 4.5 | 3 |
| AAA | 7 | 4.5 |

The pattern is decorative, so it is exempt from WCAG 1.4.11. The page shows a pattern visibility ratio for information only. See the W3C Understanding pages:

- [Understanding 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), the AA level for text.
- [Understanding 1.4.6](https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html), the AAA level for text.
- [Understanding 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), non-text contrast.

### Fix contrast

The page has one fix button for AA (4.5) and one for AAA (7). When the worst-case ratio already meets the target of a button, that button is inactive.

The fix changes the text color first. It moves the text toward black or toward white in 100 small steps and keeps the smallest change that meets the target. If no text color meets the target, it lowers the pattern opacity by 0.05 and tries the text again. It stops at opacity 0.

If the target cannot be reached, the page applies the best ratio it found. Then it tells you that it did not reach the target and suggests another background or palette.

### Performance settings and CO2

The "Performance settings" panel controls the coordinate precision, from 0 to 3 decimals. Fewer decimals and less depth give a smaller tile.

The panel shows three values:

- SVG size: the raw size of the tile in bytes.
- Gzipped: the size after gzip, a standard compression format.
- Footprint: the estimated CO2 per visit in milligrams.

The CO2 estimate is linear in the gzipped size. The constant comes from the `inject-co2.mjs` script of pierreguilbert.com. That script uses one websitecarbon.com calibration point: 5.76 KB gives 0.001144 g of CO2. The estimate counts only the tile, not the rest of your page. The browser computes the gzip size with its `CompressionStream` API.

### Output

A data URI is a URL that holds the file content itself. The page gives the tile in two forms:

- CSS: a `background-color` line and a `background-image` line with the SVG as a data URI. The Copy CSS button puts it on the clipboard.
- SVG: the Download SVG link saves the tile as `fractal-<kind>-<seed>.svg`.

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
| `src/App.vue` | Page layout, preview, Shuffle and Reset buttons, R key. |
| `src/state.ts` | Reactive state, user actions and derived values for the page. |
| `src/fractal.ts` | Seeded fractal geometry and SVG output. |
| `src/palettes.ts` | The palette list and its source URL. |
| `src/contrast.ts` | WCAG luminance, contrast ratio, color blend and levels. |
| `src/pairing.ts` | Role choice from a palette, worst-case ratio and contrast fix. |
| `src/css.ts` | SVG to data URI and CSS background. |
| `src/co2.ts` | Raw size, gzip size and CO2 estimate. |
| `src/components/ColorPanel.vue` | Color roles, contrast results, fix buttons and palettes. |
| `src/components/RoleInput.vue` | Color picker, hex field and chips for one role. |
| `src/components/PatternPanel.vue` | Fractal kind, seed, depth, tile size and stroke width. |
| `src/components/OutputPanel.vue` | Performance settings, CO2 footprint, CSS copy and SVG download. |
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

There are 47 tests now.

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

- Palettes: [Hook Agency website color schemes](https://hookagency.com/website-color-schemes).
- Contrast formulas: [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- CO2 model: [pierreguilbert.com](https://pierreguilbert.com).
