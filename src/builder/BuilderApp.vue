<script setup lang="ts">
// The Pattern Builder page: the shared header, a toolbar, the tile stage and four control panels.
import { onBeforeUnmount, onMounted } from 'vue';
import SiteHeader from '@/components/SiteHeader.vue';
import SponsorBanner from '@/components/SponsorBanner.vue';
import { isTyping } from '@/shortcuts.ts';
import { canRedo, canUndo, redo, resetDesign, undo } from './store.ts';
import BuilderStage from './BuilderStage.vue';
import StampPanel from './StampPanel.vue';
import ItemPanel from './ItemPanel.vue';
import TilePanel from './TilePanel.vue';
import ExportPanel from './ExportPanel.vue';

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
