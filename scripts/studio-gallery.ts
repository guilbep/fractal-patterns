// Writes the Studio gallery: public/gallery/studio.json (one entry per filled cell: its descriptors, the design's link
// and its tracking score) and public/gallery/studio/<n>.svg (the design's tile, a static thumbnail). Seeded, so a
// second run writes the same files. Run: make gallery.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { mulberry32 } from '../src/patterns/util.ts';
import { mapElites } from '../src/studio/gallery.ts';

const t0 = performance.now();
const elites = mapElites({ rnd: mulberry32(20261114), initial: 120, iterations: 600 });
const dir = new URL('../public/gallery/', import.meta.url);
rmSync(new URL('studio/', dir), { recursive: true, force: true });
mkdirSync(new URL('studio/', dir), { recursive: true });
const entries = elites.map((e, i) => {
  const thumb = `gallery/studio/${i}.svg`;
  writeFileSync(new URL(`studio/${i}.svg`, dir), e.svg + '\n');
  return { ...e.cell, link: `studio.html#${e.link}`, score: Math.round(e.score * 100) / 100, thumb, bytes: e.svg.length };
});
writeFileSync(new URL('studio.json', dir), JSON.stringify({ cells: entries }, null, 1) + '\n');
console.log(`wrote ${entries.length} cells to public/gallery in ${Math.round(performance.now() - t0)} ms`);
