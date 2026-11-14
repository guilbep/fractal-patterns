// Over-under interlace, loaded on demand with patterns/interlace.ts: the strands of a tile and the ribbons that replace
// its lines. state.ts keeps only the reactive glue, so the start JavaScript stays as it was.
import { crossings, interlace, ribbonsSvg, strands, type Crossing, type Strand } from '@/patterns/interlace.ts';
import { wrap, type Poly, type Pt } from '@/patterns/util.ts';

export type Weave = ReturnType<typeof findWeave>;

// The strands, their crossings and which passage goes over. A rectangular tile (aspect = width / height, e.g. 1 by
// sqrt(3)) is squeezed into the size by size square, where wrap() and the strands work, as in regions-tile.ts; the
// strands are stretched back and each crossing's place along its strand (an arc length) is measured again.
export function findWeave(polys: readonly (readonly Pt[])[], size: number, aspect = 1) {
  const squeezed = aspect === 1 ? (polys as Poly[]) : polys.map((p) => p.map(([x, y]): Pt => [x, y * aspect]));
  let list = strands(wrap(squeezed, size), size);
  let cs = crossings(list);
  const { overUnder, odd } = interlace(list, cs);
  if (aspect !== 1) {
    const at = list.map(stretch(aspect));
    list = at.map((a) => a.strand);
    const s = (p: Crossing['a']) => ({ strand: p.strand, s: at[p.strand]!.s(p.s) });
    cs = cs.map((c) => ({ ...c, a: s(c.a), b: s(c.b) }));
  }
  return { list, cs, overUnder, odd, size, height: size / aspect };
}

// A strand stretched back to the tile, with the arc length along it mapped from the square to the tile.
const stretch = (aspect: number) => (st: Strand) => {
  const sq = [0];
  const tr = [0];
  const pieces = st.pieces.map((p) => {
    const q = p.map(([x, y]): Pt => [x, y / aspect]);
    for (let i = 1; i < p.length; i++) {
      sq.push(sq.at(-1)! + Math.hypot(p[i]![0] - p[i - 1]![0], p[i]![1] - p[i - 1]![1]));
      tr.push(tr.at(-1)! + Math.hypot(q[i]![0] - q[i - 1]![0], q[i]![1] - q[i - 1]![1]));
    }
    return q;
  });
  const s = (v: number) => {
    let k = 0;
    while (k < sq.length - 2 && sq[k + 1]! < v) k++;
    const t = (v - sq[k]!) / (sq[k + 1]! - sq[k]! || 1);
    return tr[k]! + t * (tr[k + 1]! - tr[k]!);
  };
  return { strand: { ...st, pieces }, s };
};

// The ribbons as SVG for the inside of the tile: the outline in `stroke`, the ribbon in `fill`, all at `opacity` on one
// group (so a ribbon's outline does not show through its fill), with 8 copies around for seamless edges. `gap` is the
// space left on each side of the over ribbon. Strands that cannot alternate keep all their passages (no gaps).
// ponytail: the cut on the under strand is width + gap from the crossing. Clearing the over ribbon at angle t needs
// width / 2 * cot(t / 2): enough from 53 degrees at Gap 0 (44 at the defaults); per-crossing angles if a sharper
// pattern shows the under ribbon over the over one.
export function weaveSvg(w: Weave, o: { width: number; gap: number; fill: string; stroke: string; opacity: number }) {
  const odd = new Set(w.odd);
  const cs = w.cs.filter((c) => !odd.has((w.overUnder.get(c.id) === 'a' ? c.b : c.a).strand));
  const s = ribbonsSvg(w.list, cs, w.overUnder, { ...o, gap: o.width + o.gap, size: w.size });
  const g = s.slice(s.indexOf('<g'), s.lastIndexOf('</g>') + 4);
  const uses: string[] = [];
  for (const dx of [-w.size, 0, w.size])
    for (const dy of [-w.height, 0, w.height]) if (dx || dy) uses.push(`<use href="#il" transform="translate(${dx} ${+dy.toFixed(3)})"/>`);
  return `<g opacity="${o.opacity}">${g}${uses.join('')}</g>`;
}
