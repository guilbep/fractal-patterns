# Preferred settings per kind

When a visitor chooses a kind (library card, keyboard, Random pattern), the page applies that kind's preferred
stroke width, depth, and Reduce repetition (`src/preferred.ts`). A link never uses them: `#k=hex&s=1` still opens
with the global defaults of `DESIGN_DEFAULTS`.

## Stroke width

By family: Symmetry groups 0.5 px, every other family 1 px. Exceptions: Truchet 5 px (drawn bold on purpose) and
Koch lattice 1.5 px (its line length never reaches the band below, 0.036 per px at its last depth).

## Depth: the measurement

For each kind and each depth from 1 to its maximum, at size 120 (the link default tile size), over seeds 1 to 8:

- density: the sum of the polyline segment lengths divided by the tile area (size × size / aspect), averaged over the seeds;
- chars: the largest `generate()` output at precision 1 over the seeds.

The band runs from Truchet at depth 4 (0.052 per px, the first-visit design) to Honeycomb at its default depth 3
(0.147 per px), two kinds that already look right. The chosen depth is the one whose density is nearest, in ratio,
to the band's geometric middle, 0.088 per px, among the depths whose chars stay at or under 20,000 (the byte rule
above `PATTERNS` in `src/fractal.ts`); depth 1 when no depth fits (only p6m: 22.7k at depth 1).
Penrose arcs draw their arcs as raw path data, so they take the rhombs' density.

Geometry scales with the tile, so density scales as 1 / size: at size 96 (the first visit) the band and the
densities move together, and only one kind's choice moves by one (Chain and fence, 2 to 3).

`src/preferred.test.ts` runs the measurement again and checks it equals the committed table. Overrides after
looking at the contact sheet: Truchet stays at depth 4 (it is the band's own lower end, drawn at 5 px);
Sierpinski goes from 1 to 2 (at depth 1 it is one split triangle, not yet recognizable; 0.116 at depth 2 is still in the band).

## Reduce repetition

On, varying the base layer, for the kinds that can vary (`VARIANT_KINDS`) in Fractals, Line art and Surfaces; off for the others.

## The table

| Kind | Family | Depth | Density at that depth | Max chars | Stroke | Reduce repetition |
|---|---|---|---|---|---|---|
| Carpet (`carpet`) | fractal | 2 | 0.0672 | 883 | 1 | on |
| Quadtree (`quadtree`) | fractal | 3 | 0.1037 | 728 | 1 | on |
| Tree (`tree`) | fractal | 9 | 0.0789 | 6808 | 1 | on |
| Folded curve (`fold`) | fractal | 8 | 0.0843 | 3515 | 1 | on |
| Hilbert curve (`hilbert`) | fractal | 4 | 0.1062 | 3883 | 1 | off |
| Koch lattice (`koch`) | fractal | 3 | 0.0356 | 1289 | 1.5 | on |
| Sierpinski (`sierpinski`) | fractal | 2 (measured 1) | 0.1162 | 369 | 1 | on |
| H-tree (`htree`) | fractal | 6 | 0.0848 | 1428 | 1 | on |
| Curve stitching (`stitch`) | line | 1 | 0.1542 | 1039 | 1 | on |
| Whirl (`whirl`) | line | 2 | 0.0928 | 775 | 1 | on |
| Rosette (`rosette`) | line | 2 | 0.0909 | 5844 | 1 | off |
| Spirals (`spiral`) | line | 4 | 0.0996 | 7963 | 1 | off |
| Truchet (`truchet`) | line | 4 (measured 7) | 0.0523 | 4821 | 5 | off |
| Running bond (`brick`) | surface | 1 | 0.088 | 548 | 1 | on |
| Stack bond (`stack`) | surface | 1 | 0.0701 | 402 | 1 | on |
| Herringbone (`herringbone`) | surface | 1 | 0.1099 | 840 | 1 | on |
| Basket weave (`basket`) | surface | 1 | 0.1417 | 934 | 1 | on |
| Honeycomb (`hex`) | surface | 1 | 0.086 | 1592 | 1 | on |
| Triangular net (`trinet`) | surface | 1 | 0.1508 | 1174 | 1 | on |
| Nested boxes (`nested`) | surface | 1 | 0.0747 | 520 | 1 | on |
| Dot grid (`dots`) | surface | 3 | 0.0707 | 6626 | 1 | on |
| Hatch (`hatch`) | surface | 4 | 0.0958 | 1611 | 1 | on |
| Crosshatch (`crosshatch`) | surface | 3 | 0.0961 | 865 | 1 | on |
| Zigzag (`zigzag`) | surface | 3 | 0.0997 | 1617 | 1 | on |
| Fish scales (`scales`) | surface | 1 | 0.1208 | 9100 | 1 | on |
| Waves (`waves`) | surface | 6 | 0.094 | 5118 | 1 | on |
| p1 translation (`p1`) | symmetry | 2 | 0.1234 | 8413 | 0.5 | off |
| p2 half turn (`p2`) | symmetry | 2 | 0.1342 | 9255 | 0.5 | off |
| pm mirror (`pm`) | symmetry | 2 | 0.1342 | 9247 | 0.5 | off |
| pg glide (`pg`) | symmetry | 2 | 0.1342 | 9424 | 0.5 | off |
| cm mirror and glide (`cm`) | symmetry | 1 | 0.0955 | 6228 | 0.5 | off |
| pmm two mirrors (`pmm`) | symmetry | 1 | 0.0955 | 5999 | 0.5 | off |
| pmg mirror and glide (`pmg`) | symmetry | 1 | 0.0955 | 6198 | 0.5 | off |
| pgg two glides (`pgg`) | symmetry | 1 | 0.0955 | 6226 | 0.5 | off |
| cmm two mirrors, centered (`cmm`) | symmetry | 1 | 0.1304 | 8131 | 0.5 | off |
| p4 quarter turn (`p4`) | symmetry | 1 | 0.0955 | 5999 | 0.5 | off |
| p4m quarter turn and mirrors (`p4m`) | symmetry | 1 | 0.1304 | 8133 | 0.5 | off |
| p4g quarter turn and glides (`p4g`) | symmetry | 1 | 0.1304 | 8131 | 0.5 | off |
| Topography (`topo`) | theme | 1 | 0.0924 | 3104 | 1 | off |
| Maze (`maze`) | theme | 3 | 0.0842 | 792 | 1 | off |
| Circuit (`circuit`) | theme | 5 | 0.065 | 3391 | 1 | off |
| Waves (seigaiha) (`seigaiha`) | theme | 1 | 0.0722 | 1823 | 1 | off |
| Rain (`rain`) | theme | 4 | 0.0565 | 2657 | 1 | off |
| Mountain ridges (`ridges`) | theme | 4 | 0.0562 | 1380 | 1 | off |
| Constellations (`stars`) | theme | 5 | 0.0478 | 3882 | 1 | off |
| Roots (`roots`) | theme | 4 | 0.0861 | 2451 | 1 | off |
| Cracked earth (`cracks`) | theme | 3 | 0.0858 | 2752 | 1 | off |
| Knotwork (`knot`) | theme | 4 | 0.0934 | 2464 | 1 | off |
| Roof tiles (`roof`) | theme | 1 | 0.1086 | 1153 | 1 | off |
| Feathers (`feathers`) | theme | 1 | 0.1118 | 2675 | 1 | off |
| Chain and fence (`chain`) | theme | 2 | 0.086 | 3289 | 1 | off |
| Pipes (`pipes`) | theme | 4 | 0.091 | 9097 | 1 | off |
| Penrose rhombs (`penrose`) | quasi | 1 | 0.1205 | 1812 | 1 | off |
| Penrose arcs (`penrosearcs`) | quasi | 1 | 0.1205 (rhombs) | 3017 | 1 | off |
| Penrose rhombs and arcs (`penroseboth`) | quasi | 1 | 0.1205 | 4628 | 1 | off |
| Chladni figures (`chladni`) | theme | 4 | 0.0841 | 2990 | 1 | off |
| Clouds (`clouds`) | theme | 3 | 0.0454 | 1967 | 1 | off |
| Moons (`moons`) | theme | 3 | 0.044 | 2349 | 1 | off |
| Storm (`storm`) | theme | 3 | 0.0482 | 1636 | 1 | off |
| Leaves (`leaves`) | theme | 4 | 0.0785 | 3383 | 1 | off |
| River (`river`) | theme | 3 | 0.0873 | 4940 | 1 | off |
| Thorns (`thorns`) | theme | 3 | 0.0676 | 2157 | 1 | off |
| Nest (`nest`) | theme | 2 | 0.085 | 3548 | 1 | off |
| Railway (`railway`) | theme | 3 | 0.0995 | 3184 | 1 | off |
| Quilt (`quilt`) | theme | 1 | 0.1473 | 1244 | 1 | off |
| Lanterns (`lanterns`) | theme | 3 | 0.0813 | 3821 | 1 | off |
| Basketwork (`weave`) | theme | 1 | 0.0928 | 2823 | 1 | off |
| Garden paths (`paths`) | theme | 4 | 0.0829 | 2600 | 1 | off |
| Endless maze (`endlessmaze`) | theme | 4 | 0.0906 | 1424 | 1 | off |
| Endless railway (`endlessrail`) | theme | 1 | 0.0851 | 2736 | 1 | off |
| Sprigs (`sprigs`) | theme | 2 | 0.0801 | 6550 | 1 | off |
| Eightfold rhombs (`octa`) | quasi | 1 | 0.1658 | 3378 | 1 | off |
| Eightfold stars (`octastars`) | quasi | 1 | 0.224 | 3852 | 1 | off |
| Twelvefold rhombs (`dodeca`) | quasi | 1 | 0.1341 | 2386 | 1 | off |
| Twelvefold stars (`dodecastars`) | quasi | 1 | 0.1798 | 2625 | 1 | off |
| p3 third turn (`p3`) | symmetry | 2 | 0.1 | 13407 | 0.5 | off |
| p3m1 third turn and mirrors (`p3m1`) | symmetry | 1 | 0.0983 | 13776 | 0.5 | off |
| p31m third turn, mirrors off center (`p31m`) | symmetry | 1 | 0.1014 | 13690 | 0.5 | off |
| p6 sixth turn (`p6`) | symmetry | 1 | 0.1014 | 13702 | 0.5 | off |
| p6m sixth turn and mirrors (`p6m`) | symmetry | 1 | 0.1577 | 22659 | 0.5 | off |
