// SVG to CSS background. Minimal escaping keeps the data URI short and safe inside url("…").
import { parseHex } from './contrast.ts';

export function svgToDataUri(svg: string): string {
  // Order matters: '%' before '#', '<', '>' so their escapes are not escaped again.
  const body = svg
    .replaceAll('"', "'")
    .replaceAll('%', '%25')
    .replaceAll('#', '%23')
    .replaceAll('<', '%3C')
    .replaceAll('>', '%3E');
  return `data:image/svg+xml,${body}`;
}

export function cssBackground(svg: string, background: string): string {
  return `background-color: ${background};\nbackground-image: url("${svgToDataUri(svg)}");`;
}

export interface PlateStyle {
  readonly opacity: number;
  readonly radius: number; // px
  readonly blur: number; // px
}

export function cssPlate(background: string, s: PlateStyle): string {
  const [r, g, b] = parseHex(background);
  const lines = [
    '.fp-plate {',
    `  background-color: rgb(${r} ${g} ${b} / ${Number(s.opacity.toFixed(2))});`,
    `  border-radius: ${s.radius}px;`,
    '  padding: 1rem;',
  ];
  if (s.blur > 0) lines.push(`  backdrop-filter: blur(${s.blur}px);`, `  -webkit-backdrop-filter: blur(${s.blur}px);`);
  return [...lines, '}'].join('\n');
}
