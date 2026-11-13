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
// A branch's stem may come closer than the stem distance to its host within this share of the side.
const JUNCTION = 0.16;
// The hero's largest radius, as a share of the side (0.12 x 1.1).
const HERO_MAX = 0.132;
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
  /** A branch's stem may come closer than stemDistance to its host within this distance of its start. */
  readonly junction: number;
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
    const hv = variants[0]![idx % VARIANTS]!;
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
  const want = Math.round(2 + 3 * density);
  const vines = repeat === 'mirror' ? 0 : density > 0.7 ? 2 : 1;
  const stemDistance0 = 0.16 * side;
  const junction = JUNCTION * side;
  let stemDistance = stemDistance0;
  let s0 = 1;
  // A host stem may not be cut before its last branch's junction (as u in [0, 1]).
  const minU: number[] = [];
  for (let tries = 0; stems.length < want && tries < 240; tries++) {
    if (tries > 0 && tries % 60 === 0) stemDistance *= 0.8;
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
    } else if (idx < vines && tries < 120) {
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
      const len = side * (repeat === 'mirror' ? 0.35 + 0.15 * rnd() : 0.5 + 0.3 * rnd());
      st = stemOf(branchKnots(hs[k]!, hostA, sg, dev, len), false, host, s, idx);
    }
    if (!st.stem.every((q) => inside(q, 0))) continue;
    // Stems keep their distance, except a branch near its junction with its host.
    const st0 = st.stem[0]!;
    const sparse = st.stem.filter((_, i) => i % 8 === 0);
    const near = (j: number, b: Pt) => j === host && Math.hypot(b[0] - st0[0], b[1] - st0[1]) < junction;
    if (stems.some((q, j) => q.stem.some((a, i) => i % 8 === 0 && sparse.some((b) => !near(j, b) && dist(a, b) < stemDistance)))) continue;
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
  type Built = Plant & { circles: Circle[]; path: string };
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
    const hv = variants[0]![index % VARIANTS]!;
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
    // Support motifs at alternating sides, on the stem, pointing away from it, smaller toward the tip.
    const n = 3 + Math.floor(r() * (1 + 3 * density));
    const attached: Built['attached'][number][] = [];
    for (let i = 0; i < n; i++) {
      const u = (0.15 + (0.7 * (i + 0.3 + 0.4 * r())) / n) * end;
      const sideSign = i % 2 === 0 ? sA : -sA;
      const turn = (sideSign * (40 + 25 * r()) * Math.PI) / 180;
      const v = variants[1]![i % VARIANTS]!;
      const rr = 0.075 * side * (1 - (0.4 * i) / n);
      const fl = r() < 0.5;
      // ponytail: full size, 0.8, then 0.8 at 3 next positions along the stem (5% apart) on the same side.
      for (const [du, k] of [
        [0, 1],
        [0, 0.8],
        [0.05, 0.8],
        [0.1, 0.8],
        [0.15, 0.8],
      ] as const) {
        if (u + du > end - 0.03) break;
        const q = at(u + du);
        const pl = put(v, q.p, q.a + turn, rr * k, fl);
        const c = realCircle(v, pl);
        if (!clearOf(index, c.c, c.r)) continue;
        attached.push({ placement: pl, side: sideSign, stalk: null });
        circles.push({ ...c, v, p: pl });
        lastU = Math.max(lastU, u + du);
        break;
      }
    }
    // One short side branch ending in a small motif (bud or berries), opposite the nearest support.
    if (r() < 0.3 + 0.5 * density) {
      const qu = (0.5 + 0.1 * r()) * end;
      const q = at(qu);
      const sideSign = n % 2 === 0 ? sA : -sA;
      const a = q.a + (sideSign * 50 * Math.PI) / 180;
      const b = step(q.p, a, 0.1 * side);
      const v = variants[2]![index % VARIANTS]!;
      const pl = put(v, b, a, 0.04 * side, r() < 0.5);
      const c = realCircle(v, pl);
      if (clearOf(index, c.c, c.r)) {
        lastU = Math.max(lastU, qu);
        stalks.push([q.p, b]);
        attached.push({ placement: pl, side: sideSign, stalk: [q.p, b] });
        circles.push({ ...c, v, p: pl });
      }
    }
    // No hero: the stem ends just beyond its last support (or branch junction), not bare.
    if (!tip && !vine && attached.length > 0) end = Math.min(1, lastU + 0.02);
    const stem = end < 1 ? full.slice(0, Math.ceil(end * 128 - 1e-9) + 1) : full;
    const segs = end < 1 ? cutSegs(fullSegs, end) : fullSegs;
    const f = (q: Pt) => `${num(q[0] + shift[0])} ${num(q[1] + shift[1])}`;
    const path =
      `M${f(segs[0]![0])}` +
      segs.map((c) => `C${f(c[1])} ${f(c[2])} ${f(c[3])}`).join('') +
      stalks
        .filter(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]) >= minStalk)
        .map(([a, b]) => `M${f(a)}L${f(b)}`)
        .join('');
    plants.push({ stem, tip, tipStalk, attached, circles, path, vine, host });
  });

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
    // Non-scaling stroke: the width is in pixels at tile scale 1; 0.5% of the side reads lighter than the motifs.
    add(o.colors.stem, round(2 * half, 100), [{ motif: motifs.length - 1, x: w / 2, y: h / 2, scale: 1, rotate: 0, flip: false }]);
  }
  add(o.colors.leaf, 1, leaf);
  add(o.colors.bloom, 1, bloom);
  add(o.colors.detail, 1, detail);
  return {
    studio: { width: w, height: h, background: o.colors.background, repeat, motifs, layers: out },
    heroes: plants.flatMap((pl) => (pl.tip ? [pl.tip] : [])),
    families,
    plants: plants.map(({ stem, tip, tipStalk, vine, host, attached }) => ({ stem, tip, tipStalk, vine, host, attached })),
    filler: filler.map((f) => f.p),
    fillerMargin,
    stemDistance,
    junction,
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
