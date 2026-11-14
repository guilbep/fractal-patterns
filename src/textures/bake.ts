// Baked textures: pixels computed off the main thread, encoded once as a WebP tile.
import { base64 } from '../patterns/farris-wheel-task.ts';
import { fiberPixels } from './fibers.ts';
import { surfacePixels, surfaceRange } from './surfaces.ts';

export type BakeKind = 'paper' | 'coldpress' | 'linen' | 'plaster' | 'sand' | 'riso' | 'washi' | 'kraft';
export type BakeArgs = {
  kind: BakeKind;
  seed: number;
  scale: number;
  strength: number;
  tone: 'dark' | 'light';
  background: string;
  colors: readonly string[];
  n?: number;
  quality?: number;
};
type Rgb = [number, number, number];
export type BakeResult = { dataUrl: string; type: 'image/webp' | 'image/png'; bytes: number; darkest: Rgb; lightest: Rgb };

export function bakePixels(a: BakeArgs): Uint8ClampedArray {
  const n = a.n ?? 256;
  if (a.kind === 'washi' || a.kind === 'kraft') return fiberPixels(a.kind, { ...a, n });
  if (['paper', 'coldpress', 'linen', 'plaster', 'sand', 'riso'].includes(a.kind)) return surfacePixels(a.kind, { ...a, n });
  // The kind comes through the worker untyped: refuse anything else.
  throw new Error(`bakePixels cannot bake the texture kind '${String(a.kind)}'`);
}

export const bakeKey = (a: BakeArgs): string =>
  ['bake', a.kind, a.seed, a.scale, a.strength, a.tone, a.background, a.colors.join(','), a.n ?? 256, a.quality ?? 0.7].join('|');

export async function bakeTexture(a: BakeArgs): Promise<BakeResult> {
  if (typeof OffscreenCanvas === 'undefined') throw new Error('bakeTexture needs OffscreenCanvas');
  const n = a.n ?? 256;
  const pixels = bakePixels(a);
  const canvas = new OffscreenCanvas(n, n);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('bakeTexture could not get a 2d context from OffscreenCanvas');
  ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), n, n), 0, 0);
  let blob = await canvas.convertToBlob({ type: 'image/webp', quality: a.quality ?? 0.7 });
  // Safari silently returns PNG for an unsupported type.
  if (blob.type !== 'image/webp') blob = await canvas.convertToBlob({ type: 'image/png' });
  const type = blob.type === 'image/webp' ? 'image/webp' : 'image/png';
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { dataUrl: `data:${type};base64,${base64(bytes)}`, type, bytes: bytes.length, ...surfaceRange(pixels) };
}
