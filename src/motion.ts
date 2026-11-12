// Transform and motion: the tile drawn on a ::before layer, so the pattern moves while the text stays still.
import { svgToDataUri } from './css.ts';

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
// With `second`, a `.fp-pattern::after` layer follows with the same box and its own `fp-drift-2` keyframes.
export function motionLayer(m: Motion, image: string, s: string, second?: { image: string; s: string }): string[] {
  const centered = m.rotate !== 0 || m.skew !== 0 || m.tilt !== 0;
  // Tilt pivots on the box's top edge: with perspective(800px) the far half of the plane never rises more than
  // 800px * cot(tilt) above the pivot, so the whole box sits on the near half. 225vmax covers a disc of radius
  // hypot(w/2, h) <= 1.118vmax around the pivot for tilt <= 60 and a box no larger than the viewport.
  // ponytail: assumes vmax >= 462px (800 * tan 30); half the layer lies above the box, unseen.
  const base = m.tilt !== 0 ? 225 : 150;
  const side = `${n(Math.round((base / Math.cos((m.skew * Math.PI) / 180)) * 10) / 10)}vmax`;
  const fns: string[] = [];
  if (centered) fns.push('translate(-50%, -50%)');
  if (m.tilt !== 0) fns.push(`perspective(800px) rotateX(${n(m.tilt)}deg)`);
  if (m.rotate !== 0) fns.push(`rotate(${n(m.rotate)}deg)`);
  if (m.skew !== 0) fns.push(`skewX(${n(m.skew)}deg)`);

  const drift = m.drift;
  const rule = (pseudo: string, img: string, size: string, name: string) => [
    `.fp-pattern::${pseudo} {`,
    '  content: "";',
    '  position: absolute;',
    '  z-index: -1;',
    ...(centered ? ['  left: 50%;', `  top: ${m.tilt !== 0 ? '0' : '50%'};`, `  width: ${side};`, `  height: ${side};`] : ['  inset: 0;']),
    `  background-image: ${img};`,
    `  background-size: ${size} ${size};`,
    ...(fns.length > 0 ? [`  transform: ${fns.join(' ')};`] : []),
    ...(drift === 'none' ? [] : [`  animation: ${name} ${n(m.speed)}s linear infinite;`]),
    '}',
  ];
  const lines = [...rule('before', image, s, 'fp-drift'), ...(second ? rule('after', second.image, second.s, 'fp-drift-2') : [])];
  if (drift === 'none') return lines;

  const keyframes = (name: string, size: string) => [
    '',
    `@keyframes ${name} {`,
    `  to { background-position: ${{ x: `${size} 0`, y: `0 ${size}`, xy: `${size} ${size}` }[drift]}; }`,
    '}',
  ];
  const pseudos = second ? ['before', 'after'] : ['before'];
  lines.push(
    ...keyframes('fp-drift', s),
    ...(second ? keyframes('fp-drift-2', second.s) : []),
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
