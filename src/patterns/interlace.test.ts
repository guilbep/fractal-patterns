import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geometry } from '../fractal.ts';
import { crossings, interlace, outlineOf, ribbonCuts, ribbonsSvg, strands } from './interlace.ts';
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
  // At a right angle the cut runs half-width 4 + outline 1.44 + gap 6 = 11.44 each side: the line y = 30 runs over
  // x = 30 or x = 90 and is cut at the other.
  assert.ok(
    ds.some((d) => d.includes('L78.6 30M101.4 30') || d.includes('L18.6 30M41.4 30')),
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

test('X through a shared vertex: one crossing there, alternation consistent', () => {
  const st = strands(
    [
      [
        [10, 20],
        [50, 40],
        [90, 60],
      ],
      [
        [10, 60],
        [50, 40],
        [90, 20],
      ],
    ],
    S,
  );
  assert.equal(st.length, 2);
  const cs = crossings(st);
  assert.equal(cs.length, 1);
  assert.deepEqual(cs[0]!.p, [50, 40]);
  assert.notEqual(cs[0]!.a.strand, cs[0]!.b.strand);
  assert.ok(Math.abs(cs[0]!.a.s - Math.hypot(40, 20)) < 1e-9);
  const { overUnder, odd } = interlace(st, cs);
  assert.deepEqual(odd, []);
  // The under strand is cut at the vertex: 2 subpaths in its strokes.
  const svg = ribbonsSvg(st, cs, overUnder, { width: 4, gap: 3, size: S, fill: '#fff', stroke: '#000' });
  const ds = [...svg.matchAll(/ d="([^"]*)"/g)].map((m) => (m[1]!.match(/M/g) ?? []).length);
  assert.deepEqual(ds.sort(), [1, 1, 2, 2]);
});

const run = (name: string, polys: Poly[]) => {
  const t0 = performance.now();
  const st = strands(polys, S);
  const cs = crossings(st);
  const { overUnder, odd } = interlace(st, cs);
  ribbonsSvg(st, cs, overUnder, { width: 4, gap: 3, size: S, fill: '#fff', stroke: '#000' });
  const ms = performance.now() - t0;
  console.log(`${name}: strands ${st.length}, crossings ${cs.length}, odd ${odd.length}, ${ms.toFixed(1)} ms`);
  assert.ok(ms < 500, `${name} ${ms} ms`);
  return { cs, odd };
};

test('star tiles weave through shared vertices', () => {
  for (const id of ['488', 'hex', 'square'] as const) {
    const { cs, odd } = run(`star ${id}`, wrap(starGenerator(id)(mulberry32(1), 2, S), S));
    assert.ok(cs.length > 0, id);
    if (id === 'square') assert.deepEqual(odd, []);
  }
});

test('truchet and hex through the vertex graph', () => {
  for (const kind of ['truchet', 'hex'] as const) run(kind, wrap(geometry({ kind, seed: 1, depth: 3, size: S }) as Poly[], S));
});

test('cut half-length: over half-width + outline + gap at a right angle, divided by sin at 60 degrees', () => {
  const clear = 3 + outlineOf(6) + 1.5;
  const st = strands(grid(), S);
  const cs = crossings(st);
  const { overUnder } = interlace(st, cs);
  const cuts = ribbonCuts(st, cs, overUnder, clear).flat();
  assert.equal(cuts.length, 4);
  for (const [a, b] of cuts) assert.ok(Math.abs(b - a - 2 * clear) < 1e-12, `${b - a}`);
  const d = 40;
  const x = [
    [
      [10, 60],
      [110, 60],
    ],
    [
      [60 - d * Math.cos(Math.PI / 3), 60 - d * Math.sin(Math.PI / 3)],
      [60 + d * Math.cos(Math.PI / 3), 60 + d * Math.sin(Math.PI / 3)],
    ],
  ] as Poly[];
  const st2 = strands(x, S);
  const cs2 = crossings(st2);
  assert.equal(cs2.length, 1);
  const [a, b] = ribbonCuts(st2, cs2, interlace(st2, cs2).overUnder, clear).flat()[0]!;
  assert.ok(Math.abs((b - a) / 2 - clear / Math.sin(Math.PI / 3)) < 1e-6, `${b - a}`);
});

test('cuts never meet on a dense tile: p4m seed 7 depth 8 keeps 10 % between crossings', () => {
  const st = strands(wrap(geometry({ kind: 'p4m', seed: 7, depth: 8, size: S }) as Poly[], S), S);
  const cs = crossings(st);
  const { overUnder } = interlace(st, cs);
  assert.ok(cs.length > 100, String(cs.length));
  const cuts = ribbonCuts(st, cs, overUnder, 3 + outlineOf(6) + 1.5);
  let checked = 0;
  // ribbonCuts adds the cuts in crossing order: each strand's k-th cut belongs to its k-th under-passage.
  const centres = cuts.map(() => [] as number[]);
  for (const c of cs) {
    const u = overUnder.get(c.id) === 'a' ? c.b : c.a;
    centres[u.strand]!.push(u.s);
  }
  cuts.forEach((l, i) => {
    const by = new Map<number, [number, number, number]>();
    l.forEach(([a, b], k) => {
      const s = centres[i]![k]!;
      const c = Math.round(s * 1e4) / 1e4;
      const o = by.get(c);
      by.set(c, o ? [Math.min(o[0], a), Math.max(o[1], b), s] : [a, b, s]);
    });
    const sorted = [...by.values()].sort((u, v) => u[2] - v[2]);
    for (let k = 1; k < sorted.length; k++) {
      const [, b0, s0] = sorted[k - 1]!;
      const [a1, , s1] = sorted[k]!;
      const span = s1 - s0;
      assert.ok(a1 - b0 >= 0.1 * span - 1e-9, `${a1 - b0} ${span}`);
      checked++;
    }
  });
  assert.ok(checked > 50, String(checked));
});
