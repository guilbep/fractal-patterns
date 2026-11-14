import type { Pt } from './util.ts';

export type TilingId = 'square' | 'hex' | '488' | '3636' | '4612';

export const TILING_LABELS: Record<TilingId, string> = {
  square: '4.4.4.4 squares',
  hex: '6.6.6 hexagons',
  '488': '4.8.8 octagons and squares',
  '3636': '3.6.3.6 hexagons and triangles',
  '4612': '4.6.12 dodecagons, hexagons and squares',
};

// A seed is a regular n-gon: center, side count, angle of its first vertex.
type Seed = readonly [x: number, y: number, n: number, angle: number];

const S3 = Math.sqrt(3);
const { PI } = Math;

// Lattice constant L; hexagonal tilings use the period L × L√3 (two lattice cells), as HEX_ASPECT does.
function spec(id: TilingId): { L: number; hexagonal: boolean; seeds: Seed[] } {
  switch (id) {
    case 'square':
      return { L: 1, hexagonal: false, seeds: [[0.5, 0.5, 4, PI / 4]] };
    case '488': {
      const L = 1 + Math.SQRT2;
      return {
        L,
        hexagonal: false,
        seeds: [
          [0, 0, 8, PI / 8],
          [L / 2, L / 2, 4, 0],
        ],
      };
    }
    case 'hex':
      return { L: S3, hexagonal: true, seeds: [[0, 0, 6, PI / 6]] };
    case '3636':
      return {
        L: 2,
        hexagonal: true,
        seeds: [
          [0, 0, 6, 0],
          [1, S3 / 3, 3, -PI / 2],
          [2, (2 * S3) / 3, 3, PI / 2],
        ],
      };
    case '4612': {
      const L = 3 + S3;
      const [bx, by] = [L / 2, (L * S3) / 2];
      return {
        L,
        hexagonal: true,
        seeds: [
          [0, 0, 12, PI / 12],
          [L / 2, 0, 4, PI / 4],
          [bx / 2, by / 2, 4, PI / 4 + PI / 3],
          [(bx - L) / 2, by / 2, 4, PI / 4 + (2 * PI) / 3],
          [(L + bx) / 3, by / 3, 6, 0],
          [(2 * (L + bx)) / 3, (2 * by) / 3, 6, 0],
        ],
      };
    }
  }
}

function regular([cx, cy, n, a]: Seed): Pt[] {
  const r = 1 / (2 * Math.sin(PI / n));
  return Array.from({ length: n }, (_, k): Pt => [cx + r * Math.cos(a + (2 * PI * k) / n), cy + r * Math.sin(a + (2 * PI * k) / n)]);
}

export function tiling(id: TilingId): { width: number; height: number; polygons: Pt[][] } {
  const { L, hexagonal, seeds } = spec(id);
  const width = L;
  const height = hexagonal ? L * S3 : L;
  const b: Pt = hexagonal ? [L / 2, (L * S3) / 2] : [0, L];
  // Centers on the boundary go to the low side; eps absorbs float noise.
  const eps = 1e-9;
  const inside = (x: number, y: number) => x >= -eps && x < width - eps && y >= -eps && y < height - eps;
  const polygons: Pt[][] = [];
  for (const [sx, sy, n, a] of seeds)
    for (let j = -3; j <= 3; j++)
      for (let i = -3; i <= 3; i++) {
        const x = sx + i * L + j * b[0];
        const y = sy + j * b[1];
        if (inside(x, y)) polygons.push(regular([x, y, n, a]));
      }
  return { width, height, polygons };
}
