import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Pt } from '../patterns/util.ts';
import { safePathData } from '../motifgrid.ts';
import { bez, motifBounds } from './motifs.ts';
import {
  ORCHARD_FAMILIES,
  ORCHARD_LABELS,
  ORCHARD_ROLES,
  cherryCount,
  cherryParts,
  makeOrchardMotif,
  orchardLeafParts,
  pearParts,
} from './motifs-orchard.ts';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

// The center of the largest closed sub-path (by bounds area): the fruit body.
function bodyCenter(d: string): Pt {
  let best = { area: -1, c: [0, 0] as Pt };
  for (const sub of d.split(/(?=M)/)) {
    if (!sub.includes('Z')) continue;
    const b = motifBounds(sub);
    const area = (b.maxX - b.minX) * (b.maxY - b.minY);
    if (area > best.area) best = { area, c: [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2] };
  }
  return best.c;
}

test('every family and seed gives safe, closed, compact paths inside the box, stalk at the base', () => {
  for (const fam of ORCHARD_FAMILIES) {
    assert.ok(ORCHARD_LABELS[fam]);
    for (const seed of SEEDS) {
      const { silhouette: s, detail: d } = makeOrchardMotif(fam, seed);
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
      assert.ok(all.maxY - all.minY >= (fam === 'blossom' ? 45 : 60), `${at} height`);
      assert.ok(s.d.length + d.d.length <= 1200, `${at} size ${s.d.length + d.d.length}`);
      // y grows downward: the stalk start is the detail's largest y, near the bottom center.
      assert.ok(db.maxY >= 98 - 6, `${at} stalk y ${db.maxY}`);
      const low = motifBounds(d.d.split(/(?=M)/).find((sub) => motifBounds(sub).maxY === db.maxY)!);
      assert.ok(Math.abs(low.minX - 50) <= 6 || Math.abs(low.maxX - 50) <= 6, `${at} stalk x`);
      const [, cy] = bodyCenter(s.d);
      assert.ok(db.maxY - cy >= (fam === 'blossom' ? 20 : 25), `${at} body ${cy} above stalk ${db.maxY}`);
    }
  }
});

test('deterministic, seeds differ, at least 10 distinct silhouettes over 20 seeds', () => {
  for (const fam of ORCHARD_FAMILIES) {
    assert.deepEqual(makeOrchardMotif(fam, 7), makeOrchardMotif(fam, 7));
    assert.notEqual(makeOrchardMotif(fam, 1).silhouette.d, makeOrchardMotif(fam, 2).silhouette.d, fam);
    assert.ok(new Set(SEEDS.map((s) => makeOrchardMotif(fam, s).silhouette.d)).size >= 10, fam);
  }
});

test('cherries: 2 or 3, both counts occur, no two cherries overlap', () => {
  const counts = new Set<number>();
  for (const seed of SEEDS) {
    const n = cherryCount(seed);
    assert.ok(n === 2 || n === 3);
    counts.add(n);
    const { cherries } = cherryParts(seed);
    assert.equal(cherries.length, n);
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const [a, b] = [cherries[i]!, cherries[j]!];
        assert.ok(Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1]) >= a.r + b.r - 1, `seed ${seed}`);
      }
  }
  assert.equal(counts.size, 2);
});

const flat = (cs: Parameters<typeof bez>[0][]) => cs.flatMap((c) => Array.from({ length: 16 }, (_, k) => bez(c, k / 16)));

// Width of a closed polygon along the horizontal line y.
function widthAt(poly: Pt[], y: number): number {
  const xs: number[] = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [[xi, yi], [xj, yj]] = [poly[i]!, poly[j]!];
    if (yi > y !== yj > y) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
  }
  return Math.max(...xs) - Math.min(...xs);
}

test('pear: the far half is wider than the neck half', () => {
  for (const seed of SEEDS) {
    const poly = flat(pearParts(seed).body);
    const ys = poly.map((p) => p[1]);
    const [top, bottom] = [Math.min(...ys), Math.max(...ys)];
    const h = bottom - top;
    assert.ok(widthAt(poly, bottom - 0.7 * h) > widthAt(poly, bottom - 0.3 * h), `seed ${seed}`);
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

test('orchardleaf: every vein ends inside the blade', () => {
  for (const seed of SEEDS) {
    const { blade, veinEnds } = orchardLeafParts(seed);
    const poly = flat(blade);
    assert.ok(veinEnds.length >= 8 && veinEnds.length <= 12);
    for (const e of veinEnds) assert.ok(inside(e, poly), `seed ${seed} ${e.join(',')}`);
  }
});

test('roles use only orchard ids and cover every family', () => {
  const used = [...ORCHARD_ROLES.hero, ...ORCHARD_ROLES.support, ...ORCHARD_ROLES.filler];
  for (const id of used) assert.ok(ORCHARD_FAMILIES.includes(id));
  for (const fam of ORCHARD_FAMILIES) assert.ok(used.includes(fam), fam);
});

test('source hygiene: pure module', () => {
  const src = readFileSync(new URL('./motifs-orchard.ts', import.meta.url), 'utf8');
  assert.ok(!src.includes('node:'));
  assert.ok(!src.includes('Math.random'));
});
