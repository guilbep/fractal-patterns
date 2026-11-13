// Soft fade: two large radial-gradient mask layers with coprime sizes dim the pattern unevenly, so the grid is harder to see.
// A mask only lowers alpha, so the pattern never gets stronger and text contrast never gets worse.
import { gcd } from './layers.ts';

const ALPHA_MIN = 0.55;

export function fadeSizes(tileSize: number): [number, number] {
  const a = Math.round(tileSize * 3.3);
  let b = Math.round(tileSize * 5.7);
  while (gcd(a, b) !== 1) b++;
  return [a, b];
}

// Declaration lines for the pattern layer, without indent.
// With `extra` (a Slow change gradient), it is a third mask layer over the whole element, intersected with the other two.
export function fadeMask(tileSize: number, extra?: string): string[] {
  const [a, b] = fadeSizes(tileSize);
  const g = (at: string) => `radial-gradient(circle at ${at}, rgb(0 0 0 / 1), rgb(0 0 0 / ${ALPHA_MIN}))`;
  const image = `${g('50% 50%')}, ${g('30% 70%')}${extra ? `, ${extra}` : ''}`;
  const size = `${a}px ${a}px, ${b}px ${b}px${extra ? ', 100% 100%' : ''}`;
  return [
    `-webkit-mask-image: ${image};`,
    `mask-image: ${image};`,
    `-webkit-mask-size: ${size};`,
    `mask-size: ${size};`,
    '-webkit-mask-composite: source-in;',
    'mask-composite: intersect;',
  ];
}

// Slow change across the page: full strength at one end, `to` alpha at the other, over the whole element.
// Like the fade it only lowers alpha, so the worst case for text stays the full-strength end.
export type ChangeDir = 'none' | 'down' | 'up' | 'across';
export const CHANGE_DIRS: readonly ChangeDir[] = ['none', 'down', 'up', 'across'];
export const CHANGE_MIN = 0.2;
export const CHANGE_MAX = 0.8;
const TOWARD = { down: 'to bottom', up: 'to top', across: 'to right' } as const;

export function changeMask(dir: Exclude<ChangeDir, 'none'>, to: number): string {
  const a = Math.min(CHANGE_MAX, Math.max(CHANGE_MIN, to));
  return `linear-gradient(${TOWARD[dir]}, rgb(0 0 0 / 1), rgb(0 0 0 / ${a}))`;
}
