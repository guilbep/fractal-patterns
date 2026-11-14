import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';

// state.ts imports through the Vite alias '@/'; map it to src/ for node.
const src = new URL('./', import.meta.url).href;
registerHooks({ resolve: (s, c, next) => next(s.startsWith('@/') ? src + s.slice(2) : s, c) });
const {
  params,
  roles,
  svg,
  regions,
  regionsReady,
  interlace,
  interlaceReady,
  interlaceOffReason,
  weave,
  ribbonFill,
  checkedRoles,
  reset,
  REGION_LIMITS,
} = await import('./state.ts');
REGION_LIMITS.ms = Infinity;

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const at = (kind: string, seed: number, depth: number, on: boolean): string => {
  Object.assign(params, { kind, seed, depth });
  interlace.on = on;
  return svg.value;
};
// Plain lines are stroked paths without the ribbon group; ribbons are two paths per strand inside <g id="il">.
const ribbonPaths = (s: string) => [...s.matchAll(/<path d="[^"]*" stroke="(#[0-9a-f]{6})" stroke-width="([\d.]+)"\/>/g)];

test('off: the p4m tile is unchanged (pinned before Interlace)', () => {
  const s = at('p4m', 7, 8, false);
  assert.equal(s.length, 8479);
  assert.equal(sha(s), 'f719039a83e397a1');
});

test('on, stars 4.8.8 depth 2: ribbons with gaps replace the lines', async () => {
  const off = at('star-488', 1, 2, false);
  at('star-488', 1, 2, true);
  await interlaceReady();
  const s = at('star-488', 1, 2, true);
  const w = weave.value!;
  assert.ok(w.cs.length > 0 && w.odd.length === 0, `${w.cs.length} ${w.odd.length}`);
  assert.equal(s.slice(0, s.indexOf('>') + 1), off.slice(0, off.indexOf('>') + 1));
  assert.ok(s.includes('<g id="il"'));
  assert.equal((s.match(/<use href="#il"/g) ?? []).length, 8);
  const p = ribbonPaths(s);
  assert.equal(p.length, 2 * w.list.length);
  // Outline in the stroke colour, then the fill in the ribbon colour, narrower.
  assert.equal(p[0]![1], roles.pattern);
  assert.equal(p[1]![1], ribbonFill.value);
  assert.ok(Number(p[1]![2]!) < Number(p[0]![2]!));
  // The gaps: more subpaths (M) than strand pieces.
  const moves = (s.match(/M/g) ?? []).length;
  const pieces = w.list.reduce((a, st) => a + st.pieces.length, 0);
  assert.ok(moves > 2 * pieces, `${moves} ${pieces}`);
  // No plain stroked line is left: every path is a ribbon path.
  assert.equal((s.match(/<path/g) ?? []).length, p.length);
  // The ribbon fill is checked as a text surface.
  assert.ok(checkedRoles.value.regions!.length === 1);
});

test('star-hex: the hexagonal tile is squeezed for the strands and drawn at full height', async () => {
  const off = at('star-hex', 1, 2, false);
  at('star-hex', 1, 2, true);
  await interlaceReady();
  const s = at('star-hex', 1, 2, true);
  const w = weave.value!;
  assert.ok(w.cs.length > 0, String(w.cs.length));
  assert.equal(s.slice(0, s.indexOf('>') + 1), off.slice(0, off.indexOf('>') + 1));
  const h = Math.round(params.size * Math.sqrt(3) * 1000) / 1000;
  assert.ok(s.includes(`translate(0 ${h})`));
  // The strands are stretched back: points reach the full height, and each crossing's arc length lands on its point.
  const ys = w.list.flatMap((st) => st.pieces.flatMap((p) => p.map((q) => q[1])));
  assert.ok(Math.max(...ys) > params.size * 1.5);
  for (const c of w.cs.slice(0, 20)) {
    const st = w.list[c.a.strand]!;
    let left = c.a.s;
    let found: readonly [number, number] | null = null;
    for (const p of st.pieces)
      for (let i = 1; i < p.length && !found; i++) {
        const len = Math.hypot(p[i]![0] - p[i - 1]![0], p[i]![1] - p[i - 1]![1]);
        if (left <= len + 1e-6) {
          const t = left / len;
          found = [p[i - 1]![0] + t * (p[i]![0] - p[i - 1]![0]), p[i - 1]![1] + t * (p[i]![1] - p[i - 1]![1])];
        } else left -= len;
      }
    assert.ok(found && Math.hypot(found[0] - c.p[0], found[1] - c.p[1] / (1 / Math.sqrt(3))) < 1e-6, JSON.stringify([found, c.p]));
  }
});

test('Truchet: the lines only touch, so the tile keeps its lines', async () => {
  const off = at('truchet', 1, 4, false);
  at('truchet', 1, 4, true);
  await interlaceReady();
  assert.equal(at('truchet', 1, 4, true), off);
  assert.equal(weave.value!.cs.length, 0);
  assert.equal(interlaceOffReason.value, '');
});

test("Penrose arcs: off, with the region colours' reason (InterlaceControl.vue says it for interlace)", () => {
  assert.equal(at('penrosearcs', 1, 2, true), at('penrosearcs', 1, 2, false));
  assert.equal(interlaceOffReason.value, 'Region colors do not follow the arcs; choose Penrose rhombs to use them.');
});

test('regions and interlace together: the regions under the ribbons', async () => {
  regions.mode = 'neighbours';
  at('star-488', 1, 2, true);
  await Promise.all([regionsReady(), interlaceReady()]);
  const s = at('star-488', 1, 2, true);
  const r = s.indexOf('fill-rule="nonzero"');
  assert.ok(r > 0 && r < s.indexOf('<g id="il"'));
  regions.mode = 'off';
});

test('reset turns it off', () => {
  Object.assign(interlace, { on: true, width: 9, gap: 3 });
  reset();
  assert.deepEqual({ ...interlace }, { on: false, width: 6, gap: 1.5 });
});
