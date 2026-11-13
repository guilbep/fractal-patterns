<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import { LOGO_DEFAULT, logoSvg } from '@/logo.ts';
import { svgToDataUri } from '@/css.ts';
import { formatFootprint, gzipSize, rawSize } from '@/co2.ts';
import { PALETTES } from '@/palettes.ts';
import { safePathData } from '@/motifgrid.ts';
import { DETECTOR_LABELS, DETECTORS, type Detector } from '@/trace.ts';
import { cropToSubject, sampleFlower, traceColors, type Rgba } from './colortrace.ts';
import { inkMask, traceInk } from './inktrace.ts';
import { cropLines, traceLines } from './linetrace.ts';
import { defaultsFor, inkColor, isSvgFile, ownShapes, pickMethod, type OwnMethod, type OwnShape } from './own-motif.ts';
import { importSvg, type SvgImport } from './svg-import.ts';
import { compose, composeSummary } from './compose.ts';
import { INK_MAX_LENGTH, repeatCell, studioSvg, type Repeat } from './model.ts';
import { MOTIF_FAMILIES, MOTIF_LABELS } from './motifs.ts';
import { decodeStudio, designOptions, encodeStudio, MAX_SEED, SIZE_MAX, SIZE_MIN, SIZE_STEP } from './studio-share.ts';

const LOGO_URI = svgToDataUri(logoSvg(LOGO_DEFAULT));
const REPEAT_INFO: readonly (readonly [Repeat, string, string])[] = [
  ['straight', 'Straight', 'The tile repeats side by side in a plain grid.'],
  ['half-drop', 'Half-drop', 'Each column drops by half a tile.'],
  ['brick', 'Brick', 'Each row shifts by half a tile, like brickwork.'],
  ['mirror', 'Mirror', 'Neighbors are mirror images, left to right and top to bottom.'],
];

const design = reactive(decodeStudio(location.hash));
const zoom = ref(100);

// The person's own motif: traced in the browser, never put in the link. Two readings of the image: the longer side at
// 256 px for Color shapes, at 600 px for Ink and Line drawing (line art loses its fine lines at 256).
const ownSmall = shallowRef<Rgba | null>(null);
const ownLarge = shallowRef<Rgba | null>(null);
// An SVG file read as vector shapes (null: traced as an image), and the file itself for "Trace it as an image instead".
const ownVector = shallowRef<SvgImport | null>(null);
const ownSvgFile = shallowRef<File | null>(null);
const own = reactive({
  method: 'color' as OwnMethod,
  colors: 4,
  role: 'hero' as 'hero' | 'support' | 'both',
  keepColors: true,
  detail: 0.6,
  curves: false,
  scale: 1,
  anchor: 'base' as 'base' | 'center',
  inkColor: '#000000',
  detector: 'xdog' as Detector,
  threshold: 0.3,
  minLength: 8,
});
const ownError = ref('');
const METHODS: readonly (readonly [OwnMethod, string])[] = [
  ['color', 'Color shapes (photos and flat art)'],
  ['ink', 'Ink (line art in one color)'],
  ['lines', 'Line drawing (edges)'],
];
watch(
  () => own.method,
  (m) => Object.assign(own, defaultsFor(m)),
);

function setOwnImage(small: Rgba, large: Rgba): void {
  ownVector.value = null;
  ownSmall.value = small;
  ownLarge.value = large;
  const ink = inkMask(large, {});
  own.inkColor = inkColor(large.data, ink.mask);
  own.method = pickMethod(ink);
  Object.assign(own, defaultsFor(own.method));
}
function removeOwn(): void {
  ownSmall.value = ownLarge.value = ownVector.value = ownSvgFile.value = null;
}

const ownResult = computed((): { shapes: OwnShape[]; box: number; count: string; notes: string[] } | null => {
  const v = ownVector.value;
  if (v) return { ...ownShapes({ method: 'svg', result: v }), count: `${v.shapes.length} shapes`, notes: [] };
  const small = ownSmall.value;
  const large = ownLarge.value;
  if (!small || !large) return null;
  const crop = own.anchor === 'base' ? 'bottom' : 'center';
  if (own.method === 'ink') {
    const r = traceInk(large, { size: 100, detail: own.detail, smooth: 0.8, minArea: 0.05, curves: own.curves, maxLength: INK_MAX_LENGTH });
    const c = r.d ? cropToSubject({ shapes: [{ color: own.inkColor, d: r.d, area: 0 }], background: '#ffffff', box: r.box }, 0.04, crop) : null;
    const d = c ? (safePathData(c.shapes[0]!.d, INK_MAX_LENGTH) ?? '') : '';
    const notes: string[] = [];
    if (r.detailUsed > own.detail + 1e-9)
      notes.push(`The drawing is very detailed. Detail was coarsened to ${r.detailUsed.toFixed(2)} to keep the motif at a workable size.`);
    if (r.contrast < 0.2) notes.push('This image does not look like one-color line art. Try Color shapes.');
    return { ...ownShapes({ method: 'ink', result: { d, box: r.box }, color: own.inkColor }), count: `${r.loops} loops (${r.holes} holes)`, notes };
  }
  if (own.method === 'lines') {
    const r = cropLines(
      traceLines(large, { detector: own.detector, threshold: own.threshold, detail: own.detail, minLength: own.minLength, curves: own.curves, size: 100 }),
      0.04,
      crop,
    );
    return { ...ownShapes({ method: 'lines', result: r, color: own.inkColor }), count: `${r.lines} lines`, notes: [] };
  }
  const t = cropToSubject(traceColors(small, { colors: own.colors, size: 100, smooth: 1, tolerance: own.detail, minArea: 4, curves: own.curves }), 0.04, crop);
  return { ...ownShapes({ method: 'color', shapes: t.shapes, box: t.box }), count: `${t.shapes.length} shapes`, notes: [] };
});
// The motif alone, for the preview and its size: built from numbers and safe path data only.
const ownSvgText = computed(() => {
  const r = ownResult.value;
  if (!r) return '';
  const paths = r.shapes.map((c) => {
    const d = safePathData(c.d, INK_MAX_LENGTH) ?? '';
    return c.paint === 'stroke'
      ? `<path fill="none" stroke="${c.color}" stroke-width="${c.width ?? 1.5}" stroke-linecap="round" stroke-linejoin="round" d="${d}"/>`
      : `<path fill="${c.color}"${c.evenodd ? ' fill-rule="evenodd"' : ''} d="${d}"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r.box} ${r.box}">${paths.join('')}</svg>`;
});
const ownPreview = computed(() => (ownSvgText.value ? svgToDataUri(ownSvgText.value) : ''));
const ownBytes = computed(() => rawSize(ownSvgText.value));

// As the pattern tool: the image is drawn into a canvas, its longer side at most `max` px.
function toRgba(src: CanvasImageSource, w: number, h: number, max: number): Rgba {
  const s = Math.min(1, max / Math.max(w, h));
  const width = Math.max(1, Math.round(w * s));
  const height = Math.max(1, Math.round(h * s));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(src, 0, 0, width, height);
  return { data: ctx.getImageData(0, 0, width, height).data, width, height };
}
async function readImage(file: File): Promise<void> {
  if (isSvgFile(file.name, file.type)) {
    // An SVG file is drawn as an image through an <img> and an object URL; its text never enters the page.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const w = img.naturalWidth || 600;
      const h = img.naturalHeight || 600;
      setOwnImage(toRgba(img, w, h, 256), toRgba(img, w, h, 600));
    } finally {
      URL.revokeObjectURL(url);
    }
    return;
  }
  const bitmap = await createImageBitmap(file);
  try {
    setOwnImage(toRgba(bitmap, bitmap.width, bitmap.height, 256), toRgba(bitmap, bitmap.width, bitmap.height, 600));
  } finally {
    bitmap.close();
  }
}
async function onOwnFile(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // the same file can be picked again
  if (!file) return;
  ownError.value = '';
  const svgFile = isSvgFile(file.name, file.type);
  if (!svgFile && !file.type.startsWith('image/')) {
    ownError.value = `"${file.name}" is not an image. Choose a JPEG, PNG, WebP, GIF, or SVG file.`;
    return;
  }
  ownSvgFile.value = svgFile ? file : null;
  if (svgFile) {
    const shapes = importSvg(await file.text());
    if (shapes) {
      removeOwn();
      ownSvgFile.value = file;
      ownVector.value = shapes;
      own.method = 'color';
      return;
    }
  }
  try {
    await readImage(file);
  } catch {
    ownError.value = `The browser could not read "${file.name}" as an image. Try another file or format.`;
  }
}
async function traceSvgFile(): Promise<void> {
  const file = ownSvgFile.value;
  if (!file) return;
  ownError.value = '';
  try {
    await readImage(file);
  } catch {
    ownError.value = `The browser could not draw "${file.name}" as an image.`;
  }
}
function useSample(): void {
  ownError.value = '';
  ownSvgFile.value = null;
  setOwnImage(sampleFlower(128), sampleFlower(400));
}

const studio = computed(() => {
  const r = ownResult.value;
  const o = designOptions(design);
  // TODO(W9d): an ink shape carries `evenodd: true`; compose must forward it to the model motif
  // (motifs.push({ d: c.d, box: custom.box, paint: c.paint, evenodd: c.evenodd })) and accept its path data up to
  // INK_MAX_LENGTH (safePathData(c.d, c.evenodd ? INK_MAX_LENGTH : undefined)). Until then holes fill in and an ink
  // path above 20,000 characters is dropped by the composer.
  return compose(
    r && r.shapes.length > 0
      ? { ...o, custom: { shapes: r.shapes, box: r.box, role: own.role, keepColors: own.keepColors, scale: own.scale, anchor: own.anchor } }
      : o,
  );
});
const svg = computed(() => studioSvg(studio.value));
const cell = computed(() => repeatCell(studio.value));
const uri = computed(() => svgToDataUri(svg.value));
const summary = computed(() => composeSummary(studio.value));
const bg = computed(() => studio.value.background ?? 'transparent');
const css = computed(() => `.wallpaper { background: ${bg.value} url("${uri.value}") 0 0 / ${cell.value.width}px ${cell.value.height}px; }`);
const wallStyle = computed(() => ({
  backgroundColor: bg.value,
  backgroundImage: `url("${uri.value}")`,
  backgroundSize: `${(cell.value.width * zoom.value) / 100}px ${(cell.value.height * zoom.value) / 100}px`,
}));
const fileName = computed(() => `wallpaper-${design.repeat}-${design.seed}.svg`);

// Sizes: raw now, gzipped when CompressionStream answers. A stale answer is dropped.
const raw = computed(() => rawSize(svg.value));
const gz = ref<number | null | 'unknown'>(null);
watch(
  svg,
  async (text) => {
    gz.value = null;
    try {
      const n = await gzipSize(text);
      if (text === svg.value) gz.value = n;
    } catch {
      if (text === svg.value) gz.value = 'unknown';
    }
  },
  { immediate: true },
);
const sizeText = computed(() => `${raw.value} bytes, ${typeof gz.value === 'number' ? `${gz.value} gzipped` : gz.value === null ? 'compressing' : 'gzip size unknown'}`);
const footprintFull = computed(() => (gz.value === null ? 'computing' : gz.value === 'unknown' ? 'size unknown' : formatFootprint(gz.value)));
const footprintText = computed(() => footprintFull.value.split(' / ')[0]);

// The hash follows the design, without new history entries; a pasted link loads its design.
watch(design, (d) => history.replaceState(null, '', `#${encodeStudio(d)}`), { deep: true });
const onHash = () => Object.assign(design, decodeStudio(location.hash));
onMounted(() => window.addEventListener('hashchange', onHash));
onBeforeUnmount(() => window.removeEventListener('hashchange', onHash));

function shuffle(): void {
  design.seed = Math.floor(Math.random() * MAX_SEED);
}
function setSeed(v: string): void {
  const n = Math.round(Number(v));
  if (v.trim() !== '' && Number.isFinite(n)) design.seed = Math.min(MAX_SEED, Math.max(0, n));
}

const copyStatus = ref('');
const showCss = ref(false);
let copyTimer: ReturnType<typeof setTimeout> | undefined;
async function copyCss(): Promise<void> {
  copyStatus.value = '';
  try {
    await navigator.clipboard.writeText(css.value);
    copyStatus.value = 'Copied';
  } catch {
    // No clipboard (insecure context, blocked): show the rule to copy by hand.
    showCss.value = true;
    copyStatus.value = 'Could not copy. Select the CSS below and copy it.';
  }
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => (copyStatus.value = ''), 2500);
}

// Sticky offset under the toolbar, as in the pattern tool.
const bar = ref<HTMLElement | null>(null);
const sizes = new ResizeObserver(() => document.documentElement.style.setProperty('--bar-h', `${bar.value?.offsetHeight ?? 0}px`));
onMounted(() => bar.value && sizes.observe(bar.value));
onBeforeUnmount(() => sizes.disconnect());
</script>

<template>
  <header class="site-header">
    <p class="brand"><img class="logo" :src="LOGO_URI" alt="" width="28" height="28">Wallpaper Studio</p>
    <p class="tagline">Original botanical wallpapers from a seed. Every motif is generated here; nothing is copied.</p>
    <p><a href="./index.html">Pattern tool</a></p>
  </header>

  <div ref="bar" class="toolbar" role="toolbar" aria-label="Wallpaper actions">
    <div class="bar-row">
    <button type="button" class="btn primary" @click="shuffle">Shuffle</button>
    <span class="bar-sep" aria-hidden="true"></span>
    <a class="btn" :href="uri" :download="fileName">Download SVG</a>
    <button type="button" class="btn" @click="copyCss">{{ copyStatus === 'Copied' ? 'Copied' : 'Copy CSS' }}</button>
    </div>
    <div class="bar-stats">
    <span id="svg-size" class="stat">{{ sizeText }}</span>
    <span id="svg-co2" class="stat" :title="footprintFull"><span aria-hidden="true">{{ footprintText }}</span><span class="visually-hidden">{{ footprintFull }}</span></span>
    </div>
    <span class="visually-hidden" role="status" aria-live="polite">{{ copyStatus }}</span>
  </div>

  <main class="layout">
    <div class="stage">
      <div id="wall" class="wall" role="img" :aria-label="`Wallpaper preview, ${REPEAT_INFO.find(([r]) => r === design.repeat)?.[1]} repeat, seed ${design.seed}`" :style="wallStyle"></div>
    </div>

    <div class="controls">
      <section v-if="showCss" class="panel" aria-labelledby="css-h">
        <h2 id="css-h">CSS</h2>
        <label for="css-out" class="visually-hidden">CSS rule</label>
        <textarea id="css-out" class="code" readonly rows="4" :value="css" @focus="($event.target as HTMLTextAreaElement).select()"></textarea>
      </section>

      <section class="panel" aria-labelledby="design-h">
        <h2 id="design-h">Design</h2>
        <div class="fields">
          <div class="field">
            <label for="seed">Seed</label>
            <div class="seed-row">
              <input id="seed" type="number" min="0" :max="MAX_SEED" step="1" :value="design.seed" @input="setSeed(($event.target as HTMLInputElement).value)" @change="($event.target as HTMLInputElement).value = String(design.seed)">
              <button type="button" class="btn" @click="shuffle">Shuffle</button>
            </div>
          </div>
          <div class="field">
            <label for="palette">Palette</label>
            <select id="palette" v-model.number="design.palette">
              <option v-for="(p, i) in PALETTES" :key="p.name" :value="i">{{ p.name }}</option>
            </select>
          </div>
          <div class="field">
            <label for="density">Density <output for="density">{{ Math.round(design.density * 100) }} %</output></label>
            <input id="density" v-model.number="design.density" type="range" min="0" max="1" step="0.01">
          </div>
          <div class="field">
            <label for="size">Tile size <output for="size">{{ design.size }} px</output></label>
            <input id="size" v-model.number="design.size" type="range" :min="SIZE_MIN" :max="SIZE_MAX" :step="SIZE_STEP">
          </div>
          <div class="field">
            <label for="zoom">Preview zoom <output for="zoom">{{ zoom }} %</output></label>
            <input id="zoom" v-model.number="zoom" type="range" min="50" max="200" step="10">
          </div>
        </div>
        <label class="radio"><input id="stems" v-model="design.stems" type="checkbox"> Stems behind the large motifs</label>
      </section>

      <section class="panel" aria-labelledby="repeat-h">
        <h2 id="repeat-h">Repeat</h2>
        <fieldset>
          <legend class="visually-hidden">Repeat type</legend>
          <div class="radios">
            <label v-for="[r, label, desc] in REPEAT_INFO" :key="r" class="radio">
              <input v-model="design.repeat" type="radio" name="repeat" :value="r">
              <span>{{ label }} <span class="repeat-desc">{{ desc }}</span></span>
            </label>
          </div>
        </fieldset>
      </section>

      <section class="panel" aria-labelledby="families-h">
        <h2 id="families-h">Motif families</h2>
        <fieldset>
          <legend class="visually-hidden">Motif families (at least one)</legend>
          <div class="families">
            <label v-for="f in MOTIF_FAMILIES" :key="f" class="radio">
              <input v-model="design.families" type="checkbox" :value="f" :disabled="design.families.length === 1 && design.families.includes(f)">
              {{ MOTIF_LABELS[f] }}
            </label>
          </div>
        </fieldset>
        <p id="summary" class="summary muted">{{ summary.instances }} placements, {{ summary.motifs }} motif definitions, {{ summary.plates }} colors (plates).<template v-if="ownResult"> Your motif: {{ ownResult.count }}.</template></p>
      </section>

      <section class="panel" aria-labelledby="own-h">
        <h2 id="own-h">Your own motif</h2>
        <ul class="image-notes">
          <li>Use only images that you own or have a license for.</li>
          <li>Your image stays in your browser. Nothing is uploaded.</li>
        </ul>
        <div class="fields">
          <div class="field">
            <label for="own-file">Image</label>
            <input id="own-file" type="file" accept="image/*,.svg" @change="onOwnFile">
          </div>
          <button id="own-sample" type="button" class="btn" @click="useSample">Try a sample flower</button>
        </div>
        <p class="error" role="alert">{{ ownError }}</p>
        <template v-if="ownResult">
          <div v-if="ownVector" class="own-vector">
            <p id="own-vector-note">Read as vector shapes: {{ ownVector.shapes.length }} shapes.</p>
            <ul v-if="ownVector.skipped.length > 0" class="image-notes" aria-label="Not read from the file">
              <li v-for="item in ownVector.skipped" :key="item">Not read: {{ item }}</li>
            </ul>
            <button id="own-trace-image" type="button" class="btn" @click="traceSvgFile">Trace it as an image instead</button>
          </div>
          <div class="fields">
            <div v-if="!ownVector" class="field">
              <label for="own-method">Method</label>
              <select id="own-method" v-model="own.method">
                <option v-for="[m, label] in METHODS" :key="m" :value="m">{{ label }}</option>
              </select>
            </div>
            <div v-if="!ownVector && own.method === 'color'" class="field">
              <label for="own-colors">Colors <output for="own-colors">{{ own.colors }}</output></label>
              <input id="own-colors" v-model.number="own.colors" type="range" min="2" max="6" step="1" aria-describedby="own-colors-hint">
              <p id="own-colors-hint" class="hint-text">3 or 4 colors give the cleanest motif. Shaded photos split into bands.</p>
            </div>
            <div v-if="!ownVector && own.method === 'lines'" class="field">
              <label for="own-detector">Edge detector</label>
              <select id="own-detector" v-model="own.detector">
                <option v-for="d in DETECTORS" :key="d" :value="d">{{ DETECTOR_LABELS[d] }}</option>
              </select>
            </div>
            <div v-if="!ownVector && own.method === 'lines'" class="field">
              <label for="own-threshold">Threshold <output for="own-threshold">{{ own.threshold.toFixed(2) }}</output></label>
              <input id="own-threshold" v-model.number="own.threshold" type="range" min="0.05" max="0.9" step="0.05">
            </div>
            <div v-if="!ownVector && own.method === 'lines'" class="field">
              <label for="own-min-length">Shortest line <output for="own-min-length">{{ own.minLength }} px</output></label>
              <input id="own-min-length" v-model.number="own.minLength" type="range" min="2" max="40" step="1">
            </div>
            <div v-if="!ownVector" class="field">
              <label for="own-detail">Detail <output for="own-detail">{{ own.detail.toFixed(2) }}</output></label>
              <input id="own-detail" v-model.number="own.detail" type="range" min="0.15" max="1.2" step="0.05" aria-describedby="own-detail-hint">
              <p id="own-detail-hint" class="hint-text">Lower keeps finer detail; higher gives a smaller motif.</p>
            </div>
            <div v-if="!ownVector && own.method !== 'color'" class="field">
              <label for="own-ink-color">{{ own.method === 'ink' ? 'Ink color' : 'Line color' }}</label>
              <input id="own-ink-color" v-model="own.inkColor" type="color">
            </div>
            <div class="field">
              <label for="own-scale">Size <output for="own-scale">{{ own.scale.toFixed(2) }}</output></label>
              <input id="own-scale" v-model.number="own.scale" type="range" min="0.4" max="3" step="0.05" aria-describedby="own-scale-hint">
              <p id="own-scale-hint" class="hint-text">A larger motif takes more room, so fewer plants fit.</p>
            </div>
            <div class="field">
              <label for="own-anchor">Sits on the stem by</label>
              <select id="own-anchor" v-model="own.anchor">
                <option value="base">Its base</option>
                <option value="center">Its center</option>
              </select>
            </div>
            <div class="field">
              <label for="own-role">Use it as</label>
              <select id="own-role" v-model="own.role">
                <option value="hero">Large motifs</option>
                <option value="support">Leaves along the stems</option>
                <option value="both">Both</option>
              </select>
            </div>
          </div>
          <label v-if="!ownVector" class="radio"><input id="own-curves" v-model="own.curves" type="checkbox"> Smooth curves</label>
          <label class="radio"><input id="own-keep" v-model="own.keepColors" type="checkbox"> Keep the image's colors</label>
          <div class="own-preview">
            <img id="own-preview" :src="ownPreview" alt="Your traced motif" width="96" height="96">
            <div>
              <p id="own-stats" class="muted">{{ ownResult.count }}, {{ ownBytes }} bytes.</p>
              <p v-for="n in ownResult.notes" :key="n" class="hint-text own-note">{{ n }}</p>
            </div>
          </div>
          <button id="own-remove" type="button" class="btn" @click="removeOwn">Remove my motif</button>
        </template>
        <p class="muted">Your motif is not part of the link.</p>
      </section>
    </div>
  </main>
</template>
