import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { geometry, hasCompat, KINDS, MAX_DEPTH } from './fractal.ts';
import type { Pt } from './patterns/util.ts';
import { pathData } from './scene.ts';
import {
  canVary,
  imageSuperTileExpanded,
  imageSuperTileSvg,
  ORIENTATIONS,
  SUPER_CELLS,
  superTileBytes,
  superTileSvg,
  VARIANT_KINDS,
  VARIANTS,
  variantIndex,
  variantSeeds,
  type SuperTileOptions,
} from './supertile.ts';

const N = SUPER_CELLS;
const base: SuperTileOptions = {
  kind: 'tree',
  seed: 1,
  depth: 3,
  size: 60,
  strokeWidth: 1,
  precision: 1,
  color: '#336699',
  opacity: 0.5,
};

test('variantIndex: no equal neighbors on the 4 x 4 torus, each variant 4 times', () => {
  const counts = Array.from({ length: VARIANTS }, () => 0);
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const v = variantIndex(r, c);
      counts[v] = (counts[v] ?? 0) + 1;
      assert.notEqual(v, variantIndex(r, (c + 1) % N), `right of ${r},${c}`);
      assert.notEqual(v, variantIndex((r + 1) % N, c), `below ${r},${c}`);
    }
  assert.deepEqual(counts, [4, 4, 4, 4]);
});

test('variantSeeds: 4 distinct unsigned 32-bit ints, deterministic, first is the seed', () => {
  for (const seed of [0, 1, 12345, 4294967295]) {
    const s = variantSeeds(seed);
    assert.equal(s.length, 4);
    assert.equal(new Set(s).size, 4);
    assert.equal(s[0], seed);
    assert.deepEqual(variantSeeds(seed), s);
    for (const v of s) assert.ok(Number.isInteger(v) && v >= 0 && v <= 4294967295, `${v} in range`);
  }
});

test('VARIANT_KINDS: the 22 kinds, all known', () => {
  assert.deepEqual([...VARIANT_KINDS].sort(), [
    'basket',
    'brick',
    'carpet',
    'crosshatch',
    'dots',
    'fold',
    'hatch',
    'herringbone',
    'hex',
    'htree',
    'koch',
    'nested',
    'quadtree',
    'scales',
    'sierpinski',
    'stack',
    'stitch',
    'tree',
    'trinet',
    'waves',
    'whirl',
    'zigzag',
  ]);
  assert.equal(canVary('tree'), true);
  assert.equal(canVary('herringbone'), true);
  assert.equal(canVary('maze'), false);
  for (const k of VARIANT_KINDS) assert.ok((KINDS as readonly string[]).includes(k), k);
});

test('superTileSvg: header, defs, 16 uses in row-major order', () => {
  const svg = superTileSvg(base);
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">'));
  assert.equal(svg.split('<path id=').length - 1, 4);
  assert.equal(svg.split('<use ').length - 1, 16);
  assert.equal(svg.split('stroke="#336699"').length - 1, 1);
  assert.ok(!svg.includes('\n'));
  const ds = Object.fromEntries([...svg.matchAll(/<path id="(\w)" d="([^"]*)"\/>/g)].map((m) => [m[1], m[2]]));
  assert.equal(ds.a, pathData(geometry({ kind: 'tree', seed: 1, depth: 3, size: 60 }), 1));
  const vals = Object.values(ds);
  assert.equal(new Set(vals).size, 4);
  const uses = [...svg.matchAll(/<use href="#(\w)"(?: transform="translate\((\d+) (\d+)\)")?\/>/g)];
  assert.equal(uses.length, 16);
  uses.forEach((m, i) => {
    const r = Math.floor(i / N);
    const c = i % N;
    assert.equal(m[1], 'abcd'[variantIndex(r, c)]);
    if (i === 0) assert.equal(m[2], undefined, 'cell 0 0 has no transform');
    else assert.deepEqual([Number(m[2]), Number(m[3])], [c * 60, r * 60]);
  });
});

// Edge agreement: points of one cell on a shared boundary meet a point of the neighbor, or lie
// on a border segment of the neighbor. Cells are translated to their place; wrap pairs compare
// the far edge of one cell with the near edge of the other.
const EPS = 1e-6;
type Cell = readonly (readonly Pt[])[];
function edgeFailures(kind: (typeof VARIANT_KINDS)[number], seed: number, depth: number, size: number): string[] {
  const seeds = variantSeeds(seed);
  const variants = seeds.map((s) => geometry({ kind, seed: s, depth, size, compat: hasCompat(kind) }));
  const cellAt = (r: number, c: number): Cell =>
    (variants[variantIndex(r, c)] ?? []).map((p) => p.map(([x, y]) => [x + c * size, y + r * size] as Pt));
  // axis 0: vertical boundary x = at; axis 1: horizontal boundary y = at.
  const on = (p: Pt, axis: 0 | 1, at: number) => Math.abs(p[axis] - at) < EPS;
  const covered = (p: Pt, other: Cell, axis: 0 | 1, at: number, shift: number): boolean => {
    const q: Pt = axis === 0 ? [at, p[1] + shift] : [p[0] + shift, at];
    const o: 0 | 1 = axis === 0 ? 1 : 0;
    for (const poly of other)
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[i + 1];
        if (!a) continue;
        if (on(a, axis, at) && Math.abs(a[o] - q[o]) < EPS) return true;
        if (b && on(a, axis, at) && on(b, axis, at)) {
          const lo = Math.min(a[o], b[o]);
          const hi = Math.max(a[o], b[o]);
          if (q[o] >= lo - EPS && q[o] <= hi + EPS) return true;
        }
      }
    return false;
  };
  const fails: string[] = [];
  const check = (A: Cell, atA: number, B: Cell, atB: number, axis: 0 | 1, label: string) => {
    // Along-boundary offset between A and B coordinates is 0: neighbors share the other axis.
    for (const [X, atX, Y, atY] of [
      [A, atA, B, atB],
      [B, atB, A, atA],
    ] as const)
      for (const poly of X)
        for (const p of poly) if (on(p, axis, atX) && !covered(p, Y, axis, atY, 0)) fails.push(`${label} (${p[0]}, ${p[1]})`);
  };
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const A = cellAt(r, c);
      const cr = (c + 1) % N;
      // Right neighbor: boundary at x = (c + 1) * size in A, at x = cr * size in B (differs on wrap).
      check(A, (c + 1) * size, cellAt(r, cr), cr * size, 0, `${kind} seed ${seed} depth ${depth} ${r},${c}|${r},${cr}`);
      const rb = (r + 1) % N;
      check(A, (r + 1) * size, cellAt(rb, c), rb * size, 1, `${kind} seed ${seed} depth ${depth} ${r},${c}/${rb},${c}`);
    }
  return fails;
}

test('edge agreement for every VARIANT_KINDS kind', () => {
  const failing = new Map<string, string>();
  for (const kind of VARIANT_KINDS)
    for (const depth of [2, MAX_DEPTH[kind]])
      for (let seed = 1; seed <= 5; seed++) {
        const f = edgeFailures(kind, seed, Math.min(depth, MAX_DEPTH[kind]), 60);
        if (f.length && !failing.has(kind)) failing.set(kind, `${f.length} points, first ${f[0]}`);
      }
  assert.deepEqual(Object.fromEntries(failing), {});
});

// Boundary signature of one edge (axis 0: x = at, axis 1: y = at): the sorted, merged positions
// along the edge where a segment touches or crosses it, and the [start, end] intervals of the
// segments that lie along it.
interface Signature {
  readonly points: number[];
  readonly spans: [number, number][];
}
function signature(geo: Cell, axis: 0 | 1, at: number): Signature {
  const o: 0 | 1 = axis === 0 ? 1 : 0;
  const on = (p: Pt) => Math.abs(p[axis] - at) < EPS;
  const raw: number[] = [];
  const spans: [number, number][] = [];
  for (const poly of geo) {
    for (const p of poly) if (on(p)) raw.push(p[o]);
    for (let i = 1; i < poly.length; i++) {
      const a = poly[i - 1]!;
      const b = poly[i]!;
      if (on(a) && on(b)) spans.push([Math.min(a[o], b[o]), Math.max(a[o], b[o])]);
      else if (!on(a) && !on(b) && (a[axis] - at) * (b[axis] - at) < 0) {
        const t = (at - a[axis]) / (b[axis] - a[axis]);
        raw.push(a[o] + t * (b[o] - a[o]));
      }
    }
  }
  raw.sort((x, y) => x - y);
  const points = raw.filter((v, i) => i === 0 || v - raw[i - 1]! >= EPS);
  spans.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  return { points, spans };
}
const near = (x: readonly number[], y: readonly number[]) => x.length === y.length && x.every((v, i) => Math.abs(v - y[i]!) < EPS);
const sameSig = (a: Signature, b: Signature) =>
  near(a.points, b.points) && a.spans.length === b.spans.length && a.spans.every((s, i) => near(s, b.spans[i]!));
// Full border line kinds: a point on the neighbor's border segment counts as matched.
const BORDER_KINDS: readonly string[] = ['quadtree', 'sierpinski'];
const coveredSig = (a: Signature, b: Signature) =>
  a.points.every((v) => b.points.some((w) => Math.abs(v - w) < EPS) || b.spans.some(([lo, hi]) => v >= lo - EPS && v <= hi + EPS));

// Kinds whose boundary signatures disagree between seeds 1..8, with the first failing pair.
function boundaryFailures(kinds: readonly (typeof VARIANT_KINDS)[number][], compat: boolean): Record<string, string> {
  const size = 60;
  const failing: Record<string, string> = {};
  for (const kind of kinds)
    for (const depth of new Set([2, MAX_DEPTH[kind]].map((d) => Math.min(d, MAX_DEPTH[kind])))) {
      const sigs = Array.from({ length: 8 }, (_, i) => {
        const geo = geometry({ kind, seed: i + 1, depth, size, compat: compat && hasCompat(kind) });
        return { left: signature(geo, 0, 0), right: signature(geo, 0, size), top: signature(geo, 1, 0), bottom: signature(geo, 1, size) };
      });
      const match = BORDER_KINDS.includes(kind) ? (a: Signature, b: Signature) => coveredSig(a, b) && coveredSig(b, a) : sameSig;
      for (let a = 0; a < 8; a++)
        for (let b = 0; b < 8; b++) {
          const A = sigs[a]!;
          const B = sigs[b]!;
          if (!failing[kind] && !(match(A.right, B.left) && match(A.bottom, B.top)))
            failing[kind] =
              `depth ${depth} seeds ${a + 1}|${b + 1}: right ${JSON.stringify(A.right)} left ${JSON.stringify(B.left)} bottom ${JSON.stringify(A.bottom)} top ${JSON.stringify(B.top)}`;
        }
    }
  return failing;
}

test('boundary signatures agree for every VARIANT_KINDS kind, seeds 1..8 pairwise', () => {
  assert.deepEqual(boundaryFailures(VARIANT_KINDS, true), {});
});

test('the free layouts break the boundary agreement, so the super tile needs compat', () => {
  const failing = Object.keys(boundaryFailures(VARIANT_KINDS.filter(hasCompat), false));
  // Measured: every one of the 13 kinds fails in free mode.
  assert.deepEqual(failing, [
    'brick',
    'stack',
    'herringbone',
    'basket',
    'hex',
    'trinet',
    'nested',
    'dots',
    'hatch',
    'crosshatch',
    'zigzag',
    'scales',
    'waves',
  ]);
});

test('superTileSvg throws RangeError for a kind that cannot vary', () => {
  assert.throws(() => superTileSvg({ ...base, kind: 'maze' }), RangeError);
});

test('superTileBytes: tree at depth 6 is much smaller than the expanded picture', () => {
  const b = superTileBytes({ ...base, depth: 6 });
  assert.ok(b.svg < b.expanded / 3, JSON.stringify(b));
  assert.ok(b.svg < 5 * b.plain, JSON.stringify(b));
});

test('an unsafe color falls back to #000000', () => {
  const svg = superTileSvg({ ...base, color: 'x" onload="alert(1)' });
  assert.ok(svg.includes('stroke="#000000"'));
  assert.ok(!svg.includes('onload'));
});

test('source hygiene: no node: imports, no Math.random', () => {
  const src = readFileSync(new URL('./supertile.ts', import.meta.url), 'utf8');
  assert.ok(!src.includes('node:'));
  assert.ok(!src.includes('Math.random'));
});

test('defaults: no new option gives the same bytes as before the repetition options', () => {
  const sum = (s: string): number => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
    return h;
  };
  // Measured on phase-2 before the change.
  const expected: Record<string, [number, number]> = { tree: [1376, 2574309790], brick: [6446, 412479989], quadtree: [2540, 1461329606] };
  for (const [kind, pin] of Object.entries(expected)) {
    const o = { ...base, kind: kind as 'tree' };
    for (const svg of [superTileSvg(o), superTileSvg({ ...o, orient: false }), superTileSvg({ ...o, cells: 4, count: 4 })])
      assert.deepEqual([svg.length, sum(svg)], pin, kind);
  }
});

test('per-cell options at their neutral values give the default bytes', () => {
  for (const kind of ['tree', 'brick', 'quadtree'] as const) {
    const o = { ...base, kind };
    const def = superTileSvg(o);
    for (const extra of [{ weights: 0 }, { skip: 0 }, { jitter: 0 }, { depths: false }, { drop: 'none' as const }])
      assert.equal(superTileSvg({ ...o, ...extra }), def, `${kind} ${JSON.stringify(extra)}`);
  }
});

test('weights: per-cell width and opacity in range, smooth, geometry unchanged (brick)', () => {
  const o: SuperTileOptions = { ...base, kind: 'brick', cells: 4, weights: 1 };
  const svg = superTileSvg(o);
  const uses = [...svg.matchAll(/<use [^>]*\/>/g)].map((m) => m[0]);
  assert.equal(uses.length, 16);
  const ws = uses.map((u) => Number(/stroke-width="([^"]*)"/.exec(u)?.[1] ?? o.strokeWidth));
  const os = uses.map((u) => Number(/stroke-opacity="([^"]*)"/.exec(u)?.[1] ?? o.opacity));
  for (const w of ws) assert.ok(w >= 0.5 - 1e-9 && w <= 1.5 + 1e-9, `${w}`);
  for (const op of os) assert.ok(op / o.opacity <= 1 && op / o.opacity >= 0.6 - 0.02, `${op}`);
  assert.ok(new Set(ws).size >= 3, JSON.stringify(ws));
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) assert.ok(Math.abs(ws[r * 4 + c]! - ws[r * 4 + ((c + 1) % 4)]!) < 0.5, `${r},${c}`);
  const strip = (s: string) => s.replace(/<use [^>]*\/>/g, (u) => u.replace(/ stroke-(width|opacity)="[^"]*"/g, ''));
  assert.equal(strip(svg), superTileSvg({ ...o, weights: 0 }));
});

test('skip: tree has 1..4 empty cells, never neighbors, deterministic; brick has none', () => {
  const o: SuperTileOptions = { ...base, cells: 4, skip: 0.25 };
  const svg = superTileSvg(o);
  assert.equal(superTileSvg(o), svg);
  const at = new Set(
    [...svg.matchAll(/<use href="#\w"(?: transform="translate\(([\d.]+) ([\d.]+)\)")?\/>/g)].map(
      (m) => `${Number(m[2] ?? 0) / 60},${Number(m[1] ?? 0) / 60}`,
    ),
  );
  const empty: [number, number][] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (!at.has(`${r},${c}`)) empty.push([r, c]);
  assert.ok(empty.length >= 1 && empty.length <= 4, JSON.stringify(empty));
  for (const [r, c] of empty)
    for (const [r2, c2] of empty)
      assert.ok(!((r === r2 && (c2 - c + 4) % 4 === 1) || (c === c2 && (r2 - r + 4) % 4 === 1)), `${r},${c} ${r2},${c2}`);
  assert.equal(superTileSvg({ ...o, kind: 'brick' }).split('<use ').length - 1, 16);
});

// An image super tile: one synthetic "traced" picture in every cell of edge 10.
const pic = [
  [
    [0, 0],
    [10, 3],
    [4, 10],
  ],
  [
    [2, 2],
    [8, 8],
  ],
] as const satisfies readonly (readonly (readonly [number, number])[])[];
const img = { seed: 1, size: 10, strokeWidth: 1, precision: 1, color: '#000000', opacity: 1 } as const;
const uses = (svg: string) => [...svg.matchAll(/<use [^>]*\/>/g)].map((m) => m[0]);

test('image super tile: half-drop puts cell (1,0) half a cell lower and wraps it', () => {
  const svg = imageSuperTileSvg({ ...img, cells: 4, drop: 'half-drop' }, pic);
  const u = uses(svg);
  assert.ok(
    u.some((x) => x.includes('translate(10 5)')),
    'column 1 row 0 at y = 5',
  );
  assert.ok(
    u.some((x) => x.includes('translate(10 -5)')),
    'its wrap one period back',
  );
  assert.equal(u.length, 16 + 2, '2 dropped columns cross the bottom edge');
});

test('image super tile: turn and flip uses only the 8 symmetries of the square', () => {
  const svg = imageSuperTileSvg({ ...img, cells: 4, orient: true }, pic);
  const allowed = new Set(
    Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => ORIENTATIONS.map((f) => f(c * 10, r * 10, 10)))).flat(2),
  );
  for (const x of uses(svg)) {
    const t = /transform="([^"]*)"/.exec(x)?.[1] ?? 'translate(0 0)';
    assert.ok(allowed.has(t), t);
  }
});

test('image super tile: the path data occurs once, the expanded form 16 times', () => {
  const o = { ...img, cells: 4, orient: true, jitter: 0.5, weights: 0.5 } as const;
  const d = pathData(pic, 1);
  const svg = imageSuperTileSvg(o, pic);
  assert.equal(svg.split(d).length - 1, 1);
  assert.equal(imageSuperTileExpanded(o, pic).split(d).length - 1, 16);
});

test('image super tile: empty cells at 0.25 leave 12 of 16 cells (seed 1, measured)', () => {
  assert.equal(uses(imageSuperTileSvg({ ...img, cells: 4, skip: 0.25 }, pic)).length, 12);
});
