import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { type Shape, type VectorKind, vectorShapes, vectorTexture } from './vector.ts';

const KINDS: VectorKind[] = ['terrazzo', 'stipple'];
const opts = (seed: number, strength = 40) => ({
  seed,
  scale: 1,
  strength,
  background: '#f4efe6',
  colors: ['#f4efe6', '#c44', '#2a6', '#246', '#d92'],
});
const key = (s: Shape, dx = 0, dy = 0) =>
  s.kind === 'dot' ? `${s.color}:${s.x + dx},${s.y + dy}` : `${s.color}:${s.pts.map(([x, y]) => `${x + dx},${y + dy}`).join(';')}`;
const bbox = (s: Shape): [number, number, number, number] =>
  s.kind === 'dot'
    ? [s.x - s.r, s.x + s.r, s.y - s.r, s.y + s.r]
    : [
        Math.min(...s.pts.map((p) => p[0])),
        Math.max(...s.pts.map((p) => p[0])),
        Math.min(...s.pts.map((p) => p[1])),
        Math.max(...s.pts.map((p) => p[1])),
      ];
const centre = (s: Shape): [number, number] => (s.kind === 'dot' ? [s.x, s.y] : s.at);

for (const kind of KINDS) {
  test(`${kind}: every edge-crossing shape has its shifted copies, corners included`, () => {
    for (let seed = 1; seed <= 5; seed++) {
      const { size, shapes } = vectorShapes(kind, { ...opts(seed, 80), scale: 2 });
      const all = new Set(shapes.map((s) => key(s)));
      let crossing = 0;
      for (const s of shapes.filter((x) => !x.copy)) {
        const [x0, x1, y0, y1] = bbox(s);
        const sx = x0 < 0 ? size : x1 > size ? -size : 0;
        const sy = y0 < 0 ? size : y1 > size ? -size : 0;
        if (sx || sy) crossing++;
        if (sx) assert.ok(all.has(key(s, sx, 0)));
        if (sy) assert.ok(all.has(key(s, 0, sy)));
        if (sx && sy) assert.ok(all.has(key(s, sx, sy)));
      }
      assert.ok(crossing > 0);
    }
  });

  test(`${kind}: original shapes keep the toroidal minimum distance`, () => {
    const { size, shapes, minDist } = vectorShapes(kind, opts(3, 100));
    const cs = shapes.filter((s) => !s.copy).map(centre);
    cs.forEach(([ax, ay], i) =>
      cs.slice(i + 1).forEach(([bx, by]) => {
        const dx = Math.min(Math.abs(ax - bx), size - Math.abs(ax - bx));
        const dy = Math.min(Math.abs(ay - by), size - Math.abs(ay - by));
        assert.ok(Math.hypot(dx, dy) >= minDist);
      }),
    );
    assert.ok(cs.length > 10);
  });

  test(`${kind}: integer coordinates, one well-formed svg root`, () => {
    const { svg } = vectorTexture(kind, opts(7));
    assert.equal(svg.match(/<svg\b/g)?.length, 1);
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
    for (const [, v = ''] of svg.matchAll(/ (?:d|viewBox|width|height)="([^"]*)"/g)) assert.match(v, /^[-\dMLZh ]*$/);
    // Every tag is self-closed except the root.
    assert.equal(svg.match(/<[a-z]+\b[^>]*[^/]>/g)?.length, 1);
  });

  test(`${kind}: strength 0 gives only the background rect`, () => {
    const t = vectorTexture(kind, opts(1, 0));
    assert.equal(t.shapes, 0);
    assert.equal(t.svg.match(/<(?!\/)\w+/g)?.join(), '<svg,<rect');
  });

  test(`${kind}: deterministic, seed-dependent`, () => {
    assert.equal(vectorTexture(kind, opts(4)).svg, vectorTexture(kind, opts(4)).svg);
    assert.notEqual(vectorTexture(kind, opts(4)).svg, vectorTexture(kind, opts(5)).svg);
  });

  test(`${kind}: gzip size for seeds 1..10 stays under 8 KB`, () => {
    const sizes = Array.from({ length: 10 }, (_, i) => gzipSync(vectorTexture(kind, opts(i + 1)).svg, { level: 9 }).length).sort(
      (a, b) => a - b,
    );
    const [min = 0, , , , m4 = 0, m5 = 0, , , , max = 0] = sizes;
    console.log(`${kind} gzip bytes min ${min} median ${(m4 + m5) / 2} max ${max}`);
    assert.ok(max > 0 && max <= 8192);
  });
}

test('stipple uses the darkest colour; terrazzo skips the background colour', () => {
  const st = vectorShapes('stipple', opts(1, 50));
  assert.ok(st.shapes.every((s) => s.color === '#246'));
  const tz = vectorShapes('terrazzo', opts(1, 50));
  assert.ok(tz.shapes.every((s) => s.color !== '#f4efe6'));
  assert.equal(vectorShapes('stipple', { ...opts(1, 50), colors: [] }).shapes[0]?.color, '#86837f');
});
