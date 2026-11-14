// "Bands" renderer for Color symmetry: a periodic real field on an n x n grid becomes an SVG tile
// of 5 filled isobands, small enough for a CSS background.

type Grid = { n: number; re: Float64Array; im: Float64Array };
type P = [number, number];

// Wrapped samples around the tile, so shapes continue past the edges (the viewBox crops them).
const PAD = 2;

export function bandsSvg(
  grid: Grid,
  o: { colors: readonly string[]; size: number; balance: boolean; epsilon?: number },
): { body: string; levels: number[]; areas: number[] } {
  const { n, re } = grid;
  const sorted = Float64Array.from(re).sort();
  const lo = sorted[0] ?? 0;
  const hi = sorted[sorted.length - 1] ?? 0;
  const levels = [1, 2, 3, 4].map((k) => (o.balance ? (sorted[Math.round((k / 5) * sorted.length)] ?? hi) : lo + (k / 5) * (hi - lo)));
  const counts = [0, 0, 0, 0, 0];
  for (const v of re) counts[levels.filter((q) => v >= q).length]!++;
  const areas = counts.map((c) => c / re.length);

  // Padded grid with an outer frame below every level, so every contour closes.
  const N = n + 2 * PAD + 2;
  const floor = lo - 1;
  const val = new Float64Array(N * N);
  for (let b = 0; b < N; b++) {
    for (let a = 0; a < N; a++) {
      const edge = a === 0 || b === 0 || a === N - 1 || b === N - 1;
      const i = (((a - 1 - PAD) % n) + n) % n;
      const j = (((b - 1 - PAD) % n) + n) % n;
      val[b * N + a] = edge ? floor : re[j * n + i]!;
    }
  }
  const s = o.size / n;
  const px = (a: number): number => (a - 1 - PAD + 0.5) * s;
  const eps = o.epsilon ?? 0.4;

  let body = `<rect width="${o.size}" height="${o.size}" fill="${o.colors[0]}"/>`;
  levels.forEach((q, k) => {
    const d = contours(val, N, q, px)
      .map((loop) => toInts(simplifyLoop(loop, eps)))
      .filter((loop) => loop.length >= 3)
      .map(pathOf)
      .join('');
    body += `<path fill="${o.colors[k + 1]}" fill-rule="evenodd" d="${d}"/>`;
  });
  return { body, levels, areas };
}

export function bandsDocument(body: string, size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${body}</svg>`;
}

// Marching squares on {v >= q}; each crossing joins exactly two segments, so chaining gives loops.
function contours(val: Float64Array, N: number, q: number, px: (a: number) => number): P[][] {
  const pts = new Map<number, P>();
  const adj = new Map<number, number[]>();
  const at = (a: number, b: number): number => val[b * N + a]!;
  // Edge key: horizontal edge (a,b)-(a+1,b) is even, vertical (a,b)-(a,b+1) is odd.
  const cross = (a: number, b: number, vertical: boolean): number => {
    const key = (b * N + a) * 2 + (vertical ? 1 : 0);
    if (!pts.has(key)) {
      const v0 = at(a, b);
      const v1 = vertical ? at(a, b + 1) : at(a + 1, b);
      const t = (q - v0) / (v1 - v0);
      pts.set(key, vertical ? [px(a), px(b + t)] : [px(a + t), px(b)]);
    }
    return key;
  };
  const link = (u: number, v: number): void => {
    for (const [x, y] of [
      [u, v],
      [v, u],
    ] as const) {
      const l = adj.get(x);
      if (l) l.push(y);
      else adj.set(x, [y]);
    }
  };
  for (let b = 0; b < N - 1; b++) {
    for (let a = 0; a < N - 1; a++) {
      const tl = at(a, b) >= q;
      const tr = at(a + 1, b) >= q;
      const br = at(a + 1, b + 1) >= q;
      const bl = at(a, b + 1) >= q;
      if (tl === tr && tr === br && br === bl) continue;
      const top = tl !== tr ? cross(a, b, false) : -1;
      const right = tr !== br ? cross(a + 1, b, true) : -1;
      const bottom = bl !== br ? cross(a, b + 1, false) : -1;
      const left = tl !== bl ? cross(a, b, true) : -1;
      if (top >= 0 && right >= 0 && bottom >= 0 && left >= 0) {
        // Saddle: the cell centre decides whether the two inside corners connect.
        const centreIn = (at(a, b) + at(a + 1, b) + at(a + 1, b + 1) + at(a, b + 1)) / 4 >= q;
        if (centreIn === tl) {
          // tl inside with centre inside (or both outside): cut off tr and bl.
          link(top, right);
          link(bottom, left);
        } else {
          link(top, left);
          link(right, bottom);
        }
      } else {
        const ends = [top, right, bottom, left].filter((e) => e >= 0);
        link(ends[0]!, ends[1]!);
      }
    }
  }
  const loops: P[][] = [];
  const seen = new Set<number>();
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const loop: P[] = [];
    let prev = -1;
    let cur = start;
    while (!seen.has(cur)) {
      seen.add(cur);
      loop.push(pts.get(cur)!);
      const [x, y] = adj.get(cur)!;
      const next = x !== prev ? x! : y!;
      prev = cur;
      cur = next;
    }
    loops.push(loop);
  }
  return loops;
}

function rdp(pts: P[], eps: number): P[] {
  if (pts.length < 3) return pts;
  const [x0, y0] = pts[0]!;
  const [x1, y1] = pts[pts.length - 1]!;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  let best = -1;
  let far = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i]!;
    const d = len > 0 ? Math.abs(dy * (x - x0) - dx * (y - y0)) / len : Math.hypot(x - x0, y - y0);
    if (d > best) {
      best = d;
      far = i;
    }
  }
  if (best <= eps) return [pts[0]!, pts[pts.length - 1]!];
  return [...rdp(pts.slice(0, far + 1), eps).slice(0, -1), ...rdp(pts.slice(far), eps)];
}

// Closed loop: simplify its two halves as open polylines.
function simplifyLoop(loop: P[], eps: number): P[] {
  const h = loop.length >> 1;
  const a = rdp(loop.slice(0, h + 1), eps);
  const b = rdp([...loop.slice(h), loop[0]!], eps);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

function toInts(loop: P[]): P[] {
  const out: P[] = [];
  for (const [x, y] of loop) {
    const p: P = [Math.round(x), Math.round(y)];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  while (out.length > 1 && out[0]![0] === out[out.length - 1]![0] && out[0]![1] === out[out.length - 1]![1]) out.pop();
  return out;
}

// "M x y l dx dy ... z": relative steps are short; a minus sign needs no space before it.
function pathOf(loop: P[]): string {
  const nums = (vals: number[]): string => vals.reduce((acc, v, i) => acc + (i > 0 && v >= 0 ? ' ' : '') + v, '');
  const steps: number[] = [];
  for (let i = 1; i < loop.length; i++) steps.push(loop[i]![0] - loop[i - 1]![0], loop[i]![1] - loop[i - 1]![1]);
  return `M${nums(loop[0]!)}l${nums(steps)}Z`;
}
