// Farris wallpaper functions: a complex field on the tile with exactly the symmetry of one of the
// 17 wallpaper groups, so colour (not only line) can carry the symmetry. f(c) = sum over terms and
// group ops of a plane wave exp(2 pi i k . g(c)), averaged over the group, in lattice coordinates c.
// Each op g(c) = A c + t turns a wave into one of frequency A^T k and phase k . t, so the averaged
// field is a short list of merged plane waves: exact and fast to sample.
import { GROUPS, GROUP_OPS, HEX_OPS } from './symmetry.ts';
import { mulberry32, TAU } from './util.ts';

export interface FarrisRecipe {
  group: string;
  seed: number;
  waves: number; // 2..8
  detail: number; // 1..6
}
export interface FieldGrid {
  n: number;
  re: Float64Array;
  im: Float64Array;
}
type Wave = { k: [number, number]; amp: [number, number] };
type Affine = { A: [number, number, number, number]; t: [number, number] }; // A = [a00, a01, a10, a11]

export const FARRIS_GROUPS: readonly string[] = [...GROUPS, ...Object.keys(HEX_OPS)];
export const isHexGroup = (g: string): boolean => g in HEX_OPS;

const S3 = Math.sqrt(3);

function checked(A: [number, number, number, number], t: [number, number], group: string): Affine {
  const det = A[0] * A[3] - A[1] * A[2];
  if (Math.abs(det) !== 1) throw new Error(`farris: op of ${group} is not unimodular`);
  return { A, t };
}

// Square ops are given as cell functions (some mod 1); probe them so the table stays in one place.
function squareAffine(group: string): Affine[] {
  const p: [number, number] = [0.3125, 0.1875]; // generic: no op lands it on a mod 1 jump
  const d = 1e-3;
  return GROUP_OPS[group]!.map((op) => {
    const o = op(p);
    const col = (dx: number, dy: number): [number, number] => {
      const q = op([p[0] + dx, p[1] + dy]);
      // Math.round undoes a mod 1 jump between the two probes.
      return [Math.round((q[0] - o[0] - Math.round(q[0] - o[0])) / d), Math.round((q[1] - o[1] - Math.round(q[1] - o[1])) / d)];
    };
    const [a00, a10] = col(d, 0);
    const [a01, a11] = col(0, d);
    const q4 = (v: number): number => (((Math.round(v * 4) % 4) + 4) % 4) / 4;
    const t: [number, number] = [q4(o[0] - a00 * p[0] - a01 * p[1]), q4(o[1] - a10 * p[0] - a11 * p[1])];
    return checked([a00, a01, a10, a11], t, group);
  });
}

// Hex ops are plane matrices M about a lattice point: in lattice coords A = L^-1 M L, t = 0.
function hexAffine(group: string): Affine[] {
  return HEX_OPS[group]!.map(([m00, m01, m10, m11]) => {
    // M L, columns M a and M b, then L^-1 = [[1, -1/sqrt3], [0, 2/sqrt3]].
    const ma: [number, number] = [m00, m10];
    const mb: [number, number] = [m00 / 2 + (m01 * S3) / 2, m10 / 2 + (m11 * S3) / 2];
    const inv = ([x, y]: [number, number]): [number, number] => [x - y / S3, (2 * y) / S3];
    const [a00, a10] = inv(ma);
    const [a01, a11] = inv(mb);
    const A = [a00, a01, a10, a11].map((v) => {
      if (Math.abs(v - Math.round(v)) > 1e-9) throw new Error(`farris: op of ${group} is not a lattice map`);
      return Math.round(v) + 0; // + 0: no -0 in keys
    }) as [number, number, number, number];
    return checked(A, [0, 0], group);
  });
}

const opsCache = new Map<string, Affine[]>();
function affineOps(group: string): Affine[] {
  let ops = opsCache.get(group);
  if (!ops) {
    ops = isHexGroup(group) ? hexAffine(group) : squareAffine(group);
    opsCache.set(group, ops);
  }
  return ops;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, Math.round(v) || lo));

export function farrisWaves(r: FarrisRecipe): Wave[] {
  const group = FARRIS_GROUPS.includes(r.group) ? r.group : 'p1';
  const ops = affineOps(group);
  const waves = clamp(r.waves, 2, 8);
  const detail = clamp(r.detail, 1, 6);
  const rnd = mulberry32(r.seed);
  const merged = new Map<string, Wave>();
  let total = 0;
  for (let draws = 0; draws < 64; draws++) {
    let kx = 0;
    let ky = 0;
    while (kx === 0 && ky === 0) {
      kx = Math.floor(rnd() * (2 * detail + 1)) - detail;
      ky = Math.floor(rnd() * (2 * detail + 1)) - detail;
    }
    const rad = Math.sqrt(-2 * Math.log(1 - rnd())) / (1 + Math.hypot(kx, ky)) ** 0.6;
    const th = TAU * rnd();
    const ar = (rad * Math.cos(th)) / ops.length;
    const ai = (rad * Math.sin(th)) / ops.length;
    for (const { A, t } of ops) {
      // k . (A c + t) = (A^T k) . c + k . t
      const fx = A[0] * kx + A[2] * ky + 0;
      const fy = A[1] * kx + A[3] * ky + 0;
      const ph = TAU * (kx * t[0] + ky * t[1]);
      const key = `${fx},${fy}`;
      const w = merged.get(key) ?? { k: [fx, fy], amp: [0, 0] };
      w.amp[0] += ar * Math.cos(ph) - ai * Math.sin(ph);
      w.amp[1] += ar * Math.sin(ph) + ai * Math.cos(ph);
      merged.set(key, w);
    }
    if (draws + 1 < waves) continue;
    total = 0;
    for (const w of merged.values()) total += Math.hypot(w.amp[0], w.amp[1]);
    if (total >= 1e-6) break;
  }
  return [...merged.values()].filter((w) => Math.hypot(w.amp[0], w.amp[1]) > 1e-12);
}

// Tile coords to lattice coords: square tile = one cell; hex tile = plane (u, v sqrt3) through L^-1.
const lattice = (hex: boolean, u: number, v: number): [number, number] => (hex ? [u - v, 2 * v] : [u, v]);

function evalWaves(ws: readonly Wave[], cx: number, cy: number): [number, number] {
  let re = 0;
  let im = 0;
  for (const { k, amp } of ws) {
    const ph = TAU * (k[0] * cx + k[1] * cy);
    const c = Math.cos(ph);
    const s = Math.sin(ph);
    re += amp[0] * c - amp[1] * s;
    im += amp[0] * s + amp[1] * c;
  }
  return [re, im];
}

export function farrisAt(r: FarrisRecipe, u: number, v: number): [number, number] {
  const [cx, cy] = lattice(isHexGroup(r.group), u, v);
  return evalWaves(farrisWaves(r), cx, cy);
}

export function farrisGrid(r: FarrisRecipe, n: number): FieldGrid {
  const ws = farrisWaves(r);
  const hex = isHexGroup(r.group);
  const re = new Float64Array(n * n);
  const im = new Float64Array(n * n);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const [cx, cy] = lattice(hex, (i + 0.5) / n, (j + 0.5) / n);
      [re[j * n + i], im[j * n + i]] = evalWaves(ws, cx, cy);
    }
  return { n, re, im };
}
