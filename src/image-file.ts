// Read an image file into RGBA pixels, its longer side at most `max` px. Browser only (canvas).
import type { Rgba } from './studio/colortrace.ts';
import { isSvgFile } from './studio/own-motif.ts';

type Pixels = Rgba & { readonly data: Uint8ClampedArray };
// A decoded image, to sample at one or more sizes. `close` frees it.
export interface Decoded {
  readonly src: CanvasImageSource;
  readonly width: number;
  readonly height: number;
  close(): void;
}

// The size of the image drawn with its longer side at most `max` px, at least 1 px. Never upscaled, unless
// `enlarge`: then the longer side is exactly `max` (the Patterns page traces at a fixed resolution).
export function fitSize(width: number, height: number, max: number, enlarge = false): [number, number] {
  const s = enlarge ? max / Math.max(width, height) : Math.min(1, max / Math.max(width, height));
  return [Math.max(1, Math.round(width * s)), Math.max(1, Math.round(height * s))];
}

// One decode. An SVG file is drawn through an <img> and an object URL (createImageBitmap does not decode SVG in
// Chromium); its text never enters the page. An SVG without a size is drawn at 600 px.
export async function decodeImage(file: Blob): Promise<Decoded> {
  if (isSvgFile(file instanceof File ? file.name : '', file.type)) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { src: img, width: img.naturalWidth || 600, height: img.naturalHeight || 600, close() {} };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const bitmap = await createImageBitmap(file);
  return { src: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
}

export function sample(image: Decoded, max: number, enlarge = false): Pixels {
  const [width, height] = fitSize(image.width, image.height, max, enlarge);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(image.src, 0, 0, width, height);
  return { data: ctx.getImageData(0, 0, width, height).data, width, height };
}

export async function readImage(file: Blob, max: number, enlarge = false): Promise<Pixels> {
  const image = await decodeImage(file);
  try {
    return sample(image, max, enlarge);
  } finally {
    image.close();
  }
}
