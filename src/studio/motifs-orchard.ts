// Generated orchard motifs for the wallpaper studio: pear, apple, cherries, lemon, blossom
// and leaf, each computed from plain geometry and a seed, so each one is original to the
// tool. Same contract as `makeMotif` (motifs.ts): box 100, origin top left, base at the
// bottom center. Fruit hangs: the stalk sits at the base, the fruit body beyond it.
import { curvePathData, type Cubic } from '../curvepath.ts';
import { mulberry32, TAU, type Pt, type Rng } from '../patterns/util.ts';
import { bez, type MotifParts, type StudioMotif } from './motifs.ts';

export const ORCHARD_FAMILIES = ['pear', 'apple', 'cherries', 'lemon', 'blossom', 'orchardleaf'] as const;
export type OrchardFamily = (typeof ORCHARD_FAMILIES)[number];
export const ORCHARD_LABELS: Readonly<Record<OrchardFamily, string>> = {
  pear: 'Pear',
  apple: 'Apple',
  cherries: 'Cherries',
  lemon: 'Lemon',
  blossom: 'Blossom',
  orchardleaf: 'Leaf',
};
export const ORCHARD_ROLES: {
  readonly hero: readonly OrchardFamily[];
  readonly support: readonly OrchardFamily[];
  readonly filler: readonly OrchardFamily[];
} = {
  hero: ['pear', 'apple', 'lemon'],
  support: ['orchardleaf', 'cherries', 'blossom'],
  filler: ['blossom', 'cherries', 'orchardleaf'],
};

const BOX = 100;
const UP = -Math.PI / 2;
const STALK: Pt = [50, 95]; // where every motif attaches

// ---- path text and geometry: copied from motifs.ts (not exported there) ----
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
// A dot: a stroked circle of radius 0.8 (arc to a point 0.1 away, the long way round).
const dot = (p: Pt) => 'M' + nums([p[0], p[1]]) + 'a.8 .8 0 1 0 .1 0';
const cubics = (chains: Cubic[][]) => curvePathData(chains, 1);
const short = (d: string) => d.replace(/(^|[^\d.])0\./g, '$1.');
const range = (rnd: Rng, a: number, b: number) => a + (b - a) * rnd();
const polar = (c: Pt, a: number, r: number): Pt => [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r];

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
const straight = (F: Frame, s0: number, s1: number): Cubic =>
  mapC(F, [
    [s0, 0],
    [s0 + (s1 - s0) / 3, 0],
    [s0 + (2 * (s1 - s0)) / 3, 0],
    [s1, 0],
  ]);
interface Shape {
  readonly s1: number;
  readonly s2: number;
  readonly h: number;
  readonly asym?: number;
  readonly teeth?: number;
  readonly tooth?: number;
  readonly end?: number; // where the side meets the axis (1 = tip; below 1 = notched tip)
}
const sideCubic = (sh: Shape, h: number): Cubic => [
  [0, 0],
  [sh.s1, h],
  [sh.s2, h],
  [sh.end ?? 1, 0],
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

// A smooth closed outline through points (closed Catmull-Rom spline as cubics).
function loop(pts: Pt[]): Cubic[] {
  const n = pts.length;
  const at = (i: number) => pts[(i + n) % n]!;
  return pts.map((p1, i): Cubic => {
    const [p0, p2, p3] = [at(i - 1), at(i + 1), at(i + 2)];
    return [p1, [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6], p2];
  });
}
// A round body in frame F: radius `rad(a)` at angle a from the axis (a = 0 is the far end).
const roundBody = (F: Frame, cs: number, n: number, rad: (a: number) => [number, number]) =>
  loop(
    Array.from({ length: n }, (_, i) => {
      const a = (i * TAU) / n;
      const [rs, rl] = rad(a);
      return F(cs + Math.cos(a) * rs, Math.sin(a) * rl);
    }),
  );
// A highlight arc on the left of the body, between axis angles a0 and a1 at radius k.
const shine = (F: Frame, cs: number, rs: number, rl: number, a0: number, a1: number) => {
  const p = (a: number, k: number): Pt => F(cs + Math.cos(a) * rs * k, Math.sin(a) * rl * k);
  return quad(p(a0, 0.72), p((a0 + a1) / 2, 0.72 / Math.cos((a1 - a0) / 2)), p(a1, 0.72));
};
const stalkTo = (rnd: Rng, end: Pt) => quad(STALK, [(STALK[0] + end[0]) / 2 + range(rnd, -1.5, 1.5), (STALK[1] + end[1]) / 2], end);
const smallLeaf = (rnd: Rng, at: Pt, side: number, len: number) => {
  const F = frame(at, UP + side * range(rnd, 1.2, 1.45), len, -side * 0.06);
  return { blade: blade(F, shapeAt(0.4, 0.2)), rib: line(F(0, 0), F(0.85, 0)) };
};

// ---- families ----
const rngFor = (family: OrchardFamily, seed: number) =>
  mulberry32(Math.imul(seed, 0x9e3779b1) ^ ((ORCHARD_FAMILIES.indexOf(family) + 7) * 0x85ebca6b));

/** A pear; also its body outline (for the tests). */
export function pearParts(seed: number): MotifParts & { body: Cubic[] } {
  const rnd = rngFor('pear', seed);
  const F = frame([50 + range(rnd, -1, 1), 87], UP + range(rnd, -0.14, 0.14), range(rnd, 70, 76));
  const neck = range(rnd, 0.25, 0.38);
  const W = range(rnd, 0.27, 0.33);
  const wn = range(rnd, 0.11, 0.14);
  const a = range(rnd, 0.9, 1);
  const half = (sg: number): Pt[] => [
    [0.02, wn * sg],
    [neck, wn * 1.4 * sg],
    [neck + (1 - neck) * 0.5, W * sg],
    [0.92, W * 0.72 * sg],
  ];
  const right = half(1);
  const left = half(-a).reverse();
  const body = loop([[-0.01, 0], ...right, [1, 0], ...left].map(([s, l]) => F(s, l)));
  const parts: Cubic[][] = [body];
  const det = [stalkTo(rnd, F(0.06, 0)), shine(F, 0.62, 0.28, W, -2.3, -1.4)];
  if (rnd() < 0.5) {
    const lf = smallLeaf(rnd, F(-0.04, 0), rnd() < 0.5 ? 1 : -1, range(rnd, 14, 18));
    parts.push(lf.blade);
    det.push(lf.rib);
  }
  const specks = 2 + Math.floor(rnd() * 2);
  for (let i = 0; i < specks; i++) {
    const p = F(range(rnd, 0.45, 0.85), range(rnd, -0.05, W * 0.6));
    det.push(line(p, [p[0] + range(rnd, -1, 1), p[1] + 1.2]));
  }
  return { fill: cubics(parts), detail: det.join(''), body };
}

function appleParts(seed: number): MotifParts {
  const rnd = rngFor('apple', seed);
  const rh = range(rnd, 29, 33);
  const rw = rh * range(rnd, 1.05, 1.14);
  const dip = range(rnd, 0.12, 0.18);
  const far = range(rnd, 0.03, 0.07);
  const F = frame([50, 86], UP + range(rnd, -0.08, 0.08), 1);
  const cs = rh * (1 - dip);
  const bump = (a: number, c: number, w: number) => Math.exp(-(((a - c) / w) ** 2));
  const body = roundBody(F, cs, 14, (a) => {
    const k = 1 - dip * bump(a, Math.PI, 0.3) - far * (bump(a, 0, 0.3) + bump(a, TAU, 0.3));
    return [rh * k, rw * k];
  });
  const parts: Cubic[][] = [body];
  const det = [stalkTo(rnd, F(3, 0)), shine(F, cs, rh, rw, -2.4, -1.5)];
  if (rnd() < 0.8) {
    const lf = smallLeaf(rnd, F(-3, 0), rnd() < 0.5 ? 1 : -1, range(rnd, 18, 22));
    parts.push(lf.blade);
    det.push(lf.rib);
  }
  return { fill: cubics(parts), detail: det.join('') };
}

const cherryN = (rnd: Rng) => 2 + Math.floor(rnd() * 2);
/** The seeded cherry count (2 or 3). */
export const cherryCount = (seed: number) => cherryN(rngFor('cherries', seed));

/** Cherries; also each cherry's center and radius (for the tests). */
export function cherryParts(seed: number): MotifParts & { cherries: { c: Pt; r: number }[] } {
  const rnd = rngFor('cherries', seed);
  const k = cherryN(rnd);
  const r = k === 2 ? range(rnd, 11, 13) : range(rnd, 9.5, 11);
  const gap = range(rnd, 2, 5);
  const cherries: { c: Pt; r: number }[] = [];
  const det: string[] = [];
  const longest = Math.floor(rnd() * k); // one long stalk keeps the cluster tall
  for (let i = 0; i < k; i++) {
    const c: Pt = [50 + (i - (k - 1) / 2) * (2 * r + gap), STALK[1] - (i === longest ? range(rnd, 58, 68) : range(rnd, 40, 56))];
    cherries.push({ c, r });
    const a = Math.atan2(STALK[1] - c[1], STALK[0] - c[0]);
    const e = polar(c, a, r * 0.75);
    det.push(quad(STALK, polar([(STALK[0] + e[0]) / 2, (STALK[1] + e[1]) / 2], a + Math.PI / 2, range(rnd, -4, 4)), e));
    det.push(quad(polar(c, -2.6, r * 0.62), polar(c, -2.05, (r * 0.62) / Math.cos(0.55)), polar(c, -1.5, r * 0.62)));
  }
  return { fill: cubics(cherries.map((ch) => circle(ch.c, ch.r))), detail: det.join(''), cherries };
}

function lemonParts(seed: number): MotifParts {
  const rnd = rngFor('lemon', seed);
  const rh = range(rnd, 30, 34);
  const rw = rh * range(rnd, 0.72, 0.82);
  const nub = range(rnd, 4, 7);
  const F = frame([50, 88], UP + range(rnd, -0.2, 0.2), 1);
  const cs = rh;
  // The outline is an ellipse; the far end gets a short pointed nub, the stalk end a flat one.
  const body = loop([
    F(cs + rh + nub, 0),
    ...Array.from({ length: 11 }, (_, i) => {
      const a = ((i + 1) * TAU) / 12;
      const k = 1 - 0.06 * Math.exp(-(((a - Math.PI) / 0.4) ** 2));
      return F(cs + Math.cos(a) * rh * k, Math.sin(a) * rw * k);
    }),
  ]);
  const det = [stalkTo(rnd, F(2, 0)), shine(F, cs, rh, rw, -2.3, -1.2)];
  const dots = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < dots; i++) det.push(dot(F(cs + range(rnd, -0.5, 0.6) * rh, range(rnd, -0.1, 0.55) * rw)));
  return { fill: cubics([body]), detail: det.join('') };
}

function blossomParts(seed: number): MotifParts {
  const rnd = rngFor('blossom', seed);
  const R = range(rnd, 32, 36);
  const c: Pt = [50, 87 - R * 0.95];
  const notch = rnd() < 0.5;
  const h = range(rnd, 0.42, 0.5);
  const sh: Shape = notch ? { s1: 0.1, s2: 1.08, h, end: 0.92 } : { s1: 0.1, s2: 1.02, h };
  const turn = range(rnd, -0.12, 0.12);
  const rc = range(rnd, 4.5, 6);
  const petals: Cubic[][] = [];
  const det: string[] = [line(STALK, [c[0], c[1] + R * 0.6])];
  for (let k = 0; k < 5; k++) {
    const a = UP + turn + (k * TAU) / 5 + range(rnd, -0.05, 0.05);
    const F = frame(c, a, R * range(rnd, 0.92, 1));
    petals.push(blade(F, sh));
    det.push(quad(F(0.35, 0), F(0.5, range(rnd, -0.04, 0.04)), F(0.65, 0)));
  }
  const stamens = 5 + Math.floor(rnd() * 5);
  for (let i = 0; i < stamens; i++) {
    const a = turn + (i * TAU) / stamens + range(rnd, -0.15, 0.15);
    const e = polar(c, a, rc + range(rnd, 4, 7));
    det.push(line(polar(c, a, rc * 0.6), e), dot(e));
  }
  return { fill: cubics([...petals, circle(c, rc)]), detail: det.join('') };
}

/** An orchard leaf; also the blade cubics and the vein end points (for the tests). */
export function orchardLeafParts(seed: number): MotifParts & { blade: Cubic[]; veinEnds: Pt[] } {
  const rnd = rngFor('orchardleaf', seed);
  const F = frame([50, 88], UP + range(rnd, -0.06, 0.06), range(rnd, 72, 78), range(rnd, -0.07, 0.07));
  const base = shapeAt(range(rnd, 0.4, 0.5), range(rnd, 0.17, 0.23));
  const sh: Shape = { ...base, asym: range(rnd, 0.88, 1), ...(rnd() < 0.5 ? { teeth: 9, tooth: 0.22 } : {}) };
  const bl = blade(F, sh);
  const pairs = 4 + Math.floor(rnd() * 3);
  const veins: Cubic[] = [];
  const veinEnds: Pt[] = [];
  for (const h of [sh.h, -sh.h * (sh.asym ?? 1)]) {
    const side = sideCubic(sh, h);
    for (let i = 0; i < pairs; i++) {
      const [se, le] = bez(side, 0.15 + (0.68 * (i + 0.5)) / pairs);
      const s0 = Math.max(0.03, se - 0.1 - Math.abs(le));
      const end: Pt = [se, le * 0.72];
      veins.push(mapC(F, [[s0, 0], [s0 + 0.03, le * 0.35], [se - 0.05, le * 0.65], end]));
      veinEnds.push(F(...end));
    }
  }
  const detail = line(STALK, F(0, 0)) + cubics([[straight(F, 0, 0.93)], ...veins.map((v) => [v])]);
  return { fill: cubics([bl]), detail, blade: bl, veinEnds };
}

const BUILDERS: Readonly<Record<OrchardFamily, (seed: number) => MotifParts>> = {
  pear: pearParts,
  apple: appleParts,
  cherries: cherryParts,
  lemon: lemonParts,
  blossom: blossomParts,
  orchardleaf: orchardLeafParts,
};

export function makeOrchardMotif(family: OrchardFamily, seed: number): { silhouette: StudioMotif; detail: StudioMotif } {
  const p = BUILDERS[family](seed);
  return { silhouette: { d: short(p.fill), box: BOX, paint: 'fill' }, detail: { d: short(p.detail), box: BOX, paint: 'stroke' } };
}
