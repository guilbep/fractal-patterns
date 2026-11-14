import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generate, geometry, type PatternParams } from './fractal.ts';
import { composeSvg, drawScene, pathData, sceneToSvg, squareScene, type CanvasLike, type Paint, type Scene } from './scene.ts';
import type { Pt } from './patterns/util.ts';

const stroke: Paint = { mode: 'stroke', color: '#336699', opacity: 0.5, width: 1 };
const red: Paint = { mode: 'fill', color: '#de493c', opacity: 1, width: 0 };
const segment: Pt[][] = [
  [
    [0, 0],
    [10, 0],
  ],
];
const triangle: Pt[][] = [
  [
    [0, 0],
    [10, 0],
    [0, 10],
  ],
];
const scene = (layers: Scene['layers']): Scene => ({ width: 120, height: 80, layers });

test('stroke layer svg', () => {
  assert.equal(
    sceneToSvg(scene([{ polys: segment, paint: stroke }]), 1),
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><path d="M0 0h10" fill="none" stroke="#336699" stroke-width="1" stroke-opacity="0.5" stroke-linecap="round"/></svg>',
  );
});

test('fill layer svg', () => {
  const svg = sceneToSvg(scene([{ polys: triangle, paint: red }]), 1);
  for (const s of ['fill="#de493c"', 'fill-opacity="1"', 'fill-rule="evenodd"']) assert.ok(svg.includes(s), s);
  assert.match(svg, /\sd="[^"]*z"/);
  assert.ok(!svg.includes('stroke='));
});

test('layers in order, empty skipped, no newline', () => {
  const svg = sceneToSvg(
    scene([
      { polys: triangle, paint: red },
      { polys: [], paint: stroke },
      { polys: segment, paint: stroke },
    ]),
    1,
  );
  assert.equal(svg.match(/<path/g)?.length, 2);
  assert.ok(svg.indexOf('fill="#de493c"') < svg.indexOf('stroke="#336699"'));
  assert.ok(!svg.includes('\n'));
});

test('squareScene matches generate', () => {
  for (const kind of ['carpet', 'herringbone', 'p4g'] as const) {
    const p: PatternParams = { kind, seed: 3, depth: 2, size: 120, strokeWidth: 1, precision: 1, color: '#336699', opacity: 0.5 };
    assert.equal(sceneToSvg(squareScene(geometry(p), p), p.precision), generate(p), kind);
  }
});

type Call = readonly [string, ...unknown[]];
function fakeCtx(): CanvasLike & { calls: Call[] } {
  const calls: Call[] = [];
  const ctx = {
    calls,
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    lineCap: '',
    globalAlpha: 1,
    beginPath: () => calls.push(['beginPath']),
    moveTo: (x: number, y: number) => calls.push(['moveTo', x, y]),
    lineTo: (x: number, y: number) => calls.push(['lineTo', x, y]),
    closePath: () => calls.push(['closePath']),
    stroke: () => calls.push(['stroke', ctx.globalAlpha]),
    fill: (rule?: string) => calls.push(['fill', rule, ctx.globalAlpha]),
  };
  return ctx;
}

test('drawScene stroke', () => {
  const ctx = fakeCtx();
  drawScene(ctx, scene([{ polys: segment, paint: stroke }]));
  assert.deepEqual(ctx.calls, [['beginPath'], ['moveTo', 0, 0], ['lineTo', 10, 0], ['stroke', 0.5]]);
  assert.equal(ctx.strokeStyle, '#336699');
  assert.equal(ctx.lineWidth, 1);
  assert.equal(ctx.lineCap, 'round');
  assert.equal(ctx.globalAlpha, 1);
});

test('drawScene fill', () => {
  const ctx = fakeCtx();
  drawScene(ctx, scene([{ polys: triangle, paint: red }]));
  assert.deepEqual(
    ctx.calls.map((c) => c[0]),
    ['beginPath', 'moveTo', 'lineTo', 'lineTo', 'closePath', 'fill'],
  );
  assert.equal(ctx.calls.at(-1)?.[1], 'evenodd');
  assert.equal(ctx.fillStyle, '#de493c');
  assert.equal(ctx.globalAlpha, 1);
});

test('drawScene and sceneToSvg see the same geometry', () => {
  const p = { kind: 'herringbone', seed: 1, depth: 2, size: 120, strokeWidth: 1, color: '#336699', opacity: 0.5 } as const;
  const polys = geometry(p);
  const ctx = fakeCtx();
  drawScene(ctx, squareScene(polys, p));
  const count = (name: string) => ctx.calls.filter((c) => c[0] === name).length;
  assert.equal(count('moveTo'), pathData(polys, 1).match(/M/g)?.length);
  assert.ok(count('lineTo') >= polys.length);
});

test('scene.ts stays pure', () => {
  const src = readFileSync(new URL('./scene.ts', import.meta.url), 'utf8');
  assert.ok(!src.includes('node:'));
  assert.ok(!src.includes('document'));
});

test('sceneToSvg writes a layer d verbatim in place of its polylines', () => {
  const d = 'M10 10C20 0 40 0 50 10c5 5 5 15 0 20';
  const scene = squareScene([], { size: 60, strokeWidth: 2, color: '#123456', opacity: 0.6 });
  const svg = sceneToSvg({ ...scene, layers: scene.layers.map((l) => ({ ...l, d })) }, 1);
  assert.ok(svg.includes(`<path d="${d}" fill="none"`));
  assert.ok(!svg.includes('L'));
});

test('sceneToSvg without a d layer is unchanged', () => {
  const polys: Pt[][] = [
    [
      [10, 10],
      [50, 10],
      [50, 40],
    ],
    [
      [5, 5],
      [20, 30],
      [40, 5],
      [5, 5],
    ],
  ];
  assert.equal(
    sceneToSvg(squareScene(polys, { size: 60, strokeWidth: 2, color: '#123456', opacity: 0.6 }), 1),
    '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><path d="M10 10h40v30M5 5l15 25l20-25z" fill="none" stroke="#123456" stroke-width="2" stroke-opacity="0.6" stroke-linecap="round"/></svg>',
  );
});

test('an accent layer fills non-zero: a ring keeps its hole and two overlapping dots join', () => {
  const ngon = (cx: number, cy: number, r: number, n = 16): Pt[] =>
    Array.from({ length: n + 1 }, (_, i): Pt => [
      cx + r * Math.cos((2 * Math.PI * (i % n)) / n),
      cy + r * Math.sin((2 * Math.PI * (i % n)) / n),
    ]);
  const ring: Pt[] = [...ngon(30, 30, 20), ...ngon(30, 30, 12).reverse(), [50, 30]];
  const dots = [ngon(20, 20, 10), ngon(28, 20, 10)];
  const paint = { mode: 'fill', color: '#e07a3f', opacity: 1, width: 0 } as const;
  const svg = sceneToSvg({ width: 60, height: 60, layers: [{ polys: [ring, ...dots], paint: { ...paint, rule: 'nonzero' } }] }, 1);
  assert.ok(svg.includes('fill-rule="nonzero"'));
  assert.ok(!svg.includes('evenodd'));
  // The ring's inner loop runs the other way round: its signed area has the opposite sign, so non-zero leaves the hole.
  const signed = (p: Pt[]) => p.slice(0, -1).reduce((s, [x, y], i) => s + x * p[i + 1]![1] - p[i + 1]![0] * y, 0) / 2;
  assert.ok(Math.sign(signed(ngon(30, 30, 20))) === -Math.sign(signed(ngon(30, 30, 12).reverse())));
  // Both dots turn the same way: non-zero gives winding 2 where they overlap, filled (even-odd would cut it out).
  assert.equal(Math.sign(signed(dots[0]!)), Math.sign(signed(dots[1]!)));
  // Without a rule a fill stays even-odd, as before.
  assert.ok(sceneToSvg({ width: 60, height: 60, layers: [{ polys: dots, paint }] }, 1).includes('fill-rule="evenodd"'));
  // The canvas draws the same rule.
  const rules: (string | undefined)[] = [];
  const ctx = {
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    stroke() {},
    fill: (r?: string) => void rules.push(r),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    lineCap: '',
    globalAlpha: 1,
  };
  drawScene(ctx, {
    width: 60,
    height: 60,
    layers: [
      { polys: dots, paint: { ...paint, rule: 'nonzero' } },
      { polys: dots, paint },
    ],
  });
  assert.deepEqual(rules, ['nonzero', 'evenodd']);
});

test('composeSvg nests a full-size layer and repeats a smaller one through a pattern', () => {
  const a = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>';
  const b = '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30"></svg>';
  assert.equal(
    composeSvg(
      [
        { svg: a, width: 10, height: 10 },
        { svg: b, width: 30, height: 30 },
      ],
      30,
      30,
    ),
    `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30"><defs><pattern id="fp-l0" width="10" height="10" patternUnits="userSpaceOnUse">${a}</pattern></defs><rect width="30" height="30" fill="url(#fp-l0)"/>${b}</svg>`,
  );
  assert.equal(
    composeSvg(
      [
        { svg: a, width: 10, height: 10 },
        { svg: a, width: 10, height: 10 },
      ],
      10,
      10,
    ),
    `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10">${a}${a}</svg>`,
  );
});
