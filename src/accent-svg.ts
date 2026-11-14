// The accent layer as SVG: each distinct tile shape written once in <defs>, each copy a <use> of it, unless the copy
// written inline is shorter (a triangle or a square): those copies join one shared <path>. Pure.
// A unit is a tile shape moved so its pivot (accent-vary.ts) is at 0, 0; tile shapes equal up to a translation, at
// the output precision, share one unit. Filled non-zero on the parent group: overlapping shapes join, a ring's
// reversed inner loop stays a hole.
import { pivot, type AccentPlace } from './accent-vary.ts';
import type { Poly, Pt } from './patterns/util.ts';
import { closedPathData, num } from './scene.ts';

// ponytail: the prefix keeps clear of the base layer's ids (single letters, or a letter and a number in motifgrid.ts).
const ID = 'ac';

export function accentSvg(
  shapes: readonly Poly[],
  places: readonly AccentPlace[] | undefined, // absent: each tile shape once, where it is
  width: number,
  height: number,
  color: string,
  precision: number,
): string {
  const centers = shapes.map(pivot);
  const unitOf = new Map<string, number>(); // path data -> unit index
  // Digits for a turn and a scale: enough that the farthest vertex moves under the output precision.
  const digits = shapes.map((p, i) => {
    const r = Math.max(1e-9, ...p.map(([x, y]) => Math.hypot(x - centers[i]!.x, y - centers[i]!.y)));
    return {
      turn: Math.max(0, precision + Math.ceil(Math.log10((r * Math.PI) / 180))),
      scale: Math.max(0, precision + Math.ceil(Math.log10(r))),
    };
  });
  const shapeUnit = shapes.map((p, i) => {
    const d = closedPathData([p.map(([x, y]): Pt => [x - centers[i]!.x, y - centers[i]!.y])], precision);
    if (!unitOf.has(d)) unitOf.set(d, unitOf.size);
    return unitOf.get(d)!;
  });
  const all = places ?? shapes.map((_, i) => ({ shape: i, ...centers[i]!, rotate: 0, scale: 1 }));
  let inline = '';
  const uses: string[] = [];
  const used = new Set<number>(); // units with a <use> left
  for (const { shape, x, y, rotate, scale } of all) {
    const deg = num((rotate * 180) / Math.PI, digits[shape]!.turn);
    const k = num(scale, digits[shape]!.scale);
    const t = `translate(${num(x, precision)} ${num(y, precision)})${deg === '0' ? '' : ` rotate(${deg})`}${k === '1' ? '' : ` scale(${k})`}`;
    const use = `<use href="#${ID}${shapeUnit[shape]}" transform="${t}"/>`;
    // The same placement as accent-vary.ts: turned and scaled about the pivot, then moved to x, y.
    const { x: cx, y: cy } = centers[shape]!;
    const cos = Math.cos(rotate) * scale;
    const sin = Math.sin(rotate) * scale;
    const poly = shapes[shape]!.map(([px, py]): Pt => [x + (px - cx) * cos - (py - cy) * sin, y + (px - cx) * sin + (py - cy) * cos]);
    const d = closedPathData([poly], precision);
    if (d.length < use.length) inline += d;
    else {
      uses.push(use);
      used.add(shapeUnit[shape]!);
    }
  }
  const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  if (!inline && uses.length === 0) return head + '</svg>';
  const defs = [...unitOf].filter(([, u]) => used.has(u)).map(([d, u]) => `<path id="${ID}${u}" d="${d}"/>`);
  return `${head}${defs.length ? `<defs>${defs.join('')}</defs>` : ''}<g fill="${color}" fill-rule="nonzero">${inline ? `<path d="${inline}"/>` : ''}${uses.join('')}</g></svg>`;
}
