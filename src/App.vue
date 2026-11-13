<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { APP_NAME } from '@/app-name.ts';
import { useBarHeight } from '@/bar-height.ts';
import { traceName } from '@/detectors.ts';
import ShortcutHint from '@/components/ShortcutHint.vue';
import SiteHeader from '@/components/SiteHeader.vue';
import { isTyping, readShortcut, shortcutFor, toggleFullscreen, writeShortcut } from '@/shortcuts.ts';
import { KIND_LABELS, tileHeight } from '@/fractal.ts';
import { SAMPLE_LABELS } from '@/samples.ts';
import { activeSample, contrast, palette, layer2, variantsOn, fileName, motionPaused, params, patch, usingPatchwork, plateMode, plateStyle, randomPattern, ratioText, reseed, reset, svgHref, trace, traced, usingImage, imageShuffles, tileSize, aspect, variantOptions } from '@/state.ts';
import { exportGzipBytes, exportText, gzipped, sizeBreakdown } from '@/state-export.ts';
import SizeBadge from '@/components/SizeBadge.vue';
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
// The one-tile marker: one tile of the pattern layer; with variants, one cell of the super tile.
const tileVars = computed(() => {
  const w = variantsOn.value ? tileSize.value / variantOptions.cells : tileSize.value;
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
const copyCss = () => copyWithStatus(exportText.value, 'Copied', 'Copy failed. Copy the CSS from the Export tab.');

// Tabs (WAI-ARIA tabs pattern, automatic activation). All panels stay mounted, except Repetition (v-if: its previews cost nothing while closed).
const TABS: readonly { id: TabId; label: string }[] = [
  { id: 'pattern', label: 'Pattern' },
  { id: 'repetition', label: 'Repetition' },
  { id: 'layout', label: 'Layout' },
  { id: 'colors', label: 'Colors' },
  { id: 'image', label: 'Image' },
  { id: 'export', label: 'Export' },
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
  const i = TABS.findIndex((t) => t.id === tab.value);
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
  if (next === undefined) return;
  e.preventDefault();
  const t = TABS[(next + TABS.length) % TABS.length]!;
  tab.value = t.id;
  void nextTick(() => document.getElementById(`tab-${t.id}`)?.focus());
}
// "Use it…": the Export tab for now (a later phase gives it its own sheet).
async function useIt(): Promise<void> {
  tab.value = 'export';
  await nextTick();
  document.getElementById('tab-export')?.focus();
}
async function toDepth(): Promise<void> {
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
      <button type="button" class="btn quiet tool-btn" aria-label="Full screen" title="Full screen (F)" :aria-keyshortcuts="shortcutOn ? 'F' : undefined" @click="fullscreen"><ToolIcon name="fullscreen" /></button>
    </div>
    <div class="bar-stats">
      <span class="bar-chip" :class="contrast.normal !== 'fail' ? 'ok' : 'bad'">
        <span aria-hidden="true">{{ contrast.normal !== 'fail' ? '✓' : '✕' }}</span>
        <span class="stat-long">Contrast {{ ratioText(contrast.worst) }}:1 {{ contrast.normal !== 'fail' ? 'AA pass' : 'AA fail' }}</span>
        <span class="stat-short" aria-hidden="true">{{ ratioText(contrast.worst) }}:1 · {{ contrast.normal !== 'fail' ? 'AA' : 'fails AA' }}</span>
      </span>
      <SizeBadge :gzip="gzipped === 'unknown' ? 'unknown' : exportGzipBytes" :breakdown="sizeBreakdown" />
    </div>
    <div class="bar-out">
      <!-- Copy link stays here for good (owner, REDESIGN-SPEC §2). Download SVG moves into "Use it" next phase. -->
      <button type="button" class="btn quiet" title="Copy link" @click="copyLink"><ToolIcon name="link" /><span class="out-label">Copy link</span></button>
      <a class="btn quiet" title="Download SVG" :href="svgHref" :download="fileName"><ToolIcon name="download" /><span class="out-label">Download SVG</span></a>
      <button type="button" class="btn secondary" @click="copyCss">Copy CSS</button>
      <button type="button" class="btn use-it" @click="useIt">Use it…</button>
    </div>
    <span class="visually-hidden" role="status" aria-live="polite">{{ copyStatus }}</span>
  </div>

  <main class="layout">
    <!-- ponytail: pointer shortcut only; the Shuffle button is the keyboard path. -->
    <!-- The hero uses the exported .fp-pattern class itself, so what you see is what you copy. -->
    <component :is="'style'">{{ exportText }}</component>
    <div ref="stage" class="stage">
    <ShortcutHint :on="shortcutOn" />
    <!-- A fast second click must shuffle again, not select the sample text. A drag still selects it. -->
    <div class="hero fp-pattern" :class="{ 'fp-paused': motionPaused }" :style="tileVars" @click="reseed" @mousedown="$event.detail > 1 && $event.preventDefault()">
      <!-- One tile at the preview scale, on the seams of the pattern layer (it starts at 0,0 of the hero). -->
      <span class="one-tile" aria-hidden="true"></span>
      <!-- The plate sits on the wrapper in 'plate' mode, on the paragraph in 'split', nowhere in 'direct'. -->
      <div class="hero-text" :class="{ 'hero-plate': plateMode === 'plate', 'text-off': !textOn }" :style="plateMode === 'plate' ? plateStyle : undefined">
        <h1>{{ APP_NAME }}</h1>
        <p :class="{ 'hero-plate': plateMode === 'split' }" :style="plateMode === 'split' ? plateStyle : undefined">This text uses your text color and text plate settings, so what you read here is what your visitors will read.</p>
      </div>
    </div>
    <p class="hero-caption">
      <span aria-hidden="true">{{ captionShort }}</span>
      <span class="visually-hidden"><template v-if="usingImage">Pattern: traced from {{ activeSample ? `the example ${SAMPLE_LABELS[activeSample]}` : 'your image' }}, {{ traceName(trace.detector) }}, {{ traced?.length ?? 0 }} lines.</template><template v-else-if="usingPatchwork">Pattern: patchwork {{ patch.cells }} by {{ patch.cells }}, seed {{ params.seed }}.</template><template v-else>Pattern: {{ KIND_LABELS[params.kind] }}, seed {{ params.seed }}.</template></span>
    </p>
    <div class="hero-actions">
      <button type="button" class="hero-btn" aria-label="Show the text" title="Show the text" :aria-pressed="textOn" @click="textOn = !textOn"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 4h10M8 4v9" /></svg></button>
      <button type="button" class="hero-btn" aria-label="Full screen" title="Full screen (F)" :aria-keyshortcuts="shortcutOn ? 'F' : undefined" @click="fullscreen"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" /></svg></button>
    </div>
    </div>

    <div class="controls">
      <div ref="tabBar" class="tabs" role="tablist" aria-label="Controls" @keydown="onTabKey">
        <button v-for="t in TABS" :id="`tab-${t.id}`" :key="t.id" type="button" role="tab" class="tab" :aria-selected="tab === t.id" :aria-controls="`panel-${t.id}`" :tabindex="tab === t.id ? 0 : -1" @click="tab = t.id">{{ t.label }}<span v-if="t.id === 'repetition' && (variantsOn || layer2)" class="tab-on"><span aria-hidden="true"></span><span class="visually-hidden">on</span></span></button>
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
      <div v-show="tab === 'export'" id="panel-export" class="tabpanel" role="tabpanel" aria-labelledby="tab-export">
        <OutputPanel @depth="toDepth" />
      </div>
    </div>
  </main>

  <footer class="site-footer">
    <p>The app builds the palettes by rule in the OKLCH color space, from studies of color preference. Contrast follows WCAG 2.2: <a href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html">1.4.3</a>, <a href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html">1.4.6</a>, <a href="https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html">1.4.11</a>.</p>
    <p><a href="https://github.com/guilbep/patterns">Source on GitHub</a></p>
    <SponsorBanner />
  </footer>
</template>
