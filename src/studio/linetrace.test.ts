import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safePathData } from '../motifgrid.ts';
import { DETECTORS } from '../trace.ts';
import type { Rgba } from './colortrace.ts';
import { cropLines, lineMotif, traceLines, type LineTraceOptions } from './linetrace.ts';
import { motifBounds } from './motifs.ts';

// A dark disc and a dark triangle on white, 128 x 128.
const image = (flat = false): Rgba => {
  const n = 128;
  const data = new Uint8ClampedArray(n * n * 4).fill(255);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const disc = Math.hypot(x - 40, y - 44) < 22;
      const tri = y > 60 && y < 110 && Math.abs(x - 90) < (y - 60) * 0.6;
      if (!flat && (disc || tri)) data.set([30, 30, 30], 4 * (y * n + x));
    }
  return { width: n, height: n, data };
};
const o = (rest: Partial<LineTraceOptions> = {}): LineTraceOptions => ({
  detector: 'canny',
  threshold: 0.2,
  detail: 0.6,
  minLength: 4,
  curves: false,
  size: 100,
  ...rest,
});

test('traceLines: every detector gives a non-empty safe path', () => {
  for (const detector of DETECTORS) {
    const r = traceLines(image(), o({ detector }));
    assert.ok(r.d.length > 0 && r.lines > 0, detector);
    assert.equal(safePathData(r.d), r.d, detector);
    assert.equal(r.bytes, r.d.length);
    assert.equal(r.box, 100);
  }
});

test('traceLines: a higher canny threshold gives fewer or equal lines', () => {
  const lines = [0.1, 0.3, 0.6].map((threshold) => traceLines(image(), o({ threshold })).lines);
  for (let i = 1; i < lines.length; i++) assert.ok(lines[i]! <= lines[i - 1]!, lines.join(' '));
});

test('traceLines with curves: cubic commands, no lines', () => {
  const r = traceLines(image(), o({ curves: true }));
  assert.match(r.d, /[Cc]/);
  assert.doesNotMatch(r.d, /[Ll]/);
  assert.equal(safePathData(r.d), r.d);
});

test('cropLines fills the box on the longer side; lineMotif is one stroke shape', () => {
  for (const curves of [false, true]) {
    const c = cropLines(traceLines(image(), o({ curves })), 0.04, 'bottom');
    const b = motifBounds(c.d);
    assert.ok(Math.abs(Math.max(b.maxX - b.minX, b.maxY - b.minY) - 92) <= 1.5, `${curves}`);
    assert.ok(Math.abs(b.maxY - 96) <= 1.5, `${curves}`);
    assert.equal(safePathData(c.d), c.d);
    const m = lineMotif(c, '#22302a');
    assert.deepEqual(m, { shapes: [{ color: '#22302a', d: c.d, paint: 'stroke', width: 1.5 }], box: 100 });
  }
});

test('a flat image gives an empty drawing and no motif shape', () => {
  for (const curves of [false, true]) {
    const r = traceLines(image(true), o({ curves }));
    assert.deepEqual([r.d, r.lines], ['', 0]);
    assert.equal(cropLines(r).d, '');
    assert.deepEqual(lineMotif(r, '#000000').shapes, []);
  }
});
