import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compose, composeColors, composeParts } from './compose.ts';
import { GROUND_ANGLES, GROUND_ZONE, groundLayer } from './ground.ts';
import { studioInstances, studioSvg, type Repeat } from './model.ts';
import { trackingInput, trackingScore } from './tracking.ts';
import { PALETTES } from '../palettes.ts';

const REPEATS: Repeat[] = ['straight', 'half-drop', 'brick', 'mirror'];
const base = { width: 300, height: 300, density: 0.5, families: [], stems: true, colors: composeColors(PALETTES[0]!.colors) } as const;

test('groundLayer is deterministic for a seed and differs between seeds', () => {
  assert.deepEqual(groundLayer({ seed: 5, width: 300, height: 300 }), groundLayer({ seed: 5, width: 300, height: 300 }));
  assert.notDeepEqual(groundLayer({ seed: 5, width: 300, height: 300 }), groundLayer({ seed: 6, width: 300, height: 300 }));
});

test('one placement per grid cell, in the middle 60 percent of its cell, 6 x 6 per unit tile', () => {
  for (const [span, w, n] of [
    [1, 300, 6],
    [2, 600, 12],
  ] as const) {
    const g = groundLayer({ seed: 3, width: w, height: w, span });
    assert.equal(g.length, n * n);
    const c = w / n;
    const lo = (1 - GROUND_ZONE) / 2;
    g.forEach((p, k) => {
      const [i, j] = [k % n, Math.floor(k / n)];
      for (const [v, cell] of [
        [p.x / c - i, i],
        [p.y / c - j, j],
      ] as const)
        assert.ok(v >= lo - 0.01 && v <= 1 - lo + 0.01, `cell ${cell} offset ${v}`);
      assert.ok(p.scale >= ((0.05 * 300) / 10) * 0.8 - 1e-3 && p.scale <= ((0.05 * 300) / 10) * 1.2 + 1e-3, String(p.scale));
    });
  }
});

test('at least 6 distinct rotations occur', () => {
  const angles = new Set(groundLayer({ seed: 1, width: 300, height: 300 }).map((p) => p.rotate));
  assert.ok(angles.size >= 6, String(angles.size));
  for (const a of angles) assert.ok((GROUND_ANGLES as readonly number[]).includes(a));
});

test('the ground wraps on the lattice for the four repeats: every instance moved by a cell period is again an instance', () => {
  // The placements lie in the tile; the model draws the tile's copies (half-drop, brick, mirror) and the wrap copies
  // across the repeat cell, so the instance set modulo the cell is the same set seen from any lattice copy.
  for (const repeat of REPEATS) {
    const s = compose({ ...base, seed: 4, repeat, ground: true });
    const g = s.layers[0]!.placements;
    for (const p of g) assert.ok(p.x >= 0 && p.x < s.width && p.y >= 0 && p.y < s.height);
    const inst = studioInstances(s).filter((i) => i.layer === 0);
    const cw = repeat === 'half-drop' || repeat === 'mirror' ? 2 * s.width : s.width;
    const ch = repeat === 'brick' || repeat === 'mirror' ? 2 * s.height : s.height;
    const key = (x: number, y: number, m: number) => `${m}:${(((x % cw) + cw) % cw).toFixed(1)}:${(((y % ch) + ch) % ch).toFixed(1)}`;
    const set = new Set(inst.map((i) => key(i.x, i.y, i.motif)));
    const copies = repeat === 'straight' ? 1 : repeat === 'mirror' ? 4 : 2;
    assert.equal(set.size, g.length * copies, repeat);
    // An instance that crosses the cell edge has its copy one period away (drawn), so the seam closes.
    for (const i of inst) assert.ok(set.has(key(i.x + cw, i.y, i.motif)) && set.has(key(i.x, i.y + ch, i.motif)), repeat);
  }
});

test('ground false: the SVG is byte-identical to the default; ground true adds only a first layer in the soft color', () => {
  for (const seed of [1, 2, 3]) {
    const o = { ...base, seed, repeat: 'straight' as const, theme: 'floral' as const };
    const off = studioSvg(compose(o));
    assert.equal(studioSvg(compose({ ...o, ground: false })), off);
    const on = studioSvg(compose({ ...o, ground: true }));
    assert.ok(on.includes(`fill="${o.colors.ground}"`));
    // The plants' part: everything after the ground layer's group equals the SVG without the ground.
    const plants = (svg: string) => svg.slice(svg.indexOf('</defs>'));
    const groundGroup = `<g fill="${o.colors.ground}">`;
    const onPlants = plants(on);
    const cut = onPlants.indexOf('</g>', onPlants.indexOf(groundGroup)) + 4;
    assert.equal('</defs>' + onPlants.slice(cut), plants(off));
    assert.ok(on.startsWith(off.slice(0, off.indexOf('</defs>'))));
  }
});

test('the balance measure ignores the ground', () => {
  for (const theme of ['floral', 'sea', 'orchard'] as const) {
    const o = { ...base, seed: 8, repeat: 'half-drop' as const, theme };
    const a = composeParts(o);
    const b = composeParts({ ...o, ground: true });
    assert.deepEqual(b.tracking, a.tracking);
    assert.deepEqual(trackingScore(trackingInput(b), o.repeat, o.width, o.height, 1), a.tracking);
  }
});
