// A seeded "fill the tile": stamps on a jittered grid, as a start for hand editing.
import { mulberry32 } from '../patterns/util.ts';
import type { Rng } from '../patterns/util.ts';
import type { Item } from './types.ts';

export interface FillOptions {
  readonly width: number;
  readonly height: number;
  /** 1..40, rounded and clamped. */
  readonly columns: number;
  /** 1..40, rounded and clamped. */
  readonly rows: number;
  /** The stamps to use: index into Design.stamps, the stamp's box, and its part count. */
  readonly stamps: readonly { readonly index: number; readonly box: number; readonly parts: number }[];
  readonly seed: number;
  /** Drawn side of a stamp as a fraction of the smaller cell side. */
  readonly size: number;
  /** 0..1: the size is multiplied by 1 + sizeJitter * u, u uniform in [-0.5, 0.5]. */
  readonly sizeJitter: number;
  /** 0..1: each item moves by up to jitter * 0.5 cell in x and in y. */
  readonly jitter: number;
  readonly rotate: 'none' | 'quarter' | 'free';
  /** Odd rows start half a cell to the right. */
  readonly stagger: boolean;
  /** Each item is flipped with probability one half. */
  readonly flip: boolean;
  /** Empty: keep the stamps' own colors. Else each item gets one color for all its parts. */
  readonly colors: readonly string[];
  readonly firstId: number;
}

const clampCount = (v: number): number => Math.min(40, Math.max(1, Math.round(v) || 1));

const wrap = (v: number, m: number): number => {
  const r = ((v % m) + m) % m;
  return r >= m ? 0 : r;
};

/** n entries of 0..k-1, each used floor(n/k) or ceil(n/k) times, in a shuffled order. */
function bag(n: number, k: number, rnd: Rng): number[] {
  const out: number[] = [];
  while (out.length < n) {
    const block = Array.from({ length: k }, (_, i) => i);
    for (let i = k - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [block[i], block[j]] = [block[j] ?? 0, block[i] ?? 0];
    }
    out.push(...block);
  }
  // Truncating the last block keeps the counts within 1 of each other.
  return out.slice(0, n);
}

export function gridFill(o: FillOptions): Item[] {
  if (o.stamps.length === 0) return [];
  const columns = clampCount(o.columns);
  const rows = clampCount(o.rows);
  const n = columns * rows;
  const cw = o.width / columns;
  const ch = o.height / rows;
  // Separate generators, so the per-item draws never depend on the colors or the stamp count.
  const rnd = mulberry32(o.seed);
  const stampBag = bag(n, o.stamps.length, mulberry32(o.seed ^ 0x5bd1e995));
  const colorBag = o.colors.length > 0 ? bag(n, o.colors.length, mulberry32(o.seed ^ 0x27d4eb2f)) : [];
  if (o.stamps.length >= 3) {
    // A swap with a later entry keeps the use counts.
    for (let i = 1; i < n; i++) {
      if (i % columns === 0 || stampBag[i] !== stampBag[i - 1]) continue;
      for (let j = i + 1; j < n; j++) {
        if (stampBag[j] !== stampBag[i - 1]) {
          [stampBag[i], stampBag[j]] = [stampBag[j] ?? 0, stampBag[i] ?? 0];
          break;
        }
      }
    }
  }
  const items: Item[] = [];
  for (let k = 0; k < n; k++) {
    const r = Math.floor(k / columns);
    const c = k % columns;
    // Fixed draw order, all drawn whatever the options are.
    const ux = rnd();
    const uy = rnd();
    const us = rnd();
    const ur = rnd();
    const uf = rnd();
    const s = o.stamps[stampBag[k] ?? 0] ?? o.stamps[0]!;
    const x = (c + 0.5) * cw + (o.stagger && r % 2 === 1 ? cw / 2 : 0) + o.jitter * (ux - 0.5) * cw;
    const y = (r + 0.5) * ch + o.jitter * (uy - 0.5) * ch;
    const rotate = o.rotate === 'quarter' ? Math.floor(ur * 4) * 90 : o.rotate === 'free' ? ur * 360 : 0;
    const color = o.colors[colorBag[k] ?? 0];
    items.push({
      id: o.firstId + k,
      stamp: s.index,
      x: wrap(x, o.width),
      y: wrap(y, o.height),
      scale: (o.size * Math.min(cw, ch) * (1 + o.sizeJitter * (us - 0.5))) / s.box,
      rotate,
      flip: o.flip && uf < 0.5,
      opacity: 1,
      colors: color === undefined ? [] : Array<string>(s.parts).fill(color),
    });
  }
  return items;
}
