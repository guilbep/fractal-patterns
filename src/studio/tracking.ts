// Tracking: how a tile reads when it is tiled. Wallpaper designers look for lines that the eye follows across repeats
// (vertical worst, diagonal bad, horizontal less), holes and clumps. This measures them on the tile as a torus of the
// repeat lattice, which is exactly what a 3 x 3 tiling shows.
import type { Pt } from '../patterns/util.ts';
import type { Repeat } from './model.ts';
import { latticeDistance, motifRadius, type ComposeParts } from './compose.ts';
import type { Placement } from './model.ts';

/** A motif's real circle. */
export interface TrackCircle {
  readonly c: Pt;
  readonly r: number;
}
export interface TrackInput {
  readonly circles: readonly TrackCircle[];
  /** Stem and stalk samples (no motif may sit on them, so they close holes). */
  readonly stems: readonly Pt[];
}
/** Heaviest and lightest strip over the mean, for one direction. */
export interface StripRatio {
  readonly max: number;
  readonly min: number;
}
export interface Tracking {
  /** Lower is better. */
  readonly score: number;
  readonly vertical: StripRatio;
  readonly horizontal: StripRatio;
  readonly diagonal: StripRatio;
  readonly antidiagonal: StripRatio;
  /** Radius of the largest empty disc, as a share of the unit tile side. */
  readonly hole: number;
}

/** Strips per direction. 8: one strip is an eighth of the period, about one hero wide at span 1, so a single hero
 * column shows; 12 or more makes bins narrower than a hero and the ratios swing with motif positions (noise). */
export const BINS = 8;
/** Holes up to this share of the side are free (the composer's gap filler stops at 0.09; a hero's radius is about 0.1). */
export const HOLE_FREE = 0.15;
const W_VERT = 3;
const W_DIAG = 2;
const W_HORZ = 1;
const W_HOLE = 20;

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

/** The period of the projection onto direction d: the shortest nonzero projection of a small lattice combination.
 * ponytail: exact when the projections are commensurate (square tiles); for other ratios it is the nearest short period. */
function period(d: Pt, [u, v]: [Pt, Pt]): number {
  const pu = u[0] * d[0] + u[1] * d[1];
  const pv = v[0] * d[0] + v[1] * d[1];
  let best = Infinity;
  for (let a = -2; a <= 2; a++)
    for (let b = -2; b <= 2; b++) {
      const p = Math.abs(a * pu + b * pv);
      if (p > 1e-6 * (Math.abs(pu) + Math.abs(pv)) && p < best) best = p;
    }
  return best;
}

function strips(circles: readonly TrackCircle[], d: Pt, L: [Pt, Pt]): StripRatio {
  const P = period(d, L);
  const bins: number[] = Array.from({ length: BINS }, () => 0);
  // Each circle's area spread over its width by the chord length (16 slices).
  for (const { c, r } of circles) {
    const t = c[0] * d[0] + c[1] * d[1];
    for (let i = 0; i < 16; i++) {
      const s = ((i + 0.5) / 16) * 2 - 1;
      const x = t + s * r;
      const k = Math.floor((((x % P) + P) % P) / (P / BINS)) % BINS;
      bins[k]! += r * r * Math.sqrt(1 - s * s);
    }
  }
  const mean = bins.reduce((a, b) => a + b, 0) / BINS;
  if (mean <= 0) return { max: 1, min: 1 };
  return { max: Math.max(...bins) / mean, min: Math.min(...bins) / mean };
}

const excess = (s: StripRatio) => s.max - s.min;

/** The score of a tile of size w x h; span: unit tiles per side (the hole is a share of the unit side). */
export function trackingScore(input0: TrackInput, repeat0: Repeat, w0: number, h0: number, span = 1): Tracking {
  const side = Math.min(w0, h0) / span;
  // Mirror: the true period is the 2 x 2 block of reflected copies (model.ts repeatCell), a plain torus.
  const m = repeat0 === 'mirror';
  const [w, h, repeat] = m ? [2 * w0, 2 * h0, 'straight' as const] : [w0, h0, repeat0];
  const unfold = (q: Pt): Pt[] => {
    if (!m) return [q];
    const [x, y] = [((q[0] % w0) + w0) % w0, ((q[1] % h0) + h0) % h0];
    return [
      [x, y],
      [w - x, y],
      [x, h - y],
      [w - x, h - y],
    ];
  };
  const input: TrackInput = {
    circles: input0.circles.flatMap((c) => unfold(c.c).map((q) => ({ c: q, r: c.r }))),
    stems: input0.stems.flatMap(unfold),
  };
  const L = lattice(repeat, w, h);
  const q = Math.SQRT1_2;
  const vertical = strips(input.circles, [1, 0], L);
  const horizontal = strips(input.circles, [0, 1], L);
  const diagonal = strips(input.circles, [q, q], L);
  const antidiagonal = strips(input.circles, [q, -q], L);
  // Largest empty disc on the composer's gap-filler grid (24 x 24 samples per unit tile, lattice distances).
  const gn = 24 * span; // mirror: the first quarter, the rest is its reflection
  let hole = 0;
  for (let k = 0; k < gn * gn; k++) {
    const g: Pt = [(((k % gn) + 0.5) * w0) / gn, ((Math.floor(k / gn) + 0.5) * h0) / gn];
    let e = Infinity;
    for (const c of input.circles) e = Math.min(e, latticeDistance(g, c.c, repeat, w, h) - c.r);
    for (const s of input.stems) e = Math.min(e, latticeDistance(g, s, repeat, w, h));
    if (e === Infinity) e = side;
    hole = Math.max(hole, e);
  }
  hole /= side;
  const score =
    W_VERT * excess(vertical) +
    W_DIAG * Math.max(excess(diagonal), excess(antidiagonal)) +
    W_HORZ * excess(horizontal) +
    W_HOLE * Math.max(0, hole - HOLE_FREE);
  return { score, vertical, horizontal, diagonal, antidiagonal, hole };
}

/** The circles and stems of a composition. */
export function trackingInput(parts: Omit<ComposeParts, 'tracking'>): TrackInput {
  const motifs = parts.studio.motifs;
  const circle = (p: Placement): TrackCircle => {
    const m = motifRadius(motifs[p.motif]!);
    const t = (p.rotate * Math.PI) / 180;
    const ox = m.cx * p.scale * (p.flip ? -1 : 1);
    const oy = m.cy * p.scale;
    return { c: [p.x + ox * Math.cos(t) - oy * Math.sin(t), p.y + ox * Math.sin(t) + oy * Math.cos(t)], r: m.radius * p.scale };
  };
  const stalk = ([a, b]: readonly [Pt, Pt]): Pt[] =>
    Array.from({ length: 5 }, (_, i): Pt => [a[0] + ((b[0] - a[0]) * (i + 1)) / 5, a[1] + ((b[1] - a[1]) * (i + 1)) / 5]);
  return {
    circles: [...parts.plants.flatMap((pl) => [...(pl.tip ? [pl.tip] : []), ...pl.attached.map((a) => a.placement)]), ...parts.filler].map(
      circle,
    ),
    // Every 4th stem sample, as the gap filler marks them.
    stems: parts.plants.flatMap((pl) => [
      ...pl.stem.filter((_, i) => i % 4 === 0),
      ...(pl.tipStalk ? stalk(pl.tipStalk) : []),
      ...pl.attached.flatMap((a) => (a.stalk ? stalk(a.stalk) : [])),
    ]),
  };
}

/** Balance bands for the page. */
export function balance(t: Tracking): { label: 'good' | 'fair' | 'uneven'; worst: string } {
  const parts: [number, string][] = [
    [W_VERT * excess(t.vertical), 'a dense vertical strip'],
    [W_DIAG * Math.max(excess(t.diagonal), excess(t.antidiagonal)), 'a dense diagonal strip'],
    [W_HORZ * excess(t.horizontal), 'a dense horizontal strip'],
    [W_HOLE * Math.max(0, t.hole - HOLE_FREE), 'a large empty area'],
  ];
  const worst = parts.reduce((a, b) => (b[0] > a[0] ? b : a))[1];
  return { label: t.score <= GOOD ? 'good' : t.score <= FAIR ? 'fair' : 'uneven', worst };
}
/** Score bands from the measured first-attempt distribution (360 compositions): good up to the 75th percentile (4.7,
 * the search limit), fair up to the 90th (6.3), uneven above. */
export const GOOD = 4.7;
export const FAIR = 6.3;
