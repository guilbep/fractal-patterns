import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safePathData } from '../motifgrid.ts';
import { PALETTES } from '../palettes.ts';
import { layerColors, studioSvg, type Placement, type Repeat, type Studio } from './model.ts';
import { MOTIF_FAMILIES } from './motifs.ts';
import { torusDistance } from './scatter.ts';
import { compose, composeColors, composeParts, composeSummary, latticeDistance, motifRadius, type ComposeOptions } from './compose.ts';
import type { Pt } from '../patterns/util.ts';

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
          assert.ok(
            latticeDistance([hs[i]!.x, hs[i]!.y], [hs[j]!.x, hs[j]!.y], repeat, 300, 300) >= hs[i]!.r + hs[j]!.r,
            `${at} heroes ${i} ${j}`,
          );
      if (repeat === 'mirror')
        for (const c of hs) assert.ok(c.x - c.r >= 0 && c.y - c.r >= 0 && c.x + c.r <= 300 && c.y + c.r <= 300, `${at} mirror edge`);
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

test('stems: none when off; one stroke layer in the stem color, all stems in one placement, when on', () => {
  for (const seed of SEEDS) {
    const off = compose(opt(seed, { stems: false }));
    assert.ok(off.layers.every((l) => l.placements.every((p) => off.motifs[p.motif]?.box === 100)));
    assert.deepEqual(fills(off), fills(compose(opt(seed))));
    const p = composeParts(opt(seed, { colors: { ...colors, stem: '#123456' } }));
    const stem = p.studio.layers.filter((l) => l.color === '#123456');
    assert.equal(stem.length, 1);
    assert.ok(stem[0]!.placements.every((q) => p.studio.motifs[q.motif]!.paint === 'stroke'));
    assert.equal(stem[0]!.placements.length, 1);
    assert.ok(p.heroes.length >= 2);
    assert.equal(p.studio.layers.length, off.layers.length + 1);
  }
});

test('bytes, straight repeat: worst over seeds 1..8', () => {
  const worst = (density: number) => Math.max(...SEEDS.map((seed) => composeSummary(compose(opt(seed, { density }))).bytes));
  // Measured worst (plants): 10319 at 0.2, 12772 at 0.5, 14607 at 0.9 (was 13179 at 0.5, 15840 at 0.9).
  assert.ok(worst(0.2) <= 10500);
  assert.ok(worst(0.5) <= 13000);
  assert.ok(worst(0.9) <= 15000);
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

// Base point of a placed motif: the bottom center of its 100 box after its transform.
const base = (p: Placement): Pt => {
  const t = (p.rotate * Math.PI) / 180;
  return [p.x - 50 * p.scale * Math.sin(t), p.y + 50 * p.scale * Math.cos(t)];
};
const segDistance = (q: Pt, a: Pt, b: Pt) => {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy);
};

test('plants: tip and alternating supports registered on their stems, stems apart, filler clear of stems', () => {
  for (const repeat of REPEATS) {
    for (const seed of SEEDS) {
      const at = `${repeat} ${seed}`;
      const p = composeParts(opt(seed, { repeat }));
      assert.ok(p.plants.length >= 2, at);
      for (const pl of p.plants) {
        const onStem = (q: Pt) => Math.min(...pl.stem.slice(1).map((b, i) => segDistance(q, pl.stem[i]!, b)));
        assert.ok(onStem(base(pl.tip)) <= 1.5, `${at} tip`);
        assert.ok(pl.attached.length >= 3, at);
        for (const a of pl.attached) {
          const d = a.stalk ? segDistance(base(a.placement), a.stalk[0], a.stalk[1]) : onStem(base(a.placement));
          assert.ok(d <= 1.5, `${at} attached ${d}`);
          if (a.stalk) assert.ok(onStem(a.stalk[0]) <= 1.5, `${at} stalk`);
        }
        assert.ok(new Set(pl.attached.map((a) => Math.sign(a.side))).size === 2, `${at} sides`);
      }
      // Stems of different plants, 17 samples each (every 8th of 129), on the repeat's lattice.
      const samples = p.plants.map((pl) => pl.stem.filter((_, i) => i % 8 === 0));
      for (let i = 0; i < samples.length; i++)
        for (let j = i + 1; j < samples.length; j++)
          for (const a of samples[i]!)
            for (const b of samples[j]!)
              assert.ok(latticeDistance(a, b, repeat, 300, 300) >= p.stemDistance - 1e-9, `${at} stems ${i} ${j}`);
      const stemPts = p.plants.flatMap((pl) => pl.stem);
      for (const f of p.filler) {
        const c = circle(p.studio, f);
        for (const q of stemPts) assert.ok(latticeDistance([c.x, c.y], q, repeat, 300, 300) >= c.r + p.fillerMargin, `${at} filler`);
      }
    }
  }
});

test('direction variety: leaf-like rotations span more than 90 degrees', () => {
  for (const seed of SEEDS) {
    const s = compose(opt(seed));
    const leafLayer = s.layers.find((l) => l.color === colors.leaf && l.placements.some((p) => s.motifs[p.motif]!.paint === 'fill'))!;
    const angles = leafLayer.placements.map((p) => ((p.rotate % 360) + 360) % 360).sort((a, b) => a - b);
    const gaps = angles.map((a, i) => (i === 0 ? a + 360 - angles[angles.length - 1]! : a - angles[i - 1]!));
    assert.ok(360 - Math.max(...gaps) > 90, `seed ${seed}`);
  }
});

test('latticeDistance uses the real period of each repeat', () => {
  assert.equal(latticeDistance([0, 0], [300, 150], 'half-drop', 300, 300), 0);
  assert.equal(latticeDistance([0, 0], [150, 300], 'brick', 300, 300), 0);
  assert.equal(latticeDistance([0, 0], [300, 0], 'half-drop', 300, 300), 150);
  assert.equal(latticeDistance([10, 0], [290, 0], 'straight', 300, 300), 20);
});
