// Cubic chains -> compact SVG path data. Apart from the curve fitting in curvefit.ts, so the built-in motifs can
// draw their curves without loading the fitting code.
import type { Pt } from './patterns/util.ts';

export type Cubic = readonly [Pt, Pt, Pt, Pt];

const same = (a: Pt, b: Pt) => a[0] === b[0] && a[1] === b[1];

// Same number rule as pathData in scene.ts (copied, it is not exported).
function num(n: number, precision: number): string {
  let s = n.toFixed(precision);
  if (s.includes('.')) s = s.replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

// Absolute M, then relative c (one letter per sub-path, repeated numbers after it), Z when the chain closes.
export function curvePathData(chains: readonly Cubic[][], precision: number): string {
  const f = 10 ** precision;
  const r = (v: number) => Math.round(v * f) / f;
  const nums = (ns: number[]) =>
    ns.reduce((acc, n, i) => {
      const s = num(n, precision);
      return acc + (i > 0 && !s.startsWith('-') ? ' ' : '') + s;
    }, '');
  let d = '';
  for (const chain of chains) {
    const first = chain[0];
    if (!first) continue;
    let start: Pt = [r(first[0][0]), r(first[0][1])];
    d += 'M' + nums([...start]);
    const ns: number[] = [];
    for (const c of chain) {
      if (!same([r(c[0][0]), r(c[0][1])], start) && ns.length) {
        // A gap inside a chain: a new sub-path.
        d += 'c' + nums(ns);
        ns.length = 0;
        start = [r(c[0][0]), r(c[0][1])];
        d += 'M' + nums([...start]);
      }
      for (const p of [c[1], c[2], c[3]]) ns.push(r(r(p[0]) - start[0]), r(r(p[1]) - start[1]));
      start = [r(c[3][0]), r(c[3][1])];
    }
    d += 'c' + nums(ns);
    const last = chain[chain.length - 1]!;
    if (chain.length > 1 && same(last[3], first[0])) d += 'Z';
  }
  return d;
}
