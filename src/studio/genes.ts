// Studio genes: named handles on the composer's and the motifs' random draws. A gene is a value from 0 to 15, or
// absent. Absent: the draw is what the seed gives today, so a link without genes opens the same wallpaper as before.
// Set: the draw is kept (the random stream stays aligned) but confined to one of 16 bands of its range, so the trait
// follows the gene while each motif still varies a little inside the band.
// The link key g holds them: 20 bits of presence mask, then 4 bits per present gene, in base64url.

export const GENES = [
  { id: 'branchAngle', label: 'Branch angle' },
  { id: 'branchLength', label: 'Branch length' },
  { id: 'stemCurl', label: 'Stem curl' },
  { id: 'motifMix', label: 'Motif mix' },
  { id: 'colorRoles', label: 'Color roles' },
  { id: 'leafWidth', label: 'Leaf width' },
  { id: 'leafBend', label: 'Leaf bend' },
  { id: 'leafVeins', label: 'Leaf veins' },
  { id: 'frondPairs', label: 'Frond pairs' },
  { id: 'frondSpread', label: 'Frond spread' },
  { id: 'petals', label: 'Petals' },
  { id: 'petalWidth', label: 'Petal width' },
  { id: 'budOpen', label: 'Bud opening' },
  { id: 'berries', label: 'Berries' },
  { id: 'sprigLeaves', label: 'Sprig leaves' },
  { id: 'sprigFan', label: 'Sprig fan' },
  { id: 'kelpWave', label: 'Kelp wave' },
  { id: 'coralSpread', label: 'Coral spread' },
  { id: 'fruitWidth', label: 'Fruit width' },
  { id: 'appleDip', label: 'Apple dip' },
] as const;

export type GeneId = (typeof GENES)[number]['id'];
export type Genes = Readonly<Partial<Record<GeneId, number>>>;
export const NO_GENES: Genes = Object.freeze({});
export const GENE_MAX = 15;

/** A draw r in [0, 1) confined to band g of 16 (g absent: r unchanged). */
export const band = (r: number, g: number | undefined): number => (g === undefined ? r : (g + r) / 16);

export const geneCount = (g: Genes): number => GENES.filter((x) => g[x.id] !== undefined).length;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** '' when no gene is set. */
export function encodeGenes(g: Genes): string {
  const bits: number[] = [];
  const push = (v: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1);
  };
  let mask = 0;
  GENES.forEach((x, i) => {
    if (g[x.id] !== undefined) mask |= 1 << i;
  });
  if (mask === 0) return '';
  push(mask, GENES.length);
  for (const x of GENES) if (g[x.id] !== undefined) push(Math.min(GENE_MAX, Math.max(0, Math.round(g[x.id]!))), 4);
  while (bits.length % 6) bits.push(0);
  let out = '';
  for (let i = 0; i < bits.length; i += 6) out += B64[bits.slice(i, i + 6).reduce((a, b) => a * 2 + b, 0)];
  return out;
}

/** Never throws: anything malformed gives no genes. */
export function decodeGenes(text: string | null): Genes {
  if (!text || !/^[A-Za-z0-9_-]+$/.test(text)) return NO_GENES;
  const bits = [...text].flatMap((c) => {
    const v = B64.indexOf(c);
    return [5, 4, 3, 2, 1, 0].map((i) => (v >> i) & 1);
  });
  let at = 0;
  const read = (n: number): number | null => {
    if (at + n > bits.length) return null;
    let v = 0;
    for (let i = 0; i < n; i++) v = v * 2 + bits[at++]!;
    return v;
  };
  const mask = read(GENES.length);
  if (mask === null) return NO_GENES;
  const out: Partial<Record<GeneId, number>> = {};
  for (let i = 0; i < GENES.length; i++) {
    if (!(mask & (1 << i))) continue;
    const v = read(4);
    if (v === null) return NO_GENES;
    out[GENES[i]!.id] = v;
  }
  return out;
}
