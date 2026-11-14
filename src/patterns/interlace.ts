// Interlace: join wrapped pieces into strands on the torus, find crossings,
// alternate over/under along each strand, draw ribbons with gaps at under-passages.
import type { Poly, Pt } from './util.ts';

// pieces: consecutive polylines of the strand; a jump between pieces is a tile-edge crossing.
export interface Strand {
  pieces: Poly[];
  closed: boolean;
}
export interface Passage {
  strand: number;
  s: number; // arc length along the strand
}
export interface Crossing {
  id: number;
  p: Pt;
  a: Passage;
  b: Passage;
}
export type OverUnder = Map<number, 'a' | 'b'>;

// Endpoints are matched modulo the tile (x = size is x = 0) on a 1e-3 grid.
function endKey([x, y]: Pt, size: number): string {
  const S = Math.round(size * 1e3);
  const q = (v: number) => ((Math.round(v * 1e3) % S) + S) % S;
  return `${q(x)},${q(y)}`;
}

export function strands(polys: Poly[], size: number): Strand[] {
  const pieces = polys.filter((p) => p.length >= 2);
  // End e = 2 * piece + (0 start | 1 end). Join only where exactly two ends meet:
  // ponytail: a junction of 3+ ends stays open; following straight through it is a later step.
  const byKey = new Map<string, number[]>();
  pieces.forEach((p, i) => {
    for (const [e, pt] of [
      [2 * i, p[0]!],
      [2 * i + 1, p[p.length - 1]!],
    ] as const) {
      const k = endKey(pt, size);
      byKey.set(k, [...(byKey.get(k) ?? []), e]);
    }
  });
  const partner = new Map<number, number>();
  for (const ends of byKey.values()) {
    if (ends.length !== 2) continue;
    partner.set(ends[0]!, ends[1]!);
    partner.set(ends[1]!, ends[0]!);
  }
  const seen = new Uint8Array(pieces.length);
  const out: Strand[] = [];
  // Walk from end e (we leave the piece through the end opposite to e).
  const walk = (start: number): Strand => {
    const chain: Poly[] = [];
    let e = start;
    let closed = false;
    for (;;) {
      const i = e >> 1;
      seen[i] = 1;
      const p = pieces[i]!;
      chain.push(e & 1 ? [...p].reverse() : p);
      const next = partner.get(e ^ 1);
      if (next === undefined) break;
      if (next >> 1 === start >> 1) {
        closed = true;
        break;
      }
      if (seen[next >> 1]) break;
      e = next;
    }
    return { pieces: chain, closed };
  };
  // Open chains first (from a free end), then the remaining closed loops.
  for (let i = 0; i < pieces.length; i++) {
    if (seen[i]) continue;
    if (!partner.has(2 * i)) out.push(walk(2 * i));
    else if (!partner.has(2 * i + 1)) out.push(walk(2 * i + 1));
  }
  for (let i = 0; i < pieces.length; i++) if (!seen[i]) out.push(walk(2 * i));
  return out;
}

interface Seg {
  strand: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  s: number; // arc length at a
}

function segments(list: Strand[]): Seg[] {
  const segs: Seg[] = [];
  list.forEach((st, strand) => {
    let s = 0;
    for (const p of st.pieces)
      for (let i = 1; i < p.length; i++) {
        const [ax, ay] = p[i - 1]!;
        const [bx, by] = p[i]!;
        segs.push({ strand, ax, ay, bx, by, s });
        s += Math.hypot(bx - ax, by - ay);
      }
  });
  return segs;
}

// Proper crossings only: both parameters strictly inside, so touching ends and shared vertices do not count.
// ponytail: a crossing exactly on a vertex or on the tile edge is missed; split segments there if it matters.
export function crossings(list: Strand[]): Crossing[] {
  const segs = segments(list).sort((u, v) => Math.min(u.ax, u.bx) - Math.min(v.ax, v.bx));
  const out: Crossing[] = [];
  const eps = 1e-9;
  // Sweep on x: only pairs whose x ranges overlap are tested.
  for (let i = 0; i < segs.length; i++) {
    const u = segs[i]!;
    const uMax = Math.max(u.ax, u.bx);
    const ux = u.bx - u.ax;
    const uy = u.by - u.ay;
    for (let j = i + 1; j < segs.length; j++) {
      const v = segs[j]!;
      if (Math.min(v.ax, v.bx) > uMax) break;
      const vx = v.bx - v.ax;
      const vy = v.by - v.ay;
      const den = ux * vy - uy * vx;
      if (Math.abs(den) < 1e-12) continue;
      const wx = v.ax - u.ax;
      const wy = v.ay - u.ay;
      const t = (wx * vy - wy * vx) / den;
      const w = (wx * uy - wy * ux) / den;
      if (t <= eps || t >= 1 - eps || w <= eps || w >= 1 - eps) continue;
      out.push({
        id: out.length,
        p: [u.ax + t * ux, u.ay + t * uy],
        a: { strand: u.strand, s: u.s + t * Math.hypot(ux, uy) },
        b: { strand: v.strand, s: v.s + w * Math.hypot(vx, vy) },
      });
    }
  }
  return out;
}

// Passages along each strand, in arc-length order: node = 2 * crossing + (0 a | 1 b).
function passagesByStrand(n: number, cs: Crossing[]): number[][] {
  const by: number[][] = Array.from({ length: n }, () => []);
  for (const c of cs) {
    by[c.a.strand]!.push(2 * c.id);
    by[c.b.strand]!.push(2 * c.id + 1);
  }
  const sOf = (node: number) => (node & 1 ? cs[node >> 1]!.b.s : cs[node >> 1]!.a.s);
  for (const l of by) l.sort((x, y) => sOf(x) - sOf(y));
  return by;
}

// 2-colouring (1 = over) of passages: a crossing's two passages differ, consecutive passages on a strand differ.
export function interlace(list: Strand[], cs: Crossing[]): { overUnder: OverUnder; odd: number[] } {
  const by = passagesByStrand(list.length, cs);
  const odd = new Set<number>();
  // A closed strand with an odd number of passages cannot alternate: skip alternation on it.
  by.forEach((l, i) => {
    if (list[i]!.closed && l.length % 2 === 1) odd.add(i);
  });
  const adj: [number, number][][] = Array.from({ length: 2 * cs.length }, () => []); // [node, strand | -1]
  for (let i = 0; i < cs.length; i++) {
    adj[2 * i]!.push([2 * i + 1, -1]);
    adj[2 * i + 1]!.push([2 * i, -1]);
  }
  by.forEach((l, st) => {
    if (odd.has(st)) return;
    const m = list[st]!.closed && l.length > 2 ? l.length : l.length - 1;
    for (let k = 0; k < m; k++) {
      const x = l[k]!;
      const y = l[(k + 1) % l.length]!;
      adj[x]!.push([y, st]);
      adj[y]!.push([x, st]);
    }
  });
  const colour = new Int8Array(2 * cs.length).fill(-1);
  for (let start = 0; start < colour.length; start++) {
    if (colour[start] !== -1) continue;
    colour[start] = 1;
    const queue = [start];
    while (queue.length) {
      const x = queue.pop()!;
      for (const [y, st] of adj[x]!) {
        if (colour[y] === -1) {
          colour[y] = 1 - colour[x]!;
          queue.push(y);
        } else if (colour[y] === colour[x] && st >= 0) odd.add(st);
      }
    }
  }
  const overUnder: OverUnder = new Map();
  for (const c of cs) overUnder.set(c.id, colour[2 * c.id] === 1 ? 'a' : 'b');
  return { overUnder, odd: [...odd].sort((x, y) => x - y) };
}

const r1 = (v: number) => String(Math.round(v * 10) / 10);

// Path data of a strand with the arc-length intervals in `cuts` removed; each piece starts a subpath.
function strandPath(st: Strand, rawCuts: [number, number][]): string {
  const out: string[] = [];
  let total = 0;
  for (const p of st.pieces) for (let i = 1; i < p.length; i++) total += Math.hypot(p[i]![0] - p[i - 1]![0], p[i]![1] - p[i - 1]![1]);
  // A gap that runs past the start of a closed strand continues at its end, and back.
  const cuts = st.closed
    ? rawCuts.flatMap(([a, b]): [number, number][] => [
        [a, b],
        [a - total, b - total],
        [a + total, b + total],
      ])
    : rawCuts;
  const inCut = (s: number) => cuts.some(([a, b]) => s > a && s < b);
  // Arc-length breakpoints where the pen goes up or down.
  const marks = cuts.flat();
  let s = 0;
  for (const p of st.pieces) {
    let pen = false;
    const at = (x: number, y: number) => {
      out.push(`${pen ? 'L' : 'M'}${r1(x)} ${r1(y)}`);
      pen = true;
    };
    if (!inCut(s)) at(p[0]![0], p[0]![1]);
    for (let i = 1; i < p.length; i++) {
      const [ax, ay] = p[i - 1]!;
      const [bx, by] = p[i]!;
      const len = Math.hypot(bx - ax, by - ay);
      const inside = marks.filter((m) => m > s && m < s + len).sort((x, y) => x - y);
      for (const m of inside) {
        const t = (m - s) / len;
        const x = ax + t * (bx - ax);
        const y = ay + t * (by - ay);
        if (inCut(m + 1e-9)) {
          if (pen) at(x, y);
          pen = false;
        } else if (!pen) at(x, y);
      }
      s += len;
      if (!inCut(s - 1e-9) && pen) at(bx, by);
    }
  }
  return out.join('');
}

export interface RibbonStyle {
  width: number;
  gap: number;
  size: number;
  fill: string;
  stroke: string;
}

// Two strokes per strand: outline (wide) then fill (narrow). 3x3 copies via <use> make the edges seamless.
export function ribbonsSvg(list: Strand[], cs: Crossing[], overUnder: OverUnder, o: RibbonStyle): string {
  const cuts: [number, number][][] = list.map(() => []);
  for (const c of cs) {
    const under = overUnder.get(c.id) === 'a' ? c.b : c.a;
    cuts[under.strand]!.push([under.s - o.gap, under.s + o.gap]);
  }
  const inner = Math.max(0, o.width - 2 * Math.max(1, o.width / 6));
  const body = list
    .map((st, i) => {
      const d = strandPath(st, cuts[i]!);
      if (!d) return '';
      return `<path d="${d}" stroke="${o.stroke}" stroke-width="${r1(o.width)}"/><path d="${d}" stroke="${o.fill}" stroke-width="${r1(inner)}"/>`;
    })
    .join('');
  const uses: string[] = [];
  for (const dx of [-o.size, 0, o.size])
    for (const dy of [-o.size, 0, o.size]) if (dx || dy) uses.push(`<use href="#il" transform="translate(${dx} ${dy})"/>`);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${o.size} ${o.size}">` +
    `<g id="il" fill="none" stroke-linecap="butt" stroke-linejoin="round">${body}</g>${uses.join('')}</svg>`
  );
}
