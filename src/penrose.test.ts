import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approximant, edgeKey, patchEdges, patchSvg, penrosePatch, rhombArcs, type Rhomb } from './penrose.ts';
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

test('approximant is not implemented yet', () => {
  assert.equal(approximant(1, 1), null);
});
