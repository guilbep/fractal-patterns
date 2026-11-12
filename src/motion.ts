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
export type SecondLayer = { readonly image: string; readonly s: string } & Partial<Layer2Settings>;

export function motionLayer(m: Motion, image: string, s: string, second?: SecondLayer): string[] {
  const drift = m.drift;
  const rule = (pseudo: string, img: string, size: string, name: string, lm: Motion, extra: string[], seconds: number) => {
    const centered = lm.rotate !== 0 || lm.skew !== 0 || lm.tilt !== 0;
    // Tilt pivots on the box's top edge: with perspective(800px) the far half of the plane never rises more than
    // 800px * cot(tilt) above the pivot, so the whole box sits on the near half. 225vmax covers a disc of radius
    // hypot(w/2, h) <= 1.118vmax around the pivot for tilt <= 60 and a box no larger than the viewport.
    // ponytail: assumes vmax >= 462px (800 * tan 30); half the layer lies above the box, unseen.
    const base = lm.tilt !== 0 ? 225 : 150;
    const side = `${n(Math.round((base / Math.cos((lm.skew * Math.PI) / 180)) * 10) / 10)}vmax`;
    const fns: string[] = [];
    if (centered) fns.push('translate(-50%, -50%)');
    if (lm.tilt !== 0) fns.push(`perspective(800px) rotateX(${n(lm.tilt)}deg)`);
    if (lm.rotate !== 0) fns.push(`rotate(${n(lm.rotate)}deg)`);
    if (lm.skew !== 0) fns.push(`skewX(${n(lm.skew)}deg)`);
    return [
      `.fp-pattern::${pseudo} {`,
      '  content: "";',
      '  position: absolute;',
      '  z-index: -1;',
      ...(centered
        ? ['  left: 50%;', `  top: ${lm.tilt !== 0 ? '0' : '50%'};`, `  width: ${side};`, `  height: ${side};`]
        : ['  inset: 0;']),
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
  const lines = [...rule('before', image, s, 'fp-drift', m, [], m.speed)];
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
