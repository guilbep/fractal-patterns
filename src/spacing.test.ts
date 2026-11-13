import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mirrorTile, withGap, zoomWrap } from './spacing.ts';
import { mulberry32, type Pt } from './patterns/util.ts';

const S = 120;
const EPS = 1e-9;
const near = (a: number, b: number, eps = EPS) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const nearList = (a: number[], b: number[], eps = EPS) => {
  assert.equal(a.length, b.length);
  a.forEach((v, i) => near(v, b[i] ?? NaN, eps));
};
const inside = (polys: Pt[][], size = S) =>
  polys.flat().every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x >= -EPS && x <= size + EPS && y >= -EPS && y <= size + EPS);
const len = (p: Pt[]) => p.slice(1).reduce((s, [x, y], i) => s + Math.hypot(x - p[i]![0], y - p[i]![1]), 0);
const sorted = (v: number[]) => [...v].sort((a, b) => a - b);

const spanning: Pt[][] = [
  [
    [0, 0],
    [120, 120],
  ],
  [
    [0, 60],
    [60, 0],
    [120, 60],
    [60, 120],
    [0, 60],
  ],
  [
    [10, 110],
    [110, 10],
    [115, 115],
  ],
];

test('zoomWrap: identity, shrink, bounds', () => {
  const one: Pt[][] = [
    [
      [10, 10],
      [110, 110],
    ],
  ];
  assert.deepEqual(zoomWrap(one, S, 1), one);
  const half = zoomWrap(
    [
      [
        [0, 0],
        [120, 120],
      ],
    ],
    S,
    0.5,
  );
  assert.equal(half.length, 1);
  nearList(half[0]!.flat(), [30, 30, 90, 90]);
  for (const z of [0.25, 0.5, 1.5, 2, 4]) assert.ok(inside(zoomWrap(spanning, S, z)), `zoom ${z}`);
});

test('zoomWrap: wrapped vertical segment keeps its length', () => {
  const ps = zoomWrap(
    [
      [
        [60, 20],
        [60, 100],
      ],
    ],
    S,
    2,
  );
  near(
    ps.reduce((s, p) => s + len(p), 0),
    160,
    1e-6,
  );
  assert.ok(ps.flat().every(([x]) => x === 60));
});

test('zoomWrap: zoom is clamped', () => {
  assert.deepEqual(zoomWrap(spanning, S, 9), zoomWrap(spanning, S, 4));
  assert.deepEqual(zoomWrap(spanning, S, 0), zoomWrap(spanning, S, 0.25));
});

test('zoomWrap: seam matches', () => {
  // No coordinate is 30 or 90: those map exactly onto an edge at zoom 2 and would be true end points, not seam crossings.
  const diag: Pt[][] = [
    [
      [10, 20],
      [100, 95],
    ],
    [
      [35, 110],
      [95, 5],
    ],
    [
      [0, 50],
      [70, 120],
    ],
    [
      [115, 40],
      [20, 75],
    ],
  ];
  const pts = zoomWrap(diag, S, 2).flat();
  const at = (axis: 0 | 1, v: number) => sorted(pts.filter((p) => Math.abs(p[axis] - v) <= EPS).map((p) => p[1 - axis]!));
  const x0 = at(0, 0);
  const y0 = at(1, 0);
  assert.ok(x0.length > 0 && y0.length > 0);
  nearList(x0, at(0, S));
  nearList(y0, at(1, S));
});

test('withGap', () => {
  const one: Pt[][] = [
    [
      [10, 10],
      [110, 110],
    ],
  ];
  assert.deepEqual(withGap(one, S, 0), { polys: one, size: 120 });
  assert.deepEqual(withGap(one, S, 30), {
    polys: [
      [
        [25, 25],
        [125, 125],
      ],
    ],
    size: 150,
  });
  assert.deepEqual(withGap(one, S, -5), withGap(one, S, 0));
  assert.deepEqual(withGap(one, S, 500), withGap(one, S, 120));
});

test('mirrorTile: four quadrants', () => {
  const ps = mirrorTile(
    [
      [
        [0, 0],
        [120, 60],
      ],
    ],
    S,
  );
  assert.equal(ps.length, 4);
  const key = (p: Pt[]) =>
    p
      .map(([x, y]) => `${x},${y}`)
      .sort()
      .join(' ');
  const want = [
    [
      [0, 0],
      [60, 30],
    ],
    [
      [120, 0],
      [60, 30],
    ],
    [
      [0, 120],
      [60, 90],
    ],
    [
      [120, 120],
      [60, 90],
    ],
  ] as Pt[][];
  assert.deepEqual(ps.map(key).sort(), want.map(key).sort());
});

test('mirrorTile: symmetric in x and y', () => {
  const rnd = mulberry32(42);
  const polys: Pt[][] = Array.from({ length: 5 }, () =>
    Array.from({ length: 2 + Math.floor(rnd() * 4) }, (): Pt => [rnd() * S, rnd() * S]),
  );
  const pts = mirrorTile(polys, S).flat();
  assert.ok(inside([pts]));
  // Sorted point lists (x then y) before and after each reflection.
  const list = (ps: Pt[]) => [...ps].sort((a, b) => a[0] - b[0] || a[1] - b[1]).flat();
  for (const f of [([x, y]: Pt): Pt => [S - x, y], ([x, y]: Pt): Pt => [x, S - y]]) nearList(list(pts.map(f)), list(pts));
});

test('spacing source hygiene', () => {
  const src = readFileSync(join(import.meta.dirname, 'spacing.ts'), 'utf8');
  for (const word of ['node:', 'document', 'Math.random']) assert.ok(!src.includes(word), word);
});

// Seamless edges for a traced picture: the Mirror block, alone and as the cell of the image grid.
test('mirrorTile makes a seamless block from lines that end at the edges anywhere', async () => {
  const { signature, sameSig } = await import('./repetition.ts');
  const { imageSuperTileSvg } = await import('./supertile.ts');
  const S = 100;
  const lines: Pt[][] = [
    [
      [0, 13],
      [40, 50],
    ],
    [
      [37, 0],
      [60, 70],
    ],
    [
      [100, 71],
      [80, 20],
    ],
    [
      [22, 100],
      [50, 50],
    ],
    [
      [0, 88],
      [100, 5],
    ],
  ];
  // Without the mirror the picture does not wrap: the check must be able to fail.
  assert.ok(!sameSig(signature(lines, 0, 0), signature(lines, 0, S)));
  const block = mirrorTile(lines, S);
  // The block keeps the tile edge: each quarter holds the picture at half size.
  assert.ok(block.flat().every(([x, y]) => x >= 0 && x <= S && y >= 0 && y <= S));
  assert.equal(block.length, 4 * lines.length);
  assert.ok(sameSig(signature(block, 0, 0), signature(block, 0, S)), 'left = right');
  assert.ok(sameSig(signature(block, 1, 0), signature(block, 1, S)), 'top = bottom');
  assert.ok(signature(block, 0, 0).points.length > 0 && signature(block, 1, 0).points.length > 0);

  // The grid of mirrored cells: path data once, every cell placed by a plain translate, so neighbors meet.
  const o = { seed: 1, size: S, strokeWidth: 1, precision: 2, color: '#000000', opacity: 1, cells: 2 as const };
  const svg = imageSuperTileSvg(o, block);
  assert.equal(svg.match(/<path /g)?.length, 1);
  const uses = [...svg.matchAll(/<use href="#a"(?: transform="translate\(([\d.]+) ([\d.]+)\)")?\/>/g)];
  assert.equal(uses.length, 4);
  assert.match(svg, /width="200" height="200"/);
  const at = (r: number, c: number) => {
    const m = uses[r * 2 + c]!;
    const [x, y] = [Number(m[1] ?? 0), Number(m[2] ?? 0)];
    assert.deepEqual([x, y], [c * S, r * S]);
    return block;
  };
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 2; c++) {
      assert.ok(sameSig(signature(at(r, c), 0, S), signature(at(r, (c + 1) % 2), 0, 0)), `${r},${c} right`);
      assert.ok(sameSig(signature(at(r, c), 1, S), signature(at((r + 1) % 2, c), 1, 0)), `${r},${c} below`);
    }
});
