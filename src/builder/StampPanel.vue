<script setup lang="ts">
// The shapes library: the stamps of the design, the studio's generated drawings, and a person's own files.
// Untrusted files reach the page only as path data rebuilt from numbers (stampFromSvg, stampFromShapes), bound with :d.
import { computed, ref } from 'vue';
import { readImage } from '@/image-file.ts';
import { isSvgFile } from '@/studio/own-motif.ts';
import { addItem } from './design.ts';
import { stampFromShapes, stampFromSvg, studioStamps } from './stamps.ts';
import { commit, design, selectedId, useStamp } from './store.ts';
import type { Stamp } from './types.ts';

const MAX_BYTES = 5 * 1024 * 1024;
const seed = ref(1);
const studio = computed(() => studioStamps(seed.value));
const status = ref('');

/** Place items of these stamps (indexes into design.stamps) in a row through the tile center, and select the last. */
function place(stamps: readonly number[]): void {
  const { width, height } = design.value;
  let d = design.value;
  stamps.forEach((i, k) => {
    const x = width / 2 + (k - (stamps.length - 1) / 2) * (width / 5);
    d = addItem(d, i, x, height / 2, { scale: Math.min(width, height) / 4 / d.stamps[i]!.box });
  });
  if (!stamps.length) return;
  commit(d);
  selectedId.value = d.items[d.items.length - 1]!.id;
}

async function stampFromFile(file: File): Promise<Stamp | null> {
  if (isSvgFile(file.name, file.type)) return stampFromSvg(await file.text(), file.name);
  if (!file.type.startsWith('image/')) return null;
  const [{ traceColors, cropToSubject }, img] = await Promise.all([import('@/studio/colortrace.ts'), readImage(file, 256)]);
  // The studio's options for a color image (StudioApp.vue, method 'color' with its defaults); centered, as a stamp is.
  const c = cropToSubject(traceColors(img, { colors: 4, size: 100, smooth: 1, tolerance: 0.6, minArea: 4, curves: false }), 0.04, 'center');
  return stampFromShapes(c.shapes, c.box, file.name);
}

async function onFiles(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const files = [...(input.files ?? [])];
  input.value = ''; // the same files can be chosen again
  if (!files.length) return;
  status.value = 'Reading…';
  const added: number[] = [];
  const failed: string[] = [];
  const big: string[] = [];
  for (const file of files) {
    if (file.size > MAX_BYTES) {
      big.push(file.name);
      continue;
    }
    try {
      const s = await stampFromFile(file);
      if (s) added.push(useStamp(s));
      else failed.push(file.name);
    } catch {
      failed.push(file.name);
    }
  }
  place(added);
  const msg: string[] = [];
  if (added.length) msg.push(`Added ${added.length} ${added.length === 1 ? 'shape' : 'shapes'}.`);
  if (failed.length) msg.push(`${failed.length} ${failed.length === 1 ? 'file' : 'files'} could not be read as shapes: ${failed.join(', ')}.`);
  if (big.length) msg.push(`Over 5 MB, not read: ${big.join(', ')}.`);
  status.value = msg.join(' ');
}
</script>

<template>
  <section class="panel" aria-labelledby="stamps-h">
    <h2 id="stamps-h">Shapes</h2>

    <h3>In this tile</h3>
    <div class="stamp-grid">
      <button v-for="(s, i) in design.stamps" :key="i" type="button" class="stamp-btn" :aria-label="s.name" :title="s.name" @click="place([i])">
        <svg :viewBox="`0 0 ${s.box} ${s.box}`" aria-hidden="true">
          <path v-for="(p, j) in s.parts" :key="j" :d="p.d" :fill="p.paint === 'fill' ? p.color : 'none'" :fill-rule="p.evenodd ? 'evenodd' : undefined" :stroke="p.paint === 'stroke' ? p.color : 'none'" :stroke-width="p.paint === 'stroke' ? s.box / 25 : undefined" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>

    <h3>Studio drawings</h3>
    <div class="stamp-grid">
      <button v-for="(s, i) in studio" :key="i" type="button" class="stamp-btn" :aria-label="s.name" :title="s.name" @click="place([useStamp(s)])">
        <svg :viewBox="`0 0 ${s.box} ${s.box}`" aria-hidden="true">
          <path v-for="(p, j) in s.parts" :key="j" :d="p.d" :fill="p.paint === 'fill' ? p.color : 'none'" :fill-rule="p.evenodd ? 'evenodd' : undefined" :stroke="p.paint === 'stroke' ? p.color : 'none'" :stroke-width="p.paint === 'stroke' ? s.box / 25 : undefined" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>
    <button type="button" class="more" @click="seed++">Other drawings</button>

    <h3>Your own files</h3>
    <label class="file">
      Add SVG files or an image
      <input type="file" multiple accept="image/*,.svg" @change="onFiles" />
    </label>
    <p class="status" role="status">{{ status }}</p>
  </section>
</template>

<style scoped>
h3 {
  margin: 0.75rem 0 0.4rem;
  font-size: 0.85rem;
}
.stamp-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.stamp-btn svg {
  display: block;
  width: 40px;
  height: 40px;
}
.more {
  margin-top: 0.4rem;
}
.file {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  max-width: 100%;
}
.file input {
  max-width: 100%;
}
.stamp-btn:focus-visible,
.more:focus-visible,
.file input:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
.status {
  min-height: 1.2em;
  margin: 0.4rem 0 0;
  overflow-wrap: anywhere;
}
</style>
