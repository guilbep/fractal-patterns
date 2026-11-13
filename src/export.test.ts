import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportCss, exportHtml, exportJs, exportParallax, type ExportInput } from './export.ts';
import { gcd, LAYER2_DEFAULTS, scaledSecondSize } from './layers.ts';
import { cssMotion, MOTION_NONE, parallaxTravel, type Motion } from './motion.ts';
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

// Copied from the output before the second layer existed: without `second`, nothing changes.
const BEFORE_TWO_LAYERS =
  '/* Demo: Tree, seed 1, depth 8. Tile 120px. */\n.fp-pattern {\n  --fp-bg: #f5f5f5;\n  --fp-ink: #12232e;\n  --fp-tile: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'4\' height=\'4\'%3E%3Cpath d=\'M0 0h4\'/%3E%3C/svg%3E");\n  --fp-size: 120px;\n  position: relative;\n  isolation: isolate;\n  overflow: hidden;\n  background-color: var(--fp-bg);\n  color: var(--fp-ink);\n}\n.fp-pattern::before {\n  content: "";\n  position: absolute;\n  z-index: -1;\n  left: 50%;\n  top: 0;\n  width: 225vmax;\n  height: 225vmax;\n  background-image: var(--fp-tile);\n  background-size: var(--fp-size) var(--fp-size);\n  transform: translate(-50%, -50%) perspective(800px) rotateX(30deg);\n  animation: fp-drift 8s linear infinite;\n}\n\n@keyframes fp-drift {\n  to { background-position: var(--fp-size) 0; }\n}\n\n.fp-pattern.fp-paused::before {\n  animation-play-state: paused;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .fp-pattern::before {\n    animation: none;\n  }\n}\n\n.fp-plate {\n  background-color: rgb(245 245 245 / 0.85);\n  border-radius: 12px;\n  padding: 1rem;\n}\n\n/* Use: put class="fp-pattern" on the element that shows the pattern.\n * Put class="fp-plate" on the element that holds the text.\n * Add the class fp-paused to pause the motion.\n */';

test('without second: output equals the literal copied before the change', () => {
  assert.equal(css({ tilt: 30, drift: 'x' }), BEFORE_TWO_LAYERS);
});

const second = { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="3" height="3"><circle r="1"/></svg>', tileSize: 193 };
const afterBlock = (s: string) => {
  const lines = s.split('\n');
  const start = lines.indexOf('.fp-pattern::after {');
  return lines.slice(start, lines.indexOf('}', start) + 1);
};

test('two layers, static: custom properties, ::after rule, repeat distance', () => {
  const out = css({}, { second });
  for (const s of [
    '--fp-tile-2: url("data:image/svg+xml,',
    '--fp-size-2: 193px;',
    '.fp-pattern::after {',
    'background-image: var(--fp-tile-2);',
    'background-size: var(--fp-size-2) var(--fp-size-2);',
    'It repeats exactly every 23160 px.',
  ])
    assert.ok(out.includes(s), s);
  assert.equal(count(out, 'data:image/svg+xml,'), 2);
  assert.equal(count(out, '{'), count(out, '}'));
  assert.equal(count(out, '/*'), count(out, '*/'));
});

test('two layers, scale 2: both sizes scale', () => {
  const out = css({ scale: 2 }, { second });
  assert.ok(out.includes('--fp-size: 240px;'));
  assert.ok(out.includes('--fp-size-2: 386px;'));
});

test('two layers, drift x: own keyframes, paused and reduced-motion cover both', () => {
  const out = css({ drift: 'x' }, { second });
  assert.ok(out.includes('@keyframes fp-drift-2 {'));
  assert.ok(out.includes('to { background-position: var(--fp-size-2) 0; }'));
  assert.ok(afterBlock(out).includes('  animation: fp-drift-2 8s linear infinite;'));
  const paused = out.split('\n').find((l) => l.includes('fp-paused') && l.endsWith('{')) ?? '';
  assert.ok(paused.includes('::before') && paused.includes('::after'), paused);
  const media = out.slice(out.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.ok(media.includes('.fp-pattern::before') && media.includes('.fp-pattern::after'));
});

test('two layers, tilt 30: ::after has the same box and transform as ::before', () => {
  const out = css({ tilt: 30 }, { second });
  const pick = (block: string[]) => block.filter((l) => /^ {2}(left|top|width|height|transform):/.test(l));
  assert.deepEqual(pick(afterBlock(out)), pick(beforeBlock(out)));
  assert.equal(pick(beforeBlock(out)).length, 5);
});

test('exportHtml: three-line sample', () => {
  assert.equal(exportHtml(), '<section class="fp-pattern">\n  <p class="fp-plate">Your text</p>\n</section>');
});

test('fade: mask lines when on, byte-identical to before when off', () => {
  const before =
    '/* Demo: Tree, seed 1, depth 8. Tile 120px. */\n.fp-pattern {\n  --fp-bg: #f5f5f5;\n  --fp-ink: #12232e;\n  --fp-tile: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'4\' height=\'4\'%3E%3Cpath d=\'M0 0h4\'/%3E%3C/svg%3E");\n  --fp-size: 120px;\n  position: relative;\n  isolation: isolate;\n  overflow: hidden;\n  background-color: var(--fp-bg);\n  color: var(--fp-ink);\n}\n.fp-pattern::before {\n  content: "";\n  position: absolute;\n  z-index: -1;\n  inset: 0;\n  background-image: var(--fp-tile);\n  background-size: var(--fp-size) var(--fp-size);\n}\n\n.fp-plate {\n  background-color: rgb(245 245 245 / 0.85);\n  border-radius: 12px;\n  padding: 1rem;\n}\n\n/* Use: put class="fp-pattern" on the element that shows the pattern.\n * Put class="fp-plate" on the element that holds the text.\n */';
  assert.equal(css(), before);
  assert.equal(css({}, { fade: false }), before);
  const on = css({}, { fade: true });
  assert.ok(on.includes('  mask-image: radial-gradient('));
  assert.ok(on.includes('  -webkit-mask-image: radial-gradient('));
  assert.ok(on.includes('.fp-pattern::before {\n  -webkit-mask-image'));
  const both = css({}, { fade: true, second: { svg, tileSize: 193 } });
  assert.ok(both.includes('.fp-pattern::before, .fp-pattern::after {\n  -webkit-mask-image'));
});

test('change: off is byte-identical; on adds one mask block, alone or merged with the fade', () => {
  assert.equal(css({}, { change: { dir: 'none', to: 0.4 } }), css());
  assert.equal(css({}, { fade: true, change: { dir: 'none', to: 0.4 } }), css({}, { fade: true }));
  const g = 'linear-gradient(to bottom, rgb(0 0 0 / 1), rgb(0 0 0 / 0.4))';
  const on = css({}, { change: { dir: 'down', to: 0.4 } });
  assert.ok(on.includes(`.fp-pattern::before {\n  -webkit-mask-image: ${g};\n  mask-image: ${g};\n}`));
  const two = css({}, { change: { dir: 'down', to: 0.4 }, second: { svg, tileSize: 193 } });
  assert.ok(two.includes(`.fp-pattern::before, .fp-pattern::after {\n  -webkit-mask-image: ${g};`));
  const both = css({}, { fade: true, change: { dir: 'down', to: 0.4 } });
  assert.equal(both.split('mask-image:').length - 1, 2); // one block, not two that would override each other
  assert.ok(both.includes(`, ${g};`) && both.includes(', 100% 100%;') && both.includes('mask-composite: intersect;'));
  assert.ok(!on.includes('@media'));
});

test('change: the mask only lowers alpha, so the contrast inputs (colors, tile, plate) are the same as with it off', () => {
  // The worst case for text is the full-strength end, which is the unmasked pattern: removing the mask block gives the export without it.
  const off = css();
  const on = css({}, { change: { dir: 'across', to: 0.2 } });
  const block = /\n\n\/\* Slow change[^]*?\n\}/;
  assert.equal(on.replace(block, ''), off);
});

// Copied from exportCss before the second-layer settings existed: with every setting at its default, nothing changes.
const L2_INPUT = {
  ...base,
  appName: 'D',
  label: 'L',
  plate: { ...base.plate, mode: 'direct' as const },
  second: { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="3" height="3"><circle r="1"/></svg>', tileSize: 193 },
};
const BEFORE_L2_DRIFT =
  "/* D: L. Tile 120px. */\n.fp-pattern {\n  --fp-bg: #f5f5f5;\n  --fp-ink: #12232e;\n  --fp-tile: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Cpath d='M0 0h4'/%3E%3C/svg%3E\");\n  --fp-size: 120px;\n  --fp-tile-2: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='3' height='3'%3E%3Ccircle r='1'/%3E%3C/svg%3E\");\n  --fp-size-2: 193px;\n  position: relative;\n  isolation: isolate;\n  overflow: hidden;\n  background-color: var(--fp-bg);\n  color: var(--fp-ink);\n}\n.fp-pattern::before {\n  content: \"\";\n  position: absolute;\n  z-index: -1;\n  left: 50%;\n  top: 50%;\n  width: 150vmax;\n  height: 150vmax;\n  background-image: var(--fp-tile);\n  background-size: var(--fp-size) var(--fp-size);\n  transform: translate(-50%, -50%) rotate(15deg);\n  animation: fp-drift 6s linear infinite;\n}\n.fp-pattern::after {\n  content: \"\";\n  position: absolute;\n  z-index: -1;\n  left: 50%;\n  top: 50%;\n  width: 150vmax;\n  height: 150vmax;\n  background-image: var(--fp-tile-2);\n  background-size: var(--fp-size-2) var(--fp-size-2);\n  transform: translate(-50%, -50%) rotate(15deg);\n  animation: fp-drift-2 6s linear infinite;\n}\n\n@keyframes fp-drift {\n  to { background-position: var(--fp-size) var(--fp-size); }\n}\n\n@keyframes fp-drift-2 {\n  to { background-position: var(--fp-size-2) var(--fp-size-2); }\n}\n\n.fp-pattern.fp-paused::before, .fp-pattern.fp-paused::after {\n  animation-play-state: paused;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .fp-pattern::before, .fp-pattern::after {\n    animation: none;\n  }\n}\n\n/* Use: put class=\"fp-pattern\" on the element that shows the pattern.\n * Add the class fp-paused to pause the motion.\n * This pattern has two layers. It repeats exactly every 23160 px.\n */";
const BEFORE_L2_STATIC =
  "/* D: L. Tile 120px. */\n.fp-pattern {\n  --fp-bg: #f5f5f5;\n  --fp-ink: #12232e;\n  --fp-tile: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Cpath d='M0 0h4'/%3E%3C/svg%3E\");\n  --fp-size: 120px;\n  --fp-tile-2: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='3' height='3'%3E%3Ccircle r='1'/%3E%3C/svg%3E\");\n  --fp-size-2: 193px;\n  position: relative;\n  isolation: isolate;\n  overflow: hidden;\n  background-color: var(--fp-bg);\n  color: var(--fp-ink);\n}\n.fp-pattern::before {\n  content: \"\";\n  position: absolute;\n  z-index: -1;\n  inset: 0;\n  background-image: var(--fp-tile);\n  background-size: var(--fp-size) var(--fp-size);\n}\n.fp-pattern::after {\n  content: \"\";\n  position: absolute;\n  z-index: -1;\n  inset: 0;\n  background-image: var(--fp-tile-2);\n  background-size: var(--fp-size-2) var(--fp-size-2);\n}\n\n/* Use: put class=\"fp-pattern\" on the element that shows the pattern.\n * This pattern has two layers. It repeats exactly every 23160 px.\n */";

test('second layer, all settings default: output equals the literal copied before the change', () => {
  const drifting = { ...MOTION_NONE, rotate: 15, drift: 'xy' as const, speed: 6 };
  assert.equal(exportCss({ ...L2_INPUT, motion: drifting }), BEFORE_L2_DRIFT);
  assert.equal(exportCss({ ...L2_INPUT, motion: drifting, second: { ...L2_INPUT.second, ...LAYER2_DEFAULTS } }), BEFORE_L2_DRIFT);
  assert.equal(exportCss({ ...L2_INPUT, motion: MOTION_NONE }), BEFORE_L2_STATIC);
  assert.equal(exportCss({ ...L2_INPUT, motion: MOTION_NONE, second: { ...L2_INPUT.second, ...LAYER2_DEFAULTS } }), BEFORE_L2_STATIC);
});

const with2 = (m: Partial<Motion>, l2: Partial<typeof LAYER2_DEFAULTS>) =>
  exportCss({ ...L2_INPUT, motion: { ...MOTION_NONE, ...m }, second: { ...L2_INPUT.second, ...l2 } });
const keyframes2 = (s: string) => s.split('\n').find((l, i, a) => a[i - 1] === '@keyframes fp-drift-2 {') ?? '';

test('second-layer settings: each one changes its own declaration', () => {
  const plain = afterBlock(with2({ drift: 'x' }, {}));
  const off = with2({ drift: 'x' }, { x: 25, y: 10 });
  assert.ok(afterBlock(off).includes('  background-position: calc(var(--fp-size-2) * 0.25) calc(var(--fp-size-2) * 0.1);'));
  // The drift goes from the offset to one whole tile further: 0.25 to 1.25 on x, y stays.
  assert.equal(keyframes2(off), '  to { background-position: calc(var(--fp-size-2) * 1.25) calc(var(--fp-size-2) * 0.1); }');
  assert.equal(
    keyframes2(with2({ drift: 'xy' }, { x: 25, y: 10 })),
    '  to { background-position: calc(var(--fp-size-2) * 1.25) calc(var(--fp-size-2) * 1.1); }',
  );
  assert.equal(keyframes2(with2({ drift: 'y' }, { y: 57 })), '  to { background-position: 0 calc(var(--fp-size-2) * 1.57); }');
  assert.ok(!plain.some((l) => l.includes('background-position')));
  assert.ok(afterBlock(with2({ rotate: 10 }, { rotate: 30 })).includes('  transform: translate(-50%, -50%) rotate(40deg);'));
  assert.ok(beforeBlock(with2({ rotate: 10 }, { rotate: 30 })).includes('  transform: translate(-50%, -50%) rotate(10deg);'));
  assert.ok(afterBlock(with2({}, { rotate: 30 })).includes('  width: 150vmax;'));
  assert.ok(afterBlock(with2({}, { opacity: 0.6 })).includes('  opacity: 0.6;'));
  assert.ok(!beforeBlock(with2({}, { opacity: 0.6 })).some((l) => l.includes('opacity')));
  assert.ok(afterBlock(with2({ drift: 'x', speed: 8 }, { depth: 0.5 })).includes('  animation: fp-drift-2 16s linear infinite;'));
  assert.ok(afterBlock(with2({ drift: 'x', speed: 8 }, { depth: 3 })).includes('  animation: fp-drift-2 2.667s linear infinite;'));
  assert.ok(beforeBlock(with2({ drift: 'x', speed: 8 }, { depth: 3 })).includes('  animation: fp-drift 8s linear infinite;'));
  // Size: the factor goes through the second tile size.
  const size = scaledSecondSize(120, 1.5);
  assert.ok(
    exportCss({ ...L2_INPUT, motion: MOTION_NONE, second: { ...L2_INPUT.second, tileSize: size } }).includes(`  --fp-size-2: ${size}px;`),
  );
});

test('second-layer size stays coprime with the first', () => {
  for (const t of [60, 120, 200]) for (const sc of [0.5, 1, 1.5, 2, 3]) assert.equal(gcd(t, scaledSecondSize(t, sc)), 1, `${t} x ${sc}`);
  assert.equal(scaledSecondSize(120, 1), 193);
});

// Parallax on scroll.
const px = (m: Partial<Motion>, l2: Partial<typeof LAYER2_DEFAULTS> = {}, parallax = true) =>
  exportCss({ ...L2_INPUT, motion: { ...MOTION_NONE, ...m }, second: { ...L2_INPUT.second, ...l2 }, parallax });
const block = (s: string) => s.slice(s.indexOf('@media (prefers-reduced-motion: no-preference) {'), s.indexOf('\n\n/* Use:'));

test('parallax off: output equals the literals copied before the change', () => {
  const drifting = { rotate: 15, drift: 'xy' as const, speed: 6 };
  assert.equal(px(drifting, {}, false), BEFORE_L2_DRIFT);
  assert.equal(px({}, {}, false), BEFORE_L2_STATIC);
  // Without a second layer, parallax does nothing.
  assert.equal(exportCss({ ...base, parallax: true }), exportCss(base));
});

test('parallax: the block sits inside the reduced-motion query and the @supports test, after the support comment', () => {
  const out = px({});
  assert.ok(
    out.includes(
      '/* Parallax on scroll needs Chrome or Edge 115, Safari 26, or Firefox 159. Other browsers show the two layers without it. */\n' +
        '@media (prefers-reduced-motion: no-preference) {\n  @supports (animation-timeline: scroll()) {\n',
    ),
  );
  const b = block(out);
  assert.ok(b.endsWith('\n  }\n}'));
  assert.equal(count(b, '{'), count(b, '}'));
  assert.equal(count(out, 'animation-timeline: scroll(root)'), 2);
  assert.ok(out.lastIndexOf('animation-timeline') < out.indexOf('/* Use:'));
});

test('parallax: animation-timeline follows animation in each rule', () => {
  for (const m of [{}, { drift: 'x' as const }]) {
    const lines = block(px(m)).split('\n');
    const at = lines.flatMap((l, i) => (/^ {6}animation-timeline: /.test(l) ? [i] : []));
    assert.equal(at.length, 2);
    for (const i of at) assert.match(lines[i - 1] ?? '', /^ {6}animation: /);
  }
});

test('parallax: travel follows depth, clamped to 2vh and 32vh, and the boxes grow by it', () => {
  for (const [depth, vh] of [
    [0.5, 4],
    [1, 8],
    [2, 16],
    [0.25, 2],
    [4, 32],
  ] as const) {
    assert.equal(parallaxTravel(depth), vh);
    const out = px({}, { depth });
    assert.ok(out.includes(`to { transform: translateY(-${vh}vh); }`), `${depth}`);
    assert.ok(out.includes(`  inset: 0 0 -${vh}vh;`), `${depth}`);
  }
  assert.equal(parallaxTravel(0.1), 2);
  assert.equal(parallaxTravel(10), 32);
  const out = px({}, { depth: 0.5 });
  assert.ok(out.includes('to { transform: translateY(-4vh); }'));
  assert.ok(out.includes('  inset: 0 0 -4vh;'));
  // A centered box grows by the travel on each side, the same box rule as for rotation.
  const turned = px({ rotate: 15 }, { depth: 2 });
  assert.ok(turned.includes('  width: calc(150vmax + 8vh);\n  height: calc(150vmax + 8vh);'));
  assert.ok(turned.includes('  width: calc(150vmax + 32vh);\n  height: calc(150vmax + 32vh);'));
  assert.ok(turned.includes('to { transform: translateY(-16vh) translate(-50%, -50%) rotate(15deg); }'));
  assert.ok(turned.includes('from { transform: translateY(0) translate(-50%, -50%) rotate(15deg); }'));
});

test('parallax with a drift: both animations and both timelines, in the same order', () => {
  const b = block(px({ drift: 'x', speed: 6 }, { depth: 0.5 }));
  assert.ok(
    b.includes('      animation: fp-drift 6s linear infinite, fp-scroll-1 linear both;\n      animation-timeline: auto, scroll(root);'),
  );
  assert.ok(
    b.includes('      animation: fp-drift-2 12s linear infinite, fp-scroll-2 linear both;\n      animation-timeline: auto, scroll(root);'),
  );
});

test('parallax demo CSS differs from the export block only in the timeline and the class name', () => {
  for (const m of [{}, { drift: 'xy' as const, rotate: 20 }]) {
    const i = { ...L2_INPUT, motion: { ...MOTION_NONE, ...m }, second: { ...L2_INPUT.second, depth: 0.5, rotate: 30 }, parallax: true };
    const demo = exportParallax(i, 'fp-parallax-demo', '--fp-demo').join('\n');
    assert.ok(!demo.includes('fp-pattern') && !demo.includes('scroll(root)'));
    assert.equal(demo.replaceAll('.fp-parallax-demo', '.fp-pattern').replaceAll('--fp-demo', 'scroll(root)'), block(exportCss(i)));
  }
});

// Literals taken from the export before the sections option: with sections off, the export stays byte-identical.
const uri = svgToDataUri(svg);
const secondOff = { svg, tileSize: 193, x: 25, y: 50, rotate: 15, scale: 1, opacity: 0.5, depth: 2 };
const offCases: Record<string, ExportInput> = {
  static: base,
  turned: { ...base, motion: { ...MOTION_NONE, rotate: 30 } },
  layer2drift: { ...base, motion: { ...MOTION_NONE, drift: 'xy', speed: 6 }, second: secondOff },
  parallax: { ...base, second: secondOff, parallax: true },
};
const offLiterals: Record<string, string[]> = {
  static: [
    '/* Demo: Tree, seed 1, depth 8. Tile 120px. */',
    '.fp-pattern {',
    '  --fp-bg: #f5f5f5;',
    '  --fp-ink: #12232e;',
    `  --fp-tile: url("${uri}");`,
    '  --fp-size: 120px;',
    '  position: relative;',
    '  isolation: isolate;',
    '  overflow: hidden;',
    '  background-color: var(--fp-bg);',
    '  color: var(--fp-ink);',
    '}',
    '.fp-pattern::before {',
    '  content: "";',
    '  position: absolute;',
    '  z-index: -1;',
    '  inset: 0;',
    '  background-image: var(--fp-tile);',
    '  background-size: var(--fp-size) var(--fp-size);',
    '}',
    '',
    '.fp-plate {',
    '  background-color: rgb(245 245 245 / 0.85);',
    '  border-radius: 12px;',
    '  padding: 1rem;',
    '}',
    '',
    '/* Use: put class="fp-pattern" on the element that shows the pattern.',
    ' * Put class="fp-plate" on the element that holds the text.',
    ' */',
  ],
  turned: [
    '/* Demo: Tree, seed 1, depth 8. Tile 120px. */',
    '.fp-pattern {',
    '  --fp-bg: #f5f5f5;',
    '  --fp-ink: #12232e;',
    `  --fp-tile: url("${uri}");`,
    '  --fp-size: 120px;',
    '  position: relative;',
    '  isolation: isolate;',
    '  overflow: hidden;',
    '  background-color: var(--fp-bg);',
    '  color: var(--fp-ink);',
    '}',
    '.fp-pattern::before {',
    '  content: "";',
    '  position: absolute;',
    '  z-index: -1;',
    '  left: 50%;',
    '  top: 50%;',
    '  width: 150vmax;',
    '  height: 150vmax;',
    '  background-image: var(--fp-tile);',
    '  background-size: var(--fp-size) var(--fp-size);',
    '  transform: translate(-50%, -50%) rotate(30deg);',
    '}',
    '',
    '.fp-plate {',
    '  background-color: rgb(245 245 245 / 0.85);',
    '  border-radius: 12px;',
    '  padding: 1rem;',
    '}',
    '',
    '/* Use: put class="fp-pattern" on the element that shows the pattern.',
    ' * Put class="fp-plate" on the element that holds the text.',
    ' */',
  ],
  layer2drift: [
    '/* Demo: Tree, seed 1, depth 8. Tile 120px. */',
    '.fp-pattern {',
    '  --fp-bg: #f5f5f5;',
    '  --fp-ink: #12232e;',
    `  --fp-tile: url("${uri}");`,
    '  --fp-size: 120px;',
    `  --fp-tile-2: url("${uri}");`,
    '  --fp-size-2: 193px;',
    '  position: relative;',
    '  isolation: isolate;',
    '  overflow: hidden;',
    '  background-color: var(--fp-bg);',
    '  color: var(--fp-ink);',
    '}',
    '.fp-pattern::before {',
    '  content: "";',
    '  position: absolute;',
    '  z-index: -1;',
    '  inset: 0;',
    '  background-image: var(--fp-tile);',
    '  background-size: var(--fp-size) var(--fp-size);',
    '  animation: fp-drift 6s linear infinite;',
    '}',
    '.fp-pattern::after {',
    '  content: "";',
    '  position: absolute;',
    '  z-index: -1;',
    '  left: 50%;',
    '  top: 50%;',
    '  width: 150vmax;',
    '  height: 150vmax;',
    '  background-image: var(--fp-tile-2);',
    '  background-size: var(--fp-size-2) var(--fp-size-2);',
    '  background-position: calc(var(--fp-size-2) * 0.25) calc(var(--fp-size-2) * 0.5);',
    '  opacity: 0.5;',
    '  transform: translate(-50%, -50%) rotate(15deg);',
    '  animation: fp-drift-2 3s linear infinite;',
    '}',
    '',
    '@keyframes fp-drift {',
    '  to { background-position: var(--fp-size) var(--fp-size); }',
    '}',
    '',
    '@keyframes fp-drift-2 {',
    '  to { background-position: calc(var(--fp-size-2) * 1.25) calc(var(--fp-size-2) * 1.5); }',
    '}',
    '',
    '.fp-pattern.fp-paused::before, .fp-pattern.fp-paused::after {',
    '  animation-play-state: paused;',
    '}',
    '',
    '@media (prefers-reduced-motion: reduce) {',
    '  .fp-pattern::before, .fp-pattern::after {',
    '    animation: none;',
    '  }',
    '}',
    '',
    '.fp-plate {',
    '  background-color: rgb(245 245 245 / 0.85);',
    '  border-radius: 12px;',
    '  padding: 1rem;',
    '}',
    '',
    '/* Use: put class="fp-pattern" on the element that shows the pattern.',
    ' * Put class="fp-plate" on the element that holds the text.',
    ' * Add the class fp-paused to pause the motion.',
    ' * This pattern has two layers. It repeats exactly every 23160 px.',
    ' */',
  ],
  parallax: [
    '/* Demo: Tree, seed 1, depth 8. Tile 120px. */',
    '.fp-pattern {',
    '  --fp-bg: #f5f5f5;',
    '  --fp-ink: #12232e;',
    `  --fp-tile: url("${uri}");`,
    '  --fp-size: 120px;',
    `  --fp-tile-2: url("${uri}");`,
    '  --fp-size-2: 193px;',
    '  position: relative;',
    '  isolation: isolate;',
    '  overflow: hidden;',
    '  background-color: var(--fp-bg);',
    '  color: var(--fp-ink);',
    '}',
    '.fp-pattern::before {',
    '  content: "";',
    '  position: absolute;',
    '  z-index: -1;',
    '  inset: 0 0 -4vh;',
    '  background-image: var(--fp-tile);',
    '  background-size: var(--fp-size) var(--fp-size);',
    '}',
    '.fp-pattern::after {',
    '  content: "";',
    '  position: absolute;',
    '  z-index: -1;',
    '  left: 50%;',
    '  top: 50%;',
    '  width: calc(150vmax + 32vh);',
    '  height: calc(150vmax + 32vh);',
    '  background-image: var(--fp-tile-2);',
    '  background-size: var(--fp-size-2) var(--fp-size-2);',
    '  background-position: calc(var(--fp-size-2) * 0.25) calc(var(--fp-size-2) * 0.5);',
    '  opacity: 0.5;',
    '  transform: translate(-50%, -50%) rotate(15deg);',
    '}',
    '',
    '.fp-plate {',
    '  background-color: rgb(245 245 245 / 0.85);',
    '  border-radius: 12px;',
    '  padding: 1rem;',
    '}',
    '',
    '/* Parallax on scroll needs Chrome or Edge 115, Safari 26, or Firefox 159. Other browsers show the two layers without it. */',
    '@media (prefers-reduced-motion: no-preference) {',
    '  @supports (animation-timeline: scroll()) {',
    '    @keyframes fp-scroll-1 {',
    '      from { transform: translateY(0); }',
    '      to { transform: translateY(-4vh); }',
    '    }',
    '    .fp-pattern::before {',
    '      animation: fp-scroll-1 linear both;',
    '      animation-timeline: scroll(root);',
    '    }',
    '    @keyframes fp-scroll-2 {',
    '      from { transform: translateY(0) translate(-50%, -50%) rotate(15deg); }',
    '      to { transform: translateY(-16vh) translate(-50%, -50%) rotate(15deg); }',
    '    }',
    '    .fp-pattern::after {',
    '      animation: fp-scroll-2 linear both;',
    '      animation-timeline: scroll(root);',
    '    }',
    '  }',
    '}',
    '',
    '/* Use: put class="fp-pattern" on the element that shows the pattern.',
    ' * Put class="fp-plate" on the element that holds the text.',
    ' * This pattern has two layers. It repeats exactly every 23160 px.',
    ' */',
  ],
};

test('sections off: the export is byte-identical to the export before the option', () => {
  for (const [k, i] of Object.entries(offCases)) {
    const want = offLiterals[k]!.join('\n');
    assert.equal(exportCss(i), want, k);
    assert.equal(exportCss({ ...i, sections: false }), want, k);
  }
});

const RULES = [
  '.fp-pattern.fp-a { --fp-turn: 137deg; }',
  '.fp-pattern.fp-b { --fp-turn: 95deg; }',
  '.fp-pattern.fp-c { --fp-turn: 52deg; }',
];
// Each `.fp-pattern::before {` or `.fp-pattern::after {` block, up to its closing brace.
const layerBlocks = (s: string) => {
  const lines = s.split('\n');
  return lines.flatMap((l, i) => (/^\.fp-pattern::(before|after) \{$/.test(l) ? [lines.slice(i, lines.indexOf('}', i) + 1)] : []));
};

test('sections on: three helper rules, every layer turns by --fp-turn on the oversized centered box', () => {
  const inputs = [...Object.values(offCases), ...motions.map((m) => ({ ...base, motion: { ...MOTION_NONE, ...m } }))];
  for (const i of inputs) {
    const out = exportCss({ ...i, sections: true });
    for (const r of RULES) assert.equal(count(out, r), 1, r);
    assert.equal(count(out, '/* Add fp-a, fp-b, or fp-c next to fp-pattern to turn the pattern on that section. */'), 1);
    assert.equal(count(out, ' * Add fp-a, fp-b, or fp-c on successive sections'), 1);
    const blocks = layerBlocks(out);
    assert.equal(blocks.length, i.second ? 2 : 1);
    for (const b of blocks) {
      const t = b.find((l) => l.startsWith('  transform: '));
      assert.ok(t?.includes('var(--fp-turn, 0deg)'), b.join('\n'));
      assert.ok(b.includes('  left: 50%;'), b.join('\n'));
      assert.ok(
        b.some((l) => /^ {2}width: (calc\()?\d+(\.\d+)?vmax/.test(l)),
        b.join('\n'),
      );
      assert.ok(
        b.some((l) => /^ {2}height: (calc\()?\d+(\.\d+)?vmax/.test(l)),
        b.join('\n'),
      );
    }
  }
});

test('sections on, static design: the layer turns by 0deg plus --fp-turn on the 150vmax box', () => {
  const block = layerBlocks(exportCss({ ...base, sections: true }))[0]!;
  assert.deepEqual(block, [
    '.fp-pattern::before {',
    '  content: "";',
    '  position: absolute;',
    '  z-index: -1;',
    '  left: 50%;',
    '  top: 50%;',
    '  width: 150vmax;',
    '  height: 150vmax;',
    '  background-image: var(--fp-tile);',
    '  background-size: var(--fp-size) var(--fp-size);',
    '  transform: translate(-50%, -50%) rotate(calc(0deg + var(--fp-turn, 0deg)));',
    '}',
  ]);
});

test('sections on with parallax: the keyframes repeat the layer rule calc( rotation', () => {
  for (const m of motions) {
    const out = exportCss({ ...offCases.parallax!, motion: { ...MOTION_NONE, ...m }, sections: true });
    const kf = out.slice(out.indexOf('@media (prefers-reduced-motion: no-preference)'));
    for (const b of layerBlocks(out)) {
      const rot = /rotate\(calc\([^)]*\)\)\)/.exec(b.find((l) => l.startsWith('  transform: ')) ?? '')?.[0];
      assert.ok(rot, b.join('\n'));
      assert.equal(count(kf, rot), 2, rot); // from and to
    }
  }
});

test('a rectangular tile: --fp-size-y, background-size on both variables, drift xy ends at one width and one height', () => {
  const s = css({ drift: 'xy' }, { tileSize: 120, tileHeight: 102.077 });
  assert.ok(s.includes('  --fp-size: 120px;\n  --fp-size-y: 102.077px;'));
  assert.ok(s.includes('  background-size: var(--fp-size) var(--fp-size-y);'));
  assert.ok(s.includes('  to { background-position: var(--fp-size) var(--fp-size-y); }'));
  // The motion scale applies to both sides.
  assert.ok(css({ scale: 2 }, { tileSize: 120, tileHeight: 102.077 }).includes('  --fp-size: 240px;\n  --fp-size-y: 204.154px;'));
  // A height equal to the width writes the square export.
  assert.equal(css({ drift: 'xy' }, { tileSize: 120, tileHeight: 120 }), css({ drift: 'xy' }, { tileSize: 120 }));
});

test('a rectangular second layer: --fp-size-2-y, its own background-size and drift keyframes', () => {
  const s = css({ drift: 'xy' }, { tileSize: 120, tileHeight: 102.077, second: { svg, tileSize: 163, tileHeight: 138.653 } });
  assert.ok(s.includes('  --fp-size-2: 163px;\n  --fp-size-2-y: 138.653px;'));
  assert.ok(s.includes('  background-size: var(--fp-size-2) var(--fp-size-2-y);'));
  assert.ok(s.includes('  to { background-position: var(--fp-size-2) var(--fp-size-2-y); }'));
});

test('second layer color: off keeps the pattern color in both tiles; on draws tile 2 in its own color', async () => {
  const { generate } = await import('./fractal.ts');
  for (const kind of ['tree', 'koch', 'hilbert'] as const) {
    const tile = (seed: number, color: string) =>
      generate({ kind, seed, size: 64, depth: 3, strokeWidth: 1, precision: 1, color, opacity: 0.6 });
    const css = (color2: string) => exportCss({ ...L2_INPUT, svg: tile(1, '#336699'), second: { svg: tile(2, color2), tileSize: 101 } });
    const off = css('#336699');
    const on = css('#e07a5f');
    const uri = (c: string) => svgToDataUri(tile(2, c));
    assert.ok(off.includes(uri('#336699')) && !off.includes('e07a5f'), kind);
    assert.ok(on.includes(uri('#e07a5f')) && !on.includes(uri('#336699')), kind);
    assert.ok(on.includes(svgToDataUri(tile(1, '#336699'))), kind);
    assert.equal(on.split('--fp-tile').length, off.split('--fp-tile').length, kind);
  }
});

test('the first comment names the tool address when a source is given, and only then', () => {
  const plain = exportCss(base).split('\n')[0]!;
  assert.ok(!plain.includes('Made with'));
  const first = exportCss({ ...base, source: 'https://patterns.pierreguilbert.com/' }).split('\n')[0]!;
  assert.ok(first.endsWith('Made with https://patterns.pierreguilbert.com/ */'), first);
  assert.equal(exportCss({ ...base, source: 'x*/y' }).split('*/').length, exportCss(base).split('*/').length);
});
