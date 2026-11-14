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

// Degree of every vertex of the tile's lines, modulo the tile; duplicate segments count once.
function degrees(polys: Poly[]): Map<string, number> {
  const k = ([x, y]: Pt) =>
    `${Math.round((((x % size) + size) % size) * 1e3) % (size * 1e3)},${Math.round((((y % size) + size) % size) * 1e3) % (size * 1e3)}`;
  const segs = new Set<string>();
  const deg = new Map<string, number>();
  for (const p of polys)
    for (let i = 1; i < p.length; i++) {
      const [a, b] = [k(p[i - 1]!), k(p[i]!)];
      const id = [a, b, k([(p[i - 1]![0] + p[i]![0]) / 2, (p[i - 1]![1] + p[i]![1]) / 2])].sort().join('|');
      if (a === b || segs.has(id)) continue;
      segs.add(id);
      for (const v of [a, b]) deg.set(v, (deg.get(v) ?? 0) + 1);
    }
  return Object.assign(deg, { key: k }) as Map<string, number>;
}
const keyOf = ([x, y]: Pt) =>
  `${Math.round((((x % size) + size) % size) * 1e3) % (size * 1e3)},${Math.round((((y % size) + size) % size) * 1e3) % (size * 1e3)}`;

test('tree: no pinch at forks, free tips taper', () => {
  const polys = wrap(geometry({ kind: 'tree', seed: 1, depth: 5, size }) as Poly[], size);
  const deg = degrees(polys);
  const cs = centrelines(polys, size, opts());
  let forks = 0;
  let tips = 0;
  const ratios: number[] = [];
  for (const [v, d] of deg) {
    // Every centreline point within 1 px of the vertex.
    const near = cs.flatMap((c) =>
      c.base.flatMap((p, i) => {
        const [x, y] = v.split(',').map((n) => +n / 1e3) as [number, number];
        const dx = ((p[0] - x + size * 1.5) % size) - size / 2;
        const dy = ((p[1] - y + size * 1.5) % size) - size / 2;
        return Math.hypot(dx, dy) <= 1 ? [{ c, hw: c.hw[i]!, end: i === 0 || i === c.base.length - 1 }] : [];
      }),
    );
    if (d >= 3) {
      forks++;
      const parent = Math.max(...near.filter((n) => !n.end).map((n) => n.hw));
      const thinnest = Math.min(...near.map((n) => n.hw));
      ratios.push(thinnest / parent);
      assert.ok(thinnest >= 0.7 * parent, `fork ${v}: ${thinnest} / ${parent}`);
    } else if (d === 1) {
      tips++;
      for (const n of near.filter((n) => n.end)) assert.ok(n.hw <= 0.25 * Math.max(...n.c.hw), `tip ${v}: ${n.hw}`);
    }
  }
  assert.ok(forks > 3 && tips > 3, `${forks} forks, ${tips} tips`);
  console.log(`tree: ${cs.length} strands, ${forks} forks (thinnest / parent >= ${Math.min(...ratios).toFixed(2)}), ${tips} tips`);
});

test('koch: whole curves, no necks away from free ends', () => {
  const polys = wrap(geometry({ kind: 'koch', seed: 1, depth: 4, size }) as Poly[], size);
  const deg = degrees(polys);
  const w = opts().width;
  const cs = centrelines(polys, size, opts());
  assert.ok(cs.length <= 6, `${cs.length} strands`);
  let worst = Infinity;
  for (const c of cs) {
    const sorted = [...c.hw].sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1]!;
    const s: number[] = [0];
    for (let i = 1; i < c.base.length; i++)
      s.push(s[i - 1]! + Math.hypot(c.base[i]![0] - c.base[i - 1]![0], c.base[i]![1] - c.base[i - 1]![1]));
    const L = s[s.length - 1]!;
    const free0 = !c.closed && deg.get(keyOf(c.base[0]!)) === 1;
    const free1 = !c.closed && deg.get(keyOf(c.base[c.base.length - 1]!)) === 1;
    c.hw.forEach((h, i) => {
      if ((free0 && s[i]! < 4 * w) || (free1 && L - s[i]! < 4 * w)) return;
      worst = Math.min(worst, h / median);
    });
  }
  assert.ok(worst >= 0.6, `thinnest / median ${worst}`);
  console.log(`koch: ${cs.length} strands (${cs.filter((c) => c.closed).length} closed), thinnest / median ${worst.toFixed(2)}`);
});
