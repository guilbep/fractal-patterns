<script setup lang="ts">
// The Pattern Builder page: the shared header, a toolbar, the tile stage and four control panels.
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useBarHeight } from '@/bar-height.ts';
import SiteHeader from '@/components/SiteHeader.vue';
import SponsorBanner from '@/components/SponsorBanner.vue';
import { isTyping } from '@/shortcuts.ts';
import { copyText } from '@/clipboard.ts';
import SizeBadge from '@/components/SizeBadge.vue';
import { canRedo, canUndo, commit, redo, resetDesign, selectedId, svg, undo } from './store.ts';
import { css } from './builder-css.ts';
import { EXAMPLE_LIST } from './example-list.ts';
import BuilderStage from './BuilderStage.vue';
import StampPanel from './StampPanel.vue';
import ItemPanel from './ItemPanel.vue';
import TilePanel from './TilePanel.vue';
import ExportPanel from './ExportPanel.vue';

const bar = ref<HTMLElement | null>(null);
useBarHeight(bar);

// Same texts as the Export card's copies.
const copyStatus = ref('');
let copyTimer: ReturnType<typeof setTimeout> | undefined;
async function copyCss(): Promise<void> {
  copyStatus.value = '';
  copyStatus.value = (await copyText(css.value)) ? 'Copied.' : 'Copy failed: select the text and copy it by hand.';
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => (copyStatus.value = ''), 2000);
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
    <div class="bar-row">
      <button type="button" class="btn secondary" :disabled="!canUndo" aria-keyshortcuts="Control+Z Meta+Z" @click="undo">Undo</button>
      <button type="button" class="btn secondary" :disabled="!canRedo" aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z" @click="redo">Redo</button>
      <button type="button" class="btn secondary" @click="resetDesign">Start again</button>
      <label for="examples" class="visually-hidden">Examples</label>
      <select id="examples" class="examples" @change="openExample">
        <option value="" disabled selected>Open an example</option>
        <option v-for="x in EXAMPLE_LIST" :key="x.id" :value="x.id">{{ x.label }}</option>
      </select>
    </div>
    <div class="bar-stats">
      <span class="bar-sep join" aria-hidden="true"></span>
      <SizeBadge :svg="svg" />
    </div>
    <div class="bar-row">
      <span class="bar-sep join" aria-hidden="true"></span>
      <button type="button" class="btn secondary" @click="copyCss">Copy CSS</button>
      <!-- Raw SVG bytes, the same file as the Export card's Blob download. -->
      <a class="btn secondary" :href="`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`" download="pattern-builder.svg">Download SVG</a>
    </div>
    <span class="visually-hidden" role="status" aria-live="polite">{{ copyStatus }}</span>
    <!-- ponytail: hidden while empty, so the empty live region takes no row in the toolbar grid. -->
    <p :class="exampleError ? 'muted example-error' : 'visually-hidden'" role="status">{{ exampleError }}</p>
  </div>

  <main class="layout">
    <div class="stage">
      <BuilderStage />
    </div>
    <div class="controls">
      <StampPanel />
      <ItemPanel />
      <TilePanel />
      <ExportPanel />
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
}
.example-error {
  margin: 0;
  font-size: 0.875rem;
}
</style>
