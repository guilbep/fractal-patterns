import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  approximant,
  edgeKey,
  gridNormals,
  patchEdges,
  patchSvg,
  penroseArcs,
  penroseBoth,
  penroseEdges,
  penrosePatch,
  penroseTile,
  rhombArcs,
  tilePlan,
  torusEdgeKey,
  type Rhomb,
} from './penrose.ts';
import { mulberry32, type Pt } from './patterns/util.ts';

const dist = (p: Pt, q: Pt) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const center = (r: Rhomb): Pt => [(r.points[0][0] + r.points[2][0]) / 2, (r.points[0][1] + r.points[2][1]) / 2];
const angle = (o: Pt, p: Pt, q: Pt) => {
  const a = [p[0] - o[0], p[1] - o[1]];
  const b = [q[0] - o[0], q[1] - o[1]];
  return (Math.acos((a[0]! * b[0]! + a[1]! * b[1]!) / Math.hypot(a[0]!, a[1]!) / Math.hypot(b[0]!, b[1]!)) * 180) / Math.PI;
};
const edgeCounts = (rhombs: Rhomb[]) => {
  const m = new Map<string, number>();
  for (const r of rhombs)
    for (let i = 0; i < 4; i++)
      m.set(edgeKey(r.points[i]!, r.points[(i + 1) % 4]!), (m.get(edgeKey(r.points[i]!, r.points[(i + 1) % 4]!)) ?? 0) + 1);
  return m;
};
// Inner disc of a radius-R patch, in tiling units.
const inner = (R: number) => R / 2;

test('every rhomb has unit sides and Penrose angles matching its flag', () => {
  for (const r of penrosePatch(7, 4)) {
    const [a, b, c, d] = r.points;
    for (const [p, q] of [
      [a, b],
      [b, c],
      [c, d],
      [d, a],
    ] as const)
      assert.ok(Math.abs(dist(p, q) - 1) < 1e-9);
    const t = angle(a, b, d);
    const want = r.fat ? 72 : 144;
    assert.ok(Math.abs(t - want) < 1e-6, `angle ${t} want ${want}`);
    assert.ok(Math.abs(angle(b, a, c) - (180 - want)) < 1e-6);
  }
});

test('edges are shared by at most two rhombs, exactly two in the inner disc', () => {
  const R = 4;
  const rh = penrosePatch(7, R);
  const m = edgeCounts(rh);
  for (const n of m.values()) assert.ok(n <= 2);
  let checked = 0;
  for (const r of rh) {
    if (Math.hypot(...center(r)) > inner(R)) continue;
    for (let i = 0; i < 4; i++) assert.equal(m.get(edgeKey(r.points[i]!, r.points[(i + 1) % 4]!)), 2);
    checked++;
  }
  assert.ok(checked > 10);
});

const inside = (pt: Pt, r: Rhomb): number => {
  // +1 inside, 0 outside, NaN near an edge.
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const p = r.points[i]!;
    const q = r.points[(i + 1) % 4]!;
    const cr = ((q[0] - p[0]) * (pt[1] - p[1]) - (q[1] - p[1]) * (pt[0] - p[0])) / dist(p, q);
    if (Math.abs(cr) < 1e-6) return NaN;
    const s = Math.sign(cr);
    if (sign !== 0 && s !== sign) return 0;
    sign = s;
  }
  return 1;
};

test('no overlap and no gap: seeded points in the inner disc lie in exactly one rhomb', () => {
  const R = 4;
  const rh = penrosePatch(3, R);
  const rnd = mulberry32(99);
  let n = 0;
  while (n < 200) {
    const a = rnd() * 2 * Math.PI;
    const rr = inner(R) * Math.sqrt(rnd());
    const pt: Pt = [rr * Math.cos(a), rr * Math.sin(a)];
    const hits = rh.map((r) => inside(pt, r));
    if (hits.some(Number.isNaN)) continue;
    assert.equal(
      hits.reduce((s, h) => s + h, 0),
      1,
    );
    n++;
  }
});

test('fat to thin ratio is near the golden ratio', () => {
  const rh = penrosePatch(5, 10).filter((r) => Math.hypot(...center(r)) < 10);
  const fat = rh.filter((r) => r.fat).length;
  const ratio = fat / (rh.length - fat);
  console.log(`fat/thin in radius-10 disc: ${ratio.toFixed(4)} (${fat}/${rh.length - fat})`);
  assert.ok(Math.abs(ratio / 1.6180339887 - 1) < 0.06);
});

test('deterministic, and seeds differ', () => {
  assert.deepEqual(penrosePatch(1, 3), penrosePatch(1, 3));
  assert.notDeepEqual(penrosePatch(1, 3), penrosePatch(2, 3));
});

test('arcs of neighbouring rhombs meet at shared edge points', () => {
  const R = 6;
  const rh = penrosePatch(11, R);
  const k = ([x, y]: Pt) => `${Math.round(x * 1e5)},${Math.round(y * 1e5)}`;
  const ends = new Map<string, number>();
  const arcs = rh.map((r) => rhombArcs(r, 2));
  for (const a of arcs) for (const poly of a) for (const p of [poly[0]!, poly[poly.length - 1]!]) ends.set(k(p), (ends.get(k(p)) ?? 0) + 1);
  rh.forEach((r, i) => {
    if (Math.hypot(...center(r)) > inner(R)) return;
    for (const poly of arcs[i]!) for (const p of [poly[0]!, poly[poly.length - 1]!]) assert.equal(ends.get(k(p)), 2);
  });
  // Not a trivial rule: fat rhombs carry both radii.
  for (const r of rh.filter((x) => x.fat)) {
    const [a, c] = rhombArcs(r, 2);
    const radii = [dist(a![0]!, r.points[0]), dist(c![0]!, r.points[2])].sort();
    assert.deepEqual(
      radii.map((x) => x.toFixed(6)),
      ['0.250000', '0.750000'],
    );
  }
});

test('patchEdges has no duplicates; patchSvg is one compact line', () => {
  const rh = penrosePatch(4, 6);
  const edges = patchEdges(rh);
  const keys = edges.map(([p, q]) => edgeKey(p!, q!));
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(keys.length, edgeCounts(rh).size);
  const svg = patchSvg(rh, { size: 480, strokeWidth: 1.2, precision: 1, color: '#336699', opacity: 1, decorate: 'edges' });
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(!svg.includes('\n'));
  assert.equal((svg.match(/<path /g) ?? []).length, 1);
  console.log(`patchSvg radius 6 edges: ${svg.length} bytes`);
});

const FIB = [1, 1, 2, 3, 5, 8, 13, 21];
const S72 = Math.sin((2 * Math.PI) / 5);
const C72 = Math.cos((2 * Math.PI) / 5);
const C144 = Math.cos((4 * Math.PI) / 5);
const S144 = Math.sin((4 * Math.PI) / 5);
const mod = (v: number, m: number) => v - Math.floor(v / m) * m;

test('approximant: crossing count, unit rhombs, Penrose angles, period formulas', () => {
  for (let level = 1; level <= 5; level++) {
    const p = FIB[level + 1]!;
    const q = FIB[level]!;
    // Crossings of families j, l in the cell = |det| of the integer shifts of T1, T2 (lattice index).
    const G = gridNormals(p, q);
    const n1 = G.map(([x]) => x * 2 * q);
    const n2 = G.map(([, y]) => (y * p) / S72);
    let crossings = 0;
    for (let j = 0; j < 5; j++) for (let l = j + 1; l < 5; l++) crossings += Math.round(Math.abs(n1[j]! * n2[l]! - n1[l]! * n2[j]!));
    for (let seed = 1; seed <= 3; seed++) {
      const a = approximant(seed, level);
      assert.equal(a.rhombs.length, crossings, `level ${level} seed ${seed}`);
      assert.ok(Math.abs(a.width - (2 * q + 2 * (p - q) * C72 - 2 * p * C144)) < 1e-9);
      assert.ok(Math.abs(a.height - (2 * p * S72 + 2 * q * S144)) < 1e-9);
      for (const r of a.rhombs) {
        const [w, x, y, z] = r.points;
        for (const [u, v] of [
          [w, x],
          [x, y],
          [y, z],
          [z, w],
        ] as const)
          assert.ok(Math.abs(dist(u, v) - 1) < 1e-9);
        assert.ok(Math.abs(angle(w, x, z) - (r.fat ? 72 : 144)) < 1e-6);
      }
    }
  }
});

const torusEdgeCounts = (a: ReturnType<typeof approximant>) => {
  const m = new Map<string, number>();
  for (const r of a.rhombs)
    for (let i = 0; i < 4; i++) {
      const k = torusEdgeKey(r.points[i]!, r.points[(i + 1) % 4]!, a.width, a.height);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
  return m;
};

test('approximant tiles the torus: edges shared twice, points covered once, area matches', () => {
  for (let level = 1; level <= 5; level++) {
    for (let seed = 1; seed <= 3; seed++) {
      const a = approximant(seed, level);
      const msg = `level ${level} seed ${seed}`;
      for (const n of torusEdgeCounts(a).values()) assert.equal(n, 2, msg);
      const fat = a.rhombs.filter((r) => r.fat).length;
      const area = fat * S72 + (a.rhombs.length - fat) * Math.sin(Math.PI / 5);
      assert.ok(Math.abs(area - a.width * a.height) < 1e-6, msg);
      const copies: Rhomb[] = [];
      for (const ox of [-1, 0, 1])
        for (const oy of [-1, 0, 1])
          for (const r of a.rhombs)
            copies.push({
              ...r,
              points: r.points.map(([x, y]): Pt => [x + ox * a.width, y + oy * a.height]) as unknown as Rhomb['points'],
            });
      const rnd = mulberry32(level * 10 + seed);
      let n = 0;
      while (n < 300) {
        const pt: Pt = [rnd() * a.width, rnd() * a.height];
        const hits = copies.map((r) => inside(pt, r));
        if (hits.some(Number.isNaN)) continue;
        assert.equal(
          hits.reduce((s, h) => s + h, 0),
          1,
          msg,
        );
        n++;
      }
    }
  }
});

test('approximant fat to thin ratio approaches the golden ratio; arc ends matched', () => {
  // Measured share of matched arc ends per level (seed 1): 94.4, 97.9, 99.2, 99.7, 99.9 percent.
  const minMatched = [0, 0.9, 0.95, 0.95, 0.95, 0.95];
  for (let level = 1; level <= 5; level++) {
    const a = approximant(1, level);
    const fat = a.rhombs.filter((r) => r.fat).length;
    const ratio = fat / (a.rhombs.length - fat);
    const W = Math.round(a.width * 1e5);
    const H = Math.round(a.height * 1e5);
    const k = ([x, y]: Pt) => `${Math.round(mod(x, a.width) * 1e5) % W},${Math.round(mod(y, a.height) * 1e5) % H}`;
    const ends: string[] = [];
    for (const r of a.rhombs) for (const poly of rhombArcs(r, 2)) ends.push(k(poly[0]!), k(poly[poly.length - 1]!));
    const count = new Map<string, number>();
    for (const e of ends) count.set(e, (count.get(e) ?? 0) + 1);
    const matched = ends.filter((e) => count.get(e) === 2).length / ends.length;
    console.log(`level ${level}: fat/thin ${ratio.toFixed(4)}, matched arc ends ${(matched * 100).toFixed(1)}%`);
    if (level >= 3) assert.ok(Math.abs(ratio - 1.618) < 0.2);
    assert.ok(matched >= minMatched[level]!, `level ${level}: ${matched}`);
  }
});

const T = 240;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
// Seam check copied from src/patterns/themes.test.ts.
const assertSeamless = (polys: Pt[][], S: number, msg: string) => {
  const cross = { x0: [] as number[], xS: [] as number[], y0: [] as number[], yS: [] as number[] };
  for (const poly of polys) {
    for (let i = 1; i < poly.length; i++) {
      const [ax, ay] = poly[i - 1]!;
      const [bx, by] = poly[i]!;
      for (const e of [0, S]) {
        assert.ok(!(near(ax, e) && near(bx, e)), `${msg}: segment on x = ${e}`);
        assert.ok(!(near(ay, e) && near(by, e)), `${msg}: segment on y = ${e}`);
      }
    }
    for (const [x, y] of poly) {
      if (near(x, 0)) cross.x0.push(y);
      if (near(x, S)) cross.xS.push(y);
      if (near(y, 0)) cross.y0.push(x);
      if (near(y, S)) cross.yS.push(x);
    }
  }
  const same = (a: number[], b: number[], side: string) => {
    a.sort((p, q) => p - q);
    b.sort((p, q) => p - q);
    assert.equal(a.length, b.length, `${msg}: ${side} count`);
    a.forEach((v, i) => assert.ok(near(v, b[i]!), `${msg}: ${side} ${v} vs ${b[i]}`));
  };
  same(cross.x0, cross.xS, 'x');
  same(cross.y0, cross.yS, 'y');
};

test('penroseTile is seamless, deterministic, seeded and inside the tile', () => {
  for (const decorate of ['edges', 'arcs', 'both'] as const)
    for (let depth = 1; depth <= 4; depth++)
      for (let seed = 1; seed <= 5; seed++) {
        const polys = penroseTile(mulberry32(seed), depth, T, decorate);
        assertSeamless(polys, T, `${decorate} depth ${depth} seed ${seed}`);
        for (const poly of polys) for (const [x, y] of poly) assert.ok(x >= 0 && x <= T && y >= 0 && y <= T);
      }
  for (const gen of [penroseEdges, penroseArcs, penroseBoth]) {
    assert.deepEqual(gen(mulberry32(1), 2, T), gen(mulberry32(1), 2, T));
    assert.notDeepEqual(gen(mulberry32(1), 2, T), gen(mulberry32(2), 2, T));
  }
  for (let depth = 1; depth <= 4; depth++) console.log(`penroseTile depth ${depth}:`, JSON.stringify(tilePlan(depth)));
});
