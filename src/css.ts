// SVG to CSS background. Minimal escaping keeps the data URI short and safe inside url("…").

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
