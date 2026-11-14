# Large tile: which kinds can draw a larger period

A large tile draws the same pattern over a period `m` times the tile size (m = 1 to 6). The features keep
their scale, so the repeat is far less visible. The cost is bytes, about m².

Engine: `geometry({ kind, seed, depth, size, period })` returns a tile of `size × period` px for the
kinds with `large: true` in `PATTERNS` (`src/fractal.ts`). Other kinds clamp the period to 1.
`largeTileKinds()` and `largeTileBytes()` are in `src/large-tile.ts`. With `period: 1` every output is
byte-identical to the output before this change (pinned in `src/large-tile.test.ts`).

## Classes

- (a) free: the generator has a count or frequency that scales with m. Done.
- (b) repeats inside: a larger period holds m × m identical copies. No gain.
- (c) needs work: possible, but the generator must change (more than a count). Or it shares draws with
  a hook (accent) that must change with it.

"inferred" = classified from the generator's comment and its top-level counts, not a full read.

| Kind                                                                                                                | Class | Why                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| topo                                                                                                                | a     | Periodic sine field. Period m: m² times the terms. Integer frequencies go up to 4m with i + j ≥ m, the same wavelengths as m = 1. The sample grid is 48 m. Levels spaced by the mean range of the m × m one-tile squares, so the contour spacing stays. |
| maze                                                                                                                | a     | DFS on a torus of n × n cells: n × m cells of the same size.                                                                                                                                                                                            |
| cracks                                                                                                              | a     | Toroidal Voronoi of n scattered seeds: n × m² seeds on an m times larger torus, same mean cell.                                                                                                                                                         |
| circuit                                                                                                             | c     | Toroidal grid: n × m is free, but trace count (n) and trace length (up to n) must not follow the grid size. Small change.                                                                                                                               |
| stars                                                                                                               | c     | Scatter: n × m² is free, but the constellation count (1 + depth) must scale with m². Small change.                                                                                                                                                      |
| roots                                                                                                               | c     | Occupancy grid and main-root count are per tile. The step is size / 30. Inferred.                                                                                                                                                                       |
| rain, storm                                                                                                         | c     | Staggered grid / bolts placed per tile third. Inferred.                                                                                                                                                                                                 |
| truchet                                                                                                             | c     | depth × depth random cells: the count scales, but the accent hook replays the generator's draws and must follow.                                                                                                                                        |
| sprigs                                                                                                              | c     | Scatter with an accent hook that replays draws. Inferred.                                                                                                                                                                                               |
| pipes, weave, paths, endlessmaze, endlessrail                                                                       | c     | Wang cells (depth = cells per side). The count can scale, but `src/wang.ts` is being rewritten by another ticket. Inferred.                                                                                                                             |
| penrose, penrosearcs, penroseboth                                                                                   | c     | A larger period is a higher approximant: less repeat at the same rhomb size. But today the level is the depth, and the arcs are an `extra` path.                                                                                                        |
| octa, octastars, dodeca, dodecastars                                                                                | c     | Approximant tiles like Penrose. Inferred.                                                                                                                                                                                                               |
| quadtree, tree, stitch, whirl, spiral                                                                               | c     | One seeded figure per tile or per cell: a large tile needs m² independent figures. Inferred.                                                                                                                                                            |
| seigaiha, ridges, knot, roof, feathers, chain, clouds, moons, leaves, river, thorns, nest, railway, quilt, lanterns | c     | A fixed layout per tile (rows, a 3 × 3 grid, whole periods) with seeded details. A large tile needs per-cell layout counts and details. Inferred.                                                                                                       |
| chladni                                                                                                             | b     | The figure is whole plate modes per tile. Mode numbers times m give m × m copies. Other mode numbers change the figure, not its scale.                                                                                                                  |
| carpet, fold, hilbert, koch, sierpinski, htree                                                                      | b     | Deterministic fractal figure per tile.                                                                                                                                                                                                                  |
| rosette                                                                                                             | b     | Rose curves centred on the tile.                                                                                                                                                                                                                        |
| brick, stack, herringbone, basket, hex, trinet, nested, dots, hatch, crosshatch, zigzag, scales, waves              | b     | Regular lattice. The seed picks a layout, not per-cell variation. Inferred for dots.                                                                                                                                                                    |
| p1, p2, pm, pg, cm, pmm, pmg, pgg, cmm, p4, p4m, p4g, p3, p3m1, p31m, p6, p6m                                       | b     | Wallpaper groups. The motif repeats on the lattice by definition.                                                                                                                                                                                       |

Totals: a 3, b 38, c 39 (80 kinds).

## Bytes

Measured with `largeTileBytes`: seed 1, size 120, stroke 2, precision 1. Gzip is Node zlib at its default level.
Topography depth 1, Maze depth 3, Cracked earth depth 3 (preferred depths).

| Kind   | Period | Raw bytes | Gzip bytes |
| ------ | ------ | --------- | ---------- |
| topo   | 1      | 2 097     | 775        |
| topo   | 2      | 9 359     | 3 454      |
| topo   | 3      | 21 503    | 7 333      |
| topo   | 4      | 35 120    | 11 734     |
| topo   | 6      | 74 724    | 24 161     |
| maze   | 1      | 709       | 373        |
| maze   | 2      | 2 460     | 900        |
| maze   | 3      | 5 224     | 1 733      |
| maze   | 4      | 8 929     | 2 832      |
| maze   | 6      | 19 460    | 5 940      |
| cracks | 1      | 2 754     | 1 286      |
| cracks | 2      | 10 163    | 4 259      |
| cracks | 3      | 22 540    | 9 094      |
| cracks | 4      | 39 939    | 15 879     |
| cracks | 6      | 89 668    | 35 300     |

Line length per px² (mean of seeds 1 to 10), period 1 / 2 / 3 / 4 / 6: topo depth 1
0.0983 / 0.1015 / 0.1050 / 0.1004 / 0.0980. Maze 0.0842 / 0.0835 / 0.0834 / 0.0834 / 0.0834.
Cracks 0.0857 / 0.0857 / 0.0855 / 0.0855 / 0.0855.

Time: cracks at period 6 takes about 1.7 s (Voronoi by sorting all copies per seed, O(n²)).
Topo at period 6 takes about 85 ms, maze under 5 ms.

## What it looks like

A period-1 topography field is a sum of 4 to 6 waves, so its hills line up in bands. A period-m field
sums m² times as many waves. So it is closer to random noise, with rounder, more scattered hills. The
contour spacing and line density match (above), but the character changes from "banded" to "blotchy".
