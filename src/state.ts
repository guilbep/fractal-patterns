// Module-level reactive state for the page. Randomness lives here, never in fractal.ts.
import { computed, reactive, ref, shallowRef, watch } from 'vue';
import { KINDS, MAX_DEPTH, generate, svgFromPolylines, type Kind } from '@/fractal.ts';
import { edges, toGray, type Detector } from '@/trace.ts';
import { vectorize } from '@/vectorize.ts';
import { PALETTES, type Palette } from '@/palettes.ts';
import { blend, contrastRatio, textLevel } from '@/contrast.ts';
import { fixContrast, fixWithPlate, patternContrast, patternInvisible, pickRoles, plateContrast, swapRoles, worstTextContrast, type Roles } from '@/pairing.ts';
import { cssBackground, cssPlate, svgToDataUri } from '@/css.ts';
import { formatFootprint, gzipSize, rawSize } from '@/co2.ts';
import { MOTION_NONE, cssMotion, isStatic, type Motion } from '@/motion.ts';

export const MAX_SEED = 0xffffffff;

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

const DEFAULT_PALETTE = PALETTES.find((p) => p.name === 'Classic Double Blue') ?? PALETTES[0]!;
const INITIAL_SEED = randomSeed();
const DEFAULTS = { kind: 'tree' as Kind, depth: 8, size: 120, strokeWidth: 2, precision: 1, opacity: 0.6 };
const PLATE_DEFAULTS = { plateMode: 'split' as PlateMode, plateOpacity: 0.85, plateRadius: 12, plateBlur: 0 };

// 'plate': heading and paragraph on the plate. 'split': only the paragraph. 'direct': no plate.
export type PlateMode = 'plate' | 'split' | 'direct';

export const params = reactive({
  kind: DEFAULTS.kind,
  seed: INITIAL_SEED,
  depth: DEFAULTS.depth,
  size: DEFAULTS.size,
  strokeWidth: DEFAULTS.strokeWidth,
  precision: DEFAULTS.precision,
});
export const roles = reactive<{ -readonly [K in keyof Roles]: string }>({ ...pickRoles(DEFAULT_PALETTE.colors) });
export const opacity = ref(DEFAULTS.opacity);
export const paletteName = ref<string | null>(DEFAULT_PALETTE.name);
export const plateMode = ref<PlateMode>(PLATE_DEFAULTS.plateMode);
export const plateOpacity = ref(PLATE_DEFAULTS.plateOpacity);
export const plateRadius = ref(PLATE_DEFAULTS.plateRadius);
export const plateBlur = ref(PLATE_DEFAULTS.plateBlur);
export const palette = computed(() => PALETTES.find((p) => p.name === paletteName.value) ?? null);

// Result of the last Fix click, shown until the colors change by another action.
export const lastFix = ref<{ target: number; reached: boolean; ratio: number; changed: string } | null>(null);

watch(plateMode, () => (lastFix.value = null));

watch(
  () => params.kind,
  (k) => {
    params.depth = Math.min(params.depth, MAX_DEPTH[k]);
  },
);

// Traced-image source. The pixels live in memory only; nothing is uploaded.
export const RESOLUTIONS = [128, 192, 256] as const;
const TRACE_DEFAULTS = { detector: 'canny' as Detector, threshold: 0.3, tolerance: 1.5, minLength: 8, resolution: 192 };
export const source = ref<'math' | 'image'>('math');
export const trace = reactive({ ...TRACE_DEFAULTS });
export const image = shallowRef<{ data: Uint8ClampedArray; width: number; height: number } | null>(null);
// ponytail: the File stays referenced so a resolution change can re-downscale; dropped by removeImage().
let imageFile: Blob | null = null;

async function downscale(file: Blob, edge: number): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  try {
    const s = edge / Math.max(bitmap.width, bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * s));
    const height = Math.max(1, Math.round(bitmap.height * s));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(bitmap, 0, 0, width, height);
    return { data: ctx.getImageData(0, 0, width, height).data, width, height };
  } finally {
    bitmap.close();
  }
}

// Throws a plain-language Error the panel shows as is.
export async function loadImage(file: File): Promise<void> {
  if (!file.type.startsWith('image/')) throw new Error(`"${file.name}" is not an image. Choose a JPEG, PNG, WebP, or GIF file.`);
  try {
    image.value = await downscale(file, trace.resolution);
  } catch {
    throw new Error(`The browser could not read "${file.name}" as an image. Try another file or format.`);
  }
  imageFile = file;
  source.value = 'image';
}

watch(
  () => trace.resolution,
  async (r) => {
    if (!imageFile) return;
    try {
      image.value = await downscale(imageFile, r);
    } catch {
      /* the file decoded once at this point; keep the previous pixels */
    }
  },
);

export function removeImage(): void {
  imageFile = null;
  image.value = null;
  source.value = 'math';
}

const edgeMap = computed(() => {
  const img = image.value;
  return img ? edges(toGray(img.data, img.width, img.height), trace.detector, trace.threshold) : null;
});
export const traced = computed(() => {
  const img = image.value;
  const map = edgeMap.value;
  return img && map ? vectorize(map, img.width, img.height, { size: params.size, tolerance: trace.tolerance, minLength: trace.minLength }) : null;
});
export const usingImage = computed(() => source.value === 'image' && traced.value !== null);

export const svg = computed(() => {
  const p = { ...params, color: roles.pattern, opacity: opacity.value };
  return usingImage.value && traced.value ? svgFromPolylines(traced.value, p) : generate(p);
});
export const css = computed(() => cssBackground(svg.value, roles.background));
export const plateCss = computed(() =>
  cssPlate(roles.background, { opacity: plateOpacity.value, radius: plateRadius.value, blur: plateBlur.value }),
);
// The hero plate uses the declarations of the exported class itself, so the two never drift apart.
export const plateStyle = computed(() => plateCss.value.split('\n').slice(1, -1).join(''));
// Transform and motion of the pattern layer. The hero always renders through motionCss, the exported class.
export const motion = reactive<{ -readonly [K in keyof Motion]: Motion[K] }>({ ...MOTION_NONE });
export const motionPaused = ref(false);
export const motionCss = computed(() => cssMotion(svg.value, roles.background, params.size, motion));
export const motionStatic = computed(() => isStatic(motion));
const patternCss = computed(() => (motionStatic.value ? css.value : motionCss.value));
export const cssOut = computed(() => (plateMode.value === 'direct' ? patternCss.value : `${patternCss.value}\n\n${plateCss.value}`));
export const svgHref = computed(() => svgToDataUri(svg.value));
export const fileName = computed(() => (usingImage.value ? `traced-${trace.detector}.svg` : `fractal-${params.kind}-${params.seed}.svg`));

// One small live tile per kind, current colors and seed, for the gallery.
// Reads only seed and colors, so slider moves on the selected pattern never regenerate it.
export const previews = computed(() =>
  KINDS.map((kind) => {
    const tile = generate({ kind, seed: params.seed, size: 64, depth: Math.min(2, MAX_DEPTH[kind]), strokeWidth: 1, precision: 1, color: roles.pattern, opacity: opacity.value });
    return { kind, css: cssBackground(tile, roles.background) };
  }),
);

export const contrast = computed(() => {
  const textOnBackground = contrastRatio(roles.text, roles.background);
  const textOnPattern = contrastRatio(roles.text, blend(roles.pattern, roles.background, opacity.value));
  const direct = worstTextContrast(roles, opacity.value);
  const onPlate = plateContrast(roles, opacity.value, plateOpacity.value);
  // The paragraph's surface: the plate in 'plate' and 'split', the bare pattern in 'direct'.
  const worst = plateMode.value === 'direct' ? direct : onPlate;
  return {
    textOnBackground,
    textOnPattern,
    direct,
    onPlate,
    heading: textLevel(direct, true),
    worst,
    pattern: patternContrast(roles, opacity.value),
    patternInvisible: patternInvisible(roles, opacity.value),
    normal: textLevel(worst),
    large: textLevel(worst, true),
  };
});

// Truncated, never rounded up: 4.499 shows as 4.49, so a failing ratio never reads as 4.50.
export function ratioText(r: number): string {
  return (Math.floor(r * 100) / 100).toFixed(2);
}

export const rawBytes = computed(() => rawSize(svg.value));
export const gzipBytes = ref<number | null>(null);
export const footprint = computed(() => (gzipBytes.value === null ? null : formatFootprint(gzipBytes.value)));

let request = 0;
watch(
  svg,
  async (s) => {
    const id = ++request;
    try {
      const n = await gzipSize(s);
      if (id === request) gzipBytes.value = n;
    } catch {
      if (id === request) gzipBytes.value = null;
    }
  },
  { immediate: true },
);

// No-op in image mode: the seed does not shape a traced tile.
export function reseed(): void {
  if (usingImage.value) return;
  params.seed = randomSeed();
}

export function setSeed(value: string): void {
  const n = Number(value);
  if (value.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= MAX_SEED) params.seed = n;
}

function setRoles(r: Roles): void {
  Object.assign(roles, { background: r.background, pattern: r.pattern, text: r.text });
}

// Roles whose color is not in the selected palette. The palette stays selected; the page only notes it.
export const offPalette = computed(() =>
  (['background', 'pattern', 'text'] as const).filter((k) => palette.value && !palette.value.colors.includes(roles[k])),
);

export function setRole(role: keyof Roles, hex: string): void {
  lastFix.value = null;
  setRoles({ ...roles, [role]: hex.toLowerCase() });
}

export function applyPalette(p: Palette): void {
  lastFix.value = null;
  paletteName.value = p.name;
  setRoles(pickRoles(p.colors));
}

export function swap(): void {
  lastFix.value = null;
  setRoles(swapRoles(roles));
}

function changedText(parts: string[]): string {
  return parts.length ? `Changed the ${new Intl.ListFormat('en', { type: 'conjunction' }).format(parts)}.` : 'Changed nothing.';
}

export function applyFix(target: number): void {
  const before = { text: roles.text, opacity: opacity.value, plate: plateOpacity.value };
  let ratio: number;
  if (plateMode.value === 'direct') {
    const fix = fixContrast(roles, opacity.value, target);
    opacity.value = Math.round(fix.opacity * 100) / 100;
    setRoles({ ...roles, text: fix.text });
    ratio = worstTextContrast(roles, opacity.value); // after opacity rounding
  } else {
    // The pattern opacity stays: only the plate and, if needed, the text change.
    const fix = fixWithPlate(roles, opacity.value, plateOpacity.value, target);
    plateOpacity.value = fix.plate;
    setRoles({ ...roles, text: fix.text });
    ratio = plateContrast(roles, opacity.value, plateOpacity.value);
  }
  const changed = changedText([
    ...(plateOpacity.value !== before.plate ? ['plate opacity'] : []),
    ...(opacity.value !== before.opacity ? ['pattern opacity'] : []),
    ...(roles.text !== before.text ? ['text color'] : []),
  ]);
  lastFix.value = { target, reached: ratio >= target, ratio, changed };
}

// Back to the first-load state, including the seed drawn at load.
export function reset(): void {
  const { opacity: o, ...rest } = DEFAULTS;
  Object.assign(params, { ...rest, seed: INITIAL_SEED });
  opacity.value = o;
  plateMode.value = PLATE_DEFAULTS.plateMode;
  plateOpacity.value = PLATE_DEFAULTS.plateOpacity;
  plateRadius.value = PLATE_DEFAULTS.plateRadius;
  plateBlur.value = PLATE_DEFAULTS.plateBlur;
  applyPalette(DEFAULT_PALETTE);
  Object.assign(trace, TRACE_DEFAULTS);
  removeImage();
  Object.assign(motion, MOTION_NONE);
  motionPaused.value = false;
}
