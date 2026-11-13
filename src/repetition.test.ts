import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, geometry, hasCompat, KINDS, MAX_DEPTH, tileAspect, type Kind } from './fractal.ts';
import type { Pt } from './patterns/util.ts';
import { pathData } from './scene.ts';
import {
  measureDepthMixKinds,
  measureMarginKinds,
  measureOrientationKinds,
  mirrorSuperSvg,
  optionsFor,
  orientable,
  repetitionBytes,
  sameSig,
  signature,
  type Signature,
} from './repetition.ts';
import {
  DEPTH_MIX_KINDS,
  MARGIN_KINDS,
  ORIENTATIONS,
  orientationKinds,
  shiftsFor,
  superTileSvg,
  VARIANT_KINDS,
  variantSeeds,
  type SuperTileOptions,
} from './supertile.ts';

type Geo = readonly (readonly Pt[])[];
const EPS = 1e-6;
const base: SuperTileOptions = {
  kind: 'tree',
  seed: 1,
  depth: 2,
  size: 60,
  strokeWidth: 1,
  precision: 1,
  color: '#336699',
  opacity: 0.5,
};

// Applies an SVG transform list (translate, rotate by quarter turns, scale) to a point, right to left.
function apply(t: string, p: Pt): Pt {
  const ops = [...t.matchAll(/(\w+)\(([^)]*)\)/g)].map((m) => [m[1]!, m[2]!.split(/[\s,]+/).map(Number)] as const);
  let [x, y] = p;
  for (const [op, a] of ops.reverse()) {
    if (op === 'translate') [x, y] = [x + a[0]!, y + (a[1] ?? 0)];
    else if (op === 'scale') [x, y] = [x * a[0]!, y * (a[1] ?? a[0]!)];
    else if (op === 'rotate') {
      const r = (a[0]! * Math.PI) / 180;
      const [c, s] = [Math.round(Math.cos(r)), Math.round(Math.sin(r))];
      [x, y] = [c * x - s * y, s * x + c * y];
    } else throw new Error(op);
  }
  return [x, y];
}
// The cell's geometry after its transform, moved back to local coordinates of the cell at (x, y).
const placed = (geo: Geo, t: string, x: number, y: number): Geo =>
  geo.map((poly) => poly.map((p) => apply(t, p)).map(([a, b]) => [a - x, b - y] as Pt));

// Full border line kinds: a point on the neighbor's border segment counts as matched (as in supertile.test.ts).
const BORDER_KINDS: readonly string[] = ['quadtree', 'sierpinski'];
const coveredSig = (a: Signature, b: Signature) =>
  a.points.every((v) => b.points.some((w) => Math.abs(v - w) < EPS) || b.spans.some(([lo, hi]) => v >= lo - EPS && v <= hi + EPS));
const match = (kind: string, a: Signature, b: Signature) =>
  BORDER_KINDS.includes(kind) ? coveredSig(a, b) && coveredSig(b, a) : sameSig(a, b);

// grid[r][c]: local geometry of each cell; checks every right and bottom neighbor, with wrap.
function seamFailures(kind: string, grid: Geo[][], size: number): string[] {
  const n = grid.length;
  const fails: string[] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const A = grid[r]![c]!;
      if (!match(kind, signature(A, 0, size), signature(grid[r]![(c + 1) % n]!, 0, 0))) fails.push(`${kind} ${r},${c} right`);
      if (!match(kind, signature(A, 1, size), signature(grid[(r + 1) % n]![c]!, 1, 0))) fails.push(`${kind} ${r},${c} below`);
    }
  return fails;
}

// The cells of a super tile as written: variant id and transform per <use>, applied to the geometry.
function cellsOf(svg: string, o: SuperTileOptions): Geo[][] {
  const n = o.cells ?? 4;
  const count = o.count ?? 4;
  const geos = variantSeeds(o.seed, count).map((seed) =>
    geometry({ kind: o.kind, seed, depth: o.depth, size: o.size, compat: hasCompat(o.kind) }),
  );
  const uses = [...svg.matchAll(/<use href="#(\w)"(?: transform="([^"]*)")?\/>/g)];
  assert.equal(uses.length, n * n);
  const grid: Geo[][] = [];
  uses.forEach((m, i) => {
    const [r, c] = [Math.floor(i / n), i % n];
    (grid[r] ??= [])[c] = placed(geos['abcdef'.indexOf(m[1]!)]!, m[2] ?? '', c * o.size, r * o.size);
  });
  return grid;
}

test('mirrorSuperSvg: one path, 4 uses, edge 120, no newline', () => {
  const svg = mirrorSuperSvg({ ...base, kind: 'herringbone', depth: 3 });
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">'));
  assert.equal(svg.split('<path id=').length - 1, 1);
  assert.equal(svg.split('<use ').length - 1, 4);
  assert.equal(svg.split('stroke="#336699"').length - 1, 1);
  assert.ok(!svg.includes('\n'));
  assert.ok(mirrorSuperSvg({ ...base, color: 'x"' }).includes('stroke="#000000"'));
});

// Square kinds only: the mirror super tile assumes a square tile, and the page switches Mirror off for a
// rectangular kind (Penrose), so the three Penrose kinds are skipped here.
test('mirrorSuperSvg: the 2 x 2 block is seamless for all 70 square kinds, inner lines and wrap', () => {
  const fails: string[] = [];
  const square = KINDS.filter((k) => tileAspect(k) === 1);
  assert.equal(square.length, 70);
  for (const kind of square) {
    const o = { ...base, kind };
    const svg = mirrorSuperSvg(o);
    const geo = geometry({ kind, seed: 1, depth: 2, size: 60 });
    const uses = [...svg.matchAll(/<use href="#a"(?: transform="([^"]*)")?\/>/g)].map((m) => m[1] ?? '');
    assert.equal(uses.length, 4);
    const grid = [
      [placed(geo, uses[0]!, 0, 0), placed(geo, uses[1]!, 60, 0)],
      [placed(geo, uses[2]!, 0, 60), placed(geo, uses[3]!, 60, 60)],
    ];
    // Strict: a cell and its mirror image have the very same boundary, border kinds included.
    fails.push(...seamFailures('strict', grid, 60));
  }
  assert.deepEqual(fails, []);
});

test('mirrorSuperSvg bytes: under 1.25 times the plain tile for herringbone depth 3', () => {
  const o = { ...base, kind: 'herringbone' as const, depth: 3 };
  // Measured: 2974 / 2753 = 1.08.
  assert.ok(mirrorSuperSvg(o).length < 1.25 * generate(o).length);
});

test('ORIENTATIONS: 8 distinct maps of the cell onto itself', () => {
  const [x, y, s] = [120, 60, 60];
  const probe: Pt[] = [
    [5, 10],
    [50, 3],
    [20, 40],
  ];
  const seen = new Set<string>();
  for (const f of ORIENTATIONS) {
    const out = probe.map(([px, py]) => apply(f(x, y, s), [px, py]));
    for (const [a, b] of out) assert.ok(a >= x && a <= x + s && b >= y && b <= y + s, f(x, y, s));
    seen.add(JSON.stringify(out));
  }
  assert.equal(seen.size, 8);
});

test('orientationKinds: the pinned list equals the measurement', () => {
  const list = orientationKinds();
  assert.deepEqual(measureOrientationKinds(), [...list]);
  assert.ok(list.length > 0);
  // Measured: quadtree has a full border whose segments break the reversal or the 4-edge equality; tree keeps a margin.
  assert.equal(list.includes('quadtree'), false);
  assert.equal(list.includes('tree'), true);
  assert.equal(orientable(geometry({ kind: 'tree', seed: 1, depth: 2, size: 60 }), 60), true);
});

test('orient: count definitions, cells² uses, at least 3 orientations, seamless', () => {
  for (const kind of orientationKinds())
    for (const depth of [2, MAX_DEPTH[kind]]) {
      const o = { ...base, kind, depth, orient: true };
      const svg = superTileSvg(o);
      assert.equal(svg.split('<path id=').length - 1, 4);
      assert.equal(svg.split('<use ').length - 1, 16);
      const ts = new Set([...svg.matchAll(/transform="([^"]*)"/g)].map((m) => m[1]!.replace(/translate\([^)]*\) ?/, '')));
      assert.ok(ts.size >= 3, `${kind}: ${[...ts].join(' | ')}`);
      // Cells of one variant never share an orientation (4 cells each here).
      const seen = new Set<string>();
      [...svg.matchAll(/<use href="#(\w)" transform="([^"]*)"\/>/g)].forEach((m, i) => {
        const key = `${m[1]} ${orientationOf(m[2]!, (i % 4) * 60, Math.floor(i / 4) * 60)}`;
        assert.ok(!seen.has(key) && !key.endsWith(' -1'), `${kind} ${key}`);
        seen.add(key);
      });
      assert.deepEqual(seamFailures(kind, cellsOf(svg, o), 60), []);
    }
});

// Which of the 8 orientations a transform is, by where it sends an asymmetric probe.
function orientationOf(t: string, x: number, y: number): number {
  const at = (u: string) => JSON.stringify([apply(u, [5, 10]), apply(u, [50, 3])]);
  return ORIENTATIONS.findIndex((f) => at(f(x, y, 60)) === at(t));
}

test('orient for a kind outside the list changes nothing', () => {
  for (const kind of VARIANT_KINDS.filter((k: Kind) => !orientationKinds().includes(k)))
    assert.equal(superTileSvg({ ...base, kind, orient: true }), superTileSvg({ ...base, kind }));
});

test('strength: every valid combination, no equal neighbors, seamless', () => {
  for (const [cells, count] of [
    [2, 2],
    [4, 4],
    [6, 4],
    [6, 6],
  ] as const)
    for (const kind of VARIANT_KINDS)
      for (let seed = 1; seed <= 3; seed++) {
        const o = { ...base, kind, seed, cells, count };
        const svg = superTileSvg(o);
        assert.equal(svg.split('<path id=').length - 1, count);
        const v = [...svg.matchAll(/<use href="#(\w)"/g)].map((m) => m[1]!);
        assert.equal(v.length, cells * cells);
        for (let r = 0; r < cells; r++)
          for (let c = 0; c < cells; c++) {
            const here = v[r * cells + c];
            assert.notEqual(here, v[r * cells + ((c + 1) % cells)]);
            assert.notEqual(here, v[((r + 1) % cells) * cells + c]);
            if (count === 2) assert.equal(here, 'ab'[(r + c) % 2]);
          }
        assert.deepEqual(seamFailures(kind, cellsOf(svg, o), 60), [], `${kind} ${cells}/${count} seed ${seed}`);
      }
  for (const [cells, count] of [
    [2, 4],
    [4, 6],
    [6, 2],
    [4, 2],
  ] as const)
    assert.throws(() => superTileSvg({ ...base, cells, count }), RangeError);
});

test('repetitionBytes: period, growth with count, flat-ish in cells', () => {
  const o = { ...base, depth: 4 };
  const b22 = repetitionBytes({ ...o, cells: 2, count: 2 });
  const b44 = repetitionBytes(o);
  const b64 = repetitionBytes({ ...o, cells: 6, count: 4 });
  const b66 = repetitionBytes({ ...o, cells: 6, count: 6 });
  assert.deepEqual([b22.period, b44.period, b64.period, b66.period], [2, 4, 6, 6]);
  assert.ok(b22.svg < b44.svg && b64.svg < b66.svg);
  // Measured: 1768 -> 2696 bytes, +52.5 percent (20 more <use> on a 385 byte path), not under 25.
  assert.ok(b64.svg / b44.svg - 1 < 0.53, `${b44.svg} -> ${b64.svg}`);
});

test('the pinned MARGIN_KINDS and DEPTH_MIX_KINDS equal their measurement', () => {
  assert.deepEqual(measureMarginKinds(), [...MARGIN_KINDS]);
  assert.deepEqual(measureDepthMixKinds(), [...DEPTH_MIX_KINDS]);
  for (const kind of VARIANT_KINDS) {
    const f = optionsFor(kind);
    assert.deepEqual(f, {
      weights: true,
      skip: orientationKinds().includes(kind),
      jitter: MARGIN_KINDS.includes(kind),
      depths: DEPTH_MIX_KINDS.includes(kind),
      drop: MARGIN_KINDS.includes(kind),
      orient: orientationKinds().includes(kind),
      variants: true,
    });
  }
});

// Each <use> as [variant index, transform].
const usesOf = (svg: string): [number, string][] =>
  [...svg.matchAll(/<use href="#(\w)"(?: transform="([^"]*)")?[^>]*\/>/g)].map((m) => ['abcdef'.indexOf(m[1]!), m[2] ?? '']);
const defsOf = (svg: string): string[] => [...svg.matchAll(/<path id="\w" d="([^"]*)"\/>/g)].map((m) => m[1]!);
const geosOf = (o: SuperTileOptions, depths: number[]): Geo[] =>
  variantSeeds(o.seed, o.count ?? 4).map((seed, v) => geometry({ kind: o.kind, seed, depth: depths[v]!, size: o.size, compat: true }));

test('jitter: every point stays in its own cell; a kind without margin is unchanged', () => {
  for (const kind of VARIANT_KINDS)
    for (const depth of [2, MAX_DEPTH[kind]])
      for (const seed of [1, 2, 3]) {
        const o: SuperTileOptions = { ...base, kind, seed, depth, jitter: 1 };
        const svg = superTileSvg(o);
        if (!optionsFor(kind).jitter) {
          assert.equal(svg, superTileSvg({ ...o, jitter: 0 }), kind);
          continue;
        }
        const geos = geosOf(o, [depth, depth, depth, depth]);
        const uses = usesOf(svg);
        assert.equal(uses.length, 16);
        assert.ok(new Set(uses.map((u) => u[1])).size >= 3);
        uses.forEach(([v, t], i) => {
          const [r, c] = [Math.floor(i / 4), i % 4];
          for (const poly of placed(geos[v]!, t, c * 60, r * 60))
            for (const [x, y] of poly)
              assert.ok(x >= -EPS && x <= 60 + EPS && y >= -EPS && y <= 60 + EPS, `${kind} ${seed} ${depth} cell ${i} ${x},${y}`);
        });
      }
});

test('depths: count / 2 variants at depth - 1, and the seams still agree', () => {
  for (const kind of DEPTH_MIX_KINDS)
    for (const depth of [3, MAX_DEPTH[kind]]) {
      const o: SuperTileOptions = { ...base, kind, depth, depths: true };
      const svg = superTileSvg(o);
      const at = (d: number) => variantSeeds(o.seed).map((seed) => pathData(geometry({ kind, seed, depth: d, size: 60, compat: true }), 1));
      const [hi, lo] = [at(depth), at(depth - 1)];
      const defs = defsOf(svg);
      assert.equal(defs.filter((d, v) => d === lo[v] && d !== hi[v]).length, 2, `${kind} ${depth}`);
      assert.equal(defs.filter((d, v) => d === hi[v]).length, 2, `${kind} ${depth}`);
      const levels = defs.map((d, v) => (d === hi[v] ? depth : depth - 1));
      const geos = geosOf(o, levels);
      const grid: Geo[][] = [];
      usesOf(svg).forEach(([v, t], i) => {
        const [r, c] = [Math.floor(i / 4), i % 4];
        (grid[r] ??= [])[c] = placed(geos[v]!, t, c * 60, r * 60);
      });
      assert.deepEqual(seamFailures(kind, grid, 60), []);
    }
});

test('drop: half-cell offsets, wrapped copies, invariant under a shift by the tile size', () => {
  for (const drop of ['half-drop', 'brick'] as const) {
    const o: SuperTileOptions = { ...base, depth: 3, cells: 4, drop };
    const svg = superTileSvg(o);
    const uses = usesOf(svg);
    assert.equal(uses.length, 16 + 2, drop);
    const geos = geosOf(o, [3, 3, 3, 3]);
    const key = (x: number, y: number) => `${(((x % 240) + 240) % 240).toFixed(3)},${(((y % 240) + 240) % 240).toFixed(3)}`;
    const pts = new Set<string>();
    const raw: Pt[] = [];
    const offset = (t: string): number[] => (/translate\(([-\d.]+) ([-\d.]+)\)/.exec(t)?.slice(1) ?? ['0', '0']).map(Number);
    for (const [v, t] of uses) {
      const [tx, ty] = offset(t) as [number, number];
      assert.ok((tx / 30) % 1 === 0 && (ty / 30) % 1 === 0, t);
      for (const poly of placed(geos[v]!, t, 0, 0))
        for (const p of poly) {
          raw.push(p);
          pts.add(key(p[0], p[1]));
        }
    }
    const shifted = uses.filter(([, t]) => offset(t).some((n) => n % 60 !== 0));
    assert.equal(shifted.length, 8 + 2, drop);
    // The points inside the tile, taken modulo the size, are the same set as all points modulo the size.
    const inside = new Set(raw.filter(([x, y]) => x >= 0 && x < 240 && y >= 0 && y < 240).map(([x, y]) => key(x, y)));
    assert.deepEqual([...pts].sort(), [...inside].sort(), drop);
  }
});

test('shift 1/3 on a 6 by 6 half-drop: columns 0, 1/3, 2/3 of a cell, wrapped copies, invariant under a shift by the tile size', () => {
  const o: SuperTileOptions = { ...base, depth: 3, cells: 6, count: 4, drop: 'half-drop', shift: 3 };
  const T = 360;
  const uses = usesOf(superTileSvg(o));
  const offset = (t: string): number[] => (/translate\(([-\d.]+) ([-\d.]+)\)/.exec(t)?.slice(1) ?? ['0', '0']).map(Number);
  const at = uses.map(([, t]) => offset(t) as [number, number]);
  for (const [c, dy] of [
    [1, 20],
    [2, 40],
    [3, 0],
    [4, 20],
    [5, 40],
  ] as const) {
    assert.ok(
      at.some(([x, y]) => x === c * 60 && Math.abs(y - dy) < 1e-9),
      `column ${c} at ${dy}`,
    );
    if (dy)
      assert.ok(
        at.some(([x, y]) => x === c * 60 && Math.abs(y - (300 + dy - T)) < 1e-9),
        `column ${c} wrapped`,
      );
  }
  assert.equal(uses.length, 36 + 4, '4 shifted columns cross the bottom edge');
  const geos = geosOf(o, [3, 3, 3, 3]);
  const key = (x: number, y: number) => `${(((x % T) + T) % T).toFixed(3)},${(((y % T) + T) % T).toFixed(3)}`;
  const pts = new Set<string>();
  const raw: Pt[] = [];
  for (const [v, t] of uses)
    for (const poly of placed(geos[v]!, t, 0, 0))
      for (const p of poly) {
        raw.push(p);
        pts.add(key(p[0], p[1]));
      }
  const inside = new Set(raw.filter(([x, y]) => x >= 0 && x < T && y >= 0 && y < T).map(([x, y]) => key(x, y)));
  assert.deepEqual([...pts].sort(), [...inside].sort());
});

test('shift 1/2 gives the same bytes as no shift for 3 kinds, both offsets; a shift the grid does not allow falls back to 1/2', () => {
  for (const kind of ['tree', 'carpet', 'whirl'] as const)
    for (const drop of ['half-drop', 'brick'] as const) {
      const o: SuperTileOptions = { ...base, kind, depth: 3, cells: 4, drop };
      assert.equal(superTileSvg({ ...o, shift: 2 }), superTileSvg(o), `${kind} ${drop}`);
      assert.equal(superTileSvg({ ...o, shift: 3 }), superTileSvg(o), `${kind} ${drop} 1/3 on 4 by 4`);
    }
});

test('shiftsFor: q divides the grid size', () => {
  assert.deepEqual(shiftsFor(2), [2]);
  assert.deepEqual(shiftsFor(4), [2, 4]);
  assert.deepEqual(shiftsFor(6), [2, 3]);
});

test('all options combined on tree: deterministic, one line, sized by repetitionBytes', () => {
  const o: SuperTileOptions = { ...base, depth: 4, orient: true, weights: 1, skip: 0.25, jitter: 1, depths: true };
  const svg = superTileSvg(o);
  assert.equal(superTileSvg(o), svg);
  assert.ok(!svg.includes('\n'));
  assert.equal(repetitionBytes(o).svg, new TextEncoder().encode(svg).length);
  assert.notEqual(svg, superTileSvg({ ...base, depth: 4 }));
});

test('imageOptions: every per-cell option but the depth mix; turning needs a square tile', async () => {
  const { imageOptions } = await import('./repetition.ts');
  assert.deepEqual(imageOptions(true), {
    weights: true,
    skip: true,
    jitter: true,
    depths: false,
    drop: true,
    orient: true,
    variants: true,
  });
  assert.equal(imageOptions(false).orient, false);
});
