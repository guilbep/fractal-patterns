// Seeded layered placement of motifs on a torus tile (wallpaper repeat with no seam).
// Large motifs first, then medium and small ones in the gaps, by best-candidate sampling.
import { mulberry32, TAU, type Pt } from '../patterns/util.ts';

export interface Placement {
  readonly motif: number;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly rotate: number;
  readonly flip: boolean;
}

export interface ScatterLayer {
  readonly motifs: readonly number[];
  readonly radius: number;
  readonly count: number;
  readonly scaleJitter: number;
  readonly rotate: 'free' | 'upright' | 'flow' | 'quarter';
  readonly flip: boolean;
}

const CANDIDATES = 12;
const RETRIES = 4;

// Shortest signed difference on a circle of length size.
const md = (d: number, size: number) => d - size * Math.round(d / size);

export function torusDistance(a: Pt, b: Pt, width: number, height: number): number {
  return Math.hypot(md(a[0] - b[0], width), md(a[1] - b[1], height));
}

// Three seeded plane waves with integer wave numbers: exactly periodic on the tile, in degrees.
export function flowAngle(x: number, y: number, width: number, height: number, seed: number): number {
  const rnd = mulberry32(seed ^ 0x5bd1e995);
  let a = rnd() * 360;
  for (let i = 0; i < 3; i++) {
    const kx = Math.floor(rnd() * 5) - 2;
    const ky = i === 0 && kx === 0 ? 1 : Math.floor(rnd() * 5) - 2;
    const amp = 25 + rnd() * 35;
    a += amp * Math.sin(TAU * ((kx * x) / width + (ky * y) / height) + rnd() * TAU);
  }
  return a;
}

interface Disc {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly layer: number;
  readonly motif: number;
}

export function scatter(layers: readonly ScatterLayer[], o: { width: number; height: number; seed: number; gap: number }): Placement[][] {
  const { width: w, height: h, gap } = o;
  const rnd = mulberry32(o.seed);
  const discs: Disc[] = [];
  return layers.map((layer, li) => {
    const out: Placement[] = [];
    const used = layer.motifs.map(() => 0);
    for (let n = 0; n < layer.count; n++) {
      const base = 1 + layer.scaleJitter * (2 * rnd() - 1);
      let best: { x: number; y: number; scale: number; nearest: number } | null = null;
      for (let t = 0; t <= RETRIES && !best; t++) {
        const scale = base * 0.9 ** t;
        const r = layer.radius * scale;
        let bestD = -Infinity;
        for (let k = 0; k < CANDIDATES; k++) {
          const p: Pt = [rnd() * w, rnd() * h];
          let ok = true;
          let nearest = Infinity;
          for (const d of discs) {
            const dist = torusDistance(p, [d.x, d.y], w, h);
            if (dist < r + d.r + gap) {
              ok = false;
              break;
            }
            nearest = Math.min(nearest, dist);
          }
          if (ok && nearest > bestD) {
            bestD = nearest;
            best = { x: p[0], y: p[1], scale, nearest };
          }
        }
      }
      // Draw the same number of values whether placed or not, so later layers stay stable.
      const rot = rnd();
      const fl = rnd();
      if (!best) continue;
      const { x, y, scale } = best;
      // Least used motifs only (keeps counts within 1); among them avoid the nearest same-layer motif.
      let near = -1;
      let nearD = Infinity;
      for (const d of discs) {
        if (d.layer !== li) continue;
        const dist = torusDistance([x, y], [d.x, d.y], w, h);
        if (dist < nearD) [nearD, near] = [dist, d.motif];
      }
      const min = Math.min(...used);
      const pool = layer.motifs.map((_, i) => i).filter((i) => used[i] === min);
      const pick = pool.find((i) => layer.motifs[i] !== near) ?? pool[0]!;
      used[pick]!++;
      const motif = layer.motifs[pick]!;
      const rotate =
        layer.rotate === 'free'
          ? rot * 360
          : layer.rotate === 'upright'
            ? (2 * rot - 1) * 15
            : layer.rotate === 'quarter'
              ? 90 * Math.floor(rot * 4)
              : flowAngle(x, y, w, h, o.seed);
      discs.push({ x, y, r: layer.radius * scale, layer: li, motif });
      out.push({ motif, x, y, scale, rotate, flip: layer.flip && fl < 0.5 });
    }
    return out;
  });
}

// Fraction of the tile under at least one bounding disc, sampled on a 64 x 64 grid.
export function coverage(placements: readonly Placement[][], layers: readonly ScatterLayer[], width: number, height: number): number {
  const discs = placements.flatMap((ps, li) => ps.map((p) => ({ p: [p.x, p.y] as Pt, r: layers[li]!.radius * p.scale })));
  let hit = 0;
  for (let i = 0; i < 64; i++) {
    for (let j = 0; j < 64; j++) {
      const q: Pt = [((i + 0.5) * width) / 64, ((j + 0.5) * height) / 64];
      if (discs.some((d) => torusDistance(q, d.p, width, height) < d.r)) hit++;
    }
  }
  return hit / 4096;
}

// Accidental stripes: fullest of 12 bins over the mean bin, for x (columns) and y (rows).
export function tracking(placements: readonly Placement[][], width: number, height: number): { rows: number; columns: number } {
  const all = placements.flat();
  const ratio = (vals: number[], size: number) => {
    const bins = Array.from({ length: 12 }, () => 0);
    for (const v of vals) bins[Math.min(11, Math.floor((v / size) * 12))]!++;
    return Math.max(...bins) / (vals.length / 12);
  };
  return {
    rows: ratio(
      all.map((p) => p.y),
      height,
    ),
    columns: ratio(
      all.map((p) => p.x),
      width,
    ),
  };
}
