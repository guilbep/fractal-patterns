// Generated botanical motifs for the wallpaper studio: every leaf, frond, flower, bud,
// berry cluster and sprig is computed from plain geometry and a seed, so each one is
// original to the tool. Box 100 x 100, origin top left, base at the bottom center,
// tip toward the top. Two layers that register: a filled silhouette, a stroked detail.
import { curvePathData, type Cubic } from '../curvefit.ts';
import { mulberry32, TAU, type Pt, type Rng } from '../patterns/util.ts';

export interface StudioMotif {
  readonly d: string;
  readonly box: number;
  readonly paint: 'fill' | 'stroke';
}

export interface MotifParts {
  readonly fill: string;
  readonly detail: string;
}

export const MOTIF_FAMILIES = ['leaf', 'frond', 'flower', 'bud', 'berry', 'sprig'] as const;
export type MotifFamily = (typeof MOTIF_FAMILIES)[number];
export const MOTIF_LABELS: Readonly<Record<MotifFamily, string>> = {
  leaf: 'Leaf',
  frond: 'Frond',
  flower: 'Flower',
  bud: 'Bud',
  berry: 'Berries',
  sprig: 'Sprig',
};

const BOX = 100;
const UP = -Math.PI / 2;

// ---- path text: 1 decimal, relative after the first point ----
const r1 = (v: number) => Math.round(v * 10) / 10;
function num(v: number): string {
  const s = r1(v).toFixed(1).replace(/\.0$/, '');
  return s === '-0' ? '0' : s;
}
const nums = (ns: number[]) => ns.reduce((acc, n, i) => acc + (i > 0 && !num(n).startsWith('-') ? ' ' : '') + num(n), '');
function line(...pts: Pt[]): string {
  const r = pts.map(([x, y]): Pt => [r1(x), r1(y)]);
  return 'M' + nums([...r[0]!]) + 'l' + nums(r.slice(1).flatMap((p, i) => [r1(p[0] - r[i]![0]), r1(p[1] - r[i]![1])]));
}
function quad(a: Pt, c: Pt, b: Pt): string {
  const [x, y] = [r1(a[0]), r1(a[1])];
  return 'M' + nums([x, y]) + 'q' + nums([r1(c[0]) - x, r1(c[1]) - y, r1(b[0]) - x, r1(b[1]) - y]);
}
const cubics = (chains: Cubic[][]) => curvePathData(chains, 1);
// "0.5" -> ".5": valid path syntax, and a fifth of the bytes of a small motif.
const short = (d: string) => d.replace(/(^|[^\d.])0\./g, '$1.');

// ---- geometry ----
const range = (rnd: Rng, a: number, b: number) => a + (b - a) * rnd();
const polar = (c: Pt, a: number, r: number): Pt => [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r];

export function bez(c: Cubic, u: number): Pt {
  const v = 1 - u;
  const [b0, b1, b2, b3] = [v * v * v, 3 * u * v * v, 3 * u * u * v, u * u * u];
  return [b0 * c[0][0] + b1 * c[1][0] + b2 * c[2][0] + b3 * c[3][0], b0 * c[0][1] + b1 * c[1][1] + b2 * c[2][1] + b3 * c[3][1]];
}

// A local frame: s along the axis (0 base, 1 tip), l to the right, both in units of len.
// `bend` shifts the axis sideways by bend * s^2, so the organ curves gently.
type Frame = (s: number, l: number) => Pt;
function frame(base: Pt, ang: number, len: number, bend = 0): Frame {
  const ax = Math.cos(ang);
  const ay = Math.sin(ang);
  return (s, l) => {
    const lat = (l + bend * s * s) * len;
    return [base[0] + ax * s * len - ay * lat, base[1] + ay * s * len + ax * lat];
  };
}
const mapC = (F: Frame, c: Cubic): Cubic => [F(...c[0]), F(...c[1]), F(...c[2]), F(...c[3])];
const rev = (c: Cubic): Cubic => [c[3], c[2], c[1], c[0]];
const axisAngle = (F: Frame, s: number) => {
  const a = F(s - 0.01, 0);
  const b = F(s + 0.01, 0);
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
};
const straight = (F: Frame, s0: number, s1: number): Cubic =>
  mapC(F, [
    [s0, 0],
    [s0 + (s1 - s0) / 3, 0],
    [s0 + (2 * (s1 - s0)) / 3, 0],
    [s1, 0],
  ]);

// A blade (leaf, leaflet, petal, sepal, bud): one cubic per side from base (0,0) to tip (1,0).
// The side reaches its widest (0.75 h) near s = (3 s1 + 3 s2 + 1) / 8.
interface Shape {
  readonly s1: number;
  readonly s2: number;
  readonly h: number;
  readonly asym?: number;
  readonly teeth?: number; // segments per side, 0 = smooth edge
  readonly tooth?: number;
}
const sideCubic = (sh: Shape, h: number): Cubic => [
  [0, 0],
  [sh.s1, h],
  [sh.s2, h],
  [1, 0],
];
function edge(F: Frame, c: Cubic, sign: number, sh: Shape): Cubic[] {
  const n = sh.teeth ?? 0;
  if (!n) return [mapC(F, c)];
  const t = sh.tooth ?? 0.3;
  const out: Cubic[] = [];
  for (let k = 0; k < n; k++) {
    const p = bez(c, k / n);
    const q = bez(c, (k + 1) / n);
    const d: Pt = [q[0] - p[0], q[1] - p[1]];
    const o: Pt = [-d[1] * sign, d[0] * sign];
    out.push(
      mapC(F, [
        p,
        [p[0] + d[0] * 0.45 + o[0] * t * 0.2, p[1] + d[1] * 0.45 + o[1] * t * 0.2],
        [p[0] + d[0] * 0.95 + o[0] * t, p[1] + d[1] * 0.95 + o[1] * t],
        q,
      ]),
    );
  }
  return out;
}
function blade(F: Frame, sh: Shape): Cubic[] {
  const right = edge(F, sideCubic(sh, sh.h), 1, sh);
  const left = edge(F, sideCubic(sh, -sh.h * (sh.asym ?? 1)), -1, sh);
  return [...right, ...left.reverse().map(rev)];
}
// Widest point at wpos (0.3 .. 0.55), half width w (in units of len).
const shapeAt = (wpos: number, w: number): Shape => {
  const sum = (8 * wpos - 1) / 3;
  return { s1: sum * 0.3, s2: sum * 0.7, h: w / 0.75 };
};
function circle(c: Pt, r: number): Cubic[] {
  const k = 0.5523 * r;
  const [x, y] = c;
  return [
    [
      [x, y - r],
      [x + k, y - r],
      [x + r, y - k],
      [x + r, y],
    ],
    [
      [x + r, y],
      [x + r, y + k],
      [x + k, y + r],
      [x, y + r],
    ],
    [
      [x, y + r],
      [x - k, y + r],
      [x - r, y + k],
      [x - r, y],
    ],
    [
      [x - r, y],
      [x - r, y - k],
      [x - k, y - r],
      [x, y - r],
    ],
  ];
}

// ---- families ----
const rngFor = (family: MotifFamily, seed: number) =>
  mulberry32(Math.imul(seed, 0x9e3779b1) ^ ((MOTIF_FAMILIES.indexOf(family) + 1) * 0x85ebca6b));

/** One simple leaf; also the blade cubics and the vein end points (for the tests). */
export function leafParts(seed: number): MotifParts & { blade: Cubic[]; veinEnds: Pt[] } {
  const rnd = rngFor('leaf', seed);
  const len = 76;
  const F = frame([50, 90], UP + range(rnd, -0.05, 0.05), len, range(rnd, -0.08, 0.08));
  const base = shapeAt(range(rnd, 0.3, 0.55), range(rnd, 0.14, 0.26));
  const kind = rnd();
  const sh: Shape = {
    ...base,
    asym: range(rnd, 0.85, 1),
    ...(kind < 0.3 ? { teeth: 7, tooth: 0.35 } : kind < 0.45 ? { teeth: 3, tooth: 0.45 } : {}),
  };
  const bl = blade(F, sh);
  const pairs = 3 + Math.floor(rnd() * 4);
  const veins: Cubic[] = [];
  const veinEnds: Pt[] = [];
  for (const h of [sh.h, -sh.h * (sh.asym ?? 1)]) {
    const side = sideCubic(sh, h);
    for (let i = 0; i < pairs; i++) {
      const [se, le] = bez(side, 0.2 + (0.6 * (i + 0.5)) / pairs);
      const s0 = Math.max(0.03, se - 0.12 - Math.abs(le));
      const end: Pt = [se, le * 0.7];
      veins.push(mapC(F, [[s0, 0], [s0 + 0.03, le * 0.35], [se - 0.05, le * 0.65], end]));
      veinEnds.push(F(...end));
    }
  }
  const midrib = straight(F, -0.08, 0.93);
  return { fill: cubics([bl]), detail: cubics([[midrib], ...veins.map((v) => [v])]), blade: bl, veinEnds };
}

/** A compound leaf; also the leaflet lengths, base pair first, tip leaflet last. */
export function frondParts(seed: number): MotifParts & { sizes: number[] } {
  const rnd = rngFor('frond', seed);
  const F = frame([50, 96], UP, 70, range(rnd, -0.12, 0.12));
  const pairs = 5 + Math.floor(rnd() * 5);
  const l0 = range(rnd, 24, 30);
  const spread = range(rnd, 0.8, 1.15);
  const w = range(rnd, 0.16, 0.26);
  const wpos = range(rnd, 0.35, 0.5);
  const leaflets: Cubic[][] = [];
  const ribs: string[] = [];
  const sizes: number[] = [];
  const leaflet = (s: number, ang: number, len: number) => frame(F(s, 0), ang, len, range(rnd, -0.06, 0.06));
  for (let i = 0; i < pairs; i++) {
    const s = 0.14 + (0.8 * i) / (pairs - 1);
    const len = l0 * (1 - (0.6 * i) / (pairs - 1));
    const a = axisAngle(F, s);
    const [L, R] = [leaflet(s, a - spread, len), leaflet(s, a + spread, len)];
    // One sub-path and one rib polyline per pair: both leaflets start at the same stem point.
    leaflets.push([...blade(L, shapeAt(wpos, w)), ...blade(R, shapeAt(wpos, w))]);
    ribs.push(line(L(0.6, 0), F(s, 0), R(0.6, 0)));
    sizes.push(len);
  }
  const tip = l0 * 0.45;
  const T = leaflet(1, axisAngle(F, 1), tip);
  leaflets.push(blade(T, shapeAt(wpos, w)));
  sizes.push(tip);
  const fill = cubics(leaflets);
  // Size budget (1200 for both paths): ribs from the base pair up while they fit;
  // a 9-pair frond drops the ribs of its smallest upper leaflets.
  let detail = cubics([[straight(F, 0, 1)]]);
  for (const rib of ribs) if (fill.length + detail.length + rib.length <= 1200) detail += rib;
  return { fill, detail, sizes };
}

const flowerCount = (rnd: Rng) => 5 + Math.floor(rnd() * 4);
/** The seeded petal count of `flower` (5 to 8). */
export const flowerPetalCount = (seed: number) => flowerCount(rngFor('flower', seed));

function flowerParts(seed: number): MotifParts {
  const rnd = rngFor('flower', seed);
  const n = flowerCount(rnd);
  const c: Pt = [50, 50];
  const s1 = range(rnd, 0.05, 0.2);
  const s2 = range(rnd, 0.85, 1.02);
  const h = ((0.55 * Math.sin(Math.PI / n) * 1.15) / 0.75) * range(rnd, 0.9, 1.15);
  const R = Math.min(42, 46 / Math.hypot(s2, h)); // control points stay inside 50 +- 46
  const rc = range(rnd, 6, 9);
  const creases = rnd() < 0.5 ? [0] : [-0.07, 0.07];
  const turn = range(rnd, -0.15, 0.15);
  const petals: Cubic[][] = [];
  const det: string[] = [];
  for (let k = 0; k < n; k++) {
    const a = UP + turn + (k * TAU) / n + range(rnd, -0.06, 0.06);
    const F = frame(c, a, R * range(rnd, 0.93, 1));
    petals.push(blade(F, { s1, s2, h }));
    for (const l of creases) det.push(quad(F(0.3, l * 0.4), F(0.5, l * 1.3), F(0.72, l)));
    det.push(line(polar(c, a + Math.PI / n, rc + 1.5), polar(c, a + Math.PI / n, rc + 4)));
  }
  return { fill: cubics([...petals, circle(c, rc)]), detail: det.join('') };
}

function budParts(seed: number): MotifParts {
  const rnd = rngFor('bud', seed);
  const stem = frame([50, 97], UP, range(rnd, 30, 36), range(rnd, -0.15, 0.15));
  const top = stem(1, 0);
  const B = frame(top, axisAngle(stem, 1) * 0.5 + UP * 0.5, range(rnd, 44, 52), range(rnd, -0.06, 0.06));
  const h = range(rnd, 0.3, 0.42);
  const sh: Shape = { s1: 0, s2: range(rnd, 0.35, 0.5), h };
  const sep = range(rnd, 0.5, 0.8);
  const sl = range(rnd, 13, 17);
  const sepals = [-1, 1].map((sg) => blade(frame(B(0.04, 0), axisAngle(B, 0) + sg * sep, sl, -sg * 0.12), shapeAt(0.35, 0.2)));
  const lines = (rnd() < 0.5 ? [-0.5, 0.5] : [-0.6, 0, 0.6]).map((f): Cubic[] => [
    mapC(B, [
      [0.15, f * h * 0.3],
      [sh.s1 + 0.15, f * h * 0.75],
      [sh.s2, f * h * 0.75],
      [0.9, 0],
    ]),
  ]);
  return { fill: cubics([blade(B, sh), ...sepals]), detail: cubics([[straight(stem, 0, 1.03)], ...lines]) };
}

function berryParts(seed: number): MotifParts {
  const rnd = rngFor('berry', seed);
  const k = 3 + Math.floor(rnd() * 5);
  const twig = frame([50, 97], UP, range(rnd, 34, 40), range(rnd, -0.12, 0.12));
  const J = twig(1, 0);
  const r = k <= 4 ? range(rnd, 8, 10.5) : range(rnd, 6.5, 8);
  const D = 18 + (k - 3) * 3.2;
  const da = (2 * r * 0.92) / D;
  const berries: Cubic[][] = [];
  const det: string[] = [cubics([[straight(twig, 0, 1)]])];
  for (let i = 0; i < k; i++) {
    const a = UP + (i - (k - 1) / 2) * da + range(rnd, -0.05, 0.05);
    const p = polar(J, a, D + range(rnd, -2.5, 2.5));
    berries.push(circle(p, r));
    const e = polar(p, a + Math.PI, r * 0.9);
    det.push(quad(J, polar([(J[0] + e[0]) / 2, (J[1] + e[1]) / 2], a + Math.PI / 2, range(rnd, -2, 2)), e));
    const h0 = -2.5;
    const h1 = -1.6;
    det.push(quad(polar(p, h0, r * 0.6), polar(p, (h0 + h1) / 2, (r * 0.6) / Math.cos((h1 - h0) / 2)), polar(p, h1, r * 0.6)));
  }
  return { fill: cubics(berries), detail: det.join('') };
}

function sprigParts(seed: number): MotifParts {
  const rnd = rngFor('sprig', seed);
  const T = frame([50, 97], UP + range(rnd, -0.06, 0.06), range(rnd, 72, 78), range(rnd, -0.14, 0.14));
  const n = 4 + Math.floor(rnd() * 4);
  let side = rnd() < 0.5 ? 1 : -1;
  const shape = shapeAt(range(rnd, 0.35, 0.5), range(rnd, 0.17, 0.25));
  const fan = range(rnd, 0.7, 1);
  const parts: Cubic[][] = [];
  for (let i = 0; i < n; i++) {
    const s = 0.16 + (0.72 * i) / (n - 1);
    const len = range(rnd, 15, 19) * (1 - 0.3 * (i / (n - 1)));
    parts.push(blade(frame(T(s, 0), axisAngle(T, s) + side * fan, len, -side * 0.08), shape));
    side = -side;
  }
  const tip = T(1, 0);
  if (rnd() < 0.5) parts.push(circle(polar(tip, axisAngle(T, 1), 4), range(rnd, 4, 5)));
  else parts.push(blade(frame(tip, axisAngle(T, 1), range(rnd, 9, 12)), { s1: 0, s2: 0.45, h: 0.45 }));
  return { fill: cubics(parts), detail: cubics([[straight(T, 0, 1)]]) };
}

const BUILDERS: Readonly<Record<MotifFamily, (seed: number) => MotifParts>> = {
  leaf: leafParts,
  frond: frondParts,
  flower: flowerParts,
  bud: budParts,
  berry: berryParts,
  sprig: sprigParts,
};

export function makeMotif(family: MotifFamily, seed: number): { silhouette: StudioMotif; detail: StudioMotif } {
  const p = BUILDERS[family](seed);
  return { silhouette: { d: short(p.fill), box: BOX, paint: 'fill' }, detail: { d: short(p.detail), box: BOX, paint: 'stroke' } };
}

/** Bounding box of path coordinates, control points included (a safe over-estimate). */
export function motifBounds(d: string): { minX: number; minY: number; maxX: number; maxY: number } {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let cmd = '';
  const put = (px: number, py: number) => {
    b.minX = Math.min(b.minX, px);
    b.maxX = Math.max(b.maxX, px);
    b.minY = Math.min(b.minY, py);
    b.maxY = Math.max(b.maxY, py);
  };
  const ARITY: Record<string, number> = { m: 2, l: 2, t: 2, h: 1, v: 1, c: 6, s: 4, q: 4, a: 7, z: 0 };
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i]!;
    if (/[A-Za-z]/.test(t)) {
      cmd = t;
      i++;
      if (t === 'Z' || t === 'z') {
        [x, y] = [sx, sy];
        continue;
      }
    }
    const lo = cmd.toLowerCase();
    const n = ARITY[lo] ?? 0;
    if (!n) break;
    const v = tokens.slice(i, i + n).map(Number);
    i += n;
    const rel = cmd === lo;
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    if (lo === 'h') x = v[0]! + ox;
    else if (lo === 'v') y = v[0]! + oy;
    else if (lo === 'a') [x, y] = [v[5]! + ox, v[6]! + oy];
    else {
      for (let j = 0; j + 1 < n; j += 2) put(v[j]! + ox, v[j + 1]! + oy);
      [x, y] = [v[n - 2]! + ox, v[n - 1]! + oy];
    }
    put(x, y);
    if (lo === 'm') {
      [sx, sy] = [x, y];
      cmd = rel ? 'l' : 'L';
    }
  }
  return b;
}
