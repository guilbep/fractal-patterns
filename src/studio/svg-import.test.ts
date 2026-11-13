import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { safePathData } from '../motifgrid.ts';
import { basicShapePath, importSvg, parseColor, pathBounds, strokeShapes, toTraceResult, transformPath } from './svg-import.ts';

const REF = process.env['FP_REFERENCE_SVG'] ?? '';
const svg = (body: string, root = 'viewBox="0 0 200 100"') => `<svg xmlns="http://www.w3.org/2000/svg" ${root}>${body}</svg>`;

test('reads the shapes of a mixed file and drops everything unsafe', () => {
  const text = svg(`
    <rect x="0" y="0" width="200" height="100" fill="#fff"/>
    <circle cx="40" cy="50" r="20" fill="red" onclick="alert(1)"/>
    <path d="M 80 20 L 120 20 L 100 80 Z" fill="#008000"/>
    <g fill="#00f"><polygon points="130,20 150,20 140,40"/><polygon points="150,60 170,60 160,80"/></g>
    <script>alert("<path d='M0 0L1 1'/>")</script>
    <text x="10" y="10">hi</text>
    <path d="M0 0 L 10 10" transform="rotate(10)" fill="red"/>
    <rect x="175" y="10" width="20" height="20" style="fill: teal; stroke: #000; stroke-width: 2"/>`);
  const r = importSvg(text)!;
  assert.deepEqual(
    r.shapes.map((s) => [s.color, s.paint]),
    [
      ['#ff0000', 'fill'],
      ['#008000', 'fill'],
      ['#0000ff', 'fill'],
      ['#0000ff', 'fill'],
      ['#008080', 'fill'],
      ['#000000', 'stroke'],
    ],
  );
  const sk = r.skipped.join(' | ');
  for (const w of ['1 script', '1 text element', '1 element with a transform', 'background', 'event handler'])
    assert.ok(sk.includes(w), sk);
  assert.equal(r.exact, false);
  for (const s of r.shapes) assert.ok(!/<|script|onclick|url\(|alert/.test(s.d + s.color), s.d);
  assert.equal(r.shapes[5]!.width, r2(2 * (96 / 175))); // content spans x 20..195
  assert.equal(toTraceResult(r).shapes.length, 5);
  assert.equal(strokeShapes(r).length, 1);
});

const r2 = (n: number) => Math.round(n * 100) / 100;

test('basic shapes convert to path data with matching bounds', () => {
  const near = (d: string | null, e: [number, number, number, number]) => {
    const b = pathBounds(d!)!;
    [b.minX, b.minY, b.maxX, b.maxY].forEach((v, k) => assert.ok(Math.abs(v - e[k]!) < 0.01, `${d}: ${v} vs ${e[k]}`));
  };
  near(basicShapePath('rect', { x: '5', y: '6', width: '10', height: '20' }), [5, 6, 15, 26]);
  near(basicShapePath('rect', { x: '5', y: '6', width: '10px', height: '20', rx: '2' }), [5, 6, 15, 26]);
  near(basicShapePath('circle', { cx: '10', cy: '20', r: '5' }), [5, 15, 15, 25]);
  near(basicShapePath('ellipse', { cx: '10', cy: '20', rx: '5', ry: '5' }), [5, 15, 15, 25]);
  near(basicShapePath('line', { x1: '1', y1: '2', x2: '3', y2: '9' }), [1, 2, 3, 9]);
  near(basicShapePath('polyline', { points: '0,0 10,5 4 8' }), [0, 0, 10, 8]);
  near(basicShapePath('polygon', { points: '1 1, 9 3, 4 7' }), [1, 1, 9, 7]);
  near(basicShapePath('ellipse', { cx: '10', cy: '20', rx: '8', ry: '3' }), [2, 17, 18, 23]);
  // A rotated arc: a half ellipse turned 90 degrees still bounds at its true extremes.
  near('M0 0A10 5 90 0 1 0 20', [0, 0, 5, 20]);
  for (const bad of [{ r: '5%' }, { r: '2em' }, { r: 'calc(1px)' }, { r: '0' }]) assert.equal(basicShapePath('circle', bad), null);
});

test('colors', () => {
  assert.equal(parseColor('#abc'), '#aabbcc');
  assert.equal(parseColor('rgb(255, 0, 10)'), '#ff000a');
  assert.equal(parseColor('RED'), '#ff0000');
  assert.equal(parseColor('currentColor'), '#000000');
  assert.equal(parseColor('chartreuse'), 'unknown');
  const r = importSvg(svg('<circle cx="5" cy="5" r="5" fill="chartreuse"/><circle cx="20" cy="5" r="5" fill="url(#g)"/>'))!;
  assert.deepEqual(
    r.shapes.map((s) => s.color),
    ['#000000', '#000000'],
  );
  assert.ok(
    r.skipped.includes('1 unknown color drawn black') && r.skipped.includes('1 gradient or pattern paint drawn black'),
    r.skipped.join(),
  );
  const s = importSvg(svg('<circle cx="5" cy="5" r="5" fill="none" stroke="navy"/>'))!;
  assert.deepEqual(
    s.shapes.map((x) => [x.color, x.paint]),
    [['#000080', 'stroke']],
  );
  assert.equal(importSvg(svg('<circle cx="5" cy="5" r="5" fill="none"/>')), null);
});

test('paint inheritance: nearest group, own attribute, then style', () => {
  const r = importSvg(
    svg(`<g fill="red"><g fill="lime"><circle cx="5" cy="5" r="5"/><circle cx="20" cy="5" r="5" fill="blue"/>
      <circle cx="35" cy="5" r="5" fill="blue" style="fill:#123456"/></g></g>`),
  )!;
  assert.deepEqual(
    r.shapes.map((s) => s.color),
    ['#00ff00', '#0000ff', '#123456'],
  );
  assert.equal(r.exact, true);
  const t = importSvg(svg('<g transform="scale(2)"><circle cx="5" cy="5" r="5"/></g><circle cx="5" cy="5" r="5"/>'))!;
  assert.equal(t.shapes.length, 1);
  assert.ok(t.skipped.includes('1 element with a transform'));
});

test('the fit: one uniform scale, centered, touching the margin on the longer side', () => {
  const r = importSvg(svg('<rect x="10" y="10" width="60" height="20" fill="red"/><path d="m100 30 h20 v10 h-20 z" fill="blue"/>'))!;
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const s of r.shapes) {
    assert.equal(safePathData(s.d), s.d);
    const p = pathBounds(s.d)!;
    b.minX = Math.min(b.minX, p.minX);
    b.minY = Math.min(b.minY, p.minY);
    b.maxX = Math.max(b.maxX, p.maxX);
    b.maxY = Math.max(b.maxY, p.maxY);
  }
  assert.ok(Math.abs(b.minX - 2) < 0.5 && Math.abs(b.maxX - 98) < 0.5, JSON.stringify(b));
  const aspect = (b.maxX - b.minX) / (b.maxY - b.minY);
  assert.ok(Math.abs(aspect / (110 / 30) - 1) < 0.01, String(aspect));
  assert.ok(Math.abs((b.minY + b.maxY) / 2 - 50) < 0.05);
});

// Flattens M, L, H, V, C, Q, Z (both cases) to points; S, T, A contribute their end points only.
function probe(d: string): [number, number][] {
  const out: [number, number][] = [];
  const tok = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)/g)!;
  let i = 0;
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let c = '';
  const n = () => Number(tok[i++]);
  while (i < tok.length) {
    if (/[A-Za-z]/.test(tok[i]!)) c = tok[i++]!;
    const rel = c === c.toLowerCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    const lo = c.toLowerCase();
    if (lo === 'z') [x, y] = [sx, sy];
    else if (lo === 'h') x = n() + ox;
    else if (lo === 'v') y = n() + oy;
    else if (lo === 'c' || lo === 'q') {
      const v = Array.from({ length: lo === 'c' ? 6 : 4 }, n).map((t, k) => t + (k % 2 ? oy : ox));
      const pts = [[x, y], ...Array.from({ length: v.length / 2 }, (_, k) => [v[2 * k]!, v[2 * k + 1]!])];
      for (let t = 0.25; t < 1; t += 0.25) {
        let p = pts.map((q) => [...q]);
        while (p.length > 1) p = p.slice(1).map((q, k) => [p[k]![0]! * (1 - t) + q[0]! * t, p[k]![1]! * (1 - t) + q[1]! * t]);
        out.push([p[0]![0]!, p[0]![1]!]);
      }
      [x, y] = [v.at(-2)!, v.at(-1)!];
    } else {
      const k = { m: 2, l: 2, t: 2, s: 4, a: 7 }[lo]!;
      const v = Array.from({ length: k }, n);
      [x, y] = [v[k - 2]! + ox, v[k - 1]! + oy];
      if (lo === 'm') [sx, sy] = [x, y];
    }
    out.push([x, y]);
  }
  return out;
}

test('the path transformer handles every command in both cases', () => {
  const d =
    'M10 10 L20 10 H30 V20 C30 25 35 30 40 30 S50 35 50 40 Q55 45 60 40 T70 40 A5 7 30 0 1 80 45 Z ' +
    'm5 5 l10 0 h10 v10 c0 5 5 10 10 10 s10 5 10 10 q5 5 10 0 t10 0 a5 7 30 1 0 10 5 z';
  const [s, tx, ty] = [1.37, -3.2, 11.9];
  const out = transformPath(d, s, tx, ty)!;
  assert.equal(safePathData(out), out);
  for (const c of 'MLHVCSQTAZmlhvcsqtaz') assert.ok(out.includes(c), c);
  assert.ok(out.includes('A6.85 9.59 30 0 1') && out.includes('a6.85 9.59 30 1 0'), out);
  const a = probe(d).map(([x, y]) => [x * s + tx, y * s + ty]);
  const b = probe(out);
  assert.equal(a.length, b.length);
  a.forEach((p, k) => assert.ok(Math.hypot(p[0]! - b[k]![0]!, p[1]! - b[k]![1]!) < 0.02, `${k}: ${p} vs ${b[k]}`));
  // Packed arc flags are read one character each.
  assert.equal(transformPath('M0 0a1 1 0 011 1', 2, 0, 0), 'M0 0a2 2 0 0 1 2 2');
});

test('hostile inputs return null or a clean result and never throw', () => {
  const big = svg(`<path d="M0 0L1 1" fill="red"/>${' '.repeat(400_000)}`);
  const cases = [
    'hello',
    '<html><body>no</body></html>',
    big,
    '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="5"',
    '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="r\'e>d"/><path d=\'M0 0 L 5 "5\' fill="blue"/>',
    '<!DOCTYPE svg [<!ENTITY x "<path d=\'M0 0L9 9\'/>">]><svg viewBox="0 0 10 10">&x;<circle cx="5" cy="5" r="5"/></svg>',
    svg(`<path d="M0 0${' L1 1'.repeat(20_000)}"/>`),
    svg('<image href="javascript:alert(1)"/><use href="#a"/><foreignObject><div onclick="x"/></foreignObject>'),
    '<svg><<<<>>>/></svg>',
  ];
  const results = cases.map((c) => importSvg(c));
  assert.equal(results[0], null);
  assert.equal(results[1], null);
  assert.equal(results[2], null);
  assert.equal(results[5], null);
  assert.equal(results[6], null);
  assert.equal(results[7], null);
  assert.equal(importSvg('<svg viewBox="0 0 10 10"><!ENTITY x "y"><circle cx="5" cy="5" r="5"/></svg>'), null);
  const long = importSvg(svg(`<path d="M0 0${' L1 1'.repeat(20_000)}"/><circle cx="5" cy="5" r="5"/>`))!;
  assert.equal(long.shapes.length, 1);
  assert.ok(long.skipped.includes('1 path with unsafe or too long data'));
  for (const r of results) for (const s of r?.shapes ?? []) assert.equal(safePathData(s.d), s.d);
  assert.equal(importSvg(svg('<circle cx="5" cy="5" r="5"/>'.repeat(50)))!.skipped.includes('10 shapes over the limit'), true);
});

// Run with: FP_REFERENCE_SVG=/path/to/reference.svg npm test
test('a real-world file with defs and use', { skip: REF === '' || !existsSync(REF) }, () => {
  const r = importSvg(readFileSync(REF, 'utf8'));
  assert.ok(r === null || r.skipped.some((s) => s.includes('use element')), JSON.stringify(r?.skipped));
});

test('source hygiene', () => {
  const src = readFileSync(new URL('./svg-import.ts', import.meta.url), 'utf8');
  for (const bad of ['node:', 'Math.random', 'DOMParser', 'innerHTML']) assert.ok(!src.includes(bad), bad);
});
