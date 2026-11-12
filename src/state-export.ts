// What the page copies: the complete CSS, and an optional script that switches the tile. Reads state.ts only.
import { computed, ref } from 'vue';
import { APP_NAME } from '@/app-name.ts';
import { exportCss, exportJs } from '@/export.ts';
import { KIND_LABELS } from '@/fractal.ts';
import { DETECTOR_LABELS } from '@/trace.ts';
import { motion, params, patch, plateBlur, plateMode, plateOpacity, plateRadius, roles, svg, svgForSeed, tileSize, trace, usingImage, usingPatchwork } from '@/state.ts';

// Enough to make the tile again.
export const exportLabel = computed(() =>
  usingImage.value
    ? `Traced image, ${DETECTOR_LABELS[trace.detector]} edges`
    : usingPatchwork.value
      ? `Patchwork ${patch.cells} by ${patch.cells}, seed ${params.seed}`
      : `${KIND_LABELS[params.kind]}, seed ${params.seed}, depth ${params.depth}`,
);

export const exportText = computed(() =>
  exportCss({
    svg: svg.value,
    tileSize: tileSize.value,
    background: roles.background,
    text: roles.text,
    plate: { mode: plateMode.value, opacity: plateOpacity.value, radius: plateRadius.value, blur: plateBlur.value },
    motion,
    label: exportLabel.value,
    appName: APP_NAME,
  }),
);

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
export const exportBytes = computed(() => cssBytes.value + scriptBytes.value);
