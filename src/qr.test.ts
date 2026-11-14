import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qrByteCapacity, qrMatrix, qrSvg } from './qr.ts';

const finderOk = (m: boolean[][], top: number, left: number): boolean => {
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < 7; x++) {
      const d = Math.max(Math.abs(x - 3), Math.abs(y - 3));
      if (m[top + y]![left + x] !== (d !== 2)) return false;
    }
  return true;
};

test('HELLO at M is version 1 with finders and timing in place', () => {
  const m = qrMatrix('HELLO', 'M');
  assert.equal(m.length, 21);
  assert.ok(m.every((r) => r.length === 21));
  assert.ok(finderOk(m, 0, 0));
  assert.ok(finderOk(m, 0, 14));
  assert.ok(finderOk(m, 14, 0));
  for (let x = 8; x <= 12; x++) assert.equal(m[6]![x], x % 2 === 0);
});

test('byte capacities match the standard table at M', () => {
  assert.deepEqual(
    [5, 6, 15, 17, 19, 20, 21, 40].map((v) => qrByteCapacity(v, 'M')),
    [84, 106, 412, 504, 624, 666, 711, 2331],
  );
  assert.equal(qrByteCapacity(40, 'L'), 2953);
});

test('the smallest version that fits is chosen', () => {
  assert.equal(qrMatrix('a'.repeat(84)).length, 37); // v5 holds 84
  assert.equal(qrMatrix('a'.repeat(100)).length, 41); // v6
  const url = 'https://example.com/#' + 'x'.repeat(600 - 21);
  assert.equal(url.length, 600);
  assert.equal(qrMatrix(url).length, 93); // v18 holds 560, v19 holds 624
});

// Frozen output; the PNG of this matrix decodes to "https://example.com" with
// macOS CoreImage (CIDetector), an independent decoder.
const EXAMPLE = [
  '#######.#.#.#.#...#######',
  '#.....#..##.###.#.#.....#',
  '#.###.#.###..#..#.#.###.#',
  '#.###.#..#..###...#.###.#',
  '#.###.#..#.#..#...#.###.#',
  '#.....#.##.##.#...#.....#',
  '#######.#.#.#.#.#.#######',
  '.........#..#.###........',
  '#.#...##..#####.#..#..#.#',
  '##.###..######.#.###.#.##',
  '#..#.###.###...#.#..###.#',
  '.#..##..######..#..#.#...',
  '...######.#.##.##.##....#',
  '.##.#...###.#..##.##...##',
  '###.###.#...#######..##.#',
  '.......#.#.##.#.##.###...',
  '##..#.##.#...##.#####..#.',
  '........#....##.#...#...#',
  '#######.#.##....#.#.#...#',
  '#.....#......#.##...#..##',
  '#.###.#..#.###.######..##',
  '#.###.#..#..#....#..#.##.',
  '#.###.#.##..######.###.##',
  '#.....#..#.##.#######....',
  '#######.###..##.#.#..#..#',
];

test('https://example.com at M matches the decoded reference', () => {
  const m = qrMatrix('https://example.com', 'M');
  assert.deepEqual(
    m.map((r) => r.map((b) => (b ? '#' : '.')).join('')),
    EXAMPLE,
  );
});

test('too long text throws', () => {
  assert.throws(() => qrMatrix('a'.repeat(3000), 'M'), {
    name: 'RangeError',
    message: 'This link is too long for a QR code.',
  });
});

test('qrSvg has a viewBox with a 4-module quiet zone and the title', () => {
  const n = qrMatrix('https://example.com').length;
  const svg = qrSvg('https://example.com', { title: 'Open on <phone>' });
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes(`viewBox="0 0 ${n + 8} ${n + 8}"`));
  assert.ok(svg.includes('<title>Open on &lt;phone&gt;</title>'));
  assert.ok(svg.includes('role="img"'));
  assert.ok(svg.includes('shape-rendering="crispEdges"'));
  const root = svg.slice(0, svg.indexOf('>'));
  assert.ok(!root.includes(' width=') && !root.includes(' height='));
  assert.equal((svg.match(/<path/g) ?? []).length, 1);
});
