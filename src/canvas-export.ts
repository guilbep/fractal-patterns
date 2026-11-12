// Two more exports of a scene, as text: a canvas script and an experimental CSS Paint API worklet.
// Pure: no DOM access. The scene goes into the scripts as JSON data, never as code.
import type { Scene } from './scene.ts';

const HEX = /^#[0-9a-f]{6}$/i;
const color = (c: string) => (HEX.test(c) ? c : '#000000');
// JSON-encoded, and '<' escaped so the text can sit inside a <script> element.
const json = (v: unknown) => JSON.stringify(v).replaceAll('<', '\\u003c');

export function sceneData(scene: Scene, precision: number): string {
  const f = 10 ** Math.min(3, Math.max(0, Math.round(precision)));
  const r = (v: number) => Math.round(v * f) / f || 0; // || 0 turns -0 into 0
  return json({
    w: scene.width,
    h: scene.height,
    l: scene.layers.map(({ polys, paint }) => ({
      m: paint.mode === 'fill' ? 'f' : 's',
      c: color(paint.color),
      o: paint.opacity,
      w: paint.width,
      p: polys.map((poly) => poly.flatMap(([x, y]) => [r(x), r(y)])),
    })),
  });
}

// The same drawing as drawScene in scene.ts, on the flat data of sceneData.
const DRAW = [
  '  function draw(c, d) {',
  '    d.l.forEach(function (L) {',
  "    var f = L.m === 'f';",
  '    if (f) c.fillStyle = L.c;',
  "    else { c.strokeStyle = L.c; c.lineWidth = L.w; c.lineCap = 'round'; }",
  '    c.globalAlpha = L.o;',
  '    c.beginPath();',
  '    L.p.forEach(function (p) {',
  '      var n = p.length;',
  '      if (n < 4) return;',
  '      c.moveTo(p[0], p[1]);',
  '      for (var i = 2; i < n; i += 2) c.lineTo(p[i], p[i + 1]);',
  '      if (f || (p[n - 2] === p[0] && p[n - 1] === p[1])) c.closePath();',
  '    });',
  "    if (f) c.fill('evenodd');",
  '    else c.stroke();',
  '    });',
  '    c.globalAlpha = 1;',
  '  }',
];

export function exportCanvasJs(scene: Scene, background: string, precision: number): string {
  return [
    '// Draws the pattern on a canvas. Put the class fp-canvas on an element.',
    '(function () {',
    `  var d = ${sceneData(scene, precision)};`,
    `  var bg = ${json(color(background))};`,
    "  var els = Array.prototype.slice.call(document.querySelectorAll('.fp-canvas'));",
    '  if (els.length === 0) return;',
    ...DRAW,
    '  var r = window.devicePixelRatio || 1;',
    // ponytail: the ratio is read once; a zoom change after load keeps the old tile resolution.
    "  var tile = document.createElement('canvas');",
    '  tile.width = Math.max(1, Math.round(d.w * r));',
    '  tile.height = Math.max(1, Math.round(d.h * r));',
    "  var tc = tile.getContext('2d');",
    '  if (!tc) return;',
    '  tc.setTransform(tile.width / d.w, 0, 0, tile.height / d.h, 0, 0);',
    '  draw(tc, d);',
    '  els.forEach(function (el) {',
    "    var cv = document.createElement('canvas');",
    "    var ctx = cv.getContext('2d');",
    '    if (!ctx) return;',
    "    cv.setAttribute('aria-hidden', 'true');",
    '    var s = cv.style;',
    "    s.position = 'absolute';",
    "    s.inset = '0';",
    "    s.width = '100%';",
    "    s.height = '100%';",
    "    s.zIndex = '-1';",
    '    var pos = window.getComputedStyle ? window.getComputedStyle(el).position : el.style.position;',
    "    if (!pos || pos === 'static') {",
    "      el.style.position = 'relative';",
    "      el.style.isolation = 'isolate';",
    '    }',
    '    el.insertBefore(cv, el.firstChild);',
    "    var pat = ctx.createPattern(tile, 'repeat');",
    // One tile is d.w x d.h CSS pixels: d.w * r device pixels for tile.width canvas pixels.
    '    if (pat && pat.setTransform) pat.setTransform({ a: (d.w * r) / tile.width, b: 0, c: 0, d: (d.h * r) / tile.height, e: 0, f: 0 });',
    '    function paint() {',
    '      cv.width = Math.round(el.clientWidth * r);',
    '      cv.height = Math.round(el.clientHeight * r);',
    '      ctx.fillStyle = bg;',
    '      ctx.fillRect(0, 0, cv.width, cv.height);',
    '      if (!pat) return;',
    '      ctx.fillStyle = pat;',
    '      ctx.fillRect(0, 0, cv.width, cv.height);',
    '    }',
    "    if (typeof ResizeObserver === 'function') new ResizeObserver(paint).observe(el);",
    "    else window.addEventListener('resize', paint);",
    '    paint();',
    '  });',
    '})();',
  ].join('\n');
}

export function exportPaintWorklet(
  scene: Scene,
  background: string,
  precision: number,
): { worklet: string; css: string; register: string } {
  const bg = color(background);
  const worklet = [
    '// CSS Paint API worklet: paints the pattern for background-image: paint(fp-pattern).',
    `var d = ${sceneData(scene, precision)};`,
    `var bg = ${json(bg)};`,
    ...DRAW,
    "registerPaint('fp-pattern', class {",
    '  paint(ctx, geom) {',
    '    ctx.fillStyle = bg;',
    '    ctx.fillRect(0, 0, geom.width, geom.height);',
    // A worklet context cannot make a pattern from a canvas: draw the tile at each position.
    '    var n = 0;',
    '    for (var y = 0; y < geom.height; y += d.h) {',
    '      for (var x = 0; x < geom.width; x += d.w) {',
    '        if (++n > 400) return;',
    '        ctx.save();',
    '        ctx.translate(x, y);',
    '        draw(ctx, d);',
    '        ctx.restore();',
    '      }',
    '    }',
    '  }',
    '});',
  ].join('\n');
  const css = ['.fp-paint {', `  background-color: ${bg};`, '  background-image: paint(fp-pattern);', '}'].join('\n');
  const register = [
    '// Experimental: the CSS Paint API works in Chromium browsers only.',
    "if ('paintWorklet' in CSS) CSS.paintWorklet.addModule('fp-pattern.worklet.js');",
  ].join('\n');
  return { worklet, css, register };
}
