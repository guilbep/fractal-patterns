import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KINDS, KIND_FAMILY, geometry, isGrown, type Kind } from './fractal.ts';
import { cellSeed, generatePatchwork, patchworkCells, patchworkGeometry, type PatchworkParams } from './patchwork.ts';

const base: PatchworkParams = { seed: 1, cells: 3, families: [], pinned: {}, frame: false, depth: 2, size: 120 };
const style = { strokeWidth: 1, precision: 1, color: '#336699', opacity: 0.5 };
const kinds = (p: PatchworkParams): Kind[] => patchworkCells(p).map((c) => c.kind);

test('patchwork is deterministic', () => {
  assert.deepEqual(patchworkCells(base), patchworkCells(base));
  assert.equal(generatePatchwork(base, style), generatePatchwork(base, style));
});

test('cell count follows the clamped grid', () => {
  for (const [cells, n] of [
    [1, 1],
    [2, 4],
    [3, 9],
    [4, 16],
    [0, 1],
    [9, 16],
    [2.9, 4],
  ] as const) {
    assert.equal(patchworkCells({ ...base, cells }).length, n, `cells ${cells}`);
  }
});

test('every point stays inside its cell and the tile', () => {
  const eps = 1e-9;
  for (let seed = 1; seed <= 10; seed++) {
    for (const cells of [2, 3, 4]) {
      for (const c of patchworkCells({ ...base, seed, cells })) {
        for (const poly of c.polys) {
          for (const [x, y] of poly) {
            assert.ok(
              x >= c.x - eps && x <= c.x + c.size + eps && y >= c.y - eps && y <= c.y + c.size + eps,
              `${c.kind} seed ${seed} cells ${cells}`,
            );
            assert.ok(x >= -eps && x <= 120 + eps && y >= -eps && y <= 120 + eps);
          }
        }
      }
    }
  }
});

test('a 1 by 1 patchwork equals the plain kind', () => {
  assert.deepEqual(
    patchworkGeometry({ ...base, cells: 1, pinned: { 0: 'herringbone' } }),
    geometry({ kind: 'herringbone', seed: cellSeed(1, 0), depth: 2, size: 120 }),
  );
});

test('pins hold and leave the other cells alone', () => {
  const free = kinds(base);
  const pinned = kinds({ ...base, pinned: { 0: 'tree', 4: 'p4m' } });
  assert.equal(pinned[0], 'tree');
  assert.equal(pinned[4], 'p4m');
  for (let i = 0; i < 9; i++) if (i !== 0 && i !== 4) assert.equal(pinned[i], free[i], `cell ${i}`);
});

test('families restrict the kinds', () => {
  for (let seed = 1; seed <= 10; seed++) {
    for (const k of kinds({ ...base, seed, families: ['surface'] })) assert.equal(KIND_FAMILY[k], 'surface');
    for (const k of kinds({ ...base, seed, families: ['fractal', 'line'] })) assert.ok(['fractal', 'line'].includes(KIND_FAMILY[k]), k);
  }
});

test('seeds give different kinds', () => {
  assert.notDeepEqual(kinds(base), kinds({ ...base, seed: 2 }));
  const seen = new Set<Kind>();
  for (let seed = 1; seed <= 10; seed++) for (const k of kinds({ ...base, seed })) seen.add(k);
  assert.ok(seen.size >= 12, `${seen.size} distinct kinds`);
});

test('cellSeed is distinct, unsigned 32-bit and stable', () => {
  const a = Array.from({ length: 16 }, (_, i) => cellSeed(1, i));
  const b = Array.from({ length: 16 }, (_, i) => cellSeed(1, i));
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, 16);
  for (const v of a) assert.ok(Number.isInteger(v) && v >= 0 && v < 2 ** 32, String(v));
});

test('frame adds the grid lines', () => {
  const plain = patchworkGeometry(base);
  const framed = patchworkGeometry({ ...base, frame: true });
  assert.equal(framed.length - plain.length, 2 * (3 + 1));
  for (const line of framed.slice(plain.length)) {
    const onX = line.every(([x]) => x % 40 === 0 && x === line[0]![0]);
    const onY = line.every(([, y]) => y % 40 === 0 && y === line[0]![1]);
    assert.ok(onX || onY, JSON.stringify(line));
  }
});

test('patchwork SVG is well formed', () => {
  const svg = generatePatchwork(base, style);
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.endsWith('</svg>'));
  assert.ok(svg.includes('viewBox="0 0 120 120"'));
  assert.ok(svg.includes('#336699'));
  assert.ok(!svg.includes('\n'));
});

test('patchwork SVG stays under a loose size cap', () => {
  for (const cells of [2, 3]) {
    for (let seed = 1; seed <= 20; seed++) {
      const len = generatePatchwork({ ...base, seed, cells }, style).length;
      assert.ok(len <= 120000, `cells ${cells} seed ${seed}: ${len}`);
    }
  }
});

test('patchwork source has no unseeded randomness', () => {
  const src = readFileSync(join(import.meta.dirname, 'patchwork.ts'), 'utf8');
  assert.ok(!src.includes('Math.random'));
  assert.ok(!src.includes('Date.now'));
});

// A grown kind draws only in the heavy worker: on the page its cell would be blank.
test('no cell is a grown kind, auto or pinned', () => {
  const grown = KINDS.filter(isGrown);
  assert.equal(grown.length, 4);
  for (let seed = 1; seed <= 40; seed++)
    for (const cells of [2, 3, 4])
      for (const families of [[], ['theme']] as const) {
        const ks = kinds({ ...base, seed, cells, families: [...families] });
        assert.ok(!ks.some(isGrown), `${seed} ${cells} ${families}: ${ks}`);
      }
  const pinned = kinds({ ...base, pinned: { 0: 'coral', 1: 'frost', 2: 'turing-spots' } });
  assert.ok(!pinned.some(isGrown), String(pinned));
});
