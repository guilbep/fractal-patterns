// The Color symmetry tile (loaded on demand with the Farris modules): the bands document of a symmetry kind.
import { farrisGrid } from '@/patterns/farris.ts';
import { bandsDocument, bandsSvg } from '@/patterns/farris-bands.ts';

// The last 8 tiles, so dragging an unrelated control does not rebuild the field.
const cache = new Map<string, string>();

/** h: the tile height (size for square kinds, size·√3 for hex kinds). */
export function bandsTile(
  group: string,
  seed: number,
  size: number,
  h: number,
  colors: readonly string[],
  s: { waves: number; detail: number; balance: boolean },
): string {
  const key = [group, seed, s.waves, s.detail, s.balance, size, h, ...colors].join();
  let doc = cache.get(key);
  if (doc === undefined) {
    const { body } = bandsSvg(farrisGrid({ group, seed, waves: s.waves, detail: s.detail }, 64), { colors, size, balance: s.balance });
    // A hex kind's field is sampled squeezed into the square: stretch it back to size x h.
    doc =
      h === size
        ? bandsDocument(body, size)
        : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${h}" width="${size}" height="${h}"><g transform="scale(1 ${h / size})">${body}</g></svg>`;
    cache.set(key, doc);
    if (cache.size > 8) cache.delete(cache.keys().next().value!);
  }
  return doc;
}
