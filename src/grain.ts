// Grain: a fine noise drawn behind the pattern, over the background color. Its tile has its own size, prime and
// unrelated to the pattern tile, so the two repeat together only every GRAIN_TILE * tile px and the grain hides the seams.
// Pure: no DOM access.

export type GrainTone = 'dark' | 'light';
export interface Grain {
  readonly on: boolean;
  readonly amount: number; // peak opacity of the specks, 0 to 30 %
  readonly size: number; // the noise's baseFrequency: high is fine, low is coarse
  readonly tone: GrainTone; // dark: black specks, light: white specks
}

export const GRAIN_DEFAULTS: Grain = { on: false, amount: 12, size: 0.75, tone: 'dark' };
export const GRAIN_AMOUNT = [0, 30] as const;
export const GRAIN_SIZE = [0.3, 1.2] as const;
// 257 px: a prime, so it shares no factor with any whole tile size below 257 px; stitchTiles keeps it seamless.
export const GRAIN_TILE = 257;

export const grainColor = (tone: GrainTone): string => (tone === 'dark' ? '#000000' : '#ffffff');

// One tile of `w` by `h`. The filter region is the tile itself (the default region is 10 % larger and would leave a
// seam), stitched so the noise wraps. The alpha stretches the noise (3a - 1) into specks that reach full alpha, and the rect's opacity
// caps it: the peak opacity is exactly `amount`, which the contrast check takes as the worst case.
export function grainSvg(g: Grain, w = GRAIN_TILE, h = w): string {
  const c = g.tone === 'dark' ? 0 : 1;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<filter id="g" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${g.size}" numOctaves="3" stitchTiles="stitch"/>` +
    `<feColorMatrix values="0 0 0 0 ${c} 0 0 0 0 ${c} 0 0 0 0 ${c} 0 0 0 3 -1"/></filter>` +
    `<rect width="100%" height="100%" filter="url(#g)" opacity="${g.amount / 100}"/></svg>`
  );
}
