// Browser/worker only: encodes wheel pixels as a WebP tile, PNG where WebP is unsupported.

export async function encodeWheel(pixels: Uint8ClampedArray, n: number): Promise<{ blob: Blob; type: 'image/webp' | 'image/png' }> {
  if (typeof OffscreenCanvas === 'undefined') {
    throw new Error('encodeWheel needs OffscreenCanvas, which this environment does not have');
  }
  const canvas = new OffscreenCanvas(n, n);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('encodeWheel could not get a 2d context from OffscreenCanvas');
  ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), n, n), 0, 0);
  const webp = await canvas.convertToBlob({ type: 'image/webp', quality: 0.8 });
  // Safari silently returns PNG for an unsupported type.
  if (webp.type === 'image/webp') return { blob: webp, type: 'image/webp' };
  return { blob: await canvas.convertToBlob({ type: 'image/png' }), type: 'image/png' };
}
