import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cssMotion, isStatic, MOTION_NONE, type Motion } from './motion.ts';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><path d="M0 0h4"/></svg>';
const css = (m: Partial<Motion>) => cssMotion(svg, '#f5f5f5', 120, { ...MOTION_NONE, ...m });

test('isStatic', () => {
  assert.equal(isStatic(MOTION_NONE), true);
  assert.equal(isStatic({ ...MOTION_NONE, rotate: 30 }), false);
  assert.equal(isStatic({ ...MOTION_NONE, scale: 1.5 }), false);
  assert.equal(isStatic({ ...MOTION_NONE, drift: 'x' }), false);
});

test('static config: inset layer, no transform or animation', () => {
  const c = css({});
  assert.ok(c.includes('inset: 0;'));
  for (const s of ['transform:', 'animation', '@keyframes', 'prefers-reduced-motion', '150vmax']) assert.ok(!c.includes(s), s);
  assert.ok(c.includes('background-size: 120px 120px;'));
  assert.ok(c.includes('background-color: #f5f5f5;'));
  assert.ok(c.includes('url("data:image/svg+xml,'));
});

test('rotate only: centered square', () => {
  const c = css({ rotate: 30 });
  assert.ok(c.includes('transform: translate(-50%, -50%) rotate(30deg);'));
  assert.ok(c.includes('width: 150vmax;'));
  assert.ok(!c.includes('inset: 0;'));
  assert.ok(!c.includes('animation'));
});

test('scale only: inset layer', () => {
  const c = css({ scale: 1.5 });
  assert.ok(c.includes('inset: 0;'));
  assert.ok(c.includes('background-size: 180px 180px;'));
  assert.ok(!c.includes('transform:'));
});

test('all transforms in fixed order', () => {
  assert.ok(
    css({ tilt: 55, rotate: 10, skew: 5, scale: 2 }).includes(
      'transform: translate(-50%, -50%) perspective(800px) rotateX(55deg) rotate(10deg) skewX(5deg);',
    ),
  );
});

test('scale drives the drift distance', () => {
  assert.ok(css({ scale: 2, drift: 'x' }).includes('to { background-position: 240px 0; }'));
});

test('tilt: layer pivots on the top edge', () => {
  const c = css({ tilt: 55, scale: 2 });
  for (const s of [
    'top: 0;',
    'width: 225vmax;',
    'height: 225vmax;',
    'background-size: 240px 240px;',
    'transform: translate(-50%, -50%) perspective(800px) rotateX(55deg);',
  ])
    assert.ok(c.includes(s), s);
});

test('skew widens the layer by 1 / cos(skew)', () => {
  assert.ok(css({ skew: 45 }).includes('width: 212.1vmax;'));
});

test('scale 1, tilt 0: byte-identical to the output before F2', () => {
  const head =
    '.fp-pattern {\n  position: relative;\n  isolation: isolate;\n  overflow: hidden;\n  background-color: #f5f5f5;\n}\n.fp-pattern::before {\n  content: "";\n  position: absolute;\n  z-index: -1;\n';
  const img =
    '  background-image: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'4\' height=\'4\'%3E%3Cpath d=\'M0 0h4\'/%3E%3C/svg%3E");\n  background-size: 120px 120px;\n';
  const square = '  left: 50%;\n  top: 50%;\n  width: 150vmax;\n  height: 150vmax;\n';
  const anim = (speed: string, to: string) =>
    `  animation: fp-drift ${speed}s linear infinite;\n}\n\n@keyframes fp-drift {\n  to { background-position: ${to}; }\n}\n\n.fp-pattern.fp-paused::before {\n  animation-play-state: paused;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .fp-pattern::before {\n    animation: none;\n  }\n}`;
  assert.equal(css({}), `${head}  inset: 0;\n${img}}`);
  assert.equal(css({ rotate: 30 }), `${head}${square}${img}  transform: translate(-50%, -50%) rotate(30deg);\n}`);
  assert.equal(
    css({ drift: 'xy', rotate: 45, speed: 3.5 }),
    `${head}${square}${img}  transform: translate(-50%, -50%) rotate(45deg);\n${anim('3.5', '120px 120px')}`,
  );
  assert.equal(css({ drift: 'x', speed: 8 }), `${head}  inset: 0;\n${img}${anim('8', '120px 0')}`);
});

test('drift x', () => {
  const c = css({ drift: 'x', speed: 8 });
  for (const s of [
    'animation: fp-drift 8s linear infinite;',
    'to { background-position: 120px 0; }',
    '.fp-pattern.fp-paused::before {',
    'animation-play-state: paused;',
    '@media (prefers-reduced-motion: reduce) {',
    'animation: none;',
    'inset: 0;',
  ])
    assert.ok(c.includes(s), s);
  assert.ok(!c.includes('transform:'));
});

test('drift y and xy', () => {
  assert.ok(css({ drift: 'y' }).includes('to { background-position: 0 120px; }'));
  assert.ok(css({ drift: 'xy' }).includes('to { background-position: 120px 120px; }'));
});

test('exact output for MOTION_NONE', () => {
  assert.equal(
    css({}),
    '.fp-pattern {\n  position: relative;\n  isolation: isolate;\n  overflow: hidden;\n  background-color: #f5f5f5;\n}\n.fp-pattern::before {\n  content: "";\n  position: absolute;\n  z-index: -1;\n  inset: 0;\n  background-image: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'4\' height=\'4\'%3E%3Cpath d=\'M0 0h4\'/%3E%3C/svg%3E");\n  background-size: 120px 120px;\n}',
  );
});

const configs: Partial<Motion>[] = [
  {},
  { rotate: 30 },
  { scale: 1.5 },
  { tilt: 55, rotate: 10, skew: 5, scale: 2 },
  { drift: 'x', speed: 8 },
  { drift: 'xy', rotate: 45, tilt: 20, speed: 3.5 },
];

test('braces balance', () => {
  for (const m of configs) {
    const c = css(m);
    assert.equal(c.split('{').length, c.split('}').length, JSON.stringify(m));
  }
});

test('no raw < > or newline inside url()', () => {
  for (const m of configs) {
    const urls = [...css(m).matchAll(/url\("([^"]*)"\)/g)];
    assert.equal(urls.length, 1);
    for (const [, body] of urls) assert.ok(body !== undefined && !/[<>\n]/.test(body));
  }
});
