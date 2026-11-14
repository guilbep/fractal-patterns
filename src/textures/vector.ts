// Vector textures (terrazzo chips, stipple dots) as seamless SVG tiles.
import { mulberry32 } from '../patterns/util.ts';

export type VectorKind = 'terrazzo' | 'stipple';
export interface VectorOptions {
  size?: number;
  seed: number;
  scale: number;
  strength: number;
  background: string;
  colors: readonly string[];
}
export type Shape =
  | { kind: 'poly'; at: [number, number]; pts: [number, number][]; color: string; copy: boolean }
  | { kind: 'dot'; x: number; y: number; r: number; color: string; copy: boolean };
export interface VectorPlan {
  size: number;
  shapes: Shape[];
  // Toroidal minimum distance between the centres of original shapes.
  minDist: number;
  opacity: number;
}

const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? [...h].map((c) => c + c).join('') : h.slice(0, 6);
  const c = (i: number) => parseInt(f.slice(i, i + 2), 16) || 0;
  return [c(0), c(2), c(4)];
};
const luma = (hex: string): number => {
  const [r, g, b] = rgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const darken = (hex: string): string =>
  '#' +
  rgb(hex)
    .map((v) =>
      Math.round(v * 0.55)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');

function torusDist(ax: number, ay: number, bx: number, by: number, size: number): number {
  const dx = Math.min(Math.abs(ax - bx), size - Math.abs(ax - bx));
  const dy = Math.min(Math.abs(ay - by), size - Math.abs(ay - by));
  return Math.hypot(dx, dy);
}

// Dart throwing on the torus with integer centres, so the spacing holds after rounding.
// ponytail: O(n^2) per accepted dart, a grid lookup if counts grow past a few thousand.
function darts(rnd: () => number, size: number, target: number, minDist: number): [number, number][] {
  const out: [number, number][] = [];
  for (let tries = 0; out.length < target && tries < target * 30; tries++) {
    const x = Math.floor(rnd() * size);
    const y = Math.floor(rnd() * size);
    if (out.every(([px, py]) => torusDist(x, y, px, py, size) >= minDist)) out.push([x, y]);
  }
  return out;
}

// Copies of a shape shifted by ±size on each axis whose edge it crosses (both at a corner).
function wraps(minX: number, maxX: number, minY: number, maxY: number, size: number): [number, number][] {
  const sx = [0, minX < 0 ? size : maxX > size ? -size : 0];
  const sy = [0, minY < 0 ? size : maxY > size ? -size : 0];
  const out: [number, number][] = [];
  for (const dx of new Set(sx)) for (const dy of new Set(sy)) if (dx || dy) out.push([dx, dy]);
  return out;
}

export function vectorShapes(kind: VectorKind, o: VectorOptions): VectorPlan {
  const size = o.size ?? 241;
  const rnd = mulberry32(o.seed);
  const s = Math.min(2, Math.max(0.5, o.scale));
  const k = Math.min(100, Math.max(0, o.strength)) / 100;
  const bg = o.background.toLowerCase();
  const shapes: Shape[] = [];
  if (kind === 'terrazzo') {
    const r = 9 * s;
    // Radii jitter up to 1.3 r, so 2.8 r keeps chips apart.
    const minDist = Math.ceil(2.8 * r);
    const pal = o.colors.filter((c) => c.toLowerCase() !== bg);
    const colors = pal.length ? pal : [darken(o.background)];
    const centres = darts(rnd, size, Math.round((k * 0.55 * (size * size)) / (minDist * minDist)), minDist);
    centres.forEach(([cx, cy], i) => {
      const n = 5 + Math.floor(rnd() * 4);
      const rot = rnd() * Math.PI * 2;
      const pts = Array.from({ length: n }, (_, j): [number, number] => {
        const a = rot + ((j + (rnd() - 0.5) * 0.5) / n) * Math.PI * 2;
        const rr = r * (0.6 + rnd() * 0.7);
        return [Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr)];
      });
      const color = colors[i % colors.length] ?? '';
      shapes.push({ kind: 'poly', at: [cx, cy], pts, color, copy: false });
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      for (const [dx, dy] of wraps(Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), size))
        shapes.push({ kind: 'poly', at: [cx + dx, cy + dy], pts: pts.map(([x, y]) => [x + dx, y + dy]), color, copy: true });
    });
    return { size, shapes, minDist, opacity: 0.35 + 0.65 * k };
  }
  const r = Math.max(1, Math.round(1.2 * s));
  const minDist = 3 * r + 2;
  const color = o.colors.length ? o.colors.reduce((a, b) => (luma(b) < luma(a) ? b : a)) : darken(o.background);
  const centres = darts(rnd, size, Math.round((k * 0.6 * (size * size)) / (minDist * minDist)), minDist);
  for (const [x, y] of centres) {
    shapes.push({ kind: 'dot', x, y, r, color, copy: false });
    for (const [dx, dy] of wraps(x - r, x + r, y - r, y + r, size))
      shapes.push({ kind: 'dot', x: x + dx, y: y + dy, r, color, copy: true });
  }
  return { size, shapes, minDist, opacity: 1 };
}

export function vectorTexture(kind: VectorKind, o: VectorOptions): { svg: string; shapes: number } {
  const { size, shapes, opacity } = vectorShapes(kind, o);
  // Group by colour: one path per colour, one subpath per shape.
  const groups = new Map<string, string[]>();
  for (const sh of shapes) {
    const d =
      sh.kind === 'poly'
        ? `M${sh.pts.map(([x, y]) => `${x} ${y}`).join('L')}Z`
        : // Zero-length subpath + round cap draws a dot, far fewer bytes than circles or arcs.
          `M${sh.x} ${sh.y}h0`;
    const g = groups.get(sh.color) ?? [];
    g.push(d);
    groups.set(sh.color, g);
  }
  const op = opacity < 1 ? ` fill-opacity="${opacity.toFixed(2)}"` : '';
  const dotR = shapes[0]?.kind === 'dot' ? shapes[0].r : 0;
  const paths = [...groups]
    .map(([c, ds]) =>
      kind === 'terrazzo'
        ? `<path fill="${c}"${op} d="${ds.join('')}"/>`
        : `<path stroke="${c}" stroke-width="${2 * dotR}" stroke-linecap="round" d="${ds.join('')}"/>`,
    )
    .join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">` +
    `<rect width="${size}" height="${size}" fill="${o.background}"/>${paths}</svg>`;
  return { svg, shapes: shapes.length };
}
