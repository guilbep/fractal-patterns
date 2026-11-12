import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportCss, exportHtml, exportJs, type ExportInput } from './export.ts';
import { cssMotion, MOTION_NONE, type Motion } from './motion.ts';
import { svgToDataUri } from './css.ts';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><path d="M0 0h4"/></svg>';
const base: ExportInput = {
  svg,
  tileSize: 120,
  background: '#f5f5f5',
  text: '#12232e',
  plate: { mode: 'split', opacity: 0.85, radius: 12, blur: 0 },
  motion: MOTION_NONE,
  label: 'Tree, seed 1, depth 8',
  appName: 'Demo',
};
const css = (m: Partial<Motion> = {}, rest: Partial<ExportInput> = {}) => exportCss({ ...base, ...rest, motion: { ...MOTION_NONE, ...m } });
const count = (s: string, sub: string) => s.split(sub).length - 1;

// Lines of the `.fp-pattern::before {` block, up to its closing brace.
const beforeBlock = (s: string) => {
  const lines = s.split('\n');
  const start = lines.indexOf('.fp-pattern::before {');
  return lines.slice(start, lines.indexOf('}', start) + 1);
};
const layerLines = (s: string) => beforeBlock(s).filter((l) => !/^ {2}background-(image|size):/.test(l));

const motions: Partial<Motion>[] = [
  {},
  { scale: 2 },
  { rotate: 30 },
  { skew: 20, drift: 'y', speed: 4 },
  { tilt: 55, rotate: 10, drift: 'xy' },
  { rotate: -15, skew: 10, tilt: 40, scale: 0.5, drift: 'x', speed: 12.5 },
];

test('base export: header, custom properties, layer, plate, usage', () => {
  const out = css();
  assert.ok(out.startsWith('/* Demo: Tree, seed 1, depth 8. Tile 120px. */'));
  for (const s of [
    '--fp-bg: #f5f5f5;',
    '--fp-ink: #12232e;',
    '--fp-tile: url("data:image/svg+xml,',
    '--fp-size: 120px;',
    'background-color: var(--fp-bg);',
    'color: var(--fp-ink);',
    'background-image: var(--fp-tile);',
    'background-size: var(--fp-size) var(--fp-size);',
    'inset: 0;',
    '.fp-plate {',
    'class="fp-pattern"',
    'class="fp-plate"',
  ])
    assert.ok(out.includes(s), s);
  assert.equal(count(out, 'data:image/svg+xml'), 1);
});

test('direct mode: no plate class or usage line', () => {
  const out = css({}, { plate: { ...base.plate, mode: 'direct' } });
  assert.ok(!out.includes('.fp-plate'));
  assert.ok(!out.includes('class="fp-plate"'));
});

test('scale goes through the size, no transform', () => {
  const out = css({ scale: 2 });
  assert.ok(out.includes('--fp-size: 240px;'));
  assert.ok(!out.includes('transform:'));
});

test('drift: animation, keyframes on the variable, paused, reduced motion, usage', () => {
  const out = css({ drift: 'x', speed: 8 });
  for (const s of [
    'animation: fp-drift 8s linear infinite;',
    'to { background-position: var(--fp-size) 0; }',
    '.fp-pattern.fp-paused::before {',
    '@media (prefers-reduced-motion: reduce) {',
    'Add the class fp-paused',
  ])
    assert.ok(out.includes(s), s);
});

test('tilt and rotate: same layer box and transform as cssMotion', () => {
  const m = { ...MOTION_NONE, tilt: 55, rotate: 10 };
  const pick = (s: string) => beforeBlock(s).filter((l) => /^ {2}(left|top|width|height|transform):/.test(l));
  const got = pick(css(m));
  assert.equal(got.length, 5);
  assert.deepEqual(got, pick(cssMotion(svg, '#f5f5f5', 120, m)));
});

test('layer parity with cssMotion for varied motions', () => {
  for (const m of motions) {
    const full = { ...MOTION_NONE, ...m };
    assert.deepEqual(new Set(layerLines(css(m))), new Set(layerLines(cssMotion(svg, '#f5f5f5', 120, full))), JSON.stringify(m));
  }
});

test('braces balance and comments close', () => {
  const inputs = motions.map((m, k) =>
    css(m, { plate: { ...base.plate, mode: (['plate', 'split', 'direct'] as const)[k % 3]!, blur: k } }),
  );
  for (const out of inputs) {
    assert.equal(count(out, '{'), count(out, '}'));
    assert.equal(count(out, '/*'), count(out, '*/'));
  }
});

test('a label with */ cannot end the comment early', () => {
  const out = css({}, { label: 'x */ body{display:none} /*', appName: 'a*/b' });
  assert.equal(count(out, '/*'), count(out, '*/'));
  assert.ok(out.split('\n')[0]!.endsWith(' */'));
  assert.equal(count(out.split('\n')[0]!, '*/'), 1);
});

test('the url value has no raw < > or newline', () => {
  const m = /url\("([^"]*)"\)/.exec(css());
  assert.ok(m);
  assert.ok(!/[<>\n]/.test(m[1]!));
});

const tiles = ['<svg a="1"/>', '<svg b="2"/>', '<svg c="3"/>'];
const values = tiles.map((t) => `url("${svgToDataUri(t)}")`);

function fakeDom(n: number) {
  const calls: [string, string][] = [];
  const handlers: { type: string; fn: () => void }[] = [];
  const el = {
    style: { setProperty: (k: string, v: string) => calls.push([k, v]) },
    addEventListener: (type: string, fn: () => void) => handlers.push({ type, fn }),
  };
  const document = { querySelectorAll: (sel: string) => (sel === '.fp-pattern' ? Array.from({ length: n }, () => el) : []) };
  return { document, calls, handlers };
}
const run = (script: string, document: unknown) => new Function('document', script)(document);

test('exportJs: header comment and valid syntax', () => {
  for (const ev of ['click', 'load'] as const) {
    const out = exportJs(tiles, ev);
    assert.ok(out.startsWith('// Changes the pattern tile. Works with the .fp-pattern CSS above.\n'));
    assert.doesNotThrow(() => new Function(out));
  }
});

test('exportJs click: each click moves to the next tile', () => {
  const dom = fakeDom(1);
  run(exportJs(tiles, 'click'), dom.document);
  assert.equal(dom.handlers.length, 1);
  assert.equal(dom.handlers[0]!.type, 'click');
  dom.handlers[0]!.fn();
  dom.handlers[0]!.fn();
  assert.deepEqual(dom.calls, [
    ['--fp-tile', values[1]],
    ['--fp-tile', values[2]],
  ]);
});

test('exportJs load: sets one tile once', () => {
  const dom = fakeDom(1);
  run(exportJs(tiles, 'load'), dom.document);
  assert.equal(dom.calls.length, 1);
  assert.equal(dom.calls[0]![0], '--fp-tile');
  assert.ok(values.includes(dom.calls[0]![1]));
});

test('exportJs: no element or no tiles does nothing', () => {
  for (const ev of ['click', 'load'] as const) {
    const empty = fakeDom(0);
    assert.doesNotThrow(() => run(exportJs(tiles, ev), empty.document));
    const dom = fakeDom(1);
    assert.doesNotThrow(() => run(exportJs([], ev), dom.document));
    assert.equal(dom.calls.length + dom.handlers.length, 0);
  }
});

test('exportJs: quotes, backslash and </script> cannot break out', () => {
  const nasty = 'a"b\\c</script><script>alert(1)</script>';
  const out = exportJs([nasty], 'load');
  assert.doesNotThrow(() => new Function(out));
  assert.ok(!out.includes('</script>'));
  const dom = fakeDom(1);
  run(out, dom.document);
  assert.equal(dom.calls[0]![1], `url("${svgToDataUri(nasty)}")`);
});

test('exportHtml: three-line sample', () => {
  assert.equal(exportHtml(), '<section class="fp-pattern">\n  <p class="fp-plate">Your text</p>\n</section>');
});
