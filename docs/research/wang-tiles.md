# Wang tiles for more pattern kinds: study notes

Date: 2026-11-13. Purpose: find which of the 76 kinds can stop repeating at the tile size.

## How the engine works today

A Wang tile is a square tile with a state on each edge. If two tiles are neighbors, their shared edges must have the same state.

- `wangLayout(cells, seed, density)` in `src/wang.ts` draws one seeded bit for each edge of a grid on a torus. The tiles follow from the edges, so every layout is valid, also across the wrap.
- An edge has two states: no line, or a line that crosses the middle of the edge.
- `tileGeometry(style, edges, variant, size, crossGap)` draws one tile. It covers the cases with 0 to 4 edges set.
- Three kinds use it: Pipes, Basketwork, and Garden paths (`src/patterns/themes-pipes.ts`).
- A new style needs one new branch in `tileGeometry`. Its lines must touch the tile border only at the coded points.

## The 76 kinds in groups

A builder read the generators. Ticket counts are estimates.

| Group | Kinds | Cost |
|---|---|---|
| Fits the engine with a new drawing style | Maze, Circuit, Railway, Thorns, River | 1 or 2 tickets each |
| Needs more edge states | Mountain ridges, double-track Railway, Circuit with diagonals | 2 or 3 tickets each, plus a shared helper |
| Already has Reduce repetition | The 22 kinds in `VARIANT_KINDS` | Wang adds little |
| Probably fits Reduce repetition as it is | Knotwork, Leaves, Rain, Moons, Feathers, Roof tiles, Quilt, Lanterns, Chain, Waves, Clouds, Nest | 1 ticket to measure all |
| Cannot fit | 17 symmetry groups, 7 quasicrystals, Topography, Chladni, Hilbert, Cracked earth, Constellations, Roots, Storm | Their structure is global |

The "probably fits" group is not measured. The builder read only the header comments for most of those kinds.

## Ranking by gain for the work

1. Measure the "probably fits" kinds with the seam test, and turn on Reduce repetition for each kind that passes.
2. Maze as a Wang kind. It is no longer a true maze, because loops and closed rooms can appear. So it becomes a second kind, "Endless maze", next to the present Maze.
3. Railway as a Wang kind: two rails with sleepers, buffer stops, and crossings.
4. Thorns.
5. Mountain ridges, which needs heights on the left and right edges.

Circuit comes later. It risks looking like Pipes with corners.

## Ticket outlines

- Endless maze: state 1 means that a wall crosses the edge middle. Draw segments from the cell center to each coded middle, with no jitter. Reuse the border and wrap tests of `src/wang.test.ts`.
- Railway: state 1 means that a track crosses. Draw two lanes and sleepers every quarter cell. A cell with one edge is a buffer stop. Sleepers must not touch the border.
- A helper for more states: `wangEdges(cells, seed, weights)` returns the edge tuples directly. Build it only before the first kind that needs more than two states.

## Points that need a second look

- Knotwork: make sure that the over and under order stays correct between neighbor cells.
- Rosette and Spiral: their edges were not read.
- Circuit: make sure that diagonals are not essential to its look.
