# Draw cost formula (for review)

Code: `src/draw-cost.ts`. Tests: `src/draw-cost.test.ts`.

## What the site shows

- **Once: 6.6 kB.** The compressed bytes of the design, sent one time. Its CO₂ comes from `co2Mg` in `src/co2.ts`.
- **While visible: none / low / high, ≈ X mg CO₂ per minute.** The cost of a live layer while it is on screen. A live layer is a live SVG filter, a blur behind the text plate, or drift motion.

## Formula

1. The browser redraws the live layer R times per minute.
2. One redraw takes `ms` of work. We measure it on this device (median of 20 draws into a hidden canvas).
3. Busy seconds per minute = R × ms / 1000.
4. Energy per minute (J) = busy seconds × 0.5 W.
5. CO₂ (mg) = J / 3 600 000 × 480 g/kWh × 1000.

## Assumptions

- **R = 60** for a static live filter. We assume the browser repaints it about once per second (scroll, resize, hover). This is a guess, not a measurement.
- **R = 3600** for drift motion: 60 frames per second for 60 s.
- **0.5 W** extra power while the device works (`DRIFT_WATTS`, the same value drift uses). A plausible range is 0.1 W (phone) to 2 W (large laptop screen).
- **480 g CO₂ per kWh** (`GRID_G_PER_KWH`), a rough world average.
- A redraw into a hidden canvas costs about the same as the real repaint on the page.

## Levels

- **none**: no live layer.
- **low**: less than 4 ms per redraw.
- **high**: 4 ms per redraw or more.

## Worked examples

| Case | ms per redraw | R | Busy s/min | J/min | mg CO₂/min |
|---|---|---|---|---|---|
| Live filter, fast | 1 | 60 | 0.06 | 0.03 | 0.004 |
| Live filter, slow | 10 | 60 | 0.6 | 0.3 | 0.04 |
| Always busy | 1000 | 60 | 60 | 30 | 4 (same as drift) |
| Drift, 2 ms per frame | 2 | 3600 | 7.2 | 3.6 | 0.48 |

The "always busy" row is the check: a layer that keeps the device busy all minute costs the same as drift, 4 mg per minute.

## Text

- `Once: 6.6 kB` (bytes / 1024, one decimal, like the size badge).
- `While visible: none`
- `While visible: high, ≈ 0.04 mg CO₂ per minute (estimate, measured on this device)` (mg with 2 significant digits).
