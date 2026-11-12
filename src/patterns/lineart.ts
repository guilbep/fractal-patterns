// Family 'line': straight-line constructions in the spirit of string art.
import { place, thin, wrap, TAU, type Poly, type Pt, type Rng } from './util.ts';

const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// Curve stitching: on two axes from a common point C, point i of one axis is joined to point
// n - i of the other; the lines envelope a parabola. The lines are chained as a zigzag, which
// also draws the axes. Seed: 1 or 2x2 cells, axis layout (cell edges, edge and diagonal, or the
// half-axes from the centre), and which corners of each cell are stitched. Cells are inset.
export function stitch(rnd: Rng, depth: number, size: number): Poly[] {
  const g = rnd() < 0.5 ? 1 : 2;
  const layout = Math.floor(rnd() * 3);
  const pCorner = 0.4 + 0.5 * rnd();
  const n = 2 + 2 * depth;
  const out: Poly[] = [];
  for (let cell = 0; cell < g * g; cell++) {
    // Each cell is inset on its own, so gaps between cells and between tiles are equal.
    const s = 1 / g - 0.06;
    const x = (cell % g) / g + 0.03;
    const y = Math.floor(cell / g) / g + 0.03;
    const corners: Pt[] = [[x, y], [x + s, y], [x + s, y + s], [x, y + s]];
    const centre: Pt = [x + s / 2, y + s / 2];
    const picked = corners.map(() => rnd() < pCorner);
    if (!picked.includes(true)) picked[Math.floor(rnd() * 4)] = true;
    for (let k = 0; k < 4; k++) {
      if (!picked[k]) continue;
      const c = corners[k]!;
      const next = corners[(k + 1) % 4]!;
      const prev = corners[(k + 3) % 4]!;
      const [o, a, b] =
        layout === 0 ? [c, next, prev] : layout === 1 ? [c, next, centre] : [centre, lerp(c, next, 0.5), lerp(prev, c, 0.5)];
      const poly: Poly = [];
      for (let i = 0; i <= n; i++) {
        const p = lerp(o, a, i / n);
        const q = lerp(o, b, 1 - i / n);
        poly.push(...(i % 2 ? [q, p] : [p, q]));
      }
      out.push(poly);
    }
  }
  return place(out, size, 0);
}

// Whirl: a regular polygon, then each next polygon has its vertices a fraction t along the edges
// of the previous one (pursuit curves). Seed: side count 3 to 6, t, turning direction, 1 or 2x2
// cells and whether neighbour cells turn the other way. Stops before polygons get below 3 px.
export function whirl(rnd: Rng, depth: number, size: number): Poly[] {
  const sides = 3 + Math.floor(rnd() * 4);
  const t = 0.1 + 0.08 * rnd();
  const dir = rnd() < 0.5 ? 1 : -1;
  const g = rnd() < 0.4 ? 1 : 2;
  const alternate = rnd() < 0.5;
  const cell = size / g;
  const out: Poly[] = [];
  for (let i = 0; i < g * g; i++) {
    const col = i % g;
    const row = Math.floor(i / g);
    const cx = (col + 0.5) * cell;
    const cy = (row + 0.5) * cell;
    // At least 3% of the tile between any polygon and its cell edge (and so the tile edge).
    const r = (cell / 2 - 0.03 * size) * (sides === 4 ? Math.SQRT2 : 1);
    const start = sides === 4 ? Math.PI / 4 : -Math.PI / 2;
    const turn = alternate && (col + row) % 2 ? -dir : dir;
    let poly: Pt[] = Array.from({ length: sides }, (_, k): Pt => {
      const a = start + (k * TAU) / sides;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    });
    for (let level = 0; level <= depth; level++) {
      out.push([...poly, poly[0]!]);
      poly = poly.map((p, k) => lerp(p, poly[(k + turn + sides) % sides]!, t));
      if (Math.hypot(poly[0]![0] - cx, poly[0]![1] - cy) < 3) break;
    }
  }
  return out;
}

// Rosette: rose curves r = R cos(k theta + phase), one ring per depth level, each ring smaller and
// turned half a petal from the previous one; a second rosette sits on the tile corners (wrap()
// shares it among the four tiles). Seed: k for each rosette, phase, ring radii.
export function rosette(rnd: Rng, depth: number, size: number): Poly[] {
  const out: Poly[] = [];
  const rose = (cx: number, cy: number, radius: number): void => {
    const k = 2 + Math.floor(rnd() * 4);
    const phase = rnd() * TAU;
    const shrink = 0.5 + 0.3 * rnd();
    const end = k % 2 ? Math.PI : TAU;
    for (let ring = 0; ring < depth; ring++) {
      const R = radius * (1 - (shrink * ring) / depth);
      const turn = phase + (ring * Math.PI) / (2 * k);
      const poly: Poly = [];
      for (let j = 0; j <= 720; j++) {
        const a = (j / 720) * end;
        const r = R * Math.cos(k * a);
        poly.push([cx + r * Math.cos(a + turn), cy + r * Math.sin(a + turn)]);
      }
      out.push(thin(poly, 2));
    }
  };
  rose(size / 2, size / 2, size * (0.34 + 0.08 * rnd()));
  rose(0, 0, size * (0.2 + 0.1 * rnd()));
  return wrap(out, size);
}

// Spiral lattice: one spiral per cell of a 2x2 grid (or a brick layout, rows shifted by half a
// cell), depth turns each. Seed: Archimedean or logarithmic growth and its rate, layout, and per
// cell handedness and starting angle. wrap() carries brick spirals across the tile edge.
export function spiral(rnd: Rng, depth: number, size: number): Poly[] {
  const log = rnd() < 0.5;
  // Archimedean: r = R (a/end)^rate. Logarithmic: r grows by rate per turn and the inner turns
  // closer than 2.5 px are left out, so higher depths add nothing once the core is reached.
  const rate = log ? 1.25 + 0.3 * rnd() : 0.8 + 0.5 * rnd();
  const rMin = 2.5 / (rate - 1);
  const brick = rnd() < 0.5;
  const cell = size / 2;
  const R = cell * 0.44;
  const end = depth * TAU;
  const out: Poly[] = [];
  for (let i = 0; i < 4; i++) {
    const row = Math.floor(i / 2);
    const cx = ((i % 2) + 0.5 + (brick && row ? 0.5 : 0)) * cell;
    const cy = (row + 0.5) * cell;
    const hand = rnd() < 0.5 ? 1 : -1;
    const phase = rnd() * TAU;
    const poly: Poly = [];
    const steps = 160 * depth;
    for (let j = 0; j <= steps; j++) {
      const a = (j / steps) * end;
      const r = log ? R * rate ** ((a - end) / TAU) : R * (a / end) ** rate;
      if (log && r < rMin) continue;
      poly.push([cx + r * Math.cos(hand * a + phase), cy + r * Math.sin(hand * a + phase)]);
    }
    out.push(thin(poly, 1.5));
  }
  return wrap(out, size);
}
