export type RGB = readonly [number, number, number];
export type Level = 'AAA' | 'AA' | 'fail';

export function parseHex(hex: string): RGB {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!m?.[1]) throw new Error(`Invalid hex color: ${hex}`);
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex(rgb: RGB): string {
  return '#' + rgb.map((v) => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

export function relativeLuminance(hex: string): number {
  const lin = (v: number): number => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = parseHex(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function blend(fg: string, bg: string, alpha: number): string {
  const a = Math.min(1, Math.max(0, alpha));
  const [fr, fg2, fb] = parseHex(fg);
  const [br, bg2, bb] = parseHex(bg);
  const mix = (f: number, b: number): number => f * a + b * (1 - a);
  return toHex([mix(fr, br), mix(fg2, bg2), mix(fb, bb)]);
}

export function textLevel(ratio: number, large = false): Level {
  if (ratio >= (large ? 4.5 : 7)) return 'AAA';
  if (ratio >= (large ? 3 : 4.5)) return 'AA';
  return 'fail';
}

export function passesNonText(ratio: number): boolean {
  return ratio >= 3;
}
