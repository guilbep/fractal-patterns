// Pure helpers for the export panels: a safe file name and the CSS for a seamless tile.
import { svgToDataUri } from './css.ts';

export function safeFileName(name: string, fallback = 'pattern'): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return s || fallback;
}

// Whole or one-decimal pixels: 240 -> "240", 100.25 -> "100.3".
const px = (n: number) => `${Math.round(n * 10) / 10}px`;

export function tileCss(svg: string, cellWidth: number, cellHeight: number, background: string | null): string {
  const lines = [`background-image: url("${svgToDataUri(svg)}");`, `background-size: ${px(cellWidth)} ${px(cellHeight)};`];
  if (background !== null) lines.unshift(`background-color: ${background};`);
  return lines.join('\n');
}
