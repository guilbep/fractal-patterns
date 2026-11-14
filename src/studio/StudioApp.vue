<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import { useBarHeight } from '@/bar-height.ts';
import ShortcutHint from '@/components/ShortcutHint.vue';
import SiteHeader from '@/components/SiteHeader.vue';
import { isTyping, readShortcut, shortcutFor, toggleFullscreen, writeShortcut } from '@/shortcuts.ts';
import { svgToDataUri } from '@/css.ts';
import SponsorBanner from '@/components/SponsorBanner.vue';
import PageFootprint from '@/components/PageFootprint.vue';
import SizeBadge from '@/components/SizeBadge.vue';
import ToolIcon from '@/components/ToolIcon.vue';
import UiFileDrop from '@/components/UiFileDrop.vue';
import UiSegmented from '@/components/UiSegmented.vue';
import UseIt from '@/components/UseIt.vue';
import { DESTINATIONS, takeUse, type Destination } from '@/use-it.ts';
import { copyText } from '@/clipboard.ts';
import { decodeImage, sample } from '@/image-file.ts';
import { rawSize } from '@/co2.ts';
import { PALETTE_GROUPS, PALETTES, paletteParam, rollPalette } from '@/palettes.ts';
import { stepPalette } from '@/shell.ts';
import PaletteStrip from '@/components/PaletteStrip.vue';
import BottomBar from '@/components/BottomBar.vue';
import PaletteSheet from '@/components/PaletteSheet.vue';
import { safePathData } from '@/motifgrid.ts';
import { DETECTOR_LABELS, DETECTORS, type Detector } from '@/detectors.ts';
import type { Rgba } from './colortrace.ts';
import { defaultsFor, inkColor, inkSpread, isSvgFile, ownShapes, pickMethod, type OwnMethod, type OwnShape } from './own-motif.ts';
import type { SvgImport } from './svg-import.ts';
import { compose, composeSummary, studioTracking, studioTries, THEMES, themeFamilies, type Theme } from './compose.ts';
import { balance } from './tracking.ts';
import { INK_MAX_LENGTH, repeatCell, studioSvg, type Repeat } from './model.ts';
import { decodeStudio, designOptions, encodeStudio, MAX_SEED, SIZE_MAX, SIZE_MIN, SIZE_STEP } from './studio-share.ts';
import { createStudioHistory, isUndoKey } from './studio-history.ts';
import { geneCount } from './genes.ts';

const REPEAT_INFO: readonly (readonly [Repeat, string, string])[] = [
  ['straight', 'Straight', 'The tile repeats side by side in a plain grid.'],
  ['half-drop', 'Half-drop', 'Each column drops by half a tile.'],
  ['brick', 'Brick', 'Each row shifts by half a tile, like brickwork.'],
  ['mirror', 'Mirror', 'Neighbors are mirror images, left to right and top to bottom.'],
];

// A "Send to my phone" link adds use=<destination>: it opens Use it there, and leaves the address before the design is read.
const useFrom = takeUse(location, history);
const design = reactive(decodeStudio(location.hash));
// Breed loads its code when its fold first opens, then stays mounted so its generations stay.
const BreedPanel = defineAsyncComponent(() => import('./BreedPanel.vue'));
const breedOpened = ref(false);
const useChild = (d: typeof design) => Object.assign(design, d);
const clearGenes = () => (design.genes = {});
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
// The tracing code (vectorizer, curve fitting) loads only when a person first picks a file or the sample: a studio
// link never holds an image, so the page does not need it at start.
type Tracers = {
  color: typeof import('./colortrace.ts');
  ink: typeof import('./inktrace.ts');
  lines: typeof import('./linetrace.ts');
  svg: typeof import('./svg-import.ts');
};
let tracers: Tracers | null = null; // set before ownSmall, ownLarge or ownVector, so ownResult can read it
let tracersLoad: Promise<Tracers> | null = null;
function loadTracers(): Promise<Tracers> {
  tracersLoad ??= Promise.all([import('./colortrace.ts'), import('./inktrace.ts'), import('./linetrace.ts'), import('./svg-import.ts')]).then(
    ([color, ink, lines, svg]) => (tracers = { color, ink, lines, svg }),
    (e: unknown) => {
      tracersLoad = null; // a failed load can be tried again
      throw e;
    },
  );
  return tracersLoad;
}
const METHODS: readonly (readonly [OwnMethod, string])[] = [
  ['color', 'Color shapes (photos and flat art)'],
  ['ink', 'Ink (line art in one color)'],
  ['lines', 'Line drawing (edges)'],
];
watch(
  () => own.method,
  (m) => Object.assign(own, defaultsFor(m)),
);

function setOwnImage(t: Tracers, small: Rgba, large: Rgba): void {
  ownVector.value = null;
  ownSmall.value = small;
  ownLarge.value = large;
  const ink = t.ink.inkMask(large, {});
  own.inkColor = inkColor(large.data, ink.mask);
  own.method = pickMethod({ ...ink, spread: inkSpread(large.data, ink.mask) });
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
  const t = tracers;
  if (!small || !large || !t) return null;
  const { cropToSubject, traceColors } = t.color;
  const crop = own.anchor === 'base' ? 'bottom' : 'center';
  if (own.method === 'ink') {
    const r = t.ink.traceInk(large, { size: 100, detail: own.detail, smooth: 0.8, minArea: 0.05, curves: own.curves, maxLength: INK_MAX_LENGTH });
    const c = r.d ? cropToSubject({ shapes: [{ color: own.inkColor, d: r.d, area: 0 }], background: '#ffffff', box: r.box }, 0.04, crop) : null;
    const d = c ? (safePathData(c.shapes[0]!.d, INK_MAX_LENGTH) ?? '') : '';
    const notes: string[] = [];
    if (r.detailUsed > own.detail + 1e-9)
      notes.push(`The drawing is very detailed. Detail was coarsened to ${r.detailUsed.toFixed(2)} to keep the motif at a workable size.`);
    if (r.contrast < 0.2) notes.push('This image does not look like one-color line art. Try Color shapes.');
    return { ...ownShapes({ method: 'ink', result: { d, box: r.box }, color: own.inkColor }), count: `${r.loops} loops (${r.holes} holes)`, notes };
  }
  if (own.method === 'lines') {
    const r = t.lines.cropLines(
      t.lines.traceLines(large, { detector: own.detector, threshold: own.threshold, detail: own.detail, minLength: own.minLength, curves: own.curves, size: 100 }),
      0.04,
      crop,
    );
    return { ...ownShapes({ method: 'lines', result: r, color: own.inkColor }), count: `${r.lines} lines`, notes: [] };
  }
  const c = cropToSubject(traceColors(small, { colors: own.colors, size: 100, smooth: 1, tolerance: own.detail, minArea: 4, curves: own.curves }), 0.04, crop);
  return { ...ownShapes({ method: 'color', shapes: c.shapes, box: c.box }), count: `${c.shapes.length} shapes`, notes: [] };
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

async function readImage(file: File): Promise<void> {
  const t = await loadTracers();
  const image = await decodeImage(file);
  try {
    setOwnImage(t, sample(image, 256), sample(image, 600));
  } finally {
    image.close();
  }
}
async function onOwnFile(file: File | undefined): Promise<void> {
  if (!file) return;
  ownError.value = '';
  const svgFile = isSvgFile(file.name, file.type);
  if (!svgFile && !file.type.startsWith('image/')) {
    ownError.value = `"${file.name}" is not an image. Choose a JPEG, PNG, WebP, GIF, or SVG file.`;
    return;
  }
  ownSvgFile.value = svgFile ? file : null;
  try {
    if (svgFile) {
      const shapes = (await loadTracers()).svg.importSvg(await file.text());
      if (shapes) {
        removeOwn();
        ownSvgFile.value = file;
        ownVector.value = shapes;
        own.method = 'color';
        return;
      }
    }
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
async function useSample(): Promise<void> {
  ownError.value = '';
  ownSvgFile.value = null;
  try {
    const t = await loadTracers();
    setOwnImage(t, t.color.sampleFlower(128), t.color.sampleFlower(400));
  } catch {
    ownError.value = 'The browser could not load the tracing code. Check the connection and try again.';
  }
}

const studio = computed(() => {
  const r = ownResult.value;
  const o = designOptions(design);
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

// Undo and redo cover the whole design (seed, palette, repeat, sliders, options), not the zoom or the own motif.
// `tick` makes canUndo and canRedo recompute after a change; the history commits a pending change itself, and a pending
// change already counts as undoable, so no timer callback is needed.
const snapshot = (): typeof design => JSON.parse(JSON.stringify(design));
const undoHistory = createStudioHistory(snapshot());
const tick = ref(0);
watch(
  design,
  () => {
    undoHistory.record(snapshot());
    tick.value++;
  },
  { deep: true },
);
const canUndo = computed(() => tick.value >= 0 && undoHistory.canUndo());
const canRedo = computed(() => tick.value >= 0 && undoHistory.canRedo());
function apply(state: typeof design | undefined): void {
  if (state) Object.assign(design, state);
  tick.value++;
}
const undo = () => apply(undoHistory.undo());
const redo = () => apply(undoHistory.redo());

// The hash follows the design, without new history entries; a pasted link loads its design.
watch(design, (d) => history.replaceState(null, '', `#${encodeStudio(d)}`), { deep: true });
const onHash = () => {
  Object.assign(design, decodeStudio(location.hash));
  undoHistory.reset(snapshot());
  tick.value++;
};
onMounted(() => window.addEventListener('hashchange', onHash));
onBeforeUnmount(() => window.removeEventListener('hashchange', onHash));

const THEME_HINTS: Partial<Record<Theme, string>> = {
  sea: 'Seaweed, coral, shells, starfish, fish, and bubbles.',
  orchard: 'Fruit and blossom that hang from the branches.',
};
const families = computed(() => themeFamilies(design.theme));
// A new theme starts with all six of its families on.
function setTheme(t: Theme): void {
  design.theme = t;
  // Sea animals on a vine read as tied to a rope: the sea theme starts without stems. The layout is the same.
  design.stems = t !== 'sea';
  design.families = families.value.map((f) => f.id);
}

function shuffle(): void {
  design.seed = Math.floor(Math.random() * MAX_SEED);
}
// The same single-key shortcuts as the pattern tool, with the same stored off switch (WCAG 2.1.4).
const shortcutOn = ref(readShortcut());
watch(shortcutOn, writeShortcut);
const stage = ref<HTMLElement | null>(null);
const fullscreen = () => toggleFullscreen(stage.value);
function onKey(e: KeyboardEvent): void {
  // Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z: design undo and redo, except in form fields, where native text undo wins.
  const step = isUndoKey(e, isTyping(e));
  if (step) {
    e.preventDefault();
    if (step === 'redo') redo();
    else undo();
    return;
  }
  if (!shortcutOn.value) return;
  const action = shortcutFor(e, isTyping(e));
  if (action === 'shuffle') shuffle();
  else if (action === 'fullscreen') fullscreen();
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
// The same palette controls as the pattern tool: previous, next, random, and the grouped select.
const isRandom = computed(() => !PALETTES.some((p) => p.name === design.palette.name));
function stepPal(dir: 1 | -1): void {
  const i = PALETTES.findIndex((p) => p.name === design.palette.name);
  design.palette = PALETTES[stepPalette(i, dir, PALETTES.length)]!;
}
let lastRandom = isRandom.value ? design.palette : null; // "Random" in the select goes back to it
function rollPal(): void {
  design.palette = lastRandom = rollPalette();
}
function pickPalette(name: string): void {
  design.palette = PALETTES.find((p) => p.name === name) ?? lastRandom ?? design.palette;
}
// The pattern tool opens with the same palette.
const toolHref = computed(() => `./index.html#${new URLSearchParams([paletteParam(design.palette)])}`);
function setSeed(v: string): void {
  const n = Math.round(Number(v));
  if (v.trim() !== '' && Number.isFinite(n)) design.seed = Math.min(MAX_SEED, Math.max(0, n));
}

const copyStatus = ref('');
const showCss = ref(false);
let copyTimer: ReturnType<typeof setTimeout> | undefined;
async function copyCss(): Promise<void> {
  copyStatus.value = '';
  if (await copyText(css.value)) copyStatus.value = 'Copied';
  else {
    // No clipboard (insecure context, blocked): show the rule to copy by hand.
    showCss.value = true;
    copyStatus.value = 'Could not copy. Select the CSS below and copy it.';
  }
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => (copyStatus.value = ''), 2500);
}

// Preview chips and the folded sections' one-line summaries.
const themeLabel = computed(() => THEMES.find((t) => t.id === design.theme)?.label ?? design.theme);
const tracked = computed(() => studioTracking(studio.value));
const bal = computed(() => (tracked.value ? balance(tracked.value) : null));
const optionsSummary = computed(
  () =>
    [design.balance && 'auto balance', design.ground && 'ground', design.large && 'large tile', design.stems && 'stems'].filter(Boolean).join(' · ') ||
    'none',
);
const OWN_SUMMARY: Record<OwnMethod, string> = { color: 'color shapes', ink: 'ink', lines: 'line drawing' };
const ownSummary = computed(() => (!ownResult.value ? 'none · drop an SVG or image' : ownVector.value ? 'SVG shapes' : OWN_SUMMARY[own.method]));
const SIZE_PRESETS = [200, 300, 400, 500].map((v) => ({ value: v, label: String(v) }));
// Decorative theme pictures for the theme cards, as on the design board (picture colors, not UI colors).
const THEME_THUMBS: Record<Theme, string> = {
  floral: `url("${svgToDataUri(
    '<svg xmlns="http://www.w3.org/2000/svg" width="308" height="308" viewBox="0 0 200 200"><rect width="200" height="200" fill="#F2ECE0"/><path d="M20 120C34 92 44 62 70 40" fill="none" stroke="#5E7B5A" stroke-width="2"/><path d="M44 84C30 80 22 68 24 56C38 60 46 72 44 84Z" fill="#7E9A73"/><path d="M52 70C62 60 76 58 86 64C78 74 64 76 52 70Z" fill="#5E7B5A"/><g transform="translate(70 40)" fill="#C8553D"><circle r="7"/><circle cy="-11" r="7"/><circle cx="10" cy="-4" r="7"/><circle cx="7" cy="9" r="7"/><circle cx="-7" cy="9" r="7"/><circle cx="-10" cy="-4" r="7"/><circle r="5" fill="#F0B84A"/></g><path d="M100 116C108 104 118 98 128 98C124 110 112 118 100 116Z" fill="#7E9A73"/><circle cx="104" cy="22" r="4" fill="#F0B84A"/><circle cx="112" cy="30" r="3" fill="#C8553D"/><circle cx="16" cy="18" r="3" fill="#5E7B5A"/><circle cx="24" cy="28" r="2.5" fill="#5E7B5A"/></svg>',
  )}")`,
  sea: `url("${svgToDataUri(
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="24"><rect width="40" height="24" fill="#E3EEF0"/><path d="M0 12Q10 2 20 12T40 12" fill="none" stroke="#2C6E80" stroke-width="2"/><circle cx="30" cy="20" r="2" fill="#E07A3F"/></svg>',
  )}")`,
  orchard: `url("${svgToDataUri(
    '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><rect width="36" height="36" fill="#F3EEDC"/><circle cx="12" cy="14" r="6" fill="#B8432F"/><path d="M12 8C14 4 18 3 20 4C18 7 15 8 12 8Z" fill="#5E7B5A"/><circle cx="28" cy="30" r="4" fill="#E0A82E"/></svg>',
  )}")`,
};
// "Use it…": the device preview takes the stage and the Use it panel the controls column; the design stays mounted, hidden.
// Not stored and not in the link. The panel mounts on first open and stays, so its choices survive "Back to the design".
const useOpen = ref(false);
const useOpened = ref(false);
const useBtn = ref<HTMLButtonElement | null>(null);
// Phones: "Use it" is a bottom sheet over the page (REDESIGN-SPEC §4); the one UseIt panel moves into it (Teleport), so its choices stay.
const phoneMq = matchMedia('(max-width: 599.98px)');
const phone = ref(phoneMq.matches);
phoneMq.addEventListener('change', (e) => {
  phone.value = e.matches;
  if (e.matches) useOpen.value = false;
  else useSheet.value?.close();
});
const useSheet = ref<InstanceType<typeof PaletteSheet> | null>(null);
async function useIt(e: MouseEvent): Promise<void> {
  if (phone.value) {
    useOpened.value = true;
    return useSheet.value?.open(e.currentTarget as HTMLElement);
  }
  useOpen.value = useOpened.value = true;
  await nextTick();
  // The step heading is a legend inside the shared panel: made focusable here so focus lands on "1 · What is it for?".
  const h = document.querySelector<HTMLElement>('.studio-use .use-it-panel legend');
  if (h) {
    h.tabIndex = -1;
    h.focus();
  }
}
// Phones: the bottom bar's Use it cell opened it (the toolbar button is hidden there).
const barUseBtn = ref<HTMLButtonElement | null>(null);
const sheet = ref<InstanceType<typeof PaletteSheet> | null>(null);
function closeUse(): void {
  useOpen.value = false;
  (useBtn.value?.offsetParent ? useBtn.value : barUseBtn.value)?.focus();
}
// The last destination, for the session only; "Website background" (the Studio's export) first.
const USE_KEY = 'fp-use-studio';
function readUse(): Destination['id'] {
  try {
    return DESTINATIONS.find((d) => d.id === sessionStorage.getItem(USE_KEY))?.id ?? 'web';
  } catch {
    return 'web';
  }
}
const useInitial = useFrom ?? readUse();
if (useFrom && !phone.value) useOpen.value = useOpened.value = true;
onMounted(async () => {
  if (!useFrom || !phone.value || !barUseBtn.value) return;
  useOpened.value = true;
  await nextTick();
  useSheet.value?.open(barUseBtn.value);
});
// The link holds the design; the visitor's own motif never travels in it.
const shareLink = () => `${location.href.split('#')[0]}#${encodeStudio(design)}`;
const noLink = computed(() =>
  ownResult.value && ownResult.value.shapes.length > 0 ? 'This design uses your image, so it cannot travel by link.' : undefined,
);
function writeUse(id: Destination['id']): void {
  try {
    sessionStorage.setItem(USE_KEY, id);
  } catch {
    /* storage blocked: the choice resets on reload */
  }
}

// Sticky offset under the toolbar, as in the pattern tool.
const bar = ref<HTMLElement | null>(null);
useBarHeight(bar);
// The preview fills the window under the header and the toolbar, so its corner chips show at load.
const head = ref<HTMLElement | null>(null);
onMounted(() => (head.value = document.querySelector<HTMLElement>('.site-header')));
useBarHeight(head, '--head-h');
</script>

<template>
  <SiteHeader v-model:shortcut="shortcutOn" current="studio" :patterns-href="toolHref" studio-href="./studio.html" tagline="Original botanical wallpapers from a seed. Every motif is generated here; nothing is copied." />

  <div ref="bar" class="toolbar" role="toolbar" aria-label="Wallpaper actions">
    <div class="bar-make">
      <button type="button" class="btn primary" @click="shuffle"><ToolIcon name="shuffle" />Shuffle</button>
      <button type="button" class="btn secondary tool-btn" :disabled="!canUndo" aria-label="Undo" title="Undo (Ctrl/Cmd+Z)" aria-keyshortcuts="Control+Z Meta+Z" @click="undo"><ToolIcon name="undo" /></button>
      <button type="button" class="btn secondary tool-btn" :disabled="!canRedo" aria-label="Redo" title="Redo (Ctrl/Cmd+Shift+Z)" aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z" @click="redo"><ToolIcon name="redo" /></button>
      <span class="bar-sep" aria-hidden="true"></span>
      <PaletteStrip :colors="design.palette.colors" :name="design.palette.name" @previous="stepPal(-1)" @next="stepPal(1)" @random="rollPal" />
    </div>
    <div class="bar-stats">
      <SizeBadge :svg="svg" />
    </div>
    <div class="bar-out">
      <button type="button" class="btn secondary" @click="copyCss">{{ copyStatus === 'Copied' ? 'Copied' : 'Copy CSS' }}</button>
      <button ref="useBtn" type="button" class="btn use-it" @click="useIt">Use it…</button>
    </div>
    <span class="visually-hidden" role="status" aria-live="polite">{{ copyStatus }}</span>
  </div>

  <BottomBar label="Main actions">
    <button type="button" class="primary" @click="shuffle"><ToolIcon name="shuffle" />Shuffle</button>
    <button type="button" :disabled="!canUndo" aria-label="Undo" title="Undo (Ctrl/Cmd+Z)" aria-keyshortcuts="Control+Z Meta+Z" @click="undo"><ToolIcon name="undo" /></button>
    <button type="button" :disabled="!canRedo" aria-label="Redo" title="Redo (Ctrl/Cmd+Shift+Z)" aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z" @click="redo"><ToolIcon name="redo" /></button>
    <button type="button" aria-label="Palette" title="Palette" aria-haspopup="dialog" @click="sheet?.open($event.currentTarget as HTMLElement)">
      <span class="bar-swatches" aria-hidden="true"><span v-for="(c, i) in design.palette.colors.slice(0, 4)" :key="i" :style="{ background: c }"></span></span>
    </button>
    <button ref="barUseBtn" type="button" class="ink" aria-haspopup="dialog" @click="useIt"><ToolIcon name="download" />Use it</button>
  </BottomBar>
  <PaletteSheet ref="sheet" title="Palette">
    <PaletteStrip :colors="design.palette.colors" :name="design.palette.name" @previous="stepPal(-1)" @next="stepPal(1)" @random="rollPal" />
    <div class="sheet-more">
      <h3>More</h3>
      <button type="button" class="btn secondary" @click="copyCss">{{ copyStatus === 'Copied' ? 'Copied' : 'Copy CSS' }}</button>
    </div>
    <!-- The page's live region is inert behind the modal sheet: this one speaks while the sheet is open. -->
    <p class="sheet-status" role="status">{{ copyStatus }}</p>
  </PaletteSheet>
  <PaletteSheet ref="useSheet" class="sheet-use" title="Use it">
    <div id="use-sheet-preview" class="use-stage"></div>
    <div id="use-sheet-steps" class="studio-use"></div>
  </PaletteSheet>

  <main class="layout">
    <div ref="stage" class="stage" :class="{ 'stage-use': useOpen }">
      <ShortcutHint :on="shortcutOn" />
      <div id="wall" class="wall" role="img" :aria-label="`Wallpaper preview, ${REPEAT_INFO.find(([r]) => r === design.repeat)?.[1]} repeat, seed ${design.seed}`" :style="wallStyle"></div>
      <div class="wall-chips">
        <!-- Phones: the toolbar's size chip moves here (design board Mobile-Studio). -->
        <SizeBadge class="wall-chip phone-only" :svg="svg" />
        <span class="wall-chip mono">{{ themeLabel }} · seed {{ design.seed }} · {{ design.size }} px</span>
        <span v-if="bal" id="tracking" class="wall-chip balance" :class="bal.label" :title="`${studioTries(studio) ? `Best of ${studioTries(studio)} tries. ` : ''}Worst part: ${bal.worst}`"><template v-if="bal.label === 'good'">✓ </template>Balance {{ bal.label }}</span>
      </div>
      <button type="button" class="wall-full" aria-label="Full screen" title="Full screen (F)" :aria-keyshortcuts="shortcutOn ? 'F' : undefined" @click="fullscreen">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" /></svg>
      </button>
      <!-- Use it draws its device preview here; the wallpaper stays underneath (hidden), so full screen keeps working. -->
      <div v-show="useOpen" id="use-preview" class="use-stage" @keydown.esc="closeUse"></div>
    </div>

    <div class="controls studio-controls">
      <div v-if="useOpened" v-show="useOpen" class="studio-use" @keydown.esc="closeUse">
        <button type="button" class="btn secondary use-back" @click="closeUse"><span aria-hidden="true">‹&nbsp;</span>Back to the design</button>
        <Teleport defer to="#use-sheet-steps" :disabled="!phone">
        <UseIt
          :svg="svg"
          :tile-width="cell.width"
          :tile-height="cell.height"
          :background="studio.background ?? null"
          :base-name="fileName.replace(/\.svg$/, '')"
          :svg-href="uri"
          :svg-file-name="fileName"
          :initial="useInitial"
          :preview-target="phone ? '#use-sheet-preview' : '#use-preview'"
          :share-link="shareLink"
          :no-link="noLink"
          @destination="writeUse"
        >
          <template #web>
            <div class="use-web">
              <div class="use-web-actions">
                <button type="button" class="btn primary" @click="copyCss">{{ copyStatus === 'Copied' ? 'Copied' : 'Copy CSS' }}</button>
                <a class="btn" :href="uri" :download="fileName">Download SVG</a>
              </div>
              <!-- The toolbar's live region announces the status; in the phone sheet it is inert behind the modal, so this line speaks. -->
              <p v-if="copyStatus || phone" class="use-it-note" :role="phone ? 'status' : undefined">{{ copyStatus }}</p>
              <label for="use-css-out">CSS rule</label>
              <textarea id="use-css-out" class="code" readonly rows="6" :value="css" @focus="($event.target as HTMLTextAreaElement).select()"></textarea>
            </div>
          </template>
        </UseIt>
        </Teleport>
      </div>
      <section v-if="showCss" class="panel" aria-labelledby="css-h">
        <h2 id="css-h">CSS</h2>
        <label for="css-out" class="visually-hidden">CSS rule</label>
        <textarea id="css-out" class="code" readonly rows="4" :value="css" @focus="($event.target as HTMLTextAreaElement).select()"></textarea>
      </section>

      <div v-show="!useOpen" class="studio-design">
      <section class="s-card design-card" aria-label="Design">
        <fieldset class="span-2 theme-field" :aria-describedby="THEME_HINTS[design.theme] ? 'theme-hint' : undefined">
          <legend class="s-label">Theme</legend>
          <div class="theme-cards">
            <label v-for="t in THEMES" :key="t.id" class="theme-card">
              <input :id="`theme-${t.id}`" class="visually-hidden" type="radio" name="theme" :value="t.id" :checked="design.theme === t.id" @change="setTheme(t.id)">
              <span class="theme-thumb" :style="{ backgroundImage: THEME_THUMBS[t.id] }" aria-hidden="true"></span>
              <span class="theme-name">{{ t.label }}</span>
            </label>
          </div>
          <p v-if="THEME_HINTS[design.theme]" id="theme-hint" class="hint-text">{{ THEME_HINTS[design.theme] }}</p>
        </fieldset>
        <div class="field">
          <label for="seed">Seed</label>
          <div class="seed-row">
            <input id="seed" type="number" min="0" :max="MAX_SEED" step="1" :value="design.seed" @input="setSeed(($event.target as HTMLInputElement).value)" @change="($event.target as HTMLInputElement).value = String(design.seed)">
            <button type="button" class="seed-shuffle" aria-label="Shuffle" title="Shuffle: another seed" @click="shuffle"><span aria-hidden="true">↻</span></button>
          </div>
        </div>
        <div class="field">
          <label for="palette">Palette</label>
          <select id="palette" :value="design.palette.name" @change="pickPalette(($event.target as HTMLSelectElement).value)">
            <option v-if="isRandom" value="Random">Random</option>
            <optgroup v-for="g in PALETTE_GROUPS" :key="g.label" :label="g.label">
              <option v-for="p in g.palettes" :key="p.name" :value="p.name">{{ p.name }}</option>
            </optgroup>
          </select>
        </div>
        <div class="field size-field">
          <label for="size">Tile size <output for="size">{{ design.size }} px</output></label>
          <UiSegmented class="size-presets" name="size-preset" label="Tile size presets" :options="SIZE_PRESETS" :model-value="design.size" @update:model-value="(v) => (design.size = Number(v))" />
          <input id="size" v-model.number="design.size" type="range" :min="SIZE_MIN" :max="SIZE_MAX" :step="SIZE_STEP">
        </div>
        <div class="field">
          <label for="density">Density <output for="density">{{ Math.round(design.density * 100) }} %</output></label>
          <input id="density" v-model.number="design.density" type="range" min="0" max="1" step="0.01">
        </div>
        <div class="field">
          <label for="zoom">Preview zoom <output for="zoom">{{ zoom }} %</output></label>
          <input id="zoom" v-model.number="zoom" type="range" min="50" max="200" step="10">
        </div>
      </section>

      <details class="s-card fold">
        <summary><span class="fold-title">Options</span><span class="fold-sum">{{ optionsSummary }}</span><span class="fold-mark" aria-hidden="true">▸</span></summary>
        <div class="fold-body options">
          <label class="radio"><input id="balance" v-model="design.balance" type="checkbox" aria-describedby="balance-hint"> Balance automatically</label>
          <p id="balance-hint" class="hint-text">Composes again when the wallpaper has a dense strip or a large empty area, and keeps the best of up to six tries. Not used with Large tile.</p>
          <label class="radio"><input id="ground" v-model="design.ground" type="checkbox" aria-describedby="ground-hint"> Ground layer</label>
          <p id="ground-hint" class="hint-text">A quiet layer of small foliage behind the plants, in the soft color of the palette. It adds depth and fills empty areas.</p>
          <label class="radio"><input id="large" v-model="design.large" type="checkbox" aria-describedby="large-hint"> Large tile</label>
          <p id="large-hint" class="hint-text">Composes one tile of twice the width and height, with about four times the plants. The picture comes back four times less often. About three times the bytes.</p>
          <label class="radio"><input id="stems" v-model="design.stems" type="checkbox"> Show stems</label>
        </div>
      </details>

      <details class="s-card fold">
        <summary><span class="fold-title">Repeat</span><span class="fold-sum">{{ design.repeat }}</span><span class="fold-mark" aria-hidden="true">▸</span></summary>
        <fieldset class="fold-body">
          <legend class="visually-hidden">Repeat type</legend>
          <div class="radios">
            <label v-for="[r, label, desc] in REPEAT_INFO" :key="r" class="radio">
              <input v-model="design.repeat" type="radio" name="repeat" :value="r">
              <span>{{ label }} <span class="repeat-desc">{{ desc }}</span></span>
            </label>
          </div>
        </fieldset>
      </details>

      <details class="s-card fold">
        <summary><span class="fold-title">Motif families</span><span class="fold-sum">{{ design.families.length }} of {{ families.length }}</span><span class="fold-mark" aria-hidden="true">▸</span></summary>
        <fieldset class="fold-body">
          <legend class="visually-hidden">Motif families (at least one)</legend>
          <div class="families">
            <label v-for="f in families" :key="f.id" class="radio">
              <input v-model="design.families" type="checkbox" :value="f.id" :disabled="design.families.length === 1 && design.families.includes(f.id)">
              {{ f.label }}
            </label>
          </div>
        </fieldset>
      </details>

      <details class="s-card fold" @toggle="breedOpened ||= ($event.target as HTMLDetailsElement).open">
        <summary><span class="fold-title">Breed</span><span class="fold-sum sans">{{ geneCount(design.genes) > 0 ? `${geneCount(design.genes)} genes set` : 'from this one' }}</span><span class="fold-mark" aria-hidden="true">▸</span></summary>
        <div class="fold-body">
          <BreedPanel v-if="breedOpened" :design="design" @use="useChild" @clear-genes="clearGenes" />
        </div>
      </details>

      <details class="s-card fold">
        <summary><span class="fold-title">Your own motif</span><span class="fold-sum sans">{{ ownSummary }}</span><span class="fold-mark" aria-hidden="true">▸</span></summary>
        <div class="fold-body">
        <ul class="image-notes">
          <li>Use only images that you own or have a license for.</li>
          <li>Your image stays in your browser. Nothing is uploaded.</li>
        </ul>
        <div class="fields">
          <!-- The privacy note above already says the same, so the zone's own line is hidden here. -->
          <UiFileDrop id="own-file" label="Image" accept="image/*,.svg" hide-privacy @files="(f) => onOwnFile(f[0])" />
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
        </div>
      </details>

      <p id="summary" class="summary muted">{{ summary.instances }} placements, {{ summary.motifs }} motif definitions, {{ summary.plates }} colors (plates).<template v-if="ownResult"> Your motif: {{ ownResult.count }}.</template></p>
      </div>
    </div>
  </main>
  <footer class="site-footer">
    <p><a href="https://github.com/guilbep/patterns">Source on GitHub</a></p>
    <PageFootprint />
    <SponsorBanner />
  </footer>
</template>
