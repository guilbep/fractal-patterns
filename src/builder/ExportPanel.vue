<script setup lang="ts">
// The builder's export: size badge, the shared actions, and the design as a JSON file.
import { ref } from 'vue';
import ExportActions from '@/components/ExportActions.vue';
import SizeBadge from '@/components/SizeBadge.vue';
import { css } from './builder-css.ts';
import { parseDesign } from './design.ts';
import { commit, design, svg } from './store.ts';

const MAX_BYTES = 5 * 1024 * 1024;

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
  <section class="card" aria-labelledby="export-h">
    <details>
    <summary class="card-head">
      <h2 id="export-h">Export</h2>
      <span class="card-sum">SVG · CSS · design file</span>
    </summary>
    <div class="card-body">
    <p class="export-stats"><SizeBadge :svg="svg" /></p>
    <ExportActions :svg="svg" :css="css" file-name="pattern-builder" :css-box="false" />
    <details class="group">
      <summary>CSS and design file</summary>
      <label for="builder-css">CSS background</label>
      <textarea id="builder-css" class="code" readonly rows="4" :value="css" @focus="($event.target as HTMLTextAreaElement).select()"></textarea>
      <button type="button" class="btn group-end" @click="downloadDesign">Download design (.json)</button>
      <div class="field">
        <label for="open-design">Open a design file</label>
        <input id="open-design" class="file-input" type="file" accept=".json,application/json" @change="openDesign">
      </div>
      <p class="copy-status" role="status" aria-live="polite">{{ openStatus }}</p>
    </details>
    </div>
    </details>
  </section>
</template>

<style scoped>
/* Same rule as the box in ExportActions.vue. */
textarea.code { display: block; inline-size: 100%; max-inline-size: 100%; box-sizing: border-box; font-family: inherit; resize: vertical; margin-block-end: var(--s2); }
</style>
