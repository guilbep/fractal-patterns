// A design as a short URL query string, and back. The query is untrusted input: decodeDesign never throws
// and every field falls back to its default or is clamped to its range.
import { FAMILIES, KINDS, MAX_DEPTH, type Kind } from './fractal.ts';
import { LAYER2_DEFAULTS, type Layer2Settings } from './layers.ts';
import { MOTION_NONE, type Motion } from './motion.ts';

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
}
// Not in the URL: pinned patchwork cells (a per-session tweak), the palette name (the roles carry the colors),
// and the image source (the pixels never leave the browser).

const ALL_FAMILIES = (1 << FAMILIES.length) - 1;

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
  parallax: 'px', // keep new keys last: older links stay valid
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

export function encodeDesign(d: Design): string {
  const pairs: [string, string][] = [];
  for (const f of FIELDS) {
    if (f === 'layer2Settings') {
      const l2 = encodeL2(d.layer2Settings);
      if (l2) pairs.push([KEYS[f], l2]);
      continue;
    }
    const v = d[f];
    if (v === DESIGN_DEFAULTS[f]) continue;
    pairs.push([KEYS[f], typeof v === 'boolean' ? (v ? '1' : '0') : typeof v === 'number' ? String(v) : v.replace(/^#/, '')]);
  }
  return new URLSearchParams(pairs).toString();
}

type NumField = { [F in keyof Design]: Design[F] extends number ? F : never }[keyof Design];

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
  const color = (f: 'background' | 'pattern' | 'text'): string => {
    const s = get(f);
    return /^[0-9a-f]{6}$/i.test(s) ? `#${s.toLowerCase()}` : D[f];
  };
  const oneOf = <T extends string>(f: keyof Design, values: readonly T[], fallback: T): T => values.find((v) => v === get(f)) ?? fallback;
  const kind = oneOf('kind', KINDS, D.kind);
  const bool = (f: 'mirror' | 'frame' | 'variants' | 'layer2' | 'fade' | 'parallax'): boolean =>
    get(f) === '1' ? true : get(f) === '0' ? false : D[f];
  return {
    kind,
    seed: num('seed', 0, 0xffffffff, true),
    depth: Math.min(num('depth', 1, MAX_DEPTH[kind], true), MAX_DEPTH[kind]), // the default 8 is too deep for some kinds
    size: num('size', 40, 240),
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
    layout: oneOf('layout', ['single', 'patchwork'], D.layout),
    cells: num('cells', 2, 4, true),
    frame: bool('frame'),
    families: num('families', 0, ALL_FAMILIES, true) || ALL_FAMILIES, // no family at all is not a design
    variants: bool('variants'),
    layer2: bool('layer2'),
    fade: bool('fade'),
    layer2Settings: decodeL2(get('layer2Settings')),
    parallax: bool('parallax'),
  };
}

export function sameDesign(a: Design, b: Design): boolean {
  return FIELDS.every((f) => (f === 'layer2Settings' ? encodeL2(a[f]) === encodeL2(b[f]) : a[f] === b[f]));
}
