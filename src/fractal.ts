// Seeded pattern tiles: geometry as polylines, serialized through the scene model (src/scene.ts).
// Every kind is one generator function registered in PATTERNS; the generators live in src/patterns/.
import { carpet, fold, hilbert, htree, koch, quadtree, sierpinski, tree } from './patterns/fractals.ts';
import { rosette, spiral, stitch, whirl } from './patterns/lineart.ts';
import { cm, cmm, HEX_ASPECT, p1, p2, p3, p31m, p3m1, p4, p4g, p4m, p6, p6m, pg, pgg, pm, pmg, pmm } from './patterns/symmetry.ts';
import {
  basket,
  basketCompat,
  brick,
  brickCompat,
  crosshatch,
  crosshatchCompat,
  dots,
  dotsCompat,
  hatch,
  hatchCompat,
  herringbone,
  herringboneCompat,
  hex,
  hexCompat,
  nested,
  nestedCompat,
  scales,
  scalesCompat,
  stack,
  stackCompat,
  trinet,
  trinetCompat,
  waves,
  wavesCompat,
  zigzag,
  zigzagCompat,
} from './patterns/surfaces.ts';
import { THEME_AIR_MAX_DEPTH, chain, feathers } from './patterns/themes-air.ts';
import { THEME_CRAFT_MAX_DEPTH, knot, roof } from './patterns/themes-craft.ts';
import { THEME_EARTH_MAX_DEPTH, cracks, roots, stars } from './patterns/themes-earth.ts';
import { CHLADNI_MAX_DEPTH, chladni } from './patterns/themes-chladni.ts';
import { THEME_HOME_MAX_DEPTH, lanterns, quilt, railway } from './patterns/themes-home.ts';
import {
  ENDLESSMAZE_MAX_DEPTH,
  ENDLESSRAIL_MAX_DEPTH,
  PATHS_MAX_DEPTH,
  PIPES_MAX_DEPTH,
  WEAVE_MAX_DEPTH,
  endlessmaze,
  endlessrail,
  paths,
  pipes,
  weave,
} from './patterns/themes-pipes.ts';
import { THEME_SKY_MAX_DEPTH, clouds, moons, storm } from './patterns/themes-sky.ts';
import { THEME_WATER_MAX_DEPTH, rain, ridges, seigaiha } from './patterns/themes-water.ts';
import { THEME_WILD_MAX_DEPTH, leaves, nest, river, thorns } from './patterns/themes-wild.ts';
import { circuit, maze, topo } from './patterns/themes.ts';
import { PENROSE_ASPECT, PENROSE_MAX_DEPTH, penroseArcs, penroseArcsPath, penroseBoth, penroseEdges } from './penrose.ts';
import { QUASI_MAX_DEPTH, dodecaEdges, dodecaStars, octaEdges, octaStars } from './quasi.ts';
import { mulberry32, type Generator, type Pt, type Rng } from './patterns/util.ts';
import { pathData, sceneToSvg, squareScene } from './scene.ts';
import { NO_FILL, fillScene } from './fills.ts';

export const FAMILIES = ['fractal', 'line', 'surface', 'symmetry', 'theme', 'quasi'] as const;
export type Family = (typeof FAMILIES)[number];

export const FAMILY_LABELS: Readonly<Record<Family, string>> = {
  fractal: 'Fractals',
  line: 'Line art',
  surface: 'Surfaces',
  symmetry: 'Symmetry groups',
  theme: 'Themes',
  quasi: 'Quasicrystals',
};

export const KINDS = [
  'carpet',
  'quadtree',
  'tree',
  'fold',
  'hilbert',
  'koch',
  'sierpinski',
  'htree',
  'stitch',
  'whirl',
  'rosette',
  'spiral',
  'brick',
  'stack',
  'herringbone',
  'basket',
  'hex',
  'trinet',
  'nested',
  'dots',
  'hatch',
  'crosshatch',
  'zigzag',
  'scales',
  'waves',
  'p1',
  'p2',
  'pm',
  'pg',
  'cm',
  'pmm',
  'pmg',
  'pgg',
  'cmm',
  'p4',
  'p4m',
  'p4g',
  'topo',
  'maze',
  'circuit',
  'seigaiha',
  'rain',
  'ridges',
  'stars',
  'roots',
  'cracks',
  'knot',
  'roof',
  'feathers',
  'chain',
  'pipes',
  'penrose',
  'penrosearcs',
  'penroseboth',
  'chladni',
  'clouds',
  'moons',
  'storm',
  'leaves',
  'river',
  'thorns',
  'nest',
  'railway',
  'quilt',
  'lanterns',
  'weave',
  'paths',
  'endlessmaze',
  'endlessrail',
  'octa',
  'octastars',
  'dodeca',
  'dodecastars',
  'p3',
  'p3m1',
  'p31m',
  'p6',
  'p6m',
] as const;
export type Kind = (typeof KINDS)[number];

// maxDepth: the measured worst case over many seeds stays near or under 20k chars at precision 1,
// and one level more either breaks that or only adds sub-pixel detail at size 120.
// extra: raw path data drawn after the polylines, for parts that are not polylines (arcs).
type Extra = (rnd: Rng, depth: number, size: number, precision: number) => string;
// accent: closed shapes filled in the accent color, drawn over the fill layer and under the strokes (fillScene).
// Like `extra`, it gets its own mulberry32(seed): the same stream the generator starts from, so it can replay the
// generator's draws to place its shapes, and it never shifts the generator's output.
const PATTERNS: Readonly<
  Record<Kind, { family: Family; label: string; maxDepth: number; gen: Generator; aspect?: number; extra?: Extra; accent?: Generator }>
> = {
  carpet: { family: 'fractal', label: 'Carpet', maxDepth: 3, gen: carpet },
  quadtree: { family: 'fractal', label: 'Quadtree', maxDepth: 6, gen: quadtree },
  tree: { family: 'fractal', label: 'Tree', maxDepth: 10, gen: tree },
  fold: { family: 'fractal', label: 'Folded curve', maxDepth: 10, gen: fold },
  hilbert: { family: 'fractal', label: 'Hilbert curve', maxDepth: 5, gen: hilbert },
  koch: { family: 'fractal', label: 'Koch lattice', maxDepth: 3, gen: koch },
  sierpinski: { family: 'fractal', label: 'Sierpinski', maxDepth: 5, gen: sierpinski },
  htree: { family: 'fractal', label: 'H-tree', maxDepth: 8, gen: htree },
  stitch: { family: 'line', label: 'Curve stitching', maxDepth: 6, gen: stitch },
  whirl: { family: 'line', label: 'Whirl', maxDepth: 16, gen: whirl },
  rosette: { family: 'line', label: 'Rosette', maxDepth: 5, gen: rosette },
  spiral: { family: 'line', label: 'Spirals', maxDepth: 8, gen: spiral },
  brick: { family: 'surface', label: 'Running bond', maxDepth: 8, gen: brick },
  stack: { family: 'surface', label: 'Stack bond', maxDepth: 8, gen: stack },
  herringbone: { family: 'surface', label: 'Herringbone', maxDepth: 3, gen: herringbone },
  basket: { family: 'surface', label: 'Basket weave', maxDepth: 3, gen: basket },
  hex: { family: 'surface', label: 'Honeycomb', maxDepth: 3, gen: hex },
  trinet: { family: 'surface', label: 'Triangular net', maxDepth: 5, gen: trinet },
  nested: { family: 'surface', label: 'Nested boxes', maxDepth: 3, gen: nested },
  dots: { family: 'surface', label: 'Dot grid', maxDepth: 3, gen: dots },
  hatch: { family: 'surface', label: 'Hatch', maxDepth: 6, gen: hatch },
  crosshatch: { family: 'surface', label: 'Crosshatch', maxDepth: 8, gen: crosshatch },
  zigzag: { family: 'surface', label: 'Zigzag', maxDepth: 5, gen: zigzag },
  scales: { family: 'surface', label: 'Fish scales', maxDepth: 3, gen: scales },
  waves: { family: 'surface', label: 'Waves', maxDepth: 6, gen: waves },
  p1: { family: 'symmetry', label: 'p1 translation', maxDepth: 3, gen: p1 },
  p2: { family: 'symmetry', label: 'p2 half turn', maxDepth: 3, gen: p2 },
  pm: { family: 'symmetry', label: 'pm mirror', maxDepth: 3, gen: pm },
  pg: { family: 'symmetry', label: 'pg glide', maxDepth: 3, gen: pg },
  cm: { family: 'symmetry', label: 'cm mirror and glide', maxDepth: 3, gen: cm },
  pmm: { family: 'symmetry', label: 'pmm two mirrors', maxDepth: 3, gen: pmm },
  pmg: { family: 'symmetry', label: 'pmg mirror and glide', maxDepth: 3, gen: pmg },
  pgg: { family: 'symmetry', label: 'pgg two glides', maxDepth: 3, gen: pgg },
  // 8 copies of the motif: depth 3 reaches 17k chars, so these stop at 2.
  cmm: { family: 'symmetry', label: 'cmm two mirrors, centered', maxDepth: 2, gen: cmm },
  p4: { family: 'symmetry', label: 'p4 quarter turn', maxDepth: 3, gen: p4 },
  p4m: { family: 'symmetry', label: 'p4m quarter turn and mirrors', maxDepth: 2, gen: p4m },
  p4g: { family: 'symmetry', label: 'p4g quarter turn and glides', maxDepth: 2, gen: p4g },
  topo: { family: 'theme', label: 'Topography', maxDepth: 5, gen: topo },
  maze: { family: 'theme', label: 'Maze', maxDepth: 13, gen: maze },
  circuit: { family: 'theme', label: 'Circuit', maxDepth: 5, gen: circuit },
  seigaiha: { family: 'theme', label: 'Waves (seigaiha)', maxDepth: THEME_WATER_MAX_DEPTH.seigaiha, gen: seigaiha },
  rain: { family: 'theme', label: 'Rain', maxDepth: THEME_WATER_MAX_DEPTH.rain, gen: rain },
  ridges: { family: 'theme', label: 'Mountain ridges', maxDepth: THEME_WATER_MAX_DEPTH.ridges, gen: ridges },
  stars: { family: 'theme', label: 'Constellations', maxDepth: THEME_EARTH_MAX_DEPTH.stars, gen: stars },
  roots: { family: 'theme', label: 'Roots', maxDepth: THEME_EARTH_MAX_DEPTH.roots, gen: roots },
  cracks: { family: 'theme', label: 'Cracked earth', maxDepth: THEME_EARTH_MAX_DEPTH.cracks, gen: cracks },
  knot: { family: 'theme', label: 'Knotwork', maxDepth: THEME_CRAFT_MAX_DEPTH.knot, gen: knot },
  roof: { family: 'theme', label: 'Roof tiles', maxDepth: THEME_CRAFT_MAX_DEPTH.roof, gen: roof },
  feathers: { family: 'theme', label: 'Feathers', maxDepth: THEME_AIR_MAX_DEPTH.feathers, gen: feathers },
  chain: { family: 'theme', label: 'Chain and fence', maxDepth: THEME_AIR_MAX_DEPTH.chain, gen: chain },
  pipes: { family: 'theme', label: 'Pipes', maxDepth: PIPES_MAX_DEPTH, gen: pipes },
  // A rectangular tile (aspect = width / height): the generator's `size` is the tile width.
  penrose: { family: 'quasi', label: 'Penrose rhombs', maxDepth: PENROSE_MAX_DEPTH, gen: penroseEdges, aspect: PENROSE_ASPECT },
  penrosearcs: {
    family: 'quasi',
    label: 'Penrose arcs',
    maxDepth: PENROSE_MAX_DEPTH,
    gen: penroseArcs,
    aspect: PENROSE_ASPECT,
    extra: penroseArcsPath,
  },
  penroseboth: {
    family: 'quasi',
    label: 'Penrose rhombs and arcs',
    maxDepth: PENROSE_MAX_DEPTH,
    gen: penroseBoth,
    aspect: PENROSE_ASPECT,
    extra: penroseArcsPath,
  },
  chladni: { family: 'theme', label: 'Chladni figures', maxDepth: CHLADNI_MAX_DEPTH, gen: chladni },
  clouds: { family: 'theme', label: 'Clouds', maxDepth: THEME_SKY_MAX_DEPTH.clouds, gen: clouds },
  moons: { family: 'theme', label: 'Moons', maxDepth: THEME_SKY_MAX_DEPTH.moons, gen: moons },
  storm: { family: 'theme', label: 'Storm', maxDepth: THEME_SKY_MAX_DEPTH.storm, gen: storm },
  leaves: { family: 'theme', label: 'Leaves', maxDepth: THEME_WILD_MAX_DEPTH.leaves, gen: leaves },
  river: { family: 'theme', label: 'River', maxDepth: THEME_WILD_MAX_DEPTH.river, gen: river },
  thorns: { family: 'theme', label: 'Thorns', maxDepth: THEME_WILD_MAX_DEPTH.thorns, gen: thorns },
  nest: { family: 'theme', label: 'Nest', maxDepth: THEME_WILD_MAX_DEPTH.nest, gen: nest },
  railway: { family: 'theme', label: 'Railway', maxDepth: THEME_HOME_MAX_DEPTH.railway, gen: railway },
  quilt: { family: 'theme', label: 'Quilt', maxDepth: THEME_HOME_MAX_DEPTH.quilt, gen: quilt },
  lanterns: { family: 'theme', label: 'Lanterns', maxDepth: THEME_HOME_MAX_DEPTH.lanterns, gen: lanterns },
  weave: { family: 'theme', label: 'Basketwork', maxDepth: WEAVE_MAX_DEPTH, gen: weave },
  paths: { family: 'theme', label: 'Garden paths', maxDepth: PATHS_MAX_DEPTH, gen: paths },
  endlessmaze: { family: 'theme', label: 'Endless maze', maxDepth: ENDLESSMAZE_MAX_DEPTH, gen: endlessmaze },
  endlessrail: { family: 'theme', label: 'Endless railway', maxDepth: ENDLESSRAIL_MAX_DEPTH, gen: endlessrail },
  octa: { family: 'quasi', label: 'Eightfold rhombs', maxDepth: QUASI_MAX_DEPTH, gen: octaEdges },
  octastars: { family: 'quasi', label: 'Eightfold stars', maxDepth: QUASI_MAX_DEPTH, gen: octaStars },
  dodeca: { family: 'quasi', label: 'Twelvefold rhombs', maxDepth: QUASI_MAX_DEPTH, gen: dodecaEdges },
  dodecastars: { family: 'quasi', label: 'Twelvefold stars', maxDepth: QUASI_MAX_DEPTH, gen: dodecaStars },
  // Hexagonal lattice: a 1 by sqrt(3) rectangle tile. Worst over seeds 1..20 at size 120: p3 49k chars at
  // depth 4; 6 ops 57k at depth 3 (68k at 4, too near the 70k cap); p6m 34k at depth 2 (92k at 3).
  p3: { family: 'symmetry', label: 'p3 third turn', maxDepth: 4, gen: p3, aspect: HEX_ASPECT },
  p3m1: { family: 'symmetry', label: 'p3m1 third turn and mirrors', maxDepth: 3, gen: p3m1, aspect: HEX_ASPECT },
  p31m: { family: 'symmetry', label: 'p31m third turn, mirrors off center', maxDepth: 3, gen: p31m, aspect: HEX_ASPECT },
  p6: { family: 'symmetry', label: 'p6 sixth turn', maxDepth: 3, gen: p6, aspect: HEX_ASPECT },
  p6m: { family: 'symmetry', label: 'p6m sixth turn and mirrors', maxDepth: 2, gen: p6m, aspect: HEX_ASPECT },
};

const byKind = <T>(f: (k: Kind) => T): Readonly<Record<Kind, T>> => Object.fromEntries(KINDS.map((k) => [k, f(k)])) as Record<Kind, T>;

export const KIND_LABELS: Readonly<Record<Kind, string>> = byKind((k) => PATTERNS[k].label);
export const KIND_FAMILY: Readonly<Record<Kind, Family>> = byKind((k) => PATTERNS[k].family);
export const MAX_DEPTH: Readonly<Record<Kind, number>> = byKind((k) => PATTERNS[k].maxDepth);
// Tile width / height; 1 for a square tile.
export const tileAspect = (kind: Kind): number => PATTERNS[kind].aspect ?? 1;
// Tile height for a width and an aspect, rounded to 3 decimals as in the SVG attributes.
export const tileHeight = (size: number, aspect = 1): number => (aspect === 1 ? size : Math.round((size / aspect) * 1000) / 1000);

export interface PatternParams {
  readonly kind: Kind;
  readonly seed: number;
  readonly depth: number;
  readonly size: number;
  readonly strokeWidth: number;
  readonly precision: number;
  readonly color: string;
  readonly opacity: number;
  readonly compat?: boolean;
  readonly accent?: string; // the accent color; absent = the stroke color
}

// Compatible layouts: fixed per depth, so tiles of different seeds can be neighbors (super tile).
// The default (free) layouts let the seed choose the layout too.
const COMPAT: Partial<Record<Kind, Generator>> = {
  brick: brickCompat,
  stack: stackCompat,
  herringbone: herringboneCompat,
  basket: basketCompat,
  hex: hexCompat,
  trinet: trinetCompat,
  nested: nestedCompat,
  dots: dotsCompat,
  hatch: hatchCompat,
  crosshatch: crosshatchCompat,
  zigzag: zigzagCompat,
  scales: scalesCompat,
  waves: wavesCompat,
};
export const hasCompat = (kind: Kind): boolean => kind in COMPAT;
export const hasAccent = (kind: Kind): boolean => PATTERNS[kind].accent !== undefined;

const clampDepth = (kind: Kind, depth: number) => Math.min(MAX_DEPTH[kind], Math.max(1, Math.floor(depth) || 1));

export function geometry(p: Pick<PatternParams, 'kind' | 'seed' | 'depth' | 'size' | 'compat'>): readonly (readonly Pt[])[] {
  const gen = (p.compat && COMPAT[p.kind]) || PATTERNS[p.kind].gen;
  return gen(mulberry32(p.seed), clampDepth(p.kind, p.depth), p.size);
}

// The kind's raw path data next to its polylines ('' for most kinds), in tile coordinates.
export function extraPath(p: Pick<PatternParams, 'kind' | 'seed' | 'depth' | 'size' | 'precision'>): string {
  const extra = PATTERNS[p.kind].extra;
  return extra ? extra(mulberry32(p.seed), clampDepth(p.kind, p.depth), p.size, p.precision) : '';
}

// The kind's accent shapes ([] for a kind without the hook), in tile coordinates.
export function accentGeometry(p: Pick<PatternParams, 'kind' | 'seed' | 'depth' | 'size'>): readonly (readonly Pt[])[] {
  const accent = PATTERNS[p.kind].accent;
  return accent ? accent(mulberry32(p.seed), clampDepth(p.kind, p.depth), p.size) : [];
}

export function generate(p: PatternParams): string {
  const accent = accentGeometry(p);
  // ponytail: a kind with accent shapes drops a raw `extra` path; no kind has both.
  if (accent.length > 0)
    return sceneToSvg(
      fillScene(geometry(p), { ...p, height: tileHeight(p.size, tileAspect(p.kind)) }, NO_FILL, {
        polys: accent,
        color: p.accent ?? p.color,
      }),
      p.precision,
    );
  return svgFromPolylines(geometry(p), p, tileAspect(p.kind), extraPath(p));
}

// `aspect` (width / height) other than 1 gives a tile of `size` by `size / aspect`.
export function svgFromPolylines(
  polys: readonly (readonly Pt[])[],
  p: Pick<PatternParams, 'size' | 'strokeWidth' | 'precision' | 'color' | 'opacity'>,
  aspect = 1,
  extra = '',
): string {
  const scene = { ...squareScene(polys, p), height: tileHeight(p.size, aspect) };
  if (!extra) return sceneToSvg(scene, p.precision);
  const layers = scene.layers.map((l) => ({ ...l, d: pathData(l.polys, p.precision) + extra }));
  return sceneToSvg({ ...scene, layers }, p.precision);
}
