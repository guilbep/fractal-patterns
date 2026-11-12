import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { arrange, motifGridBytes, motifGridSvg, parseMotifs, safePathData, type MotifGridOptions } from './motifgrid.ts';

const REF = '/Users/guilbert/works/git/github/co2-calculator/frontend/src/assets/login-img.svg';

function torusOk(order: readonly number[], n: number): boolean {
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const v = order[r * n + c];
      if (v === order[r * n + ((c + 1) % n)] || v === order[((r + 1) % n) * n + c]) return false;
    }
  return true;
}

const count = (s: string, sub: string): number => s.split(sub).length - 1;

test('safePathData accepts path data and rejects anything else', () => {
  assert.equal(safePathData(' M0 0h4v4H0z '), 'M0 0h4v4H0z');
  assert.equal(safePathData('m10.6 18.2 5.1-6.2h-4l.7-5.9z'), 'm10.6 18.2 5.1-6.2h-4l.7-5.9z');
  for (const bad of ['', 'L0 0', 'M0 0"><script>', 'M0 0 url(x)', 'M' + '0'.repeat(20000)]) {
    assert.equal(safePathData(bad), null, bad.slice(0, 20));
  }
});

test('parseMotifs keeps the icon paths only', () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 12" width="300">' +
    '<path fill="#fff" d="M0 0h16v16H0z"/><script>alert(1)</script>' +
    '<path fill="red" d="M1 1h4v4H1z"/><g><path d="m2 2 3 3z" stroke="blue"/></g>' +
    '<path d="M0 0 url(javascript:x)"/></svg>';
  assert.deepEqual(parseMotifs(svg), [
    { d: 'M1 1h4v4H1z', box: 16 },
    { d: 'm2 2 3 3z', box: 16 },
  ]);
  assert.deepEqual(parseMotifs('not an svg <<< "'), []);
  assert.equal(parseMotifs(svg, 1).length, 1);
});

test('arrange: no equal neighbors on the torus, deterministic, even', () => {
  for (let k = 3; k <= 8; k++)
    for (let n = 3; n <= 8; n++)
      for (let seed = 1; seed <= 5; seed++) {
        const o = arrange(k, n, seed);
        assert.equal(o.length, n * n);
        assert.ok(o.every((v) => Number.isInteger(v) && v >= 0 && v < k));
        assert.ok(torusOk(o, n), `k=${k} n=${n} seed=${seed}`);
        assert.deepEqual(arrange(k, n, seed), o);
        const used = Array.from({ length: k }, (_, m) => o.filter((v) => v === m).length);
        assert.ok(Math.max(...used) - Math.min(...used) <= 2, `uneven k=${k} n=${n} seed=${seed}`);
      }
  assert.ok(torusOk(arrange(2, 4, 1), 4));
  assert.deepEqual(arrange(1, 3, 1), Array<number>(9).fill(0));
});

const tiny: MotifGridOptions = {
  motifs: ['M0 0h4v4H0z', 'M0 0h4L2 4z', 'M2 0l2 4H0z'].map((d) => ({ d, box: 4 })),
  cells: 3,
  pitch: 6,
  offset: 1,
  order: arrange(3, 3, 1),
  color: '#336699',
  background: '#ffffff',
  opacity: 1,
};

test('motifGridSvg writes each motif once and one use per cell', () => {
  const s = motifGridSvg(tiny);
  assert.ok(s.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">'));
  assert.ok(s.includes('<path fill="#ffffff" d="M0 0h18v18H0z"/>'));
  assert.equal(count(s, '<path id='), 3);
  assert.equal(count(s, '<use '), 9);
  assert.match(s, /<use [^>]*transform="translate\(1 1\)"/);
  assert.ok(s.includes('<g fill="#336699">'));
  assert.ok(!s.includes('\n'));
  assert.ok(!s.includes('scale('));
  const big = motifGridSvg({ ...tiny, pitch: 10 });
  assert.equal(count(big, ' scale(2)'), 9);
});

test('motifGridSvg falls back on a bad color and skips an unsafe motif', () => {
  assert.ok(motifGridSvg({ ...tiny, color: 'red"><script>' }).includes('<g fill="#000000">'));
  const motifs = [...tiny.motifs.slice(0, 2), { d: 'M0 0"><script>', box: 4 }];
  const s = motifGridSvg({ ...tiny, motifs });
  assert.ok(!s.includes('script'));
  assert.equal(count(s, '<path id='), 2);
  assert.equal(count(s, '<use '), tiny.order.filter((m) => m !== 2).length);
});

test('motifGridBytes: <use> is at least 4 times smaller than the expanded picture', () => {
  const d = 'M0 0' + ' l1 1'.repeat(59) + 'z';
  assert.equal(d.length, 300);
  const motifs = Array.from({ length: 7 }, () => ({ d, box: 24 }));
  const b = motifGridBytes({ ...tiny, motifs, cells: 7, pitch: 34, offset: 5, order: arrange(7, 7, 1) });
  // 49 uses of ~50 bytes cost about as much as 7 x 300 bytes of defs, so 300
  // character motifs reach a factor of ~3.6, not 4; from 400 characters it is above 4.
  assert.ok(b.svg * 3.5 <= b.expanded, `${b.svg} vs ${b.expanded}`);
  const d4 = 'M0 0' + ' l1 1'.repeat(79) + 'z';
  const b4 = motifGridBytes({
    ...tiny,
    motifs: motifs.map(() => ({ d: d4, box: 24 })),
    cells: 7,
    pitch: 34,
    offset: 5,
    order: arrange(7, 7, 1),
  });
  assert.ok(b4.svg * 4 <= b4.expanded, `${b4.svg} vs ${b4.expanded}`);
});

test('reproduces the hand-optimized reference file', { skip: !existsSync(REF) }, () => {
  const file = readFileSync(REF, 'utf8');
  // The root has width="238" and no viewBox; the icons are drawn in 24 x 24, so pass the box.
  const motifs = parseMotifs(file, 24, 24);
  assert.equal(motifs.length, 7);
  assert.ok(motifs.every((m) => m.box === 24));
  const uses = [...file.matchAll(/<use href="#([a-z])" transform="(translate\([^)]*\))"\/>/g)];
  assert.equal(uses.length, 49);
  const order = uses.map((u) => (u[1] ?? '').charCodeAt(0) - 97);
  const s = motifGridSvg({
    motifs,
    cells: 7,
    pitch: 34,
    offset: 5,
    order,
    color: '#ff0000',
    background: '#ffffff',
    opacity: 1,
  });
  assert.equal(count(s, '<path id='), 7);
  const ours = [...s.matchAll(/<use href="#([a-z])" transform="(translate\([^)]*\))"\/>/g)];
  assert.deepEqual(
    ours.map((u) => u[2]),
    uses.map((u) => u[2]),
  );
  for (const m of file.matchAll(/<path id="([a-g])"[^>]*\sd="([^"]*)"/g)) {
    assert.ok(s.includes(`<path id="${m[1]}" d="${m[2]}"/>`), `motif ${m[1]}`);
  }
  const size = Buffer.byteLength(s);
  assert.ok(Math.abs(size - 5227) <= 5227 * 0.05, `${size} bytes`);
  for (let seed = 1; seed <= 3; seed++) assert.ok(torusOk(arrange(7, 7, seed), 7));
});
