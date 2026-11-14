// Islamic star patterns by Hankin's "polygons in contact" method on the periodic tilings.

import { tiling, type TilingId } from './tilings.ts';
import type { Generator, Poly, Pt } from './util.ts';

export const DEFAULT_CONTACT_ANGLE = 60;

// One closed polyline per polygon: edge midpoint, Hankin point near the next vertex, next midpoint, ...
// The ray from midpoint i leaning to vertex i+1 meets the ray from midpoint i+1 leaning back to it.
export function hankinPolygon(poly: readonly Pt[], angleDeg: number): Pt[] {
  const n = poly.length;
  const t = (angleDeg * Math.PI) / 180;
  const [c, s] = [Math.cos(t), Math.sin(t)];
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = poly[i]!;
    const [bx, by] = poly[(i + 1) % n]!;
    area += ax * by - bx * ay;
  }
  // Inward normal is the left side for counter-clockwise order; the sign keeps it right either way.
  const side = Math.sign(area) || 1;
  const edge = (i: number) => {
    const [ax, ay] = poly[i % n]!;
    const [bx, by] = poly[(i + 1) % n]!;
    const len = Math.hypot(bx - ax, by - ay);
    const d: Pt = [(bx - ax) / len, (by - ay) / len];
    return { m: [(ax + bx) / 2, (ay + by) / 2] as Pt, d, nrm: [-side * d[1], side * d[0]] as Pt };
  };
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const e = edge(i);
    const f = edge(i + 1);
    const u: Pt = [c * e.d[0] + s * e.nrm[0], c * e.d[1] + s * e.nrm[1]];
    const v: Pt = [-c * f.d[0] + s * f.nrm[0], -c * f.d[1] + s * f.nrm[1]];
    const det = u[0] * -v[1] + v[0] * u[1];
    let p: Pt;
    // Parallel rays (a square at 45 degrees) lie on one line: meet halfway between the midpoints.
    if (Math.abs(det) < 1e-12) p = [(e.m[0] + f.m[0]) / 2, (e.m[1] + f.m[1]) / 2];
    else {
      const [rx, ry] = [f.m[0] - e.m[0], f.m[1] - e.m[1]];
      const k = (rx * -v[1] + v[0] * ry) / det;
      p = [e.m[0] + k * u[0], e.m[1] + k * u[1]];
    }
    out.push(e.m, p);
  }
  out.push(out[0]!);
  return out;
}

function hankinPolys(tilingId: TilingId, angleDeg: number) {
  const { width, height, polygons } = tiling(tilingId);
  return { width, height, polys: polygons.map((p) => hankinPolygon(p, angleDeg)) };
}

export function hankinSegments(tilingId: TilingId, angleDeg: number): { width: number; height: number; segments: [Pt, Pt][] } {
  const { width, height, polys } = hankinPolys(tilingId, angleDeg);
  const segments: [Pt, Pt][] = [];
  for (const p of polys) for (let i = 1; i < p.length; i++) segments.push([p[i - 1]!, p[i]!]);
  return { width, height, segments };
}

// cells = depth periods per tile edge; hexagonal periods (height = width * sqrt 3) are squeezed
// by 1 / sqrt 3 vertically so the tile is size by size for wrap(), as hexWallpaper does.
// ponytail: one closed polyline per polygon; joining collinear rays across polygons would save more bytes.
export function starGeneratorAt(tilingId: TilingId, angleDeg: number): Generator {
  return (_rnd, depth, size) => {
    const cells = Math.min(3, Math.max(1, Math.floor(depth) || 1));
    const { width, height, polys } = hankinPolys(tilingId, angleDeg);
    const kx = size / (cells * width);
    const ky = size / (cells * height);
    const out: Poly[] = [];
    for (let i = 0; i < cells; i++)
      for (let j = 0; j < cells; j++) for (const p of polys) out.push(p.map(([x, y]): Pt => [(x + i * width) * kx, (y + j * height) * ky]));
    return out;
  };
}

export const starGenerator = (tilingId: TilingId, angleDeg = DEFAULT_CONTACT_ANGLE): Generator => starGeneratorAt(tilingId, angleDeg);
