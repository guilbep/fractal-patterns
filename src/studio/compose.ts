// The wallpaper studio composer: from a seed and a few choices, a complete botanical tile.
// A few plants, each a stem that follows a calm flow with a hero at its tip and support
// motifs on alternating sides, spaced on the repeat's own lattice; small filler in the
// larger gaps; all stems in one stroke motif under four color layers.
import type { Cubic } from '../curvefit.ts';
import { mulberry32, type Pt } from '../patterns/util.ts';
import type { Placement, Repeat, Studio, StudioLayer, StudioMotif } from './model.ts';
import { layerColors, studioBytes } from './model.ts';
import { makeMotif, motifBounds, type MotifFamily } from './motifs.ts';
import { flowAngle } from './scatter.ts';

export interface ComposeOptions {
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  readonly repeat: Repeat;
  /** 0 to 1. */
  readonly density: number;
  /** The motif families that may appear (at least one). */
  readonly families: readonly MotifFamily[];
  readonly colors: {
    readonly background: string;
    readonly leaf: string;
    readonly bloom: string;
    readonly detail: string;
    readonly stem: string;
  };
  readonly stems: boolean;
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

// Motif pools: plant tips, supports along the stems, small motifs (branch ends and filler).
const TIERS: readonly (readonly MotifFamily[])[] = [
  ['flower', 'frond', 'leaf'],
  ['leaf', 'sprig', 'bud'],
  ['berry', 'bud'],
];
const VARIANTS = 2; // ponytail: 2 per tier keeps 2 x 2 + 2 x 2 + 2 + 1 stem motif = 11 motifs.
const BLOOMS: readonly MotifFamily[] = ['flower', 'bud', 'berry'];
const num = (v: number) => String(Math.round(v * 10) / 10);

export interface ComposeParts {
  readonly studio: Studio;
  /** Hero placements (the tip motif of each plant), with motif indices into studio.motifs (the silhouettes). */
  readonly heroes: readonly Placement[];
  /** The family of each motif variant used: tip, support, small. */
  readonly families: readonly MotifFamily[];
  readonly plants: readonly Plant[];
  /** Small motifs in the gaps between plants (silhouettes). */
  readonly filler: readonly Placement[];
  /** Filler keeps this distance, plus its own radius, from every stem sample. */
  readonly fillerMargin: number;
  /** Stems keep this distance from the stems of other plants. */
  readonly stemDistance: number;
}

export interface Plant {
  /** 129 samples of the main stem in tile units (not wrapped: the stem may cross tile edges). */
  readonly stem: readonly Pt[];
  readonly tip: Placement;
  /** Support motifs along the stem; side -1 or 1; stalk null when the base sits on the stem itself. */
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
  } else [dx, dy] = [md(dx, w), md(dy, h)];
  const [u, v] = lattice(repeat, w, h);
  let best = Infinity;
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++) best = Math.min(best, Math.hypot(dx + i * u[0] + j * v[0], dy + i * u[1] + j * v[1]));
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

type Variant = { sil: number; det: number | null; radius: ReturnType<typeof motifRadius>; bloom: boolean };

export function composeParts(o: ComposeOptions): ComposeParts {
  const allowed = o.families.length > 0 ? o.families : (['leaf'] as const);
  const { width: w, height: h, repeat } = o;
  const side = Math.min(w, h);
  const density = clamp01(o.density);
  const rnd = mulberry32(o.seed ^ 0x2c1b3c6d);
  const motifs: StudioMotif[] = [];
  const families: MotifFamily[] = [];
  const variants = TIERS.map((pool, ti): Variant[] => {
    const fams0 = pool.filter((f) => allowed.includes(f));
    const fams = fams0.length > 0 ? fams0 : [...allowed];
    const start = Math.floor(rnd() * fams.length);
    return Array.from({ length: VARIANTS }, (_, i) => {
      const fam = fams[(start + i) % fams.length]!;
      const m = makeMotif(fam, o.seed * 97 + ti * 13 + i);
      families.push(fam);
      motifs.push(m.silhouette);
      // ponytail: small motifs (about 24 px) read as silhouettes; their detail would cost bytes, not looks.
      if (ti !== 2) motifs.push(m.detail);
      return {
        sil: motifs.indexOf(m.silhouette),
        det: ti !== 2 ? motifs.length - 1 : null,
        radius: motifRadius(m.silhouette),
        bloom: BLOOMS.includes(fam),
      };
    });
  });

  // A motif whose base sits at `base`, pointing along angle `a` (radians), with real circle radius r.
  const put = (v: Variant, base: Pt, a: number, r: number, flip: boolean): Placement => {
    const rotate = Math.round(deg(a) + 90);
    const scale = round(r / v.radius.radius, 100);
    const t = (rotate * Math.PI) / 180;
    const [x, y] = [base[0] + 50 * scale * Math.sin(t), base[1] - 50 * scale * Math.cos(t)];
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
  type Built = Plant & { circles: { c: Pt; r: number; v: Variant; p: Placement }[]; path: string; tipCircle: { c: Pt; r: number } };
  const grow = (start: Pt, r: () => number, index: number): Built => {
    // Main stem: integrate the calm flow in 6 steps, with a gentle per-plant bend; 3 cubic segments.
    const len = side * (repeat === 'mirror' ? 0.6 + 0.15 * r() : 0.6 + 0.5 * r());
    const bend = ((r() * 2 - 1) * Math.PI) / 5;
    const flip = r() < 0.5;
    let p: Pt = start;
    const knots: { p: Pt; a: number }[] = [];
    for (let i = 0; i <= 6; i++) {
      const a = (flowAngle(mod(p[0], w), mod(p[1], h), w, h, o.seed, true) * Math.PI) / 180 + bend * (i / 6 - 0.5);
      knots.push({ p, a });
      p = [p[0] + (Math.cos(a) * len) / 6, p[1] + (Math.sin(a) * len) / 6];
    }
    const segs = [0, 2, 4].map((i): Cubic => {
      const [k0, k1] = [knots[i]!, knots[i + 2]!];
      const l = Math.hypot(k1.p[0] - k0.p[0], k1.p[1] - k0.p[1]) / 3;
      return [
        k0.p,
        [k0.p[0] + Math.cos(k0.a) * l, k0.p[1] + Math.sin(k0.a) * l],
        [k1.p[0] - Math.cos(k1.a) * l, k1.p[1] - Math.sin(k1.a) * l],
        k1.p,
      ];
    });
    const at = (u: number): { p: Pt; a: number } => {
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
    const stem = Array.from({ length: 129 }, (_, i) => at(i / 128).p);
    // Tip: the hero, pointing along the stem's end direction.
    const end = at(1);
    const hv = variants[0]![index % VARIANTS]!;
    const tip = put(hv, end.p, end.a, 0.12 * side * (0.9 + 0.2 * r()), flip);
    const tipCircle = realCircle(hv, tip);
    // Support motifs at alternating sides, pointing away from the stem toward the tip, smaller toward the tip.
    const n = 3 + Math.floor(r() * (1 + 3 * density));
    const s0 = r() < 0.5 ? -1 : 1;
    const attached: Built['attached'][number][] = [];
    const circles: Built['circles'] = [{ ...tipCircle, v: hv, p: tip }];
    const stalks: [Pt, Pt][] = [];
    for (let i = 0; i < n; i++) {
      const u = 0.15 + (0.7 * (i + 0.3 + 0.4 * r())) / n;
      const q = at(u);
      const sideSign = i % 2 === 0 ? s0 : -s0;
      const a = q.a + (sideSign * (40 + 25 * r()) * Math.PI) / 180;
      const stalkLen = r() < 0.5 ? 0 : 0.03 * side;
      const base: Pt = [q.p[0] + Math.cos(a) * stalkLen, q.p[1] + Math.sin(a) * stalkLen];
      const v = variants[1]![i % VARIANTS]!;
      const pl = put(v, base, a, 0.075 * side * (1 - (0.4 * i) / n), r() < 0.5);
      const stalk: [Pt, Pt] | null = stalkLen > 0 ? [q.p, base] : null;
      if (stalk) stalks.push(stalk);
      attached.push({ placement: pl, side: sideSign, stalk });
      circles.push({ ...realCircle(v, pl), v, p: pl });
    }
    // One short side branch ending in a small motif (bud or berries), opposite the nearest support.
    if (r() < 0.3 + 0.5 * density) {
      const q = at(0.5 + 0.1 * r());
      const sideSign = n % 2 === 0 ? s0 : -s0;
      const a = q.a + (sideSign * 50 * Math.PI) / 180;
      const base: Pt = [q.p[0] + Math.cos(a) * 0.1 * side, q.p[1] + Math.sin(a) * 0.1 * side];
      const v = variants[2]![index % VARIANTS]!;
      const pl = put(v, base, a, 0.04 * side, r() < 0.5);
      stalks.push([q.p, base]);
      attached.push({ placement: pl, side: sideSign, stalk: [q.p, base] });
      circles.push({ ...realCircle(v, pl), v, p: pl });
    }
    const f = (q: Pt) => `${num(q[0] + shift[0])} ${num(q[1] + shift[1])}`;
    const path =
      `M${f(segs[0]![0])}` +
      segs.map((c) => `C${f(c[1])} ${f(c[2])} ${f(c[3])}`).join('') +
      stalks.map(([a, b]) => `M${f(a)}L${f(b)}`).join('');
    return { stem, tip, attached, circles, path, tipCircle };
  };
  const plants: Built[] = [];
  const want = Math.round(2 + 3 * density);
  const stemDistance0 = 0.16 * side;
  let stemDistance = stemDistance0;
  for (let tries = 0; plants.length < want && tries < 240; tries++) {
    if (tries > 0 && tries % 60 === 0) stemDistance *= 0.8;
    const s = Math.floor(rnd() * 2 ** 32);
    let pl = grow([rnd() * w, rnd() * h], mulberry32(s), plants.length);
    if (repeat === 'mirror') {
      // Mirror: center the plant's bounds in the tile, then grow it again from there.
      const xs = [...pl.stem.map((q) => q[0]), ...pl.circles.flatMap((c) => [c.c[0] - c.r, c.c[0] + c.r])];
      const ys = [...pl.stem.map((q) => q[1]), ...pl.circles.flatMap((c) => [c.c[1] - c.r, c.c[1] + c.r])];
      const [sx, sy] = [w / 2 - (Math.min(...xs) + Math.max(...xs)) / 2, h / 2 - (Math.min(...ys) + Math.max(...ys)) / 2];
      pl = grow(
        [pl.stem[0]![0] + sx + (rnd() - 0.5) * 0.3 * w, pl.stem[0]![1] + sy + (rnd() - 0.5) * 0.3 * h],
        mulberry32(s),
        plants.length,
      );
    }
    if (!pl.stem.every((q) => inside(q, 0)) || !pl.circles.every((c) => inside(c.c, c.r))) continue;
    const sparse = pl.stem.filter((_, i) => i % 8 === 0);
    if (plants.some((q) => q.stem.some((a, i) => i % 8 === 0 && sparse.some((b) => dist(a, b) < stemDistance)))) continue;
    if (plants.some((q) => dist(q.tipCircle.c, pl.tipCircle.c) < q.tipCircle.r + pl.tipCircle.r + 2)) continue;
    plants.push(pl);
  }

  // Filler: small motifs only in the larger gaps, clear of every motif circle and, by a margin, of every stem.
  const fillerMargin = 0.03 * side;
  const filler: { v: Variant; p: Placement }[] = [];
  const occupied = plants.flatMap((pl) => pl.circles.map((c) => ({ c: c.c, r: c.r })));
  const stemPts = plants.flatMap((pl) => pl.stem.filter((_, i) => i % 2 === 0));
  const fr = 0.04 * side;
  for (let n = 0, want2 = Math.round(8 * density); n < want2 * 4 && filler.length < want2; n++) {
    let best: { p: Pt; clear: number } | null = null;
    for (let k = 0; k < 16; k++) {
      const c: Pt = [rnd() * w, rnd() * h];
      if (!inside(c, fr)) continue;
      const clear = Math.min(...occupied.map((q) => dist(c, q.c) - q.r - fr), ...stemPts.map((q) => dist(c, q) - fr - fillerMargin));
      if (clear > (best?.clear ?? 4)) best = { p: c, clear };
    }
    if (!best) continue;
    const v = variants[2]![filler.length % VARIANTS]!;
    const rotate = Math.round(rnd() * 360);
    const scale = round(fr / v.radius.radius, 100);
    const fl = rnd() < 0.5;
    // Move the anchor so the real circle sits at the chosen point.
    const t = (rotate * Math.PI) / 180;
    const ox = v.radius.cx * scale * (fl ? -1 : 1);
    const oy = v.radius.cy * scale;
    const p: Placement = {
      motif: v.sil,
      x: round(best.p[0] - (ox * Math.cos(t) - oy * Math.sin(t)), 10),
      y: round(best.p[1] - (ox * Math.sin(t) + oy * Math.cos(t)), 10),
      scale,
      rotate,
      flip: fl,
    };
    filler.push({ v, p });
    occupied.push(realCircle(v, p));
  }

  const leaf: Placement[] = [];
  const bloom: Placement[] = [];
  const detail: Placement[] = [];
  const wrapP = (p: Placement): Placement => {
    const [x, y] = wrapPoint(p.x, p.y, repeat, w, h);
    return { ...p, x: round(x, 10), y: round(y, 10) };
  };
  for (const c of [...plants.flatMap((pl) => pl.circles), ...filler]) {
    const p = wrapP(c.p);
    (c.v.bloom ? bloom : leaf).push(p);
    if (c.v.det !== null) detail.push({ ...p, motif: c.v.det });
  }
  const out: StudioLayer[] = [];
  const add = (color: string, strokeWidth: number, placements: Placement[]) => {
    if (placements.length > 0) out.push({ color, opacity: 1, strokeWidth, placements });
  };
  if (o.stems && plants.length > 0) {
    // All stems in one stroke motif in tile units, shifted into a box large enough for stems that cross the edges.
    motifs.push({ d: plants.map((pl) => pl.path).join(''), box, paint: 'stroke' });
    add(o.colors.stem, Math.max(1.5, side / 150), [{ motif: motifs.length - 1, x: w / 2, y: h / 2, scale: 1, rotate: 0, flip: false }]);
  }
  add(o.colors.leaf, 1, leaf);
  add(o.colors.bloom, 1, bloom);
  add(o.colors.detail, 1, detail);
  return {
    studio: { width: w, height: h, background: o.colors.background, repeat, motifs, layers: out },
    heroes: plants.map((pl) => pl.tip),
    families,
    plants: plants.map(({ stem, tip, attached }) => ({ stem, tip, attached })),
    filler: filler.map((f) => f.p),
    fillerMargin,
    stemDistance,
  };
}

export function compose(o: ComposeOptions): Studio {
  return composeParts(o).studio;
}

/** Roles from a 5-color palette (paper, ink, stroke, accent, soft). */
export function composeColors(palette: readonly string[]): ComposeOptions['colors'] {
  const [paper = '#ffffff', ink = '#000000', stroke = '#808080', accent = '#808080'] = palette;
  return { background: paper, leaf: stroke, bloom: accent, detail: ink, stem: stroke };
}

export function composeSummary(s: Studio): { bytes: number; instances: number; motifs: number; plates: number } {
  const b = studioBytes(s);
  return { bytes: b.svg, instances: b.instances, motifs: s.motifs.length, plates: layerColors(s).length };
}
