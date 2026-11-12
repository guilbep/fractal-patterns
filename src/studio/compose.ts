// The wallpaper studio composer: from a seed and a few choices, a complete botanical tile.
// Three scatter tiers (hero, support near the heroes, filler), packed by each motif's real
// bounds, leaning along a calm flow; optional stems behind the heroes; four color layers.
import { mulberry32 } from '../patterns/util.ts';
import type { Placement, Repeat, Studio, StudioLayer, StudioMotif } from './model.ts';
import { layerColors, studioBytes } from './model.ts';
import { makeMotif, motifBounds, type MotifFamily } from './motifs.ts';
import { scatter, type ScatterLayer } from './scatter.ts';

export interface ComposeOptions {
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  readonly repeat: Repeat;
  /** 0 to 1. */
  readonly density: number;
  /** The motif families that may appear (at least one). */
  readonly families: readonly MotifFamily[];
  readonly colors: {
    readonly background: string;
    readonly leaf: string;
    readonly bloom: string;
    readonly detail: string;
    readonly stem: string;
  };
  readonly stems: boolean;
}

/** Smallest circle around the bounds' center that holds the bounds, and its offset from the box center. */
export function motifRadius(m: StudioMotif): { radius: number; cx: number; cy: number } {
  const b = motifBounds(m.d);
  return {
    radius: Math.hypot(b.maxX - b.minX, b.maxY - b.minY) / 2,
    cx: (b.minX + b.maxX - m.box) / 2,
    cy: (b.minY + b.maxY - m.box) / 2,
  };
}

const TIERS = [
  { families: ['flower', 'frond', 'leaf'], diameter: 0.28, count: (d: number) => Math.round(2 + 4 * d) },
  { families: ['leaf', 'sprig', 'bud'], diameter: 0.16, count: (d: number) => Math.round(3 + 14 * d) },
  { families: ['berry', 'bud', 'sprig'], diameter: 0.08, count: (d: number) => Math.round(6 + 28 * d) },
] as const;
const VARIANTS = 2; // ponytail: 2 per tier keeps 2 x 2 x 2 + 2 filler + 2 stems = 12 motifs.
const BLOOMS: readonly MotifFamily[] = ['flower', 'bud', 'berry'];
// Two shared stem shapes, box 100, from the top center (the hero's base) down.
const STEMS = ['M50 0C52 30 30 42 36 68S50 94 48 100', 'M50 0C47 26 66 40 60 66S46 92 50 100'];

export interface ComposeParts {
  readonly studio: Studio;
  /** Hero placements, with motif indices into studio.motifs (the silhouettes). */
  readonly heroes: readonly Placement[];
  /** The family of each motif variant used, tier by tier. */
  readonly families: readonly MotifFamily[];
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

export function composeParts(o: ComposeOptions): ComposeParts {
  const allowed = o.families.length > 0 ? o.families : (['leaf'] as const);
  const side = Math.min(o.width, o.height);
  const density = clamp01(o.density);
  const rnd = mulberry32(o.seed ^ 0x2c1b3c6d);
  const motifs: StudioMotif[] = [];
  const families: MotifFamily[] = [];
  const variants: { sil: number; det: number; radius: ReturnType<typeof motifRadius>; bloom: boolean }[][] = [];
  const layers: ScatterLayer[] = TIERS.map((tier, ti) => {
    const pool = tier.families.filter((f) => allowed.includes(f));
    const fams = pool.length > 0 ? pool : [...allowed];
    const start = Math.floor(rnd() * fams.length);
    const list = Array.from({ length: VARIANTS }, (_, i) => {
      const fam = fams[(start + i) % fams.length]!;
      const m = makeMotif(fam, o.seed * 97 + ti * 13 + i);
      families.push(fam);
      motifs.push(m.silhouette);
      if (ti !== 2) motifs.push(m.detail);
      return { sil: motifs.indexOf(m.silhouette), det: motifs.length - 1, radius: motifRadius(m.silhouette), bloom: BLOOMS.includes(fam) };
    });
    variants.push(list);
    return {
      motifs: list.map((_, i) => i),
      radius: (tier.diameter * side) / 2,
      count: tier.count(density),
      scaleJitter: 0.15,
      rotate: ti === 2 ? 'free' : 'flow',
      calm: true,
      flip: true,
      ...(ti === 1 ? { near: { layer: 0, distance: tier.diameter * side + TIERS[0].diameter * side * 0.6 } } : {}),
    };
  });
  const placed = scatter(layers, { width: o.width, height: o.height, seed: o.seed, gap: 2 });

  const leaf: Placement[] = [];
  const bloom: Placement[] = [];
  const detail: Placement[] = [];
  const heroes: Placement[] = [];
  const stems: Placement[] = [];
  placed.forEach((ps, ti) => {
    for (const p of ps) {
      const v = variants[ti]![p.motif]!;
      // The scatter disc is the real circle: scale the motif to it, then move the anchor so the circle lands there.
      const scale = (layers[ti]!.radius * p.scale) / v.radius.radius;
      const t = (p.rotate * Math.PI) / 180;
      const [cos, sin] = [Math.cos(t), Math.sin(t)];
      const ox = v.radius.cx * scale * (p.flip ? -1 : 1);
      const oy = v.radius.cy * scale;
      const x = p.x - (ox * cos - oy * sin);
      const y = p.y - (ox * sin + oy * cos);
      const sil: Placement = { motif: v.sil, x, y, scale, rotate: p.rotate, flip: p.flip };
      (v.bloom ? bloom : leaf).push(sil);
      // ponytail: filler (about 24 px) reads as a silhouette; its detail would cost bytes, not looks.
      if (ti !== 2) detail.push({ ...sil, motif: v.det });
      if (ti !== 0) continue;
      heroes.push(sil);
      // Stem: from the hero's base (bottom center of its box) back along its direction, 1 to 2 hero lengths.
      const ss = (2 * layers[0]!.radius * p.scale * (1 + rnd())) / 100;
      const bx = x - 50 * scale * sin;
      const by = y + 50 * scale * cos;
      stems.push({ motif: STEMS.length, x: bx - 50 * ss * sin, y: by + 50 * ss * cos, scale: ss, rotate: p.rotate, flip: rnd() < 0.5 });
    }
  });
  // Stem motifs are appended last; renumber stem placements to their index.
  const stemBase = motifs.length;
  const out: StudioLayer[] = [];
  const add = (color: string, strokeWidth: number, placements: Placement[]) => {
    if (placements.length > 0) out.push({ color, opacity: 1, strokeWidth, placements });
  };
  if (o.stems) {
    motifs.push(...STEMS.map((d): StudioMotif => ({ d, box: 100, paint: 'stroke' })));
    add(
      o.colors.stem,
      Math.max(1.5, side / 150),
      stems.map((p, i) => ({ ...p, motif: stemBase + (i % STEMS.length) })),
    );
  }
  add(o.colors.leaf, 1, leaf);
  add(o.colors.bloom, 1, bloom);
  add(o.colors.detail, 1, detail);
  return {
    studio: { width: o.width, height: o.height, background: o.colors.background, repeat: o.repeat, motifs, layers: out },
    heroes,
    families,
  };
}

export function compose(o: ComposeOptions): Studio {
  return composeParts(o).studio;
}

/** Roles from a 5-color palette (paper, ink, stroke, accent, soft). */
export function composeColors(palette: readonly string[]): ComposeOptions['colors'] {
  const [paper = '#ffffff', ink = '#000000', stroke = '#808080', accent = '#808080'] = palette;
  return { background: paper, leaf: stroke, bloom: accent, detail: ink, stem: stroke };
}

export function composeSummary(s: Studio): { bytes: number; instances: number; motifs: number; plates: number } {
  const b = studioBytes(s);
  return { bytes: b.svg, instances: b.instances, motifs: s.motifs.length, plates: layerColors(s).length };
}
