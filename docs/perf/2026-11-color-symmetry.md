# Speed, Color symmetry phase

## What changed

The Color symmetry phase adds:
- a second way to draw the 17 symmetry kinds: Farris color fields, as color bands (vector SVG) or as a smooth wheel (WebP image),
- the Color symmetry card in the Pattern tab, with a "How it's made" fold,
- six link keys (`cs`, `cw`, `cd`, `cb`, `cm`, `co`). If Color symmetry is off, the page does not write them,
- a shared heavy-task Web Worker. The Smooth wheel uses it.

The card, the tile code and the worker load on demand. At the first symmetry kind, the card loads. At the first Color symmetry tile, the tile code loads. At the first wheel, the worker starts.

## How to measure

Run `make perf`. It builds the site for production, serves it with `vite preview`, and runs Lighthouse (mobile) 3 times per page. The tables give the median.

Start JavaScript is the sum of the gzip sizes (default level) of the script and modulepreload files that each `dist/*.html` lists.

The "after" numbers come from the production build of commit `f63c09a`, on one machine, on one day.

## Lighthouse, before (phase 11)

This table is the "after" table of `docs/perf/2026-11-phase11.md`. I did not run it again.

```
| Page | Score | FCP ms | LCP ms | TBT ms | CLS | Bytes | Script eval ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| Patterns | 97 | 1956 | 2182 | 39 | 0.000 | 154795 | 210 |
| Studio | 98 | 1805 | 1957 | 59 | 0.000 | 103612 | 159 |
| Builder | 99 | 1668 | 1804 | 0 | 0.000 | 89511 | 110 |
```

## Lighthouse, after (Color symmetry)

```
| Page | Score | FCP ms | LCP ms | TBT ms | CLS | Bytes | Script eval ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| Patterns | 96 | 2103 | 2329 | 0 | 0.000 | 156470 | 192 |
| Studio | 99 | 1665 | 1879 | 0 | 0.000 | 104024 | 153 |
| Builder | 99 | 1520 | 1806 | 0 | 0.000 | 89877 | 118 |
```

## Start JavaScript, gzip bytes

| Page | phase 11 | Color symmetry | Change | Within +2 kB (2048 bytes) |
|---|---:|---:|---:|---|
| Patterns | 133500 | 135383 | +1883 | yes |
| Studio | 82378 | 82855 | +477 | yes |
| Builder | 70380 | 70812 | +432 | yes |

I measured the "Color symmetry" column on my build. The orchestrator measured Patterns 135291 and Studio 82939 on its build. Both sets are within +2048 bytes.

## On-demand files

| File | Raw bytes | Gzip bytes |
|---|---:|---:|
| ColorSymmetryPanel JS (with How it's made) | 7778 | 3009 |
| ColorSymmetryPanel CSS | 389 | 239 |
| color-sym-tile JS (with farris-bands) | 3064 | 1576 |
| farris JS | 2194 | 1146 |
| heavy client JS | 1947 | 1058 |
| farris-wheel-task JS | 2341 | 1145 |
| heavy.worker JS | 10000 | 4218 |

The build puts `farris-bands.ts` in the color-sym-tile file. It has no file of its own. No `dist/*.html` lists these files. They are not in start JavaScript.

## Tile sizes and timings

The orchestrator measured these, not this note's author.

- The color field is the same under every operation of its group, to 1e−9, for all 17 groups.
- Bands tiles (n = 64, waves 6, detail 4, seeds 1 to 5): gzip median 1.0 to 2.5 KB, max 3.0 KB. With detail 6, max 4.5 KB.
- Bands tiles take 2 to 8 ms each, on a desktop.
- Wheel tiles: p4m seed 5 is 7162 bytes WebP, p6m seed 3 is 7346 bytes WebP. Seam ratio 0.36 and 0.33. No PNG fallback was needed.
- PNG export of a wheel design works: 1280 by 800, about 300 KB.

## What the numbers show

Patterns loads 1.9 kB more JavaScript at start. That is the loader of the card, the link keys and the state for Color symmetry. It stays under the phase limit of 2 kB, but it is close to it. Studio and Builder load about 0.5 kB more. They share start chunks with Patterns.

A visitor who opens a symmetry kind loads the card (about 3.2 kB gzip). Color symmetry on adds the tile code (about 2.7 kB gzip). The Smooth wheel adds the worker and its client (about 6.4 kB gzip). Before that, they cost nothing.

The layout shift is 0.000 on the three pages. The Patterns score is 96, one point lower. Its FCP is 147 ms slower and its LCP 147 ms slower, and its TBT is 39 ms lower. Studio is faster, and Builder FCP is 148 ms faster. These numbers vary from run to run, also on an unchanged build. They do not prove a change.
