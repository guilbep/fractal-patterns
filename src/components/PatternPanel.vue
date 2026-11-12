<script setup lang="ts">
import { computed } from 'vue';
import { FAMILIES, FAMILY_LABELS, KIND_FAMILY, KIND_LABELS, MAX_DEPTH } from '@/fractal.ts';
import { MAX_SEED, params, previews, reseed, setSeed, source, usingImage } from '@/state.ts';

const groups = computed(() =>
  FAMILIES.map((family) => ({ family, items: previews.value.filter((p) => KIND_FAMILY[p.kind] === family) })).filter((g) => g.items.length),
);
</script>

<template>
  <section class="panel" aria-labelledby="pattern-h">
    <h2 id="pattern-h">Pattern</h2>
    <fieldset class="gallery">
      <legend>Pattern</legend>
      <p v-if="usingImage" class="note image-source-note">The tile now comes from your image (see From image). Pick a pattern here to go back to math patterns.</p>
      <nav class="family-links" aria-label="Pattern families">
        <a v-for="g in groups" :key="g.family" :href="`#family-${g.family}`">{{ FAMILY_LABELS[g.family] }}</a>
      </nav>
      <!-- One radio group over all kinds: arrow keys move across families in DOM order. -->
      <div v-for="g in groups" :key="g.family" class="family">
        <h3 :id="`family-${g.family}`" class="family-h">{{ FAMILY_LABELS[g.family] }} <span class="muted">{{ g.items.length }}</span></h3>
        <div class="kinds">
          <label v-for="p in g.items" :key="p.kind" class="kind">
            <input v-model="params.kind" type="radio" name="kind" :value="p.kind" class="visually-hidden" @click="source = 'math'">
            <span class="kind-tile" :style="p.css" aria-hidden="true"></span>
            <span class="kind-name">{{ KIND_LABELS[p.kind] }}</span>
          </label>
        </div>
      </div>
    </fieldset>

    <div class="fields">
      <div class="field">
        <label for="seed">Seed</label>
        <div class="seed-row">
          <input id="seed" :disabled="usingImage" type="number" min="0" :max="MAX_SEED" step="1" :value="params.seed" @input="setSeed(($event.target as HTMLInputElement).value)" @change="($event.target as HTMLInputElement).value = String(params.seed)">
          <button type="button" class="btn icon-btn" title="New seed" :disabled="usingImage" @click="reseed">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66" /><path d="M20 4v5h-5" /></svg>
            <span class="visually-hidden">New seed</span>
          </button>
        </div>
      </div>
      <div class="field">
        <label for="depth">Depth <output for="depth">{{ params.depth }} of {{ MAX_DEPTH[params.kind] }}</output></label>
        <input id="depth" :disabled="usingImage" v-model.number="params.depth" type="range" min="1" :max="MAX_DEPTH[params.kind]" step="1">
      </div>
      <div class="field">
        <label for="size">Tile size <output for="size">{{ params.size }} px</output></label>
        <input id="size" v-model.number="params.size" type="range" min="40" max="240" step="4">
      </div>
      <div class="field">
        <label for="stroke">Stroke width <output for="stroke">{{ params.strokeWidth }} px</output></label>
        <input id="stroke" v-model.number="params.strokeWidth" type="range" min="0.5" max="6" step="0.5">
      </div>
    </div>
  </section>
</template>
