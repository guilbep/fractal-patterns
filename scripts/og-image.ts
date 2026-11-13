// Writes public/og.svg (1200 x 630 social image) from the Penrose generator. Convert to PNG on macOS with:
//   sips -s format png public/og.svg --out public/og.png
import { writeFileSync } from 'node:fs';
import { patchSvg, penrosePatch } from '../src/penrose.ts';

const W = 1200;
const H = 630;
const tile = patchSvg(penrosePatch(7, 7), {
  size: 1500,
  strokeWidth: 2.5,
  precision: 0,
  color: '#9fb2ff',
  opacity: 0.55,
  decorate: 'both',
});
const backdrop = tile.replace('<svg ', `<svg x="-150" y="${(H - 1500) / 2}" `);
const font = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#12172b"/>
${backdrop}
<rect x="150" y="185" width="900" height="260" rx="16" fill="#fbfcfb" stroke="#2e46a8" stroke-width="4"/>
<text x="600" y="300" text-anchor="middle" font-family="${font}" font-size="84" font-weight="700" fill="#18201d">Fractal Patterns</text>
<text x="600" y="375" text-anchor="middle" font-family="${font}" font-size="34" fill="#2e46a8">SVG background patterns from math or your own image</text>
</svg>
`;
writeFileSync(new URL('../public/og.svg', import.meta.url), svg);
console.log('wrote public/og.svg');
