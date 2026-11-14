import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';

// state.ts imports through the Vite alias '@/'; map it to src/ for node.
const src = new URL('./', import.meta.url).href;
registerHooks({ resolve: (s, c, next) => next(s.startsWith('@/') ? src + s.slice(2) : s, c) });
const { params, roles, svg, lineStyle, lineStyleReady, lineStyleOffReason, interlace, interlaceReady, reset } = await import('./state.ts');

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const at = (kind: string, seed: number, depth: number, style: 'even' | 'brush' | 'hand'): string => {
  Object.assign(params, { kind, seed, depth });
  lineStyle.value = style;
  return svg.value;
};
const fills = (s: string) => [...s.matchAll(/<path d="[^"]*" fill="(#[0-9a-f]{6})" fill-opacity="[\d.]+" fill-rule="nonzero"\/>/g)];

test('even: the p4m tile is unchanged (pinned before Line style)', () => {
  const s = at('p4m', 7, 8, 'even');
  assert.equal(s.length, 8479);
  assert.equal(sha(s), 'f719039a83e397a1');
});

test('brush on truchet: filled non-zero outlines in the stroke colour replace the stroked lines', async () => {
  const even = at('truchet', 1, 4, 'even');
  at('truchet', 1, 4, 'brush');
  await lineStyleReady();
  const s = at('truchet', 1, 4, 'brush');
  assert.notEqual(s, even);
  assert.equal(s.slice(0, s.indexOf('>') + 1), even.slice(0, even.indexOf('>') + 1));
  const f = fills(s);
  assert.equal(f.length, 1);
  assert.equal(f[0]![1], roles.pattern);
  assert.ok(!s.includes('stroke='), 'no stroked polyline left');
  // Seeded: the same design gives the same tile.
  assert.equal(at('truchet', 1, 4, 'brush'), s);
});

test('hand on star-hex: the hexagonal tile is squeezed and drawn at full height', async () => {
  const even = at('star-hex', 1, 2, 'even');
  await lineStyleReady();
  const s = at('star-hex', 1, 2, 'hand');
  assert.equal(s.slice(0, s.indexOf('>') + 1), even.slice(0, even.indexOf('>') + 1));
  assert.equal(fills(s).length, 1);
  assert.ok(!s.includes('stroke='));
  const ys = [...s.matchAll(/M[\d.]+[ ,]?([\d.]+)/g)].map((m) => +m[1]!);
  const h = params.size * Math.sqrt(3);
  assert.ok(Math.max(...ys) > params.size * 1.1 && Math.max(...ys) <= h + 0.1, String(Math.max(...ys)));
  assert.notEqual(at('star-hex', 1, 2, 'brush'), s);
});

test('interlace on: line style gives its reason and the tile is the interlace one', async () => {
  at('star-488', 1, 2, 'even');
  interlace.on = true;
  await interlaceReady();
  const il = svg.value;
  assert.ok(il.includes('<g id="il"'));
  const s = at('star-488', 1, 2, 'brush');
  assert.equal(lineStyleOffReason.value, 'interlace');
  assert.equal(s, il);
  reset();
  assert.equal(lineStyle.value, 'even');
  assert.equal(interlace.on, false);
});

test('hexagonal tile: lines are as wide across a horizontal line as across a vertical one', async () => {
  const { lineOutlines } = await import('./linestyle-tile.ts');
  const size = 120;
  const aspect = 1 / Math.sqrt(3); // star-hex: width / height
  const H = size / aspect;
  // Widest cross-section of the outlines along a line through c, perpendicular to the axis 0 (x) or 1 (y).
  const widest = (polys: (readonly (readonly [number, number])[])[], axis: 0 | 1, from: number, to: number, c: number) => {
    let best = 0;
    for (let t = from; t <= to; t += 0.5) {
      const vs: number[] = [];
      for (const p of polys)
        for (let i = 0; i < p.length; i++) {
          const a = p[i]!;
          const b = p[(i + 1) % p.length]!;
          if ((a[axis] - t) * (b[axis] - t) > 0 || a[axis] === b[axis]) continue;
          const v = a[1 - axis]! + ((t - a[axis]) / (b[axis] - a[axis])) * (b[1 - axis]! - a[1 - axis]!);
          if (Math.abs(v - c) < 10) vs.push(v);
        }
      if (vs.length) best = Math.max(best, Math.max(...vs) - Math.min(...vs));
    }
    return best;
  };
  // Both lines are 0.8 of the squeezed square long, so their profiles match on average over seeds.
  let across = 0;
  let along = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const o = { size, aspect, width: 2, style: 'brush' as const, seed };
    const hz = lineOutlines(
      [
        [
          [0.1 * size, H / 2],
          [0.9 * size, H / 2],
        ],
      ],
      o,
    );
    const vt = lineOutlines(
      [
        [
          [size / 2, 0.1 * H],
          [size / 2, 0.9 * H],
        ],
      ],
      o,
    );
    across += widest(hz, 0, 0.1 * size, 0.9 * size, H / 2);
    along += widest(vt, 1, 0.1 * H, 0.9 * H, size / 2);
  }
  console.log(`hex: widest across a horizontal line ${(across / 20).toFixed(2)}, across a vertical line ${(along / 20).toFixed(2)}`);
  assert.ok(Math.abs(across / along - 1) <= 0.1, `${across / along}`);
});
