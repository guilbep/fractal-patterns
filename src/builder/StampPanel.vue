<script setup lang="ts">
// The shapes library: the stamps of the design, the studio's generated drawings, and a person's own files.
// Untrusted files reach the page only as path data rebuilt from numbers (stampFromSvg, stampFromShapes), bound with :d.
import { computed, ref } from 'vue';
import UiFileDrop from '@/components/UiFileDrop.vue';
import { readImage } from '@/image-file.ts';
import { isSvgFile } from '@/studio/own-motif.ts';
import { addItem } from './design.ts';
import { stampFromShapes } from './stamps.ts';
import { commit, design, selectedId, useStamp } from './store.ts';
import type { Stamp } from './types.ts';

const MAX_BYTES = 5 * 1024 * 1024;
const seed = ref(1);
const status = ref('');
let svgFailed = false; // set by stampFromFile when the SVG module cannot load

// The studio drawings: the motif generators load only when the group opens the first time.
type StudioMod = typeof import('./studio-stamps.ts');
const studioMod = ref<StudioMod | null>(null);
const studioState = ref<'' | 'loading' | 'failed'>('');
const studio = computed(() => studioMod.value?.studioStamps(seed.value) ?? []);
async function onStudioToggle(e: Event): Promise<void> {
  if (!(e.target as HTMLDetailsElement).open || studioMod.value || studioState.value === 'loading') return;
  studioState.value = 'loading';
  try {
    studioMod.value = await import('./studio-stamps.ts');
    studioState.value = '';
  } catch {
    studioState.value = 'failed';
  }
}

// The math patterns: their generators load only when the group opens the first time.
type PatternMod = typeof import('./pattern-stamps.ts');
const mathMod = ref<PatternMod | null>(null);
const mathState = ref<'' | 'loading' | 'failed'>('');
const mathFamily = ref('');
const mathSeed = ref(1);
const mathStamps = computed(() => {
  const m = mathMod.value;
  const g = m?.patternStampList().find((f) => f.family === mathFamily.value);
  return g ? g.kinds.map((k) => m!.patternStamp(k.kind, mathSeed.value)).filter((s): s is Stamp => s !== null) : [];
});
async function onMathToggle(e: Event): Promise<void> {
  if (!(e.target as HTMLDetailsElement).open || mathMod.value || mathState.value === 'loading') return;
  mathState.value = 'loading';
  try {
    const m = await import('./pattern-stamps.ts');
    mathFamily.value = m.patternStampList()[0]!.family;
    mathMod.value = m;
    mathState.value = '';
  } catch {
    mathState.value = 'failed';
  }
}

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
  if (isSvgFile(file.name, file.type)) {
    // The SVG importer loads with the first SVG file.
    const [mod, text] = await Promise.all([import('./svg-stamps.ts').catch(() => null), file.text()]);
    if (!mod) {
      svgFailed = true;
      return null;
    }
    return mod.stampFromSvg(text, file.name);
  }
  if (!file.type.startsWith('image/')) return null;
  const [{ traceColors, cropToSubject }, img] = await Promise.all([import('@/studio/colortrace.ts'), readImage(file, 256)]);
  // The studio's options for a color image (StudioApp.vue, method 'color' with its defaults); centered, as a stamp is.
  const c = cropToSubject(traceColors(img, { colors: 4, size: 100, smooth: 1, tolerance: 0.6, minArea: 4, curves: false }), 0.04, 'center');
  return stampFromShapes(c.shapes, c.box, file.name);
}

async function onFiles(files: File[]): Promise<void> {
  if (!files.length) return;
  status.value = 'Loading…';
  svgFailed = false;
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
  if (svgFailed) msg.push('The SVG reader could not be loaded. Reload the page to try again.');
  status.value = msg.join(' ');
}
</script>

<template>
  <section class="panel" aria-labelledby="stamps-h">
    <!-- The page heading, as App.vue has one; the site header shows the name already. -->
    <h1 class="visually-hidden">Pattern Builder</h1>
    <h2 id="stamps-h">Shapes</h2>

    <h3>In this tile</h3>
    <div class="stamp-grid">
      <button v-for="(s, i) in design.stamps" :key="i" type="button" class="stamp-btn" :aria-label="s.name" :title="s.name" @click="place([i])">
        <svg :viewBox="`0 0 ${s.box} ${s.box}`" aria-hidden="true">
          <path v-for="(p, j) in s.parts" :key="j" :d="p.d" :fill="p.paint === 'fill' ? p.color : 'none'" :fill-rule="p.evenodd ? 'evenodd' : undefined" :stroke="p.paint === 'stroke' ? p.color : 'none'" :stroke-width="p.paint === 'stroke' ? s.box / 25 : undefined" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>

    <details class="group" @toggle="onStudioToggle">
      <summary>Studio drawings</summary>
      <p v-if="studioState === 'loading'" class="hint-text" role="status">Loading…</p>
      <p v-else-if="studioState === 'failed'" class="hint-text" role="status">The studio drawings could not be loaded. Reload the page to try again.</p>
      <div v-if="studioMod" class="stamp-grid">
        <button v-for="(s, i) in studio" :key="i" type="button" class="stamp-btn" :aria-label="s.name" :title="s.name" @click="place([useStamp(s)])">
          <svg :viewBox="`0 0 ${s.box} ${s.box}`" aria-hidden="true">
            <path v-for="(p, j) in s.parts" :key="j" :d="p.d" :fill="p.paint === 'fill' ? p.color : 'none'" :fill-rule="p.evenodd ? 'evenodd' : undefined" :stroke="p.paint === 'stroke' ? p.color : 'none'" :stroke-width="p.paint === 'stroke' ? s.box / 25 : undefined" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
      <button v-if="studioMod" type="button" class="btn group-end" @click="seed++">Other drawings</button>
    </details>

    <details class="group" @toggle="onMathToggle">
      <summary>Math patterns</summary>
      <p v-if="mathState === 'loading'" class="hint-text" role="status">Loading…</p>
      <p v-else-if="mathState === 'failed'" class="hint-text" role="status">The math patterns could not be loaded. Reload the page to try again.</p>
      <template v-if="mathMod">
        <div class="field">
          <label for="math-family">Family</label>
          <select id="math-family" v-model="mathFamily">
            <option v-for="f in mathMod.patternStampList()" :key="f.family" :value="f.family">{{ f.label }}</option>
          </select>
        </div>
        <div class="stamp-grid">
          <button v-for="(s, i) in mathStamps" :key="i" type="button" class="stamp-btn" :aria-label="s.name" :title="s.name" @click="place([useStamp(s)])">
            <svg :viewBox="`0 0 ${s.box} ${s.box}`" aria-hidden="true">
              <path v-for="(p, j) in s.parts" :key="j" :d="p.d" fill="none" :stroke="p.color" :stroke-width="s.box / 50" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
        <button type="button" class="btn group-end" @click="mathSeed++">Other variant</button>
      </template>
    </details>

    <details class="group" open>
      <summary>Your own files</summary>
      <UiFileDrop id="stamp-files" label="Add SVG files or an image" accept="image/*,.svg" multiple @files="onFiles" />
      <p class="hint-text status" role="status">{{ status }}</p>
    </details>
  </section>
</template>

<style scoped>
h3 {
  margin: 0 0 var(--s1);
  font-size: 1rem;
}
.status {
  min-height: 1.2em;
  overflow-wrap: anywhere;
}
</style>
