// The wallpaper studio model: a tile made of layers of placed motifs, with a
// classic repeat type, written as one compact SVG. Each motif is defined once
// in <defs> and drawn many times with <use>.
import { safePathData } from '../motifgrid.ts';

/** The path data cap of an even-odd (ink) motif: a detailed line drawing is long. Other motifs keep 20,000. */
export const INK_MAX_LENGTH = 60000;
const motifPath = (m: StudioMotif): string | null => safePathData(m.d, m.evenodd ? INK_MAX_LENGTH : undefined);

export interface StudioMotif {
  readonly d: string;
  readonly box: number;
  readonly paint: 'fill' | 'stroke';
  /** A fill motif with holes (an ink trace): written with fill-rule="evenodd", path data up to INK_MAX_LENGTH. */
  readonly evenodd?: boolean;
}

export interface Placement {
  readonly motif: number;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly rotate: number;
  readonly flip: boolean;
}

export interface StudioLayer {
  readonly color: string;
  readonly opacity: number;
  readonly strokeWidth: number;
  readonly placements: readonly Placement[];
}

export type Repeat = 'straight' | 'half-drop' | 'brick' | 'mirror';

export interface Studio {
  readonly width: number;
  readonly height: number;
  readonly background: string | null;
  readonly repeat: Repeat;
  readonly motifs: readonly StudioMotif[];
  readonly layers: readonly StudioLayer[];
  /**
   * The drawing order across the vertical seam. 'down': each row covers the row above, cyclically:
   * a wrap copy moved up one cell is drawn before every other instance, one moved down after them.
   * Missing or 'none': each placement is drawn with all its copies, in list order.
   */
  readonly overlap?: 'none' | 'down';
}

export interface Copy {
  readonly dx: number;
  readonly dy: number;
  readonly flipX: boolean;
  readonly flipY: boolean;
}

/** One drawn motif: anchor (x, y), then rotate (degrees), then scale (sx, sy), box centered. */
export interface Instance {
  readonly layer: number;
  readonly motif: number;
  readonly x: number;
  readonly y: number;
  readonly rotate: number;
  readonly sx: number;
  readonly sy: number;
}

/** The rectangular cell that repeats in a plain grid, and where the design goes in it. */
export function repeatCell(s: Studio): { width: number; height: number; copies: readonly Copy[] } {
  const w = s.width;
  const h = s.height;
  const c = (dx: number, dy: number, flipX = false, flipY = false): Copy => ({ dx, dy, flipX, flipY });
  switch (s.repeat) {
    case 'half-drop':
      return { width: 2 * w, height: h, copies: [c(0, 0), c(w, h / 2)] };
    case 'brick':
      return { width: w, height: 2 * h, copies: [c(0, 0), c(w / 2, h)] };
    case 'mirror':
      return { width: 2 * w, height: 2 * h, copies: [c(0, 0), c(w, 0, true), c(0, h, false, true), c(w, h, true, true)] };
    default:
      return { width: w, height: h, copies: [c(0, 0)] };
  }
}

/** Offsets (multiples of the cell) at which a motif must also be drawn so the cell repeats with no seam. */
export function wrapOffsets(
  p: { readonly x: number; readonly y: number },
  radius: number,
  cellWidth: number,
  cellHeight: number,
): readonly [number, number][] {
  const xs = [0];
  if (p.x - radius < 0) xs.push(cellWidth);
  if (p.x + radius > cellWidth) xs.push(-cellWidth);
  const ys = [0];
  if (p.y - radius < 0) ys.push(cellHeight);
  if (p.y + radius > cellHeight) ys.push(-cellHeight);
  return xs.flatMap((ox) => ys.map((oy): [number, number] => [ox, oy]));
}

const mod = (a: number, m: number): number => ((a % m) + m) % m;

/** Each instance with its pass: -1, 0 or 1 is the sign of its vertical wrap offset under overlap 'down', else 0. */
function passInstances(s: Studio): { i: Instance; pass: number }[] {
  const cell = repeatCell(s);
  const down = s.overlap === 'down';
  const out: { i: Instance; pass: number }[] = [];
  s.layers.forEach((layer, li) => {
    for (const p of layer.placements) {
      const m = s.motifs[p.motif];
      if (m === undefined || motifPath(m) === null) continue;
      if (![p.x, p.y, p.scale, p.rotate, m.box].every(Number.isFinite)) continue;
      const x = mod(p.x, s.width);
      const y = mod(p.y, s.height);
      const radius = (Math.abs(p.scale) * m.box * Math.SQRT2) / 2;
      for (const c of cell.copies) {
        const cx = mod(c.dx + (c.flipX ? s.width - x : x), cell.width);
        const cy = mod(c.dy + (c.flipY ? s.height - y : y), cell.height);
        for (const [ox, oy] of wrapOffsets({ x: cx, y: cy }, radius, cell.width, cell.height))
          out.push({
            pass: down ? Math.sign(oy) : 0,
            i: {
              layer: li,
              motif: p.motif,
              x: cx + ox,
              y: cy + oy,
              // A reflection before a rotation equals the opposite rotation before the reflection.
              rotate: c.flipX !== c.flipY ? -p.rotate : p.rotate,
              sx: p.scale * (p.flip !== c.flipX ? -1 : 1),
              sy: p.scale * (c.flipY ? -1 : 1),
            },
          });
      }
    }
  });
  // A stable sort: list order is kept inside each pass.
  return down ? out.sort((a, b) => a.pass - b.pass) : out;
}

/** Every drawn instance, in drawing order: placements x repeat copies x wrap offsets, by pass under overlap 'down'. */
export function studioInstances(s: Studio): Instance[] {
  return passInstances(s).map((p) => p.i);
}

/** The 2 x 3 matrix [a, b, c, d, e, f] of an instance's transform, for a motif box `box`. */
export function instanceMatrix(i: Instance, box: number): [number, number, number, number, number, number] {
  const t = (i.rotate * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const a = cos * i.sx;
  const b = sin * i.sx;
  const c = -sin * i.sy;
  const d = cos * i.sy;
  const h = -box / 2;
  return [a, b, c, d, i.x + a * h + c * h, i.y + b * h + d * h];
}

function num(n: number, precision: number): string {
  let s = n.toFixed(precision);
  if (s.includes('.')) s = s.replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

const safeColor = (c: string): string => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#000000');

function motifId(i: number): string {
  const letter = String.fromCharCode(97 + (i % 26));
  return i < 26 ? letter : `${letter}${Math.floor(i / 26) - 1}`;
}

function transform(i: Instance, box: number, precision: number): string {
  const f = (n: number): string => num(n, precision);
  const r = f(i.rotate % 360);
  const sx = f(i.sx);
  const sy = f(i.sy);
  const h = box / 2;
  if (r === '0' && sx === '1' && sy === '1') return `translate(${f(i.x - h)} ${f(i.y - h)})`;
  let t = `translate(${f(i.x)} ${f(i.y)})`;
  if (r !== '0') t += ` rotate(${r})`;
  if (sx !== '1' || sy !== '1') t += sx === sy ? ` scale(${sx})` : ` scale(${sx} ${sy})`;
  return `${t} translate(${f(-h)} ${f(-h)})`;
}

const VE = ' vector-effect="non-scaling-stroke"';
const EO = ' fill-rule="evenodd"';

function build(s: Studio, precision: number, expanded: boolean): { svg: string; instances: number } {
  const cell = repeatCell(s);
  const f = (n: number): string => num(n, precision);
  const w = f(cell.width);
  const h = f(cell.height);
  const safe = s.motifs.map(motifPath);
  const tagged = passInstances(s);
  const all = tagged.map((p) => p.i);
  const ids = new Map([...new Set(all.map((i) => i.motif))].sort((a, b) => a - b).map((m, k) => [m, motifId(k)]));
  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
  if (s.background !== null) out += `<path fill="${safeColor(s.background)}" d="M0 0h${w}v${h}H0z"/>`;
  if (!expanded && ids.size > 0) {
    out += '<defs>';
    // ponytail: vector-effect is not inherited, so stroke motifs carry it on their own path too.
    for (const [m, id] of ids)
      out += `<path id="${id}" d="${safe[m]}"${s.motifs[m]?.paint === 'stroke' ? VE : ''}${s.motifs[m]?.evenodd ? EO : ''}/>`;
    out += '</defs>';
  }
  // Layers group their instances, so each pass writes its own layer groups: a pass is above the one before in every layer.
  for (const pass of s.overlap === 'down' ? [-1, 0, 1] : [0])
    s.layers.forEach((layer, li) => {
      const color = safeColor(layer.color);
      const o = Math.min(1, Math.max(0, Number.isFinite(layer.opacity) ? layer.opacity : 1));
      for (const paint of ['fill', 'stroke'] as const) {
        const mine = tagged.filter((p) => p.pass === pass && p.i.layer === li && s.motifs[p.i.motif]?.paint === paint).map((p) => p.i);
        if (mine.length === 0) continue;
        const op = o === 1 ? '' : ` ${paint}-opacity="${f(o)}"`;
        const sw = Number.isFinite(layer.strokeWidth) ? Math.max(0, layer.strokeWidth) : 1;
        out +=
          paint === 'fill'
            ? `<g fill="${color}"${op}>`
            : `<g fill="none" stroke="${color}" stroke-width="${f(sw)}"${op} stroke-linecap="round" stroke-linejoin="round"${VE}>`;
        for (const i of mine) {
          const t = transform(i, s.motifs[i.motif]?.box ?? 0, precision);
          const ve = paint === 'stroke' ? VE : '';
          const eo = s.motifs[i.motif]?.evenodd ? EO : '';
          out += expanded
            ? `<path d="${safe[i.motif]}"${ve}${eo} transform="${t}"/>`
            : `<use href="#${ids.get(i.motif)}" transform="${t}"/>`;
        }
        out += '</g>';
      }
    });
  return { svg: `${out}</svg>`, instances: all.length };
}

export function studioSvg(s: Studio, precision = 1): string {
  return build(s, precision, false).svg;
}

/** Byte length with <use>, with every instance written out in full, and the number of drawn instances. */
export function studioBytes(s: Studio): { svg: number; expanded: number; instances: number } {
  const bytes = (t: string): number => new TextEncoder().encode(t).length;
  const b = build(s, 1, false);
  return { svg: bytes(b.svg), expanded: bytes(build(s, 1, true).svg), instances: b.instances };
}

/** The distinct layer colors in order: one printing plate each. */
export function layerColors(s: Studio): string[] {
  return [...new Set(s.layers.map((l) => safeColor(l.color)))];
}
