// A design as a short URL query string, and back. The query is untrusted input: decodeDesign never throws
// and every field falls back to its default or is clamped to its range.
import { FAMILIES, KINDS, MAX_DEPTH, type Kind } from './fractal.ts';
import { LAYER2_DEFAULTS, type Layer2Settings } from './layers.ts';
import { MOTION_NONE, type Motion } from './motion.ts';
import { canVary, shiftsFor } from './supertile.ts';
import { accentDefaults, decodeAccentLayer, encodeAccentLayer, type AccentLayer } from './accent-layer.ts';
import { ACCENT_VARY_DEFAULTS, type AccentVary } from './accent-vary.ts';
import { decodeMoves, encodeMoves } from './accent-moves.ts';
import { VARIANT_DEFAULTS, type VariantOptions } from './variants.ts';
import type { FillStyle } from './fills.ts';
import { CHANGE_MAX, CHANGE_MIN, type ChangeDir } from './fade.ts';
import { GRAIN_AMOUNT, GRAIN_DEFAULTS, GRAIN_SIZE, type Grain } from './grain.ts';
import { COLOR_SYM_DEFAULTS, DETAIL_MAX, DETAIL_MIN, ORDERS, WAVES_MAX, WAVES_MIN } from './color-sym.ts';

export type ColorSym = typeof COLOR_SYM_DEFAULTS;

export interface Design extends Motion {
  readonly kind: Kind;
  readonly seed: number;
  readonly depth: number;
  readonly size: number;
  readonly strokeWidth: number;
  readonly precision: number;
  readonly background: string;
  readonly pattern: string;
  readonly text: string;
  readonly opacity: number;
  readonly plateMode: 'plate' | 'split' | 'direct';
  readonly plateOpacity: number;
  readonly plateRadius: number;
  readonly plateBlur: number;
  readonly zoom: number;
  readonly gap: number;
  readonly mirror: boolean;
  readonly layout: 'single' | 'patchwork';
  readonly cells: number;
  readonly frame: boolean;
  readonly families: number; // bit mask over FAMILIES in order, bit 0 = the first family
  readonly variants: boolean; // Reduce repetition: a 4 by 4 super tile
  readonly layer2: boolean; // a second copy of the tile at a coprime size
  readonly fade: boolean; // a soft mask over the pattern
  readonly layer2Settings: Layer2Settings; // offset, turn, size, strength, and depth of the second layer
  readonly parallax: boolean; // the two layers move at different speeds on scroll
  readonly variantOptions: VariantOptions; // strength and per-cell options of Reduce repetition
  readonly sections: boolean; // export-only helper classes that turn the pattern per section
  readonly fill: FillStyle; // closed shapes filled with a second color
  readonly layer2Color: string | null; // the second layer's own color; null = the pattern color
  readonly change: { readonly dir: ChangeDir; readonly to: number }; // Slow change across the page
  readonly accent: string; // the color of the accent shapes
  readonly accentLayer: AccentLayer; // simple shapes over any kind (accent-layer.ts); the default depends on the kind
  readonly accentVary: AccentVary & { readonly applies: VaryApplies }; // what Reduce repetition varies, and the accent's variation
  readonly accentMoves: string; // accent shapes moved by hand, the encoded `am` value (accent-moves.ts); '' when none
  readonly grain: Grain; // a fine noise behind the pattern (grain.ts)
  // Color symmetry (color-sym.ts). Optional and set only when on, so designs from before it compare and decode unchanged.
  readonly colorSym?: ColorSym;
}

// Which layer Reduce repetition varies. A kind whose base cannot vary (supertile.ts) varies its accent by default.
export type VaryApplies = 'base' | 'accent' | 'both';
export const appliesDefault = (kind: Kind): VaryApplies => (canVary(kind) ? 'base' : 'accent');
// Not in the URL: pinned patchwork cells (a per-session tweak), the palette name (the roles carry the colors),
// and the image source (the pixels never leave the browser).

const ALL_FAMILIES = (1 << FAMILIES.length) - 1;

// A warm orange, the berry color of the phase 6 board. Also the state's fallback when a palette has no accent.
export const ACCENT_DEFAULT = '#e07a3f';

export const DESIGN_DEFAULTS: Design = {
  kind: 'tree',
  seed: 1,
  depth: 8,
  size: 120,
  strokeWidth: 2,
  precision: 1,
  background: '#ffffff',
  pattern: '#336699',
  text: '#111111',
  opacity: 0.6,
  plateMode: 'split',
  plateOpacity: 0.85,
  plateRadius: 12,
  plateBlur: 0,
  ...MOTION_NONE,
  zoom: 1,
  gap: 0,
  mirror: false,
  layout: 'single',
  cells: 3,
  frame: false,
  families: ALL_FAMILIES,
  variants: false,
  layer2: false,
  fade: false,
  layer2Settings: LAYER2_DEFAULTS,
  parallax: false,
  variantOptions: VARIANT_DEFAULTS,
  sections: false,
  fill: { mode: 'none', color: '#c3eaec', opacity: 1 },
  layer2Color: null,
  change: { dir: 'none', to: 0.4 },
  accent: ACCENT_DEFAULT,
  accentLayer: accentDefaults('tree'),
  accentVary: { applies: 'base', ...ACCENT_VARY_DEFAULTS },
  accentMoves: '',
  grain: GRAIN_DEFAULTS,
};

// Field to short key. The insertion order is the order of the encoded string.
const KEYS: Readonly<Record<keyof Design, string>> = {
  kind: 'k',
  seed: 's',
  depth: 'd',
  size: 'z',
  strokeWidth: 'w',
  precision: 'p',
  background: 'bg',
  pattern: 'fg',
  text: 'tx',
  opacity: 'o',
  plateMode: 'pm',
  plateOpacity: 'po',
  plateRadius: 'pr',
  plateBlur: 'pb',
  rotate: 'r',
  scale: 'sc',
  skew: 'sk',
  tilt: 't',
  drift: 'dr',
  speed: 'sp',
  zoom: 'zm',
  gap: 'g',
  mirror: 'm',
  layout: 'l',
  cells: 'c',
  frame: 'f',
  families: 'fa',
  variants: 'v',
  layer2: 'l2',
  fade: 'fd',
  layer2Settings: 'l2s',
  parallax: 'px',
  variantOptions: 'vo',
  sections: 'sx',
  fill: 'fi',
  layer2Color: 'l2c',
  change: 'ch',
  // Written whenever it differs from the default; the page keeps it at the default for a kind without accent
  // shapes (snapshot in state-share.ts), so a palette pick does not lengthen those links.
  accent: 'ac',
  accentLayer: 'al', // encodeAccentLayer: written only when it differs from the kind's defaults (off in patchwork)
  accentVary: 'av',
  accentMoves: 'am',
  grain: 'gr',
  colorSym: 'cs', // also cw cd cb cm co (encodeColorSym); keep new keys last: older links stay valid
};
const FIELDS = Object.keys(KEYS) as (keyof Design)[];

// The second-layer settings in one value, x_y_rotate_scale_opacity_depth ('_' needs no escaping in a URL);
// empty when all are default.
const L2_ORDER = ['x', 'y', 'rotate', 'scale', 'opacity', 'depth'] as const;
const L2_RANGES: Readonly<Record<keyof Layer2Settings, readonly [number, number]>> = {
  x: [0, 100],
  y: [0, 100],
  rotate: [-180, 180],
  scale: [0.5, 3],
  opacity: [0.1, 1],
  depth: [0.25, 4],
};
const encodeL2 = (l: Layer2Settings): string =>
  L2_ORDER.every((k) => l[k] === LAYER2_DEFAULTS[k]) ? '' : L2_ORDER.map((k) => String(l[k])).join('_');
// Six finite numbers, each clamped to its range; anything else gives the defaults.
function decodeL2(s: string): Layer2Settings {
  const parts = s.split('_');
  const nums = parts.map((p) => (p.trim() === '' ? NaN : Number(p)));
  if (nums.length !== L2_ORDER.length || !nums.every(Number.isFinite)) return LAYER2_DEFAULTS;
  const out = {} as Record<keyof Layer2Settings, number>;
  L2_ORDER.forEach((k, i) => {
    const [lo, hi] = L2_RANGES[k];
    out[k] = Math.min(hi, Math.max(lo, nums[i] ?? 0)) + 0;
  });
  return out;
}

// The variant options in one value, cells_count_orient_drop_depths_jitter_weights_skip (drop as n, h, or b),
// then _shift (3 or 4) only when it is not 2, so old links decode unchanged; empty when all are default.
const DROPS = { none: 'n', 'half-drop': 'h', brick: 'b' } as const;
const PAIRS = ['2_2', '4_4', '6_4', '6_6'];
const encodeVO = (v: VariantOptions): string =>
  (Object.keys(VARIANT_DEFAULTS) as (keyof VariantOptions)[]).every((k) => v[k] === VARIANT_DEFAULTS[k])
    ? ''
    : [
        v.cells,
        v.count,
        v.orient ? 1 : 0,
        DROPS[v.drop],
        v.depths ? 1 : 0,
        v.jitter,
        v.weights,
        v.skip,
        ...(v.shift === 2 ? [] : [v.shift]),
      ].join('_');
// Eight parts (nine with a shift that the grid allows), a supported (cells, count) pair, and finite numbers clamped to their range; anything else gives the defaults.
function decodeVO(s: string): VariantOptions {
  const [c = '', n = '', o, dr, de, ...rest] = s.split('_');
  const nums = rest.map((p) => (p.trim() === '' ? NaN : Number(p)));
  const shift = nums.length === 4 ? nums.pop()! : 2;
  const drop = (Object.keys(DROPS) as (keyof typeof DROPS)[]).find((k) => DROPS[k] === dr);
  const bits = [o, de].map((b) => (b === '1' ? true : b === '0' ? false : undefined));
  if (
    !PAIRS.includes(`${c}_${n}`) ||
    drop === undefined ||
    bits.includes(undefined) ||
    nums.length !== 3 ||
    !nums.every(Number.isFinite) ||
    !(shiftsFor(Number(c)) as number[]).includes(shift)
  )
    return VARIANT_DEFAULTS;
  const clamp = (x: number, hi: number) => Math.min(hi, Math.max(0, x)) + 0;
  return {
    cells: Number(c) as 2 | 4 | 6,
    count: Number(n) as 2 | 4 | 6,
    orient: bits[0] === true,
    drop,
    depths: bits[1] === true,
    jitter: clamp(nums[0]!, 1),
    weights: clamp(nums[1]!, 1),
    skip: clamp(nums[2]!, 0.5),
    shift: shift as 2 | 3 | 4,
  };
}

// The fill in one value, mode_color_opacity (mode as n, c, or a; color without '#'); empty when off.
const FILL_MODES = { none: 'n', closed: 'c', alternate: 'a' } as const;
const encodeFill = (f: FillStyle): string =>
  f.mode === 'none' ? '' : [FILL_MODES[f.mode], f.color.replace(/^#/, ''), f.opacity].join('_');
// Three parts, a known mode, 6 hex digits, a finite opacity clamped to 0..1; anything else gives the default.
function decodeFill(s: string): FillStyle {
  const [m, c = '', o = ''] = s.split('_');
  const mode = (Object.keys(FILL_MODES) as (keyof typeof FILL_MODES)[]).find((k) => FILL_MODES[k] === m);
  const n = Number(o);
  if (s.split('_').length !== 3 || !mode || !/^[0-9a-f]{6}$/i.test(c) || o.trim() === '' || !Number.isFinite(n))
    return DESIGN_DEFAULTS.fill;
  return { mode, color: `#${c.toLowerCase()}`, opacity: Math.min(1, Math.max(0, n)) + 0 };
}

// Slow change in one value, dir_to (dir as d, u, or a); empty when none.
const CHANGE_CODES = { down: 'd', up: 'u', across: 'a' } as const;
const encodeChange = (c: Design['change']): string => (c.dir === 'none' ? '' : `${CHANGE_CODES[c.dir]}_${c.to}`);
function decodeChange(s: string): Design['change'] {
  const [m, t = ''] = s.split('_');
  const dir = (Object.keys(CHANGE_CODES) as (keyof typeof CHANGE_CODES)[]).find((k) => CHANGE_CODES[k] === m);
  const n = Number(t);
  if (s.split('_').length !== 2 || !dir || t.trim() === '' || !Number.isFinite(n)) return DESIGN_DEFAULTS.change;
  return { dir, to: Math.min(CHANGE_MAX, Math.max(CHANGE_MIN, n)) };
}

// The accent variation in one value, applies_cells_move_scale_drop_turn (applies as b, a, or ab), e.g. a_6_35_50_28_0.
// The switch stays `v`, but an old link with v=1 and no av varied only the base: so av is written whenever the
// variation reaches the accent while on, or when anything differs from the kind's defaults; a link whose av reaches
// the accent turns Reduce repetition on unless it says v=0, which is written for that case.
const APPLIES = { base: 'b', accent: 'a', both: 'ab' } as const;
const AV_ORDER = ['cells', 'move', 'scale', 'drop', 'turn'] as const;
const AV_RANGES: Readonly<Record<keyof AccentVary, readonly [number, number]>> = {
  cells: [2, 8],
  move: [0, 100],
  scale: [0, 100],
  drop: [0, 60],
  turn: [0, 100],
};
function encodeAV(d: Design): string {
  const v = d.accentVary;
  const keep =
    (d.variants && v.applies !== 'base') || v.applies !== appliesDefault(d.kind) || AV_ORDER.some((k) => v[k] !== ACCENT_VARY_DEFAULTS[k]);
  return keep ? [APPLIES[v.applies], ...AV_ORDER.map((k) => v[k])].join('_') : '';
}
// Six parts, a known applies code and finite numbers clamped to their range (cells whole); anything else gives null.
function decodeAV(s: string): Design['accentVary'] | null {
  const [a, ...rest] = s.split('_');
  const applies = (Object.keys(APPLIES) as VaryApplies[]).find((k) => APPLIES[k] === a);
  const nums = rest.map((p) => (p.trim() === '' ? NaN : Number(p)));
  if (!applies || nums.length !== AV_ORDER.length || !nums.every(Number.isFinite)) return null;
  const out = { applies } as { -readonly [K in keyof Design['accentVary']]: Design['accentVary'][K] };
  AV_ORDER.forEach((k, i) => {
    const [lo, hi] = AV_RANGES[k];
    const c = Math.min(hi, Math.max(lo, nums[i]!));
    out[k] = (k === 'cells' ? Math.round(c) : c) + 0;
  });
  return out;
}
// The grain in one value, amount_size_tone (tone as d or l), e.g. 12_0.75_d; empty when off.
const encodeGrain = (g: Grain): string => (g.on ? `${g.amount}_${g.size}_${g.tone === 'dark' ? 'd' : 'l'}` : '');
// Three parts, finite numbers clamped to their range, and a known tone; anything else gives the default (off).
function decodeGrain(s: string): Grain {
  const parts = s.split('_');
  const [a = NaN, z = NaN] = parts.slice(0, 2).map((p) => (p.trim() === '' ? NaN : Number(p)));
  const tone = parts[2] === 'd' ? 'dark' : parts[2] === 'l' ? 'light' : null;
  if (parts.length !== 3 || !tone || !Number.isFinite(a) || !Number.isFinite(z)) return GRAIN_DEFAULTS;
  const clamp = (x: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, x)) + 0;
  return { on: true, amount: clamp(a, GRAIN_AMOUNT), size: clamp(z, GRAIN_SIZE), tone };
}
// Color symmetry as its own keys: cs=1, then each setting only when it differs from its default; nothing when off.
// Booleans and the render are written as 1/0 and w/b; numbers are clamped to their range on the way in.
const CS: readonly [string, 'waves' | 'detail' | 'order', number, number][] = [
  ['cw', 'waves', WAVES_MIN, WAVES_MAX],
  ['cd', 'detail', DETAIL_MIN, DETAIL_MAX],
  ['co', 'order', 0, ORDERS - 1],
];
function encodeColorSym(c: ColorSym | undefined): [string, string][] {
  if (!c?.on) return [];
  const D = COLOR_SYM_DEFAULTS;
  const out: [string, string, boolean][] = [
    ['cs', '1', true],
    ['cw', String(c.waves), c.waves !== D.waves],
    ['cd', String(c.detail), c.detail !== D.detail],
    ['cb', c.balance ? '1' : '0', c.balance !== D.balance],
    ['cm', c.render === 'wheel' ? 'w' : 'b', c.render !== D.render],
    ['co', String(c.order), c.order !== D.order],
  ];
  return out.filter((e) => e[2]).map(([k, v]) => [k, v]);
}
// Off (undefined) unless cs=1; each setting is clamped to its range or falls back to its default.
function decodeColorSym(q: URLSearchParams): ColorSym | undefined {
  if (q.get('cs') !== '1') return undefined;
  const c: ColorSym = { ...COLOR_SYM_DEFAULTS, on: true, render: q.get('cm') === 'w' ? 'wheel' : 'bands' };
  for (const [k, f, lo, hi] of CS) {
    const s = q.get(k)?.trim();
    if (s && Number.isFinite(+s)) c[f] = Math.round(Math.min(hi, Math.max(lo, +s))) + 0;
  }
  const cb = q.get('cb');
  if (cb === '0' || cb === '1') c.balance = cb === '1';
  return c;
}
const sameFields = <T extends object>(a: T, b: T): boolean => (Object.keys(a) as (keyof T)[]).every((k) => a[k] === b[k]);

export function encodeDesign(d: Design): string {
  const pairs: [string, string][] = [];
  for (const f of FIELDS) {
    if (f === 'layer2Settings') {
      const l2 = encodeL2(d.layer2Settings);
      if (l2) pairs.push([KEYS[f], l2]);
      continue;
    }
    if (f === 'change') {
      const ch = encodeChange(d.change);
      if (ch) pairs.push([KEYS[f], ch]);
      continue;
    }
    if (f === 'grain') {
      const gr = encodeGrain(d.grain);
      if (gr) pairs.push([KEYS[f], gr]);
      continue;
    }
    if (f === 'colorSym') {
      pairs.push(...encodeColorSym(d.colorSym));
      continue;
    }
    if (f === 'fill') {
      const fi = encodeFill(d.fill);
      if (fi) pairs.push([KEYS[f], fi]);
      continue;
    }
    if (f === 'variants') {
      if (d.variants) pairs.push([KEYS[f], '1']);
      else if (d.accentVary.applies !== 'base' && encodeAV(d)) pairs.push([KEYS[f], '0']);
      continue;
    }
    if (f === 'accentLayer') {
      const al = encodeAccentLayer(d.kind, d.accentLayer, d.layout === 'patchwork');
      if (al) pairs.push([KEYS[f], al]);
      continue;
    }
    if (f === 'accentVary') {
      const av = encodeAV(d);
      if (av) pairs.push([KEYS[f], av]);
      continue;
    }
    if (f === 'variantOptions') {
      const vo = encodeVO(d.variantOptions);
      if (vo) pairs.push([KEYS[f], vo]);
      continue;
    }
    const v = d[f];
    if (v === DESIGN_DEFAULTS[f] || v === null) continue;
    pairs.push([KEYS[f], typeof v === 'boolean' ? (v ? '1' : '0') : typeof v === 'number' ? String(v) : v.replace(/^#/, '')]);
  }
  return new URLSearchParams(pairs).toString();
}

type NumField = { [F in keyof Design]-?: Design[F] extends number ? F : never }[keyof Design];

export function decodeDesign(query: string): Design {
  // get() returns the first value of a repeated key, so the first one wins.
  const q = new URLSearchParams(query.replace(/^[?#]/, ''));
  const D = DESIGN_DEFAULTS;
  const get = (f: keyof Design) => q.get(KEYS[f]) ?? '';
  const num = (f: NumField, lo: number, hi: number, int = false): number => {
    const s = get(f);
    const n = Number(s);
    if (s.trim() === '' || !Number.isFinite(n)) return D[f];
    const c = Math.min(hi, Math.max(lo, n));
    return (int ? Math.round(c) : c) + 0; // + 0 turns -0 into 0
  };
  const color = (f: 'background' | 'pattern' | 'text' | 'accent'): string => {
    const s = get(f);
    return /^[0-9a-f]{6}$/i.test(s) ? `#${s.toLowerCase()}` : D[f];
  };
  const oneOf = <T extends string>(f: keyof Design, values: readonly T[], fallback: T): T => values.find((v) => v === get(f)) ?? fallback;
  const kind = oneOf('kind', KINDS, D.kind);
  const layout = oneOf('layout', ['single', 'patchwork'], D.layout);
  const av = decodeAV(get('accentVary'));
  const colorSym = decodeColorSym(q);
  const bool = (f: 'mirror' | 'frame' | 'variants' | 'layer2' | 'fade' | 'parallax' | 'sections'): boolean =>
    get(f) === '1' ? true : get(f) === '0' ? false : D[f];
  return {
    kind,
    seed: num('seed', 0, 0xffffffff, true),
    depth: Math.min(num('depth', 1, MAX_DEPTH[kind], true), MAX_DEPTH[kind]), // the default 8 is too deep for some kinds
    size: num('size', 40, 320),
    strokeWidth: num('strokeWidth', 0.5, 6),
    precision: num('precision', 0, 3, true),
    background: color('background'),
    pattern: color('pattern'),
    text: color('text'),
    opacity: num('opacity', 0, 1),
    plateMode: oneOf('plateMode', ['plate', 'split', 'direct'], D.plateMode),
    plateOpacity: num('plateOpacity', 0, 1),
    plateRadius: num('plateRadius', 0, 32),
    plateBlur: num('plateBlur', 0, 12),
    rotate: num('rotate', -180, 180),
    scale: num('scale', 0.5, 3),
    skew: num('skew', -45, 45),
    tilt: num('tilt', 0, 60),
    drift: oneOf('drift', ['none', 'x', 'y', 'xy'], D.drift),
    speed: num('speed', 2, 30),
    zoom: num('zoom', 0.25, 4),
    gap: num('gap', 0, 120),
    mirror: bool('mirror'),
    layout,
    cells: num('cells', 2, 4, true),
    frame: bool('frame'),
    families: num('families', 0, ALL_FAMILIES, true) || ALL_FAMILIES, // no family at all is not a design
    variants: get('variants') === '1' || (get('variants') !== '0' && av !== null && av.applies !== 'base'),
    layer2: bool('layer2'),
    fade: bool('fade'),
    layer2Settings: decodeL2(get('layer2Settings')),
    parallax: bool('parallax'),
    variantOptions: decodeVO(get('variantOptions')),
    sections: bool('sections'),
    fill: decodeFill(get('fill')),
    layer2Color: /^[0-9a-f]{6}$/i.test(get('layer2Color')) ? `#${get('layer2Color').toLowerCase()}` : null,
    change: decodeChange(get('change')),
    accent: color('accent'),
    // In patchwork the kind is not drawn: the defaults are off (accentDefaults). No rectangular kind has its own accent.
    accentLayer: decodeAccentLayer(kind, get('accentLayer') || null, layout === 'patchwork'),
    accentVary: av ?? { applies: get('variants') === '1' ? 'base' : appliesDefault(kind), ...ACCENT_VARY_DEFAULTS },
    accentMoves: encodeMoves(decodeMoves(get('accentMoves'))),
    grain: decodeGrain(get('grain')),
    ...(colorSym ? { colorSym } : {}),
  };
}

export function sameDesign(a: Design, b: Design): boolean {
  return FIELDS.every((f) =>
    f === 'layer2Settings'
      ? encodeL2(a[f]) === encodeL2(b[f])
      : f === 'variantOptions'
        ? encodeVO(a[f]) === encodeVO(b[f])
        : f === 'fill'
          ? encodeFill(a[f]) === encodeFill(b[f])
          : f === 'change'
            ? encodeChange(a[f]) === encodeChange(b[f])
            : f === 'grain'
              ? encodeGrain(a[f]) === encodeGrain(b[f])
              : f === 'colorSym'
                ? String(encodeColorSym(a[f])) === String(encodeColorSym(b[f]))
                : f === 'accentLayer' || f === 'accentVary'
                  ? sameFields(a[f], b[f])
                  : a[f] === b[f],
  );
}

// The design a first visit shows: the address has no design yet. Chosen by the owner. It is an ordinary link string,
// so it goes through the same decoding as a shared link, and Reset still returns to the plain defaults.
// Phase 6: the design board (Desktop-Patterns): Truchet, 96 px tile of 4 x 4 cells, 5 px green curves, the corner
// dots in the default orange accent (no `ac`), the heading on a cream plate (0.88, radius 10).
// Never move this into DESIGN_DEFAULTS: links leave out default values, so old Tree links carry no `k`.
export const WELCOME = 'k=truchet&s=2692185587&d=4&z=96&w=5&bg=f4e9d8&fg=2f6f62&tx=1e2747&o=1&pm=plate&po=0.88&pr=10';
