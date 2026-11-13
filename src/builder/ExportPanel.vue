<script setup lang="ts">
// Stub: download the tile as an SVG file.
import { svg } from './store.ts';

function download(): void {
  const url = URL.createObjectURL(new Blob([svg.value], { type: 'image/svg+xml' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pattern-builder.svg';
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <section class="panel" aria-labelledby="export-h">
    <h2 id="export-h">Export</h2>
    <button type="button" class="btn" @click="download">Download SVG</button>
  </section>
</template>
