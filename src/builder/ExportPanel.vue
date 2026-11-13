<script setup lang="ts">
// The builder's export: size badge, the shared actions, and the design as a JSON file.
import { computed, ref } from 'vue';
import ExportActions from '@/components/ExportActions.vue';
import SizeBadge from '@/components/SizeBadge.vue';
import { tileCss } from '@/export-file.ts';
import { repeatCell } from '@/studio/model.ts';
import { parseDesign, toStudio } from './design.ts';
import { commit, design, svg } from './store.ts';

const MAX_BYTES = 5 * 1024 * 1024;

const css = computed(() => {
  const cell = repeatCell(toStudio(design.value));
  return tileCss(svg.value, cell.width, cell.height, design.value.background);
});

function downloadDesign(): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(design.value)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pattern-builder.json';
  a.click();
  URL.revokeObjectURL(url);
}

const openStatus = ref('');
async function openDesign(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // the same file can be opened again
  if (!file) return;
  openStatus.value = '';
  if (file.size > MAX_BYTES) {
    openStatus.value = 'This file is larger than 5 MB.';
    return;
  }
  try {
    // Untrusted file: parseDesign checks every field.
    const d = parseDesign(JSON.parse(await file.text()));
    if (!d) throw new Error('not a design');
    commit(d);
    openStatus.value = 'Design opened.';
  } catch {
    openStatus.value = 'This file is not a builder design.';
  }
}
</script>

<template>
  <section class="panel" aria-labelledby="export-h">
    <h2 id="export-h">Export</h2>
    <p class="export-stats"><SizeBadge :svg="svg" /></p>
    <ExportActions :svg="svg" :css="css" file-name="pattern-builder">
      <button type="button" class="btn" @click="downloadDesign">Download design (.json)</button>
    </ExportActions>
    <div class="field">
      <label for="open-design">Open a design file</label>
      <input id="open-design" type="file" accept=".json,application/json" @change="openDesign">
    </div>
    <p class="copy-status" role="status" aria-live="polite">{{ openStatus }}</p>
  </section>
</template>

<style scoped>
.export-stats { display: flex; flex-wrap: wrap; gap: var(--s2); }
#open-design { max-inline-size: 100%; }
</style>
