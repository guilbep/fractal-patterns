import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { customGeometry, decodeMotif, encodeMotif, normalizeStroke, type CustomMotif } from './custom.ts';
import { GROUP_OPS, GROUPS } from './patterns/symmetry.ts';
import { mulberry32, type Pt } from './patterns/util.ts';

const MOTIF: CustomMotif = {
  strokes: [
    [
      [0.2, 0.2],
      [0.2, 0.8],
      [0.5, 0.8],
    ],
    [
      [0.6, 0.3],
      [0.8, 0.45],
    ],
  ],
};

const segDist = ([px, py]: Pt, [ax, ay]: Pt, [bx, by]: Pt): number => {
  const dx = bx - ax;
  const dy = by - ay;
  const l = dx * dx + dy * dy;
  const t = l === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};

test('every group: points finite, inside the tile, not empty', () => {
  assert.equal(GROUPS.length, 12);
  for (const g of GROUPS) {
    const out = customGeometry(MOTIF, g, 1, 120);
    assert.ok(out.length > 0, g);
    for (const poly of out)
      for (const [x, y] of poly) assert.ok(Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 120 && y >= 0 && y <= 120, g);
  }
});

test('every group: the result is invariant under every op of the group (modulo the cell)', () => {
  for (const g of GROUPS) {
    const cell = customGeometry(MOTIF, g, 1, 120).map((poly) => poly.map(([x, y]): Pt => [x / 120, y / 120]));
    const pts = cell.flat();
    const rnd = mulberry32(7);
    const sample = Array.from({ length: 40 }, () => pts[Math.floor(rnd() * pts.length)]!);
    for (const p of sample) {
      for (const op of GROUP_OPS[g]!) {
        const q = op(p);
        let best = Infinity;
        for (const ox of [-1, 0, 1])
          for (const oy of [-1, 0, 1])
            for (const poly of cell)
              for (let i = 1; i < poly.length; i++) best = Math.min(best, segDist([q[0] + ox, q[1] + oy], poly[i - 1]!, poly[i]!));
        assert.ok(best < 1e-6, `${g}: image of ${p.join(',')} is ${best} off`);
      }
    }
  }
});

test('p1 with one stroke is that stroke scaled by the tile', () => {
  const out = customGeometry(
    {
      strokes: [
        [
          [0.1, 0.2],
          [0.8, 0.6],
        ],
      ],
    },
    'p1',
    1,
    120,
  );
  assert.equal(out.length, 1);
  const want = [
    [12, 24],
    [96, 72],
  ];
  assert.equal(out[0]!.length, 2);
  out[0]!.forEach((p, i) => p.forEach((v, k) => assert.ok(Math.abs(v - want[i]![k]!) < 1e-9)));
});

test('cells 2 gives 4 times the polylines of cells 1; cells are clamped to 1..4', () => {
  assert.equal(customGeometry(MOTIF, 'p1', 2, 120).length, 4 * customGeometry(MOTIF, 'p1', 1, 120).length);
  assert.deepEqual(customGeometry(MOTIF, 'p1', 0, 120), customGeometry(MOTIF, 'p1', 1, 120));
  assert.deepEqual(customGeometry(MOTIF, 'p1', 9, 120), customGeometry(MOTIF, 'p1', 4, 120));
});

test('unknown group falls back to p1; empty motif gives []', () => {
  assert.deepEqual(customGeometry(MOTIF, 'nope', 1, 120), customGeometry(MOTIF, 'p1', 1, 120));
  assert.deepEqual(customGeometry({ strokes: [] }, 'p4m', 2, 120), []);
});

test('normalizeStroke: straight line, clamping, duplicates', () => {
  const line = Array.from({ length: 200 }, (_, i): Pt => [i / 199, 0.5 * (i / 199)]);
  assert.equal(normalizeStroke(line).length, 2);
  assert.deepEqual(
    normalizeStroke([
      [-1, 2],
      [0.5, 0.5],
    ]),
    [
      [0, 1],
      [0.5, 0.5],
    ],
  );
  assert.deepEqual(
    normalizeStroke([
      [0.1, 0.1],
      [0.1, 0.1],
      [0.1, 0.1],
      [0.9, 0.2],
    ]),
    [
      [0.1, 0.1],
      [0.9, 0.2],
    ],
  );
  assert.equal(normalizeStroke([[0.3, 0.3]]).length, 1);
});

test('encodeMotif / decodeMotif round trip within 1/999', () => {
  assert.equal(
    encodeMotif({
      strokes: [
        [
          [0, 0],
          [0.5, 0.5],
        ],
      ],
    }),
    '0.0.500.500',
  );
  const rnd = mulberry32(42);
  for (let k = 0; k < 20; k++) {
    const m: CustomMotif = {
      strokes: Array.from({ length: 1 + Math.floor(rnd() * 5) }, () =>
        Array.from({ length: 2 + Math.floor(rnd() * 8) }, (): Pt => [rnd(), rnd()]),
      ),
    };
    const back = decodeMotif(encodeMotif(m));
    assert.equal(back.strokes.length, m.strokes.length);
    back.strokes.forEach((s, i) => {
      assert.equal(s.length, m.strokes[i]!.length);
      s.forEach((p, j) => p.forEach((v, c) => assert.ok(Math.abs(v - m.strokes[i]![j]![c]!) <= 1 / 999)));
    });
  }
});

test('decodeMotif never throws on hostile input and respects the caps', () => {
  assert.deepEqual(decodeMotif('').strokes, []);
  const hostile = [
    'abc',
    '1.2.3',
    '_._',
    '99999.5',
    '99999.5.3.3',
    '9'.repeat(100000),
    '1.2.3.4_'.repeat(20000),
    '..__..1..2...3.4',
    '<script>1.2.3.4</script>',
  ];
  for (const s of hostile) {
    const m = decodeMotif(s);
    assert.ok(m.strokes.length <= 40);
    assert.ok(m.strokes.reduce((n, st) => n + st.length, 0) <= 400);
    for (const st of m.strokes) {
      assert.ok(st.length >= 2);
      for (const [x, y] of st) assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1);
    }
  }
  assert.deepEqual(decodeMotif('abc').strokes, []);
  assert.deepEqual(decodeMotif('1.2.3').strokes, []);
  assert.deepEqual(decodeMotif('99999.5.3.3').strokes, [
    [
      [1, 5 / 999],
      [3 / 999, 3 / 999],
    ],
  ]);
  assert.equal(decodeMotif('1.2.3.4_'.repeat(20000)).strokes.length, 40);
  assert.equal(
    decodeMotif(Array.from({ length: 30 }, () => '1.2.'.repeat(30) + '1.2').join('_')).strokes.reduce((n, s) => n + s.length, 0),
    400,
  );
});

test('custom.ts source hygiene', () => {
  const src = readFileSync(new URL('./custom.ts', import.meta.url), 'utf8');
  for (const bad of ['node:', 'document', 'Math.random']) assert.ok(!src.includes(bad), bad);
});
