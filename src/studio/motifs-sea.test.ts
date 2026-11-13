import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Pt } from '../patterns/util.ts';
import { safePathData } from '../motifgrid.ts';
import { bez, motifBounds } from './motifs.ts';
import { SEA_FAMILIES, SEA_LABELS, SEA_ROLES, bubbleCircles, fishParts, makeSeaMotif, shellForm, starfishArms } from './motifs-sea.ts';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

test('every family and seed gives safe, closed, compact paths inside the box', () => {
  for (const fam of SEA_FAMILIES) {
    assert.ok(SEA_LABELS[fam]);
    for (const seed of SEEDS) {
      const { silhouette: s, detail: d } = makeSeaMotif(fam, seed);
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
      assert.ok(Math.abs((all.minX + all.maxX) / 2 - 50) <= 14, `${at} center`);
      assert.ok(all.maxY - all.minY >= (['shell', 'starfish', 'bubbles'].includes(fam) ? 45 : 60), `${at} height`);
      assert.ok(s.d.length + d.d.length <= 1400, `${at} size ${s.d.length + d.d.length}`);
    }
  }
});

test('deterministic, seeds differ, at least 10 distinct silhouettes over 20 seeds', () => {
  for (const fam of SEA_FAMILIES) {
    assert.deepEqual(makeSeaMotif(fam, 7), makeSeaMotif(fam, 7));
    assert.notEqual(makeSeaMotif(fam, 1).silhouette.d, makeSeaMotif(fam, 2).silhouette.d, fam);
    assert.ok(new Set(SEEDS.map((s) => makeSeaMotif(fam, s).silhouette.d)).size >= 10, fam);
  }
});

test('roles use only sea families and cover every family', () => {
  const used = [...SEA_ROLES.hero, ...SEA_ROLES.support, ...SEA_ROLES.filler];
  for (const f of used) assert.ok(SEA_FAMILIES.includes(f));
  for (const f of SEA_FAMILIES) assert.ok(used.includes(f), f);
});

test('shell: all three forms occur', () => {
  assert.equal(new Set(SEEDS.map(shellForm)).size, 3);
});

test('starfish: 5 or 6 arms, both occur over 40 seeds', () => {
  const counts = new Set(Array.from({ length: 40 }, (_, i) => starfishArms(i + 1)));
  assert.deepEqual([...counts].sort(), [5, 6]);
});

test('bubbles: 3 to 6 circles, smaller toward the top', () => {
  for (const seed of SEEDS) {
    const cs = bubbleCircles(seed);
    assert.ok(cs.length >= 3 && cs.length <= 6);
    for (let i = 1; i < cs.length; i++) {
      assert.ok(cs[i]!.r < cs[i - 1]!.r, `seed ${seed}`);
      assert.ok(cs[i]!.c[1] < cs[i - 1]!.c[1], `seed ${seed}`);
    }
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

test('fish: the eye lies inside the body', () => {
  for (const seed of SEEDS) {
    const { body, eye } = fishParts(seed);
    const poly = body.flatMap((c) => Array.from({ length: 16 }, (_, k) => bez(c, k / 16)));
    assert.ok(inside(eye, poly), `seed ${seed}`);
  }
});

test('source hygiene: pure module', () => {
  const src = readFileSync(new URL('./motifs-sea.ts', import.meta.url), 'utf8');
  assert.ok(!src.includes('node:'));
  assert.ok(!src.includes('Math.random'));
});
