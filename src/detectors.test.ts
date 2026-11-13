import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DETECTORS, DETECTOR_LABELS, TRACE_GROUPS, traceCall, traceName } from './detectors.ts';
import { traceIsolines } from './isolines.ts';

const settings = { threshold: 0.3, levels: 5, tolerance: 1.5, minLength: 8 };

test('trace groups: seven edge detectors, then contour lines', () => {
  assert.deepEqual(
    TRACE_GROUPS.map((g) => [g.label, g.ids]),
    [
      ['Edges', [...DETECTORS]],
      ['Contours', ['isolines']],
    ],
  );
  assert.equal(DETECTORS.length, 7);
  assert.equal(DETECTOR_LABELS.isolines, 'Contour lines (brightness levels)');
  assert.equal(traceName('isolines'), 'contour lines');
  assert.equal(traceName('canny'), 'Canny edges');
});

test('traceCall: isolines for contours, the edge path for the seven detectors', () => {
  const c = traceCall({ ...settings, detector: 'isolines' }, 120);
  assert.equal(c.method, 'isolines');
  if (c.method === 'isolines')
    assert.deepEqual([c.options.levels, c.options.size, c.options.minLength, c.options.tolerance], [5, 120, 8, 1.5]);
  for (const d of DETECTORS)
    assert.deepEqual(traceCall({ ...settings, detector: d }, 120), { method: 'edges', detector: d, threshold: 0.3 });
});

test('traceIsolines: a cone of brightness gives one closed ring per level, up to 7', () => {
  const w = 96;
  const data = new Float32Array(w * w);
  for (let y = 0; y < w; y++)
    for (let x = 0; x < w; x++) data[y * w + x] = 255 * Math.max(0, 1 - Math.hypot(x + 0.5 - 48, y + 0.5 - 48) / 40);
  // Measured: levels 2, 3, 4, 6, 8 give 2, 3, 4, 6, 7 rings (strength 0: the cone has the same gradient everywhere).
  const rings = [2, 3, 4, 6, 8].map((levels) => {
    const out = traceIsolines({ data, width: w, height: w }, { levels, blur: 1, strength: 0, minLength: 4, tolerance: 0, size: 96 });
    assert.ok(
      out.every((l) => l.length > 2 && l[0]![0] === l.at(-1)![0] && l[0]![1] === l.at(-1)![1]),
      'every line is a closed ring',
    );
    return out.length;
  });
  assert.deepEqual(rings, [2, 3, 4, 6, 7]);
});
