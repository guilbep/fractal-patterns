# Textures: baseline before the phase (T0)

Branch `textures` at main `ad7c1a6`. Read and measured before any texture code. Line numbers are for that commit.

## Grain today
- `src/grain.ts:6-11`: `{ on, amount 0-30 (peak opacity %), size (baseFrequency 0.3-1.2), tone dark | light }`, defaults `:13` `{ on: false, amount: 12, size: 0.75, tone: 'dark' }`. `GRAIN_TILE = 257` (prime), `:17`.
- `grainSvg` (`:24-33`): filter region = tile, sRGB, `feTurbulence fractalNoise numOctaves=3 stitchTiles="stitch"`, an `feColorMatrix` (tone RGB, alpha `3a - 1`), a rect at `opacity = amount / 100`.
- Pinned in `src/grain.test.ts`:
  - `:8-17`: the filter substrings, 257 × 257, the region, `opacity="0.12"`, and a length under 600.
  - `:19-36`: the link `gr=12_0.75_d`. When grain is off, nothing is written. Values are clamped, and a malformed value decodes as off. Three old links decode with grain off.
  - `:38-44`: the contrast blend.

## State, layering, contrast
- `src/state.ts:610` `grain` (reactive), `:612` `grainOut`.
- Composed SVG and PNG (`:638-660`): grain is redrawn at the pattern tile size (or the accent's lcm tile) as the bottom layer: grain, base, accent. PNG export includes it (`:644-647` → `svg` `:660` → `UseIt.vue:109-110` → `png-export.ts:37`).
- CSS (`src/export.ts:33-36, 61, 121, 126`): grain is on the element itself, under `::before`/`::after`, as `--fp-grain` at `--fp-grain-size: 257px`. Order: background color, grain, pattern, accent.
- Contrast: when `on && amount > 0`, `checkedRoles` (`state.ts:749-757`) adds grain. `pairing.ts:45-54` lists each surface twice: over the background and over the plate blend. The "On the accent" check drops grain (`:773`, `:805`).

## Link
- `src/share.ts:155` is `grain: 'gr'`. `:156` `colorSym: 'cs'` is last ("keep new keys last").
- The codec is at `:293-302`. Its format is `amount_size_d|l`. When grain is off, the value is empty. A malformed value gives the defaults.
- `te` is free.
- Studio uses its own `gr` (ground layer) in `src/studio/studio-share.ts`: another page, another codec.

## UI
- Grain controls: `src/components/RepetitionPanel.vue:325-341` (switch, Amount, Size reversed, Tone, byte hint). Repetition tab dot: `App.vue:309`.
- Colors tab: the Background item (`ColorPanel.vue:73-75`) holds only its RoleInput.
- The Pattern item's Fill fieldset (`:82-104`) is the model for a Texture fieldset after `:74`.

## Export and size
- `state-export.ts:80` and `:89` pass grain and its color.
- `exportGzipBytes` is at `:154`.
- `sizeBreakdown` is at `:158-163`. Its wheel image line (`:161`) is the model for a texture line.

## Worker and CO2
- The shared heavy worker (`src/heavy/*`: memo, slots, main-thread fallback, lazy start) can bake textures as a task, like `farrisWheel` (`src/patterns/farris-wheel-task.ts:61-77`). A worker cannot render an SVG filter, so baked textures compute their pixels in JS (inference).
- `src/co2.ts:23, 26, 29-31`: 0.5 W, 480 g/kWh, 4 mg/min of drift. Shown only in `MotionPanel.vue:9, 82`.

## Measured (one run each, Node v26.12.1)
| Measure | Result |
|---|---|
| `npm test` | 60.0 s, 997 tests, 995 pass, 2 skipped, 0 fail |
| `npm run typecheck` | 3.7 s |
| `npm run lint` | 0.19 s |
| One test file (`grain.test.ts`) | 0.20 s |
| Grain SVG, defaults | 393 chars, 258 B gzip |
| Grain CSS line | 472 chars, 297 B gzip |

Start JS (gzip, script + modulepreload files each page lists): Patterns 135,323 B, Studio 82,939 B, Builder 70,898 B.

The plan's check times (Node 22: full suite 2 min 52 s, typecheck 10 s) are slower than these.
