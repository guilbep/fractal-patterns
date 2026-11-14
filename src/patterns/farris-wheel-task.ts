// The "Smooth wheel" tile grown in the heavy worker: field, pixels, WebP (PNG if the lossy edges show a seam).
import { farrisGrid, type FarrisRecipe } from './farris.ts';
import { edgeSeam, wheelPixels } from './farris-wheel.ts';
import { encodeWheel } from './farris-wheel-encode.ts';

export type WheelArgs = FarrisRecipe & { colors: readonly string[]; n?: number };
// n: tile pixels; the image is n + 2·PAD wide, its border of PAD pixels lies outside the tile (see padWrap).
export type WheelResult = { dataUrl: string; type: 'image/webp' | 'image/png'; bytes: number; seam: number; n: number; pad: number };

export const PAD = 1;

// Above this edge/inner ratio the lossy tile shows a line at the repeat.
export const SEAM_LIMIT = 1.5;

export const wheelTilePixels = ({ group, seed, waves, detail, colors, n = 256 }: WheelArgs) =>
  wheelPixels(farrisGrid({ group, seed, waves, detail }, n), colors);

/** The tile with a border of p pixels copied from the opposite edges. Placed so the border lies just outside the tile,
 * the browser's smoothing at the image edge (which blends with transparency and showed a light line at the repeat in
 * some browsers) happens where nothing is drawn, and the repeat stays exact. */
export function padWrap(px: Uint8ClampedArray, n: number, p = PAD): Uint8ClampedArray {
  const m = n + 2 * p;
  const out = new Uint8ClampedArray(m * m * 4);
  for (let y = 0; y < m; y++)
    for (let x = 0; x < m; x++) {
      const sx = (((x - p) % n) + n) % n;
      const sy = (((y - p) % n) + n) % n;
      out.set(px.subarray((sy * n + sx) * 4, (sy * n + sx) * 4 + 4), (y * m + x) * 4);
    }
  return out;
}

/** The inner n x n pixels of a padded image. */
export function unpad(px: Uint8ClampedArray, n: number, p = PAD): Uint8ClampedArray {
  const m = n + 2 * p;
  const out = new Uint8ClampedArray(n * n * 4);
  for (let y = 0; y < n; y++) out.set(px.subarray(((y + p) * m + p) * 4, ((y + p) * m + p + n) * 4), y * n * 4);
  return out;
}

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
  const m = n + 2 * PAD;
  const pixels = padWrap(wheelTilePixels(args), n);
  let { blob, type } = await encodeWheel(pixels, m);
  // Measured on the decoded lossy tile: the compression, not the field, is what can break the repeat.
  let seam = edgeSeam(unpad(await decode(blob, m), n), n);
  if (type === 'image/webp' && seam > SEAM_LIMIT) {
    // WebP quality 1 is still lossy in Chrome: PNG is the lossless choice.
    blob = await png(pixels, m);
    type = 'image/png';
    seam = edgeSeam(unpad(pixels, n), n);
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { dataUrl: `data:${type};base64,${base64(bytes)}`, type, bytes: bytes.length, seam, n, pad: PAD };
}
