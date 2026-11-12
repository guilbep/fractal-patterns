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
export function fadeMask(tileSize: number): string[] {
  const [a, b] = fadeSizes(tileSize);
  const g = (at: string) => `radial-gradient(circle at ${at}, rgb(0 0 0 / 1), rgb(0 0 0 / ${ALPHA_MIN}))`;
  const image = `${g('50% 50%')}, ${g('30% 70%')}`;
  const size = `${a}px ${a}px, ${b}px ${b}px`;
  return [
    `-webkit-mask-image: ${image};`,
    `mask-image: ${image};`,
    `-webkit-mask-size: ${size};`,
    `mask-size: ${size};`,
    '-webkit-mask-composite: source-in;',
    'mask-composite: intersect;',
  ];
}
