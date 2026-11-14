<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { APP_NAME } from '@/app-name.ts';
import { useBarHeight } from '@/bar-height.ts';
import { traceName } from '@/detectors.ts';
import ShortcutHint from '@/components/ShortcutHint.vue';
import SiteHeader from '@/components/SiteHeader.vue';
import { isTyping, readShortcut, shortcutFor, toggleFullscreen, writeShortcut } from '@/shortcuts.ts';
import { KIND_LABELS, tileHeight } from '@/fractal.ts';
import UseIt from '@/components/UseIt.vue';
import { DESTINATIONS, takeUse, type Destination } from '@/use-it.ts';
import { SAMPLE_LABELS } from '@/samples.ts';
import { activeSample, contrast, grain, palette, layer2, variantsOn, fileName, motionPaused, params, patch, roles, svg, usingPatchwork, plateMode, plateStyle, randomPattern, ratioShort, ratioText, reseed, reset, svgHref, trace, traced, usingImage, imageShuffles, tileSize, baseTileSize, aspect, variantOptions, accentEditing } from '@/state.ts';
import { exportGzipBytes, exportText, gzipped, sizeBreakdown } from '@/state-export.ts';
import SizeBadge from '@/components/SizeBadge.vue';
import AccentEditor from '@/components/AccentEditor.vue';
import ToolIcon from '@/components/ToolIcon.vue';
import ColorPanel from '@/components/ColorPanel.vue';
import VisionPanel from '@/components/VisionPanel.vue';
import PatternPanel from '@/components/PatternPanel.vue';
import OutputPanel from '@/components/OutputPanel.vue';
import SpacingPanel from '@/components/SpacingPanel.vue';
import MotionPanel from '@/components/MotionPanel.vue';
import LayoutPresets from '@/components/LayoutPresets.vue';
import RepetitionPanel from '@/components/RepetitionPanel.vue';
import { canRedo, canUndo, redo, shareUrl, undo } from '@/state-share.ts';
import PaletteStrip from '@/components/PatternPaletteStrip.vue';
import { paletteParam } from '@/palettes.ts';
import { copyText } from '@/clipboard.ts';
import { migrateTab, type TabId } from '@/shell.ts';
import '@/css/shell.css';
import SponsorBanner from '@/components/SponsorBanner.vue';
import BottomBar from '@/components/BottomBar.vue';
import PaletteSheet from '@/components/PaletteSheet.vue';

// The Image tab loads its code when first opened, then stays mounted so its state stays.
const ImagePanel = defineAsyncComponent(() => import('@/components/ImagePanel.vue'));

// The studio opens with the same palette (custom colors: no palette to pass).
const studioHref = computed(() => (palette.value ? `./studio.html#${new URLSearchParams([paletteParam(palette.value)])}` : './studio.html'));

// WCAG 2.1.4: a single-key shortcut needs an off switch. The choice survives a reload.
const shortcutOn = ref(readShortcut());
watch(shortcutOn, writeShortcut);
const stage = ref<HTMLElement | null>(null);
const fullscreen = () => toggleFullscreen(stage.value);
// The T button: the pattern alone, for viewing only (not stored, not in the link).
const textOn = ref(true);
// The preview caption: kind, tile size and seed; the full sentence stays for screen readers.
const captionShort = computed(() => {
  const what = usingImage.value ? 'Traced image' : usingPatchwork.value ? `Patchwork ${patch.cells}×${patch.cells}` : KIND_LABELS[params.kind];
  return usingImage.value ? `${what} · ${params.size} px` : `${what} · ${params.size} px · seed ${params.seed}`;
});
// The one-tile marker: one tile of the base layer (not the composed file); with variants, one cell of its super tile.
const tileVars = computed(() => {
  const w = variantsOn.value ? baseTileSize.value / variantOptions.cells : baseTileSize.value;
  return { '--tile-w': `${w}px`, '--tile-h': `${tileHeight(w, aspect.value)}px` };
});

// One polite live region for the toolbar copies.
const copyStatus = ref('');
let copyTimer: ReturnType<typeof setTimeout> | undefined;
async function copyWithStatus(text: string, done: string, failed: string): Promise<void> {
  copyStatus.value = '';
  copyStatus.value = (await copyText(text)) ? done : failed;
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => (copyStatus.value = ''), 2500);
}
const copyLink = () => copyWithStatus(shareUrl(), 'Link copied', 'Could not copy the link. Copy it from the address bar.');
const copyCss = () => copyWithStatus(exportText.value, 'Copied', 'Copy failed. Copy the CSS from the Use it tab.');

// Phones: the Palette cell shows four squares of the current palette and opens the sheet.
const barSwatches = computed(() => (palette.value?.colors ?? [roles.background, roles.pattern, roles.text]).slice(0, 4));
const sheet = ref<InstanceType<typeof PaletteSheet> | null>(null);
// Phones: "Use it" is a bottom sheet over the page (REDESIGN-SPEC §4); the one UseIt panel moves into it (Teleport), so its choices stay.
const phoneMq = matchMedia('(max-width: 599.98px)');
const phone = ref(phoneMq.matches);
phoneMq.addEventListener('change', (e) => (phone.value = e.matches));
const useSheet = ref<InstanceType<typeof PaletteSheet> | null>(null);
// Phones: the preview shrinks to a strip once the tabs reach its 150 px bottom; the corner chips then change (app.css).
const compact = ref(false);
onMounted(() => {
  if (!tabBar.value) return;
  const io = new IntersectionObserver(([e]) => (compact.value = !!e && e.intersectionRatio < 1 && e.boundingClientRect.top < 151), { rootMargin: '-151px 0px 0px 0px', threshold: 1 });
  io.observe(tabBar.value);
  onBeforeUnmount(() => io.disconnect());
});

// Tabs (WAI-ARIA tabs pattern, automatic activation). All panels stay mounted, except Repetition (v-if: its previews cost nothing while closed).
const TABS: readonly { id: TabId; label: string }[] = [
  { id: 'pattern', label: 'Pattern' },
  { id: 'repetition', label: 'Repetition' },
  { id: 'layout', label: 'Layout' },
  { id: 'colors', label: 'Colors' },
  { id: 'image', label: 'Image' },
  { id: 'use', label: 'Use it' },
];
const TAB_KEY = 'fp-tab';
function readTab(): TabId {
  try {
    return migrateTab(sessionStorage.getItem(TAB_KEY));
  } catch {
    return 'pattern';
  }
}
const tab = ref<TabId>(readTab());
// The Use it tab is not a panel on phones: the page keeps the tab it had; a sheet left open on a widened window closes.
watch(
  phone,
  (p) => {
    if (p && tab.value === 'use') tab.value = 'pattern';
    if (!p) useSheet.value?.close();
  },
  { immediate: true },
);
const imageOpened = ref(false);
watch(tab, (t) => (imageOpened.value ||= t === 'image'), { immediate: true });
watch(tab, (t) => {
  try {
    sessionStorage.setItem(TAB_KEY, t);
  } catch {
    /* storage blocked: the tab resets on reload */
  }
});
function onTabKey(e: KeyboardEvent): void {
  // From the focused tab: on phones focus can rest on "Use it" while another tab stays selected.
  const i = TABS.findIndex((t) => `tab-${t.id}` === (e.target as HTMLElement).id);
  if (i < 0) return;
  // Phones show the tabs as a 3 × 2 grid: Down and Up also step in reading order there.
  const grid = matchMedia('(max-width: 599.98px)').matches;
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1, ...(grid && { ArrowDown: i + 1, ArrowUp: i - 1 }) }[e.key];
  if (next === undefined) return;
  e.preventDefault();
  const t = TABS[(next + TABS.length) % TABS.length]!;
  // Phones: arrows only focus "Use it"; Enter or Space opens its sheet (a modal must not open on an arrow key).
  if (!(phone.value && t.id === 'use')) tab.value = t.id;
  void nextTick(() => document.getElementById(`tab-${t.id}`)?.focus());
}
function selectTab(id: TabId, e: MouseEvent): void {
  if (phone.value && id === 'use') useSheet.value?.open(e.currentTarget as HTMLElement);
  else tab.value = id;
}
async function useIt(e: MouseEvent): Promise<void> {
  if (phone.value) return useSheet.value?.open(e.currentTarget as HTMLElement);
  tab.value = 'use';
  await nextTick();
  document.getElementById('tab-use')?.focus();
}
// The Use it destination: "Website background" (today's export content) first, then the last choice, for the session only.
const USE_KEY = 'fp-use';
function readUse(): Destination['id'] {
  try {
    return DESTINATIONS.find((d) => d.id === sessionStorage.getItem(USE_KEY))?.id ?? 'web';
  } catch {
    return 'web';
  }
}
// A "Send to my phone" link (use=<destination>) opens Use it there: the tab, or on phones the sheet.
const useFrom = takeUse(location, history);
const useInitial = useFrom ?? readUse();
if (useFrom && !phone.value) tab.value = 'use';
onMounted(() => {
  const opener = document.getElementById('tab-use');
  if (useFrom && phone.value && opener) useSheet.value?.open(opener);
});
// A design made from an uploaded image cannot travel in the link.
const noLink = computed(() => (usingImage.value ? 'This design uses your image, so it cannot travel by link.' : undefined));
function writeUse(id: Destination['id']): void {
  try {
    sessionStorage.setItem(USE_KEY, id);
  } catch {
    /* storage blocked: the choice resets on reload */
  }
}
const tileH = computed(() => tileHeight(tileSize.value, aspect.value));
async function toDepth(): Promise<void> {
  useSheet.value?.close(false);
  tab.value = 'pattern';
  await nextTick();
  document.getElementById('depth')?.focus();
}

// Sticky heights for the offsets below the toolbar and for scroll-padding-top.
const bar = ref<HTMLElement | null>(null);
const tabBar = ref<HTMLElement | null>(null);
useBarHeight(bar);
useBarHeight(tabBar, '--tabs-h');
// The header scrolls away; until it does, the preview's bottom corners sit lower by its height.
const head = ref<HTMLElement | null>(null);
onMounted(() => (head.value = document.querySelector<HTMLElement>('.site-header')));
useBarHeight(head, '--head-h');

function onKey(e: KeyboardEvent): void {
  // Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z: design undo and redo, except in form fields, where native text undo wins.
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'z') {
    if ((e.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"]')) return;
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
    return;
  }
  if (!shortcutOn.value) return;
  const action = shortcutFor(e, isTyping(e));
  if (action === 'shuffle') reseed();
  else if (action === 'fullscreen') fullscreen();
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <SiteHeader v-model:shortcut="shortcutOn" current="patterns" patterns-href="./index.html" :studio-href="studioHref" tagline="Seeded fractal tiles for CSS backgrounds, with contrast you can trust." />

  <div ref="bar" class="toolbar" role="toolbar" aria-label="Design actions">
    <div class="bar-make">
      <button type="button" class="btn primary" :disabled="usingImage && !imageShuffles" @click="reseed"><ToolIcon name="shuffle" />Shuffle</button>
      <button type="button" class="btn secondary" @click="randomPattern">Random pattern</button>
      <button type="button" class="btn secondary tool-btn" :disabled="!canUndo" aria-label="Undo" title="Undo (Ctrl/Cmd+Z)" aria-keyshortcuts="Control+Z Meta+Z" @click="undo"><ToolIcon name="undo" /></button>
      <button type="button" class="btn secondary tool-btn" :disabled="!canRedo" aria-label="Redo" title="Redo (Ctrl/Cmd+Shift+Z)" aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z" @click="redo"><ToolIcon name="redo" /></button>
      <button type="button" class="btn secondary tool-btn" aria-label="Reset" title="Reset" @click="reset"><ToolIcon name="reset" /></button>
      <span class="bar-sep" aria-hidden="true"></span>
      <PaletteStrip />
    </div>
    <div class="bar-stats">
      <span class="bar-chip" :class="contrast.normal !== 'fail' ? 'ok' : 'bad'">
        <span aria-hidden="true">{{ contrast.normal !== 'fail' ? '✓' : '✕' }}</span>
        <span class="stat-long">Contrast {{ ratioText(contrast.worst) }}:1 {{ contrast.normal !== 'fail' ? 'AA pass' : 'AA fail' }}</span>
        <span class="stat-short" aria-hidden="true">{{ ratioShort(contrast.worst) }}:1 · {{ contrast.normal !== 'fail' ? 'AA' : 'fails AA' }}</span>
      </span>
      <SizeBadge :gzip="gzipped === 'unknown' ? 'unknown' : exportGzipBytes" :breakdown="sizeBreakdown" />
    </div>
    <div class="bar-out">
      <!-- Copy link stays here for good (owner, REDESIGN-SPEC §2). Download SVG lives in "Use it". -->
      <button type="button" class="btn quiet" title="Copy link" @click="copyLink"><ToolIcon name="link" /><span class="out-label">Copy link</span></button>
      <button type="button" class="btn secondary" @click="copyCss">Copy CSS</button>
      <button type="button" class="btn use-it" @click="useIt">Use it…</button>
    </div>
    <span class="visually-hidden" role="status" aria-live="polite">{{ copyStatus }}</span>
  </div>

  <BottomBar label="Main actions">
    <button type="button" class="primary" :disabled="usingImage && !imageShuffles" @click="reseed"><ToolIcon name="shuffle" />Shuffle</button>
    <button type="button" :disabled="!canUndo" aria-label="Undo" title="Undo (Ctrl/Cmd+Z)" aria-keyshortcuts="Control+Z Meta+Z" @click="undo"><ToolIcon name="undo" /></button>
    <button type="button" :disabled="!canRedo" aria-label="Redo" title="Redo (Ctrl/Cmd+Shift+Z)" aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z" @click="redo"><ToolIcon name="redo" /></button>
    <button type="button" aria-label="Palette" title="Palette" aria-haspopup="dialog" @click="sheet?.open($event.currentTarget as HTMLElement)">
      <span class="bar-swatches" aria-hidden="true"><span v-for="(c, i) in barSwatches" :key="i" :style="{ background: c }"></span></span>
    </button>
    <button type="button" class="ink" aria-haspopup="dialog" @click="useIt"><ToolIcon name="download" />Use it</button>
  </BottomBar>
  <PaletteSheet ref="sheet" title="Palette">
    <PaletteStrip />
    <div class="sheet-more">
      <h3>More</h3>
      <button type="button" class="btn secondary" @click="randomPattern">Random pattern</button>
      <button type="button" class="btn secondary" @click="reset"><ToolIcon name="reset" />Reset</button>
      <button type="button" class="btn secondary" @click="copyCss">Copy CSS</button>
      <button type="button" class="btn secondary" @click="copyLink"><ToolIcon name="link" />Copy link</button>
    </div>
    <!-- The page's live region is inert behind the modal sheet: this one speaks while the sheet is open. -->
    <p class="sheet-status" role="status">{{ copyStatus }}</p>
  </PaletteSheet>
  <PaletteSheet ref="useSheet" class="sheet-use" title="Use it">
    <div id="use-sheet-preview" class="use-stage"></div>
    <div id="use-sheet-steps"></div>
  </PaletteSheet>

  <main class="layout">
    <!-- ponytail: pointer shortcut only; the Shuffle button is the keyboard path. -->
    <!-- The hero uses the exported .fp-pattern class itself, so what you see is what you copy. -->
    <component :is="'style'">{{ exportText }}</component>
    <div ref="stage" class="stage" :class="{ 'stage-use': tab === 'use', 'stage-compact': compact }">
    <ShortcutHint :on="shortcutOn" />
    <!-- A fast second click must shuffle again, not select the sample text. A drag still selects it. -->
    <div class="hero fp-pattern" :class="{ 'fp-paused': motionPaused }" :style="tileVars" @click="reseed" @mousedown="$event.detail > 1 && $event.preventDefault()">
      <!-- One tile at the preview scale, on the seams of the pattern layer (it starts at 0,0 of the hero). -->
      <!-- Edit shapes (Pattern › Accent shapes) turns the marker into an edit area over the accent shapes of that tile. -->
      <AccentEditor v-if="accentEditing" />
      <span v-else class="one-tile" aria-hidden="true"></span>
      <!-- The plate sits on the wrapper in 'plate' mode, on the paragraph in 'split', nowhere in 'direct'. -->
      <div class="hero-text" :class="{ 'hero-plate': plateMode === 'plate', 'text-off': !textOn }" :style="plateMode === 'plate' ? plateStyle : undefined">
        <h1>{{ APP_NAME }}</h1>
        <p :class="{ 'hero-plate': plateMode === 'split' }" :style="plateMode === 'split' ? plateStyle : undefined">This text uses your text color and text plate settings, so what you read here is what your visitors will read.</p>
      </div>
    </div>
    <!-- Phones: the toolbar chips move to the preview corner (design board Mobile-Patterns). -->
    <div class="phone-chips phone-only">
      <span class="bar-chip" :class="contrast.normal !== 'fail' ? 'ok' : 'bad'">
        <span aria-hidden="true">{{ contrast.normal !== 'fail' ? '✓' : '✕' }}</span>
        <span class="stat-long">Contrast {{ ratioText(contrast.worst) }}:1 {{ contrast.normal !== 'fail' ? 'AA pass' : 'AA fail' }}</span>
        <span class="stat-short" aria-hidden="true">{{ ratioShort(contrast.worst) }}:1 {{ contrast.normal !== 'fail' ? 'AA' : 'fails AA' }}</span>
      </span>
      <SizeBadge :gzip="gzipped === 'unknown' ? 'unknown' : exportGzipBytes" :breakdown="sizeBreakdown" />
    </div>
    <p class="hero-caption">
      <span aria-hidden="true">{{ captionShort }}</span>
      <span class="visually-hidden"><template v-if="usingImage">Pattern: traced from {{ activeSample ? `the example ${SAMPLE_LABELS[activeSample]}` : 'your image' }}, {{ traceName(trace.detector) }}, {{ traced?.length ?? 0 }} lines.</template><template v-else-if="usingPatchwork">Pattern: patchwork {{ patch.cells }} by {{ patch.cells }}, seed {{ params.seed }}.</template><template v-else>Pattern: {{ KIND_LABELS[params.kind] }}, seed {{ params.seed }}.</template></span>
    </p>
    <div class="hero-actions">
      <button type="button" class="hero-btn" aria-label="Show the text" title="Show the text" :aria-pressed="textOn" @click="textOn = !textOn"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 4h10M8 4v9" /></svg></button>
      <button type="button" class="hero-btn" aria-label="Full screen" title="Full screen (F)" :aria-keyshortcuts="shortcutOn ? 'F' : undefined" @click="fullscreen"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" /></svg></button>
    </div>
    <!-- Use it draws its device preview here; the hero stays underneath (hidden), so contrast and full screen keep working. -->
    <div v-show="tab === 'use'" id="use-preview" class="use-stage"></div>
    </div>

    <div class="controls">
      <div ref="tabBar" class="tabs" role="tablist" aria-label="Controls" @keydown="onTabKey">
        <button v-for="t in TABS" :id="`tab-${t.id}`" :key="t.id" type="button" role="tab" class="tab" :aria-selected="tab === t.id" :aria-controls="`panel-${t.id}`" :tabindex="tab === t.id ? 0 : -1" :aria-haspopup="phone && t.id === 'use' ? 'dialog' : undefined" @click="selectTab(t.id, $event)">{{ t.label }}<span v-if="t.id === 'repetition' && (variantsOn || layer2 || grain.on)" class="tab-on"><span aria-hidden="true"></span><span class="visually-hidden">on</span></span></button>
      </div>
      <div v-show="tab === 'pattern'" id="panel-pattern" class="tabpanel" role="tabpanel" aria-labelledby="tab-pattern">
        <PatternPanel />
        <div class="shortcut-line">
          <span class="muted hint">{{ usingImage ? 'Shuffle applies to math patterns only.' : '' }}<template v-if="!usingImage && shortcutOn">Or click the pattern, or press <kbd>R</kbd>.</template><template v-else-if="!usingImage">Or click the pattern.</template></span>
        </div>
      </div>
      <div v-show="tab === 'repetition'" id="panel-repetition" class="tabpanel" role="tabpanel" aria-labelledby="tab-repetition">
        <RepetitionPanel v-if="tab === 'repetition'" />
      </div>
      <div v-show="tab === 'layout'" id="panel-layout" class="tabpanel" role="tabpanel" aria-labelledby="tab-layout">
        <LayoutPresets />
        <SpacingPanel />
        <MotionPanel />
      </div>
      <div v-show="tab === 'colors'" id="panel-colors" class="tabpanel" role="tabpanel" aria-labelledby="tab-colors">
        <ColorPanel />
        <VisionPanel />
      </div>
      <div v-show="tab === 'image'" id="panel-image" class="tabpanel" role="tabpanel" aria-labelledby="tab-image">
        <ImagePanel v-if="imageOpened" />
      </div>
      <div v-show="tab === 'use'" id="panel-use" class="tabpanel" role="tabpanel" aria-labelledby="tab-use">
        <Teleport defer to="#use-sheet-steps" :disabled="!phone">
        <UseIt
          :svg="svg"
          :tile-width="tileSize"
          :tile-height="tileH"
          :background="roles.background"
          :base-name="fileName.replace(/\.svg$/, '')"
          :svg-href="svgHref"
          :svg-file-name="fileName"
          :initial="useInitial"
          :preview-target="phone ? '#use-sheet-preview' : '#use-preview'"
          :share-link="shareUrl"
          :no-link="noLink"
          @destination="writeUse"
        >
          <template #web><OutputPanel @depth="toDepth" /></template>
        </UseIt>
        </Teleport>
      </div>
    </div>
  </main>

  <footer class="site-footer">
    <p>The app builds the palettes by rule in the OKLCH color space, from studies of color preference. Contrast follows WCAG 2.2: <a href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html">1.4.3</a>, <a href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html">1.4.6</a>, <a href="https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html">1.4.11</a>.</p>
    <p><a href="https://github.com/guilbep/patterns">Source on GitHub</a></p>
    <SponsorBanner />
  </footer>
</template>
