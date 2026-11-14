import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { geometry, svgFromPolylines } from '../fractal.ts';
import { sceneToSvg } from '../scene.ts';
import { brushOutlines, centrelines, type BrushOptions } from './linestyle.ts';
import { starGenerator } from './stars.ts';
import { mulberry32, wrap, type Poly, type Pt } from './util.ts';

const size = 120;
const opts = (seed = 1, style: BrushOptions['style'] = 'brush'): BrushOptions => ({ width: 2, style, rnd: mulberry32(seed) });

// Half-width of the outlines at x, from the edges crossing the vertical line near the centre row.
function halfWidth(outlines: Poly[], x: number): number {
  const ys: number[] = [];
  for (const p of outlines)
    for (let i = 0; i < p.length; i++) {
      const a = p[i]!;
      const b = p[(i + 1) % p.length]!;
      if ((a[0] - x) * (b[0] - x) > 0 || a[0] === b[0]) continue;
      const y = a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
      if (Math.abs(y - size / 2) < 10) ys.push(y);
    }
  return ys.length ? (Math.max(...ys) - Math.min(...ys)) / 2 : 0;
}
const maxHalfWidth = (outlines: Poly[]) => Math.max(...Array.from({ length: 2 * size + 1 }, (_, i) => halfWidth(outlines, i / 2)));

test('a line across the whole tile is a loop on the torus: no pinch at the seam', () => {
  const out = brushOutlines(
    [
      [
        [0, size / 2],
        [size, size / 2],
      ],
    ],
    size,
    opts(),
  );
  for (const x of [0.05, size / 2, size - 0.05]) {
    const hw = halfWidth(out, x);
    assert.ok(hw >= 0.95 && hw <= 1.6 + 0.1, `x ${x}: ${hw}`);
  }
});

test('real ends taper', () => {
  const out = brushOutlines(
    [
      [
        [size * 0.2, size / 2],
        [size * 0.6, size / 2],
      ],
    ],
    size,
    opts(),
  );
  const max = maxHalfWidth(out);
  for (const x of [size * 0.2, size * 0.6]) assert.ok(halfWidth(out, x) <= 0.25 * max, `x ${x}: ${halfWidth(out, x)} / ${max}`);
});

test('a line cut at the right edge joins the left side without a pinch', () => {
  const pieces = wrap(
    [
      [
        [size * 0.8, size / 2],
        [size * 1.3, size / 2],
      ],
    ],
    size,
  );
  assert.equal(pieces.length, 2);
  const out = brushOutlines(pieces, size, opts());
  const max = maxHalfWidth(out);
  for (const x of [0.01, size - 0.01]) assert.ok(halfWidth(out, x) >= 0.7 * max, `x ${x}: ${halfWidth(out, x)} / ${max}`);
});

test('hand: small wobble, still at real ends, seeded', () => {
  const line: Poly[] = [
    [
      [size * 0.2, size / 2],
      [size * 0.6, size / 2],
    ],
  ];
  const [c] = centrelines(line, size, opts(1, 'hand'));
  assert.ok(c);
  const d = c.pts.map((p, i) => Math.hypot(p[0] - c.base[i]![0], p[1] - c.base[i]![1]));
  assert.ok(Math.max(...d) <= 0.6 + 0.05, `max ${Math.max(...d)}`);
  assert.ok(Math.max(...d) > 0.1, 'wobbles');
  assert.equal(d[0], 0);
  assert.equal(d[d.length - 1], 0);
  assert.deepEqual(brushOutlines(line, size, opts(1, 'hand')), brushOutlines(line, size, opts(1, 'hand')));
  assert.notDeepEqual(brushOutlines(line, size, opts(1, 'hand')), brushOutlines(line, size, opts(2, 'hand')));
});

test('real tiles: size and time against even strokes', () => {
  const tiles: [string, readonly (readonly Pt[])[]][] = [
    ...(['truchet', 'tree', 'koch'] as const).map((kind): [string, readonly (readonly Pt[])[]] => [
      kind,
      geometry({ kind, seed: 1, depth: 3, size }),
    ]),
    ['star 488', starGenerator('488')(mulberry32(1), 0, size)],
  ];
  const p = { size, strokeWidth: 2, precision: 1, color: '#336699', opacity: 1 };
  const kb = (s: string) => `${s.length} / ${gzipSync(s, { level: 9 }).length}`;
  for (const [name, polys] of tiles) {
    const even = svgFromPolylines(polys, p);
    const row = [`${name}: even ${kb(even)}`];
    for (const style of ['brush', 'hand'] as const) {
      const t = performance.now();
      const outlines = brushOutlines(polys as Poly[], size, opts(1, style));
      const svg = sceneToSvg(
        {
          width: size,
          height: size,
          layers: [{ polys: outlines, paint: { mode: 'fill', color: p.color, opacity: 1, width: 0, rule: 'nonzero' } }],
        },
        1,
      );
      const ms = performance.now() - t;
      row.push(`${style} ${kb(svg)} ${ms.toFixed(1)} ms`);
      assert.ok(ms < 300, `${name} ${style}: ${ms} ms`);
      assert.ok(svg.length < 60000, `${name} ${style}: ${svg.length}`);
    }
    console.log(row.join(' | '));
  }
});
