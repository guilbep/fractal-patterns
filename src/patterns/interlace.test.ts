import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geometry } from '../fractal.ts';
import { crossings, interlace, ribbonsSvg, strands } from './interlace.ts';
import { starGenerator } from './stars.ts';
import { mulberry32, wrap, type Poly } from './util.ts';

const S = 120;

test('X inside the tile: one crossing at the intersection', () => {
  const st = strands(
    [
      [
        [10, 20],
        [90, 60],
      ],
      [
        [10, 60],
        [90, 20],
      ],
    ],
    S,
  );
  const cs = crossings(st);
  assert.equal(cs.length, 1);
  const [x, y] = cs[0]!.p;
  assert.ok(Math.abs(x - 50) < 1e-9 && Math.abs(y - 40) < 1e-9, `${x},${y}`);
  // Arc length from (10,20) to (50,40) = sqrt(40^2 + 20^2).
  assert.ok(Math.abs(cs[0]!.a.s - Math.hypot(40, 20)) < 1e-9);
});

test('a strand crossing the right edge joins its continuation from the left edge', () => {
  const line: Poly = [
    [80, 30],
    [150, 50],
  ];
  const pieces = wrap([line], S);
  assert.equal(pieces.length, 2);
  const st = strands(pieces, S);
  assert.equal(st.length, 1);
  assert.equal(st[0]!.pieces.length, 2);
  assert.equal(st[0]!.closed, false);
});

const grid = (): Poly[] =>
  wrap(
    [
      [
        [0, S / 4],
        [S, S / 4],
      ],
      [
        [0, (3 * S) / 4],
        [S, (3 * S) / 4],
      ],
      [
        [S / 4, 0],
        [S / 4, S],
      ],
      [
        [(3 * S) / 4, 0],
        [(3 * S) / 4, S],
      ],
    ],
    S,
  );

test('woven grid on the torus: 4 crossings, alternating, consistent', () => {
  const st = strands(grid(), S);
  assert.equal(st.length, 4);
  assert.ok(st.every((x) => x.closed));
  const cs = crossings(st);
  assert.equal(cs.length, 4);
  const { overUnder, odd } = interlace(st, cs);
  assert.deepEqual(odd, []);
  st.forEach((_, i) => {
    const seq = cs
      .flatMap((c) => [
        { p: c.a, over: overUnder.get(c.id) === 'a' },
        { p: c.b, over: overUnder.get(c.id) === 'b' },
      ])
      .filter((x) => x.p.strand === i)
      .sort((u, v) => u.p.s - v.p.s)
      .map((x) => x.over);
    assert.equal(seq.length, 2);
    assert.notEqual(seq[0], seq[1], `strand ${i}`);
  });
});

// Not the ticket's figure-eight (see the report): one horizontal and one vertical loop
// on the torus cross once, so each closed loop has 1 passage and cannot alternate.
test('one crossing between two closed loops: both strands odd', () => {
  const st = strands(
    wrap(
      [
        [
          [0, 60],
          [S, 60],
        ],
        [
          [60, 0],
          [60, S],
        ],
      ],
      S,
    ),
    S,
  );
  const cs = crossings(st);
  assert.equal(cs.length, 1);
  assert.deepEqual(interlace(st, cs).odd, [0, 1]);
});

test('ribbonsSvg: under-passages are cut, output well formed', () => {
  const st = strands(grid(), S);
  const cs = crossings(st);
  const { overUnder } = interlace(st, cs);
  const svg = ribbonsSvg(st, cs, overUnder, { width: 8, gap: 6, size: S, fill: '#fff', stroke: '#000' });
  assert.match(svg, /^<svg [^>]*>.*<\/svg>$/);
  assert.equal((svg.match(/<path /g) ?? []).length, 8, 'two strokes per strand');
  assert.equal((svg.match(/<use /g) ?? []).length, 8);
  assert.doesNotMatch(svg, /\d\.\d\d/, '1 decimal max');
  // Each line is one piece with 1 under-crossing in its interior: 2 subpaths per stroke.
  const ds = [...svg.matchAll(/ d="([^"]*)"/g)].map((m) => m[1]!);
  for (const d of ds) assert.equal((d.match(/M/g) ?? []).length, 2, d);
  // The cut is 2 * gap long: the line y = 30 runs over x = 30 or x = 90 and is cut at the other.
  assert.ok(
    ds.some((d) => d.includes('L84 30M96 30') || d.includes('L24 30M36 30')),
    ds.join('\n'),
  );
});

test('speed on real tiles', () => {
  const cases: [string, () => readonly (readonly (readonly [number, number])[])[]][] = [
    ['truchet', () => geometry({ kind: 'truchet', seed: 1, depth: 3, size: S })],
    ['p4m', () => geometry({ kind: 'p4m', seed: 1, depth: 3, size: S })],
    ['hex', () => geometry({ kind: 'hex', seed: 1, depth: 3, size: S })],
    ['star 488', () => starGenerator('488')(mulberry32(1), 1, S)],
  ];
  for (const [name, gen] of cases) {
    const polys = wrap(gen() as Poly[], S);
    const t0 = performance.now();
    const st = strands(polys, S);
    const cs = crossings(st);
    const { overUnder, odd } = interlace(st, cs);
    ribbonsSvg(st, cs, overUnder, { width: 4, gap: 3, size: S, fill: '#fff', stroke: '#000' });
    const ms = performance.now() - t0;
    console.log(`${name}: pieces ${polys.length}, strands ${st.length}, crossings ${cs.length}, odd ${odd.length}, ${ms.toFixed(1)} ms`);
    assert.ok(ms < 500, `${name} ${ms} ms`);
  }
});
