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
  penroseArcsPath,
  penrosePatch,
  penroseTile,
  rhombArcs,
  PENROSE_ASPECT,
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
const assertSeamless = (polys: Pt[][], S: number, msg: string, SY = S) => {
  const cross = { x0: [] as number[], xS: [] as number[], y0: [] as number[], yS: [] as number[] };
  for (const poly of polys) {
    for (let i = 1; i < poly.length; i++) {
      const [ax, ay] = poly[i - 1]!;
      const [bx, by] = poly[i]!;
      for (const e of [0, S]) assert.ok(!(near(ax, e) && near(bx, e)), `${msg}: segment on x = ${e}`);
      for (const e of [0, SY]) assert.ok(!(near(ay, e) && near(by, e)), `${msg}: segment on y = ${e}`);
    }
    for (const [x, y] of poly) {
      if (near(x, 0)) cross.x0.push(y);
      if (near(x, S)) cross.xS.push(y);
      if (near(y, 0)) cross.y0.push(x);
      if (near(y, SY)) cross.yS.push(x);
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

test('penroseTile is seamless on the rectangle, deterministic, seeded and inside the tile', () => {
  const TY = T / PENROSE_ASPECT;
  for (const decorate of ['edges', 'arcs', 'both'] as const)
    for (let depth = 1; depth <= 4; depth++)
      for (let seed = 1; seed <= 5; seed++) {
        const polys = penroseTile(mulberry32(seed), depth, T, decorate);
        assertSeamless(polys, T, `${decorate} depth ${depth} seed ${seed}`, TY);
        for (const poly of polys) for (const [x, y] of poly) assert.ok(x >= -1e-9 && x <= T + 1e-9 && y >= -1e-9 && y <= TY + 1e-9);
      }
  assert.deepEqual(penroseArcs(mulberry32(1), 2, T), []);
  for (const gen of [penroseEdges, penroseBoth]) {
    assert.deepEqual(gen(mulberry32(1), 2, T), gen(mulberry32(1), 2, T));
    assert.notDeepEqual(gen(mulberry32(1), 2, T), gen(mulberry32(2), 2, T));
  }
});

test('PENROSE_ASPECT is the approximant aspect at every level, near 1.1756', () => {
  assert.ok(Math.abs(PENROSE_ASPECT - 1.1756) < 1e-3, String(PENROSE_ASPECT));
  for (let level = 1; level <= 4; level++) {
    const a = approximant(1, level);
    assert.ok(Math.abs(a.width / a.height - PENROSE_ASPECT) < 1e-9, `level ${level}`);
  }
});

test('penroseTile: one uniform scale, every edge segment has the same length', () => {
  for (let depth = 1; depth <= 4; depth++) {
    const polys = penroseTile(mulberry32(3), depth, T, 'edges');
    // Unclipped segments only: a segment cut by the tile border is shorter.
    const lens = polys.filter((p) => p.length === 2).map(([p, q]) => dist(p!, q!));
    const max = Math.max(...lens);
    const whole = lens.filter((l) => l > max - 1e-3);
    assert.ok(whole.length > lens.length / 2, `depth ${depth}`);
    for (const l of whole) assert.ok(Math.abs(l - max) < 1e-6, `depth ${depth}: ${l} vs ${max}`);
    assert.ok(Math.abs(max - T / approximant(1, depth).width) < 1e-6, `depth ${depth}: edge ${max}`);
  }
});

// The arc path, parsed and sampled independently of the generator.
const NUM = String.raw`-?\d+(?:\.\d+)?`;
const SUB = new RegExp(`M(${NUM}) (${NUM})A(${NUM}) (${NUM}) 0 0 ([01]) (${NUM}) (${NUM})`, 'g');
interface SvgArc {
  readonly s: Pt;
  readonly t: Pt;
  readonly r: number;
  readonly sweep: number;
}
const parseArcs = (d: string): SvgArc[] =>
  [...d.matchAll(SUB)].map((m) => {
    const [x0, y0, rx, ry, sw, x1, y1] = m.slice(1).map(Number) as [number, number, number, number, number, number, number];
    assert.equal(rx, ry);
    return { s: [x0, y0], t: [x1, y1], r: rx, sweep: sw };
  });
// Large-arc 0: centre on the side of the chord that makes the arc the short one.
const arcCenter = ({ s, t, r, sweep }: SvgArc): Pt => {
  const m: Pt = [(s[0] + t[0]) / 2, (s[1] + t[1]) / 2];
  const a = dist(s, t) / 2;
  const h = Math.sqrt(Math.max(0, r * r - a * a));
  const sg = sweep === 1 ? 1 : -1;
  const n: Pt = [(-(t[1] - s[1]) / (2 * a)) * sg, ((t[0] - s[0]) / (2 * a)) * sg];
  return [m[0] + h * n[0], m[1] + h * n[1]];
};
const arcSpan = (arc: SvgArc): number => {
  const o = arcCenter(arc);
  const a0 = Math.atan2(arc.s[1] - o[1], arc.s[0] - o[0]);
  const a1 = Math.atan2(arc.t[1] - o[1], arc.t[0] - o[0]);
  return mod(arc.sweep === 1 ? a1 - a0 : a0 - a1, 2 * Math.PI);
};
const sampleSvgArc = (arc: SvgArc, n = 16): Pt[] => {
  const o = arcCenter(arc);
  const a0 = Math.atan2(arc.s[1] - o[1], arc.s[0] - o[0]);
  const da = arcSpan(arc) * (arc.sweep === 1 ? 1 : -1);
  return Array.from({ length: n + 1 }, (_, i): Pt => [
    o[0] + arc.r * Math.cos(a0 + (da * i) / n),
    o[1] + arc.r * Math.sin(a0 + (da * i) / n),
  ]);
};
const segDist = (p: Pt, a: Pt, b: Pt) => {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const l2 = vx * vx + vy * vy;
  const u = l2 === 0 ? 0 : Math.min(1, Math.max(0, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / l2));
  return Math.hypot(p[0] - a[0] - u * vx, p[1] - a[1] - u * vy);
};
// Distance on the torus W x H from p to the nearest segment of any polyline; a grid of cells keeps it fast.
const torusDistance = (polys: Pt[][], W: number, H: number) => {
  const C = 10;
  const cells = new Map<string, [Pt, Pt][]>();
  for (const poly of polys)
    for (let i = 1; i < poly.length; i++) {
      const a = poly[i - 1]!;
      const b = poly[i]!;
      const k = `${Math.floor(mod((a[0] + b[0]) / 2, W) / C)},${Math.floor(mod((a[1] + b[1]) / 2, H) / C)}`;
      cells.set(k, [...(cells.get(k) ?? []), [a, b]]);
    }
  const nx = Math.ceil(W / C);
  const ny = Math.ceil(H / C);
  return (p: Pt) => {
    const q: Pt = [mod(p[0], W), mod(p[1], H)];
    const cx = Math.floor(q[0] / C);
    const cy = Math.floor(q[1] / C);
    let best = Infinity;
    // ponytail: +-3 cells covers segments up to 20 units long, the 8-segment chords at size 240.
    for (let i = -3; i <= 3; i++)
      for (let j = -3; j <= 3; j++)
        for (const [a, b] of cells.get(`${mod(cx + i, nx)},${mod(cy + j, ny)}`) ?? []) {
          // A wrapped cell lies one period away; segments are stored unreduced, so also try the +-1 shift.
          const ox = cx + i < 0 ? W : cx + i >= nx ? -W : 0;
          const oy = cy + j < 0 ? H : cy + j >= ny ? -H : 0;
          const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          const p2: Pt = [q[0] + ox + m[0] - mod(m[0], W), q[1] + oy + m[1] - mod(m[1], H)];
          best = Math.min(best, segDist(p2, a, b));
        }
    return best;
  };
};
const CASES = [1, 2, 3].flatMap((depth) => [1, 2, 3].map((seed) => ({ depth, seed, msg: `depth ${depth} seed ${seed}` })));
const TH = T / PENROSE_ASPECT;

test('penroseArcsPath is well formed: only M x y A r r 0 0 s x y sub-paths', () => {
  for (const { depth, seed, msg } of CASES) {
    const d = penroseArcsPath(mulberry32(seed), depth, T);
    assert.match(d, new RegExp(`^(?:M${NUM} ${NUM}A${NUM} ${NUM} 0 0 [01] ${NUM} ${NUM})+$`), msg);
    assert.doesNotMatch(d, /[^MA0-9 .-]/, msg);
    for (const sub of d.split('M').slice(1)) assert.equal(sub.split('A')[1]!.split(' ').length, 7, `${msg}: ${sub}`);
    const arcs = parseArcs(d);
    assert.equal(arcs.length, d.split('M').length - 1, msg);
  }
});

test('penroseArcsPath counts: two arcs per rhomb inside the tile, plus the shifted copies', () => {
  for (const { depth, seed, msg } of CASES) {
    const arcs = parseArcs(penroseArcsPath(mulberry32(seed), depth, T));
    const rhombs = approximant(Math.floor(mulberry32(seed)() * 2 ** 32), depth).rhombs.length;
    const inTile = arcs.filter((a) => {
      const [x, y] = sampleSvgArc(a)[8]!;
      return x >= 0 && x < T && y >= 0 && y < TH;
    }).length;
    if (seed === 1)
      console.log(`arcs ${msg}: ${inTile} inside (2 x ${rhombs} rhombs) + ${arcs.length - inTile} shifted copies = ${arcs.length} written`);
    assert.equal(inTile, 2 * rhombs, msg);
    assert.ok(arcs.length > inTile, msg);
  }
});

test('penroseArcsPath agrees with the polyline arcs of penroseTile on the torus', () => {
  let worstOld = 0;
  let worstNew = 0;
  let worstOldCase = '';
  let worstNewCase = '';
  for (const { depth, seed, msg } of CASES) {
    const samples = parseArcs(penroseArcsPath(mulberry32(seed), depth, T)).map((a) => sampleSvgArc(a));
    const old = penroseTile(mulberry32(seed), depth, T, 'arcs');
    const toNew = torusDistance(samples, T, TH);
    const toOld = torusDistance(old, T, TH);
    for (const poly of old)
      for (const p of poly) {
        const dd = toNew(p);
        if (dd > worstOld) [worstOld, worstOldCase] = [dd, msg];
      }
    for (const poly of samples)
      for (const p of poly) {
        const dd = toOld(p);
        if (dd > worstNew) [worstNew, worstNewCase] = [dd, msg];
      }
  }
  console.log(
    `worst old vertex to new arc: ${worstOld.toFixed(4)} (${worstOldCase}); worst new sample to old polyline: ${worstNew.toFixed(4)} (${worstNewCase})`,
  );
  // Measured 0.2851 (depth 1 seed 3): clip points of the old polyline lie on 8-segment chords.
  assert.ok(worstOld <= 0.3, `old to new ${worstOld} at ${worstOldCase}`);
  // Measured 0.3811 (depth 1 seed 1): the sagitta of a 1/8 chord of a 0.75-edge arc at size 240, r (1 - cos 9 deg).
  assert.ok(worstNew <= 0.4, `new to old ${worstNew} at ${worstNewCase}`);
});

test('penroseArcsPath seam: an arc leaving the tile is also written shifted back in', () => {
  for (const { depth, seed, msg } of CASES) {
    const arcs = parseArcs(penroseArcsPath(mulberry32(seed), depth, T));
    let checked = 0;
    for (const a of arcs) {
      const shifts = new Set<string>();
      for (const [x, y] of sampleSvgArc(a)) {
        const dx = x < 0 ? T : x > T ? -T : 0;
        const dy = y < 0 ? TH : y > TH ? -TH : 0;
        if (dx !== 0 || dy !== 0) shifts.add(`${dx},${dy}`);
      }
      for (const sh of shifts) {
        const [dx, dy] = sh.split(',').map(Number) as [number, number];
        const ok = arcs.some(
          (b) =>
            Math.abs(b.r - a.r) <= 0.11 && dist(b.s, [a.s[0] + dx, a.s[1] + dy]) <= 0.11 && dist(b.t, [a.t[0] + dx, a.t[1] + dy]) <= 0.11,
        );
        assert.ok(ok, `${msg}: arc ${JSON.stringify(a)} shift ${sh}`);
        checked++;
      }
    }
    assert.ok(checked > 0, msg);
  }
});

test('penroseArcsPath sweep: arcs are on their circle and span under 180 degrees', () => {
  for (const { depth, seed, msg } of CASES)
    for (const a of parseArcs(penroseArcsPath(mulberry32(seed), depth, T))) {
      assert.ok(dist(a.s, a.t) <= 2 * a.r + 0.15, `${msg}: chord longer than the diameter`);
      assert.ok(Math.abs(dist(sampleSvgArc(a)[8]!, arcCenter(a)) - a.r) <= 0.15, msg);
      assert.ok(arcSpan(a) < Math.PI, `${msg}: span ${(arcSpan(a) * 180) / Math.PI}`);
    }
});
