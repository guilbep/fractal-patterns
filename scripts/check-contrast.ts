// Prints the contrast ratios of the color tokens in src/css/app.css (light and dark :root blocks) and exits 1 when a pair is under its threshold.
import { readFileSync } from 'node:fs';
import { contrastRatio } from '../src/contrast.ts';

const css = readFileSync(new URL('../src/css/app.css', import.meta.url), 'utf8');

function tokens(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{3,6})\s*;/gi)].map((m) => [m[1], m[2]]));
}

const light = tokens(/:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '');
const darkMedia = /@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
const dark = { ...light, ...tokens(darkMedia) };

type Pair = [fg: string, bg: string, min: number];
const grounds = ['page', 'surface', 'sunk'];
const pairs: Pair[] = [
  ...['ink', 'muted', 'accent', 'pass', 'fail', 'warn'].flatMap((fg) => grounds.map((bg): Pair => [fg, bg, 4.5])),
  ['accent-ink', 'accent', 4.5],
  ...grounds.map((bg): Pair => ['line', bg, 3]),
  ['accent', 'page', 3],
  ['accent', 'surface', 3],
  ...grounds.map((bg): Pair => ['hairline', bg, 0]), // decorative divider: listed, exempt
];

let failed = 0;
console.log('pair                    min   light   dark');
for (const [fg, bg, min] of pairs) {
  const cells = [light, dark].map((t) => {
    const a = t[fg];
    const b = t[bg];
    if (!a || !b) throw new Error(`Missing token --${!a ? fg : bg}`);
    const r = contrastRatio(a, b);
    const bad = r < min;
    if (bad) failed++;
    return `${r.toFixed(2).padStart(5)}${bad ? '!' : ' '}`;
  });
  const label = `${fg} / ${bg}`.padEnd(22);
  console.log(`${label}  ${min ? min.toFixed(1) : 'n/a'}  ${cells.join('  ')}`);
}
console.log(failed ? `${failed} pair(s) under threshold (marked !)` : 'All pairs pass.');
process.exit(failed ? 1 : 0);
