// Writes public/favicon.svg (the Truchet tile), public/favicon-studio.svg and public/favicon-builder.svg, or with `candidates` a contact sheet to pick the mark from
// (to the path given as the next argument, or ./candidates.svg).
import { mkdirSync, writeFileSync } from 'node:fs';
import { LOGO_DEFAULT, MARK_COLORS, builderLogoSvg, logoSvg, studioLogoSvg, truchetLogoSvg } from '../src/logo.ts';
import type { Kind } from '../src/fractal.ts';

const KINDS: Kind[] = ['p4', 'p4m', 'p4g', 'cmm', 'pmm', 'whirl', 'rosette', 'hilbert', 'sierpinski', 'carpet', 'hex', 'herringbone'];
const SEEDS = [1, 2, 3];

if (process.argv[2] === 'candidates') {
  const sheet = process.argv[3] ?? 'candidates.svg';
  const cells = KINDS.flatMap((kind) => SEEDS.map((seed) => ({ kind, seed })));
  const cols = 6;
  const w = 150;
  const h = 100;
  const body = cells
    .map(({ kind, seed }, i) => {
      const x = (i % cols) * w;
      const y = Math.floor(i / cols) * h;
      const href = `data:image/svg+xml;base64,${Buffer.from(logoSvg({ ...LOGO_DEFAULT, kind, seed })).toString('base64')}`;
      return (
        `<image x="${x + 8}" y="${y + 8}" width="64" height="64" href="${href}"/>` +
        `<image x="${x + 80}" y="${y + 32}" width="16" height="16" href="${href}"/>` +
        `<text x="${x + 8}" y="${y + 90}" font-family="sans-serif" font-size="11">${kind} ${seed}</text>`
      );
    })
    .join('\n');
  const rows = Math.ceil(cells.length / cols);
  writeFileSync(
    sheet,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * w}" height="${rows * h}"><rect width="100%" height="100%" fill="#fff"/>\n${body}\n</svg>\n`,
  );
  console.log(`wrote ${sheet} (${cells.length} candidates)`);
} else {
  mkdirSync(new URL('../public/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../public/favicon.svg', import.meta.url), truchetLogoSvg() + '\n');
  writeFileSync(new URL('../public/favicon-studio.svg', import.meta.url), studioLogoSvg(MARK_COLORS) + '\n');
  writeFileSync(new URL('../public/favicon-builder.svg', import.meta.url), builderLogoSvg(MARK_COLORS) + '\n');
  console.log('wrote public/favicon.svg, public/favicon-studio.svg and public/favicon-builder.svg');
}
