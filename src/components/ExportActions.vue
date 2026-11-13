<script setup lang="ts">
// Download SVG, Copy SVG, Copy CSS, one status line, and the CSS to copy by hand. The slot takes page extras.
import { ref, useId } from 'vue';
import { copyText } from '@/clipboard.ts';

// cssBox false: the page shows the CSS box itself, e.g. in a fold.
const props = withDefaults(defineProps<{ svg: string; css: string; fileName: string; cssBox?: boolean }>(), { cssBox: true });
const cssId = useId();

function download(): void {
  const url = URL.createObjectURL(new Blob([props.svg], { type: 'image/svg+xml' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${props.fileName}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

const status = ref('');
let timer: ReturnType<typeof setTimeout> | undefined;
async function copy(text: string): Promise<void> {
  status.value = '';
  status.value = (await copyText(text)) ? 'Copied.' : 'Copy failed: select the text and copy it by hand.';
  clearTimeout(timer);
  timer = setTimeout(() => (status.value = ''), 2000);
}
</script>

<template>
  <div class="out-actions">
    <button type="button" class="btn primary" @click="download">Download SVG</button>
    <button type="button" class="btn" @click="copy(svg)">Copy SVG</button>
    <button type="button" class="btn" @click="copy(css)">Copy CSS</button>
    <slot />
  </div>
  <p class="copy-status" role="status" aria-live="polite">{{ status }}</p>
  <template v-if="cssBox">
    <label :for="cssId">CSS background</label>
    <textarea :id="cssId" class="code" readonly rows="4" :value="css" @focus="($event.target as HTMLTextAreaElement).select()"></textarea>
  </template>
</template>

<style scoped>
.out-actions { display: flex; flex-wrap: wrap; gap: var(--s2); }
textarea.code { display: block; inline-size: 100%; max-inline-size: 100%; box-sizing: border-box; font-family: inherit; resize: vertical; }
</style>
