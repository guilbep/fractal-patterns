<script setup lang="ts">
// The Pattern Builder page: the shared header, a toolbar, the tile stage and four control panels.
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useBarHeight } from '@/bar-height.ts';
import SiteHeader from '@/components/SiteHeader.vue';
import SponsorBanner from '@/components/SponsorBanner.vue';
import { isTyping } from '@/shortcuts.ts';
import { copyText } from '@/clipboard.ts';
import SizeBadge from '@/components/SizeBadge.vue';
import ToolIcon from '@/components/ToolIcon.vue';
import UseIt from '@/components/UseIt.vue';
import { DESTINATIONS, type Destination } from '@/use-it.ts';
import { repeatCell } from '@/studio/model.ts';
import { toStudio } from './design.ts';
import { canRedo, canUndo, commit, design, redo, resetDesign, selectedId, svg, undo } from './store.ts';
import { css } from './builder-css.ts';
import { EXAMPLE_LIST } from './example-list.ts';
import BuilderStage from './BuilderStage.vue';
import BuilderCoach from './BuilderCoach.vue';
import StampPanel from './StampPanel.vue';
import ItemPanel from './ItemPanel.vue';
import TilePanel from './TilePanel.vue';
import ExportPanel from './ExportPanel.vue';

const bar = ref<HTMLElement | null>(null);
useBarHeight(bar);
// Until the header scrolls away, the stage's bottom sits lower by its height (the Use it preview pads for it).
const head = ref<HTMLElement | null>(null);
onMounted(() => (head.value = document.querySelector<HTMLElement>('.site-header')));
useBarHeight(head, '--head-h');

// Same texts as the Export card's copies.
const copyStatus = ref('');
let copyTimer: ReturnType<typeof setTimeout> | undefined;
async function copyCss(): Promise<void> {
  copyStatus.value = '';
  copyStatus.value = (await copyText(css.value)) ? 'Copied.' : 'Copy failed: select the text and copy it by hand.';
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => (copyStatus.value = ''), 2000);
}

// "Use it…": the shared Use it view replaces the sections; the stage shows the device preview. Not stored, not in the link.
const useOpen = ref(false);
const useBtn = ref<HTMLButtonElement | null>(null);
async function useIt(): Promise<void> {
  useOpen.value = true;
  await nextTick();
  const legend = document.querySelector<HTMLElement>('.controls .use-it-panel legend');
  if (!legend) return;
  legend.tabIndex = -1;
  legend.focus();
}
function closeUse(): void {
  useOpen.value = false;
  useBtn.value?.focus();
}
function onUseKey(e: KeyboardEvent): void {
  if (useOpen.value && e.key === 'Escape') closeUse();
}
// Same tile as the CSS export: the repeat cell, not the drawn tile.
const cell = computed(() => repeatCell(toStudio(design.value)));
// The same SVG text as the Export card's download.
const svgHref = computed(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.value)}`);
// The last destination, for the session only; "Website background" (the export) first.
const USE_KEY = 'fp-use-builder';
function readUse(): Destination['id'] {
  try {
    return DESTINATIONS.find((d) => d.id === sessionStorage.getItem(USE_KEY))?.id ?? 'web';
  } catch {
    return 'web';
  }
}
function writeUse(id: Destination['id']): void {
  try {
    sessionStorage.setItem(USE_KEY, id);
  } catch {
    /* storage blocked: the choice resets on reload */
  }
}

// The example designs load on demand: "Falling leaves" needs the studio's motif generators.
const exampleError = ref('');
async function openExample(e: Event): Promise<void> {
  const select = e.target as HTMLSelectElement;
  const id = select.value;
  select.selectedIndex = 0;
  let EXAMPLES;
  try {
    ({ EXAMPLES } = await import('./examples.ts'));
  } catch {
    exampleError.value = 'The examples could not be loaded. Reload the page to try again.';
    return;
  }
  exampleError.value = '';
  const example = EXAMPLES.find((x) => x.id === id);
  if (!example) return;
  selectedId.value = null;
  commit(example.make());
}

function onKey(e: KeyboardEvent): void {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || isTyping(e)) return;
  e.preventDefault();
  if (e.shiftKey) redo();
  else undo();
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <SiteHeader current="builder" patterns-href="./index.html" studio-href="./studio.html" tagline="Place your own shapes on a repeating tile" />

  <div ref="bar" class="toolbar" role="toolbar" aria-label="Builder actions">
    <div class="bar-make">
      <button type="button" class="btn secondary tool-btn" :disabled="!canUndo" aria-label="Undo" title="Undo (Ctrl/Cmd+Z)" aria-keyshortcuts="Control+Z Meta+Z" @click="undo"><ToolIcon name="undo" /></button>
      <button type="button" class="btn secondary tool-btn" :disabled="!canRedo" aria-label="Redo" title="Redo (Ctrl/Cmd+Shift+Z)" aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z" @click="redo"><ToolIcon name="redo" /></button>
      <span class="bar-sep" aria-hidden="true"></span>
      <button type="button" class="btn secondary" @click="resetDesign">Start again</button>
      <label for="examples" class="bar-label">Example</label>
      <select id="examples" class="examples" @change="openExample">
        <option value="" disabled selected>Open an example</option>
        <option v-for="x in EXAMPLE_LIST" :key="x.id" :value="x.id">{{ x.label }}</option>
      </select>
    </div>
    <div class="bar-stats">
      <SizeBadge :svg="svg" />
    </div>
    <div class="bar-out">
      <button type="button" class="btn secondary" @click="copyCss">Copy CSS</button>
      <button ref="useBtn" type="button" class="btn use-it" @click="useIt">Use it…</button>
    </div>
    <span class="visually-hidden" role="status" aria-live="polite">{{ copyStatus }}</span>
    <!-- ponytail: hidden while empty, so the empty live region takes no row in the toolbar. -->
    <p :class="exampleError ? 'muted example-error' : 'visually-hidden'" role="status">{{ exampleError }}</p>
  </div>

  <main class="layout">
    <div class="stage" :class="{ 'stage-use': useOpen }">
      <BuilderStage />
      <BuilderCoach :hidden="useOpen" />
      <!-- Use it draws its device preview here; the editor stays underneath (hidden). -->
      <div v-show="useOpen" id="use-preview" class="use-stage"></div>
    </div>
    <div class="controls" @keydown="onUseKey">
      <!-- Hidden, not destroyed, while Use it is open: folds and fields keep their state. -->
      <div v-show="!useOpen" class="builder-sections">
        <StampPanel />
        <ItemPanel />
        <TilePanel />
      </div>
      <template v-if="useOpen">
        <button type="button" class="btn quiet use-back" @click="closeUse">‹ Back to the design</button>
        <UseIt
          :svg="svg"
          :tile-width="cell.width"
          :tile-height="cell.height"
          :background="design.background"
          base-name="pattern-builder"
          :svg-href="svgHref"
          svg-file-name="pattern-builder.svg"
          :initial="readUse()"
          preview-target="#use-preview"
          @destination="writeUse"
        >
          <template #web><ExportPanel /></template>
        </UseIt>
      </template>
    </div>
  </main>
  <footer class="site-footer">
    <p><a href="https://github.com/guilbep/patterns">Source on GitHub</a></p>
    <SponsorBanner />
  </footer>
</template>

<style scoped>
.examples {
  max-width: 100%;
  height: 36px;
  min-height: 36px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 14px;
}
.bar-label {
  font-size: 14px;
  color: var(--muted);
}
.example-error {
  flex-basis: 100%;
}
.example-error {
  margin: 0;
  font-size: 0.875rem;
}
</style>
