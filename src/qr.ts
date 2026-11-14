/*
 * QR Code generator, byte mode, error correction L and M.
 *
 * Ported and reduced from Project Nayuki's "QR Code generator library"
 * (TypeScript, version 1.8.0), https://www.nayuki.io/page/qr-code-generator-library
 * The alignment step uses the single formula of later upstream code, which
 * gives the same positions as 1.8.0 (including its version 32 special case).
 *
 * Copyright (c) Project Nayuki. (MIT License)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 * - The above copyright notice and this permission notice shall be included in
 *   all copies or substantial portions of the Software.
 * - The Software is provided "as is", without warranty of any kind, express or
 *   implied, including but not limited to the warranties of merchantability,
 *   fitness for a particular purpose and noninfringement. In no event shall the
 *   authors or copyright holders be liable for any claim, damages or other
 *   liability, whether in an action of contract, tort or otherwise, arising from,
 *   out of or in connection with the Software or the use or other dealings in the
 *   Software.
 */

export type QrEcc = 'L' | 'M';

// Indexed by version (index 0 unused).
const ECC_PER_BLOCK: Record<QrEcc, number[]> = {
  L: [
    -1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30,
    30, 30, 30, 30, 30, 30, 30,
  ],
  M: [
    -1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
    28, 28, 28, 28, 28, 28, 28,
  ],
};
const NUM_BLOCKS: Record<QrEcc, number[]> = {
  L: [
    -1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24,
    25,
  ],
  M: [
    -1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40,
    43, 45, 47, 49,
  ],
};
const FORMAT_BITS: Record<QrEcc, number> = { L: 1, M: 0 };

const bit = (x: number, i: number): boolean => ((x >>> i) & 1) !== 0;

function rawDataModules(ver: number): number {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}

const dataCodewords = (ver: number, ecc: QrEcc): number =>
  Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ecc][ver]! * NUM_BLOCKS[ecc][ver]!;

/** Largest number of bytes that fit the given version in byte mode. */
export function qrByteCapacity(ver: number, ecc: QrEcc = 'M'): number {
  return Math.floor((dataCodewords(ver, ecc) * 8 - 4 - (ver < 10 ? 8 : 16)) / 8);
}

// Reed-Solomon over GF(2^8/0x11D).
function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree: number): number[] {
  const r = Array.from({ length: degree }, () => 0);
  r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      r[j] = gfMul(r[j]!, root);
      if (j + 1 < degree) r[j]! ^= r[j + 1]!;
    }
    root = gfMul(root, 2);
  }
  return r;
}

function rsRemainder(data: number[], div: number[]): number[] {
  const r = div.map(() => 0);
  for (const b of data) {
    const f = b ^ (r.shift() as number);
    r.push(0);
    div.forEach((c, i) => (r[i]! ^= gfMul(c, f)));
  }
  return r;
}

export function qrMatrix(text: string, ecc: QrEcc = 'M'): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  let ver = 1;
  while (ver <= 40 && bytes.length > qrByteCapacity(ver, ecc)) ver++;
  if (ver > 40) throw new RangeError('This link is too long for a QR code.');

  // Data bits: byte mode, count, bytes, terminator, padding.
  const bits: number[] = [];
  const put = (v: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1);
  };
  put(4, 4);
  put(bytes.length, ver < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  const cap = dataCodewords(ver, ecc) * 8;
  put(0, Math.min(4, cap - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let p = 0xec; bits.length < cap; p ^= 0xec ^ 0x11) put(p, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));

  // Split into blocks, add ECC, interleave.
  const numBlocks = NUM_BLOCKS[ecc][ver]!;
  const eccLen = ECC_PER_BLOCK[ecc][ver]!;
  const raw = Math.floor(rawDataModules(ver) / 8);
  const numShort = numBlocks - (raw % numBlocks);
  const shortLen = Math.floor(raw / numBlocks);
  const div = rsDivisor(eccLen);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
    k += dat.length;
    const e = rsRemainder(dat, div);
    if (i < numShort) dat.push(0);
    blocks.push(dat.concat(e));
  }
  const codewords: number[] = [];
  for (let i = 0; i < blocks[0]!.length; i++)
    blocks.forEach((b, j) => {
      if (i !== shortLen - eccLen || j >= numShort) codewords.push(b[i]!);
    });

  // Function patterns.
  const size = ver * 4 + 17;
  const m: boolean[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => false));
  const fn: boolean[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => false));
  const set = (x: number, y: number, dark: boolean) => {
    m[y]![x] = dark;
    fn[y]![x] = true;
  };
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ] as [number, number][])
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
      }
  const align: number[] = [];
  if (ver > 1) {
    const n = Math.floor(ver / 7) + 2;
    const step = Math.floor((ver * 8 + n * 3 + 5) / (n * 4 - 4)) * 2;
    align.push(6);
    for (let pos = size - 7; align.length < n; pos -= step) align.splice(1, 0, pos);
  }
  const last = align.length - 1;
  align.forEach((ax, i) =>
    align.forEach((ay, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }),
  );
  const drawFormat = (mask: number) => {
    const d = (FORMAT_BITS[ecc] << 3) | mask;
    let r = d;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412;
    for (let i = 0; i <= 5; i++) set(8, i, bit(b, i));
    set(8, 7, bit(b, 6));
    set(8, 8, bit(b, 7));
    set(7, 8, bit(b, 8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(b, i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(b, i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(b, i));
    set(8, size - 8, true);
  };
  drawFormat(0); // reserve the area; redrawn with the real mask below
  if (ver >= 7) {
    let r = ver;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const b = (ver << 12) | r;
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const c = Math.floor(i / 3);
      set(a, c, bit(b, i));
      set(c, a, bit(b, i));
    }
  }

  // Codewords in the zigzag order.
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < size; v++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? size - 1 - v : v;
        if (!fn[y]![x]! && i < codewords.length * 8) {
          m[y]![x] = bit(codewords[i >>> 3]!, 7 - (i & 7));
          i++;
        }
      }
  }

  const applyMask = (mask: number) => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        let inv: boolean;
        switch (mask) {
          case 0:
            inv = (x + y) % 2 === 0;
            break;
          case 1:
            inv = y % 2 === 0;
            break;
          case 2:
            inv = x % 3 === 0;
            break;
          case 3:
            inv = (x + y) % 3 === 0;
            break;
          case 4:
            inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
            break;
          case 5:
            inv = ((x * y) % 2) + ((x * y) % 3) === 0;
            break;
          case 6:
            inv = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
            break;
          default:
            inv = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
        }
        if (!fn[y]![x]! && inv) m[y]![x] = !m[y]![x]!;
      }
  };

  // Finder-like run penalty helpers (Nayuki 1.8.0).
  const countPatterns = (h: number[]): number => {
    const [h0, n, h2, h3, h4, h5, h6] = h as [number, number, number, number, number, number, number];
    const core = n > 0 && h2 === n && h3 === n * 3 && h4 === n && h5 === n;
    return (core && h0 >= n * 4 && h6 >= n ? 1 : 0) + (core && h6 >= n * 4 && h0 >= n ? 1 : 0);
  };
  const addHistory = (len: number, h: number[]) => {
    if (h[0] === 0) len += size; // light border before the first run
    h.pop();
    h.unshift(len);
  };
  const lineScore = (get: (a: number, b: number) => boolean): number => {
    let s = 0;
    for (let a = 0; a < size; a++) {
      let color = false;
      let run = 0;
      const h = [0, 0, 0, 0, 0, 0, 0];
      for (let b = 0; b < size; b++) {
        if (get(a, b) === color) {
          run++;
          if (run === 5) s += 3;
          else if (run > 5) s++;
        } else {
          addHistory(run, h);
          if (!color) s += countPatterns(h) * 40;
          color = get(a, b);
          run = 1;
        }
      }
      if (color) {
        addHistory(run, h);
        run = 0;
      }
      addHistory(run + size, h);
      s += countPatterns(h) * 40;
    }
    return s;
  };
  const penalty = (): number => {
    let s = lineScore((y, x) => m[y]![x]!) + lineScore((x, y) => m[y]![x]!);
    let dark = 0;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        if (m[y]![x]!) dark++;
        if (y < size - 1 && x < size - 1) {
          const c = m[y]![x]!;
          if (c === m[y]![x + 1]! && c === m[y + 1]![x]! && c === m[y + 1]![x + 1]!) s += 3;
        }
      }
    const total = size * size;
    return s + (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  };

  let best = 0;
  let min = Infinity;
  for (let k = 0; k < 8; k++) {
    applyMask(k);
    drawFormat(k);
    const p = penalty();
    if (p < min) {
      best = k;
      min = p;
    }
    applyMask(k); // undo (xor)
  }
  applyMask(best);
  drawFormat(best);
  return m;
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function qrSvg(text: string, opts: { ecc?: QrEcc; quiet?: number; dark?: string; light?: string; title?: string } = {}): string {
  const { ecc = 'M', quiet = 4, dark = '#000', light = '#fff', title } = opts;
  const m = qrMatrix(text, ecc);
  const n = m.length + 2 * quiet;
  let d = '';
  m.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!row[x]) continue;
      let w = 1;
      while (row[x + w]) w++;
      d += `M${x + quiet} ${y + quiet}h${w}v1h-${w}z`;
      x += w - 1;
    }
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" role="img" shape-rendering="crispEdges">` +
    (title ? `<title>${esc(title)}</title>` : '') +
    `<rect width="${n}" height="${n}" fill="${esc(light)}"/>` +
    `<path d="${d}" fill="${esc(dark)}"/></svg>`
  );
}
