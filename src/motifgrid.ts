// A motif grid: a square tile made of a grid of small motifs. Each motif is
// defined once in <defs> and placed many times with <use>, so the bytes grow
// with the number of motifs, not with the number of cells.
import { mulberry32 } from './patterns/util.ts';

export interface Motif {
  readonly d: string;
  readonly box: number;
}

export interface MotifGridOptions {
  readonly motifs: readonly Motif[];
  readonly cells: number;
  readonly pitch: number;
  readonly offset: number;
  readonly order: readonly number[];
  readonly color: string;
  readonly background: string | null;
  readonly opacity: number;
}

const PATH_CHARS = /^[MmLlHhVvCcSsQqTtAaZz0-9.\-+eE,\s]+$/;

/** Path data from an outside source is untrusted: only commands and numbers pass. */
export function safePathData(d: string, max = 20000): string | null {
  const t = d.trim();
  if (t.length === 0 || t.length > max || !PATH_CHARS.test(t) || (t[0] !== 'M' && t[0] !== 'm')) return null;
  return t;
}

const num = (s: string | undefined): number => {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Finds the `d` of every `<path>` in a pasted SVG (regular expressions, no DOM).
 * The box comes from the root viewBox (larger edge), else the root width, else 24.
 * `box` overrides it: a file like a 7 x 7 grid of 24 px icons has a root width of
 * 238 while its motifs are drawn in 24 x 24, which the root cannot tell us.
 * A plain rectangle that covers the whole root (a background) is dropped.
 */
export function parseMotifs(svgText: string, max = 24, box?: number): Motif[] {
  try {
    const root = /<svg\b[^>]*>/i.exec(svgText)?.[0] ?? '';
    const vb = /\sviewBox\s*=\s*["']([^"']*)["']/i
      .exec(root)?.[1]
      ?.trim()
      .split(/[\s,]+/);
    const rootSize =
      (vb && vb.length === 4 ? Math.max(num(vb[2]), num(vb[3])) : 0) || num(/\swidth\s*=\s*["']([\d.]+)/i.exec(root)?.[1]) || 24;
    const size = box !== undefined && box > 0 ? box : rootSize;
    const out: Motif[] = [];
    for (const m of svgText.matchAll(/<path\b[^>]*?\sd\s*=\s*(["'])([^"']*)\1/gi)) {
      if (out.length >= max) break;
      const d = safePathData(m[2] ?? '');
      if (d === null) continue;
      const rect = /^M\s*0[\s,]+0\s*h\s*([\d.]+)\s*v\s*([\d.]+)\s*H\s*0\s*z$/i.exec(d);
      if (rect && num(rect[1]) >= rootSize && num(rect[2]) >= rootSize) continue;
      out.push({ d, box: size });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Row-major `cells * cells` motif indexes with no two equal neighbors, across the
 * tile edge too (torus). Method: fill row-major, at each cell pick among the
 * allowed indexes the least used so far (random tie break, seeded); restart on a
 * dead end or when the usage counts differ by more than 2. It always ends: the
 * restarts are capped, then a proven construction takes over:
 * (g(row) + g(col)) mod 3 with g a proper 3-coloring of the cycle, valid for any
 * cells >= 3 (but it uses only 3 motifs, so it is not even for count > 3).
 * The tests show the search succeeds for count 3..8, cells 3..8.
 */
export function arrange(count: number, cells: number, seed: number): number[] {
  const n = Math.max(0, Math.floor(cells));
  const k = Math.floor(count);
  // ponytail: count 1 cannot avoid equal neighbors; count 2 is a checkerboard, which
  // only holds across the wrap when cells is even (odd cells: one seam repeats).
  if (k <= 1) return Array<number>(n * n).fill(0);
  if (k === 2) return Array.from({ length: n * n }, (_, i) => (Math.floor(i / n) + (i % n)) % 2);
  const rnd = mulberry32(seed);
  for (let attempt = 0; attempt < 2000; attempt++) {
    const grid: number[] = [];
    const used = Array<number>(k).fill(0);
    let ok = true;
    for (let i = 0; i < n * n && ok; i++) {
      const r = Math.floor(i / n);
      const c = i % n;
      const banned = new Set<number>();
      if (c > 0) banned.add(grid[i - 1] ?? -1);
      if (r > 0) banned.add(grid[i - n] ?? -1);
      if (c === n - 1) banned.add(grid[i - c] ?? -1);
      if (r === n - 1) banned.add(grid[c] ?? -1);
      let best: number[] = [];
      let low = Infinity;
      for (let m = 0; m < k; m++) {
        if (banned.has(m)) continue;
        const u = used[m] ?? 0;
        if (u < low) [low, best] = [u, [m]];
        else if (u === low) best.push(m);
      }
      if (best.length === 0) ok = false;
      else {
        const pick = best[Math.floor(rnd() * best.length)] ?? 0;
        grid.push(pick);
        used[pick] = (used[pick] ?? 0) + 1;
      }
    }
    if (ok && Math.max(...used) - Math.min(...used) <= 2) return grid;
  }
  const g = (i: number): number => (i === n - 1 && n % 3 === 1 ? 1 : i % 3);
  return Array.from({ length: n * n }, (_, i) => (g(Math.floor(i / n)) + g(i % n)) % 3);
}

const safeColor = (c: string): string => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#000000');

function motifId(i: number): string {
  const letter = String.fromCharCode(97 + (i % 26));
  return i < 26 ? letter : `${letter}${Math.floor(i / 26) - 1}`;
}

const fmt = (x: number): string => String(Math.round(x * 1000) / 1000);

function build(o: MotifGridOptions, expanded: boolean): string {
  const cells = Math.max(0, Math.floor(o.cells));
  const size = fmt(cells * o.pitch);
  const inner = o.pitch - 2 * o.offset;
  const safe = o.motifs.map((m) => safePathData(m.d));
  const used = new Set(o.order.slice(0, cells * cells).filter((m) => safe[m] != null));
  const ids = new Map([...used].sort((a, b) => a - b).map((m, i) => [m, motifId(i)]));
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
  if (o.background !== null) s += `<path fill="${safeColor(o.background)}" d="M0 0h${size}v${size}H0z"/>`;
  if (!expanded && ids.size > 0) {
    s += '<defs>';
    for (const [m, id] of ids) s += `<path id="${id}" d="${safe[m]}"/>`;
    s += '</defs>';
  }
  const opacity = Math.min(1, Math.max(0, o.opacity));
  s += `<g fill="${safeColor(o.color)}"${opacity === 1 ? '' : ` fill-opacity="${fmt(opacity)}"`}>`;
  for (let i = 0; i < cells * cells; i++) {
    const m = o.order[i] ?? -1;
    const id = ids.get(m);
    const motif = o.motifs[m];
    if (id === undefined || motif === undefined) continue;
    const k = inner / motif.box;
    const t = `translate(${fmt((i % cells) * o.pitch + o.offset)} ${fmt(Math.floor(i / cells) * o.pitch + o.offset)})${k === 1 ? '' : ` scale(${fmt(k)})`}`;
    s += expanded ? `<path d="${safe[m]}" transform="${t}"/>` : `<use href="#${id}" transform="${t}"/>`;
  }
  return `${s}</g></svg>`;
}

export function motifGridSvg(o: MotifGridOptions): string {
  return build(o, false);
}

/** Byte length with <use>, and with every motif written out in full at each cell. */
export function motifGridBytes(o: MotifGridOptions): { svg: number; expanded: number } {
  const bytes = (s: string): number => new TextEncoder().encode(s).length;
  return { svg: bytes(build(o, false)), expanded: bytes(build(o, true)) };
}
