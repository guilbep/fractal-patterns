import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { accentDefaults, accentShapes } from './accent-layer.ts';
import { accentSvg } from './accent-svg.ts';
import { ACCENT_VARY_DEFAULTS, pivot, varyAccent, type AccentPlace } from './accent-vary.ts';
import type { Poly, Pt } from './patterns/util.ts';
import { closedPathData, num } from './scene.ts';

const count = (s: string, sub: string) => s.split(sub).length - 1;

test('4 dots on a grid: one shape in defs, 4 uses, no rotate or scale', () => {
  const layer = { on: true, shape: 'dot', size: 15, amount: 100, place: 'grid', snap: 4 } as const;
  const dots = accentShapes('tree', { ...layer, snap: 4 }, { seed: 1, depth: 4, size: 40 }).slice(0, 4);
  const svg = accentSvg(dots, undefined, 40, 40, '#e07a3f', 1);
  assert.equal(count(svg, '<path id='), 1);
  assert.equal(count(svg, '<use'), 4);
  assert.ok(!svg.includes('rotate(') && !svg.includes('scale('), svg);
  assert.ok(svg.includes('<g fill="#e07a3f" fill-rule="nonzero">'));
});

test('Truchet varied defaults: a use per shape, gzip under 5000 bytes', () => {
  const shapes = accentShapes('truchet', accentDefaults('truchet'), { seed: 7, depth: 4, size: 96 });
  const v = varyAccent(shapes, 96, 96, ACCENT_VARY_DEFAULTS, 7);
  const svg = accentSvg(shapes, v.places, v.width, v.height, '#e07a3f', 1);
  assert.equal(count(svg, '<use'), v.polys.length);
  assert.ok(gzipSync(svg).length < 5000, String(gzipSync(svg).length));
});

test('no copies: an empty tile', () => {
  assert.equal(
    accentSvg([], [], 10, 10, '#000', 1),
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10"></svg>',
  );
});

test('16 squares on a grid, no variation: all inline in one path, no defs', () => {
  const layer = { on: true, shape: 'square', size: 15, amount: 100, place: 'grid', snap: 4 } as const;
  const squares = accentShapes('tree', layer, { seed: 1, depth: 4, size: 40 }).slice(0, 16);
  assert.equal(squares.length, 16);
  const svg = accentSvg(squares, undefined, 40, 40, '#e07a3f', 1);
  assert.equal(count(svg, '<use'), 0);
  assert.equal(count(svg, '<defs'), 0);
  assert.equal(count(svg, '<path'), 1);
});

// The two methods alone, written with the same helpers: every copy inline, and every copy a <use> (the writer before).
const svgHead = (w: number, h: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
const allInline = (polys: readonly Poly[], w: number, h: number) =>
  `${svgHead(w, h)}<g fill="#e07a3f" fill-rule="nonzero"><path d="${polys.map((p) => closedPathData([p], 1)).join('')}"/></g></svg>`;
function allUse(shapes: readonly Poly[], places: readonly AccentPlace[], w: number, h: number): string {
  const centers = shapes.map(pivot);
  const unitOf = new Map<string, number>();
  const shapeUnit = shapes.map((p, i) => {
    const d = closedPathData([p.map(([x, y]): Pt => [x - centers[i]!.x, y - centers[i]!.y])], 1);
    if (!unitOf.has(d)) unitOf.set(d, unitOf.size);
    return unitOf.get(d)!;
  });
  const used = new Set(places.map((p) => shapeUnit[p.shape]!));
  const defs = [...unitOf].filter(([, u]) => used.has(u)).map(([d, u]) => `<path id="ac${u}" d="${d}"/>`);
  const uses = places.map(({ shape, x, y, rotate, scale }) => {
    const r = Math.max(1e-9, ...shapes[shape]!.map(([px, py]) => Math.hypot(px - centers[shape]!.x, py - centers[shape]!.y)));
    const deg = num((rotate * 180) / Math.PI, Math.max(0, 1 + Math.ceil(Math.log10((r * Math.PI) / 180))));
    const k = num(scale, Math.max(0, 1 + Math.ceil(Math.log10(r))));
    const t = `translate(${num(x, 1)} ${num(y, 1)})${deg === '0' ? '' : ` rotate(${deg})`}${k === '1' ? '' : ` scale(${k})`}`;
    return `<use href="#ac${shapeUnit[shape]}" transform="${t}"/>`;
  });
  return `${svgHead(w, h)}<defs>${defs.join('')}</defs><g fill="#e07a3f" fill-rule="nonzero">${uses.join('')}</g></svg>`;
}

for (const shape of ['triangle', 'square', 'dot'] as const)
  for (const turn of [0, 100])
    test(`${shape}s scattered on 6 x 6, turn ${turn}: gzip no larger than either method alone (+64 bytes)`, () => {
      const layer = { on: true, shape, size: 20, amount: 100, place: 'seed', snap: 8 } as const;
      const s = accentShapes('tree', layer, { seed: 5, depth: 4, size: 120 });
      const v = varyAccent(s, 120, 120, { ...ACCENT_VARY_DEFAULTS, turn }, 5);
      const gz = (t: string) => gzipSync(t).length;
      const n = gz(accentSvg(s, v.places, v.width, v.height, '#e07a3f', 1));
      const best = Math.min(gz(allInline(v.polys, v.width, v.height)), gz(allUse(s, v.places, v.width, v.height)));
      assert.ok(n <= best + 64, `${n} > ${best} + 64`);
    });
