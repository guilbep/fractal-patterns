// Reads a person's own SVG file as vector shapes for the wallpaper studio.
// The file is untrusted: no markup passes through. A small tolerant tokenizer
// (no DOM) reads tags and attributes; only numbers and colors are kept, and
// every output path is rebuilt from those numbers.
import { safePathData } from '../motifgrid.ts';

export interface ImportedShape {
  readonly color: string;
  readonly d: string;
  readonly paint: 'fill' | 'stroke';
  readonly width: number;
}

export interface SvgImport {
  readonly shapes: ImportedShape[];
  readonly box: number;
  readonly skipped: readonly string[];
  readonly exact: boolean;
}

type Attrs = Record<string, string>;
type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
interface Seg {
  readonly c: string;
  readonly v: number[];
}

const BOX = 100;
const MARGIN = 2;

const KEYWORDS: Record<string, string> = {
  black: '#000000',
  silver: '#c0c0c0',
  gray: '#808080',
  white: '#ffffff',
  maroon: '#800000',
  red: '#ff0000',
  purple: '#800080',
  fuchsia: '#ff00ff',
  green: '#008000',
  lime: '#00ff00',
  olive: '#808000',
  yellow: '#ffff00',
  navy: '#000080',
  blue: '#0000ff',
  teal: '#008080',
  aqua: '#00ffff',
  orange: '#ffa500',
};

/** A paint value: a `#rrggbb` color, 'none', 'url' (gradient or pattern), or 'unknown'. Unknown and url paints are drawn black by the caller. */
export function parseColor(v: string): string {
  const s = v.trim().toLowerCase();
  if (s === 'none' || s === 'transparent') return 'none';
  if (s === 'currentcolor') return '#000000';
  if (s.startsWith('url(')) return 'url';
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  const m = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/.exec(s);
  if (m) {
    const c = [m[1], m[2], m[3]].map(Number);
    if (c.every((n) => n <= 255)) return `#${c.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
  }
  return KEYWORDS[s] ?? 'unknown';
}

/** A plain number, with no unit or `px`; NaN otherwise. A missing attribute is `fallback`. */
function plainNum(v: string | undefined, fallback = 0): number {
  if (v === undefined) return fallback;
  return /^\s*[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?(?:px)?\s*$/i.test(v) ? parseFloat(v) : NaN;
}

const r2 = (n: number): number => {
  const v = Math.round(n * 100) / 100;
  return v === 0 ? 0 : v;
};
const fmt = (ns: readonly number[]): string => ns.map((n) => String(r2(n))).join(' ');

const ARITY: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

/** Path data as one segment per command, implicit repeats split out (repeats after M become L). Null when malformed. */
function parsePath(d: string): Seg[] | null {
  const segs: Seg[] = [];
  let i = 0;
  let cmd = '';
  const ws = () => {
    while (i < d.length && /[\s,]/.test(d[i]!)) i++;
  };
  const num = (): number | null => {
    ws();
    const m = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(d.slice(i, i + 40));
    if (!m) return null;
    i += m[0].length;
    return Number(m[0]);
  };
  const flag = (): number | null => {
    ws();
    const ch = d[i];
    if (ch !== '0' && ch !== '1') return null;
    i++;
    return Number(ch);
  };
  for (;;) {
    ws();
    if (i >= d.length) break;
    const ch = d[i]!;
    if (/[A-Za-z]/.test(ch)) {
      if (!(ch.toLowerCase() in ARITY)) return null;
      cmd = ch;
      i++;
      if (cmd === 'z' || cmd === 'Z') {
        segs.push({ c: cmd, v: [] });
        cmd = '';
        continue;
      }
    } else if (!cmd) return null;
    const lo = cmd.toLowerCase();
    const v: number[] = [];
    for (let k = 0; k < ARITY[lo]!; k++) {
      const n = lo === 'a' && (k === 3 || k === 4) ? flag() : num();
      if (n === null) return null;
      v.push(n);
    }
    segs.push({ c: cmd, v });
    if (lo === 'm') cmd = cmd === 'm' ? 'l' : 'L';
  }
  return segs.length > 0 && (segs[0]!.c === 'M' || segs[0]!.c === 'm') ? segs : null;
}

/** Walks the segments in absolute coordinates; `visit` gets each segment, its absolute points, and the pen before it. */
function walk(segs: readonly Seg[], visit: (s: Seg, pts: number[], x0: number, y0: number) => void): void {
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  for (const s of segs) {
    const lo = s.c.toLowerCase();
    const rel = s.c === lo;
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    let pts: number[];
    if (lo === 'z') pts = [sx, sy];
    else if (lo === 'h') pts = [s.v[0]! + ox, y];
    else if (lo === 'v') pts = [x, s.v[0]! + oy];
    else if (lo === 'a') pts = [s.v[5]! + ox, s.v[6]! + oy];
    else pts = s.v.map((n, k) => n + (k % 2 ? oy : ox));
    visit(s, pts, x, y);
    x = pts[pts.length - 2]!;
    y = pts[pts.length - 1]!;
    if (lo === 'm') [sx, sy] = [x, y];
  }
}

const TAU = 2 * Math.PI;

/** The extreme points of an SVG arc from (x1, y1): its ends plus every axis-aligned extreme inside the sweep (SVG spec F.6.5). */
function arcPoints(x1: number, y1: number, v: readonly number[], x2: number, y2: number): number[] {
  let rx = Math.abs(v[0]!);
  let ry = Math.abs(v[1]!);
  if (!rx || !ry || (x1 === x2 && y1 === y2)) return [x2, y2];
  const phi = (v[2]! * Math.PI) / 180;
  const [co, si] = [Math.cos(phi), Math.sin(phi)];
  const xp = (co * (x1 - x2)) / 2 + (si * (y1 - y2)) / 2;
  const yp = (-si * (x1 - x2)) / 2 + (co * (y1 - y2)) / 2;
  const lam = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
  if (lam > 1) [rx, ry] = [rx * Math.sqrt(lam), ry * Math.sqrt(lam)];
  const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
  const sq = Math.sqrt(Math.max(0, num / (rx * rx * yp * yp + ry * ry * xp * xp))) * (v[3] === v[4] ? -1 : 1);
  const cxp = (sq * rx * yp) / ry;
  const cyp = (-sq * ry * xp) / rx;
  const cx = co * cxp - si * cyp + (x1 + x2) / 2;
  const cy = si * cxp + co * cyp + (y1 + y2) / 2;
  const t1 = Math.atan2((yp - cyp) / ry, (xp - cxp) / rx);
  let dt = Math.atan2((-yp - cyp) / ry, (-xp - cxp) / rx) - t1;
  if (v[4] && dt < 0) dt += TAU;
  if (!v[4] && dt > 0) dt -= TAU;
  const out = [x2, y2];
  const tx = Math.atan2(-ry * si, rx * co);
  const ty = Math.atan2(ry * co, rx * si);
  for (const t of [tx, tx + Math.PI, ty, ty + Math.PI]) {
    const along = (((dt >= 0 ? t - t1 : t1 - t) % TAU) + TAU) % TAU;
    if (along <= Math.abs(dt))
      out.push(cx + rx * co * Math.cos(t) - ry * si * Math.sin(t), cy + rx * si * Math.cos(t) + ry * co * Math.sin(t));
  }
  return out;
}

/** Bounds of path data: every end and control point (an over-estimate for curves), arcs through their true extremes. */
export function pathBounds(d: string): Bounds | null {
  const segs = parsePath(d);
  if (!segs) return null;
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  walk(segs, (s, pts, x0, y0) => {
    const p = s.c.toLowerCase() === 'a' ? arcPoints(x0, y0, s.v, pts[0]!, pts[1]!) : pts;
    for (let k = 0; k + 1 < p.length; k += 2) {
      b.minX = Math.min(b.minX, p[k]!);
      b.maxX = Math.max(b.maxX, p[k]!);
      b.minY = Math.min(b.minY, p[k + 1]!);
      b.maxY = Math.max(b.maxY, p[k + 1]!);
    }
  });
  return Number.isFinite(b.minX) ? b : null;
}

/**
 * Path data under x -> x * s + tx, y -> y * s + ty, every command kept in its own case.
 * Relative values are written as differences of rounded absolute points, so rounding never drifts.
 */
export function transformPath(d: string, s: number, tx: number, ty: number): string | null {
  const segs = parsePath(d);
  if (!segs) return null;
  let out = '';
  let cx = 0;
  let cy = 0;
  let mx = 0;
  let my = 0;
  walk(segs, (seg, pts) => {
    const lo = seg.c.toLowerCase();
    const rel = seg.c === lo;
    const P = pts.map((n, k) => r2(n * s + (k % 2 ? ty : tx)));
    const R = rel ? P.map((n, k) => n - (k % 2 ? cy : cx)) : P;
    let args: number[];
    if (lo === 'z') args = [];
    else if (lo === 'h') args = [R[0]!];
    else if (lo === 'v') args = [R[1]!];
    else if (lo === 'a') args = [seg.v[0]! * s, seg.v[1]! * s, seg.v[2]!, seg.v[3]!, seg.v[4]!, R[0]!, R[1]!];
    else args = R;
    out += seg.c + fmt(args);
    [cx, cy] = [P[P.length - 2]!, P[P.length - 1]!];
    if (lo === 'm') [mx, my] = [cx, cy];
    if (lo === 'z') [cx, cy] = [mx, my];
  });
  return safePathData(out);
}

/** Path data for a basic shape (rect, circle, ellipse, line, polyline, polygon); null when an attribute is not a plain number or the shape is empty. */
export function basicShapePath(tag: string, a: Attrs): string | null {
  const n = (k: string, f = 0) => plainNum(a[k], f);
  const ok = (...v: number[]) => v.every(Number.isFinite);
  switch (tag) {
    case 'rect': {
      const [x, y, w, h] = [n('x'), n('y'), n('width'), n('height')];
      let rx = plainNum(a['rx'], NaN);
      let ry = plainNum(a['ry'], NaN);
      if ((a['rx'] !== undefined && Number.isNaN(rx)) || (a['ry'] !== undefined && Number.isNaN(ry))) return null;
      if (!ok(x, y, w, h) || w <= 0 || h <= 0) return null;
      if (Number.isNaN(rx)) rx = Number.isNaN(ry) ? 0 : ry;
      if (Number.isNaN(ry)) ry = rx;
      rx = Math.min(Math.max(rx, 0), w / 2);
      ry = Math.min(Math.max(ry, 0), h / 2);
      if (rx === 0 || ry === 0) return `M${fmt([x, y])}H${fmt([x + w])}V${fmt([y + h])}H${fmt([x])}Z`;
      const arc = (ex: number, ey: number) => `A${fmt([rx, ry, 0, 0, 1, ex, ey])}`;
      return (
        `M${fmt([x + rx, y])}H${fmt([x + w - rx])}${arc(x + w, y + ry)}V${fmt([y + h - ry])}${arc(x + w - rx, y + h)}` +
        `H${fmt([x + rx])}${arc(x, y + h - ry)}V${fmt([y + ry])}${arc(x + rx, y)}Z`
      );
    }
    case 'circle':
    case 'ellipse': {
      const [cx, cy] = [n('cx'), n('cy')];
      const rx = tag === 'circle' ? n('r') : n('rx');
      const ry = tag === 'circle' ? rx : n('ry');
      if (!ok(cx, cy, rx, ry) || rx <= 0 || ry <= 0) return null;
      return `M${fmt([cx - rx, cy])}A${fmt([rx, ry, 0, 1, 0, cx + rx, cy])}A${fmt([rx, ry, 0, 1, 0, cx - rx, cy])}Z`;
    }
    case 'line': {
      const v = [n('x1'), n('y1'), n('x2'), n('y2')];
      return ok(...v) ? `M${fmt(v.slice(0, 2))}L${fmt(v.slice(2))}` : null;
    }
    case 'polyline':
    case 'polygon': {
      const raw = (a['points'] ?? '').trim();
      if (!/^[-+0-9.eE,\s]*$/.test(raw)) return null;
      const v = raw
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number);
      if (v.length % 2) v.pop();
      if (v.length < 4 || !ok(...v)) return null;
      return `M${fmt(v.slice(0, 2))}L${fmt(v.slice(2))}${tag === 'polygon' ? 'Z' : ''}`;
    }
  }
  return null;
}

// Elements whose content is never read; each one is counted.
const ZONES: Record<string, string> = {
  defs: 'defs block{s}',
  symbol: 'symbol{s}',
  clippath: 'clip path{s}',
  mask: 'mask{s}',
  filter: 'filter{s}',
  pattern: 'pattern definition{s}',
  lineargradient: 'gradient definition{s}',
  radialgradient: 'gradient definition{s}',
  marker: 'marker{s}',
  text: 'text element{s}',
  foreignobject: 'foreign object{s}',
  script: 'script{s}',
  style: 'style block{s} (CSS classes are not read)',
  svg: 'nested svg element{s}',
  switch: 'switch element{s}',
};
const QUIET = new Set(['title', 'desc', 'metadata']);
const LONE: Record<string, string> = { use: 'use element{s}', image: 'image{s}' };
const SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);

interface Frame {
  readonly name: string;
  readonly fill: string | undefined;
  readonly stroke: string | undefined;
  readonly width: string | undefined;
  readonly transform: boolean;
  readonly zone: boolean;
}

function readAttrs(s: string): Attrs {
  const a: Attrs = {};
  for (const m of s.matchAll(/([^\s=/"']+)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    const k = m[1]!.toLowerCase();
    if (!(k in a)) a[k] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return a;
}

/** fill, stroke and stroke-width from a `style` attribute; other properties are ignored. */
function readStyle(s: string | undefined): Attrs {
  const a: Attrs = {};
  for (const part of (s ?? '').split(';')) {
    const k = part.slice(0, part.indexOf(':')).trim().toLowerCase();
    if (part.includes(':') && (k === 'fill' || k === 'stroke' || k === 'stroke-width')) a[k] = part.slice(part.indexOf(':') + 1).trim();
  }
  return a;
}

/**
 * Reads the shapes of an SVG file, fitted into one 100 x 100 box (uniform scale, centered).
 * Null when the text is not an SVG, is longer than `maxLength`, holds an entity declaration, or has no usable shape.
 * Gradient, pattern and unknown paints are drawn black and noted in `skipped`.
 */
export function importSvg(text: string, o: { maxShapes?: number; maxLength?: number } = {}): SvgImport | null {
  const maxShapes = o.maxShapes ?? 40;
  if (text.length > (o.maxLength ?? 300_000) || text.includes('<!ENTITY')) return null;
  const counts = new Map<string, number>();
  const note = (label: string, k = 1) => counts.set(label, (counts.get(label) ?? 0) + k);
  const raw: { color: string; d: string; paint: 'fill' | 'stroke'; width: number; rect?: Attrs }[] = [];
  const stack: Frame[] = [];
  let root: Attrs | null = null;
  let over = 0;
  const tags = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[!?][^>]*>|<(\/?)([A-Za-z][\w:.-]*)((?:[^<>"']|"[^"<]*"|'[^'<]*')*)>/g;
  for (const m of text.matchAll(tags)) {
    if (m[2] === undefined) continue;
    const name = m[2].toLowerCase();
    if (m[1]) {
      const at = stack.findLastIndex((f) => f.name === name);
      if (at >= 0) stack.length = at;
      continue;
    }
    const body = m[3] ?? '';
    const selfClosing = body.endsWith('/');
    const a = readAttrs(selfClosing ? body.slice(0, -1) : body);
    const top = stack.at(-1);
    if (!root) {
      if (name !== 'svg') continue;
      root = a;
      if (!selfClosing) stack.push({ name, fill: undefined, stroke: undefined, width: undefined, transform: false, zone: false });
      continue;
    }
    if (top?.zone) {
      if (!selfClosing) stack.push({ ...top, name });
      continue;
    }
    for (const k of Object.keys(a)) {
      if (k.startsWith('on')) note('event handler attribute{s} (ignored)');
      if (k === 'href' || k.endsWith(':href')) note('link{s} (href, ignored)');
    }
    for (const k of ['opacity', 'fill-opacity', 'stroke-opacity'])
      if (a[k] !== undefined && plainNum(a[k], 1) < 1) counts.set('opacity (ignored)', 1);
    const st = readStyle(a['style']);
    const fill = st['fill'] ?? a['fill'] ?? top?.fill;
    const stroke = st['stroke'] ?? a['stroke'] ?? top?.stroke;
    const width = st['stroke-width'] ?? a['stroke-width'] ?? top?.width;
    const transform = a['transform'] !== undefined || (top?.transform ?? false);
    const zone = ZONES[name];
    if (zone || QUIET.has(name)) {
      if (zone) note(zone);
      if (!selfClosing) stack.push({ name, fill, stroke, width, transform, zone: true });
      continue;
    }
    if (LONE[name]) {
      note(LONE[name]);
      continue;
    }
    if (!SHAPES.has(name)) {
      if (!selfClosing) stack.push({ name, fill, stroke, width, transform, zone: false });
      continue;
    }
    if (!selfClosing) stack.push({ name, fill, stroke, width, transform, zone: true }); // a shape's children are not shapes
    if (transform) {
      note('element{s} with a transform');
      continue;
    }
    const d = name === 'path' ? safePathData((a['d'] ?? '').replace(/\s+/g, ' ')) : basicShapePath(name, a);
    if (!d || !parsePath(d)) {
      note(name === 'path' ? 'path{s} with unsafe or too long data' : 'shape{s} with units, percentages or no size');
      continue;
    }
    const paint = (v: string | undefined, dflt: string): string => {
      const c = parseColor(v === undefined || v.trim() === 'inherit' ? dflt : v);
      if (c === 'url') note('gradient or pattern paint{s} drawn black');
      if (c === 'unknown') note('unknown color{s} drawn black');
      return c === 'url' || c === 'unknown' ? '#000000' : c;
    };
    const f = name === 'line' ? 'none' : paint(fill, 'black');
    const s = paint(stroke, 'none');
    const w = plainNum(width, 1);
    const found: typeof raw = [];
    if (f !== 'none') found.push({ color: f, d, paint: 'fill', width: 0, ...(name === 'rect' ? { rect: a } : {}) });
    if (s !== 'none') found.push({ color: s, d, paint: 'stroke', width: Number.isFinite(w) && w > 0 ? w : 1 });
    if (found.length === 0) note('element{s} with no fill and no stroke');
    for (const sh of found) {
      if (raw.length < maxShapes) raw.push(sh);
      else over++;
    }
  }
  if (!root) return null;
  if (over) note('shape{s} over the limit', over);
  // A plain rectangle covering the whole frame is a background: drop it.
  const vb = (root['viewbox'] ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const frame = vb.length === 4 && vb.every(Number.isFinite) ? vb : [0, 0, plainNum(root['width'], NaN), plainNum(root['height'], NaN)];
  const first = raw[0];
  if (first?.rect && frame.every(Number.isFinite) && !first.rect['rx'] && !first.rect['ry']) {
    const [x, y, w, h] = ['x', 'y', 'width', 'height'].map((k) => plainNum(first.rect![k]));
    if (x! <= frame[0]! && y! <= frame[1]! && x! + w! >= frame[0]! + frame[2]! && y! + h! >= frame[1]! + frame[3]!) {
      raw.shift();
      counts.set('a full-frame background rectangle', 1);
    }
  }
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const sh of raw) {
    const s = pathBounds(sh.d)!;
    b.minX = Math.min(b.minX, s.minX);
    b.minY = Math.min(b.minY, s.minY);
    b.maxX = Math.max(b.maxX, s.maxX);
    b.maxY = Math.max(b.maxY, s.maxY);
  }
  const edge = Math.max(b.maxX - b.minX, b.maxY - b.minY);
  if (raw.length === 0 || !(edge > 0) || !Number.isFinite(edge)) return null;
  const k = (BOX - 2 * MARGIN) / edge;
  const tx = BOX / 2 - (k * (b.minX + b.maxX)) / 2;
  const ty = BOX / 2 - (k * (b.minY + b.maxY)) / 2;
  const shapes: ImportedShape[] = [];
  for (const sh of raw) {
    const d = transformPath(sh.d, k, tx, ty);
    if (d) shapes.push({ color: sh.color, d, paint: sh.paint, width: r2(sh.width * k) });
    else note('path{s} too long after the fit');
  }
  if (shapes.length === 0) return null;
  const skipped = [...counts].map(([label, n]) => (label.includes('{s}') ? `${n} ${label.replace('{s}', n === 1 ? '' : 's')}` : label));
  return { shapes, box: BOX, skipped, exact: skipped.length === 0 };
}

/** The tracer's result shape: fill shapes only, in order, area from the bounds, white background. */
export function toTraceResult(i: SvgImport): { shapes: { color: string; d: string; area: number }[]; background: string; box: number } {
  const shapes = i.shapes
    .filter((s) => s.paint === 'fill')
    .map((s) => {
      const b = pathBounds(s.d)!;
      return { color: s.color, d: s.d, area: r2((b.maxX - b.minX) * (b.maxY - b.minY)) };
    });
  return { shapes, background: '#ffffff', box: i.box };
}

export const strokeShapes = (i: SvgImport): ImportedShape[] => i.shapes.filter((s) => s.paint === 'stroke');
