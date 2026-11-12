// A design as a short URL query string, and back. The query is untrusted input: decodeDesign never throws
// and every field falls back to its default or is clamped to its range.
import { FAMILIES, KINDS, MAX_DEPTH, type Kind } from './fractal.ts';
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
  variants: 'v', // keep new keys last: older links stay valid
};
const FIELDS = Object.keys(KEYS) as (keyof Design)[];

export function encodeDesign(d: Design): string {
  const pairs: [string, string][] = [];
  for (const f of FIELDS) {
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
  const bool = (f: 'mirror' | 'frame' | 'variants'): boolean => (get(f) === '1' ? true : get(f) === '0' ? false : D[f]);
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
  };
}

export function sameDesign(a: Design, b: Design): boolean {
  return FIELDS.every((f) => a[f] === b[f]);
}
