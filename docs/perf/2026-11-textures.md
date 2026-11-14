# Speed, Textures phase

## What changed

The Textures phase adds:
- a "Texture" group under Colors › Background, with "None" and 11 kinds. Grain moved here from the Repetition tab,
- surface textures (paper, cold-press, linen, plaster, sand, riso), fiber textures (washi, kraft), vector textures (terrazzo, stipple), and live SVG filters,
- baking to a WebP image in the shared heavy-task worker,
- one link key, `te`. For grain or no texture, the page does not write it,
- size badge lines "Once" and "While visible", from a small cost model.

The Texture panel, the filters, the vector code, the bake code and the cost model load on demand.

## How to measure

Run `make perf`. It builds the site for production, serves it with `vite preview`, and runs Lighthouse (mobile) 3 times per page. The tables give the median.

Start JavaScript is the sum of the gzip sizes (default level) of the script and modulepreload files that each `dist/*.html` lists.

The "after" numbers come from the production build of commit `185c988`, on one machine, on one day.

## Lighthouse, before (Color symmetry)

This table is the "after" table of `docs/perf/2026-11-color-symmetry.md`. I did not run it again.

```
| Page | Score | FCP ms | LCP ms | TBT ms | CLS | Bytes | Script eval ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| Patterns | 96 | 2103 | 2329 | 0 | 0.000 | 156470 | 192 |
| Studio | 99 | 1665 | 1879 | 0 | 0.000 | 104024 | 153 |
| Builder | 99 | 1520 | 1806 | 0 | 0.000 | 89877 | 118 |
```

## Lighthouse, after (Textures)

```
| Page | Score | FCP ms | LCP ms | TBT ms | CLS | Bytes | Script eval ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| Patterns | 94 | 2288 | 2534 | 75 | 0.000 | 162108 | 309 |
| Studio | 99 | 1674 | 1885 | 0 | 0.000 | 104049 | 237 |
| Builder | 99 | 1505 | 1807 | 75 | 0.000 | 89899 | 176 |
```

`make perf` exited 0.

## Start JavaScript, gzip bytes

| Page | Color symmetry | Textures | Change | Within +2 kB (2048 bytes) |
|---|---:|---:|---:|---|
| Patterns | 135383 | 136957 | +1574 | yes |
| Studio | 82855 | 82883 | +28 | yes |
| Builder | 70812 | 70833 | +21 | yes |

I measured the "Textures" column on my build. The "Color symmetry" column is from `docs/perf/2026-11-color-symmetry.md`.
The orchestrator measured Patterns on its own build: main 135574 bytes, textures 136876 bytes, so +1302 bytes. Both sets are within +2048 bytes.

## On-demand files

| File | Raw bytes | Gzip bytes |
|---|---:|---:|
| TexturePanel JS | 4795 | 1899 |
| TexturePanel CSS | 246 | 161 |
| filters JS (live filters) | 1907 | 949 |
| vector JS (terrazzo, stipple) | 2702 | 1347 |
| bake JS (surfaces, fibers, noise, WebP encode) | 5818 | 2759 |
| bake-client JS | 725 | 443 |
| draw-cost JS | 1394 | 842 |
| heavy.worker JS (now with the bake task) | 16378 | 6639 |

`src/textures/surfaces.ts`, `fibers.ts` and `noise.ts` have no file of their own. The build puts them in the bake file and the worker. The main Patterns file also holds some texture code: the names "coldpress", "washi" and "terrazzo" are in it. No `dist/*.html` lists the files above. They are not in start JavaScript.

## Texture sizes and costs

The orchestrator measured these, not this note's author.

- A browser check on the production build: all 12 kind and route cases render, with no console error.
- "Once" at strength 80: paper baked 8.0 kB, paper live 2.3 kB, cold-press 7.0, linen 3.9, plaster 6.7, washi 2.7, kraft 13.6, sand live 2.3 and baked 12.6, riso live 2.3, terrazzo 3.0, stipple 5.8 kB.
- Live layers measured "low", about 0.001 to 0.002 mg CO₂ per minute. This is an estimate, measured on one device. The formula is in `docs/review/draw-cost-formula.md`.
- Baked WebP at strength 40: paper 2.2 KB, cold-press 2.9, linen 1.1, plaster 1.5, washi 0.8, kraft 3.2, sand 1.9, riso 14.1 KB.
- Live filters: 335 to 407 bytes gzip.
- Vector textures: terrazzo about 0.7 KB gzip, stipple about 2.1 KB gzip.
- Unit tests: 1077 tests, 1075 pass, 0 fail. Browser tests (e2e): 89 passed.

Visual notes for the owner to judge: washi is very faint, also at 80 %. Kraft reads as grey scribbles on a white background. Cold-press shows large soft clouds.

## What the numbers show

Patterns loads 1.6 kB more JavaScript at start. That is the texture state, the link key, the export wiring and the panel loader. It stays under the phase limit of 2 kB. Studio and Builder change by less than 30 bytes.

A visitor who opens the Colors tab loads the Texture panel (about 2.1 kB gzip). A baked texture adds the bake code and the worker. A live texture adds the filters (about 0.9 kB gzip). A vector texture adds about 1.3 kB gzip. Before that, they cost nothing.

The layout shift is 0.000 on the three pages. The Patterns score is 94, two points lower. Its FCP is 185 ms slower, its LCP 205 ms slower, its TBT 75 ms higher, and its script eval 117 ms longer. Studio is about the same. Builder TBT is 75 ms higher. These numbers vary from run to run, also on an unchanged build. They do not prove a change. The Patterns script eval rise is the largest change, so measure it again in the next phase.
