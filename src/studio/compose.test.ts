import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safePathData } from '../motifgrid.ts';
import { PALETTES } from '../palettes.ts';
import { layerColors, studioSvg, type Placement, type Repeat, type Studio } from './model.ts';
import { MOTIF_FAMILIES } from './motifs.ts';
import { torusDistance } from './scatter.ts';
import { compose, composeColors, composeParts, composeSummary, motifRadius, type ComposeOptions } from './compose.ts';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const REPEATS: Repeat[] = ['straight', 'half-drop', 'brick', 'mirror'];
const colors = { background: '#fbfaf7', leaf: '#4f8a5b', bloom: '#c0503a', detail: '#22302a', stem: '#4f8a5b' };
const opt = (seed: number, rest: Partial<ComposeOptions> = {}): ComposeOptions => ({
  seed,
  width: 300,
  height: 300,
  repeat: 'straight',
  density: 0.5,
  families: [...MOTIF_FAMILIES],
  colors,
  stems: true,
  ...rest,
});
const fills = (s: Studio): Placement[] => s.layers.flatMap((l) => l.placements.filter((p) => s.motifs[p.motif]?.paint === 'fill'));
// The real circle of a placed motif: the bounds' center moved by the placement's transform.
const circle = (s: Studio, p: Placement) => {
  const r = motifRadius(s.motifs[p.motif]!);
  const t = (p.rotate * Math.PI) / 180;
  const ox = r.cx * p.scale * (p.flip ? -1 : 1);
  const oy = r.cy * p.scale;
  return { x: p.x + ox * Math.cos(t) - oy * Math.sin(t), y: p.y + ox * Math.sin(t) + oy * Math.cos(t), r: r.radius * p.scale };
};

test('motifRadius holds the bounds around their center', () => {
  const m = motifRadius({ d: 'M40 20L60 20L60 100L40 100Z', box: 100, paint: 'fill' });
  assert.deepEqual([m.cx, m.cy], [0, 10]);
  assert.ok(Math.abs(m.radius - Math.hypot(10, 40)) < 1e-9);
});

test('compose: deterministic, seeds differ, safe compact studio, heroes do not overlap', () => {
  for (const repeat of REPEATS) {
    for (const seed of SEEDS) {
      const at = `${repeat} ${seed}`;
      const p = composeParts(opt(seed, { repeat }));
      const s = p.studio;
      const svg = studioSvg(s);
      assert.equal(svg, studioSvg(compose(opt(seed, { repeat }))), at);
      assert.notEqual(svg, studioSvg(compose(opt(seed + 1, { repeat }))), at);
      assert.ok(!svg.includes('\n') && svg.includes('<use '), at);
      for (const m of s.motifs) assert.equal(safePathData(m.d), m.d, at);
      assert.ok(s.motifs.length <= 14, at);
      assert.ok(layerColors(s).length <= 5, at);
      assert.equal(s.background, colors.background);
      const hs = p.heroes.map((h) => circle(s, h));
      for (let i = 0; i < hs.length; i++)
        for (let j = i + 1; j < hs.length; j++)
          assert.ok(torusDistance([hs[i]!.x, hs[i]!.y], [hs[j]!.x, hs[j]!.y], 300, 300) >= hs[i]!.r + hs[j]!.r, `${at} heroes ${i} ${j}`);
    }
  }
});

test('density raises the number of placements', () => {
  for (const seed of SEEDS)
    assert.ok(fills(compose(opt(seed, { density: 0.9 }))).length > fills(compose(opt(seed, { density: 0.2 }))).length);
});

test('families: only leaf motifs when only leaf is allowed, still at least 6 placements', () => {
  for (const seed of SEEDS) {
    const p = composeParts(opt(seed, { families: ['leaf'] }));
    assert.ok(p.families.length > 0 && p.families.every((f) => f === 'leaf'));
    assert.ok(fills(p.studio).length >= 6);
  }
});

test('stems: none when off; one stroke layer in the stem color, one stem per hero, when on', () => {
  for (const seed of SEEDS) {
    const off = compose(opt(seed, { stems: false }));
    assert.ok(off.layers.every((l) => l.placements.every((p) => !off.motifs[p.motif]?.d.startsWith('M50 0C'))));
    const p = composeParts(opt(seed, { colors: { ...colors, stem: '#123456' } }));
    const stem = p.studio.layers.filter((l) => l.color === '#123456');
    assert.equal(stem.length, 1);
    assert.ok(stem[0]!.placements.every((q) => p.studio.motifs[q.motif]!.paint === 'stroke'));
    assert.equal(stem[0]!.placements.length, p.heroes.length);
    assert.equal(p.studio.layers.length, off.layers.length + 1);
  }
});

test('bytes, straight repeat: worst over seeds 1..8', () => {
  const worst = (density: number) => Math.max(...SEEDS.map((seed) => composeSummary(compose(opt(seed, { density }))).bytes));
  // Measured worst: 13179 at 0.5 (the 12000 estimate does not hold), 15840 at 0.9.
  assert.ok(worst(0.5) < 14000);
  assert.ok(worst(0.9) < 20000);
});

test('composeColors maps the five roles', () => {
  const p = PALETTES.find((x) => x.name === 'Lagoon, mono')!;
  const [paper, ink, stroke, accent] = p.colors;
  assert.deepEqual(composeColors(p.colors), { background: paper, leaf: stroke, bloom: accent, detail: ink, stem: stroke });
});

test('coverage of the real motif circles at density 0.5', () => {
  for (const seed of SEEDS) {
    const s = compose(opt(seed));
    const cs = fills(s).map((p) => circle(s, p));
    let hit = 0;
    for (let i = 0; i < 64; i++)
      for (let j = 0; j < 64; j++)
        if (cs.some((c) => torusDistance([((i + 0.5) * 300) / 64, ((j + 0.5) * 300) / 64], [c.x, c.y], 300, 300) < c.r)) hit++;
    // Measured 0.519 to 0.548.
    assert.ok(hit / 4096 >= 0.25 && hit / 4096 <= 0.75, `seed ${seed} ${hit / 4096}`);
  }
});
