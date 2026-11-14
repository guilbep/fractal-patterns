// The "Smooth wheel" tile grown in the heavy worker: field, pixels, WebP (PNG if the lossy edges show a seam).
import { farrisGrid, type FarrisRecipe } from './farris.ts';
import { edgeSeam, wheelPixels } from './farris-wheel.ts';
import { encodeWheel } from './farris-wheel-encode.ts';

export type WheelArgs = FarrisRecipe & { colors: readonly string[]; n?: number };
export type WheelResult = { dataUrl: string; type: 'image/webp' | 'image/png'; bytes: number; seam: number };

// Above this edge/inner ratio the lossy tile shows a line at the repeat.
export const SEAM_LIMIT = 1.5;

export const wheelTilePixels = ({ group, seed, waves, detail, colors, n = 256 }: WheelArgs) =>
  wheelPixels(farrisGrid({ group, seed, waves, detail }, n), colors);

export function base64(bytes: Uint8Array): string {
  let s = '';
  // Chunked: String.fromCharCode with one argument per byte overflows the stack on a big tile.
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function decode(blob: Blob, n: number): Promise<Uint8ClampedArray> {
  const bmp = await createImageBitmap(blob);
  const ctx = new OffscreenCanvas(n, n).getContext('2d')!;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  return ctx.getImageData(0, 0, n, n).data;
}

async function png(pixels: Uint8ClampedArray, n: number): Promise<Blob> {
  const canvas = new OffscreenCanvas(n, n);
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(pixels), n, n), 0, 0);
  return canvas.convertToBlob({ type: 'image/png' });
}

export async function farrisWheel(args: WheelArgs): Promise<WheelResult> {
  const n = args.n ?? 256;
  const pixels = wheelTilePixels(args);
  let { blob, type } = await encodeWheel(pixels, n);
  // Measured on the decoded lossy tile: the compression, not the field, is what can break the repeat.
  let seam = edgeSeam(await decode(blob, n), n);
  if (type === 'image/webp' && seam > SEAM_LIMIT) {
    // WebP quality 1 is still lossy in Chrome: PNG is the lossless choice.
    blob = await png(pixels, n);
    type = 'image/png';
    seam = edgeSeam(pixels, n);
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { dataUrl: `data:${type};base64,${base64(bytes)}`, type, bytes: bytes.length, seam };
}
