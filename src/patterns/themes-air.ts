// Theme kinds: feathers laid like plumage, and chain (chain-link fence or a chain of links).
// Both live on a torus, so the tile repeats with no seam.
import { mulberry32, wrap, type Generator, type Poly, type Pt, type Rng } from './util.ts';

export const THEME_AIR_MAX_DEPTH = { feathers: 4, chain: 4 } as const;

const rot = (pts: Poly, a: number, cx: number, cy: number): Poly => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return pts.map(([x, y]): Pt => [cx + x * c - y * s, cy + x * s + y * c]);
};

// ---------- feathers ----------

export type FeatherShape = { len: number; half: number; bend: number; notches: number[]; barbs: number };
export type FeatherParts = { outline: Poly; spine: Poly; barbs: Poly[] };

// One feather in local coordinates: base at (0, 0), tip at (spine(1), len), y grows toward the tip.
// Notches are dents in the outline (t along the feather, sign = side); barbs near a notch are left out.
export function featherParts(f: FeatherShape): FeatherParts {
  const axis = (t: number) => f.bend * f.len * t * t;
  const width = (t: number, side: number) => {
    let w = f.half * Math.sin(Math.PI * Math.pow(t, 0.62));
    for (const n of f.notches) if (Math.sign(n) === side) w *= 1 - 0.35 * Math.exp(-(((t - Math.abs(n)) / 0.05) ** 2));
    return w;
  };
  const K = 12;
  const side = (s: number): Poly => Array.from({ length: K + 1 }, (_, i): Pt => [axis(i / K) + s * width(i / K, s), (f.len * i) / K]);
  const right = side(1);
  const outline = [...right, ...side(-1).reverse().slice(1, -1), right[0]!];
  const spine = Array.from({ length: 5 }, (_, i): Pt => [axis(i / 4), (f.len * i) / 4]);
  const inside = (x: number, y: number, s: number) => {
    const t = y / f.len;
    return t >= 0 && t <= 1 && s * (x - axis(t)) <= width(t, s);
  };
  const barbs: Poly[] = [];
  const ang = 0.75; // from the spine, toward the tip
  for (const s of [1, -1]) {
    for (let k = 0; k < f.barbs; k++) {
      const t0 = 0.12 + (0.72 * (k + 0.5)) / f.barbs;
      if (f.notches.some((n) => Math.sign(n) === s && Math.abs(Math.abs(n) - t0) < 0.06)) continue;
      const x0 = axis(t0);
      const y0 = t0 * f.len;
      const dx = s * Math.sin(ang);
      const dy = Math.cos(ang);
      // Bisect the distance to the outline: the sampled outline is a chord polygon, so stop a hair short.
      let lo = 0;
      while (lo < f.half * 3 && inside(x0 + dx * (lo + 0.5), y0 + dy * (lo + 0.5), s)) lo += 0.5;
      let hi = lo + 0.5;
      for (let i = 0; i < 30; i++) {
        const m = (lo + hi) / 2;
        if (inside(x0 + dx * m, y0 + dy * m, s)) lo = m;
        else hi = m;
      }
      const d = lo * 0.94;
      if (d > 1)
        barbs.push([
          [x0, y0],
          [x0 + dx * d, y0 + dy * d],
        ]);
    }
  }
  return { outline, spine, barbs };
}

// Offset rows (two per tile), half a feather apart; each feather fits in its cell with a small gap,
// so nothing overlaps.
export const feathers: Generator = (rnd, depth, size) => {
  const nc = 3;
  const nr = 2;
  const cw = size / nc;
  const ch = size / nr;
  const sx = (0.1 + rnd() * 0.8) * cw; // seeded shift, so no base lands exactly on the tile edge
  const out: Poly[] = [];
  for (let r = 0; r < nr; r++) {
    for (let c = 0; c < nc; c++) {
      const notches: number[] = [];
      const nn = rnd() < 0.45 ? 1 + Math.floor(rnd() * 2) : 0;
      for (let k = 0; k < nn; k++) notches.push((rnd() < 0.5 ? 1 : -1) * (0.3 + rnd() * 0.45));
      const shape: FeatherShape = {
        len: ch * (0.84 + rnd() * 0.08),
        half: cw * (0.32 + rnd() * 0.05),
        bend: (rnd() - 0.5) * 0.16,
        notches,
        barbs: 2 + 2 * depth,
      };
      const tilt = (rnd() - 0.5) * 0.14;
      const p = featherParts(shape);
      const bx = (c + (r % 2) * 0.5) * cw + sx;
      const by = r * ch + ch * 0.03;
      out.push(...[p.outline, p.spine, ...p.barbs].map((q) => rot(q, tilt, bx, by)));
    }
  }
  return wrap(out, size);
};

// ---------- weaving: gaps in the strand that passes under ----------

type Strand<M> = { poly: Poly; meta: M; id: number };

// For every crossing between strands of different ids, under() picks the strand that gets the gap.
function weave<M>(strands: Strand<M>[], under: (a: M, b: M, p: Pt) => 0 | 1, gap: number): Poly[][] {
  const cuts: number[][] = strands.map(() => []);
  const cum = strands.map(({ poly }) => {
    const c = [0];
    for (let i = 1; i < poly.length; i++) c.push(c[i - 1]! + Math.hypot(poly[i]![0] - poly[i - 1]![0], poly[i]![1] - poly[i - 1]![1]));
    return c;
  });
  const box = strands.map(({ poly }) => {
    const xs = poly.map((p) => p[0]);
    const ys = poly.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as const;
  });
  for (let a = 0; a < strands.length; a++) {
    for (let b = a + 1; b < strands.length; b++) {
      const A = strands[a]!;
      const B = strands[b]!;
      const [ax0, ay0, ax1, ay1] = box[a]!;
      const [bx0, by0, bx1, by1] = box[b]!;
      if (A.id === B.id || ax0 > bx1 || bx0 > ax1 || ay0 > by1 || by0 > ay1) continue;
      for (let i = 1; i < A.poly.length; i++) {
        const [px, py] = A.poly[i - 1]!;
        const rx = A.poly[i]![0] - px;
        const ry = A.poly[i]![1] - py;
        for (let j = 1; j < B.poly.length; j++) {
          const [qx, qy] = B.poly[j - 1]!;
          const sx = B.poly[j]![0] - qx;
          const sy = B.poly[j]![1] - qy;
          const den = rx * sy - ry * sx;
          if (Math.abs(den) < 1e-12) continue;
          const t = ((qx - px) * sy - (qy - py) * sx) / den;
          const u = ((qx - px) * ry - (qy - py) * rx) / den;
          if (t < 0 || t >= 1 || u < 0 || u >= 1) continue;
          const p: Pt = [px + t * rx, py + t * ry];
          if (under(A.meta, B.meta, p) === 0) cuts[a]!.push(cum[a]![i - 1]! + t * (cum[a]![i]! - cum[a]![i - 1]!));
          else cuts[b]!.push(cum[b]![j - 1]! + u * (cum[b]![j]! - cum[b]![j - 1]!));
        }
      }
    }
  }
  return strands.map(({ poly }, k) => {
    const c = cum[k]!;
    const at = (d: number): Pt => {
      let i = 1;
      while (i < c.length - 1 && c[i]! < d) i++;
      const f = (d - c[i - 1]!) / (c[i]! - c[i - 1]! || 1);
      return [poly[i - 1]![0] + f * (poly[i]![0] - poly[i - 1]![0]), poly[i - 1]![1] + f * (poly[i]![1] - poly[i - 1]![1])];
    };
    const total = c[c.length - 1]!;
    const holes = cuts[k]!.map((d) => [d - gap / 2, d + gap / 2] as const).sort((p, q) => p[0] - q[0]);
    if (holes.length === 0) return [poly];
    // Kept intervals = [0, total] minus the holes.
    const keep: [number, number][] = [];
    let from = 0;
    for (const [h0, h1] of holes) {
      if (h0 > from) keep.push([from, h0]);
      from = Math.max(from, h1);
    }
    if (from < total) keep.push([from, total]);
    return keep.filter(([s, e]) => e - s > 0.5).map(([s, e]) => [at(s), ...poly.filter((_, i) => c[i]! > s && c[i]! < e), at(e)]);
  });
}

// ---------- chain ----------

export type ChainFamily = 'fence' | 'links';
// The first draw of the generator picks the family, so this agrees with chain(mulberry32(seed), ...).
export const chainFamily = (seed: number): ChainFamily => (mulberry32(seed)() < 0.5 ? 'fence' : 'links');

export const chain: Generator = (rnd, depth, size) => (rnd() < 0.5 ? fence(rnd, depth, size) : links(rnd, depth, size));

// Chain-link fence: n vertical zigzag wires; wire k meets wire k+1 at x = (k+1) p, where their
// bends hook around each other. Wires -1 and n are ghosts so the hooks on the tile edge get their gaps.
function fence(rnd: Rng, depth: number, size: number): Poly[] {
  const n = 2 * (depth + 1);
  const p = size / n;
  const nq = n + (rnd() < 0.5 ? 2 : 0) - (rnd() < 0.5 && n > 4 ? 2 : 0);
  const q = size / nq;
  const r = Math.max(2.4, Math.min(p, q) * (0.26 + rnd() * 0.08));
  const beta = Math.atan2(q, p);
  // Cut wires: (wire, run) pairs, a few more with depth.
  const cut = new Set<string>();
  const bent = new Set<string>();
  for (let i = 0; i < depth; i++) {
    const key = `${Math.floor(rnd() * n)} ${Math.floor(rnd() * nq)}`;
    (rnd() < 0.5 ? cut : bent).add(key);
  }
  const strands: Strand<number>[] = [];
  for (let k = -1; k <= n; k++) {
    const km = (k + n) % n;
    const polys: Poly[] = [];
    let cur: Pt[] = [];
    // Peak j sits at y = j q; it is a right peak (x = (k+1) p) when j has the parity of k.
    const peak = (j: number): Pt => [((((j + k) % 2) + 2) % 2 === 0 ? k + 1 : k) * p, j * q];
    const mid = (j: number): Pt => [(peak(j)[0] + peak(j + 1)[0]) / 2, (j + 0.5) * q];
    cur.push(mid(-1));
    for (let j = 0; j < nq; j++) {
      const [px, py] = peak(j);
      const right = px > k * p + p / 2;
      const cx = px + (right ? 0.35 : -0.35) * r;
      const cy = py + (right ? -0.3 : 0.3) * r;
      const a0 = right ? -Math.PI / 2 - beta : -Math.PI / 2 + beta;
      const a1 = right ? Math.PI / 2 + beta : -1.5 * Math.PI - beta;
      for (let i = 0; i <= 4; i++) {
        const a = a0 + ((a1 - a0) * i) / 4;
        cur.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      const [mx, my] = mid(j);
      const key = `${km} ${j}`;
      const dx = peak(j + 1)[0] - px;
      if (cut.has(key)) {
        // Cut wire: the two loose ends spring apart.
        cur.push([mx - dx * 0.18 + 1.5, my - q * 0.18]);
        polys.push(cur);
        cur = [[mx + dx * 0.18 - 1.5, my + q * 0.18]];
      } else if (bent.has(key)) cur.push([mx + 0.3 * q, my - 0.3 * Math.abs(dx)]);
      if (j === nq - 1) cur.push([mx, my]);
    }
    polys.push(cur);
    for (const poly of polys) if (poly.length >= 2) strands.push({ poly, meta: k, id: k });
  }
  // On a hook pair the upper crossing puts the left wire under, the lower one the right wire.
  const woven = weave(strands, (a, b, [, y]) => (y < Math.round(y / q) * q === a < b ? 0 : 1), 3);
  return wrap(
    woven.flatMap((ps, i) => (strands[i]!.meta >= 0 && strands[i]!.meta < n ? ps : [])),
    size,
  );
}

const stadium = (a: number, b: number, rr: number): Poly => {
  const pts: Pt[] = [];
  const cap = (cx: number, from: number) => {
    for (let i = 0; i <= 4; i++) {
      const t = from + (Math.PI * i) / 4;
      pts.push([cx + rr * Math.cos(t), rr * Math.sin(t) * (b / rr)]);
    }
  };
  cap(a - rr, -Math.PI / 2);
  cap(-(a - rr), Math.PI / 2);
  pts.push(pts[0]!);
  return pts;
};

type Link = { cx: number; cy: number; ang: number; front: boolean; chain: number; i: number };

// Interlocking links along m parallel chains; front and side links alternate and each side link
// passes through the holes of its two front neighbours.
function links(rnd: Rng, depth: number, size: number): Poly[] {
  const dir = Math.floor(rnd() * 3); // 0 horizontal, 1 vertical, 2 diagonal
  const diag = dir === 2;
  const n = diag ? 4 * (1 + Math.floor(depth / 2)) : 2 * (depth + 1);
  const m = diag ? n / 4 : Math.max(1, Math.floor(n / 3));
  const step = diag ? (size * Math.SQRT2) / n : size / n;
  const over = 1.4 + rnd() * 0.2; // link length / pitch
  const a = (step * over) / 2;
  const th = Math.max(3, a * (0.18 + rnd() * 0.06));
  const b = Math.max(a * (0.5 + rnd() * 0.2), th * 2.2);
  const ang = diag ? Math.PI / 4 : dir === 1 ? Math.PI / 2 : 0;
  const shift = rnd() * size;
  const strands: Strand<Link>[] = [];
  for (let j = 0; j < m; j++) {
    for (let i = -1; i <= n; i++) {
      const s = i * step + (j % 2) * step;
      const off = ((j + 0.5) * size) / m;
      const [cx, cy]: Pt = diag ? [off + s / Math.SQRT2, shift + s / Math.SQRT2] : dir === 1 ? [off, shift + s] : [shift + s, off];
      const link: Link = { cx, cy, ang, front: (((i % 2) + 2) % 2 === 0) === (j % 2 === 0), chain: j, i };
      const shapes = link.front ? [stadium(a, b, b), stadium(a - th, b - th, b - th)] : [stadium(a, th, th)];
      for (const sh of shapes) strands.push({ poly: rot(sh, ang, cx, cy), meta: link, id: j * (n + 2) + i + 1 });
    }
  }
  // Where a front link's end wire crosses a side link: under at its far end, over at its near end.
  const woven = weave(
    strands,
    (A, B, [x, y]) => {
      const f = A.front ? A : B;
      const u = (x - f.cx) * Math.cos(f.ang) + (y - f.cy) * Math.sin(f.ang);
      const frontUnder = u < 0;
      return frontUnder === A.front ? 0 : 1;
    },
    3,
  );
  return wrap(
    woven.flatMap((ps, k) => (strands[k]!.meta.i >= 0 && strands[k]!.meta.i < n ? ps : [])),
    size,
  );
}
