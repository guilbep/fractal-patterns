// Example designs for the builder: wallpaper-like patterns made from the stamp library.
// Pure and deterministic. A lattice divides the tile evenly, so items on an edge wrap with no seam.
import { gridFill } from './fill.ts';
import { BASIC_STAMPS, studioStamps } from './stamps.ts';
import type { Design, Item, Stamp } from './types.ts';

const basic = (name: string): Stamp => BASIC_STAMPS.find((s) => s.name === name)!;
const mod = (a: number, m: number): number => ((a % m) + m) % m;

type Spec = { stamp: number; x: number; y: number; scale: number; rotate?: number; flip?: boolean; colors: string[] };

function design(base: Omit<Design, 'items'>, specs: readonly Spec[]): Design {
  const items: Item[] = specs.map((s, k) => ({
    id: k + 1,
    stamp: s.stamp,
    x: mod(s.x, base.width),
    y: mod(s.y, base.height),
    scale: s.scale,
    rotate: mod(s.rotate ?? 0, 360),
    flip: s.flip ?? false,
    opacity: 1,
    colors: s.colors,
  }));
  return { ...base, items };
}

function beads(): Design {
  const sand = ['#cdb49a'];
  const specs: Spec[] = [];
  // Tile 80 x 120: a bead column at x 20, a dash column at x 60, three steps of 40.
  for (let r = 0; r < 3; r++) {
    const y = r * 40;
    specs.push({ stamp: 1, x: 20, y: y + 10, scale: 0.18, colors: sand });
    specs.push({ stamp: 0, x: 20, y: y + 28, scale: 0.26, colors: sand });
    specs.push({ stamp: 1, x: 60, y: y + 30, scale: 0.18, colors: sand });
  }
  return design(
    { width: 80, height: 120, background: '#2e2e2e', repeat: 'straight', strokeWidth: 2.5, stamps: [basic('Dot'), basic('Dash')] },
    specs,
  );
}

function drops(): Design {
  const specs: Spec[] = [];
  // Tile 160 x 160, two rows of two big drops, the second row offset by half a step (brick).
  for (let r = 0; r < 2; r++) {
    const y = 40 + r * 80;
    for (let c = 0; c < 2; c++) {
      const x = c * 80 + (r === 0 ? 40 : 0);
      specs.push({ stamp: 0, x, y, scale: 0.75, rotate: r === 0 ? 35 : -35, colors: ['#d76a6a'] });
      specs.push({ stamp: 0, x: x + 40, y, scale: 0.3, colors: ['#3d4a54'] });
    }
  }
  return design({ width: 160, height: 160, background: '#f8f6f3', repeat: 'straight', strokeWidth: 3, stamps: [basic('Drop')] }, specs);
}

function squiggles(): Design {
  const specs: Spec[] = [];
  // Tile 160 x 80. The wave stamp is 80 units wide in its box: scale 0.5 gives 40, so waves 40 apart touch.
  for (let c = 0; c < 4; c++) specs.push({ stamp: 1, x: 20 + c * 40, y: 20, scale: 0.3, colors: ['#6bb8e0'] });
  for (let c = 0; c < 4; c++) specs.push({ stamp: 0, x: 20 + c * 40, y: 60, scale: 0.5, colors: ['#e8608a'] });
  return design(
    { width: 160, height: 80, background: '#fde4ea', repeat: 'straight', strokeWidth: 3, stamps: [basic('Wave'), basic('Zigzag')] },
    specs,
  );
}

const SAGE = '#8fa58a';
const LIGHT = '#f4f6f2';
const INNER = { d: 'M36 55V41C36 33 46 31 50 23C54 31 64 33 64 41V55z', paint: 'fill', color: '#b9c8b4' } as const;
// The upper part of the Petal arch, down to box y 55 where its straight sides begin.
const CAP = 'M15 55C15 35 40 30 50 10C60 30 85 35 85 55';

function scales(): Design {
  const arch = basic('Petal arch').parts[0]!.d;
  const scale: Stamp = {
    name: 'Scale',
    box: 100,
    parts: [{ d: arch, paint: 'fill', color: SAGE }, { d: arch, paint: 'stroke', color: LIGHT }, INNER],
  };
  const cap: Stamp = {
    name: 'Scale cap',
    box: 100,
    parts: [{ d: `${CAP}z`, paint: 'fill', color: SAGE }, { d: CAP, paint: 'stroke', color: LIGHT }, INNER],
  };
  const specs: Spec[] = [];
  // Tile 120 x 104: arches 77 wide and 88 high (scale 1.1) on a 60 step, rows 52 apart, every other row shifted half an arch.
  // Each row covers the lower corners of the row above. Row 0 sits on the top edge; it is the only row that crosses it.
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) specs.push({ stamp: 0, x: c * 60 + r * 30, y: r * 52, scale: 1.1, colors: [] });
  // The model has no cyclic drawing order: the wrapped copy of row 0 at the bottom edge is drawn with row 0, first,
  // so the last row would cover its tip. Row 0 comes again at the end as its cap only (flip: true, the arch is symmetric):
  // the cap's copy at the bottom edge goes on top of the last row, and its copy at the top edge falls outside the tile.
  for (let c = 0; c < 2; c++) specs.push({ stamp: 1, x: c * 60, y: 0, scale: 1.1, flip: true, colors: [] });
  return design({ width: 120, height: 104, background: '#dfe5df', repeat: 'straight', strokeWidth: 2.5, stamps: [scale, cap] }, specs);
}

const LEAF_STAMPS = ['Leaf', 'Frond', 'Sprig'];
const LEAF_FILLS = ['#bfe3d0', '#9aa5a1', '#ffffff'];
const LEAF_SIZES = [0.6, 0.8, 1];

function leaves(): Design {
  const studio = studioStamps(7);
  const stamps = LEAF_STAMPS.map((n) => studio.find((s) => s.name === n)!);
  const base = { width: 300, height: 300, background: '#cfd4d2', repeat: 'brick' as const, strokeWidth: 1, stamps };
  const items = gridFill({
    width: base.width,
    height: base.height,
    columns: 4,
    rows: 4,
    stamps: stamps.map((s, index) => ({ index, box: s.box, parts: s.parts.length })),
    seed: 11,
    size: 1.4,
    sizeJitter: 0,
    jitter: 0.6,
    rotate: 'free',
    stagger: true,
    flip: true,
    colors: [],
    firstId: 1,
  }).map((it, k) => ({
    ...it,
    // Three sizes, and a mint, grey or white body with a dark line detail.
    scale: it.scale * LEAF_SIZES[k % 3]!,
    colors: [LEAF_FILLS[(k * 2 + Math.floor(k / 5)) % 3]!, '#2b2b2b'],
  }));
  return { ...base, items };
}

export const EXAMPLES: readonly { readonly id: string; readonly label: string; readonly make: () => Design }[] = [
  { id: 'beads', label: 'Beads and dashes', make: beads },
  { id: 'drops', label: 'Drops', make: drops },
  { id: 'squiggles', label: 'Squiggles', make: squiggles },
  { id: 'scales', label: 'Scales', make: scales },
  { id: 'leaves', label: 'Falling leaves', make: leaves },
];
