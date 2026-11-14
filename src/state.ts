// Module-level reactive state for the page. Randomness lives here, never in fractal.ts.
import { computed, reactive, ref, shallowRef, watch } from 'vue';
import {
  FAMILIES,
  KINDS,
  MAX_DEPTH,
  extraPath,
  generate,
  geometry,
  hasAccent,
  svgFromPolylines,
  tileAspect,
  tileHeight,
  type Family,
  type Kind,
} from '@/fractal.ts';
import { patchworkCells, patchworkGeometry, type PatchworkParams } from '@/patchwork.ts';
import { mirrorTile, withGap, zoomWrap } from '@/spacing.ts';
import type { Poly, Pt } from '@/patterns/util.ts';
import { accentDefaults, accentEffective, accentShapes, type AccentLayer } from '@/accent-layer.ts';
import { accentSvg } from '@/accent-svg.ts';
import { keepClear } from '@/accent-clear.ts';
import { applyMoves, decodeMoves } from '@/accent-moves.ts';
import { ACCENT_VARY_DEFAULTS, varyAccent, type AccentVary } from '@/accent-vary.ts';
import { traceCall, type TraceChoice } from '@/detectors.ts';
import { sampleImage, type Sample } from '@/samples.ts';
import { readImage } from '@/image-file.ts';
import { PALETTES, paletteRoles, rollPalette, type Palette } from '@/palettes.ts';
import { APCA_SCORE, apcaWorst } from '@/apca.ts';
import { blend, contrastRatio, textLevel } from '@/contrast.ts';
import { fixWithFill, patternContrast, patternInvisible, plateContrast, swapRoles, worstAt, type Roles } from '@/pairing.ts';
import { cssPlate, svgToDataUri } from '@/css.ts';
import { rawSize } from '@/co2.ts';
import { MOTION_NONE, type Motion } from '@/motion.ts';
import { canVary, imageSuperTileExpanded, imageSuperTileSvg, superTileBytes } from '@/supertile.ts';
import { VARIANT_DEFAULTS, variantTile, variantsActive, type VariantOptions } from '@/variants.ts';
import { LAYER2_DEFAULTS, layerSpots, type Layer2Settings } from '@/layers.ts';
import { NO_FILL, fillScene, splitClosed, type FillStyle } from '@/fills.ts';
import { ACCENT_DEFAULT, appliesDefault, type VaryApplies } from '@/share.ts';
import { composeSvg, sceneToSvg, type SceneLayer } from '@/scene.ts';
import type { ChangeDir } from '@/fade.ts';
import { LAYOUT_EXAMPLES, randomLayout, randomRepetition } from '@/random-design.ts';
import { preferred } from '@/preferred.ts';
import { GRAIN_DEFAULTS, grainColor, grainSvg, type Grain } from '@/grain.ts';

export const MAX_SEED = 0xffffffff;

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

const DEFAULT_PALETTE = PALETTES.find((p) => p.name === 'Lagoon') ?? PALETTES[0]!;
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
export const roles = reactive<{ -readonly [K in keyof Roles]: string }>({ ...paletteRoles(DEFAULT_PALETTE.colors) });
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
// The second layer's own color, used only when layer2Own is on; it follows the palette's accent (the 4th).
// The palettes carry a saturated accent there (paletteLch in palettes.ts), so the accent shapes follow it too.
const accentOf = (p: Palette | null): string => p?.colors[3] ?? ACCENT_DEFAULT;
export const layer2Own = ref(false);
export const layer2Color = ref(accentOf(DEFAULT_PALETTE));
// The color of the shapes a kind marks as accent (fractal.ts); shown in the panel only for such a kind.
export const accent = ref(accentOf(DEFAULT_PALETTE));
export { hasAccent };
// The accent layer: simple shapes in the Accent color over any kind (accent-layer.ts), drawn as its own background
// layer over the pattern. A kind change resets it to the kind's defaults (chooseKind); a link sets it from `al`.
export const accentLayer = reactive<{ -readonly [K in keyof AccentLayer]: AccentLayer[K] }>({ ...accentDefaults(DEFAULTS.kind) });
// The accent's own variation over a super tile (accent-vary.ts), used when Reduce repetition applies to the accent.
export const accentVary = reactive<{ -readonly [K in keyof AccentVary]: AccentVary[K] }>({ ...ACCENT_VARY_DEFAULTS });
// Accent shapes moved by hand: the encoded `am` value (accent-moves.ts), in the link and the undo history.
export const accentMoves = ref('');
// The move of the drag in progress: drawn at once, but kept out of the link and the history until the drag ends (one undo step).
export const accentDrag = shallowRef<{ index: number; d: Pt } | null>(null);
// The Edit shapes overlay on the one-tile marker: view state only, not in the link.
export const accentEditing = ref(false);
// A new place, snap or amount (or kind) gives other shapes at the same indexes: the moves no longer apply. Sync, so
// applyDesign can set the layer and then its moves; a new shape, size or seed keeps them.
watch([() => accentLayer.place, () => accentLayer.snap, () => accentLayer.amount], () => (accentMoves.value = ''), { flush: 'sync' });
const movesNow = computed(() => {
  const m = decodeMoves(accentMoves.value);
  const g = accentDrag.value;
  if (g) m.set(g.index, g.d);
  return m;
});
// Which layer Reduce repetition (the `variants` switch) varies. Reset with the kind: the accent for a kind whose base cannot vary.
export const varyApplies = ref<VaryApplies>(appliesDefault(DEFAULTS.kind));
export type { VaryApplies };
// The last random palette, kept so the fill color and the off-palette note work while it is selected.
const randomColors = ref<Palette | null>(null);
export const palette = computed(
  () => PALETTES.find((p) => p.name === paletteName.value) ?? (randomColors.value?.name === paletteName.value ? randomColors.value : null),
);

// Result of the last Fix click, shown until the colors change by another action.
// `heading` is set in 'split' mode only, where the fix covers both the paragraph and the heading.
// `measure`: 'wcag' (ratio and heading are contrast ratios) or 'apca' (they are absolute Lc values).
export type FixMeasure = 'wcag' | 'apca';
export const lastFix = ref<{
  measure: FixMeasure;
  target: number;
  reached: boolean;
  ratio: number;
  heading: number | undefined;
  changed: string;
} | null>(null);

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
  detector: 'canny' as TraceChoice,
  threshold: 0.3,
  levels: 4, // contour lines only: brightness levels for traceIsolines
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
type Pixels = { data: Uint8ClampedArray; width: number; height: number };
// The built-in example in use, if any; it is redrawn at each resolution.
export const activeSample = ref<Sample | null>(null);

export function loadSample(id: Sample): void {
  imageFile = null;
  activeSample.value = id;
  image.value = sampleImage(id, trace.resolution);
  source.value = 'image';
}

// The image at `edge` px on its longer side, enlarged if smaller. An SVG file is refused (the caller shows that the
// browser could not read it), as before the shared reader, which decodes SVG.
const downscale = (file: Blob, edge: number): Promise<Pixels> =>
  file.type === 'image/svg+xml' ? Promise.reject(new Error('svg')) : readImage(file, edge, true);

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

// Extra pictures for Reduce repetition: traced with the same settings, never in a share link.
export const MAX_EXTRA_IMAGES = 3;
export const extraImages = shallowRef<readonly { name: string; file: Blob; img: Pixels }[]>([]);
// Throws a plain-language Error the panel shows as is; files past the limit are left out.
export async function addImages(files: readonly File[]): Promise<void> {
  for (const file of files) {
    if (extraImages.value.length >= MAX_EXTRA_IMAGES) return;
    if (!file.type.startsWith('image/')) throw new Error(`"${file.name}" is not an image. Choose a JPEG, PNG, WebP, or GIF file.`);
    let img: Pixels;
    try {
      img = await downscale(file, trace.resolution);
    } catch {
      throw new Error(`The browser could not read "${file.name}" as an image. Try another file or format.`);
    }
    extraImages.value = [...extraImages.value, { name: file.name, file, img }].slice(0, MAX_EXTRA_IMAGES);
  }
}
export function removeExtraImage(i: number): void {
  extraImages.value = extraImages.value.filter((_, k) => k !== i);
}
watch(
  () => trace.resolution,
  async (r) => {
    const next = [];
    for (const e of extraImages.value) {
      try {
        next.push({ ...e, img: await downscale(e.file, r) });
      } catch {
        next.push(e);
      }
    }
    extraImages.value = next;
  },
);

export function removeImage(): void {
  extraImages.value = [];
  imageFile = null;
  activeSample.value = null;
  image.value = null;
  source.value = 'math';
}

// The tracing code loads with the first image: a share link never holds one, so the page starts without it.
const loadTracing = () =>
  Promise.all([import('@/trace.ts'), import('@/vectorize.ts'), import('@/smoothtrace.ts'), import('@/isolines.ts')]).then(
    ([t, v, s, i]) => ({
      ...t,
      ...v,
      ...s,
      ...i,
    }),
  );
const tracing = shallowRef<Awaited<ReturnType<typeof loadTracing>> | null>(null);
watch(image, (img) => {
  if (img && !tracing.value) void loadTracing().then((m) => (tracing.value = m));
});
const gray = computed(() => {
  const img = image.value;
  return img && tracing.value ? tracing.value.toGray(img.data, img.width, img.height) : null;
});
const call = computed(() => traceCall(trace, params.size));
// Kept apart from `traced` so a Detail or length change reuses the edge map.
const edgeMap = computed(() => {
  const c = call.value;
  return gray.value && tracing.value && c.method === 'edges' ? tracing.value.edges(gray.value, c.detector, c.threshold) : null;
});
type Tracing = NonNullable<typeof tracing.value>;
type Gray = ReturnType<Tracing['toGray']>;
// Image to polylines, for the main picture and the extra ones. `map` reuses a cached edge map.
function polylinesOf(
  t: Tracing,
  g: Gray,
  map = call.value.method === 'edges' ? t.edges(g, call.value.detector, call.value.threshold) : null,
) {
  const c = call.value;
  // ponytail: contours always fit the whole image (contain); cover needs clipping in isolines.ts, the Fit select is disabled.
  if (c.method === 'isolines') return t.traceIsolines(g, c.options);
  return map
    ? t.vectorize(map, g.width, g.height, {
        size: params.size,
        tolerance: trace.tolerance,
        minLength: trace.minLength,
        fit: trace.fit,
      })
    : null;
}
export const traced = computed(() => {
  const g = gray.value;
  const t = tracing.value;
  return g && t ? polylinesOf(t, g, edgeMap.value) : null;
});
watch(extraImages, (list) => {
  if (list.length && !tracing.value) void loadTracing().then((m) => (tracing.value = m));
});
const extraTraced = computed(() => {
  const t = tracing.value;
  return t ? extraImages.value.map(({ img }) => polylinesOf(t, t.toGray(img.data, img.width, img.height))) : [];
});
export const usingImage = computed(() => source.value === 'image' && traced.value !== null);

// A rectangular kind (Penrose) has no patchwork yet: the layout falls back to single.
export const squareKind = computed(() => tileAspect(params.kind) === 1);
export const usingPatchwork = computed(() => !usingImage.value && layout.value === 'patchwork' && squareKind.value);
// Tile width / height: only a single math pattern of a rectangular kind is not square.
export const aspect = computed(() => (usingImage.value || usingPatchwork.value ? 1 : tileAspect(params.kind)));

// One pipeline for every source: base polylines, mirror, zoom, gap. The gap gives the final tile size.
type Polys = readonly (readonly Pt[])[];
type Tile = { polys: Polys; size: number; extra?: string };
// Mirror, zoom, gap; spacing assumes a square tile.
function space(p: Polys, size: number): Tile {
  if (spacing.mirror) p = mirrorTile(p, size);
  if (spacing.zoom !== 1) p = zoomWrap(p, size, spacing.zoom);
  return spacing.gap > 0 ? withGap(p, size, spacing.gap) : { polys: p, size };
}
// The base polylines before spacing: the traced image, the patchwork, or the kind.
function rawFor(seed: number): Polys {
  return usingImage.value && traced.value
    ? traced.value
    : usingPatchwork.value
      ? patchworkGeometry({ ...patchParams.value, seed })
      : geometry({ ...params, seed });
}
const raw = computed(() => rawFor(params.seed));
function tileFor(seed: number, polys: Polys = rawFor(seed)): Tile {
  const size = params.size;
  // ponytail: spacing assumes a square tile; skipped for a rectangular kind until a ticket asks.
  // A rectangular kind is a single math pattern here; its raw path (Penrose arcs) rides along untransformed.
  // ponytail: a square kind with `extra` would lose it under spacing; none has one yet.
  if (aspect.value !== 1) return { polys, size, extra: extraPath({ ...params, seed }) };
  return space(polys, size);
}
const tile = computed(() => tileFor(params.seed, raw.value));
const sceneFor = (t: Tile, color = roles.pattern) =>
  fillScene(
    t.polys,
    { size: t.size, height: tileHeight(t.size, aspect.value), strokeWidth: params.strokeWidth, color, opacity: opacity.value },
    fillOn.value ? fill : NO_FILL,
  );
const tileSvg = (t: Tile, color = roles.pattern) =>
  fillOn.value
    ? sceneToSvg(sceneFor(t, color), params.precision)
    : svgFromPolylines(t.polys, { ...params, size: t.size, color, opacity: opacity.value }, aspect.value, t.extra);
// The accent shapes, filled non-zero: overlapping shapes join, and a ring's reversed inner loop stays a hole.
const accentPaint = (polys: Polys): SceneLayer => ({
  polys,
  paint: { mode: 'fill', color: accent.value, opacity: 1, width: 0, rule: 'nonzero' },
});
// The plain tile as layers (fill, strokes, accent on top): the canvas script and the paint worklet draw this.
export const tileScene = computed(() => {
  const s = sceneFor(tile.value);
  const a = accentTile.value;
  return a && a.width === s.width ? { ...s, layers: [...s.layers, accentPaint(a.polys)] } : s;
});
// Fills need plain polylines: not the variants super tile, not the curve tile, not a kind with a raw `extra` path.
export const fillAvailable = computed(() => !variantsOn.value && !curvesOn.value && aspect.value === 1);
const fillOn = computed(() => fill.mode !== 'none' && fillAvailable.value);
export const closedShapes = computed(() => splitClosed(tile.value.polys).closed.length);
// The kind's own shapes and places exist only where the kind is drawn as a single pattern.
export const accentOwnOk = computed(() => !usingImage.value && !usingPatchwork.value);
// The layer drawn and linked: over an image or a patchwork, 'own' becomes a dot on a grid; accentLayer keeps 'own'.
export const accentDrawn = computed(() => accentEffective(accentLayer, accentOwnOk.value));
// The accent shapes of one tile at the current seed, before spacing: `shapes` as generated, `polys` as drawn (moved by
// hand, then the others kept clear of the lines), same indexes. Null when no shape shows.
function accentPlaced(seed: number): { shapes: Poly[]; polys: Poly[]; width: number; height: number; unspaced: boolean } | null {
  const size = params.size;
  const height = tileHeight(size, aspect.value);
  const shapes = accentShapes(params.kind, accentDrawn.value, { seed, depth: params.depth, size });
  if (shapes.length === 0) return null;
  const moves = movesNow.value;
  let polys = moves.size ? applyMoves(shapes, moves, size, height) : shapes;
  const unspaced = variantsOn.value || curvesOn.value || aspect.value !== 1;
  if (accentDrawn.value.clear && clearAvailable.value && !variantsOn.value) {
    // Cleared before spacing, against the base before spacing: zoom cuts shapes at the tile edge, keepClear needs them
    // whole. Mirror and zoom scale both layers alike, so the drawn stroke and the 1 px gap are scaled back by `k`.
    // ponytail: skipped over a base super tile, whose cells differ, and a rectangular kind's raw `extra` path (Penrose arcs).
    // A shape moved by hand stays where it was put: only the others are kept clear.
    const base = (seed === params.seed ? raw.value : rawFor(seed)).filter((p) => p.length >= 2);
    const k = unspaced ? 1 : (spacing.mirror ? 0.5 : 1) * Math.min(4, Math.max(0.25, spacing.zoom));
    const free = polys.map((_, i) => i).filter((i) => !moves.has(i));
    if (base.length && free.length) {
      const cleared = keepClear(
        free.map((i) => polys[i]!),
        base as Poly[],
        { size, height, strokeWidth: params.strokeWidth / k, gap: 1 / k },
      );
      polys = polys.slice();
      free.forEach((i, j) => (polys[i] = cleared[j]!));
    }
  }
  return { shapes, polys, width: size, height, unspaced };
}
function accentFor(seed: number, placed = accentPlaced(seed)): { polys: Polys; width: number; height: number } | null {
  if (!placed) return null;
  const { polys, width, height, unspaced } = placed;
  if (unspaced) return { polys, width, height };
  const t = space(polys, width);
  return { polys: t.polys, width: t.size, height: t.size };
}
export const accentEdit = computed(() => accentPlaced(params.seed));
// The overlay draws the tile before spacing: it matches the preview only where spacing is not applied.
export const accentEditable = computed(
  () => accentEdit.value !== null && (accentEdit.value.unspaced || (spacing.zoom === 1 && spacing.gap === 0 && !spacing.mirror)),
);
watch(accentEditable, (ok) => ok || (accentEditing.value = false));
// Keep clear of the lines needs the base as polylines: not the curve tile (a finished SVG).
export const clearAvailable = computed(() => !curvesOn.value);
const accentTile = computed(() => accentFor(params.seed, accentEdit.value));
// Accent shapes are drawn: the Colors tab shows the Accent role, the contrast check counts the accent surface.
export const accentShown = computed(() => accentTile.value !== null);
// Reduce repetition reaches the accent: the switch is on and it applies to the accent or both, and shapes show.
export const accentVaried = computed(() => variants.value && varyApplies.value !== 'base' && accentTile.value !== null);
// The accent layer as its own tile: one tile, or the varied super tile of accentVary.cells tiles. Null when no shape shows.
export const accentOut = computed(() => {
  const t = accentTile.value;
  if (!t) return null;
  // Paused while editing, so the overlay sits on the shapes; the variation then starts from the moved places.
  const v =
    accentVaried.value && !accentEditing.value
      ? varyAccent(t.polys as Poly[], t.width, t.height, accentVary, params.seed)
      : { places: undefined, width: t.width, height: t.height };
  return {
    svg: accentSvg(t.polys as Poly[], v.places, v.width, v.height, accent.value, params.precision),
    width: v.width,
    height: v.height,
  };
});

// Smooth curves: the traced tile from traceCurves.
// ponytail: spacing (mirror, zoom, gap) is skipped in this mode, it works on polylines; combine it when a ticket asks.
// The curve tracer runs its own edge detector, so contour lines keep straight segments.
export const curvesOn = computed(() => usingImage.value && trace.curves && call.value.method === 'edges');
const curveSvg = computed(() =>
  curvesOn.value && gray.value && tracing.value && call.value.method === 'edges'
    ? tracing.value.curveTileSvg(gray.value, {
        detector: call.value.detector,
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
// The curve tile in another color: the color sits only in the root stroke attribute.
// ponytail: string swap on the generated tile, the tracer has no cheap re-color.
const recolor = (svg: string, color: string): string => svg.replace(`stroke="${roles.pattern}"`, `stroke="${color}"`);
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
// An image super tile takes the straight trace only: the curve tile is a finished SVG, not polylines.
// ponytail: curves stay off this mode; reuse the curve path through <use> when a ticket asks.
export const variantsOn = computed(
  () =>
    variantsActive({ variants: variants.value, kind: params.kind, layout: layout.value, usingImage: usingImage.value }) &&
    !curvesOn.value &&
    // An image varied its picture before Applies to reached it: with the accent off, it still does.
    (varyApplies.value !== 'accent' || (usingImage.value && !accentLayer.on)),
);
// The base layer can vary: a traced image, or a single pattern of a kind with seed-compatible edges.
export const baseCanVary = computed(() => usingImage.value || (layout.value === 'single' && canVary(params.kind)));
const superOptions = (seed: number, color = roles.pattern) => ({ ...params, ...variantOptions, seed, color, opacity: opacity.value });
// The traced picture in every cell of the super tile, or null for a math pattern. With Mirror on, the
// cell is the mirrored 2 x 2 block, so every cell is seamless and the grid options work on it.
export const imageCells = computed(() =>
  usingImage.value && traced.value ? (spacing.mirror ? mirrorTile(traced.value, params.size) : traced.value) : null,
);
// Every traced picture for the super tile, main first, skipping any that traced to no lines.
export const imageVariants = computed(() =>
  imageCells.value
    ? [traced.value, ...extraTraced.value]
        .filter((p): p is NonNullable<typeof p> => !!p && p.some((l) => l.length >= 2))
        .map((p) => (spacing.mirror ? mirrorTile(p, params.size) : p))
    : null,
);
const superSvg = (seed: number, color = roles.pattern): string =>
  imageVariants.value ? imageSuperTileSvg(superOptions(seed, color), imageVariants.value) : variantTile(superOptions(seed, color)).svg;
// The measured cost shown under the switch: the super tile against one plain tile.
export const variantBytes = computed(() => {
  if (!variantsOn.value) return null;
  if (!imageCells.value) return superTileBytes(superOptions(params.seed));
  const o = superOptions(params.seed);
  return {
    svg: rawSize(imageSuperTileSvg(o, imageVariants.value ?? imageCells.value)),
    expanded: rawSize(imageSuperTileExpanded(o, imageVariants.value ?? imageCells.value)),
    plain: rawSize(tileSvg(tile.value)),
  };
});

// Grain: a fine noise under the pattern, over the background color, its own tile size (grain.ts). Off by default.
export const grain = reactive<{ -readonly [K in keyof Grain]: Grain[K] }>({ ...GRAIN_DEFAULTS });
// The grain tile for the CSS export; null when off.
export const grainOut = computed(() => (grain.on ? grainSvg(grain) : null));

// The base layer's tile edge: the CSS export's first background.
export const baseTileSize = computed(() =>
  variantsOn.value ? variantOptions.cells * params.size : curveSvg.value !== null ? params.size : tile.value.size,
);
// The tile for any seed with the current settings; a traced image gives the same tile for every seed.
// `color` draws the strokes in another color (the second layer's own color).
export function svgForSeed(seed: number, color = roles.pattern): string {
  if (variantsOn.value) return superSvg(seed, color);
  if (curveSvg.value !== null) return recolor(curveSvg.value, color);
  return tileSvg(seed === params.seed ? tile.value : tileFor(seed), color);
}
// The base layer alone, for the CSS export (its accent is a second background).
export const baseSvg = computed(() => svgForSeed(params.seed));
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
// One tile with both layers, for the downloaded SVG and the PNG: the base, and the accent on top, over a common
// multiple of both repeats (counted in cells, so a fractional cell size stays exact). Without an accent: the base alone.
const composed = computed(() => {
  const a = accentOut.value;
  const bw = baseTileSize.value;
  const bh = tileHeight(bw, aspect.value);
  // The grain at the file's own tile size, stitched, at the bottom: the file stays seamless, but there the grain
  // repeats with the tile. ponytail: a 257 px grain layer would need a tile of 257 times the pattern tile.
  const under = grain.on ? (w: number, h: number) => [{ svg: grainSvg(grain, w, h), width: w, height: h }] : () => [];
  if (!a)
    return {
      svg: grain.on ? composeSvg([...under(bw, bh), { svg: baseSvg.value, width: bw, height: bh }], bw, bh) : baseSvg.value,
      size: bw,
    };
  const bc = variantsOn.value ? variantOptions.cells : 1;
  const ac = accentVaried.value ? Math.max(1, Math.round(accentVary.cells)) : 1;
  const n = ac / gcd(bc, ac); // lcm(bc, ac) / bc base tiles per edge
  const layers = [
    ...under(bw * n, bh * n),
    { svg: baseSvg.value, width: bw, height: bh },
    { svg: a.svg, width: a.width, height: a.height },
  ];
  return { svg: composeSvg(layers, bw * n, bh * n), size: bw * n };
});
export const svg = computed(() => composed.value.svg);
// The tile of a seed with that seed's accent tile on top, unvaried: the second layer, which had its accent before the
// accent became its own layer. Without accent shapes: svgForSeed, byte for byte.
export function svgWithAccent(seed: number, color = roles.pattern): string {
  const a = accentFor(seed);
  if (!a) return svgForSeed(seed, color);
  const bw = baseTileSize.value;
  const bh = tileHeight(bw, aspect.value);
  return composeSvg(
    [
      { svg: svgForSeed(seed, color), width: bw, height: bh },
      { svg: accentSvg(a.polys as Poly[], undefined, a.width, a.height, accent.value, params.precision), width: a.width, height: a.height },
    ],
    bw,
    bh,
  );
}
// The edge of `svg`: what the PNG and the downloaded file repeat.
export const tileSize = computed(() => composed.value.size);
// Against repetition, for every source: a second copy at a coprime size, and a soft CSS fade.
export const layer2 = ref(false);
export const layer2Settings = reactive<{ -readonly [K in keyof Layer2Settings]: number }>({ ...LAYER2_DEFAULTS });
export function resetLayer2(): void {
  Object.assign(layer2Settings, LAYER2_DEFAULTS);
}
export const fade = ref(false);
// Slow change across the page: a mask that only lowers alpha, so the contrast check (full strength) needs no change.
export const change = ref<ChangeDir>('none');
export const changeTo = ref(0.4);
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

// One small tile per kind for the gallery, as a CSS mask: black at opacity 1, so it depends on kind and seed only.
// The gallery paints the colors and opacity through custom properties, so a color change regenerates nothing.
// ponytail: one Map for the current seed, cleared on a seed change; no LRU.
const previewCache = new Map<Kind, string>();
let previewSeed = NaN;
export function previews(kinds: readonly Kind[]): { kind: Kind; mask: string }[] {
  const seed = params.seed; // read inside the caller's render: a seed change re-renders the gallery
  if (seed !== previewSeed) {
    previewCache.clear();
    previewSeed = seed;
  }
  return kinds.map((kind) => {
    let mask = previewCache.get(kind);
    if (mask === undefined) {
      const tile = generate({
        kind,
        seed,
        size: 64,
        depth: Math.min(2, MAX_DEPTH[kind]),
        strokeWidth: 1,
        precision: 1,
        color: '#000000',
        opacity: 1,
      });
      mask = `url("${svgToDataUri(tile)}")`;
      previewCache.set(kind, mask);
    }
    return { kind, mask };
  });
}

// The stroke opacities the page shows, for the badge and the Fix button alike.
export const spots = computed(() => {
  const layers = layer2.value ? 2 : 1;
  const strength = layer2Settings.opacity;
  return (o: number) => layerSpots(o, layers, strength);
});

// The roles the text is checked against: with the fill when it shows on the tile.
export const checkedRoles = computed(() => ({
  ...roles,
  fill: fillOn.value && closedShapes.value > 0 ? fill.color : null,
  fillOpacity: fill.opacity,
  second: layer2.value && layer2Own.value ? { color: layer2Color.value, strength: layer2Settings.opacity } : null,
  accent: accentShown.value ? accent.value : null,
  grain: grain.on && grain.amount > 0 ? { color: grainColor(grain.tone), opacity: grain.amount / 100 } : null,
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
      : worstAt({ ...r, background: blend(r.fill, r.background, r.fillOpacity), fill: null, accent: null }, opacity.value, spots.value);
  // Text on the accent alone and on a stroke over it, without a plate; null when no accent shape shows.
  const onAccent =
    r.accent === null ? null : worstAt({ ...r, background: r.accent, fill: null, accent: null, grain: null }, opacity.value, spots.value);
  // The paragraph's surface: the plate in 'plate' and 'split', the bare pattern in 'direct'.
  const worst = plateMode.value === 'direct' ? direct : onPlate;
  return {
    textOnBackground,
    textOnPattern,
    onFill,
    onAccent,
    direct,
    onPlate,
    heading: textLevel(direct, true),
    worst,
    pattern: patternContrast(roles, opacity.value),
    patternInvisible: patternInvisible(roles, opacity.value),
    normal: textLevel(worst),
    large: textLevel(worst, true),
    // APCA Lc over the same surfaces, informational only: WCAG 2.2 above stays the check.
    apca: {
      onPlate: apcaWorst(r, opacity.value, plateOpacity.value, spots.value),
      direct: apcaWorst(r, opacity.value, 0, spots.value),
      onFill:
        r.fill === null
          ? null
          : apcaWorst(
              { ...r, background: blend(r.fill, r.background, r.fillOpacity), fill: null, accent: null },
              opacity.value,
              0,
              spots.value,
            ),
      onAccent:
        r.accent === null
          ? null
          : apcaWorst({ ...r, background: r.accent, fill: null, accent: null, grain: null }, opacity.value, 0, spots.value),
    },
  };
});

// Truncated, never rounded up: 4.499 shows as 4.49, so a failing ratio never reads as 4.50.
export function ratioText(r: number): string {
  return (Math.floor(r * 100) / 100).toFixed(2);
}

// The toolbar chip's short form, one decimal, rounded down so a ratio just under a threshold never shows as passing it.
export function ratioShort(r: number): string {
  return (Math.floor(r * 10) / 10).toFixed(1);
}

export const rawBytes = computed(() => rawSize(svg.value));

// No-op in image mode, except Reduce repetition with two or more pictures: the seed deals them.
export const imageShuffles = computed(() => variantsOn.value && (imageVariants.value?.length ?? 0) > 1);
export function reseed(): void {
  if (usingImage.value && !imageShuffles.value) return;
  params.seed = randomSeed();
}

// A visitor's kind choice (not link decoding or undo): the kind, then its preferred stroke, depth, and Reduce repetition (preferred.ts).
// Only on an actual change, so re-picking the current kind keeps values set by hand. Same tick as the kind: one undo entry.
export function chooseKind(kind: Kind): void {
  if (kind === params.kind) return;
  const pref = preferred(kind);
  params.kind = kind;
  params.strokeWidth = pref.stroke;
  params.depth = pref.depth;
  variants.value = pref.variants;
  Object.assign(accentLayer, accentDefaults(kind));
  accentMoves.value = '';
  // Switched on, it varies the base only (as a v=1 link without av); off, the kind's default layer is ready.
  varyApplies.value = variants.value ? 'base' : appliesDefault(kind);
}

// A different kind, a new seed, a single layout, and a sensible Repetition tab (random-design.ts).
// Colors, plate, spacing, motion, soft fade, sections, and parallax stay. All changes land in one tick,
// so the debounced undo history (state-share.ts) records the click as one entry.
export function randomPattern(): void {
  source.value = 'math';
  layout.value = 'single';
  const others = KINDS.filter((k) => k !== params.kind);
  const kind = others[randomSeed() % others.length] ?? params.kind;
  chooseKind(kind);
  params.seed = randomSeed();
  // Depth and the Reduce repetition switch stay as chooseKind set them; only the options are random.
  const r = randomRepetition(kind, Math.random);
  Object.assign(variantOptions, r.variantOptions);
  layer2.value = r.layer2;
  if (r.layer2Settings) Object.assign(layer2Settings, r.layer2Settings);
}

// The Layout examples: spacing back to its defaults, the example's transform and motion. One tick, one undo entry.
export function applyLayoutExample(i: number): void {
  const e = LAYOUT_EXAMPLES[i];
  if (!e) return;
  resetSpacing();
  Object.assign(motion, e.motion);
}
// A random transform; drift, speed, and spacing stay.
export function randomLayoutApply(): void {
  Object.assign(motion, randomLayout(Math.random));
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

export function setLayer2Color(hex: string): void {
  lastFix.value = null;
  layer2Color.value = hex.toLowerCase();
}

export function setAccentColor(hex: string): void {
  lastFix.value = null;
  accent.value = hex.toLowerCase();
}

export function setFillColor(hex: string): void {
  lastFix.value = null;
  fill.color = hex.toLowerCase();
}

// ponytail: choosing a palette always sets the fill color to its soft color, edited or not.
export function applyPalette(p: Palette): void {
  lastFix.value = null;
  // A palette that is not in the curated list (random, or one that came with a link) keeps its five colors here.
  if (!PALETTES.some((x) => x.name === p.name)) randomColors.value = p;
  paletteName.value = p.name;
  fill.color = softOf(p);
  layer2Color.value = accentOf(p);
  accent.value = accentOf(p);
  setRoles(paletteRoles(p.colors));
}

export function randomPalette(): void {
  const p = rollPalette();
  randomColors.value = p;
  applyPalette(p);
}

export function swap(): void {
  lastFix.value = null;
  setRoles(swapRoles(roles));
}

function changedText(parts: string[]): string {
  return parts.length ? `Changed the ${new Intl.ListFormat('en', { type: 'conjunction' }).format(parts)}.` : 'Changed nothing.';
}

export function applyFix(target: number, measure: FixMeasure = 'wcag'): void {
  const before = { text: roles.text, opacity: opacity.value, plate: plateOpacity.value, fill: fill.opacity };
  const score = measure === 'apca' ? APCA_SCORE : undefined;
  const fix = fixWithFill(plateMode.value, checkedRoles.value, opacity.value, plateOpacity.value, target, spots.value, score);
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
  lastFix.value = { measure, target, reached, ratio, heading, changed };
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
  Object.assign(accentLayer, accentDefaults(DEFAULTS.kind));
  accentMoves.value = '';
  Object.assign(accentVary, ACCENT_VARY_DEFAULTS);
  varyApplies.value = appliesDefault(DEFAULTS.kind);
  layer2.value = false;
  layer2Own.value = false;
  resetLayer2();
  fade.value = false;
  change.value = 'none';
  changeTo.value = 0.4;
  parallax.value = false;
  sections.value = false;
  Object.assign(grain, GRAIN_DEFAULTS);
}
