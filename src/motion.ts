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

export function cssMotion(svg: string, background: string, size: number, m: Motion): string {
  const s = n(size);
  const centered = m.rotate !== 0 || m.skew !== 0 || m.tilt !== 0;
  const fns: string[] = [];
  if (centered) fns.push('translate(-50%, -50%)');
  if (m.tilt !== 0) fns.push(`perspective(800px) rotateX(${n(m.tilt)}deg)`);
  if (m.rotate !== 0) fns.push(`rotate(${n(m.rotate)}deg)`);
  if (m.skew !== 0) fns.push(`skewX(${n(m.skew)}deg)`);
  if (m.scale !== 1) fns.push(`scale(${n(m.scale)})`);

  const lines = [
    '.fp-pattern {',
    '  position: relative;',
    '  isolation: isolate;',
    '  overflow: hidden;',
    `  background-color: ${background};`,
    '}',
    '.fp-pattern::before {',
    '  content: "";',
    '  position: absolute;',
    '  z-index: -1;',
    ...(centered ? ['  left: 50%;', '  top: 50%;', '  width: 150vmax;', '  height: 150vmax;'] : ['  inset: 0;']),
    `  background-image: url("${svgToDataUri(svg)}");`,
    `  background-size: ${s}px ${s}px;`,
  ];
  if (fns.length > 0) lines.push(`  transform: ${fns.join(' ')};`);
  if (m.drift === 'none') return [...lines, '}'].join('\n');

  const to = { x: `${s}px 0`, y: `0 ${s}px`, xy: `${s}px ${s}px` }[m.drift];
  lines.push(
    `  animation: fp-drift ${n(m.speed)}s linear infinite;`,
    '}',
    '',
    '@keyframes fp-drift {',
    `  to { background-position: ${to}; }`,
    '}',
    '',
    '.fp-pattern.fp-paused::before {',
    '  animation-play-state: paused;',
    '}',
    '',
    '@media (prefers-reduced-motion: reduce) {',
    '  .fp-pattern::before {',
    '    animation: none;',
    '  }',
    '}',
  );
  return lines.join('\n');
}
