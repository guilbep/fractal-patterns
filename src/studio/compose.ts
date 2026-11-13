// The wallpaper studio composer: from a seed and a few choices, a complete botanical tile.
// A few plants, each a stem that follows a calm flow with a hero at its tip and support
// motifs on alternating sides, spaced on the repeat's own lattice; small filler in the
// larger gaps; all stems in one stroke motif under four color layers.
import type { Cubic } from '../curvefit.ts';
import { safePathData } from '../motifgrid.ts';
import { mulberry32, type Pt } from '../patterns/util.ts';
import { groundLayer, groundMotifs } from './ground.ts';
import type { Placement, Repeat, Studio, StudioLayer, StudioMotif } from './model.ts';
import { INK_MAX_LENGTH, layerColors, studioBytes } from './model.ts';
import { trackingInput, trackingScore, type Tracking } from './tracking.ts';
import { makeMotif, MOTIF_FAMILIES, MOTIF_LABELS, motifBounds, type MotifFamily } from './motifs.ts';
import { makeOrchardMotif, ORCHARD_FAMILIES, ORCHARD_LABELS, ORCHARD_ROLES, type OrchardFamily } from './motifs-orchard.ts';
import { makeSeaMotif, SEA_FAMILIES, SEA_LABELS, SEA_ROLES, type SeaFamily } from './motifs-sea.ts';
import { flowAngle } from './scatter.ts';

export interface CustomShape {
  readonly color: string;
  readonly d: string;
  /** Default 'fill'. */
  readonly paint?: 'fill' | 'stroke';
  /** Stroke width in the motif's box units, default 1.5 (1.5 reads as about 1.2 px on a 300 px tile). */
  readonly width?: number;
  /** Fill with the even-odd rule, so that a loop inside a loop is a hole (an ink drawing). Allows a longer path. */
  readonly evenodd?: boolean;
}

export interface ComposeOptions {
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  readonly repeat: Repeat;
  /** 0 to 1. */
  readonly density: number;
  /** The motif families that may appear (at least one); ids of another theme are ignored. */
  readonly families: readonly ThemeFamily[];
  /** Default 'floral'. */
  readonly theme?: Theme;
  readonly colors: {
    readonly background: string;
    readonly leaf: string;
    readonly bloom: string;
    readonly detail: string;
    readonly stem: string;
    /** The ground layer's color (the palette's soft color); default a mix of background and leaf. */
    readonly ground?: string;
  };
  readonly stems: boolean;
  /** A motif of the person's own (a cropped trace): one shape per color, back to front, filled or (a line drawing)
   * stroked; strokes are drawn above the fills. It replaces the generated hero motifs, the supports along the stems, or
   * both. Shapes whose path data is unsafe are dropped. */
  readonly custom?: {
    readonly shapes: readonly CustomShape[];
    readonly box: number;
    readonly role: 'hero' | 'support' | 'both';
    readonly keepColors: boolean;
    /** 0.4 to 3, default 1: a factor on the size the composer gives the motif. */
    readonly scale?: number;
    /** Where the motif meets its stem: 'base' (default) its box's bottom center, 'center' its box's center. */
    readonly anchor?: 'base' | 'center';
  };
  /** 1 (default) or 2: width and height hold span x span unit tiles of side min(width, height) / span; motif sizes and
   * distances follow the unit, counts that scale with area (plants, twigs, filler) are multiplied by span x span. */
  readonly span?: 1 | 2;
  /** Default false (one attempt). True: when the tiled result has a dense strip or a large hole, up to 6 attempts with
   * derived seeds (span 1 only) and keep the best. */
  readonly balance?: boolean;
  /** Default false. True: a quiet layer of tiny foliage under everything (ground.ts), in colors.ground; it is not part of
   * the spacing rules nor of the balance measure. */
  readonly ground?: boolean;
}

/** Smallest circle around the bounds' center that holds the bounds, and its offset from the box center. */
export function motifRadius(m: StudioMotif): { radius: number; cx: number; cy: number } {
  const b = motifBounds(m.d);
  return {
    radius: Math.hypot(b.maxX - b.minX, b.maxY - b.minY) / 2,
    cx: (b.minX + b.maxX - m.box) / 2,
    cy: (b.minY + b.maxY - m.box) / 2,
  };
}

export type Theme = 'floral' | 'sea' | 'orchard';
export type ThemeFamily = MotifFamily | SeaFamily | OrchardFamily;
export const THEMES: readonly { readonly id: Theme; readonly label: string }[] = [
  { id: 'floral', label: 'Floral' },
  { id: 'sea', label: 'Sea' },
  { id: 'orchard', label: 'Orchard' },
];
type Made = { silhouette: StudioMotif; detail: StudioMotif };
// Per theme: its families and labels, its role pools (plant tips, supports along the stems, small motifs: branch ends and
// filler), its motif maker, and the families whose silhouette takes the bloom color (the others take the leaf color).
const THEME_TABLE: Record<
  Theme,
  {
    families: readonly ThemeFamily[];
    labels: Readonly<Record<string, string>>;
    tiers: readonly (readonly ThemeFamily[])[];
    make: (f: ThemeFamily, seed: number) => Made;
    blooms: readonly ThemeFamily[];
    /** Families that hang (fruit): body straight down whatever the stem's direction. */
    hangs?: readonly ThemeFamily[];
    /** Families that float free: only in the gaps, never on a stem or stalk end, drawn level (not rotated). */
    floats?: readonly ThemeFamily[];
    /** Families of which a plant carries only one (fruit): each plant is dealt one, every fruit on it is of that one. */
    onePerPlant?: readonly ThemeFamily[];
  }
> = {
  floral: {
    families: MOTIF_FAMILIES,
    labels: MOTIF_LABELS,
    tiers: [
      ['flower', 'frond', 'leaf'],
      ['leaf', 'sprig', 'bud'],
      ['berry', 'bud'],
    ],
    make: (f, seed) => makeMotif(f as MotifFamily, seed),
    blooms: ['flower', 'bud', 'berry'],
  },
  sea: {
    families: SEA_FAMILIES,
    labels: SEA_LABELS,
    tiers: [SEA_ROLES.hero, SEA_ROLES.support, SEA_ROLES.filler],
    make: (f, seed) => makeSeaMotif(f as SeaFamily, seed),
    blooms: ['coral', 'shell', 'starfish', 'fish', 'bubbles'],
    floats: ['fish', 'bubbles'],
  },
  orchard: {
    families: ORCHARD_FAMILIES,
    labels: ORCHARD_LABELS,
    tiers: [ORCHARD_ROLES.hero, ORCHARD_ROLES.support, ORCHARD_ROLES.filler],
    make: (f, seed) => makeOrchardMotif(f as OrchardFamily, seed),
    blooms: ['pear', 'apple', 'cherries', 'lemon', 'blossom'],
    hangs: ['pear', 'apple', 'cherries', 'lemon'],
    onePerPlant: ['pear', 'apple', 'cherries', 'lemon'],
  },
};

/** The theme's six families, in order (bit i of the link's family mask is the i-th), with their labels. */
export function themeFamilies(theme: Theme): { id: ThemeFamily; label: string }[] {
  const t = THEME_TABLE[theme] ?? THEME_TABLE.floral;
  return t.families.map((id) => ({ id, label: t.labels[id]! }));
}
const VARIANTS = 2; // ponytail: 2 per tier keeps 2 x 2 + 2 x 2 + 2 + 1 stem motif = 11 motifs.
// A branch's stem may come closer than the stem distance to its host within this share of the side.
const JUNCTION = 0.16;
// The hero's largest radius, as a share of the side (0.12 x 1.1).
const HERO_MAX = 0.132;
// A custom motif's union diameter never exceeds this share of the tile's shorter side, whatever its scale.
const CUSTOM_MAX = 0.6;
const num = (v: number) => String(Math.round(v * 10) / 10);

export interface ComposeParts {
  readonly studio: Studio;
  /** Hero placements (the tip motif of each plant), with motif indices into studio.motifs (the silhouettes). */
  readonly heroes: readonly Placement[];
  /** The family of each motif variant used: tip, support, small (the 2 x 3 base variants, not the per-plant fruit). */
  readonly families: readonly ThemeFamily[];
  /** The family of every generated silhouette, by motif index (per-plant fruit variants too). */
  readonly familyOf: Readonly<Record<number, ThemeFamily>>;
  readonly plants: readonly Plant[];
  /** Small motifs in the gaps between plants (silhouettes). */
  readonly filler: readonly Placement[];
  /** Filler keeps this distance, plus its own radius, from every stem sample. */
  readonly fillerMargin: number;
  /** Stems keep this distance from the stems of other plants. */
  readonly stemDistance: number;
  /** A branch's stem may come closer than stemDistance to its host within this distance of its start. */
  readonly junction: number;
  /** How the tiled result reads (tracking.ts). */
  readonly tracking: Tracking;
}

export interface Plant {
  /** Samples of the main stem in tile units, 129 over the full stem, cut where a moved hero or the last support ends it
   * (not wrapped: the stem may cross tile edges). */
  readonly stem: readonly Pt[];
  /** The hero, or null when it found no free place even at 0.6 of its size. */
  readonly tip: Placement | null;
  /** The hero's stalk when the hero ends a side branch (vine), else null (the hero sits at the stem's tip). */
  readonly tipStalk: readonly [Pt, Pt] | null;
  /** A vine's stem is closed on the repeat: it ends at its start plus one lattice vector. */
  readonly vine: boolean;
  /** Index of the plant whose stem this one starts on, or null (vine, mirror root). */
  readonly host: number | null;
  /** Support motifs along the stem; side -1 or 1; stalk null for supports (on the stem), a stalk for the side branch's end. */
  readonly attached: readonly { readonly placement: Placement; readonly side: number; readonly stalk: readonly [Pt, Pt] | null }[];
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
const md = (d: number, size: number) => d - size * Math.round(d / size);
const mod = (a: number, m: number) => ((a % m) + m) % m;

/** The two period vectors of a repeat (mirror: the plain torus; its motifs keep off the edges). */
function lattice(repeat: Repeat, w: number, h: number): [Pt, Pt] {
  if (repeat === 'half-drop')
    return [
      [w, h / 2],
      [0, h],
    ];
  if (repeat === 'brick')
    return [
      [w, 0],
      [w / 2, h],
    ];
  return [
    [w, 0],
    [0, h],
  ];
}

/** Shortest distance between a and b over every copy of the repeat's lattice. */
export function latticeDistance(a: Pt, b: Pt, repeat: Repeat, w: number, h: number): number {
  let dx = a[0] - b[0];
  let dy = a[1] - b[1];
  if (repeat === 'half-drop') {
    const k = Math.round(dx / w);
    dx -= k * w;
    dy = md(dy - (k * h) / 2, h);
  } else if (repeat === 'brick') {
    const k = Math.round(dy / h);
    dy -= k * h;
    dx = md(dx - (k * w) / 2, w);
  } else return Math.hypot(md(dx, w), md(dy, h)); // a rectangle: the nearest copy is the wrapped one (the hot path)
  // ponytail: the lattice vectors inline, no allocation; this runs millions of times at span 2.
  const hd = repeat === 'half-drop';
  const uy = hd ? h / 2 : 0;
  const vx = hd ? 0 : w / 2;
  // Squared lengths pick the candidates; Math.hypot only on those within 1e-9 of the least, so the result is the same
  // minimum of Math.hypot over the 9 copies as before.
  let least = Infinity;
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++) {
      const x = dx + i * w + j * vx;
      const y = dy + i * uy + j * h;
      least = Math.min(least, x * x + y * y);
    }
  let best = Infinity;
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++) {
      const x = dx + i * w + j * vx;
      const y = dy + i * uy + j * h;
      if (x * x + y * y <= least * (1 + 1e-9)) best = Math.min(best, Math.hypot(x, y));
    }
  return best;
}

/** The same point moved into the tile by a lattice vector of the repeat. */
function wrapPoint(x: number, y: number, repeat: Repeat, w: number, h: number): Pt {
  if (repeat === 'half-drop') {
    const k = Math.floor(x / w);
    return [x - k * w, mod(y - (k * h) / 2, h)];
  }
  if (repeat === 'brick') {
    const k = Math.floor(y / h);
    return [mod(x - (k * w) / 2, w), y - k * h];
  }
  return [mod(x, w), mod(y, h)];
}

const round = (v: number, k: number) => Math.round(v * k) / k;
const deg = (a: number) => (a * 180) / Math.PI;

// parts: the custom motif's shapes (motif indices, back to front), placed together; null for a generated motif.
type Variant = {
  sil: number;
  det: number | null;
  radius: ReturnType<typeof motifRadius>;
  bloom: boolean;
  box: number;
  parts: number[] | null;
  /** The radius the motif is scaled by: its bounding radius, or (custom motif) its body's radius over sqrt(2/pi), over
   * the person's scale. */
  body: number;
  /** The motif's box center sits on its base (custom anchor 'center'). */
  centered: boolean;
  /** Fruit: hangs from its base, body down (+y) with a small seeded swing. */
  hang: boolean;
  /** Placed only in the gaps, unrotated (the theme's `floats`). */
  floats?: boolean;
  /** The generated motif's family, null for a custom motif. */
  fam: ThemeFamily | null;
};

/** A custom motif's body: the circle with the area of the tight bounds of its largest shape whose bounds are not thin
 * (aspect below 4), else of the union bounds; over sqrt(2/pi), the body of a square-bounded generated motif of radius 1,
 * so that the body matches a generated hero's. */
function customBody(ds: readonly string[], union: string): number {
  const area = (d: string) => {
    const b = motifBounds(d);
    const [bw, bh] = [b.maxX - b.minX, b.maxY - b.minY];
    return Math.max(bw, bh) < 4 * Math.min(bw, bh) ? bw * bh : 0;
  };
  const best = Math.max(...ds.map(area));
  const a = best > 0 ? best : ((b) => (b.maxX - b.minX) * (b.maxY - b.minY))(motifBounds(union));
  return Math.sqrt(a / Math.PI) / Math.sqrt(2 / Math.PI);
}

/** One attempt: the composition of exactly this seed (composeParts searches over attempts). */
export function composeOnce(o: ComposeOptions): Omit<ComposeParts, 'tracking'> {
  const theme = THEME_TABLE[o.theme ?? 'floral'] ?? THEME_TABLE.floral;
  const own0 = o.families.filter((f) => theme.families.includes(f));
  // None of the theme's: its first support family.
  const allowed = own0.length > 0 ? own0 : [theme.tiers[1]![0]!];
  const { width: w, height: h, repeat } = o;
  const span = o.span === 2 ? 2 : 1;
  const area = span * span;
  const side = Math.min(w, h) / span;
  const density = clamp01(o.density);
  const rnd = mulberry32(o.seed ^ 0x2c1b3c6d);
  const motifs: StudioMotif[] = [];
  const families: ThemeFamily[] = [];
  const customShapes = (o.custom?.shapes ?? []).flatMap((c) => {
    const d = safePathData(c.d, c.evenodd ? INK_MAX_LENGTH : undefined);
    return d
      ? [{ color: c.color, d, paint: c.paint ?? 'fill', width: c.width ?? 1.5, ...(c.evenodd ? { evenodd: true as const } : {}) }]
      : [];
  });
  const custom = o.custom && customShapes.length > 0 && o.custom.box > 0 ? { ...o.custom, shapes: customShapes } : null;
  let customVariant: Variant | null = null;
  const familyOf: Record<number, ThemeFamily> = {};
  const makeVariant = (fam: ThemeFamily, ti: number, i: number): Variant => {
    const m = theme.make(fam, o.seed * 97 + ti * 13 + i);
    motifs.push(m.silhouette);
    familyOf[motifs.length - 1] = fam;
    // ponytail: small motifs (about 24 px) read as silhouettes; their detail would cost bytes, not looks.
    if (ti !== 2) motifs.push(m.detail);
    return {
      sil: motifs.indexOf(m.silhouette),
      det: ti !== 2 ? motifs.length - 1 : null,
      radius: motifRadius(m.silhouette),
      bloom: theme.blooms.includes(fam),
      box: m.silhouette.box,
      parts: null,
      body: motifRadius(m.silhouette).radius,
      centered: false,
      hang: theme.hangs?.includes(fam) ?? false,
      floats: theme.floats?.includes(fam) ?? false,
      fam,
    };
  };
  const variants = theme.tiers.map((pool, ti): Variant[] => {
    if (custom && ((ti === 0 && custom.role !== 'support') || (ti === 1 && custom.role !== 'hero'))) {
      rnd(); // the same draws as a generated tier, so the rest of the layout stays as it was
      if (!customVariant) {
        const parts = custom.shapes.map(
          (c) => motifs.push({ d: c.d, box: custom.box, paint: c.paint, ...(c.evenodd ? { evenodd: true } : {}) }) - 1,
        );
        // One motif to the rules: its bounds are the union of its shapes.
        const union = custom.shapes.map((c) => c.d).join('');
        const radius = motifRadius({ d: union, box: custom.box, paint: 'fill' });
        // Sized by its body, but its union bounds at most 1.8 times the generated motif's diameter, unless the person
        // asks for a larger motif (then `put` still keeps it under CUSTOM_MAX of the side).
        const k = Math.min(3, Math.max(0.4, Number.isFinite(custom.scale) ? custom.scale! : 1));
        const own = customBody(
          custom.shapes.map((c) => c.d),
          union,
        );
        const body = (k > 1 ? own : Math.max(own, radius.radius / 1.8)) / k;
        const centered = custom.anchor === 'center';
        customVariant = { sil: parts[0]!, det: null, radius, bloom: false, box: custom.box, parts, body, centered, hang: false, fam: null };
      }
      return [customVariant, customVariant];
    }
    const fams0 = pool.filter((f) => allowed.includes(f));
    const fams = fams0.length > 0 ? fams0 : [...allowed];
    const start = Math.floor(rnd() * fams.length);
    return Array.from({ length: VARIANTS }, (_, i) => {
      const fam = fams[(start + i) % fams.length]!;
      families.push(fam);
      return makeVariant(fam, ti, i);
    });
  });
  // One fruit per plant (the theme's onePerPlant): plant i gets deal[i mod n], dealt round-robin from a seeded shuffle of
  // the enabled fruit (its own generator, so rnd keeps its draws). A fruit variant of another family on that plant is
  // swapped for one of the plant's fruit. Leaves, blossom and the gap filler keep their pick.
  const deal = (theme.onePerPlant ?? []).filter((f) => allowed.includes(f));
  const rs = mulberry32(o.seed ^ 0x6a09e667);
  for (let i = deal.length - 1; i > 0; i--) {
    const j = Math.floor(rs() * (i + 1));
    [deal[i], deal[j]] = [deal[j]!, deal[i]!];
  }
  const fruitOf = (plant: number): ThemeFamily | null => (deal.length > 0 ? deal[plant % deal.length]! : null);
  const swapped = new Map<string, Variant>();
  const pick = (ti: number, i: number, fruit: ThemeFamily | null): Variant => {
    const v = variants[ti]![i % VARIANTS]!;
    if (!fruit || !v.fam || v.fam === fruit || !theme.onePerPlant!.includes(v.fam)) return v;
    // ponytail: any variant of that fruit serves every tier (the size comes from the placement), so a wallpaper adds at
    // most one motif per enabled fruit; a silhouette only, to keep the motif count down.
    const have = variants.flat().find((x) => x.fam === fruit);
    if (have) return have;
    if (!swapped.has(fruit)) swapped.set(fruit, makeVariant(fruit, 2, VARIANTS + swapped.size));
    return swapped.get(fruit)!;
  };

  // Fruit hangs: straight down plus a swing of at most 12 degrees, seeded by the seed and the base (no draw from rnd, so
  // the rest of the layout keeps its draws).
  const swing = (q: Pt) =>
    (mulberry32((o.seed ^ Math.imul(Math.round(q[0] * 10), 73856093) ^ Math.imul(Math.round(q[1] * 10), 19349663)) >>> 0)() * 2 - 1) * 12;
  // A motif whose base sits at `base`, pointing along angle `a` (radians), with real circle radius r.
  const put = (v: Variant, base: Pt, a0: number, r: number, flip: boolean): Placement => {
    const a = v.hang ? ((90 + swing(base)) * Math.PI) / 180 : a0;
    const rotate = Math.round(deg(a) + 90);
    const cap = v.parts ? Math.floor(((CUSTOM_MAX * side) / 2 / v.radius.radius) * 100) / 100 : Infinity;
    const scale = Math.min(round(r / v.body, 100), cap);
    const t = (rotate * Math.PI) / 180;
    const lift = v.centered ? 0 : (v.box / 2) * scale;
    const [x, y] = [base[0] + lift * Math.sin(t), base[1] - lift * Math.cos(t)];
    return { motif: v.sil, x: round(x, 10), y: round(y, 10), scale, rotate, flip };
  };
  const realCircle = (v: Variant, p: Placement) => {
    const t = (p.rotate * Math.PI) / 180;
    const ox = v.radius.cx * p.scale * (p.flip ? -1 : 1);
    const oy = v.radius.cy * p.scale;
    return {
      c: [p.x + ox * Math.cos(t) - oy * Math.sin(t), p.y + ox * Math.sin(t) + oy * Math.cos(t)] as Pt,
      r: v.radius.radius * p.scale,
    };
  };
  const dist = (a: Pt, b: Pt) => latticeDistance(a, b, repeat, w, h);
  const margin = repeat === 'mirror' ? 0.02 * side : 0;
  const inside = (c: Pt, r: number) =>
    repeat !== 'mirror' || (c[0] - r >= margin && c[1] - r >= margin && c[0] + r <= w - margin && c[1] + r <= h - margin);

  // The stem motif's box, centered on the tile, holds stems that cross the tile edges.
  const box = Math.ceil(Math.max(w, h) + 2.6 * side);
  const shift: Pt = [(box - w) / 2, (box - h) / 2];
  const gap = (2 * side) / 300;
  const half = (0.005 * side) / 2;
  const minStalk = 0.04 * side;
  type Circle = { c: Pt; r: number; v: Variant; p: Placement };
  type Knot = { p: Pt; a: number };
  const flowAt = (q: Pt) => (flowAngle(mod(q[0], w), mod(q[1], h), w, h, o.seed, true) * Math.PI) / 180;
  const step = (q: Pt, a: number, l: number): Pt => [q[0] + Math.cos(a) * l, q[1] + Math.sin(a) * l];

  // Root (mirror): integrate the calm flow in 6 steps with a gentle per-plant bend.
  const rootKnots = (start: Pt, r: () => number): Knot[] => {
    const len = side * (0.6 + 0.15 * r());
    const bend = ((r() * 2 - 1) * Math.PI) / 5;
    const ks: Knot[] = [];
    for (let i = 0, p = start; i <= 6; i++) {
      const a = flowAt(p) + bend * (i / 6 - 0.5);
      ks.push({ p, a });
      p = step(p, a, len / 6);
    }
    return ks;
  };
  // Vine: integrate the flow across one period along the lattice vector nearest the flow's direction;
  // the last third (one cubic from knot 4) bends the end onto start + that vector with the start's direction.
  const vineKnots = (start: Pt): Knot[] => {
    const a0 = flowAt(start);
    const [u, v] = lattice(repeat, w, h);
    const cands = [u, v, [u[0] - v[0], u[1] - v[1]], [u[0] + v[0], u[1] + v[1]]].flatMap((c): Pt[] => [
      [c[0]!, c[1]!],
      [-c[0]!, -c[1]!],
    ]);
    const L = cands.reduce((b, c) => (Math.cos(Math.atan2(c[1], c[0]) - a0) > Math.cos(Math.atan2(b[1], b[0]) - a0) ? c : b));
    const len = Math.hypot(L[0], L[1]);
    const ks: Knot[] = [];
    for (let i = 0, p = start; i < 6; i++) {
      const a = flowAt(p);
      ks.push({ p, a });
      p = step(p, a, len / 6);
    }
    ks.push({ p: [start[0] + L[0], start[1] + L[1]], a: a0 });
    return ks;
  };
  // Branch: leaves the host at `dev` on side `sg`, then curves back toward the flow.
  const branchKnots = (start: Pt, hostA: number, sg: number, dev: number, len: number): Knot[] => {
    const ks: Knot[] = [{ p: start, a: hostA + sg * dev }];
    for (let i = 1, p = step(start, hostA + sg * dev, len / 6); i <= 6; i++) {
      const a = flowAt(p) + sg * dev * (1 - (0.75 * i) / 6);
      ks.push({ p, a });
      p = step(p, a, len / 6);
    }
    return ks;
  };

  // A stem through 7 knots: 3 cubics, sampled 129 times, with its point and direction at u in [0, 1].
  type Stem = {
    stem: Pt[];
    segs: Cubic[];
    at: (u: number) => Knot;
    vine: boolean;
    host: number | null;
    r: () => number;
    flip: boolean;
    sA: number;
    hero: Knot;
    heroU: number;
    tipStalk: [Pt, Pt] | null;
    zone: Circle[];
  };
  const stemOf = (knots: Knot[], vine: boolean, host: number | null, seed: number, idx: number): Stem => {
    const segs = [0, 2, 4].map((i): Cubic => {
      const [k0, k1] = [knots[i]!, knots[i + 2]!];
      const l = Math.hypot(k1.p[0] - k0.p[0], k1.p[1] - k0.p[1]) / 3;
      return [k0.p, step(k0.p, k0.a, l), step(k1.p, k1.a, -l), k1.p];
    });
    const at = (u: number): Knot => {
      const s = Math.min(2, Math.floor(u * 3));
      const c = segs[s]!;
      const t = u * 3 - s;
      const q = 1 - t;
      const pt: Pt = [0, 1].map(
        (k) => q * q * q * c[0][k]! + 3 * q * q * t * c[1][k]! + 3 * q * t * t * c[2][k]! + t * t * t * c[3][k]!,
      ) as unknown as Pt;
      const dt = [0, 1].map(
        (k) => 3 * q * q * (c[1][k]! - c[0][k]!) + 6 * q * t * (c[2][k]! - c[1][k]!) + 3 * t * t * (c[3][k]! - c[2][k]!),
      );
      return { p: pt, a: Math.atan2(dt[1]!, dt[0]!) };
    };
    // The hero's base: the tip, or (vine, which has no tip) the end of a side stalk. Chosen here so that
    // phase 1 keeps the hero's area (its largest circle, either flip) free of other stems.
    const r = mulberry32(seed + 1);
    const flip = r() < 0.5;
    const sA = r() < 0.5 ? -1 : 1;
    let hero = at(1);
    let heroU = 1;
    let tipStalk: [Pt, Pt] | null = null;
    if (vine) {
      heroU = 0.2 + 0.6 * r();
      const q = at(heroU);
      const a = q.a + (-sA * 45 * Math.PI) / 180;
      hero = { p: step(q.p, a, 0.12 * side), a };
      tipStalk = [q.p, hero.p];
    }
    const hv = pick(0, idx, fruitOf(idx));
    const zone = [false, true].map((fl) => {
      const pl = put(hv, hero.p, hero.a, 0.6 * HERO_MAX * side, fl);
      return { ...realCircle(hv, pl), v: hv, p: pl };
    });
    return { stem: Array.from({ length: 129 }, (_, i) => at(i / 128).p), segs, at, vine, host, r, flip, sA, hero, heroU, tipStalk, zone };
  };

  // Phase 1, stems only. The first stem (two at high density) is a vine through the repeat; every other
  // stem branches off an existing one, a vine first, so the tile reads as one growth. Mirror: one root
  // stem instead. Only stem rules apply: a start on the host, distance between stems outside a short
  // junction zone, and (mirror) the tile margin.
  const stems: Stem[] = [];
  const want = Math.round((2 + 3 * density) * area);
  // span 2: one vine cannot cross the larger tile, so two (as at high density).
  const vines = repeat === 'mirror' ? 0 : density > 0.7 || span === 2 ? 2 : 1;
  const stemDistance0 = 0.16 * side;
  const junction = JUNCTION * side;
  let stemDistance = stemDistance0;
  let s0 = 1;
  // A host stem may not be cut before its last branch's junction (as u in [0, 1]).
  const minU: number[] = [];
  // Too few stems: retry the missing branches shorter (0.7, then 0.5 of the range) with a smaller junction zone.
  for (const [lk, budget] of [
    [1, 240],
    [0.7, 120],
    [0.5, 120],
    // Still short (only then, so compositions that already fit keep their draw order): more start positions per plant.
    [0.7, 400],
    [0.5, 400],
    [0.35, 400],
  ] as const)
    for (let tries = 0; stems.length < (lk === 1 ? want : Math.max(3, want)) && tries < budget * area; tries++) {
      if (lk === 1 && tries > 0 && tries % (60 * area) === 0) stemDistance *= 0.8;
      if (budget === 400 && tries === 200 * area) stemDistance *= 0.85;
      const s = Math.floor(rnd() * 2 ** 32);
      const idx = stems.length;
      let st: Stem;
      let host: number | null = null;
      let ju = 0;
      if (repeat === 'mirror' && idx === 0) {
        const r0 = mulberry32(s);
        const first = stemOf(rootKnots([rnd() * w, rnd() * h], r0), false, null, s, idx).stem;
        // Mirror: center the stem's bounds in the tile, then grow it again from there.
        const xs = first.map((q) => q[0]);
        const ys = first.map((q) => q[1]);
        const [sx, sy] = [w / 2 - (Math.min(...xs) + Math.max(...xs)) / 2, h / 2 - (Math.min(...ys) + Math.max(...ys)) / 2];
        const start: Pt = [first[0]![0] + sx + (rnd() - 0.5) * 0.3 * w, first[0]![1] + sy + (rnd() - 0.5) * 0.3 * h];
        st = stemOf(rootKnots(start, mulberry32(s)), false, null, s, idx);
      } else if (idx < vines && (lk === 1 ? tries < 120 * area : idx === 0)) {
        st = stemOf(vineKnots([rnd() * w, rnd() * h]), true, null, s, idx);
      } else {
        if (stems.length === 0) continue;
        const vineIdx = stems.flatMap((q, i) => (q.vine ? [i] : []));
        host = vineIdx.length > 0 && rnd() < 0.6 ? vineIdx[Math.floor(rnd() * vineIdx.length)]! : Math.floor(rnd() * stems.length);
        const hs = stems[host]!.stem;
        if (idx === 1 || (idx === vines && vines > 0)) s0 = rnd() < 0.5 ? -1 : 1;
        const sg = idx % 2 === 0 ? s0 : -s0;
        const dev = ((30 + 30 * rnd()) * Math.PI) / 180;
        // A junction between 20 and 80 percent of the host.
        const k = 26 + Math.floor(rnd() * 77);
        ju = k / 128;
        const hostA = Math.atan2(hs[k + 1]![1] - hs[k - 1]![1], hs[k + 1]![0] - hs[k - 1]![0]);
        const len = lk * side * (repeat === 'mirror' ? 0.35 + 0.15 * rnd() : 0.5 + 0.3 * rnd());
        st = stemOf(branchKnots(hs[k]!, hostA, sg, dev, len), false, host, s, idx);
      }
      if (!st.stem.every((q) => inside(q, 0))) continue;
      // Stems keep their distance, except a branch near its junction with its host.
      const st0 = st.stem[0]!;
      const sparse = st.stem.filter((_, i) => i % 8 === 0);
      const near = (j: number, b: Pt) => j === host && Math.hypot(b[0] - st0[0], b[1] - st0[1]) < junction * lk;
      if (stems.some((q, j) => q.stem.some((a, i) => i % 8 === 0 && sparse.some((b) => !near(j, b) && dist(a, b) < stemDistance))))
        continue;
      // Each hero's area stays free of the other stems (and of the other heroes' areas).
      const free = (z: readonly Circle[], line: readonly Pt[]) => z.every((c) => line.every((q) => dist(c.c, q) >= c.r + half + gap));
      if (!stems.every((q) => free(q.zone, st.stem) && free(st.zone, q.stem))) continue;
      if (stems.some((q) => q.zone.some((a) => st.zone.some((b) => dist(a.c, b.c) < a.r + b.r + gap)))) continue;
      stems.push(st);
      minU.push(0);
      if (host !== null) minU[host] = Math.max(minU[host]!, ju);
    }

  // Phase 2, motifs: every plant's hero first, then plant by plant the supports and a side branch. A motif that would come
  // closer than the gap to another plant's stem or placed motif shrinks, then moves along its stem, then drops.
  type Built = Omit<Plant, 'attached'> & {
    attached: Plant['attached'][number][];
    circles: Circle[];
    segs: Cubic[];
    stalks: [Pt, Pt][];
    fruit: ThemeFamily | null;
  };
  // Supports every `spacing` along a stem: 12% of the side at density 0.2, 9% at 0.5, 7% at 0.9.
  const spacing = side * (density <= 0.5 ? 0.12 - 0.1 * (density - 0.2) : 0.09 - 0.05 * (density - 0.5));
  const plants: Built[] = [];
  const placed: Circle[][] = stems.map(() => []);
  const clearOf = (self: number, c: Pt, r: number) =>
    inside(c, r) &&
    stems.every((q, j) => j === self || q.stem.every((s) => dist(c, s) >= r + half + gap)) &&
    placed.every((q, j) => j === self || q.every((k) => dist(c, k.c) >= r + k.r + gap));
  // The hero: at the tip, or (vine, which has no tip) at the end of a side stalk; shrunk to 0.6 before it moves.
  // Then back along the stem (the stem is cut at its base), or for the vine its stalk moves along the loop and sides.
  const ends = stems.map(() => 1);
  const tipStalks = stems.map((st) => st.tipStalk);
  const tips = stems.map(({ r, flip, hero: hb, heroU, at, vine, sA }, index): Placement | null => {
    const hv = pick(0, index, fruitOf(index));
    const hr = 0.12 * side * (0.9 + 0.2 * r());
    const tryAt = (q: Knot, ks: readonly number[]): Placement | null => {
      for (const k of ks) {
        const pl = put(hv, q.p, q.a, hr * k, flip);
        const c = realCircle(hv, pl);
        if (!clearOf(index, c.c, c.r)) continue;
        placed[index]!.push({ ...c, v: hv, p: pl });
        return pl;
      }
      return null;
    };
    const first = tryAt(hb, [1, 0.9, 0.8, 0.7, 0.6]);
    if (first) return first;
    const ks = [1, 0.85, 0.7];
    if (vine) {
      for (let j = 0; j < 10; j++)
        for (const sg of [sA, -sA]) {
          if (j === 0 && sg === sA) continue;
          const q = at(mod(heroU + 0.1 * j, 1));
          const a = q.a + (-sg * 45 * Math.PI) / 180;
          const b = step(q.p, a, 0.12 * side);
          const pl = tryAt({ p: b, a }, ks);
          if (!pl) continue;
          tipStalks[index] = [q.p, b];
          return pl;
        }
      return null;
    }
    for (let i = 1; 1 - 0.06 * i >= Math.max(0.55, minU[index]!) - 1e-9; i++) {
      const u = 1 - 0.06 * i;
      const pl = tryAt(at(u), ks);
      if (!pl) continue;
      ends[index] = u;
      return pl;
    }
    return null;
  });
  // The first part, up to u, of a stem's three cubics (de Casteljau split).
  const cutSegs = (segs: readonly Cubic[], u: number): Cubic[] => {
    const s = Math.min(2, Math.floor(u * 3));
    const t = u * 3 - s;
    if (t < 1e-9) return segs.slice(0, s);
    const [c0, c1, c2, c3] = segs[s]!;
    const lerp = (a: Pt, b: Pt): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const [p01, p12, p23] = [lerp(c0, c1), lerp(c1, c2), lerp(c2, c3)];
    const [p012, p123] = [lerp(p01, p12), lerp(p12, p23)];
    return [...segs.slice(0, s), [c0, p01, p012, lerp(p012, p123)]];
  };
  stems.forEach(({ stem: full, segs: fullSegs, at, vine, host, r, sA }, index) => {
    const circles = placed[index]!;
    const tip = tips[index]!;
    const tipStalk = tip ? tipStalks[index]! : null;
    let end = ends[index]!;
    let lastU = minU[index]!;
    const stalks: [Pt, Pt][] = tipStalk ? [tipStalk] : [];
    // Support motifs at alternating sides, on the stem, pointing away from it, smaller toward the tip: one per `spacing`
    // of stem length, each moved by a seeded jitter of up to a quarter spacing.
    const cum = [0];
    for (let i = 1; i <= Math.round(end * 128); i++)
      cum.push(cum[i - 1]! + Math.hypot(full[i]![0] - full[i - 1]![0], full[i]![1] - full[i - 1]![1]));
    const L = cum.at(-1)!;
    const uAt = (s: number) => {
      const i = cum.findIndex((c) => c >= s);
      return (i < 0 ? cum.length - 1 : i) / 128;
    };
    const n = Math.max(1, Math.floor(L / spacing));
    const sStart = (L - n * spacing) / 2;
    const attached: Built['attached'][number][] = [];
    // Supports and the side branch's end also keep the gap from the plant's own hero and from each other.
    const ownClear = (c: { c: Pt; r: number }) => clearOf(index, c.c, c.r) && circles.every((k) => dist(c.c, k.c) >= c.r + k.r + gap);
    for (let i = 0; i < n; i++) {
      const s = sStart + (i + 0.5) * spacing + ((r() * 2 - 1) * spacing) / 4;
      const sideSign = i % 2 === 0 ? sA : -sA;
      const turn = (sideSign * (40 + 25 * r()) * Math.PI) / 180;
      const v = pick(1, i, fruitOf(index));
      const rr = 0.075 * side * (vine ? 0.85 + 0.15 * r() : 1 - (0.4 * i) / n);
      const fl = r() < 0.5;
      // ponytail: full size, 0.8, then 0.8 at 3 next positions along the stem (0.3 spacing apart) on the same side.
      for (const [ds, k] of [
        [0, 1],
        [0, 0.8],
        [0.3, 0.8],
        [0.6, 0.8],
        [0.9, 0.8],
      ] as const) {
        const u = uAt(Math.max(0, s + ds * spacing));
        if (u > end - 0.03) break;
        const q = at(u);
        const pl = put(v, q.p, q.a + turn, rr * k, fl);
        const c = realCircle(v, pl);
        if (!ownClear(c)) continue;
        attached.push({ placement: pl, side: sideSign, stalk: null });
        circles.push({ ...c, v, p: pl });
        lastU = Math.max(lastU, u);
        break;
      }
    }
    // One short side branch ending in a small motif (bud or berries), opposite the nearest support.
    if (r() < 0.3 + 0.5 * density && !pick(2, index, fruitOf(index)).floats) {
      const qu = (0.5 + 0.1 * r()) * end;
      const q = at(qu);
      const sideSign = n % 2 === 0 ? sA : -sA;
      const a = q.a + (sideSign * 50 * Math.PI) / 180;
      const b = step(q.p, a, 0.1 * side);
      const v = pick(2, index, fruitOf(index));
      const pl = put(v, b, a, 0.04 * side, r() < 0.5);
      const c = realCircle(v, pl);
      if (ownClear(c)) {
        lastU = Math.max(lastU, qu);
        stalks.push([q.p, b]);
        attached.push({ placement: pl, side: sideSign, stalk: [q.p, b] });
        circles.push({ ...c, v, p: pl });
      }
    }
    // No hero: the stem ends just beyond its last support or, with none, its last branch junction; not bare.
    if (!tip && !vine) end = Math.min(1, lastU + 0.02);
    const stem = end < 1 ? full.slice(0, Math.ceil(end * 128 - 1e-9) + 1) : full;
    const segs = end < 1 ? cutSegs(fullSegs, end) : fullSegs;
    plants.push({ stem, tip, tipStalk, attached, circles, segs, stalks, vine, host, fruit: fruitOf(index) });
  });

  // A plant with no motif that no other plant starts on goes (its host may then become one); hosts are renumbered.
  for (;;) {
    const i = plants.findIndex((pl, j) => !pl.tip && pl.attached.length === 0 && !plants.some((q) => q.host === j));
    if (i < 0) break;
    plants.splice(i, 1);
    for (const [j, pl] of plants.entries()) if (pl.host !== null && pl.host > i) plants[j] = { ...pl, host: pl.host - 1 };
  }

  // Filler: small motifs, their real circle at c, clear of every motif circle and, by a margin, of every stem and stalk.
  const fillerMargin = 0.03 * side;
  const filler: { v: Variant; p: Placement }[] = [];
  const fr = 0.04 * side;
  const fillerAt = (c: Pt, v: Variant): Placement => {
    const rotate0 = Math.round(rnd() * 360);
    const rotate = v.hang ? Math.round(180 + swing(c)) : v.floats ? 0 : rotate0;
    const scale = round(fr / v.radius.radius, 100);
    const fl = rnd() < 0.5;
    // Move the anchor so the real circle sits at the chosen point.
    const t = (rotate * Math.PI) / 180;
    const ox = v.radius.cx * scale * (fl ? -1 : 1);
    const oy = v.radius.cy * scale;
    return {
      motif: v.sil,
      x: round(c[0] - (ox * Math.cos(t) - oy * Math.sin(t)), 10),
      y: round(c[1] - (ox * Math.sin(t) + oy * Math.cos(t)), 10),
      scale,
      rotate,
      flip: fl,
    };
  };
  const stalkPts = ([a, b]: readonly [Pt, Pt]): Pt[] =>
    Array.from({ length: 9 }, (_, i) => [a[0] + ((b[0] - a[0]) * (i + 1)) / 9, a[1] + ((b[1] - a[1]) * (i + 1)) / 9]);
  const lines = () => plants.map((pl) => [...pl.stem, ...pl.stalks.flatMap(stalkPts)]);

  // Gap filling by measurement: the largest empty discs (24 x 24 samples, distances on the repeat's lattice) above 9% of
  // the side get a twig (1 or 2 supports on a stalk) from the nearest stem, else a filler motif; at most 2 + 6 x density.
  const gn = 24 * span;
  const grid = Array.from({ length: gn * gn }, (_, k): Pt => [(((k % gn) + 0.5) * w) / gn, ((Math.floor(k / gn) + 0.5) * h) / gn]);
  const empty = grid.map(() => Infinity);
  const mark = (q: Pt, r: number) => grid.forEach((g, k) => (empty[k] = Math.min(empty[k]!, dist(g, q) - r)));
  for (const pl of plants) {
    for (const c of pl.circles) mark(c.c, c.r);
    pl.stem.forEach((q, i) => i % 4 === 0 && mark(q, 0));
    pl.stalks.flatMap(stalkPts).forEach((q) => mark(q, 0));
  }
  // ponytail: O(grid x stem samples) per tile, about 5 ms; a spatial hash if tiles grow much larger.
  const allClear = (self: number, c: Pt, r: number) =>
    inside(c, r) &&
    lines().every((line, j) => j === self || line.every((q) => dist(c, q) >= r + half + gap)) &&
    [...plants.flatMap((pl) => pl.circles), ...filler.map((f) => realCircle(f.v, f.p))].every((k) => dist(c, k.c) >= r + k.r + gap);
  const [lu, lv] = lattice(repeat, w, h);
  const copyNear = (c: Pt, q: Pt): Pt => {
    let best: Pt = c;
    for (let i = -2; i <= 2; i++)
      for (let j = -2; j <= 2; j++) {
        const e: Pt = [c[0] + i * lu[0] + j * lv[0], c[1] + i * lu[1] + j * lv[1]];
        if (Math.hypot(e[0] - q[0], e[1] - q[1]) < Math.hypot(best[0] - q[0], best[1] - q[1])) best = e;
      }
    return best;
  };
  const twig = (c: Pt, R: number, n: number): boolean => {
    let best = { i: -1, j: 0, d: Infinity };
    plants.forEach((pl, i) =>
      pl.stem.forEach((q, j) => j > 0 && j < pl.stem.length - 1 && dist(c, q) < best.d && (best = { i, j, d: dist(c, q) })),
    );
    if (best.i < 0) return false;
    const pl = plants[best.i]!;
    const q = pl.stem[best.j]!;
    const cc = copyNear(c, q);
    const a = Math.atan2(cc[1] - q[1], cc[0] - q[0]);
    const [p0, p1] = [pl.stem[best.j - 1]!, pl.stem[best.j + 1]!];
    const sideSign = Math.sign((p1[0] - p0[0]) * (cc[1] - q[1]) - (p1[1] - p0[1]) * (cc[0] - q[0])) || 1;
    // The stalk itself keeps the gap from every motif and from other plants' stems.
    const stalkClear = (st: [Pt, Pt]) => {
      // Built once per stalk, not per sample (same result; span 2 made it the hot spot).
      const ks = [...plants.flatMap((x) => x.circles), ...filler.map((f) => realCircle(f.v, f.p))];
      const ls = lines();
      return stalkPts(st).every(
        (s) =>
          ks.every((k) => dist(s, k.c) >= k.r + gap) && ls.every((line, j) => j === best.i || line.every((t) => dist(s, t) >= 2 * gap)),
      );
    };
    for (const k of [1, 0.8, 0.6]) {
      const rr = Math.min(0.06 * side, 0.7 * R) * k;
      const len = Math.max(1.1 * minStalk, best.d - rr);
      if (len > 0.15 * side) return false;
      const b = step(q, a, len);
      const v = pick(1, n, pl.fruit);
      const p = put(v, b, a, rr, rnd() < 0.5);
      const circ = realCircle(v, p);
      if (!allClear(best.i, circ.c, circ.r) || !stalkClear([q, b])) continue;
      pl.circles.push({ ...circ, v, p });
      pl.attached.push({ placement: p, side: sideSign, stalk: [q, b] });
      pl.stalks.push([q, b]);
      // A second, smaller leaf from the stalk's middle, to one side.
      const m = step(q, a, 0.55 * len);
      const a2 = a + (((rnd() < 0.5 ? -1 : 1) * 50) / 180) * Math.PI;
      const v2 = pick(1, n + 1, pl.fruit);
      const p2 = put(v2, m, a2, 0.7 * rr, rnd() < 0.5);
      const c2 = realCircle(v2, p2);
      if (allClear(best.i, c2.c, c2.r)) {
        pl.circles.push({ ...c2, v: v2, p: p2 });
        pl.attached.push({ placement: p2, side: sideSign, stalk: [q, b] });
      }
      return true;
    }
    return false;
  };
  const fillAt = (c: Pt): boolean => {
    const v = variants[2]![filler.length % VARIANTS]!;
    if (!allClear(-1, c, fr) || !lines().every((line) => line.every((q) => dist(c, q) >= fr + fillerMargin))) return false;
    filler.push({ v, p: fillerAt(c, v) });
    return true;
  };
  const cap = Math.round((2 + 6 * density) * area);
  for (let t = 0, added = 0; t < 4 * cap && added < cap; t++) {
    const k = empty.indexOf(Math.max(...empty));
    const R = empty[k]!;
    if (R < 0.09 * side) break;
    const c = grid[k]!;
    const before = plants.map((pl) => pl.circles.length);
    if (twig(c, R, added) || fillAt(c)) {
      added++;
      plants.forEach((pl, i) => pl.circles.slice(before[i]).forEach((x) => mark(x.c, x.r)));
      plants.forEach((pl) => pl.stalks.flatMap(stalkPts).forEach((q) => mark(q, 0)));
      filler.forEach((f) => ((x) => mark(x.c, x.r))(realCircle(f.v, f.p)));
    } else grid.forEach((g, i) => dist(g, c) < R && (empty[i] = -Infinity));
  }

  // Then sparse filler in the larger gaps that are left.
  const occupied = [...plants.flatMap((pl) => pl.circles.map((c) => ({ c: c.c, r: c.r }))), ...filler.map((f) => realCircle(f.v, f.p))];
  const stemPts = lines().flatMap((line) => line.filter((_, i) => i % 2 === 0));
  for (let n = 0, want2 = filler.length + Math.round(8 * density * area); n < want2 * 4 && filler.length < want2; n++) {
    let best: { p: Pt; clear: number } | null = null;
    for (let k = 0; k < 16; k++) {
      const c: Pt = [rnd() * w, rnd() * h];
      if (!inside(c, fr)) continue;
      const clear = Math.min(...occupied.map((q) => dist(c, q.c) - q.r - fr), ...stemPts.map((q) => dist(c, q) - fr - fillerMargin));
      if (clear > (best?.clear ?? 4)) best = { p: c, clear };
    }
    if (!best) continue;
    const v = variants[2]![filler.length % VARIANTS]!;
    const p = fillerAt(best.p, v);
    filler.push({ v, p });
    occupied.push(realCircle(v, p));
  }
  const f = (q: Pt) => `${num(q[0] + shift[0])} ${num(q[1] + shift[1])}`;
  const pathOf = (pl: Built) =>
    `M${f(pl.segs[0]![0])}` +
    pl.segs.map((c) => `C${f(c[1])} ${f(c[2])} ${f(c[3])}`).join('') +
    pl.stalks
      .filter(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]) >= minStalk)
      .map(([a, b]) => `M${f(a)}L${f(b)}`)
      .join('');

  const leaf: Placement[] = [];
  const bloom: Placement[] = [];
  const detail: Placement[] = [];
  const own: Placement[][] = custom ? custom.shapes.map(() => []) : [];
  const wrapP = (p: Placement): Placement => {
    const [x, y] = wrapPoint(p.x, p.y, repeat, w, h);
    return { ...p, x: round(x, 10), y: round(y, 10) };
  };
  for (const c of [...plants.flatMap((pl) => pl.circles), ...filler]) {
    const p = wrapP(c.p);
    // The custom motif: every shape with the same placement, each in its own layer.
    if (c.v.parts) {
      c.v.parts.forEach((m, k) => own[k]!.push({ ...p, motif: m }));
      continue;
    }
    (c.v.bloom ? bloom : leaf).push(p);
    if (c.v.det !== null) detail.push({ ...p, motif: c.v.det });
  }
  const out: StudioLayer[] = [];
  const add = (color: string, strokeWidth: number, placements: Placement[]) => {
    if (placements.length > 0) out.push({ color, opacity: 1, strokeWidth, placements });
  };
  if (o.stems && plants.length > 0) {
    // All stems in one stroke motif in tile units, shifted into a box large enough for stems that cross the edges.
    motifs.push({ d: plants.map(pathOf).join(''), box, paint: 'stroke' });
    // Non-scaling stroke: the width is in pixels at tile scale 1; 0.5% of the side reads lighter than the motifs.
    add(o.colors.stem, round(2 * half, 100), [{ motif: motifs.length - 1, x: w / 2, y: h / 2, scale: 1, rotate: 0, flip: false }]);
  }
  add(o.colors.leaf, 1, leaf);
  add(o.colors.bloom, 1, bloom);
  add(o.colors.detail, 1, detail);
  // Palette roles: the back fill shape (a trace's largest, as every plate covers the colors in front of it) gets the
  // leaf color, the next the bloom color, the rest and every stroke shape the detail color. Strokes go above the fills.
  // Their width: the stroke is non-scaling (model.ts), so the layer's width is in pixels at tile scale 1 whatever the
  // motif's scale; width 1.5 in box units reads as 0.4 percent of the side (1.2 px on a 300 px tile).
  const roles = [o.colors.leaf, o.colors.bloom];
  if (custom) {
    const fillIdx = custom.shapes.flatMap((c, k) => (c.paint === 'fill' ? [k] : []));
    fillIdx.forEach((k, j) => add(custom.keepColors ? custom.shapes[k]!.color : (roles[j] ?? o.colors.detail), 1, own[k]!));
    custom.shapes.forEach((c, k) => {
      if (c.paint === 'stroke')
        add(custom.keepColors ? c.color : o.colors.detail, round((0.004 * side * Math.max(0, c.width)) / 1.5, 100), own[k]!);
    });
  }
  return {
    studio: { width: w, height: h, background: o.colors.background, repeat, motifs, layers: out },
    heroes: plants.flatMap((pl) => (pl.tip ? [pl.tip] : [])),
    families,
    familyOf,
    plants: plants.map(({ stem, tip, tipStalk, vine, host, attached }) => ({ stem, tip, tipStalk, vine, host, attached })),
    filler: filler.map((f) => f.p),
    fillerMargin,
    stemDistance,
    junction,
  };
}

/** Compositions scoring above this go through the search: the 75th percentile of the measured first-attempt score (3 themes x 4
 * repeats x seeds 1-30, density 0.5, span 1), so about the worst quarter gets more attempts. */
export const TRACKING_LIMIT = 4.7;
/** Attempts in all with `balance` (the first is the seed itself). Span 2: one (no search), as one attempt already costs
 * about 320 ms. Without `balance`, always one. */
const ATTEMPTS = { 1: 6, 2: 1 } as const;
const tracked = new WeakMap<Studio, Tracking>();
const triesOf = new WeakMap<Studio, number>();

/** Composes with the seed. With `balance`, when the tiled result tracks (score above TRACKING_LIMIT), composes again with
 * seeds derived from (seed, k) and keeps the best, so the result stays a pure function of the options. */
export function composeParts(o: ComposeOptions): ComposeParts {
  const span = o.span === 2 ? 2 : 1;
  const score = (p: Omit<ComposeParts, 'tracking'>) => trackingScore(trackingInput(p), o.repeat, o.width, o.height, span);
  let best = composeOnce(o);
  let bestT = score(best);
  let tries = 1;
  let helped = false;
  for (let k = 1; o.balance && k < ATTEMPTS[span] && bestT.score > TRACKING_LIMIT; k++) {
    const seed = (Math.imul(o.seed ^ Math.imul(k, 0x9e3779b9), 0x85ebca6b) ^ (o.seed >>> 13)) >>> 1;
    const p = composeOnce({ ...o, seed });
    const t = score(p);
    tries++;
    if (t.score < bestT.score) [best, bestT, helped] = [p, t, true];
  }
  if (o.ground) best = withGround(best, o, span);
  tracked.set(best.studio, bestT);
  if (helped) triesOf.set(best.studio, tries);
  return { ...best, tracking: bestT };
}

/** The ground motifs appended after the plants' (their ids in the SVG stay the same) and the ground as the first layer. */
function withGround(p: Omit<ComposeParts, 'tracking'>, o: ComposeOptions, span: 1 | 2): Omit<ComposeParts, 'tracking'> {
  const s = p.studio;
  const theme = o.theme && THEME_TABLE[o.theme] ? o.theme : 'floral';
  const placements = groundLayer({ seed: o.seed, width: o.width, height: o.height, span, theme, first: s.motifs.length });
  const color = o.colors.ground ?? mixHex(o.colors.background, o.colors.leaf);
  return {
    ...p,
    studio: {
      ...s,
      motifs: [...s.motifs, ...groundMotifs(theme)],
      layers: [{ color, opacity: 1, strokeWidth: 0, placements }, ...s.layers],
    },
  };
}

/** The halfway color of two #rrggbb colors (the first when either is not #rrggbb). */
function mixHex(a: string, b: string): string {
  const ok = /^#[0-9a-fA-F]{6}$/;
  if (!ok.test(a) || !ok.test(b)) return a;
  const c = (s: string, i: number) => parseInt(s.slice(i, i + 2), 16);
  return `#${[1, 3, 5]
    .map((i) =>
      Math.round((c(a, i) + c(b, i)) / 2)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

export function compose(o: ComposeOptions): Studio {
  return composeParts(o).studio;
}

/** The attempts made when the search ran and kept a later one (null when the first attempt was kept). */
export function studioTries(s: Studio): number | null {
  return triesOf.get(s) ?? null;
}

/** The tracking measure of a studio that compose returned (null for any other). */
export function studioTracking(s: Studio): Tracking | null {
  return tracked.get(s) ?? null;
}

/** Roles from a 5-color palette (paper, ink, stroke, accent, soft). */
export function composeColors(palette: readonly string[]): ComposeOptions['colors'] {
  const [paper = '#ffffff', ink = '#000000', stroke = '#808080', accent = '#808080', soft] = palette;
  return { background: paper, leaf: stroke, bloom: accent, detail: ink, stem: stroke, ground: soft ?? mixHex(paper, stroke) };
}

export function composeSummary(s: Studio): { bytes: number; instances: number; motifs: number; plates: number } {
  const b = studioBytes(s);
  return { bytes: b.svg, instances: b.instances, motifs: s.motifs.length, plates: layerColors(s).length };
}
