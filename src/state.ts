// Module-level reactive state for the page. Randomness lives here, never in fractal.ts.
import { computed, reactive, ref, shallowRef, watch } from 'vue';
import {
  FAMILIES,
  KINDS,
  MAX_DEPTH,
  extraPath,
  generate,
  geometry,
  svgFromPolylines,
  tileAspect,
  type Family,
  type Kind,
} from '@/fractal.ts';
import { patchworkCells, patchworkGeometry, type PatchworkParams } from '@/patchwork.ts';
import { mirrorTile, withGap, zoomWrap } from '@/spacing.ts';
import type { Pt } from '@/patterns/util.ts';
import { edges, toGray, type Detector } from '@/trace.ts';
import { vectorize } from '@/vectorize.ts';
import { curveTileSvg } from '@/smoothtrace.ts';
import { sampleImage, type Sample } from '@/samples.ts';
import { PALETTES, type Palette } from '@/palettes.ts';
import { blend, contrastRatio, textLevel } from '@/contrast.ts';
import { fixWithFill, patternContrast, patternInvisible, pickRoles, plateContrast, swapRoles, worstAt, type Roles } from '@/pairing.ts';
import { cssBackground, cssPlate, svgToDataUri } from '@/css.ts';
import { rawSize } from '@/co2.ts';
import { MOTION_NONE, type Motion } from '@/motion.ts';
import { superTileBytes } from '@/supertile.ts';
import { VARIANT_DEFAULTS, variantTile, variantsActive, type VariantOptions } from '@/variants.ts';
import { LAYER2_DEFAULTS, layerSpots, type Layer2Settings } from '@/layers.ts';
import { fillScene, splitClosed, type FillStyle } from '@/fills.ts';
import { sceneToSvg } from '@/scene.ts';

export const MAX_SEED = 0xffffffff;

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

const DEFAULT_PALETTE = PALETTES.find((p) => p.name === 'Lagoon, mono') ?? PALETTES[0]!;
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
// Closed shapes filled with a second color; the color follows the palette's soft color (the 5th).
const softOf = (p: Palette | null): string => p?.colors[4] ?? '#c3eaec';
export const fill = reactive<{ -readonly [K in keyof FillStyle]: FillStyle[K] }>({
  mode: 'none',
  color: softOf(DEFAULT_PALETTE),
  opacity: 1,
});
export const palette = computed(() => PALETTES.find((p) => p.name === paletteName.value) ?? null);

// Result of the last Fix click, shown until the colors change by another action.
// `heading` is set in 'split' mode only, where the fix covers both the paragraph and the heading.
export const lastFix = ref<{ target: number; reached: boolean; ratio: number; heading: number | undefined; changed: string } | null>(null);

watch(plateMode, () => (lastFix.value = null));

// Layout: one kind over the tile, or a grid of cells with one kind each.
export const layout = ref<'single' | 'patchwork'>('single');
const PATCH_DEFAULTS = { cells: 3, frame: false };
export const patch = reactive({ ...PATCH_DEFAULTS, families: [...FAMILIES] as Family[], pinned: {} as Record<number, Kind> });
const patchParams = computed<PatchworkParams>(() => ({ ...patch, seed: params.seed, depth: params.depth, size: params.size }));
// What the seed picks for each cell without pins: the "Auto" label of the cell list.
export const autoCells = computed(() => patchworkCells({ ...patchParams.value, pinned: {} }).map((c) => c.kind));
// Mirrors depthCap() in patchwork.ts, which is private.
export const patchDepthMax = computed(() => (patch.cells === 2 ? 3 : 2));

export function setPin(index: number, kind: Kind | ''): void {
  const pinned = { ...patch.pinned };
  if (kind) pinned[index] = kind;
  else delete pinned[index];
  patch.pinned = pinned;
}

// White space between repeats, applied after the base geometry for every source.
const SPACING_DEFAULTS = { zoom: 1, gap: 0, mirror: false };
export const spacing = reactive({ ...SPACING_DEFAULTS });
export function resetSpacing(): void {
  Object.assign(spacing, SPACING_DEFAULTS);
}

watch(
  () => params.kind,
  (k) => {
    params.depth = Math.min(params.depth, MAX_DEPTH[k]);
  },
);

// Traced-image source. The pixels live in memory only; nothing is uploaded.
export const RESOLUTIONS = [128, 192, 256] as const;
const TRACE_DEFAULTS = {
  detector: 'canny' as Detector,
  threshold: 0.3,
  tolerance: 1.5,
  minLength: 8,
  resolution: 192,
  fit: 'cover' as 'cover' | 'contain',
  curves: false, // Smooth curves: Bézier curves from traceCurves in place of polylines
};
export const source = ref<'math' | 'image'>('math');
export const trace = reactive({ ...TRACE_DEFAULTS });
export const image = shallowRef<{ data: Uint8ClampedArray; width: number; height: number } | null>(null);
// ponytail: the File stays referenced so a resolution change can re-downscale; dropped by removeImage().
let imageFile: Blob | null = null;
// The built-in example in use, if any; it is redrawn at each resolution.
export const activeSample = ref<Sample | null>(null);

export function loadSample(id: Sample): void {
  imageFile = null;
  activeSample.value = id;
  image.value = sampleImage(id, trace.resolution);
  source.value = 'image';
}

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
  activeSample.value = null;
  source.value = 'image';
}

watch(
  () => trace.resolution,
  async (r) => {
    if (activeSample.value) image.value = sampleImage(activeSample.value, r);
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
  activeSample.value = null;
  image.value = null;
  source.value = 'math';
}

const gray = computed(() => {
  const img = image.value;
  return img ? toGray(img.data, img.width, img.height) : null;
});
const edgeMap = computed(() => (gray.value ? edges(gray.value, trace.detector, trace.threshold) : null));
export const traced = computed(() => {
  const img = image.value;
  const map = edgeMap.value;
  return img && map
    ? vectorize(map, img.width, img.height, { size: params.size, tolerance: trace.tolerance, minLength: trace.minLength, fit: trace.fit })
    : null;
});
export const usingImage = computed(() => source.value === 'image' && traced.value !== null);

// A rectangular kind (Penrose) has no patchwork yet: the layout falls back to single.
export const squareKind = computed(() => tileAspect(params.kind) === 1);
export const usingPatchwork = computed(() => !usingImage.value && layout.value === 'patchwork' && squareKind.value);
// Tile width / height: only a single math pattern of a rectangular kind is not square.
export const aspect = computed(() => (usingImage.value || usingPatchwork.value ? 1 : tileAspect(params.kind)));

// One pipeline for every source: base polylines, mirror, zoom, gap. The gap gives the final tile size.
type Tile = { polys: readonly (readonly Pt[])[]; size: number; extra?: string };
function tileFor(seed: number): Tile {
  const size = params.size;
  let polys: readonly (readonly Pt[])[] =
    usingImage.value && traced.value
      ? traced.value
      : usingPatchwork.value
        ? patchworkGeometry({ ...patchParams.value, seed })
        : geometry({ ...params, seed });
  // ponytail: spacing assumes a square tile; skipped for a rectangular kind until a ticket asks.
  // A rectangular kind is a single math pattern here; its raw path (Penrose arcs) rides along untransformed.
  // ponytail: a square kind with `extra` would lose it under spacing; none has one yet.
  if (aspect.value !== 1) return { polys, size, extra: extraPath({ ...params, seed }) };
  if (spacing.mirror) polys = mirrorTile(polys, size);
  if (spacing.zoom !== 1) polys = zoomWrap(polys, size, spacing.zoom);
  return spacing.gap > 0 ? withGap(polys, size, spacing.gap) : { polys, size };
}
const tile = computed(() => tileFor(params.seed));
const tileSvg = (t: Tile) =>
  fillOn.value
    ? sceneToSvg(
        fillScene(t.polys, { size: t.size, strokeWidth: params.strokeWidth, color: roles.pattern, opacity: opacity.value }, fill),
        params.precision,
      )
    : svgFromPolylines(t.polys, { ...params, size: t.size, color: roles.pattern, opacity: opacity.value }, aspect.value, t.extra);
// Fills need plain polylines: not the variants super tile, not the curve tile, not a kind with a raw `extra` path.
export const fillAvailable = computed(() => !variantsOn.value && !curvesOn.value && aspect.value === 1);
const fillOn = computed(() => fill.mode !== 'none' && fillAvailable.value);
export const closedShapes = computed(() => splitClosed(tile.value.polys).closed.length);

// Smooth curves: the traced tile from traceCurves.
// ponytail: spacing (mirror, zoom, gap) is skipped in this mode, it works on polylines; combine it when a ticket asks.
export const curvesOn = computed(() => usingImage.value && trace.curves);
const curveSvg = computed(() =>
  curvesOn.value && gray.value
    ? curveTileSvg(gray.value, {
        detector: trace.detector,
        threshold: trace.threshold,
        size: params.size,
        minLength: trace.minLength,
        smooth: 1.5,
        tolerance: 1.2,
        refineSteps: 40,
        fit: trace.fit,
        strokeWidth: params.strokeWidth,
        precision: params.precision,
        color: roles.pattern,
        opacity: opacity.value,
      })
    : null,
);
// The measured cost shown under the checkbox: the curve tile against the straight tile with the same settings.
export const curveBytes = computed(() =>
  curveSvg.value === null ? null : { svg: rawSize(curveSvg.value), plain: rawSize(tileSvg(tile.value)) },
);

// Reduce repetition: a super tile of seeded variants, whose cell edge is the tile size.
// ponytail: spacing (mirror, zoom, gap) is skipped in this mode; combine it when a ticket asks.
export const variants = ref(false);
// Options that do not apply to the kind keep their value; the generator ignores them.
export const variantOptions = reactive<{ -readonly [K in keyof VariantOptions]: VariantOptions[K] }>({ ...VARIANT_DEFAULTS });
export function resetVariants(): void {
  Object.assign(variantOptions, VARIANT_DEFAULTS);
}
export const variantsOn = computed(() =>
  variantsActive({ variants: variants.value, kind: params.kind, layout: layout.value, usingImage: usingImage.value }),
);
const superOptions = (seed: number) => ({ ...params, ...variantOptions, seed, color: roles.pattern, opacity: opacity.value });
// The measured cost shown under the switch: the super tile against one plain tile.
export const variantBytes = computed(() => (variantsOn.value ? superTileBytes(superOptions(params.seed)) : null));

export const tileSize = computed(() =>
  variantsOn.value ? variantTile(superOptions(params.seed)).size : curveSvg.value !== null ? params.size : tile.value.size,
);
// The tile for any seed with the current settings; a traced image gives the same tile for every seed.
export function svgForSeed(seed: number): string {
  if (variantsOn.value) return variantTile(superOptions(seed)).svg;
  if (curveSvg.value !== null) return curveSvg.value;
  return tileSvg(seed === params.seed ? tile.value : tileFor(seed));
}
export const svg = computed(() => svgForSeed(params.seed));
// Against repetition, for every source: a second copy at a coprime size, and a soft CSS fade.
export const layer2 = ref(false);
export const layer2Settings = reactive<{ -readonly [K in keyof Layer2Settings]: number }>({ ...LAYER2_DEFAULTS });
export function resetLayer2(): void {
  Object.assign(layer2Settings, LAYER2_DEFAULTS);
}
export const fade = ref(false);
// Parallax on scroll for the two layers; has an effect only with layer2.
export const parallax = ref(false);
// Different angle per section: export-only helper classes; the preview does not change.
export const sections = ref(false);
const plateCss = computed(() =>
  cssPlate(roles.background, { opacity: plateOpacity.value, radius: plateRadius.value, blur: plateBlur.value }),
);
// The hero plate uses the declarations of the exported class itself, so the two never drift apart.
export const plateStyle = computed(() => plateCss.value.split('\n').slice(1, -1).join(''));
// Transform and motion of the pattern layer. The hero renders through exportText (state-export.ts), the exported class.
export const motion = reactive<{ -readonly [K in keyof Motion]: Motion[K] }>({ ...MOTION_NONE });
export const motionPaused = ref(false);
export const svgHref = computed(() => svgToDataUri(svg.value));
export const fileName = computed(() =>
  usingImage.value
    ? `traced-${trace.detector}.svg`
    : usingPatchwork.value
      ? `patchwork-${patch.cells}x${patch.cells}-${params.seed}.svg`
      : `fractal-${params.kind}-${params.seed}.svg`,
);

// One small live tile per kind, current colors and seed, for the gallery.
// Reads only seed and colors, so slider moves on the selected pattern never regenerate it.
export const previews = computed(() =>
  KINDS.map((kind) => {
    const tile = generate({
      kind,
      seed: params.seed,
      size: 64,
      depth: Math.min(2, MAX_DEPTH[kind]),
      strokeWidth: 1,
      precision: 1,
      color: roles.pattern,
      opacity: opacity.value,
    });
    return { kind, css: cssBackground(tile, roles.background) };
  }),
);

// The stroke opacities the page shows, for the badge and the Fix button alike.
const spots = computed(() => {
  const layers = layer2.value ? 2 : 1;
  const strength = layer2Settings.opacity;
  return (o: number) => layerSpots(o, layers, strength);
});

// The roles the text is checked against: with the fill when it shows on the tile.
const checkedRoles = computed(() => ({
  ...roles,
  fill: fillOn.value && closedShapes.value > 0 ? fill.color : null,
  fillOpacity: fill.opacity,
}));

export const contrast = computed(() => {
  const r = checkedRoles.value;
  const textOnBackground = contrastRatio(roles.text, roles.background);
  const textOnPattern = contrastRatio(roles.text, blend(roles.pattern, roles.background, opacity.value));
  // With a second layer at strength p, crossings carry the strokes at 1 - (1 - o) * (1 - o * p): the badge takes the worst spot.
  const direct = worstAt(r, opacity.value, spots.value);
  const onPlate = plateContrast(r, opacity.value, plateOpacity.value, spots.value);
  // Text on the fill alone and on a stroke over it, without a plate; null when no fill shows.
  const onFill =
    r.fill === null
      ? null
      : worstAt({ ...r, background: blend(r.fill, r.background, r.fillOpacity), fill: null }, opacity.value, spots.value);
  // The paragraph's surface: the plate in 'plate' and 'split', the bare pattern in 'direct'.
  const worst = plateMode.value === 'direct' ? direct : onPlate;
  return {
    textOnBackground,
    textOnPattern,
    onFill,
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

// No-op in image mode: the seed does not shape a traced tile.
export function reseed(): void {
  if (usingImage.value) return;
  params.seed = randomSeed();
}

// A different kind, a new seed, a single layout; colors, plate, spacing, and motion stay.
export function randomPattern(): void {
  source.value = 'math';
  layout.value = 'single';
  const others = KINDS.filter((k) => k !== params.kind);
  const kind = others[randomSeed() % others.length] ?? params.kind;
  params.kind = kind;
  params.seed = randomSeed();
  params.depth = Math.max(Math.min(params.depth, MAX_DEPTH[kind]), Math.min(2, MAX_DEPTH[kind]));
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

export function setFillColor(hex: string): void {
  lastFix.value = null;
  fill.color = hex.toLowerCase();
}

// ponytail: choosing a palette always sets the fill color to its soft color, edited or not.
export function applyPalette(p: Palette): void {
  lastFix.value = null;
  paletteName.value = p.name;
  fill.color = softOf(p);
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
  const before = { text: roles.text, opacity: opacity.value, plate: plateOpacity.value, fill: fill.opacity };
  const fix = fixWithFill(plateMode.value, checkedRoles.value, opacity.value, plateOpacity.value, target, spots.value);
  if (fix.fillOpacity !== undefined) fill.opacity = fix.fillOpacity;
  opacity.value = fix.opacity;
  plateOpacity.value = fix.plate;
  setRoles({ ...roles, text: fix.text });
  const { ratio, heading, reached } = fix;
  const changed = changedText([
    ...(fill.opacity !== before.fill ? ['fill opacity'] : []),
    ...(plateOpacity.value !== before.plate ? ['plate opacity'] : []),
    ...(opacity.value !== before.opacity ? ['pattern opacity'] : []),
    ...(roles.text !== before.text ? ['text color'] : []),
  ]);
  lastFix.value = { target, reached, ratio, heading, changed };
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
  Object.assign(fill, { mode: 'none', opacity: 1 });
  Object.assign(trace, TRACE_DEFAULTS);
  removeImage();
  layout.value = 'single';
  Object.assign(patch, { ...PATCH_DEFAULTS, families: [...FAMILIES], pinned: {} });
  resetSpacing();
  Object.assign(motion, MOTION_NONE);
  motionPaused.value = false;
  variants.value = false;
  resetVariants();
  layer2.value = false;
  resetLayer2();
  fade.value = false;
  parallax.value = false;
  sections.value = false;
}
