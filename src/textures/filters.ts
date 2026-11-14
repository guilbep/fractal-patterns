// Live textures: SVG filter tiles the browser redraws, built like the grain (src/grain.ts). They cost a few hundred bytes
// where a baked image costs tens of KB. Pure: no DOM access.

export type LiveKind = 'paper' | 'coldpress' | 'linen' | 'plaster' | 'sand' | 'riso';
export interface LiveOptions {
  readonly seed: number;
  readonly scale: number; // 0.5 to 2: high is coarse
  readonly strength: number; // 0 to 100, mapped to the kind's peak opacity
  readonly tone: 'dark' | 'light';
  readonly tile?: number;
}

// Same prime as GRAIN_TILE, so a live texture shares no factor with any pattern tile below 257 px.
export const LIVE_TILE = 257;

// Peak opacity at strength 100. Kept at or under 0.35 so the texture never fights the pattern.
const MAX: Record<LiveKind, number> = {
  paper: 0.2,
  coldpress: 0.3,
  linen: 0.25,
  plaster: 0.25,
  sand: 0.35,
  riso: 0.35,
};

export function liveTextureSvg(kind: LiveKind, o: LiveOptions): string {
  const t = o.tile ?? LIVE_TILE;
  const c = o.tone === 'dark' ? 0 : 1;
  // stitchTiles only wraps when baseFrequency * tile is a whole number, so snap it to k / t (at least 1 / t).
  const f = (v: number): number => Math.max(1, Math.round((v / o.scale) * t)) / t;
  const turb = (type: string, fx: number, fy: number, oct: number, seed: number, res: string): string =>
    `<feTurbulence type="${type}" baseFrequency="${f(fx)}${fx === fy ? '' : ` ${f(fy)}`}" numOctaves="${oct}" seed="${seed}" stitchTiles="stitch" result="${res}"/>`;
  // Paints the tone colour, with alpha = a * R + b of the input.
  const tone = (a: number, b: number, input: string, res = ''): string =>
    `<feColorMatrix in="${input}" values="0 0 0 0 ${c} 0 0 0 0 ${c} 0 0 0 0 ${c} ${a} 0 0 0 ${b}"${res && ` result="${res}"`}/>`;
  // Relief from a noise; the flat lit value is about 0.87, so shadows sit below it.
  const light = (surface: number): string =>
    `<feDiffuseLighting in="n" surfaceScale="${surface}" lighting-color="#fff" result="l"><feDistantLight azimuth="45" elevation="60"/></feDiffuseLighting>`;
  // Dark tone shows the shadows, light tone the lit ridges.
  const relief = c ? tone(4, -3.6, 'l') : tone(-4, 3.6, 'l');
  const s = o.seed;

  const body: Record<LiveKind, () => string> = {
    paper: () => turb('fractalNoise', 0.9, 0.9, 3, s, 'n') + light(1.5) + relief,
    coldpress: () => turb('fractalNoise', 0.12, 0.12, 4, s, 'n') + light(4) + relief,
    // Warp and weft: two stretched noises, averaged.
    linen: () =>
      turb('turbulence', 0.02, 0.7, 2, s, 'a') +
      turb('turbulence', 0.7, 0.02, 2, s + 1, 'b') +
      `<feComposite in="a" in2="b" operator="arithmetic" k2="0.5" k3="0.5" result="n"/>` +
      tone(3, 0, 'n'),
    // Soft blotches plus rare pits: the top sixth of a fine noise, cut hard.
    plaster: () =>
      turb('fractalNoise', 0.012, 0.012, 3, s, 'n') +
      tone(3, -1.2, 'n', 'm') +
      turb('fractalNoise', 0.35, 0.35, 1, s + 1, 'p') +
      tone(1, 0, 'p') +
      `<feComponentTransfer result="q"><feFuncA type="discrete" tableValues="0 0 0 0 0 1"/></feComponentTransfer>` +
      `<feMerge><feMergeNode in="m"/><feMergeNode in="q"/></feMerge>`,
    // A steep slope turns the mid-grey noise into sharp specks.
    sand: () =>
      turb('fractalNoise', 1.2, 1.2, 1, s, 'n') +
      tone(1, 0, 'n') +
      `<feComponentTransfer><feFuncA type="linear" slope="6" intercept="-3.2"/></feComponentTransfer>`,
    // Hard dots: alpha is 0 or 1, nothing between.
    riso: () =>
      turb('fractalNoise', 0.6, 0.6, 2, s, 'n') +
      tone(1, 0, 'n') +
      `<feComponentTransfer><feFuncA type="discrete" tableValues="0 0 1"/></feComponentTransfer>`,
  };

  const strength = Math.min(100, Math.max(0, o.strength));
  const opacity = Math.round((strength / 100) * MAX[kind] * 1000) / 1000;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" width="${t}" height="${t}">` +
    `<filter id="t" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">${body[kind]()}</filter>` +
    `<rect width="100%" height="100%" filter="url(#t)" opacity="${opacity}"/></svg>`
  );
}
