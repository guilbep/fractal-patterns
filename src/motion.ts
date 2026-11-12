// Transform and motion: the tile drawn on a ::before layer, so the pattern moves while the text stays still.
import { svgToDataUri } from './css.ts';
import type { Layer2Settings } from './layers.ts';

export interface Motion {
  readonly rotate: number; // deg
  readonly scale: number; // factor
  readonly skew: number; // deg
  readonly tilt: number; // deg
  readonly drift: 'none' | 'x' | 'y' | 'xy';
  readonly speed: number; // seconds per tile
}

export const MOTION_NONE: Motion = { rotate: 0, scale: 1, skew: 0, tilt: 0, drift: 'none', speed: 8 };

export function isStatic(m: Motion): boolean {
  return m.rotate === 0 && m.skew === 0 && m.tilt === 0 && m.scale === 1 && m.drift === 'none';
}

const n = (x: number) => String(Number(x));

// Tile side after the motion scale, rounded to 3 decimals, no unit.
// Scale goes through the tile size, so the layer itself never shrinks below its box.
export const scaledSize = (size: number, m: Motion): string => n(Math.round(size * m.scale * 1000) / 1000);

export function cssMotion(svg: string, background: string, size: number, m: Motion): string {
  return [
    '.fp-pattern {',
    '  position: relative;',
    '  isolation: isolate;',
    '  overflow: hidden;',
    `  background-color: ${background};`,
    '}',
    ...motionLayer(m, `url("${svgToDataUri(svg)}")`, `${scaledSize(size, m)}px`),
  ].join('\n');
}

// The `.fp-pattern::before` rule, plus keyframes, paused and reduced-motion rules when drifting.
// `image` is the background-image value; `s` is one tile side with its unit, also the drift distance.
// With `second`, a `.fp-pattern::after` layer follows with its own `fp-drift-2` keyframes, and its own offset
// (x, y in percent of its tile), extra rotation, opacity, and depth (drift speed relative to the first layer).
// With `parallax`, each layer box grows by its scroll travel (see parallaxBlock), so the move never shows an edge.
export type SecondLayer = { readonly image: string; readonly s: string; readonly parallax?: boolean } & Partial<Layer2Settings>;

// A layer is centered on an oversized box when it turns, skews, or tilts, or when `turn` adds the --fp-turn property.
const isCentered = (lm: Motion, turn: boolean) => turn || lm.rotate !== 0 || lm.skew !== 0 || lm.tilt !== 0;

// The layer's static transform functions; empty when the layer is not centered. With `turn`, the rotation adds
// var(--fp-turn, 0deg), which the fp-a, fp-b, and fp-c helper classes set (see exportCss).
function layerFns(lm: Motion, turn = false): string[] {
  const fns: string[] = [];
  if (isCentered(lm, turn)) fns.push('translate(-50%, -50%)');
  if (lm.tilt !== 0) fns.push(`perspective(800px) rotateX(${n(lm.tilt)}deg)`);
  if (turn) fns.push(`rotate(calc(${n(lm.rotate)}deg + var(--fp-turn, 0deg)))`);
  else if (lm.rotate !== 0) fns.push(`rotate(${n(lm.rotate)}deg)`);
  if (lm.skew !== 0) fns.push(`skewX(${n(lm.skew)}deg)`);
  return fns;
}

// Scroll travel in vh (a positive number; the layer moves up): FIRST_TRAVEL for the first layer, 8vh * depth for the
// second, clamped to 2..32vh. Depth below 1 travels less and looks farther away; at depth 0.5 both layers move together.
export const FIRST_TRAVEL = 4;
export const parallaxTravel = (depth = 1): number => Math.min(32, Math.max(2, Math.round(8 * depth * 1000) / 1000));

export function motionLayer(m: Motion, image: string, s: string, second?: SecondLayer, turn = false): string[] {
  const drift = m.drift;
  const rule = (pseudo: string, img: string, size: string, name: string, lm: Motion, extra: string[], seconds: number, travel: number) => {
    const centered = isCentered(lm, turn);
    // Tilt pivots on the box's top edge: with perspective(800px) the far half of the plane never rises more than
    // 800px * cot(tilt) above the pivot, so the whole box sits on the near half. 225vmax covers a disc of radius
    // hypot(w/2, h) <= 1.118vmax around the pivot for tilt <= 60 and a box no larger than the viewport.
    // ponytail: assumes vmax >= 462px (800 * tan 30); half the layer lies above the box, unseen.
    const base = lm.tilt !== 0 ? 225 : 150;
    const vmax = `${n(Math.round((base / Math.cos((lm.skew * Math.PI) / 180)) * 10) / 10)}vmax`;
    // Parallax: the centered box grows by the travel on each side, so a disc it covered still lies inside after the move;
    // the plain box grows downward, since the layer moves up.
    const side = travel === 0 ? vmax : `calc(${vmax} + ${n(2 * travel)}vh)`;
    const fns = layerFns(lm, turn);
    return [
      `.fp-pattern::${pseudo} {`,
      '  content: "";',
      '  position: absolute;',
      '  z-index: -1;',
      ...(centered
        ? ['  left: 50%;', `  top: ${lm.tilt !== 0 ? '0' : '50%'};`, `  width: ${side};`, `  height: ${side};`]
        : [travel === 0 ? '  inset: 0;' : `  inset: 0 0 -${n(travel)}vh;`]),
      `  background-image: ${img};`,
      `  background-size: ${size} ${size};`,
      ...extra,
      ...(fns.length > 0 ? [`  transform: ${fns.join(' ')};`] : []),
      ...(drift === 'none' ? [] : [`  animation: ${name} ${n(seconds)}s linear infinite;`]),
      '}',
    ];
  };
  // An offset of `v` percent of the tile, plus `tiles` whole tiles: the drift animates from the offset to one tile further.
  const at = (size: string, v: number, tiles: number) =>
    v === 0 ? (tiles === 0 ? '0' : size) : `calc(${size} * ${n(Math.round((tiles + v / 100) * 1e6) / 1e6)})`;
  const x2 = second?.x ?? 0;
  const y2 = second?.y ?? 0;
  const px = second?.parallax === true;
  const lines = [...rule('before', image, s, 'fp-drift', m, [], m.speed, px ? FIRST_TRAVEL : 0)];
  if (second) {
    const offset = x2 !== 0 || y2 !== 0 ? [`  background-position: ${at(second.s, x2, 0)} ${at(second.s, y2, 0)};`] : [];
    const opacity = (second.opacity ?? 1) !== 1 ? [`  opacity: ${n(second.opacity ?? 1)};`] : [];
    const seconds = Math.round((m.speed / (second.depth ?? 1)) * 1000) / 1000;
    lines.push(
      ...rule(
        'after',
        second.image,
        second.s,
        'fp-drift-2',
        { ...m, rotate: m.rotate + (second.rotate ?? 0) },
        [...offset, ...opacity],
        seconds,
        px ? parallaxTravel(second.depth) : 0,
      ),
    );
  }
  if (drift === 'none') return lines;

  // Without an offset, the start is the default 0 0; with one, the start is the layer's background-position.
  const keyframes = (name: string, size: string, x: number, y: number) => [
    '',
    `@keyframes ${name} {`,
    `  to { background-position: ${at(size, x, drift === 'y' ? 0 : 1)} ${at(size, y, drift === 'x' ? 0 : 1)}; }`,
    '}',
  ];
  const pseudos = second ? ['before', 'after'] : ['before'];
  lines.push(
    ...keyframes('fp-drift', s, 0, 0),
    ...(second ? keyframes('fp-drift-2', second.s, x2, y2) : []),
    '',
    `${pseudos.map((p) => `.fp-pattern.fp-paused::${p}`).join(', ')} {`,
    '  animation-play-state: paused;',
    '}',
    '',
    '@media (prefers-reduced-motion: reduce) {',
    `  ${pseudos.map((p) => `.fp-pattern::${p}`).join(', ')} {`,
    '    animation: none;',
    '  }',
    '}',
  );
  return lines;
}

// Parallax on scroll for the two layers: a scroll-driven translateY before each layer's own transform, only for visitors
// without a reduced-motion wish and in browsers with scroll timelines. `cls` and `timeline` differ for the page's demo box.
// A drift keeps its own animation: both are listed, with `auto` as the drift's timeline.
export function parallaxBlock(m: Motion, second: Partial<Layer2Settings>, cls: string, timeline: string, turn = false): string[] {
  const depth = second.depth ?? 1;
  const layer = (pseudo: string, k: number, lm: Motion, travel: number, drift: string) => {
    const fns = layerFns(lm, turn).join(' ');
    const at = (y: string) => `transform: translateY(${y})${fns ? ` ${fns}` : ''};`;
    const name = `fp-scroll-${k}`;
    const drifting = m.drift !== 'none';
    return [
      `    @keyframes ${name} {`,
      `      from { ${at('0')} }`,
      `      to { ${at(`-${n(travel)}vh`)} }`,
      '    }',
      `    .${cls}::${pseudo} {`,
      drifting
        ? `      animation: ${drift} ${n(lm.speed)}s linear infinite, ${name} linear both;`
        : `      animation: ${name} linear both;`,
      drifting ? `      animation-timeline: auto, ${timeline};` : `      animation-timeline: ${timeline};`,
      '    }',
    ];
  };
  const seconds = Math.round((m.speed / depth) * 1000) / 1000;
  return [
    '@media (prefers-reduced-motion: no-preference) {',
    '  @supports (animation-timeline: scroll()) {',
    ...layer('before', 1, m, FIRST_TRAVEL, 'fp-drift'),
    ...layer('after', 2, { ...m, rotate: m.rotate + (second.rotate ?? 0), speed: seconds }, parallaxTravel(depth), 'fp-drift-2'),
    '  }',
    '}',
  ];
}
