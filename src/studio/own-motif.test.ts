import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultsFor, inkColor, isSvgFile, ownShapes, pickMethod } from './own-motif.ts';

test('pickMethod: clear contrast and little ink is line art', () => {
  assert.equal(pickMethod({ contrast: 0.6, coverage: 0.1 }), 'ink');
  assert.equal(pickMethod({ contrast: 0.35, coverage: 0.349 }), 'ink');
  assert.equal(pickMethod({ contrast: 0.34, coverage: 0.1 }), 'color');
  assert.equal(pickMethod({ contrast: 0.6, coverage: 0.35 }), 'color');
});

test('defaultsFor each method', () => {
  assert.deepEqual(defaultsFor('ink'), { scale: 1.6, anchor: 'center', detail: 0.3 });
  assert.deepEqual(defaultsFor('color'), { scale: 1, anchor: 'base', detail: 0.6 });
  assert.deepEqual(defaultsFor('lines'), { scale: 1, anchor: 'center', detail: 0.6 });
});

test('inkColor is the mean color of the masked pixels', () => {
  // 4 pixels: two dark green ink pixels, two light checkerboard pixels.
  const px = [0x10, 0x40, 0x20, 255, 0xff, 0xff, 0xff, 255, 0x20, 0x60, 0x30, 255, 0xcc, 0xcc, 0xcc, 255];
  assert.equal(inkColor(px, [1, 0, 1, 0]), '#185028');
  assert.equal(inkColor(px, [0, 0, 0, 0]), '#000000');
});

test('isSvgFile by type or name', () => {
  assert.ok(isSvgFile('a.png', 'image/svg+xml'));
  assert.ok(isSvgFile('Rose.SVG', ''));
  assert.ok(!isSvgFile('rose.png', 'image/png'));
});

test('ownShapes per method', () => {
  const ink = ownShapes({ method: 'ink', result: { d: 'M0 0h9v9H0zM3 3h3v3H3z', box: 100 }, color: '#1b4d2e' });
  assert.deepEqual(ink, { shapes: [{ color: '#1b4d2e', d: 'M0 0h9v9H0zM3 3h3v3H3z', paint: 'fill', evenodd: true }], box: 100 });
  assert.deepEqual(ownShapes({ method: 'ink', result: { d: '', box: 100 }, color: '#000000' }).shapes, []);
  const lines = ownShapes({ method: 'lines', result: { d: 'M0 0L9 9', box: 100 }, color: '#222222' });
  assert.deepEqual(lines.shapes, [{ color: '#222222', d: 'M0 0L9 9', paint: 'stroke', width: 1.5 }]);
  const svg = ownShapes({
    method: 'svg',
    result: {
      box: 100,
      shapes: [
        { color: '#ff0000', d: 'M0 0h5v5z', paint: 'fill', width: 0 },
        { color: '#00ff00', d: 'M0 0L5 5', paint: 'stroke', width: 2 },
        { color: '#0000ff', d: 'M1 1h5v5z', paint: 'fill', width: 0 },
      ],
    },
  });
  assert.deepEqual(
    svg.shapes.map((s) => [s.color, s.paint]),
    [
      ['#ff0000', 'fill'],
      ['#00ff00', 'stroke'],
      ['#0000ff', 'fill'],
    ],
  );
  const color = ownShapes({ method: 'color', shapes: [{ color: '#abcdef', d: 'M0 0h1v1z', area: 1 }], box: 100 });
  assert.deepEqual(color, { shapes: [{ color: '#abcdef', d: 'M0 0h1v1z' }], box: 100 });
});

test('pickMethod: a picture in several colors goes to Color shapes, one-color line art goes to Ink', async () => {
  const { sampleFlower } = await import('./colortrace.ts');
  const { inkMask } = await import('./inktrace.ts');
  const { inkSpread, INK_SPREAD_MAX } = await import('./own-motif.ts');
  // The built-in sample flower: pink petals, a yellow heart, a green stem, on white.
  const flower = sampleFlower(400);
  const fm = inkMask(flower, {});
  const fs = inkSpread(flower.data, fm.mask);
  assert.ok(fs > INK_SPREAD_MAX, `the flower's colors are spread out: ${fs.toFixed(3)}`);
  assert.equal(pickMethod({ ...fm, spread: fs }), 'color');
  // Line art: dark green strokes with soft edges on white.
  const W = 200;
  const data = new Uint8ClampedArray(W * W * 4).fill(255);
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.abs(Math.hypot(x - 100, y - 100) - 60);
      const a = Math.max(0, Math.min(1, 3 - d)); // a ring about 5 px thick with a one pixel soft edge
      const i = 4 * (y * W + x);
      data[i] = 255 + (20 - 255) * a;
      data[i + 1] = 255 + (60 - 255) * a;
      data[i + 2] = 255 + (20 - 255) * a;
    }
  const art = { width: W, height: W, data };
  const am = inkMask(art, {});
  const as = inkSpread(art.data, am.mask);
  assert.ok(as < INK_SPREAD_MAX, `line art is one color: ${as.toFixed(3)}`);
  assert.equal(pickMethod({ ...am, spread: as }), 'ink');
  assert.equal(inkSpread(art.data, new Uint8Array(W * W)), 0);
});
