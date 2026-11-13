// The "Use it" table: where a tile goes, at which size, and as which file.
// Pure data and helpers, shared by the three pages.

export type Output = 'png' | 'svg' | 'css';

export interface Preset {
  readonly id: string;
  readonly label: string;
  readonly width?: number;
  readonly height?: number;
  readonly detect?: 'phone' | 'screen';
  readonly custom?: boolean;
  readonly output: Output;
}

export interface Destination {
  readonly id: 'phone' | 'desktop' | 'web' | 'call' | 'fabric' | 'paper' | 'game' | 'slides';
  readonly label: string;
  /** A short muted line under the label on the card. */
  readonly hint: string;
  readonly howTo: string;
  readonly presets: readonly Preset[];
  readonly clockOption?: boolean;
}

export const DESTINATIONS: readonly Destination[] = [
  {
    id: 'phone',
    label: 'Phone wallpaper',
    hint: 'Lock and home screen',
    howTo: 'Save the image, then open Settings, Wallpaper, Add New Wallpaper, and choose it from Photos.',
    clockOption: true,
    presets: [
      { id: 'this-phone', label: 'This phone (detected)', detect: 'phone', output: 'png' },
      { id: 'iphone-17', label: 'iPhone 17 Pro · 17 · 16 Pro', width: 1206, height: 2622, output: 'png' },
      { id: 'iphone-17-max', label: 'iPhone 17 Pro Max · 16 Pro Max', width: 1320, height: 2868, output: 'png' },
      { id: 'custom', label: 'Custom size…', custom: true, output: 'png' },
    ],
  },
  {
    id: 'desktop',
    label: 'Desktop wallpaper',
    hint: 'Mac, Windows, Linux',
    howTo:
      'Save the image, then open System Settings, Wallpaper, and drag the file in. On a PC, right-click it and pick Set as desktop background.',
    presets: [
      { id: 'this-screen', label: 'This screen (detected)', detect: 'screen', output: 'png' },
      { id: 'mbp-14', label: 'MacBook Pro 14″', width: 3024, height: 1964, output: 'png' },
      { id: 'mbp-16', label: 'MacBook Pro 16″', width: 3456, height: 2234, output: 'png' },
      { id: 'mba-13', label: 'MacBook Air 13″', width: 2560, height: 1664, output: 'png' },
      { id: 'mba-15', label: 'MacBook Air 15″', width: 2880, height: 1864, output: 'png' },
      { id: '4k', label: '4K', width: 3840, height: 2160, output: 'png' },
      { id: 'full-hd', label: 'Full HD', width: 1920, height: 1080, output: 'png' },
      { id: 'custom', label: 'Custom size…', custom: true, output: 'png' },
    ],
  },
  {
    id: 'web',
    label: 'Website background',
    hint: 'CSS, a few kB',
    howTo: 'Copy the CSS and paste it into your stylesheet. The tile repeats by itself, so the file stays small.',
    presets: [
      { id: 'repeat', label: 'Repeating CSS', output: 'css' },
      { id: 'hero', label: 'Hero only', output: 'css' },
    ],
  },
  {
    id: 'call',
    label: 'Video call background',
    hint: 'Zoom, Teams, Meet',
    howTo: 'Save the image, then open the background settings in Zoom, Teams or Meet and upload it.',
    presets: [{ id: 'full-hd', label: '1920×1080', width: 1920, height: 1080, output: 'png' }],
  },
  {
    id: 'fabric',
    label: 'Clothing & fabric',
    hint: 'T-shirt, pyjamas, cushions',
    howTo: 'Upload the tile to a print-on-demand shop and choose a repeat print. The edges match, so no seams show.',
    presets: [
      { id: 'tile-20cm', label: 'Tile 20 cm at 150 dpi', width: 1181, height: 1181, output: 'png' },
      { id: 'tile-10cm', label: 'Tile 10 cm at 300 dpi', width: 1181, height: 1181, output: 'png' },
      { id: 'svg', label: 'SVG', output: 'svg' },
    ],
  },
  {
    id: 'paper',
    label: 'Paper & gift wrap',
    hint: 'Wall, A4, A3',
    howTo: 'Print the sheet at 100 % scale, with no borders. For a roll, send the tile to a print shop.',
    presets: [
      { id: 'a4', label: 'A4 at 300 dpi', width: 2480, height: 3508, output: 'png' },
      { id: 'a3', label: 'A3 at 300 dpi', width: 3508, height: 4961, output: 'png' },
      { id: 'roll', label: 'Roll tile', width: 1181, height: 1181, output: 'png' },
      { id: 'svg', label: 'SVG', output: 'svg' },
    ],
  },
  {
    id: 'game',
    label: 'Game & 3D texture',
    hint: 'Unity, Godot, Blender',
    howTo: 'Import the image as a texture and set wrap mode to repeat. Power-of-two sizes work in every engine.',
    presets: [
      { id: '512', label: '512×512', width: 512, height: 512, output: 'png' },
      { id: '1024', label: '1024×1024', width: 1024, height: 1024, output: 'png' },
      { id: '2048', label: '2048×2048', width: 2048, height: 2048, output: 'png' },
    ],
  },
  {
    id: 'slides',
    label: 'Slides & docs',
    hint: 'Keynote, PowerPoint',
    howTo: 'Save the image, then set it as the slide background in Keynote, PowerPoint or Google Slides.',
    presets: [
      { id: '16-9', label: '16:9', width: 1920, height: 1080, output: 'png' },
      { id: '4-3', label: '4:3', width: 1600, height: 1200, output: 'png' },
    ],
  },
];

/** Device pixels of the current screen: portrait for a phone, landscape for a screen. */
export function detectedSize(screenW: number, screenH: number, dpr: number, kind: 'phone' | 'screen'): { width: number; height: number } {
  const a = Math.round(screenW * dpr);
  const b = Math.round(screenH * dpr);
  const [short, long] = a < b ? [a, b] : [b, a];
  return kind === 'phone' ? { width: short, height: long } : { width: long, height: short };
}

/** `fractal-tree-7` at 1206×2622 gives `fractal-tree-7-1206x2622.png`. */
export function pngFileName(base: string, width: number, height: number): string {
  return `${base}-${width}x${height}.png`;
}

const clampSide = (n: number): number => Math.min(8192, Math.max(16, Math.round(n)));

export function clampCustom(width: number, height: number): { width: number; height: number } {
  return { width: clampSide(width), height: clampSide(height) };
}

/** The pixel size and output of a preset: detected, fixed or clamped custom; null for CSS and SVG. An unknown id falls back to the first preset. */
export function resolvePreset(
  dest: Destination,
  presetId: string,
  screen: { width: number; height: number; dpr: number },
  custom: { width: number; height: number },
): { width: number | null; height: number | null; output: Output; fileName?: never } {
  const p = dest.presets.find((x) => x.id === presetId) ?? dest.presets[0]!;
  const size = p.detect
    ? detectedSize(screen.width, screen.height, screen.dpr, p.detect)
    : p.custom
      ? clampCustom(custom.width, custom.height)
      : { width: p.width ?? null, height: p.height ?? null };
  return { width: size.width, height: size.height, output: p.output };
}
