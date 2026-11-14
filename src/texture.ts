// Texture: a surface drawn between the background color and the pattern. Grain is one kind, but it keeps its own
// model and `gr` link key so old links open as before; the other kinds travel under `te`.
// Pure: no DOM access.
import type { Grain } from './grain.ts';

export const TEXTURE_KINDS = [
  'grain',
  'paper',
  'coldpress',
  'linen',
  'plaster',
  'washi',
  'kraft',
  'sand',
  'riso',
  'terrazzo',
  'stipple',
] as const;
export type TextureKind = (typeof TEXTURE_KINDS)[number];

export const TEXTURE_LABELS: Record<TextureKind, string> = {
  grain: 'Grain',
  paper: 'Paper',
  coldpress: 'Cold-press',
  linen: 'Linen',
  plaster: 'Plaster',
  washi: 'Washi',
  kraft: 'Kraft',
  sand: 'Sand',
  riso: 'Riso',
  terrazzo: 'Terrazzo',
  stipple: 'Stipple',
};

export type TextureRoute = 'baked' | 'live' | 'vector';
// The routes each kind can be drawn by; the first is its default.
export const ROUTES: Record<TextureKind, readonly TextureRoute[]> = {
  grain: ['live'],
  paper: ['baked', 'live'],
  coldpress: ['baked', 'live'],
  linen: ['baked', 'live'],
  plaster: ['baked', 'live'],
  washi: ['baked'],
  kraft: ['baked'],
  sand: ['live', 'baked'],
  riso: ['live', 'baked'],
  terrazzo: ['vector'],
  stipple: ['vector'],
};

// Washi, kraft, terrazzo and stipple take palette colors, so the dark/light tone does not apply to them.
const NO_TONE: readonly TextureKind[] = ['washi', 'kraft', 'terrazzo', 'stipple'];
export const toneApplies = (kind: TextureKind): boolean => !NO_TONE.includes(kind);

export type TextureTone = 'dark' | 'light';
export interface Texture {
  readonly on: boolean;
  readonly kind: TextureKind;
  readonly strength: number; // 0 to 100 %
  readonly scale: number; // 0.5 to 2, step 0.25
  readonly seed: number; // integer 0 to 9999
  readonly tone: TextureTone;
  readonly route: TextureRoute;
}

export const TEXTURE_DEFAULTS: Texture = {
  on: false,
  kind: 'grain',
  strength: 40,
  scale: 1,
  seed: 1,
  tone: 'dark',
  route: 'live',
};

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x)) + 0;

export function clampTexture(t: Texture): Texture {
  const routes = ROUTES[t.kind];
  return {
    ...t,
    strength: Math.round(clamp(t.strength, 0, 100)),
    scale: clamp(Math.round(t.scale * 4) / 4, 0.5, 2),
    seed: Math.round(clamp(t.seed, 0, 9999)),
    route: routes.includes(t.route) ? t.route : routes[0]!,
  };
}

// The grain as a texture kind, for the picker; its own amount and size stay in the Grain.
export const fromGrain = (g: Grain): Texture | null =>
  g.on ? { ...TEXTURE_DEFAULTS, on: true, kind: 'grain', tone: g.tone, route: 'live' } : null;

const ROUTE_CODE: Record<TextureRoute, string> = { baked: 'b', live: 'l', vector: 'v' };

// kind.strength.scale.seed.tone.route, e.g. paper.40.1.1.d.b; null when off or grain (grain is written by `gr`).
export function encodeTexture(t: Texture): string | null {
  if (!t.on || t.kind === 'grain') return null;
  const c = clampTexture(t);
  return [c.kind, c.strength, c.scale, c.seed, c.tone === 'dark' ? 'd' : 'l', ROUTE_CODE[c.route]].join('.');
}

// The link is untrusted: never throws, anything malformed gives null, numbers are clamped.
export function decodeTexture(s: string | null): Texture | null {
  const p = (s ?? '').split('.');
  // The scale may hold its own dot (1.25): strength and seed are whole, so it is everything between them.
  if (p.length !== 6 && p.length !== 7) return null;
  const kind = TEXTURE_KINDS.find((k) => k === p[0]);
  if (!kind || kind === 'grain') return null;
  const [sd, t, r] = p.slice(-3);
  const [strength, scale, seed] = [p[1]!, p.slice(2, -3).join('.'), sd!].map((x) => (x.trim() === '' ? NaN : Number(x))) as [
    number,
    number,
    number,
  ];
  const tone = t === 'd' ? 'dark' : t === 'l' ? 'light' : null;
  const route = (Object.keys(ROUTE_CODE) as TextureRoute[]).find((c) => ROUTE_CODE[c] === r);
  if (!tone || !route || ![strength, scale, seed].every(Number.isFinite)) return null;
  return clampTexture({ on: true, kind, strength, scale, seed, tone, route });
}
