import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILES, WEAVE_HALF, tileGeometry, wangBytes, wangLayout, wangSvg, type WangOptions, type WangStyle } from './wang.ts';
import type { Poly } from './patterns/util.ts';

const STYLES: readonly WangStyle[] = ['pipes', 'weave', 'paths', 'maze', 'rail'];
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

test('TILES: 16 distinct edge sets, index = top + 2 right + 4 bottom + 8 left', () => {
  assert.equal(TILES.length, 16);
  assert.equal(new Set(TILES.map((e) => e.join())).size, 16);
  TILES.forEach(([t, r, b, l], i) => assert.equal(t + 2 * r + 4 * b + 8 * l, i));
});

test('wangLayout: edges match on the torus, deterministic, seeded, density', () => {
  for (const n of [4, 8, 12])
    for (const seed of SEEDS) {
      const L = wangLayout(n, seed);
      assert.equal(L.length, n * n);
      assert.deepEqual(wangLayout(n, seed), L);
      assert.notDeepEqual(wangLayout(n, seed + 100), L);
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) {
          const e = TILES[L[r * n + c]!]!;
          assert.equal(e[1], TILES[L[r * n + ((c + 1) % n)]!]![3]);
          assert.equal(e[2], TILES[L[((r + 1) % n) * n + c]!]![0]);
        }
      assert.ok(wangLayout(n, seed, 0).every((t) => t === 0));
      assert.ok(wangLayout(n, seed, 1).every((t) => t === 15));
    }
  const all = new Set<number>();
  for (const seed of SEEDS) {
    const L = wangLayout(12, seed, 0.5);
    assert.ok(new Set(L).size >= 12, `seed ${seed}: ${new Set(L).size} tiles`);
    L.forEach((t) => all.add(t));
  }
  assert.equal(all.size, 16);
});

test('wangLayout: no shift other than (0, 0) maps a 12 x 12 layout onto itself', () => {
  const n = 12;
  for (const seed of SEEDS) {
    const L = wangLayout(n, seed);
    for (let dy = 0; dy < n; dy++)
      for (let dx = 0; dx < n; dx++) {
        if (dx === 0 && dy === 0) continue;
        const same = L.every((t, i) => t === L[((Math.floor(i / n) + dy) % n) * n + (((i % n) + dx) % n)]);
        assert.equal(same, false, `seed ${seed} shift ${dx},${dy}`);
      }
  }
});

test('tileGeometry: lines reach coded edges at the midpoint only, nothing else on the border', () => {
  const s = 60;
  const c = s / 2;
  const d = WEAVE_HALF * s;
  // Points on edge e, as the coordinate along that edge.
  const along = (polys: Poly[], e: number): number[] =>
    polys
      .flat()
      .flatMap(([x, y]) =>
        e === 0 ? (y === 0 ? [x] : []) : e === 1 ? (x === s ? [y] : []) : e === 2 ? (y === s ? [x] : []) : x === 0 ? [y] : [],
      );
  for (const style of STYLES)
    for (const edges of TILES)
      for (const variant of [0, 1]) {
        const g = tileGeometry(style, edges, variant, s);
        const tag = `${style} ${edges.join('')} v${variant}`;
        for (const p of g) assert.ok(p.length >= 2, tag);
        for (const [x, y] of g.flat()) assert.ok(x >= 0 && x <= s && y >= 0 && y <= s, `${tag}: ${x},${y}`);
        for (let e = 0; e < 4; e++) {
          const pts = along(g, e);
          if (edges[e] === 0) assert.equal(pts.length, 0, `${tag} edge ${e}`);
          else if (style === 'weave' || style === 'rail') {
            assert.ok(pts.some((v) => Math.abs(v - (c - d)) < 1e-9) && pts.some((v) => Math.abs(v - (c + d)) < 1e-9), `${tag} edge ${e}`);
            assert.ok(
              pts.every((v) => Math.abs(Math.abs(v - c) - d) < 1e-9),
              `${tag} edge ${e}`,
            );
          } else {
            assert.ok(pts.includes(c), `${tag} edge ${e}`);
            assert.ok(
              pts.every((v) => v === c),
              `${tag} edge ${e}`,
            );
          }
        }
      }
});

test('seamless: points on every shared edge match from both sides, across the wrap too', () => {
  const n = 6;
  const s = 60;
  const P = n * s;
  for (const style of STYLES)
    for (const seed of [1, 2, 3]) {
      const L = wangLayout(n, seed);
      // Full geometry, each cell translated; variants alternate to mix them.
      const pts = L.flatMap((t, i) =>
        tileGeometry(style, TILES[t]!, i % 2, s)
          .flat()
          .map(([x, y]) => [x + (i % n) * s, y + Math.floor(i / n) * s] as const),
      );
      const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6;
      for (let k = 0; k < n; k++) {
        // Line x = k * s (k = 0 is also x = P): left side ends there, right side starts there.
        const pick = (sel: (x: number, y: number) => number | null): number[] =>
          pts
            .map(([x, y]) => sel(x, y))
            .filter((v): v is number => v !== null)
            .sort((a, b) => a - b);
        const xLeft = pick((x, y) => (near(x, k === 0 ? P : k * s) ? y : null));
        const xRight = pick((x, y) => (near(x, k * s) ? y : null));
        const yTop = pick((x, y) => (near(y, k === 0 ? P : k * s) ? x : null));
        const yBottom = pick((x, y) => (near(y, k * s) ? x : null));
        const same = (a: number[], b: number[], tag: string) => {
          const ua = [...new Set(a.map((v) => v.toFixed(6)))];
          const ub = [...new Set(b.map((v) => v.toFixed(6)))];
          assert.deepEqual(ua, ub, tag);
        };
        if (k > 0) {
          same(xLeft, xRight, `${style} seed ${seed} x=${k * s}`);
          same(yTop, yBottom, `${style} seed ${seed} y=${k * s}`);
        } else {
          same(xLeft, xRight, `${style} seed ${seed} wrap x`);
          same(yTop, yBottom, `${style} seed ${seed} wrap y`);
        }
      }
    }
});

const base: WangOptions = {
  style: 'pipes',
  cells: 12,
  seed: 1,
  size: 30,
  density: 0.5,
  strokeWidth: 1.4,
  precision: 2,
  color: '#336699',
  opacity: 1,
};

test('wangSvg: root, one definition per used tile, one <use> per non-empty cell', () => {
  for (const style of STYLES)
    for (const seed of [1, 2]) {
      const o = { ...base, style, seed };
      const svg = wangSvg(o);
      const b = wangBytes(o);
      assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 360 360">'));
      assert.ok(!svg.includes('\n'));
      const defs = svg.match(/<path id=/g)?.length ?? 0;
      const used = new Set([...svg.matchAll(/<use href="#(\w+)"/g)].map((m) => m[1]));
      assert.equal(defs, used.size);
      assert.equal(defs, b.definitions);
      assert.ok(defs <= 24);
      const nonEmpty = wangLayout(12, seed, 0.5).length; // upper bound
      assert.equal(svg.match(/<use /g)?.length ?? 0, b.cells);
      assert.ok(b.cells <= nonEmpty);
      if (style !== 'paths') assert.ok(svg.includes('<use href="#') && !svg.includes('#a" transform="translate(0 0)'));
    }
  // Empty tiles get no <use>: with density 0 pipes is all empty except the seeded rings.
  const empty = wangSvg({ ...base, density: 0 });
  const ringCells = wangBytes({ ...base, density: 0 }).cells;
  assert.equal(empty.match(/<use /g)?.length ?? 0, ringCells);
  assert.ok(ringCells < 144);
  assert.ok(wangSvg({ ...base, color: 'red;x' }).includes('stroke="#000000"'));
});

// A quarter does not hold: a pipes tile is ~50 bytes, about the cost of one <use>; measured 9639 / 21658 = 0.445.
test('wangBytes: pipes 12 x 12 at 30 px is under half of the expanded size (measured 0.45)', () => {
  const b = wangBytes(base);
  assert.equal(b.period, 360);
  assert.ok(b.svg < b.expanded * 0.5, `${b.svg} vs ${b.expanded}`);
});
