// Accent shapes moved by hand (the Edit shapes overlay), and their link codec. Pure.
// A move is [dx, dy] in tile px for the shape at that index in the accentShapes list (stable for a layer and seed).
// Link value `am`: moves joined by `_`, each `index.dx.dy` with dx and dy in tenths of a px (integers, `-` allowed),
// e.g. `0.42.-10_5.0.30` moves shape 0 by (4.2, -1) and shape 5 by (0, 3). Empty when nothing moved.
import type { Poly, Pt } from './patterns/util.ts';

export type AccentMoves = ReadonlyMap<number, Pt>;

const MAX_MOVES = 1024; // ponytail: a cap against a hostile link; no layer draws more than 256 shapes
const tenths = (v: number) => Math.round(v * 10);

export function encodeMoves(moves: AccentMoves): string {
  return [...moves]
    .filter(([, [dx, dy]]) => tenths(dx) !== 0 || tenths(dy) !== 0)
    .sort(([a], [b]) => a - b)
    .map(([i, [dx, dy]]) => `${i}.${tenths(dx) + 0}.${tenths(dy) + 0}`)
    .join('_');
}

/** Bad parts are ignored; a repeated index keeps its first move. Indexes past the shape count are ignored by applyMoves. */
export function decodeMoves(s: string | null | undefined): Map<number, Pt> {
  const out = new Map<number, Pt>();
  for (const part of (s ?? '').split('_')) {
    const m = /^(\d{1,4})\.(-?\d{1,6})\.(-?\d{1,6})$/.exec(part);
    if (!m || out.size >= MAX_MOVES) continue;
    const i = Number(m[1]);
    const d: Pt = [Number(m[2]) / 10, Number(m[3]) / 10];
    if (!out.has(i) && (d[0] !== 0 || d[1] !== 0)) out.set(i, d);
  }
  return out;
}

/** The move clamped so the shape stays whole inside the tile: a shape cut by the edge would need a wrapped copy. */
export function clampMove(p: Poly, [dx, dy]: Pt, width: number, height: number): Pt {
  const xs = p.map((v) => v[0]);
  const ys = p.map((v) => v[1]);
  const c = (d: number, lo: number, hi: number, n: number) => Math.min(Math.max(d, Math.min(0, -lo)), Math.max(0, n - hi));
  return [c(dx, Math.min(...xs), Math.max(...xs), width), c(dy, Math.min(...ys), Math.max(...ys), height)];
}

/** Each moved shape translated by its (clamped) move; the others as they are. Same length and order as `polys`. */
export function applyMoves(polys: readonly Poly[], moves: AccentMoves, width: number, height: number): Poly[] {
  return polys.map((p, i) => {
    const m = moves.get(i);
    if (!m) return p;
    const [dx, dy] = clampMove(p, m, width, height);
    return dx === 0 && dy === 0 ? p : p.map(([x, y]): Pt => [x + dx, y + dy]);
  });
}
