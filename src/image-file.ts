// Read a raster image file into RGBA pixels, its longer side at most `max` px. Browser only (canvas).
import type { Rgba } from './studio/colortrace.ts';

export async function readImage(file: Blob, max: number): Promise<Rgba & { readonly data: Uint8ClampedArray }> {
  const bitmap = await createImageBitmap(file);
  try {
    const s = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * s));
    const height = Math.max(1, Math.round(bitmap.height * s));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(bitmap, 0, 0, width, height);
    return { data: ctx.getImageData(0, 0, width, height).data, width, height };
  } finally {
    bitmap.close();
  }
}
