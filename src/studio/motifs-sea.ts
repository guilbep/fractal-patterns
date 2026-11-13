// Generated sea motifs for the wallpaper studio: kelp, coral, shells, starfish, fish and
// bubbles, each computed from plain geometry and a seed, so each one is original to the
// tool. Same contract as the floral theme (./motifs.ts): box 100, base at the bottom
// center, tip toward the top, a filled silhouette and a stroked detail that register.
// Each family is drawn in its own units, then scaled and placed into the box by `fit`.
import { curvePathData, type Cubic } from '../curvefit.ts';
import { mulberry32, TAU, type Pt, type Rng } from '../patterns/util.ts';
import type { StudioMotif } from './motifs.ts';

export const SEA_FAMILIES = ['kelp', 'coral', 'shell', 'starfish', 'fish', 'bubbles'] as const;
export type SeaFamily = (typeof SEA_FAMILIES)[number];
export const SEA_LABELS: Readonly<Record<SeaFamily, string>> = {
  kelp: 'Kelp',
  coral: 'Coral',
  shell: 'Shell',
  starfish: 'Starfish',
  fish: 'Fish',
  bubbles: 'Bubbles',
};
export const SEA_ROLES: { hero: readonly SeaFamily[]; support: readonly SeaFamily[]; filler: readonly SeaFamily[] } = {
  hero: ['coral', 'shell', 'starfish'],
  support: ['kelp', 'coral', 'shell'],
  // Fish and bubbles float free: compose places this pool in the gaps (and keeps them off stalk ends).
  filler: ['fish', 'bubbles', 'starfish'],
};

const BOX = 100;
const UP = -Math.PI / 2;

// ---- path text (copied from ./motifs.ts, which does not export them) ----
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
const short = (d: string) => d.replace(/(^|[^\d.])0\./g, '$1.');

// ---- geometry ----
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
// A smooth open chain through points (Catmull-Rom as cubics).
function through(p: Pt[]): Cubic[] {
  const at = (i: number) => p[Math.max(0, Math.min(p.length - 1, i))]!;
  return p.slice(0, -1).map((a, i): Cubic => {
    const [b, z, n] = [at(i + 1), at(i - 1), at(i + 2)];
    return [a, [a[0] + (b[0] - z[0]) / 6, a[1] + (b[1] - z[1]) / 6], [b[0] - (n[0] - a[0]) / 6, b[1] - (n[1] - a[1]) / 6], b];
  });
}
const seg = (a: Pt, b: Pt): Cubic => [a, a, b, b];
// A closed rounded finger from F(0, +-w0) to a round cap at F(1, 0); w in units of len.
function finger(F: Frame, w0: number, w1: number): Cubic[] {
  const k = 1.33 * w1;
  return [
    [F(0, w0), F(0.4, w0 * 0.9 + w1 * 0.1), F(0.75, w1), F(1, w1)],
    [F(1, w1), F(1 + k, w1), F(1 + k, -w1), F(1, -w1)],
    [F(1, -w1), F(0.75, -w1), F(0.4, -w0 * 0.9 - w1 * 0.1), F(0, -w0)],
    seg(F(0, -w0), F(0, w0)),
  ];
}

// Detail items: a cubic chain, a quadratic arc, or a polyline.
type Item = { c: Cubic[] } | { q: [Pt, Pt, Pt] } | { l: Pt[] };
interface Raw {
  readonly fill: Cubic[][];
  readonly det: Item[];
  readonly marks?: Pt[]; // points the tests check (mapped into the box)
}
interface Placed {
  readonly fill: string;
  readonly detail: string;
  readonly fillChains: Cubic[][];
  readonly marks: Pt[];
}

// Uniform scale into 4..96, centered in x, resting on y = 96 (the base).
function fit(raw: Raw): Placed {
  const pts: Pt[] = [...raw.fill.flat(2), ...raw.det.flatMap((it) => ('c' in it ? it.c.flat() : 'q' in it ? it.q : it.l))];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = Math.min(92 / (x1 - x0), 92 / (y1 - y0));
  const T = (p: Pt): Pt => [50 + (p[0] - (x0 + x1) / 2) * k, 96 - (y1 - p[1]) * k];
  const C = (c: Cubic): Cubic => [T(c[0]), T(c[1]), T(c[2]), T(c[3])];
  // One winding for every sub-path, so overlapping parts never cancel under nonzero fill.
  const area = (ch: Cubic[]) => ch.reduce((a, c) => a + c[0][0] * c[3][1] - c[3][0] * c[0][1], 0);
  const fillChains = raw.fill.map((ch) => (area(ch) < 0 ? [...ch].reverse().map((c): Cubic => [c[3], c[2], c[1], c[0]]) : ch).map(C));
  const detail = raw.det
    .map((it) =>
      'c' in it ? curvePathData([it.c.map(C)], 1) : 'q' in it ? quad(T(it.q[0]), T(it.q[1]), T(it.q[2])) : line(...it.l.map(T)),
    )
    .join('');
  return { fill: curvePathData(fillChains, 1), detail, fillChains, marks: (raw.marks ?? []).map(T) };
}
// A dot: a very short stroke (round caps on the page make it a dot).
const dot = (p: Pt, a = 0): Item => ({ l: [p, polar(p, a, 0.6)] });

const rngFor = (family: SeaFamily, seed: number) =>
  mulberry32(Math.imul(seed, 0x9e3779b1) ^ ((SEA_FAMILIES.indexOf(family) + 17) * 0x85ebca6b));

// ---- families ----
function kelp(seed: number): Raw {
  const rnd = rngFor('kelp', seed);
  const len = 100;
  const bends = 3 + Math.floor(rnd() * 2); // 3 or 4 half-waves along the blade
  const amp = range(rnd, 15, 19);
  const ph = range(rnd, 0, TAU);
  const W = range(rnd, 12, 16);
  const axis = (s: number): Pt => [amp * Math.sin(bends * Math.PI * s + ph) * Math.sqrt(s), -s * len];
  const width = (s: number) => W * (0.35 + 0.9 * Math.sin(Math.PI * s));
  const N = 12;
  const ss = Array.from({ length: N + 1 }, (_, i) => (0.92 * i) / N);
  const side = (sg: number) =>
    ss.map((s): Pt => {
      const a = axis(s);
      const b = axis(s + 0.01);
      const t = Math.atan2(b[1] - a[1], b[0] - a[0]);
      return polar(a, t + (sg * Math.PI) / 2, width(s));
    });
  const R = side(1);
  const L = side(-1);
  const tipDir = axis(0.97);
  const ext = (p: Pt): Pt => [p[0] + (tipDir[0] - axis(0.92)[0]) * 2.5, p[1] + (tipDir[1] - axis(0.92)[1]) * 2.5];
  const blade: Cubic[] = [...through(R), [R[N]!, ext(R[N]!), ext(L[N]!), L[N]!], ...through([...L].reverse()), seg(L[0]!, R[0]!)];
  const fill: Cubic[][] = [blade];
  // Bladders: round floats that overlap the blade's edge, so they read at small size.
  const n = 2 + Math.floor(rnd() * 2);
  const flip = rnd() < 0.5 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const s = 0.12 + (0.6 * i) / n + range(rnd, 0, 0.06);
    const sg = (i % 2 ? 1 : -1) * flip;
    const a = axis(s);
    const br = range(rnd, 6.5, 8.5);
    fill.push(circle([a[0] + sg * (width(s) + br * 0.5), a[1]], br));
  }
  const det: Item[] = [{ c: through(Array.from({ length: 6 }, (_, i) => axis(0.04 + (0.84 * i) / 5))) }];
  for (let i = 0; i < 4; i++) {
    const s = 0.25 + i * 0.17;
    const a = axis(s);
    const sg = i % 2 ? 1 : -1;
    const w = width(s) * 0.75;
    det.push({ q: [a, [a[0] + sg * w * 0.5, a[1] - 2.5], [a[0] + sg * w, a[1] - 1]] });
  }
  return { fill, det };
}

function coral(seed: number): Raw {
  const rnd = rngFor('coral', seed);
  const forks = 2 + Math.floor(rnd() * 2);
  const spread = range(rnd, 0.45, 0.75);
  const lean = range(rnd, -0.2, 0.2);
  const fill: Cubic[][] = [];
  const det: Item[] = [];
  const grow = (base: Pt, ang: number, len: number, w: number, depth: number) => {
    const F = frame(base, ang, len, range(rnd, -0.1, 0.1));
    fill.push(finger(F, w / len, (w * 0.8) / len));
    det.push(dot(F(0.6, 0), ang));
    if (depth >= forks) return;
    // Three fork levels fork only one child on the last level, which keeps the size in budget.
    const kids = depth === 2 && forks === 3 ? [rnd() < 0.5 ? -1 : 1] : [-1, 1];
    for (const sg of kids) {
      const a = ang + lean * 0.4 + sg * spread * (1 - depth * 0.2) + range(rnd, -0.12, 0.12);
      grow(F(0.85, 0), a, len * range(rnd, 0.8, 1), w * 0.8, depth + 1);
    }
  };
  grow([0, 0], UP + lean * 0.5, 18, 6.5, 0);
  return { fill, det };
}

const SHELL_FORMS = ['scallop', 'spiral'] as const;
export type ShellForm = (typeof SHELL_FORMS)[number];
/** Which form a `shell` seed gives (in turn, so any run of seeds shows both). */
export const shellForm = (seed: number): ShellForm => SHELL_FORMS[((seed % 2) + 2) % 2]!;

function shell(seed: number): Raw {
  const rnd = rngFor('shell', seed);
  if (shellForm(seed) === 'scallop') {
    // A wide fan of rounded ribs from a small hinge with two ears.
    const h: Pt = [0, 0];
    const th = range(rnd, 1.05, 1.25);
    const R = 60;
    const n = 7 + Math.floor(rnd() * 3);
    const ang = (i: number) => UP - th + (2 * th * i) / n;
    const edge: Cubic[] = [];
    for (let i = 0; i < n; i++) {
      const [a, b] = [ang(i), ang(i + 1)];
      const da = (b - a) / 3;
      edge.push([polar(h, a, R), polar(h, a + da, R * 1.16), polar(h, b - da, R * 1.16), polar(h, b, R)]);
    }
    const fan: Cubic[] = [seg(polar(h, UP + th, 8), polar(h, UP + th, R)), ...edge.reverse().map((c): Cubic => [c[3], c[2], c[1], c[0]])];
    fan.push(seg(polar(h, UP - th, R), polar(h, UP - th, 8)), [polar(h, UP - th, 8), [0, 3], [0, 3], polar(h, UP + th, 8)]);
    const e = range(rnd, 13, 16);
    const ears: Cubic[] = [
      seg([-e, -9], [e, -9]),
      seg([e, -9], [e * 0.7, 3]),
      seg([e * 0.7, 3], [-e * 0.7, 3]),
      seg([-e * 0.7, 3], [-e, -9]),
    ];
    const det: Item[] = Array.from({ length: n - 1 }, (_, i) => ({ l: [polar(h, ang(i + 1), 11), polar(h, ang(i + 1), R * 0.97)] }));
    det.push({ q: [polar(h, UP - th * 0.8, 14), polar(h, UP, 18), polar(h, UP + th * 0.8, 14)] });
    return { fill: [fan, ears], det };
  }
  // Spiral: a round body whorl with a short spire and a clear spiral line into the center.
  const r = 30;
  const turns = range(rnd, 2.2, 2.7);
  const sp = range(rnd, 6, 10);
  const k = 0.5523 * r;
  const body: Cubic[] = [
    [
      [0, -r],
      [k, -r],
      [r, -k],
      [r, 0],
    ],
    [
      [r, 0],
      [r, k],
      [k, r],
      [0, r],
    ],
    [
      [0, r],
      [-k, r],
      [-r, k],
      [-r, 0],
    ],
    [
      [-r, 0],
      [-r, -k],
      [-r * 0.7, -r - sp * 0.6],
      [-r * 0.25, -r - sp],
    ],
    [
      [-r * 0.25, -r - sp],
      [-r * 0.1, -r - sp * 0.4],
      [-k * 0.3, -r],
      [0, -r],
    ],
  ];
  const N = 22;
  const spiral: Pt[] = Array.from({ length: N + 1 }, (_, i) => {
    const t = (i / N) * turns * TAU;
    return polar([0, 0], -Math.PI / 2 + t, r * 0.88 * Math.exp(-t / ((turns * TAU) / 2.6)));
  });
  return {
    fill: [body],
    det: [
      { c: through(spiral) },
      {
        q: [
          [r * 0.35, r * 0.5],
          [r * 0.75, r * 0.2],
          [r * 0.85, -r * 0.3],
        ],
      },
    ],
  };
}

const armsOf = (rnd: Rng) => (rnd() < 0.2 ? 6 : 5);
/** The seeded arm count of `starfish` (5 or 6). */
export const starfishArms = (seed: number) => armsOf(rngFor('starfish', seed));

function starfish(seed: number): Raw {
  const rnd = rngFor('starfish', seed);
  const n = armsOf(rnd);
  const turn = range(rnd, -0.3, 0.3);
  const c: Pt = [0, 0];
  const w = range(rnd, 0.2, 0.26);
  const rv = range(rnd, 9, 12);
  const out: Cubic[] = [];
  const det: Item[] = [];
  const arms = Array.from({ length: n }, (_, i) => {
    const a = UP + turn + (i * TAU) / n + range(rnd, -0.07, 0.07);
    return { a, F: frame(c, a, range(rnd, 36, 44), range(rnd, -0.08, 0.08)) };
  });
  const valley = (i: number) => polar(c, (arms[i % n]!.a + arms[(i + 1) % n]!.a + (i + 1 === n ? TAU : 0)) / 2, rv);
  for (let i = 0; i < n; i++) {
    const { a, F } = arms[i]!;
    const vL = valley(i + n - 1);
    const vR = valley(i);
    const t = w * 0.28;
    out.push(
      [vL, F(0.4, -w * 0.75), F(0.8, -t * 1.2), F(0.95, -t)],
      [F(0.95, -t), F(0.95 + t * 1.33, -t), F(0.95 + t * 1.33, t), F(0.95, t)],
      [F(0.95, t), F(0.8, t * 1.2), F(0.4, w * 0.75), vR],
    );
    for (const s of [0.35, 0.52, 0.69, 0.84]) det.push(dot(F(s, 0), a));
  }
  det.push({ c: circle(c, rv * 0.45) });
  return { fill: [out], det };
}

/** One fish; also the body outline and the eye center (for the tests). */
export function fishParts(seed: number): MotifParts & { body: Cubic[]; eye: Pt } {
  const rnd = rngFor('fish', seed);
  const d = range(rnd, 0.14, 0.26);
  const ang = range(rnd, -0.06, 0.06); // level, head to the right; a mirror faces it left
  const F = frame([0, 0], ang, 80, range(rnd, -0.05, 0.05));
  const p = 0.05;
  const body: Cubic[] = [
    [F(0.28, -p), F(0.5, -d * 1.25), F(0.88, -d * 1.1), F(1, 0)],
    [F(1, 0), F(0.92, d * 1.05), F(0.55, d * 1.25), F(0.28, p)],
    seg(F(0.28, p), F(0.28, -p)),
  ];
  const forked = rnd() < 0.6;
  const tw = range(rnd, 0.17, 0.24);
  const tail: Cubic[] = forked
    ? [
        [F(0.3, -p * 0.6), F(0.2, -tw * 0.5), F(0.08, -tw * 0.9), F(0.02, -tw)],
        [F(0.02, -tw), F(0.1, -tw * 0.4), F(0.1, tw * 0.4), F(0.02, tw)],
        [F(0.02, tw), F(0.08, tw * 0.9), F(0.2, tw * 0.5), F(0.3, p * 0.6)],
        seg(F(0.3, p * 0.6), F(0.3, -p * 0.6)),
      ]
    : [
        [F(0.3, -p * 0.6), F(0.15, -tw * 0.6), F(0.03, -tw * 1.1), F(0.03, 0)],
        [F(0.03, 0), F(0.03, tw * 1.1), F(0.15, tw * 0.6), F(0.3, p * 0.6)],
        seg(F(0.3, p * 0.6), F(0.3, -p * 0.6)),
      ];
  const fh = range(rnd, 0.1, 0.16);
  const dorsal: Cubic[] = [
    [F(0.48, -d * 0.8), F(0.52, -d - fh), F(0.6, -d - fh * 1.1), F(0.7, -d - fh * 0.6)],
    [F(0.7, -d - fh * 0.6), F(0.72, -d * 0.9), F(0.72, -d * 0.9), F(0.74, -d * 0.8)],
    seg(F(0.74, -d * 0.8), F(0.48, -d * 0.8)),
  ];
  const pectoral = finger(frame(F(0.66, d * 0.45), ang + Math.PI * 0.8, 15), 0.1, 0.05);
  const eye = F(0.88, -d * 0.3);
  const det: Item[] = [{ q: [F(0.78, -d * 0.85), F(0.73, 0), F(0.79, d * 0.85)] }, { c: circle(eye, 1.8) }];
  const k = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < k; i++) {
    const s = 0.45 + (0.22 * i) / k;
    det.push({ q: [F(s + 0.03, -d * 0.6), F(s - 0.03, 0), F(s + 0.03, d * 0.6)] });
  }
  const P = fit({ fill: [tail, body, dorsal, pectoral], det, marks: [eye, ...body.flatMap((c) => c)] });
  const [eyeIn, ...flat] = P.marks;
  const bodyIn: Cubic[] = [];
  for (let i = 0; i < 3; i++) bodyIn.push([flat[i * 4]!, flat[i * 4 + 1]!, flat[i * 4 + 2]!, flat[i * 4 + 3]!]);
  return { fill: P.fill, detail: P.detail, body: bodyIn, eye: eyeIn! };
}

export interface MotifParts {
  readonly fill: string;
  readonly detail: string;
}

/** The bubbles of a seed, bottom first: centers and radii (raw units, before the fit). */
export function bubbleCircles(seed: number): { c: Pt; r: number }[] {
  const rnd = rngFor('bubbles', seed);
  const k = 3 + Math.floor(rnd() * 4);
  let r = range(rnd, 11, 14);
  let c: Pt = [0, -r];
  const out = [{ c, r }];
  for (let i = 1; i < k; i++) {
    const r2 = r * range(rnd, 0.62, 0.85);
    const gap = r + r2 + range(rnd, 2, 6);
    c = [c[0] + range(rnd, -0.35, 0.35) * gap, c[1] - Math.sqrt(gap * gap * 0.85)];
    r = r2;
    out.push({ c, r });
  }
  return out;
}

// The silhouette is filled discs; the page may draw this family as outlines later.
function bubbles(seed: number): Raw {
  const cs = bubbleCircles(seed);
  const r0 = cs[0]!.r;
  return {
    fill: cs.map(({ c, r }) => circle(c, r)),
    det: cs
      .filter(({ r }) => r >= r0 * 0.45)
      .map(({ c, r }): Item => ({ q: [polar(c, -2.6, r * 0.62), polar(c, -2.05, (r * 0.62) / Math.cos(0.55)), polar(c, -1.5, r * 0.62)] })),
  };
}

const BUILDERS: Readonly<Record<SeaFamily, (seed: number) => MotifParts>> = {
  kelp: (s) => fit(kelp(s)),
  coral: (s) => fit(coral(s)),
  shell: (s) => fit(shell(s)),
  starfish: (s) => fit(starfish(s)),
  fish: fishParts,
  bubbles: (s) => fit(bubbles(s)),
};

export function makeSeaMotif(family: SeaFamily, seed: number): { silhouette: StudioMotif; detail: StudioMotif } {
  const p = BUILDERS[family](seed);
  return { silhouette: { d: short(p.fill), box: BOX, paint: 'fill' }, detail: { d: short(p.detail), box: BOX, paint: 'stroke' } };
}
