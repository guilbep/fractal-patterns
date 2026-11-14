// The stroke width, depth, and Reduce repetition a kind is drawn with when a visitor chooses it
// (library card, keyboard, Random pattern). Links never use them: a link is the source of truth. Pure.
import { KIND_FAMILY, type Family, type Kind } from './fractal.ts';
import { canVary } from './supertile.ts';

// Measured, and recomputed by preferred.test.ts (docs/research/preferred-settings.md): at size 120, over seeds 1..8,
// the depth whose mean stroke length per tile area is nearest (in ratio) to 0.088 per px, the geometric middle of
// Truchet at depth 4 (0.052) and Honeycomb at depth 3 (0.147), among depths whose largest generate() output at
// precision 1 stays at or under 20k chars; depth 1 when none does. Penrose arcs take the rhombs' length (its arcs are raw path data).
export const MEASURED_DEPTH: Readonly<Record<Kind, number>> = {
  carpet: 2,
  quadtree: 3,
  tree: 9,
  fold: 8,
  hilbert: 4,
  koch: 3,
  sierpinski: 1,
  htree: 6,
  stitch: 1,
  whirl: 2,
  rosette: 2,
  spiral: 4,
  truchet: 7,
  brick: 1,
  stack: 1,
  herringbone: 1,
  basket: 1,
  hex: 1,
  trinet: 1,
  nested: 1,
  dots: 3,
  hatch: 4,
  crosshatch: 3,
  zigzag: 3,
  scales: 1,
  waves: 6,
  p1: 2,
  p2: 2,
  pm: 2,
  pg: 2,
  cm: 1,
  pmm: 1,
  pmg: 1,
  pgg: 1,
  cmm: 1,
  p4: 1,
  p4m: 1,
  p4g: 1,
  topo: 1,
  maze: 3,
  circuit: 5,
  seigaiha: 1,
  rain: 4,
  ridges: 4,
  stars: 5,
  roots: 4,
  cracks: 3,
  knot: 4,
  roof: 1,
  feathers: 1,
  chain: 2,
  pipes: 4,
  penrose: 1,
  penrosearcs: 1,
  penroseboth: 1,
  chladni: 4,
  clouds: 3,
  moons: 3,
  storm: 3,
  leaves: 4,
  river: 3,
  thorns: 3,
  nest: 2,
  railway: 3,
  quilt: 1,
  lanterns: 3,
  weave: 1,
  paths: 4,
  endlessmaze: 4,
  endlessrail: 1,
  sprigs: 2,
  octa: 1,
  octastars: 1,
  dodeca: 1,
  dodecastars: 1,
  p3: 2,
  p3m1: 1,
  p31m: 1,
  p6: 1,
  p6m: 1,
};

// Set by hand after the contact sheet, each with its reason.
const DEPTH_OVERRIDES: Partial<Record<Kind, number>> = {
  truchet: 4, // the first-visit design: drawn bold at 5 px, the band's lower end
  sierpinski: 2, // at depth 1 (0.074) it is one split triangle, not yet recognizable; depth 2 is 0.116, still in the band
};

const FAMILY_STROKE: Readonly<Record<Family, number>> = { fractal: 1, line: 1, surface: 1, symmetry: 0.5, theme: 1, quasi: 1 };
const STROKE_OVERRIDES: Partial<Record<Kind, number>> = {
  truchet: 5, // drawn bold on purpose
  koch: 1.5, // never reaches the band (0.036 at its last depth): a wider line makes up the ink
};

const VARY_FAMILIES: readonly Family[] = ['fractal', 'line', 'surface'];

export interface Preferred {
  readonly stroke: number;
  readonly depth: number;
  readonly variants: boolean; // Reduce repetition, varying the base layer
}

export const preferred = (kind: Kind): Preferred => ({
  stroke: STROKE_OVERRIDES[kind] ?? FAMILY_STROKE[KIND_FAMILY[kind]],
  depth: DEPTH_OVERRIDES[kind] ?? MEASURED_DEPTH[kind],
  variants: canVary(kind) && VARY_FAMILIES.includes(KIND_FAMILY[kind]),
});
