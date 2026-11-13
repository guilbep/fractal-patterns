// Pipes, Basketwork and Garden paths: the Wang tiles of src/wang.ts as plain polylines, one long line = one polyline.
import { TILES, tileGeometry, wangLayout, type WangStyle } from '../wang.ts';
import type { Generator, Poly, Pt } from './util.ts';

export const PIPES_MAX_DEPTH = 5;
export const WEAVE_MAX_DEPTH = 5;
export const PATHS_MAX_DEPTH = 5;

const key = ([x, y]: Pt): string => `${Math.round(x * 1e3)},${Math.round(y * 1e3)}`;

// Greedy join on rounded end points, only where exactly two ends meet: a T-joint (three ends) stays a
// break, so a pipe never loops back through a border point and the tile edges keep one point per pipe.
function join(polys: Poly[]): Poly[] {
  const at = new Map<string, number[]>();
  polys.forEach((p, i) => {
    for (const e of [p[0]!, p[p.length - 1]!]) at.set(key(e), [...(at.get(key(e)) ?? []), i]);
  });
  const used = new Set<number>();
  // A free polyline with an end at pt, oriented to start there.
  const next = (pt: Pt): Poly | undefined => {
    const ends = at.get(key(pt))!;
    const i = ends.length === 2 ? ends.find((j) => !used.has(j)) : undefined;
    if (i === undefined) return undefined;
    used.add(i);
    const p = polys[i]!;
    return key(p[0]!) === key(pt) ? p : [...p].reverse();
  };
  const out: Poly[] = [];
  polys.forEach((p, i) => {
    if (used.has(i)) return;
    used.add(i);
    let line: Poly = [...p];
    const closed = () => line.length > 2 && key(line[0]!) === key(line[line.length - 1]!);
    for (let q = closed() ? undefined : next(line[line.length - 1]!); q; q = closed() ? undefined : next(line[line.length - 1]!))
      line.push(...q.slice(1));
    for (let q = closed() ? undefined : next(line[0]!); q; q = closed() ? undefined : next(line[0]!))
      line = [...q.slice(1).reverse(), ...line];
    if (closed()) line[line.length - 1] = line[0]!;
    out.push(line);
  });
  return out;
}

// One Wang style as a kind: depth sets the cells per side, density the share of edges coded 1.
const wang =
  (style: WangStyle, density: (rnd: () => number) => number, crossGap: boolean): Generator =>
  (rnd, depth, size) => {
    const n = 2 + 2 * depth;
    const cell = size / n;
    const seed = Math.floor(rnd() * 4294967296);
    const polys = wangLayout(n, seed, density(rnd)).flatMap((tile, i) => {
      const [x, y] = [(i % n) * cell, Math.floor(i / n) * cell];
      const variant = rnd() < 0.5 ? 1 : 0;
      return tileGeometry(style, TILES[tile]!, variant, cell, crossGap).map((p) => p.map(([px, py]): Pt => [x + px, y + py]));
    });
    return join(polys);
  };

export const pipes = wang('pipes', (rnd) => 0.4 + 0.25 * rnd(), false);
// Weave needs many crossings for the over and under gaps to show: 0.7.
export const weave = wang('weave', () => 0.7, true);
export const paths = wang('paths', () => 0.5, false);
