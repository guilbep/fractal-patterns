import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safePathData } from '../motifgrid.ts';
import { PALETTES } from '../palettes.ts';
import { layerColors, studioSvg, type Placement, type Repeat, type Studio } from './model.ts';
import { MOTIF_FAMILIES } from './motifs.ts';
import { torusDistance } from './scatter.ts';
import { compose, composeColors, composeParts, composeSummary, latticeDistance, motifRadius, type ComposeOptions } from './compose.ts';
import type { Pt } from '../patterns/util.ts';
import { createHash } from 'node:crypto';
import { decodeStudio, designOptions } from './studio-share.ts';

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
    assert.ok(p.heroes.length >= 1);
    assert.equal(p.studio.layers.length, off.layers.length + 1);
  }
});

test('bytes, straight repeat: worst over seeds 1..8', () => {
  const worst = (density: number) => Math.max(...SEEDS.map((seed) => composeSummary(compose(opt(seed, { density }))).bytes));
  // Measured worst (heroes moved back along cut stems): 9504 at 0.2, 11587 at 0.5, 12981 at 0.9.
  assert.ok(worst(0.2) <= 10000);
  assert.ok(worst(0.5) <= 12000);
  assert.ok(worst(0.9) <= 13000);
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
    // Measured 0.183 (seed 4, 2 plants) to 0.348; floor: the minimum rounded down to 0.05.
    assert.ok(hit / 4096 >= 0.15 && hit / 4096 <= 0.75, `seed ${seed} ${hit / 4096}`);
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
  let total = 0;
  let twoSupports = 0;
  let bothSides = 0;
  let heroes = 0;
  let endsInMotif = 0;
  for (const repeat of REPEATS) {
    for (const seed of SEEDS) {
      const at = `${repeat} ${seed}`;
      const p = composeParts(opt(seed, { repeat }));
      assert.ok(p.plants.length >= 2, at);
      for (const pl of p.plants) {
        const onStem = (q: Pt) => Math.min(...pl.stem.slice(1).map((b, i) => segDistance(q, pl.stem[i]!, b)));
        // A vine's hero ends a side stalk that starts on the stem; other heroes sit on the stem's tip.
        if (pl.tip && pl.tipStalk) {
          assert.ok(pl.vine && segDistance(base(pl.tip), pl.tipStalk[0], pl.tipStalk[1]) <= 1.5, `${at} tip`);
          assert.ok(onStem(pl.tipStalk[0]) <= 1.5, `${at} tip stalk`);
        } else if (pl.tip) assert.ok(onStem(base(pl.tip)) <= 1.5, `${at} tip`);
        else assert.equal(pl.tipStalk, null, `${at} no hero, no stalk`);
        // Goals, measured over all plants below: at least 2 supports (no stalk), supports on both sides, a hero.
        total++;
        if (pl.attached.filter((a) => a.stalk === null).length >= 2) twoSupports++;
        if (new Set(pl.attached.map((a) => Math.sign(a.side))).size === 2) bothSides++;
        if (pl.tip) heroes++;
        // The stem ends in a motif: a vine (closed, no end) with its hero, else a hero or support base within 3% of the side.
        const end = pl.stem[pl.stem.length - 1]!;
        const bases = [...(pl.tip && !pl.tipStalk ? [pl.tip] : []), ...pl.attached.filter((a) => !a.stalk).map((a) => a.placement)];
        if (pl.vine ? pl.tip : bases.some((b) => Math.hypot(base(b)[0] - end[0], base(b)[1] - end[1]) <= 9)) endsInMotif++;
        for (const a of pl.attached) {
          const d = a.stalk ? segDistance(base(a.placement), a.stalk[0], a.stalk[1]) : onStem(base(a.placement));
          assert.ok(d <= 1.5, `${at} attached ${d}`);
          if (a.stalk) assert.ok(onStem(a.stalk[0]) <= 1.5, `${at} stalk`);
        }
        for (const a of pl.attached)
          if (a.stalk) assert.ok(Math.hypot(a.stalk[1][0] - a.stalk[0][0], a.stalk[1][1] - a.stalk[0][1]) >= 12, `${at} short stalk`);
      }
      // Stems of different plants, 17 samples each (every 8th of 129), on the repeat's lattice,
      // except a branch's samples within `junction` of its start, against its host.
      const samples = p.plants.map((pl) => pl.stem.filter((_, i) => i % 8 === 0));
      const nearJunction = (i: number, j: number, b: Pt) => {
        const s0 = p.plants[j]!.stem[0]!;
        return p.plants[j]!.host === i && Math.hypot(b[0] - s0[0], b[1] - s0[1]) < p.junction;
      };
      for (let i = 0; i < samples.length; i++)
        for (let j = i + 1; j < samples.length; j++)
          for (const a of samples[i]!)
            for (const b of samples[j]!)
              if (!nearJunction(i, j, b) && !nearJunction(j, i, a))
                assert.ok(latticeDistance(a, b, repeat, 300, 300) >= p.stemDistance - 1e-9, `${at} stems ${i} ${j}`);
      const stemPts = p.plants.flatMap((pl) => pl.stem);
      for (const f of p.filler) {
        const c = circle(p.studio, f);
        for (const q of stemPts) assert.ok(latticeDistance([c.x, c.y], q, repeat, 300, 300) >= c.r + p.fillerMargin, `${at} filler`);
      }
    }
  }
  // Measured over 4 repeats x 8 seeds (117 plants): 0.923 with 2 supports, 0.889 on both sides (was 0.923: supports
  // now share a cut stem with a moved hero), 0.932 with a hero, 0.983 ending in a motif.
  assert.ok(twoSupports / total >= 0.9, `supports ${twoSupports / total}`);
  assert.ok(bothSides / total >= 0.85, `sides ${bothSides / total}`);
  assert.ok(heroes / total >= 0.9, `heroes ${heroes / total}`);
  assert.ok(endsInMotif / total >= 0.95, `ends ${endsInMotif / total}`);
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

// Shortest distance from q to a polyline, over the copies of q on the repeat's lattice.
const LAT: Record<Repeat, [Pt, Pt]> = {
  straight: [
    [300, 0],
    [0, 300],
  ],
  mirror: [
    [300, 0],
    [0, 300],
  ],
  'half-drop': [
    [300, 150],
    [0, 300],
  ],
  brick: [
    [300, 0],
    [150, 300],
  ],
};
const toPolyline = (q: Pt, line: readonly Pt[], repeat: Repeat) => {
  const [u, v] = LAT[repeat];
  let best = Infinity;
  for (let i = -3; i <= 3; i++)
    for (let j = -3; j <= 3; j++) {
      const c: Pt = [q[0] + i * u[0] + j * v[0], q[1] + i * u[1] + j * v[1]];
      for (let k = 1; k < line.length; k++) best = Math.min(best, segDistance(c, line[k - 1]!, line[k]!));
    }
  return best;
};
const heading = (a: Pt, b: Pt) => Math.atan2(b[1] - a[1], b[0] - a[0]);
const angleDiff = (a: number, b: number) => Math.abs(((((a - b) * 180) / Math.PI + 540) % 360) - 180);

test('vine: one per tile at density 0.5, closed on the repeat with a smooth joint', () => {
  for (const repeat of ['straight', 'half-drop', 'brick'] as Repeat[])
    for (const seed of SEEDS) {
      const at = `${repeat} ${seed}`;
      const vines = composeParts(opt(seed, { repeat })).plants.filter((pl) => pl.vine);
      assert.equal(vines.length, 1, at);
      const st = vines[0]!.stem;
      const [a, b] = [st[0]!, st[st.length - 1]!];
      assert.ok(Math.hypot(b[0] - a[0], b[1] - a[1]) > 100 && latticeDistance(a, b, repeat, 300, 300) < 1e-6, `${at} closed`);
      const d = angleDiff(heading(st[0]!, st[1]!), heading(st[st.length - 2]!, st[st.length - 1]!));
      assert.ok(d < 5, `${at} joint ${d}`);
    }
});

test('branches start on their host stem; mirror has one root', () => {
  for (const repeat of REPEATS)
    for (const seed of SEEDS) {
      const at = `${repeat} ${seed}`;
      const ps = composeParts(opt(seed, { repeat })).plants;
      assert.ok(ps.length >= 2, at);
      if (repeat === 'mirror') assert.equal(ps.filter((pl) => pl.host === null).length, 1, at);
      for (const pl of ps) {
        if (pl.vine || pl.host === null) continue;
        const host = ps[pl.host]!;
        assert.ok(toPolyline(pl.stem[0]!, host.stem, repeat) <= 1.5, `${at} junction`);
      }
    }
});

test('stem directions span more than 40 degrees for at least 6 of 8 seeds', () => {
  let ok = 0;
  for (const seed of SEEDS) {
    const dirs = composeParts(opt(seed)).plants.map((pl) => heading(pl.stem[0]!, pl.stem[pl.stem.length - 1]!));
    const span = Math.max(...dirs.flatMap((a) => dirs.map((b) => angleDiff(a, b))));
    if (span > 40) ok++;
  }
  assert.ok(ok >= 6, `${ok}`);
});

test("no touching: motif circles keep a gap from other plants' circles and stems", () => {
  const gap = 2;
  const half = 0.75;
  for (const repeat of REPEATS)
    for (const seed of SEEDS) {
      const p = composeParts(opt(seed, { repeat }));
      const circles = p.plants.map((pl) =>
        [...(pl.tip ? [pl.tip] : []), ...pl.attached.map((a) => a.placement)].map((q) => circle(p.studio, q)),
      );
      for (let i = 0; i < circles.length; i++)
        for (let j = 0; j < circles.length; j++) {
          if (i === j) continue;
          for (const c of circles[i]!) {
            for (const k of circles[j]!)
              assert.ok(
                latticeDistance([c.x, c.y], [k.x, k.y], repeat, 300, 300) >= c.r + k.r + gap - 0.2,
                `${repeat} ${seed} circles ${i} ${j}`,
              );
            for (const q of p.plants[j]!.stem)
              assert.ok(latticeDistance([c.x, c.y], q, repeat, 300, 300) >= c.r + half + gap - 0.2, `${repeat} ${seed} stem ${i} ${j}`);
          }
        }
    }
});

test('stem stroke: about 0.5 percent of the shorter side', () => {
  const s = compose(opt(1));
  assert.ok(s.layers.some((l) => l.color === colors.stem && l.strokeWidth === 1.5));
});

test('a hero moved back from the tip sits on its cut stem, with no bare stem beyond it', () => {
  let moved = 0;
  for (const repeat of REPEATS)
    for (const seed of SEEDS)
      for (const pl of composeParts(opt(seed, { repeat })).plants) {
        if (!pl.tip || pl.vine) continue;
        const at = `${repeat} ${seed}`;
        const b = base(pl.tip);
        const onStem = Math.min(...pl.stem.slice(1).map((q, i) => segDistance(b, pl.stem[i]!, q)));
        assert.ok(onStem <= 1.5, `${at} base ${onStem}`);
        const d = pl.stem.map((q) => Math.hypot(q[0] - b[0], q[1] - b[1]));
        const i = d.indexOf(Math.min(...d));
        for (const e of d.slice(i)) assert.ok(e <= 9, `${at} bare ${e}`);
        if (pl.stem.length < 129) moved++;
      }
  assert.ok(moved > 0);
});

test('compose without a custom motif: the same SVG as before custom motifs (sha-256 prefixes taken before the change)', () => {
  const want: Record<number, string> = { 1: '7590d6259efb59b3', 2: 'f559d32054f2970c', 3: '928794dc891c594e' };
  for (const seed of [1, 2, 3]) {
    const svg = studioSvg(compose({ ...designOptions(decodeStudio('')), seed }));
    assert.equal(createHash('sha256').update(svg).digest('hex').slice(0, 16), want[seed], `seed ${seed}`);
  }
});

// Three nested shapes in a box of 100, base at the bottom center, back to front.
const SHAPES = [
  { color: '#2a7a3a', d: 'M30 96L50 4L70 96Z' },
  { color: '#e070a0', d: 'M38 60L50 20L62 60Z' },
  { color: '#f0c020', d: 'M45 45L50 30L55 45Z' },
];
const custom = (role: 'hero' | 'support' | 'both', keepColors: boolean, shapes = SHAPES) => ({ shapes, box: 100, role, keepColors });

test('compose with a custom hero: each hero placement drawn once per shape with the same transform', () => {
  for (const seed of SEEDS) {
    const parts = composeParts(opt(seed, { custom: custom('hero', true) }));
    const s = parts.studio;
    const ids = SHAPES.map((sh) => s.motifs.findIndex((m) => m.d === sh.d));
    assert.ok(ids.every((i) => i >= 0));
    assert.ok(parts.heroes.length > 0);
    const key = (p: Placement) => `${p.x} ${p.y} ${p.scale} ${p.rotate} ${p.flip}`;
    const per = ids.map((m) =>
      s.layers
        .flatMap((l) => l.placements.filter((p) => p.motif === m))
        .map(key)
        .sort(),
    );
    assert.equal(per[0]!.length, parts.heroes.length);
    assert.deepEqual(per[1], per[0]);
    assert.deepEqual(per[2], per[0]);
    // One layer per shape, back to front, in the traced colors.
    const layers = s.layers.filter((l) => l.placements.some((p) => ids.includes(p.motif)));
    assert.deepEqual(
      layers.map((l) => l.color),
      SHAPES.map((sh) => sh.color),
    );
    assert.ok(layerColors(s).length <= 5 + 3);
    for (const m of s.motifs) assert.ok(safePathData(m.d));
    assert.equal(studioSvg(compose(opt(seed, { custom: custom('hero', true) }))), studioSvg(s));
  }
});

test('compose with a custom motif on the palette: at most 5 colors; support and both roles', () => {
  for (const seed of SEEDS.slice(0, 4)) {
    for (const role of ['hero', 'support', 'both'] as const) {
      const p = composeParts(opt(seed, { custom: custom(role, false) }));
      assert.ok(layerColors(p.studio).length <= 5, role);
      const used = new Set(p.studio.layers.flatMap((l) => l.placements.map((q) => q.motif)));
      const first = p.studio.motifs.findIndex((m) => m.d === SHAPES[0]!.d);
      assert.ok(used.has(first), role);
      const supports = p.plants.flatMap((pl) => pl.attached.filter((a) => !a.stalk).map((a) => a.placement.motif));
      if (role !== 'hero') assert.ok(supports.length > 0 && supports.every((m) => m === first), role);
      if (role !== 'support')
        assert.ok(
          p.heroes.every((h) => h.motif === first),
          role,
        );
      else assert.ok(p.heroes.every((h) => h.motif !== first));
    }
  }
});

test('compose: unsafe custom path data is dropped; with nothing left the generated motif is used', () => {
  const bad = [{ color: '#ff0000', d: 'M0 0L10 10"/><script>' }];
  assert.equal(studioSvg(compose(opt(3, { custom: custom('hero', true, bad) }))), studioSvg(compose(opt(3))));
  const mixed = composeParts(opt(3, { custom: custom('hero', true, [...bad, ...SHAPES.slice(1)]) })).studio;
  assert.ok(mixed.motifs.every((m) => safePathData(m.d) && !m.d.includes('<')));
  assert.ok(mixed.motifs.some((m) => m.d === SHAPES[1]!.d));
});
