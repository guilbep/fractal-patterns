<script setup lang="ts">
// The Pattern Builder page: the shared header, a toolbar, the tile stage and four control panels.
import { onBeforeUnmount, onMounted } from 'vue';
import SiteHeader from '@/components/SiteHeader.vue';
import SponsorBanner from '@/components/SponsorBanner.vue';
import { isTyping } from '@/shortcuts.ts';
import { canRedo, canUndo, commit, redo, resetDesign, selectedId, undo } from './store.ts';
import { EXAMPLES } from './examples.ts';
import BuilderStage from './BuilderStage.vue';
import StampPanel from './StampPanel.vue';
import ItemPanel from './ItemPanel.vue';
import TilePanel from './TilePanel.vue';
import ExportPanel from './ExportPanel.vue';

function openExample(e: Event): void {
  const select = e.target as HTMLSelectElement;
  const example = EXAMPLES.find((x) => x.id === select.value);
  select.selectedIndex = 0;
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

  <div class="toolbar" role="toolbar" aria-label="Builder actions">
    <div class="bar-row">
      <button type="button" class="btn" :disabled="!canUndo" aria-keyshortcuts="Control+Z Meta+Z" @click="undo">Undo</button>
      <button type="button" class="btn" :disabled="!canRedo" aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z" @click="redo">Redo</button>
      <span class="bar-sep" aria-hidden="true"></span>
      <button type="button" class="btn" @click="resetDesign">Start again</button>
      <label for="examples" class="visually-hidden">Examples</label>
      <select id="examples" class="examples" @change="openExample">
        <option value="" disabled selected>Open an example</option>
        <option v-for="x in EXAMPLES" :key="x.id" :value="x.id">{{ x.label }}</option>
      </select>
    </div>
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
</style>
