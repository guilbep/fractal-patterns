// What the page copies: the complete CSS, and an optional script that switches the tile. Reads state.ts only.
import { computed, ref, shallowRef, watch } from 'vue';
import { APP_NAME } from '@/app-name.ts';
import { formatFootprint, gzipSize, sizeLines } from '@/co2.ts';
import { exportCss, exportJs, exportParallax, type ExportInput } from '@/export.ts';
import { KIND_LABELS, extraPath, geometry, tileHeight } from '@/fractal.ts';
import { altUnavailable } from '@/alt-export.ts';
import { patchworkGeometry } from '@/patchwork.ts';
import { squareScene } from '@/scene.ts';
import { mirrorTile, withGap, zoomWrap } from '@/spacing.ts';
import { traceName } from '@/detectors.ts';
import { scaledSecondSize } from '@/layers.ts';
import {
  aspect,
  curvesOn,
  opacity,
  spacing,
  traced,
  variantsOn,
  fade,
  layer2,
  layer2Color,
  layer2Own,
  layer2Settings,
  motion,
  params,
  parallax,
  patch,
  plateBlur,
  plateMode,
  plateOpacity,
  plateRadius,
  rawBytes,
  roles,
  sections,
  svg,
  svgForSeed,
  tileSize,
  trace,
  usingImage,
  usingPatchwork,
} from '@/state.ts';
import type { Pt } from '@/patterns/util.ts';

// Enough to make the tile again.
export const exportLabel = computed(() =>
  usingImage.value
    ? `Traced image, ${traceName(trace.detector)}`
    : usingPatchwork.value
      ? `Patchwork ${patch.cells} by ${patch.cells}, seed ${params.seed}`
      : `${KIND_LABELS[params.kind]}, seed ${params.seed}, depth ${params.depth}`,
);

const exportInput = computed<ExportInput>(() => ({
  svg: svg.value,
  tileSize: tileSize.value,
  ...(aspect.value !== 1 ? { tileHeight: tileHeight(tileSize.value, aspect.value) } : {}),
  background: roles.background,
  text: roles.text,
  plate: { mode: plateMode.value, opacity: plateOpacity.value, radius: plateRadius.value, blur: plateBlur.value },
  motion,
  label: exportLabel.value,
  appName: APP_NAME,
  // The second tile: the next seed (a traced image gives the same tile), at a size coprime with the first, with its own settings.
  ...(layer2.value
    ? {
        second: {
          ...layer2Settings,
          // With its own color the second tile is drawn in it; else in the pattern color, byte-identical to before.
          svg: svgForSeed((params.seed + 1) >>> 0, layer2Own.value ? layer2Color.value : roles.pattern),
          tileSize: scaledSecondSize(tileSize.value, layer2Settings.scale),
          // The second layer keeps the aspect of the first.
          ...(aspect.value !== 1 ? { tileHeight: tileHeight(scaledSecondSize(tileSize.value, layer2Settings.scale), aspect.value) } : {}),
        },
      }
    : {}),
  fade: fade.value,
  parallax: layer2.value && parallax.value,
  sections: sections.value,
}));

export const exportText = computed(() => exportCss(exportInput.value));
// The demo box under the Parallax control: the export's parallax block on the box's own named scroll timeline.
export const parallaxDemoCss = computed(() => exportParallax(exportInput.value, 'fp-parallax-demo', '--fp-demo').join('\n'));

export const scriptOn = ref(false);
export const scriptEvent = ref<'click' | 'load'>('click');
export const scriptCount = ref(3); // 2 to 5

// The first variant is the current seed, so the first tile is the one in the CSS.
export const exportScript = computed(() => {
  if (!scriptOn.value || usingImage.value) return '';
  const n = Math.min(5, Math.max(2, Math.round(scriptCount.value) || 2));
  const tiles = Array.from({ length: n }, (_, i) => svgForSeed((params.seed + i) >>> 0));
  return exportJs(tiles, scriptEvent.value);
});

const utf8 = new TextEncoder();
export const cssBytes = computed(() => utf8.encode(exportText.value).length);
export const scriptBytes = computed(() => utf8.encode(exportScript.value).length);

// What a visitor downloads: the gzipped CSS plus the gzipped script when there is one.
// null while the first sizes compute; 'unknown' when gzip fails. Latest wins.
export const gzipped = ref<{ css: number; script: number } | null | 'unknown'>(null);
let request = 0;
watch(
  [exportText, exportScript],
  async ([c, s]) => {
    const id = ++request;
    try {
      const [css, script] = await Promise.all([gzipSize(c), s ? gzipSize(s) : 0]);
      if (id === request) gzipped.value = { css, script };
    } catch {
      if (id === request) gzipped.value = 'unknown';
    }
  },
  { immediate: true },
);
export const exportGzipBytes = computed(() =>
  gzipped.value && gzipped.value !== 'unknown' ? gzipped.value.css + gzipped.value.script : null,
);
// The size breakdown: the size badge tooltip and the Export tab.
export const sizeBreakdown = computed(() =>
  sizeLines({ css: cssBytes.value, svg: rawBytes.value, script: scriptBytes.value, gz: gzipped.value }),
);
export const footprint = computed(() => (exportGzipBytes.value === null ? null : formatFootprint(exportGzipBytes.value)));

// Other formats: the canvas script and the paint worklet, a view on the current design.
// The scene repeats the plain-tile pipeline of state.ts (tileFor is private there): math, patchwork, or traced polylines, then mirror, zoom, gap.
export const altFormat = ref<'canvas' | 'worklet'>('canvas');
export const altOpen = ref(false); // nothing is computed while the group is collapsed
export const altReason = computed(() =>
  altUnavailable({
    curves: curvesOn.value,
    extra: aspect.value !== 1 ? extraPath(params) : '',
    variants: variantsOn.value,
    layer2: layer2.value,
  }),
);
const altScene = computed(() => {
  const size = params.size;
  let polys: readonly (readonly Pt[])[] =
    usingImage.value && traced.value
      ? traced.value
      : usingPatchwork.value
        ? patchworkGeometry({ ...patch, seed: params.seed, depth: params.depth, size })
        : geometry(params);
  let w = size;
  // Spacing applies to a square tile only, as in the preview.
  if (aspect.value === 1) {
    if (spacing.mirror) polys = mirrorTile(polys, size);
    if (spacing.zoom !== 1) polys = zoomWrap(polys, size, spacing.zoom);
    if (spacing.gap > 0) ({ polys, size: w } = withGap(polys, size, spacing.gap));
  }
  const scene = squareScene(polys, { size: w, strokeWidth: params.strokeWidth, color: roles.pattern, opacity: opacity.value });
  return { ...scene, height: tileHeight(w, aspect.value) };
});
// The canvas export code loads when the group first opens.
const canvasExport = shallowRef<typeof import('@/canvas-export.ts') | null>(null);
watch(
  altOpen,
  (open) => {
    if (open && !canvasExport.value) void import('@/canvas-export.ts').then((m) => (canvasExport.value = m));
  },
  { immediate: true },
);
export const altText = computed(() => {
  if (!altOpen.value || altReason.value || !canvasExport.value) return '';
  const { exportCanvasJs, exportPaintWorklet } = canvasExport.value;
  if (altFormat.value === 'canvas') return exportCanvasJs(altScene.value, roles.background, params.precision);
  const { worklet, css, register } = exportPaintWorklet(altScene.value, roles.background, params.precision);
  return [`// fp-pattern.worklet.js`, worklet, '', '/* CSS */', css, '', '// Register (in the page)', register].join('\n');
});
export const altBytes = computed(() => utf8.encode(altText.value).length);
export const altGzip = ref<number | null | 'unknown'>(null);
let altRequest = 0;
watch(
  altText,
  async (t) => {
    const id = ++altRequest;
    altGzip.value = null;
    try {
      const n = t ? await gzipSize(t) : 0;
      if (id === altRequest) altGzip.value = n;
    } catch {
      if (id === altRequest) altGzip.value = 'unknown';
    }
  },
  { immediate: true },
);
