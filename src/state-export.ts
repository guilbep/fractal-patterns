// What the page copies: the complete CSS, and an optional script that switches the tile. Reads state.ts only.
import { computed, ref, watch } from 'vue';
import { APP_NAME } from '@/app-name.ts';
import { formatFootprint, gzipSize } from '@/co2.ts';
import { exportCss, exportJs, exportParallax, type ExportInput } from '@/export.ts';
import { KIND_LABELS } from '@/fractal.ts';
import { DETECTOR_LABELS } from '@/trace.ts';
import { scaledSecondSize } from '@/layers.ts';
import {
  fade,
  layer2,
  layer2Settings,
  motion,
  params,
  parallax,
  patch,
  plateBlur,
  plateMode,
  plateOpacity,
  plateRadius,
  roles,
  sections,
  svg,
  svgForSeed,
  tileSize,
  trace,
  usingImage,
  usingPatchwork,
} from '@/state.ts';

// Enough to make the tile again.
export const exportLabel = computed(() =>
  usingImage.value
    ? `Traced image, ${DETECTOR_LABELS[trace.detector]} edges`
    : usingPatchwork.value
      ? `Patchwork ${patch.cells} by ${patch.cells}, seed ${params.seed}`
      : `${KIND_LABELS[params.kind]}, seed ${params.seed}, depth ${params.depth}`,
);

const exportInput = computed<ExportInput>(() => ({
  svg: svg.value,
  tileSize: tileSize.value,
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
          svg: svgForSeed((params.seed + 1) >>> 0),
          tileSize: scaledSecondSize(tileSize.value, layer2Settings.scale),
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
export const footprint = computed(() => (exportGzipBytes.value === null ? null : formatFootprint(exportGzipBytes.value)));
