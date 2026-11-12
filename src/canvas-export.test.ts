import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { exportCanvasJs, exportPaintWorklet, sceneData } from './canvas-export.ts';
import { geometry } from './fractal.ts';
import { squareScene, type Scene } from './scene.ts';

const stroke: Scene = {
  width: 120,
  height: 80,
  layers: [
    {
      polys: [
        [
          [0, 0],
          [10.26, 5.04],
        ],
      ],
      paint: { mode: 'stroke', color: '#336699', opacity: 0.5, width: 1 },
    },
  ],
};
const fill: Scene = {
  width: 120,
  height: 80,
  layers: [
    {
      polys: [
        [
          [0, 0],
          [10, 0],
          [10, 10],
        ],
      ],
      paint: { mode: 'fill', color: '#112233', opacity: 1, width: 1 },
    },
  ],
};

type Call = [string, ...unknown[]];
// Records every method call and every property assignment.
function recorder(calls: Call[]): Record<string, unknown> {
  const target: Record<string, unknown> = {};
  return new Proxy(target, {
    get: (t, k: string) =>
      k in t
        ? t[k]
        : (...args: unknown[]) => {
            calls.push([k, ...args]);
            return k === 'createPattern' ? { pattern: true } : undefined;
          },
    set: (t, k: string, v) => {
      calls.push(['set ' + k, v]);
      t[k] = v;
      return true;
    },
  });
}

interface FakeCanvas {
  width: number;
  height: number;
  style: Record<string, string>;
  attrs: Record<string, string>;
  calls: Call[];
  setAttribute(k: string, v: string): void;
  getContext(kind: string): unknown;
}

function run(text: string, opts: { els?: number; noContext?: boolean } = {}) {
  const canvases: FakeCanvas[] = [];
  const children: unknown[] = [];
  const el = {
    clientWidth: 300,
    clientHeight: 200,
    style: {} as Record<string, string>,
    get firstChild() {
      return children[0] ?? null;
    },
    insertBefore(node: unknown, ref: unknown) {
      const i = children.indexOf(ref);
      children.splice(i < 0 ? children.length : i, 0, node);
    },
    getAttribute: () => null,
  };
  const fakeDocument = {
    querySelectorAll: (sel: string) => (sel === '.fp-canvas' && (opts.els ?? 1) > 0 ? [el] : []),
    createElement: (tag: string) => {
      assert.equal(tag, 'canvas');
      const calls: Call[] = [];
      const c: FakeCanvas = {
        width: 300,
        height: 150,
        style: {},
        attrs: {},
        calls,
        setAttribute(k, v) {
          this.attrs[k] = v;
        },
        getContext: () => (opts.noContext ? null : recorder(calls)),
      };
      canvases.push(c);
      return c;
    },
  };
  const listeners: string[] = [];
  const fakeWindow = { devicePixelRatio: 2, addEventListener: (type: string) => listeners.push(type) };
  new Function('document', 'window', 'ResizeObserver', text)(fakeDocument, fakeWindow, undefined);
  return { canvases, children, el, listeners };
}

const names = (calls: Call[]) => calls.map((c) => c[0]);

test('sceneData is compact JSON with rounded, flattened polylines', () => {
  assert.equal(sceneData(stroke, 1), '{"w":120,"h":80,"l":[{"m":"s","c":"#336699","o":0.5,"w":1,"p":[[0,0,10.3,5]]}]}');
  assert.match(sceneData(fill, 1), /"m":"f"/);
});

test('exportCanvasJs inserts a canvas, draws the tile, and fills with a repeating pattern', () => {
  const text = exportCanvasJs(stroke, '#f5f5f5', 2);
  assert.ok(text.startsWith('// Draws the pattern on a canvas. Put the class fp-canvas on an element.\n'));
  assert.doesNotThrow(() => new Function(text));
  const { canvases, children, el, listeners } = run(text);
  const [tile, cv] = canvases;
  assert.ok(tile && cv);
  assert.deepEqual(children, [cv]);
  assert.equal(cv.width, 600);
  assert.equal(cv.height, 400);
  assert.equal(cv.attrs['aria-hidden'], 'true');
  assert.equal(cv.style.position, 'absolute');
  assert.equal(cv.style.zIndex, '-1');
  assert.equal(el.style.position, 'relative');
  assert.equal(el.style.isolation, 'isolate');
  assert.deepEqual(listeners, ['resize']);
  assert.ok(tile.calls.some((c) => c[0] === 'moveTo' && c[1] === 0 && c[2] === 0));
  assert.ok(tile.calls.some((c) => c[0] === 'lineTo' && c[1] === 10.26 && c[2] === 5.04));
  assert.ok(names(tile.calls).includes('stroke'));
  assert.ok(cv.calls.some((c) => c[0] === 'createPattern' && c[1] === tile && c[2] === 'repeat'));
  const fills = cv.calls.filter((c) => c[0] === 'fillRect');
  assert.ok(fills.length >= 2);
  const styles = cv.calls.filter((c) => c[0] === 'set fillStyle').map((c) => c[1]);
  assert.deepEqual(styles, ['#f5f5f5', { pattern: true }]);
});

test('exportCanvasJs does nothing without elements or without a 2D context', () => {
  const text = exportCanvasJs(stroke, '#f5f5f5', 2);
  assert.doesNotThrow(() => run(text, { els: 0 }));
  assert.doesNotThrow(() => run(text, { noContext: true }));
  assert.deepEqual(run(text, { noContext: true }).children, []);
});

test('a fill layer fills with evenodd and does not stroke', () => {
  const [tile] = run(exportCanvasJs(fill, '#ffffff', 2)).canvases;
  assert.ok(tile);
  assert.ok(tile.calls.some((c) => c[0] === 'fill' && c[1] === 'evenodd'));
  assert.ok(!names(tile.calls).includes('stroke'));
  assert.ok(names(tile.calls).includes('closePath'));
});

test('exportPaintWorklet tiles the scene over the paint area', () => {
  const { worklet, css, register } = exportPaintWorklet(stroke, '#f5f5f5', 2);
  assert.ok(worklet.includes("registerPaint('fp-pattern'"));
  assert.ok(worklet.includes('paint(ctx, geom)'));
  let Cls: (new () => { paint(ctx: unknown, geom: { width: number; height: number }): void }) | undefined;
  new Function('registerPaint', worklet)((name: string, c: typeof Cls) => {
    assert.equal(name, 'fp-pattern');
    Cls = c;
  });
  assert.ok(Cls);
  const calls: Call[] = [];
  new Cls().paint(recorder(calls), { width: 250, height: 130 });
  assert.deepEqual(calls[0], ['set fillStyle', '#f5f5f5']);
  assert.deepEqual(calls[1], ['fillRect', 0, 0, 250, 130]);
  assert.equal(calls.filter((c) => c[0] === 'translate').length, 6);
  assert.equal(calls.filter((c) => c[0] === 'moveTo' && c[1] === 0 && c[2] === 0).length, 6);
  assert.ok(css.includes('paint(fp-pattern)'));
  assert.ok(css.includes('background-color: #f5f5f5;'));
  assert.ok(register.includes("'paintWorklet' in CSS"));
  assert.ok(register.startsWith('// Experimental: the CSS Paint API works in Chromium browsers only.\n'));
});

test('exportPaintWorklet stops after 400 tiles', () => {
  const tiny: Scene = { ...stroke, width: 1, height: 1 };
  const { worklet } = exportPaintWorklet(tiny, '#f5f5f5', 2);
  let Cls: (new () => { paint(ctx: unknown, geom: { width: number; height: number }): void }) | undefined;
  new Function('registerPaint', worklet)((_: string, c: typeof Cls) => (Cls = c));
  assert.ok(Cls);
  const calls: Call[] = [];
  new Cls().paint(recorder(calls), { width: 1000, height: 1000 });
  assert.equal(calls.filter((c) => c[0] === 'translate').length, 400);
});

test('crafted colors cannot inject script or CSS', () => {
  const evil = 'red;}</script><script>alert(1)//';
  const scene: Scene = { ...stroke, layers: stroke.layers.map((l) => ({ ...l, paint: { ...l.paint, color: evil } })) };
  const { worklet, css, register } = exportPaintWorklet(scene, 'url(x)', 2);
  const texts = [sceneData(scene, 2), exportCanvasJs(scene, 'url(x)', 2), worklet, css, register];
  for (const t of texts) {
    assert.ok(!t.includes('</script>'));
    assert.ok(!t.includes('alert(1)'));
    assert.ok(!t.includes('url(x)'));
  }
  assert.match(sceneData(scene, 2), /"c":"#000000"/);
  assert.ok(css.includes('background-color: #000000;'));
});

test('the script texts are plain JavaScript', () => {
  const { worklet, register } = exportPaintWorklet(stroke, '#f5f5f5', 2);
  const canvas = exportCanvasJs(stroke, '#f5f5f5', 2);
  for (const t of [canvas, worklet, register]) {
    assert.doesNotMatch(t, /\bimport\b|\brequire\b/);
  }
  assert.doesNotThrow(() => new Function(canvas));
  assert.doesNotThrow(() => new Function(register));
  assert.doesNotThrow(() => new Function('registerPaint', worklet));
});

test('the canvas script for a herringbone tile stays under 12000 characters', () => {
  const p = { kind: 'herringbone', seed: 1, depth: 2, size: 120 } as const;
  const scene = squareScene(geometry(p), { size: 120, strokeWidth: 1, color: '#333333', opacity: 1 });
  assert.ok(exportCanvasJs(scene, '#f5f5f5', 2).length < 12000);
});

test('the module source has no node imports and no randomness', () => {
  const src = readFileSync(new URL('./canvas-export.ts', import.meta.url), 'utf8');
  assert.ok(!src.includes('node:'));
  assert.ok(!src.includes('Math.random'));
});
