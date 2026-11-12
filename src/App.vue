<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { APP_NAME } from '@/app-name.ts';
import { KIND_LABELS } from '@/fractal.ts';
import { DETECTOR_LABELS } from '@/trace.ts';
import { contrast, fileName, motionPaused, params, patch, usingPatchwork, plateMode, plateStyle, randomPattern, ratioText, reseed, reset, svgHref, trace, traced, usingImage } from '@/state.ts';
import { exportText, footprint, gzipped } from '@/state-export.ts';
import ColorPanel from '@/components/ColorPanel.vue';
import VisionPanel from '@/components/VisionPanel.vue';
import PatternPanel from '@/components/PatternPanel.vue';
import OutputPanel from '@/components/OutputPanel.vue';
import ImagePanel from '@/components/ImagePanel.vue';
import SpacingPanel from '@/components/SpacingPanel.vue';
import MotionPanel from '@/components/MotionPanel.vue';
import { canRedo, canUndo, redo, shareUrl, undo } from '@/state-share.ts';

// WCAG 2.1.4: a single-key shortcut needs an off switch. The choice survives a reload.
const SHORTCUT_KEY = 'fp-shortcut';
function readShortcut(): boolean {
  try {
    return localStorage.getItem(SHORTCUT_KEY) !== '0';
  } catch {
    return true;
  }
}
const shortcutOn = ref(readShortcut());
watch(shortcutOn, (on) => {
  try {
    localStorage.setItem(SHORTCUT_KEY, on ? '1' : '0');
  } catch {
    /* storage blocked: the choice lasts for this visit only */
  }
});

// One polite live region for the toolbar copies.
const copyStatus = ref('');
let copyTimer: ReturnType<typeof setTimeout> | undefined;
async function copyText(text: string, done: string, failed: string): Promise<void> {
  copyStatus.value = '';
  try {
    await navigator.clipboard.writeText(text);
    copyStatus.value = done;
  } catch {
    copyStatus.value = failed;
  }
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => (copyStatus.value = ''), 2500);
}
const copyLink = () => copyText(shareUrl(), 'Link copied', 'Could not copy the link. Copy it from the address bar.');
const copyCss = () => copyText(exportText.value, 'Copied', 'Copy failed. Copy the CSS from the Export tab.');

// Tabs (WAI-ARIA tabs pattern, automatic activation). All panels stay mounted.
const TABS = [
  { id: 'pattern', label: 'Pattern' },
  { id: 'colors', label: 'Colors' },
  { id: 'image', label: 'Image' },
  { id: 'motion', label: 'Motion' },
  { id: 'export', label: 'Export' },
] as const;
type TabId = (typeof TABS)[number]['id'];
const TAB_KEY = 'fp-tab';
function readTab(): TabId {
  try {
    const t = sessionStorage.getItem(TAB_KEY);
    return TABS.find((x) => x.id === t)?.id ?? 'pattern';
  } catch {
    return 'pattern';
  }
}
const tab = ref<TabId>(readTab());
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
async function toDepth(): Promise<void> {
  tab.value = 'pattern';
  await nextTick();
  document.getElementById('depth')?.focus();
}

// The badge keeps the CO₂ part only ("≈ 0.4 mg CO₂"); the Export tab shows the full line.
const footprintFull = () => (gzipped.value === null ? 'computing' : gzipped.value === 'unknown' ? 'size unknown' : (footprint.value ?? ''));
const footprintText = () => footprintFull().split(' / ')[0];

// Sticky heights for the offsets below the toolbar and for scroll-padding-top.
const bar = ref<HTMLElement | null>(null);
const tabBar = ref<HTMLElement | null>(null);
const sizes = new ResizeObserver(() => {
  const root = document.documentElement.style;
  root.setProperty('--bar-h', `${bar.value?.offsetHeight ?? 0}px`);
  root.setProperty('--tabs-h', `${tabBar.value?.offsetHeight ?? 0}px`);
});
onMounted(() => {
  if (bar.value) sizes.observe(bar.value);
  if (tabBar.value) sizes.observe(tabBar.value);
});
onBeforeUnmount(() => sizes.disconnect());

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
  if (e.key !== 'r' && e.key !== 'R') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target as HTMLElement | null;
  if (t?.closest('input, textarea, select, [contenteditable="true"]')) return;
  reseed();
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <header class="site-header">
    <p class="brand">{{ APP_NAME }}</p>
    <p class="tagline">Seeded fractal tiles for CSS backgrounds, with contrast you can trust.</p>
  </header>

  <div ref="bar" class="toolbar" role="toolbar" aria-label="Design actions">
    <div class="bar-row">
    <button type="button" class="btn primary" :disabled="usingImage" @click="reseed">Shuffle</button>
    <button type="button" class="btn" @click="randomPattern">Random pattern</button>
    <button type="button" class="btn" :disabled="!canUndo" aria-keyshortcuts="Control+Z Meta+Z" @click="undo">Undo</button>
    <button type="button" class="btn" :disabled="!canRedo" aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z" @click="redo">Redo</button>
    <button type="button" class="btn" @click="reset">Reset</button>
    <span class="bar-sep" aria-hidden="true"></span>
    <button type="button" class="btn" @click="copyCss">Copy CSS</button>
    <a class="btn" :href="svgHref" :download="fileName">Download SVG</a>
    <button type="button" class="btn" @click="copyLink">Copy link</button>
    </div>
    <div class="bar-stats">
    <span class="stat" :class="contrast.normal !== 'fail' ? 'ok' : 'bad'">
      <span aria-hidden="true">{{ contrast.normal !== 'fail' ? '✓' : '✗' }}</span>
      Contrast {{ ratioText(contrast.worst) }}:1 {{ contrast.normal !== 'fail' ? 'AA pass' : 'AA fail' }}
    </span>
    <span class="stat" :title="footprintFull()"><span aria-hidden="true">{{ footprintText() }}</span><span class="visually-hidden">{{ footprintFull() }}</span></span>
    </div>
    <span class="visually-hidden" role="status" aria-live="polite">{{ copyStatus }}</span>
  </div>

  <main class="layout">
    <!-- ponytail: pointer shortcut only; the Shuffle button is the keyboard path. -->
    <!-- The hero uses the exported .fp-pattern class itself, so what you see is what you copy. -->
    <component :is="'style'">{{ exportText }}</component>
    <div class="stage">
    <div class="hero fp-pattern" :class="{ 'fp-paused': motionPaused }" @click="reseed">
      <!-- The plate sits on the wrapper in 'plate' mode, on the paragraph in 'split', nowhere in 'direct'. -->
      <div class="hero-text" :class="{ 'hero-plate': plateMode === 'plate' }" :style="plateMode === 'plate' ? plateStyle : undefined">
        <h1>{{ APP_NAME }}</h1>
        <p :class="{ 'hero-plate': plateMode === 'split' }" :style="plateMode === 'split' ? plateStyle : undefined">
          <template v-if="usingImage">Pattern: traced from your image, {{ DETECTOR_LABELS[trace.detector] }} edges, {{ traced?.length ?? 0 }} lines.</template><template v-else-if="usingPatchwork">Pattern: patchwork {{ patch.cells }} by {{ patch.cells }}, seed {{ params.seed }}.</template><template v-else>Pattern: {{ KIND_LABELS[params.kind] }}, seed {{ params.seed }}.</template> This text uses your text color and text plate settings, so what you read here is what your visitors will read.
        </p>
      </div>
    </div>
    </div>

    <div class="controls">
      <div ref="tabBar" class="tabs" role="tablist" aria-label="Controls" @keydown="onTabKey">
        <button v-for="t in TABS" :id="`tab-${t.id}`" :key="t.id" type="button" role="tab" class="tab" :aria-selected="tab === t.id" :aria-controls="`panel-${t.id}`" :tabindex="tab === t.id ? 0 : -1" @click="tab = t.id">{{ t.label }}</button>
      </div>
      <div v-show="tab === 'pattern'" id="panel-pattern" class="tabpanel" role="tabpanel" aria-labelledby="tab-pattern">
        <div class="panel shortcut">
          <label class="radio"><input v-model="shortcutOn" type="checkbox"> Keyboard shortcut: R shuffles</label>
          <p class="muted hint">{{ usingImage ? 'Shuffle applies to math patterns only.' : '' }}<template v-if="!usingImage && shortcutOn">Or click the pattern, or press <kbd>R</kbd>.</template><template v-else-if="!usingImage">Or click the pattern.</template></p>
        </div>
        <PatternPanel />
        <SpacingPanel />
      </div>
      <div v-show="tab === 'colors'" id="panel-colors" class="tabpanel" role="tabpanel" aria-labelledby="tab-colors">
        <ColorPanel />
        <VisionPanel />
      </div>
      <div v-show="tab === 'image'" id="panel-image" class="tabpanel" role="tabpanel" aria-labelledby="tab-image">
        <ImagePanel />
      </div>
      <div v-show="tab === 'motion'" id="panel-motion" class="tabpanel" role="tabpanel" aria-labelledby="tab-motion">
        <MotionPanel />
      </div>
      <div v-show="tab === 'export'" id="panel-export" class="tabpanel" role="tabpanel" aria-labelledby="tab-export">
        <OutputPanel @depth="toDepth" />
      </div>
    </div>
  </main>

  <footer class="site-footer">
    <p>The app generates the palettes by rule from a hue and a harmony scheme in the OKLCH color space. Contrast follows WCAG 2.2: <a href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html">1.4.3</a>, <a href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html">1.4.6</a>, <a href="https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html">1.4.11</a>.</p>
  </footer>
</template>
