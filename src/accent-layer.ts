// The accent layer: simple shapes filled in the Accent color, drawn over any pattern kind, and its link codec.
// Pure: no DOM, no clock. Randomness only from mulberry32 on offsets of the pattern seed, so the base layer does not shift.
import { accentGeometry, hasAccent, type Kind } from './fractal.ts';
import { mulberry32, TAU, type Poly, type Pt } from './patterns/util.ts';

export const ACCENT_SHAPES = ['own', 'dot', 'ring', 'square', 'triangle', 'diamond', 'drop', 'leaf'] as const;
export const ACCENT_PLACES = ['own', 'seed', 'grid'] as const;
export const ACCENT_SNAPS = [4, 8, 12, 16] as const;
export type AccentShape = (typeof ACCENT_SHAPES)[number];
export type AccentPlace = (typeof ACCENT_PLACES)[number];
export type AccentSnap = (typeof ACCENT_SNAPS)[number];

export interface AccentLayer {
  readonly on: boolean;
  readonly shape: AccentShape;
  readonly size: number; // radius, % of a cell, 5 to 40
  readonly amount: number; // % of the places used, 10 to 100
  readonly place: AccentPlace;
  readonly snap: AccentSnap; // grid steps per tile edge, for place 'grid'
}

// The radius of the kind's own accent shape, % of its own cell: Truchet dots 0.15 c, Sprigs berries 0.07 c.
const OWN_SIZE: Partial<Record<Kind, number>> = { truchet: 15, sprigs: 7 };
const SEED_CELLS = 8; // place 'seed': a cell is the tile / 8
const SEED_SPOTS = 64; // place 'seed': 64 shapes at amount 100
const DROP_SALT = 0x2545f491; // seed offsets: the base layer draws from mulberry32(seed) itself
const SCATTER_SALT = 0x6c8e9cf5;

// `patchwork`: the kind is not drawn, so its own shapes and places do not exist: the defaults are off, as for a kind without them.
export function accentDefaults(kind: Kind, patchwork = false): AccentLayer {
  return hasAccent(kind) && !patchwork
    ? { on: true, shape: 'own', size: OWN_SIZE[kind] ?? 15, amount: 100, place: 'own', snap: 8 }
    : { on: false, shape: 'dot', size: 15, amount: 100, place: 'grid', snap: 8 };
}

// The layer drawn where the kind's own shapes and places do not exist (an image, a patchwork): 'own' shape gives a dot,
// 'own' place a grid. The stored layer keeps 'own', so going back to the math kind restores it.
export function accentEffective(layer: AccentLayer, own: boolean): AccentLayer {
  if (own || (layer.shape !== 'own' && layer.place !== 'own')) return layer;
  return { ...layer, shape: layer.shape === 'own' ? 'dot' : layer.shape, place: layer.place === 'own' ? 'grid' : layer.place };
}

// Shapes in stamp units, the Builder's 100 box centered on 0 (src/builder/stamps.ts); the dot radius is 30.
type Seg = readonly [Pt, Pt, Pt, Pt]; // a cubic Bezier
const bezier = (segs: readonly Seg[], k = 8): Pt[] => {
  const out: Pt[] = [segs[0]![0]];
  for (const [a, b, c, d] of segs)
    for (let i = 1; i <= k; i++) {
      const t = i / k;
      const u = 1 - t;
      const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
      out.push([w[0] * a[0] + w[1] * b[0] + w[2] * c[0] + w[3] * d[0], w[0] * a[1] + w[1] * b[1] + w[2] * c[1] + w[3] * d[1]]);
    }
  return out;
};
const ngon = (r: number, n = 16): Pt[] =>
  Array.from({ length: n + 1 }, (_, i): Pt => [r * Math.cos((TAU * (i % n)) / n), r * Math.sin((TAU * (i % n)) / n)]);
const box = (pts: readonly Pt[]): Pt[] => pts.map(([x, y]): Pt => [x - 50, y - 50]);
const UNIT: Record<Exclude<AccentShape, 'own'>, Pt[]> = {
  dot: ngon(30),
  // One outline: the outer loop, the inner loop the other way round, back to the start; even-odd leaves a hole.
  ring: [...ngon(30), ...ngon(18).reverse(), [30, 0]],
  square: box([
    [20, 20],
    [80, 20],
    [80, 80],
    [20, 80],
    [20, 20],
  ]),
  triangle: box([
    [50, 15],
    [85, 80],
    [15, 80],
    [50, 15],
  ]),
  diamond: box([
    [50, 10],
    [85, 50],
    [50, 90],
    [15, 50],
    [50, 10],
  ]),
  drop: box(
    bezier([
      [
        [50, 8],
        [50, 8],
        [80, 44],
        [80, 64],
      ],
      [
        [80, 64],
        [80, 80],
        [66, 92],
        [50, 92],
      ],
      [
        [50, 92],
        [34, 92],
        [20, 80],
        [20, 64],
      ],
      [
        [20, 64],
        [20, 44],
        [50, 8],
        [50, 8],
      ],
    ]),
  ),
  leaf: box(
    bezier([
      [
        [50, 8],
        [80, 30],
        [80, 70],
        [50, 92],
      ],
      [
        [50, 92],
        [20, 70],
        [20, 30],
        [50, 8],
      ],
    ]),
  ),
};
// The largest |x| or |y| of a shape over its dot radius: the half extent of its bounding box per unit radius.
const extent = (s: Exclude<AccentShape, 'own'>) => Math.max(...UNIT[s].map(([x, y]) => Math.max(Math.abs(x), Math.abs(y)))) / 30;

const shapeAt = (s: Exclude<AccentShape, 'own'>, [cx, cy]: Pt, r: number): Poly =>
  UNIT[s].map(([x, y]): Pt => [cx + (x * r) / 30, cy + (y * r) / 30]);

// Shifts a shape whole inside [0, size]: a shape cut by the tile edge would not tile without a wrapped copy.
function keepInside(p: Poly, size: number): Poly {
  const xs = p.map((v) => v[0]);
  const ys = p.map((v) => v[1]);
  const fix = (lo: number, hi: number) => (lo < 0 ? -lo : hi > size ? size - hi : 0);
  const dx = fix(Math.min(...xs), Math.max(...xs));
  const dy = fix(Math.min(...ys), Math.max(...ys));
  return dx === 0 && dy === 0 ? p : p.map(([x, y]): Pt => [x + dx, y + dy]);
}

// The vertex mean of a closed polygon, without its closing point: the center of a regular shape.
function centroid(p: readonly Pt[]): Pt {
  const q = p.slice(0, -1);
  return [q.reduce((s, v) => s + v[0], 0) / q.length, q.reduce((s, v) => s + v[1], 0) / q.length];
}

// The indices kept out of n, exactly round(n * amount / 100), chosen by a seeded shuffle, in their first order.
function kept(n: number, amount: number, seed: number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  if (amount >= 100) return idx;
  const rnd = mulberry32((seed + DROP_SALT) >>> 0);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  return idx.slice(0, Math.round((n * amount) / 100)).sort((a, b) => a - b);
}

// Mitchell's best candidate: each center is the farthest (on the torus) of 12 seeded tries from the centers so far,
// inside [m, size - m]. Shapes stay apart where the tile has room; at large sizes they may touch.
function scatter(count: number, size: number, m: number, seed: number): Pt[] {
  const rnd = mulberry32((seed + SCATTER_SALT) >>> 0);
  const span = Math.max(0, size - 2 * m);
  const d = (a: number, b: number) => Math.min(Math.abs(a - b), size - Math.abs(a - b));
  const out: Pt[] = [];
  for (let k = 0; k < count; k++) {
    let best: Pt = [0, 0];
    let bestD = -1;
    for (let t = 0; t < 12; t++) {
      const c: Pt = [m + rnd() * span, m + rnd() * span];
      const near = Math.min(Infinity, ...out.map((o) => Math.hypot(d(c[0], o[0]), d(c[1], o[1]))));
      if (near > bestD) [best, bestD] = [c, near];
    }
    out.push(best);
  }
  return out;
}

export function accentShapes(kind: Kind, layer: AccentLayer, p: { seed: number; depth: number; size: number }): Poly[] {
  if (!layer.on) return [];
  const { size, seed } = p;
  const shape = layer.shape === 'own' ? 'dot' : layer.shape; // 'own' away from the own places: the own shapes are round
  if (layer.place === 'own') {
    const own = accentGeometry({ kind, seed, depth: p.depth, size }) as Poly[];
    const k = layer.size / (OWN_SIZE[kind] ?? layer.size) || 1;
    const polys = own.map((poly) => {
      const c = centroid(poly);
      if (layer.shape !== 'own') {
        // The own radius over its own size gives the own cell; the new radius is size % of it.
        const r = Math.max(...poly.map(([x, y]) => Math.hypot(x - c[0], y - c[1]))) * k;
        return shapeAt(shape, c, r);
      }
      return k === 1 ? poly : poly.map(([x, y]): Pt => [c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * k]);
    });
    return kept(polys.length, layer.amount, seed).map((i) => keepInside(polys[i]!, size));
  }
  if (layer.place === 'grid') {
    const step = size / layer.snap;
    // ponytail: the radius is capped so the shape fits its cell; grid shapes never cross the tile edge.
    const r = Math.min((layer.size / 100) * step, step / 2 / extent(shape));
    const centers = Array.from({ length: layer.snap * layer.snap }, (_, i): Pt => [
      ((i % layer.snap) + 0.5) * step,
      (Math.floor(i / layer.snap) + 0.5) * step,
    ]);
    return kept(centers.length, layer.amount, seed).map((i) => shapeAt(shape, centers[i]!, r));
  }
  const r = ((layer.size / 100) * size) / SEED_CELLS;
  return scatter(Math.round((SEED_SPOTS * layer.amount) / 100), size, r * extent(shape), seed).map((c) => shapeAt(shape, c, r));
}

// Link codec: `al=on_shape_size_amount_place_snap`, e.g. `1_d_15_100_g_8`.
const SHAPE_CODE: Record<AccentShape, string> = {
  own: 'o',
  dot: 'd',
  ring: 'r',
  square: 's',
  triangle: 't',
  diamond: 'm',
  drop: 'p',
  leaf: 'l',
};
const PLACE_CODE: Record<AccentPlace, string> = { own: 'o', seed: 's', grid: 'g' };
const fromCode = <T extends string>(codes: Record<T, string>, c: string | undefined): T | undefined =>
  (Object.keys(codes) as T[]).find((k) => codes[k] === c);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));

/** The `al` value, or null when the layer is the kind's default (old links stay unchanged). */
export function encodeAccentLayer(kind: Kind, layer: AccentLayer, patchwork = false): string | null {
  const d = accentDefaults(kind, patchwork);
  if ((Object.keys(d) as (keyof AccentLayer)[]).every((k) => d[k] === layer[k])) return null;
  return [layer.on ? 1 : 0, SHAPE_CODE[layer.shape], layer.size, layer.amount, PLACE_CODE[layer.place], layer.snap].join('_');
}

/** The layer from an `al` value: missing or malformed gives the kind's defaults; numbers are clamped. */
export function decodeAccentLayer(kind: Kind, value: string | null | undefined, patchwork = false): AccentLayer {
  const d = accentDefaults(kind, patchwork);
  const parts = (value ?? '').split('_');
  if (parts.length !== 6) return d;
  const [on, s, size, amount, pl, snap] = parts;
  const shape = fromCode(SHAPE_CODE, s);
  const place = fromCode(PLACE_CODE, pl);
  const nums = [size, amount, snap].map((v) => (/^\d+(\.\d+)?$/.test(v!) ? Number(v) : NaN));
  if ((on !== '0' && on !== '1') || !shape || !place || nums.some(Number.isNaN)) return d;
  // 'own' exists only for kinds with their own accent shapes, drawn as a single pattern.
  if ((!hasAccent(kind) || patchwork) && (shape === 'own' || place === 'own')) return d;
  const sn = clamp(nums[2]!, 4, 16);
  return {
    on: on === '1',
    shape,
    size: clamp(nums[0]!, 5, 40),
    amount: clamp(nums[1]!, 10, 100),
    place,
    snap: ACCENT_SNAPS.reduce((a, b) => (Math.abs(b - sn) < Math.abs(a - sn) ? b : a)),
  };
}
