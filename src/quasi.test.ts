import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONVERGENTS,
  dodecaEdges,
  dodecaStars,
  midQuad,
  octaEdges,
  octaStars,
  QUASI_ASPECT,
  QUASI_MAX_DEPTH,
  quasiApproximant,
  quasiNormals,
  quasiTile,
  type Fold,
  type Tile,
} from './quasi.ts';
import { torusEdgeKey } from './penrose.ts';
import { pathData } from './scene.ts';
import { mulberry32, type Pt } from './patterns/util.ts';

const FOLDS = [8, 12] as const;
const LEVELS = 4;
const ANGLES: Record<Fold, number[]> = { 8: [45, 90], 12: [30, 60, 90] };
const R2 = Math.SQRT2 / 2;
const H3 = Math.sqrt(3) / 2;
const dist = (p: Pt, q: Pt) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const angle = (o: Pt, p: Pt, q: Pt) => {
  const a = [p[0] - o[0], p[1] - o[1]];
  const b = [q[0] - o[0], q[1] - o[1]];
  return (Math.acos((a[0]! * b[0]! + a[1]! * b[1]!) / Math.hypot(a[0]!, a[1]!) / Math.hypot(b[0]!, b[1]!)) * 180) / Math.PI;
};
const mod = (v: number, m: number) => v - Math.floor(v / m) * m;

// Expected periods from the formulas: 8-fold V = (2q + 2p r, 0), (0, 2q + 2p r); 12-fold 3q + 2p h.
const period = (fold: Fold, p: number, q: number) => (fold === 8 ? 2 * q + 2 * p * R2 : 3 * q + 2 * p * H3);

test('quasiApproximant: crossing count, unit rhombs, expected angles, period formulas', () => {
  for (const fold of FOLDS)
    for (let level = 1; level <= LEVELS; level++) {
      const [p, q] = CONVERGENTS[fold][level - 1]!;
      // Crossings of families j, l in the cell = |det| of the integer shifts of T1, T2 (lattice index).
      const G = quasiNormals(fold, p, q);
      const n1 = G.map(([x]) => x * 2 * q);
      const n2 = G.map(([, y]) => y * 2 * q);
      let crossings = 0;
      for (let j = 0; j < G.length; j++)
        for (let l = j + 1; l < G.length; l++) crossings += Math.round(Math.abs(n1[j]! * n2[l]! - n1[l]! * n2[j]!));
      for (let seed = 1; seed <= 3; seed++) {
        const a = quasiApproximant(fold, seed, level);
        const msg = `fold ${fold} level ${level} seed ${seed}`;
        assert.equal(a.tiles.length, crossings, msg);
        assert.ok(Math.abs(a.width - period(fold, p, q)) < 1e-9, msg);
        assert.ok(Math.abs(a.height - period(fold, p, q)) < 1e-9, msg);
        for (const t of a.tiles) {
          assert.ok(ANGLES[fold].includes(t.angle), msg);
          const [w, x, y, z] = t.points;
          for (const [u, v] of [
            [w, x],
            [x, y],
            [y, z],
            [z, w],
          ] as const)
            assert.ok(Math.abs(dist(u, v) - 1) < 1e-9, msg);
          const corner = angle(w, x, z);
          assert.ok(Math.abs(Math.min(corner, 180 - corner) - t.angle) < 1e-6, msg);
        }
        if (seed === 1) {
          const counts = ANGLES[fold].map((g) => `${g}: ${a.tiles.filter((t) => t.angle === g).length}`).join(', ');
          console.log(
            `fold ${fold} level ${level}: p/q ${p}/${q}, width ${a.width.toFixed(4)}, height ${a.height.toFixed(4)}, aspect ${(a.width / a.height).toFixed(6)}, tiles ${a.tiles.length} (${counts})`,
          );
        }
      }
    }
});

const inside = (pt: Pt, r: Tile): number => {
  // +1 inside, 0 outside, NaN near an edge.
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const p = r.points[i]!;
    const q = r.points[(i + 1) % 4]!;
    const cr = ((q[0] - p[0]) * (pt[1] - p[1]) - (q[1] - p[1]) * (pt[0] - p[0])) / dist(p, q);
    if (Math.abs(cr) < 1e-6) return NaN;
    const s = Math.sign(cr);
    if (sign !== 0 && s !== sign) return 0;
    sign = s;
  }
  return 1;
};

test('quasiApproximant tiles the torus: edges shared twice, points covered once, area matches', () => {
  for (const fold of FOLDS)
    for (let level = 1; level <= LEVELS; level++)
      for (let seed = 1; seed <= 3; seed++) {
        const a = quasiApproximant(fold, seed, level);
        const msg = `fold ${fold} level ${level} seed ${seed}`;
        const m = new Map<string, number>();
        for (const t of a.tiles)
          for (let i = 0; i < 4; i++) {
            const k = torusEdgeKey(t.points[i]!, t.points[(i + 1) % 4]!, a.width, a.height);
            m.set(k, (m.get(k) ?? 0) + 1);
          }
        for (const n of m.values()) assert.equal(n, 2, msg);
        const area = a.tiles.reduce((s, t) => s + Math.sin((t.angle * Math.PI) / 180), 0);
        assert.ok(Math.abs(area - a.width * a.height) < 1e-6, msg);
        const copies: Tile[] = [];
        for (const ox of [-1, 0, 1])
          for (const oy of [-1, 0, 1])
            for (const t of a.tiles)
              copies.push({
                ...t,
                points: t.points.map(([x, y]): Pt => [x + ox * a.width, y + oy * a.height]) as unknown as Tile['points'],
              });
        // ponytail: only tiles whose first corner is within 2 of the point can contain it (rhomb diameter < 2).
        const rnd = mulberry32(fold * 100 + level * 10 + seed);
        let n = 0;
        while (n < 300) {
          const pt: Pt = [rnd() * a.width, rnd() * a.height];
          const hits = copies.filter((t) => dist(t.points[0], pt) < 2).map((t) => inside(pt, t));
          if (hits.some(Number.isNaN)) continue;
          assert.equal(
            hits.reduce((s, h) => s + h, 0),
            1,
            msg,
          );
          n++;
        }
      }
});

test('8-fold square to rhomb ratio approaches 1 / sqrt 2', () => {
  for (let level = 1; level <= LEVELS; level++) {
    const a = quasiApproximant(8, 1, level);
    const sq = a.tiles.filter((t) => t.angle === 90).length;
    const ratio = sq / (a.tiles.length - sq);
    console.log(`fold 8 level ${level}: squares/rhombs ${ratio.toFixed(4)} (${sq}/${a.tiles.length - sq})`);
    if (level >= 2) assert.ok(Math.abs(ratio - R2) < 0.1, `level ${level}: ${ratio}`);
  }
});

test('stars: every strap end is an edge midpoint shared by exactly the 2 tiles of that edge', () => {
  for (const fold of FOLDS)
    for (let level = 1; level <= 3; level++) {
      const a = quasiApproximant(fold, 2, level);
      const W = Math.round(a.width * 1e5);
      const H = Math.round(a.height * 1e5);
      const k = ([x, y]: Pt) => `${Math.round(mod(x, a.width) * 1e5) % W},${Math.round(mod(y, a.height) * 1e5) % H}`;
      const mids = new Set<string>();
      for (const t of a.tiles)
        for (let i = 0; i < 4; i++) {
          const p = t.points[i]!;
          const q = t.points[(i + 1) % 4]!;
          mids.add(k([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]));
        }
      const count = new Map<string, number>();
      for (const t of a.tiles) {
        const quad = midQuad(t);
        assert.equal(quad.length, 5);
        for (const pt of quad.slice(0, 4)) {
          assert.ok(mids.has(k(pt)), `fold ${fold} level ${level}`);
          count.set(k(pt), (count.get(k(pt)) ?? 0) + 1);
        }
      }
      assert.equal(count.size, mids.size);
      for (const n of count.values()) assert.equal(n, 2, `fold ${fold} level ${level}`);
    }
});

const T = 240;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
// Seam check copied from src/penrose.test.ts.
const assertSeamless = (polys: Pt[][], S: number, msg: string, SY = S) => {
  const cross = { x0: [] as number[], xS: [] as number[], y0: [] as number[], yS: [] as number[] };
  for (const poly of polys) {
    for (let i = 1; i < poly.length; i++) {
      const [ax, ay] = poly[i - 1]!;
      const [bx, by] = poly[i]!;
      for (const e of [0, S]) assert.ok(!(near(ax, e) && near(bx, e)), `${msg}: segment on x = ${e}`);
      for (const e of [0, SY]) assert.ok(!(near(ay, e) && near(by, e)), `${msg}: segment on y = ${e}`);
    }
    for (const [x, y] of poly) {
      if (near(x, 0)) cross.x0.push(y);
      if (near(x, S)) cross.xS.push(y);
      if (near(y, 0)) cross.y0.push(x);
      if (near(y, SY)) cross.yS.push(x);
    }
  }
  const same = (a: number[], b: number[], side: string) => {
    a.sort((p, q) => p - q);
    b.sort((p, q) => p - q);
    assert.equal(a.length, b.length, `${msg}: ${side} count`);
    a.forEach((v, i) => assert.ok(near(v, b[i]!), `${msg}: ${side} ${v} vs ${b[i]}`));
  };
  same(cross.x0, cross.xS, 'x');
  same(cross.y0, cross.yS, 'y');
};

test('quasiTile is seamless, deterministic, seeded and inside the tile', () => {
  for (const fold of FOLDS) {
    const TY = T / QUASI_ASPECT[fold];
    for (const decorate of ['edges', 'stars'] as const)
      for (let depth = 1; depth <= QUASI_MAX_DEPTH; depth++) {
        for (let seed = 1; seed <= 5; seed++) {
          const polys = quasiTile(fold, mulberry32(seed), depth, T, decorate);
          assertSeamless(polys, T, `${fold} ${decorate} depth ${depth} seed ${seed}`, TY);
          for (const poly of polys) for (const [x, y] of poly) assert.ok(x >= -1e-9 && x <= T + 1e-9 && y >= -1e-9 && y <= TY + 1e-9);
        }
        console.log(
          `fold ${fold} ${decorate} depth ${depth}: ${pathData(quasiTile(fold, mulberry32(1), depth, T, decorate), 1).length} path chars`,
        );
      }
  }
  for (const gen of [octaEdges, octaStars, dodecaEdges, dodecaStars]) {
    assert.deepEqual(gen(mulberry32(1), 2, T), gen(mulberry32(1), 2, T));
    assert.notDeepEqual(gen(mulberry32(1), 2, T), gen(mulberry32(2), 2, T));
  }
});

test('QUASI_ASPECT is the square cell at every level', () => {
  for (const fold of FOLDS) {
    assert.ok(Math.abs(QUASI_ASPECT[fold] - 1) < 1e-9, String(QUASI_ASPECT[fold]));
    for (let level = 1; level <= LEVELS; level++) {
      const a = quasiApproximant(fold, 1, level);
      assert.ok(Math.abs(a.width / a.height - QUASI_ASPECT[fold]) < 1e-9, `fold ${fold} level ${level}`);
    }
  }
});

test('quasiTile edges: one uniform scale, every whole edge has the same length', () => {
  for (const fold of FOLDS)
    for (let depth = 1; depth <= QUASI_MAX_DEPTH; depth++) {
      const polys = quasiTile(fold, mulberry32(3), depth, T, 'edges');
      const lens = polys.filter((p) => p.length === 2).map(([p, q]) => dist(p!, q!));
      const max = Math.max(...lens);
      const whole = lens.filter((l) => l > max - 1e-3);
      assert.ok(whole.length > lens.length / 2, `fold ${fold} depth ${depth}`);
      for (const l of whole) assert.ok(Math.abs(l - max) < 1e-6, `fold ${fold} depth ${depth}: ${l} vs ${max}`);
      assert.ok(Math.abs(max - T / quasiApproximant(fold, 1, depth).width) < 1e-6, `fold ${fold} depth ${depth}: edge ${max}`);
    }
});
