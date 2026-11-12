import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Pt } from '../patterns/util.ts';
import { safePathData } from '../motifgrid.ts';
import { MOTIF_FAMILIES, MOTIF_LABELS, bez, flowerPetalCount, frondParts, leafParts, makeMotif, motifBounds } from './motifs.ts';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

test('every family and seed gives safe, closed, compact paths inside the box', () => {
  for (const fam of MOTIF_FAMILIES) {
    assert.ok(MOTIF_LABELS[fam]);
    for (const seed of SEEDS) {
      const { silhouette: s, detail: d } = makeMotif(fam, seed);
      const at = `${fam} ${seed}`;
      assert.equal(s.paint, 'fill');
      assert.equal(d.paint, 'stroke');
      assert.equal(s.box, 100);
      for (const m of [s, d]) assert.ok(m.d.length > 0 && safePathData(m.d) === m.d, at);
      assert.ok(s.d.includes('Z'), at);
      const sb = motifBounds(s.d);
      assert.ok(sb.minX >= 2 && sb.minY >= 2 && sb.maxX <= 98 && sb.maxY <= 98, `${at} ${JSON.stringify(sb)}`);
      const db = motifBounds(d.d);
      assert.ok(db.minX >= 0 && db.minY >= 0 && db.maxX <= 100 && db.maxY <= 100, `${at} ${JSON.stringify(db)}`);
      const all = motifBounds(s.d + d.d);
      assert.ok(Math.abs((all.minX + all.maxX) / 2 - 50) <= 12, `${at} center`);
      assert.ok(all.maxY - all.minY >= (fam === 'berry' || fam === 'bud' ? 40 : 60), `${at} height`);
      assert.ok(s.d.length + d.d.length <= 1200, `${at} size ${s.d.length + d.d.length}`);
    }
  }
});

test('deterministic, seeds differ, at least 10 distinct silhouettes over 20 seeds', () => {
  for (const fam of MOTIF_FAMILIES) {
    assert.deepEqual(makeMotif(fam, 7), makeMotif(fam, 7));
    assert.notEqual(makeMotif(fam, 1).silhouette.d, makeMotif(fam, 2).silhouette.d, fam);
    assert.ok(new Set(SEEDS.map((s) => makeMotif(fam, s).silhouette.d)).size >= 10, fam);
  }
});

test('flower: one sub-path per seeded petal plus the disc, 5 to 8 petals, 3+ counts', () => {
  const counts = new Set<number>();
  for (const seed of SEEDS) {
    const n = flowerPetalCount(seed);
    assert.ok(n >= 5 && n <= 8);
    counts.add(n);
    assert.equal(makeMotif('flower', seed).silhouette.d.split('M').length - 1, n + 1);
  }
  assert.ok(counts.size >= 3);
});

test('frond: leaflets get smaller toward the tip', () => {
  for (const seed of SEEDS) {
    const sizes = frondParts(seed).sizes;
    assert.ok(sizes.length >= 6 && sizes.length <= 10);
    assert.ok(sizes[0]! > sizes[sizes.length - 2]! && sizes[sizes.length - 2]! > 0);
  }
});

function inside([x, y]: Pt, poly: Pt[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

test('leaf: every vein ends inside the blade', () => {
  for (const seed of SEEDS) {
    const { blade, veinEnds } = leafParts(seed);
    const poly = blade.flatMap((c) => Array.from({ length: 16 }, (_, k) => bez(c, k / 16)));
    assert.ok(veinEnds.length >= 6 && veinEnds.length <= 12);
    for (const e of veinEnds) assert.ok(inside(e, poly), `seed ${seed} ${e.join(',')}`);
  }
});

test('source hygiene: pure module', () => {
  const src = readFileSync(new URL('./motifs.ts', import.meta.url), 'utf8');
  assert.ok(!src.includes('node:'));
  assert.ok(!src.includes('Math.random'));
});
