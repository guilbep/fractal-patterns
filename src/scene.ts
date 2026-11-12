// One scene model for a tile: ordered layers of polylines, each with a stroke or fill paint.
// Two renderers: sceneToSvg (string) and drawScene (canvas). Pure: no DOM access.
import type { Pt } from './patterns/util.ts';

export interface Paint {
  readonly mode: 'stroke' | 'fill';
  readonly color: string;
  readonly opacity: number;
  readonly width: number;
}
export interface SceneLayer {
  readonly polys: readonly (readonly Pt[])[];
  readonly paint: Paint;
}
// The tile is a rectangle; layers draw in order, the first at the bottom.
export interface Scene {
  readonly width: number;
  readonly height: number;
  readonly layers: readonly SceneLayer[];
}

function num(n: number, precision: number): string {
  let s = n.toFixed(precision);
  if (s.includes('.')) s = s.replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

// Relative path data from rounded absolute points: h/v for axis moves, z for closed polylines.
export function pathData(polys: readonly (readonly Pt[])[], precision: number): string {
  const f = 10 ** precision;
  const r = (v: number) => Math.round(v * f) / f;
  const cmd = (c: string, ...ns: number[]) =>
    ns.reduce((acc, n, i) => {
      const s = num(n, precision);
      return acc + (i > 0 && !s.startsWith('-') ? ' ' : '') + s;
    }, c);
  let d = '';
  for (const poly of polys) {
    const pts = poly.map(([x, y]) => [r(x), r(y)] as const);
    const [first] = pts;
    if (!first) continue;
    let seg = '';
    let [px, py] = first;
    for (const [x, y] of pts.slice(1)) {
      const dx = r(x - px);
      const dy = r(y - py);
      if (dx === 0 && dy === 0) continue;
      seg += dy === 0 ? cmd('h', dx) : dx === 0 ? cmd('v', dy) : cmd('l', dx, dy);
      px = x;
      py = y;
    }
    if (!seg) continue;
    const last = pts[pts.length - 1];
    if (pts.length > 3 && last && last[0] === first[0] && last[1] === first[1]) seg = seg.replace(/[hvl][^hvl]*$/, 'z');
    d += cmd('M', first[0], first[1]) + seg;
  }
  return d;
}

// Every sub-path closed: a fill needs a closed outline.
const closedPathData = (polys: readonly (readonly Pt[])[], precision: number): string =>
  polys
    .map((poly) => pathData([poly], precision))
    .map((d) => (d && !d.endsWith('z') ? d + 'z' : d))
    .join('');

export function sceneToSvg(scene: Scene, precision: number): string {
  const { width: w, height: h } = scene;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
  for (const { polys, paint } of scene.layers) {
    if (polys.length === 0) continue;
    out +=
      paint.mode === 'stroke'
        ? `<path d="${pathData(polys, precision)}" fill="none" stroke="${paint.color}" stroke-width="${paint.width}" stroke-opacity="${paint.opacity}" stroke-linecap="round"/>`
        : `<path d="${closedPathData(polys, precision)}" fill="${paint.color}" fill-opacity="${paint.opacity}" fill-rule="evenodd"/>`;
  }
  return out + '</svg>';
}

export function squareScene(
  polys: readonly (readonly Pt[])[],
  p: { readonly size: number; readonly strokeWidth: number; readonly color: string; readonly opacity: number },
): Scene {
  return {
    width: p.size,
    height: p.size,
    layers: [{ polys, paint: { mode: 'stroke', color: p.color, opacity: p.opacity, width: p.strokeWidth } }],
  };
}

// The subset of CanvasRenderingContext2D that drawScene uses.
export interface CanvasLike {
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  stroke(): void;
  fill(rule?: 'evenodd' | 'nonzero'): void;
  strokeStyle: string;
  fillStyle: string;
  lineWidth: number;
  lineCap: string;
  globalAlpha: number;
}

export function drawScene(ctx: CanvasLike, scene: Scene): void {
  for (const { polys, paint } of scene.layers) {
    if (polys.length === 0) continue;
    const fill = paint.mode === 'fill';
    if (fill) ctx.fillStyle = paint.color;
    else {
      ctx.strokeStyle = paint.color;
      ctx.lineWidth = paint.width;
      ctx.lineCap = 'round';
    }
    ctx.globalAlpha = paint.opacity;
    ctx.beginPath();
    for (const poly of polys) {
      const [first, ...rest] = poly;
      // ponytail: skips only polylines under 2 points; pathData also drops all-zero-length ones.
      if (!first || rest.length === 0) continue;
      ctx.moveTo(first[0], first[1]);
      for (const [x, y] of rest) ctx.lineTo(x, y);
      const last = rest[rest.length - 1];
      if (fill || (last && last[0] === first[0] && last[1] === first[1])) ctx.closePath();
    }
    if (fill) ctx.fill('evenodd');
    else ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
