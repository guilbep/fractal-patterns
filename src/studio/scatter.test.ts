import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { coverage, flowAngle, scatter, torusDistance, tracking, type Placement, type ScatterLayer } from './scatter.ts';

const W = 240;
const layer = (radius: number, count: number, rest: Partial<ScatterLayer> = {}): ScatterLayer => ({
  motifs: [0, 1, 2],
  radius,
  count,
  scaleJitter: 0.2,
  rotate: 'free',
  flip: true,
  ...rest,
});
const three = [layer(30, 5), layer(16, 12), layer(6, 30)];
const run = (seed: number, layers: readonly ScatterLayer[] = three) => scatter(layers, { width: W, height: W, seed, gap: 2 });
const one = (rest: Partial<ScatterLayer>, seed = 3): Placement[] => run(seed, [layer(10, 30, rest)])[0]!;

test('torusDistance wraps across the edge and is symmetric', () => {
  assert.equal(torusDistance([1, 1], [99, 1], 100, 100), 2);
  assert.equal(torusDistance([1, 1], [99, 1], 100, 100), torusDistance([99, 1], [1, 1], 100, 100));
  assert.ok(Math.abs(torusDistance([2, 97], [98, 3], 100, 100) - Math.hypot(4, 6)) < 1e-12);
});

test('flowAngle is periodic on the tile and not constant', () => {
  const vals: number[] = [];
  for (let i = 0; i < 20; i++) {
    const x = (i * 37.3) % W;
    const y = (i * 91.7) % 180;
    const a = flowAngle(x, y, W, 180, 5);
    assert.ok(Math.abs(a - flowAngle(x + W, y, W, 180, 5)) < 1e-9);
    assert.ok(Math.abs(a - flowAngle(x, y + 180, W, 180, 5)) < 1e-9);
    vals.push(a);
  }
  assert.ok(Math.max(...vals) - Math.min(...vals) > 10);
});

test('scatter: no overlap on the torus, inside the tile, first layer full, deterministic', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const p = run(seed);
    const all = p.flatMap((ps, li) => ps.map((q) => ({ ...q, r: three[li]!.radius * q.scale })));
    for (const q of all) assert.ok(q.x >= 0 && q.x < W && q.y >= 0 && q.y < W);
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i]!;
        const b = all[j]!;
        assert.ok(torusDistance([a.x, a.y], [b.x, b.y], W, W) >= a.r + b.r + 2 - 1e-9, `seed ${seed} pair ${i},${j}`);
      }
    }
    assert.equal(p[0]!.length, 5);
    assert.deepEqual(run(seed), p);
  }
  assert.notDeepEqual(run(1), run(2));
});

test('motifs are used about equally', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const ps = run(seed, [layer(10, 12)])[0]!;
    assert.equal(ps.length, 12);
    for (const m of [0, 1, 2]) {
      const n = ps.filter((q) => q.motif === m).length;
      assert.ok(n >= 3 && n <= 5, `seed ${seed} motif ${m}: ${n}`);
    }
  }
});

test('rotation rules', () => {
  for (const q of one({ rotate: 'upright' })) assert.ok(Math.abs(q.rotate) <= 15);
  for (const q of one({ rotate: 'quarter' })) assert.ok([0, 90, 180, 270].includes(q.rotate));
  const flow = one({ rotate: 'flow' }, 4);
  for (const q of flow) assert.ok(Math.abs(q.rotate - flowAngle(q.x, q.y, W, W, 4)) < 1e-9);
  const free = one({ rotate: 'free' }).map((q) => q.rotate);
  assert.equal(free.length, 30);
  assert.ok(Math.max(...free) - Math.min(...free) > 180);
});

test('flip', () => {
  const on = one({ flip: true }).map((q) => q.flip);
  assert.ok(on.includes(true) && on.includes(false));
  assert.ok(one({ flip: false }).every((q) => !q.flip));
});

// Measured for seeds 1..10: coverage 0.455..0.517, worst tracking ratio 2.043.
test('coverage and tracking for the three-layer case', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const p = run(seed);
    const c = coverage(p, three, W, W);
    assert.ok(c > 0.35 && c < 0.8, `seed ${seed} coverage ${c}`);
    const t = tracking(p, W, W);
    assert.ok(t.rows < 2.2 && t.columns < 2.2, `seed ${seed} tracking ${JSON.stringify(t)}`);
  }
});

test('an impossible request ends quickly with fewer placements and no overlap', () => {
  const layers = [layer(100, 20)];
  const t0 = performance.now();
  const ps = scatter(layers, { width: 100, height: 100, seed: 1, gap: 2 })[0]!;
  assert.ok(performance.now() - t0 < 200);
  assert.ok(ps.length < 20 && ps.length >= 1);
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i]!;
      const b = ps[j]!;
      assert.ok(torusDistance([a.x, a.y], [b.x, b.y], 100, 100) >= 100 * (a.scale + b.scale) + 2 - 1e-9);
    }
  }
});

test('defaults unchanged: fixed outputs taken before calm and near existed', () => {
  const L = (radius: number, count: number, rotate: ScatterLayer['rotate']): ScatterLayer => ({
    motifs: [0, 1],
    radius,
    count,
    scaleJitter: 0.2,
    rotate,
    flip: true,
  });
  const p = scatter([L(30, 5, 'flow'), L(12, 20, 'free')], { width: 240, height: 200, seed: 7, gap: 2 });
  const hash = createHash('sha256').update(JSON.stringify(p)).digest('hex').slice(0, 16);
  assert.equal(hash, 'cd917983b3c826d5');
  assert.equal(flowAngle(13, 77, 240, 200, 7), 248.8871137321395);
  assert.equal(flowAngle(13, 77, 240, 200, 7, false), 248.8871137321395);
});

test('calm flowAngle is periodic and turns less than the default field', () => {
  for (let seed = 1; seed <= 8; seed++) {
    const calm: number[] = [];
    for (let i = 0; i < 20; i++) {
      const x = (i * 37.3) % W;
      const y = (i * 91.7) % 180;
      const a = flowAngle(x, y, W, 180, seed, true);
      assert.ok(Math.abs(a - flowAngle(x + W, y, W, 180, seed, true)) < 1e-9);
      assert.ok(Math.abs(a - flowAngle(x, y + 180, W, 180, seed, true)) < 1e-9);
      calm.push(a);
    }
    assert.ok(Math.max(...calm) - Math.min(...calm) <= 72);
  }
});

test('near: every placement of the layer lies within the distance of a host placement', () => {
  for (let seed = 1; seed <= 8; seed++) {
    const p = run(seed, [layer(30, 5), layer(10, 15, { near: { layer: 0, distance: 50 } })]);
    for (const q of p[1]!) {
      const d = Math.min(...p[0]!.map((h) => torusDistance([q.x, q.y], [h.x, h.y], W, W)));
      assert.ok(d <= 50 + 10 * q.scale, `seed ${seed} ${d}`);
    }
    assert.ok(p[1]!.length > 0);
  }
});
