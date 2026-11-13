// Renders a repeating SVG tile into a PNG of a chosen pixel size. Browser only: loaded on demand.
import { svgToDataUri } from './css.ts';
import { clockFadeStops, planStrips } from './png-plan.ts';

const TOO_LARGE = 'This size is too large for this browser. Try a smaller size or download the SVG.';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The tile SVG could not be loaded as an image.'));
    img.src = src;
  });
}

function canvas2d(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw on a canvas.');
  return [cv, ctx];
}

export async function renderPng(o: {
  svg: string;
  tileWidth: number;
  tileHeight: number;
  width: number;
  height: number;
  background: string | null;
  clockFade?: boolean;
  scale?: number;
}): Promise<Blob> {
  const plan = planStrips(o.width, o.height);
  if (!plan.ok) throw new Error(`${plan.reason} ${TOO_LARGE}`);
  const img = await loadImage(svgToDataUri(o.svg));
  // ponytail: one final canvas; the browser decides the real ceiling (iOS Safari about 16.7 M px).
  // Upgrade path: draw the strips of planStrips one by one into a PNG encoder that streams rows.
  try {
    return await draw(o, img);
  } catch {
    throw new Error(TOO_LARGE);
  }
}

async function draw(o: Parameters<typeof renderPng>[0], img: HTMLImageElement): Promise<Blob> {
  const scale = o.scale ?? 1;
  // The SVG is drawn once into a raster tile and the pattern is made from that canvas, not from the
  // SVG image: createPattern of an SVG image is not reliable across browsers (Safari and Firefox
  // can rasterize it at the wrong size or leave it blank), a canvas source is.
  const tw = Math.max(1, Math.round(o.tileWidth * scale));
  const th = Math.max(1, Math.round(o.tileHeight * scale));
  const [tile, tc] = canvas2d(tw, th);
  tc.drawImage(img, 0, 0, tw, th);
  const [cv, ctx] = canvas2d(o.width, o.height);
  if (o.background !== null) {
    ctx.fillStyle = o.background;
    ctx.fillRect(0, 0, o.width, o.height);
  }
  const pattern = ctx.createPattern(tile, 'repeat');
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, o.width, o.height);
  }
  if (o.clockFade) {
    const [r, g, b] = o.background === null ? tc.getImageData(0, 0, 1, 1).data : [0, 0, 0];
    const color = o.background ?? `rgb(${r} ${g} ${b})`;
    const stops = clockFadeStops(o.height);
    const grad = ctx.createLinearGradient(0, stops.from, 0, stops.to);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, stops.from, o.width, stops.to - stops.from);
  }
  return new Promise((resolve, reject) => cv.toBlob((blob) => (blob ? resolve(blob) : reject(new Error(TOO_LARGE))), 'image/png'));
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
