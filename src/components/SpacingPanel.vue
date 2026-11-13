<script setup lang="ts">
import { computed } from 'vue';
import { aspect, curvesOn, resetSpacing, spacing, usingImage, variantsOn } from '@/state.ts';

const off = computed(() => variantsOn.value || curvesOn.value || aspect.value !== 1);
// Mirror also works on the cells of an image grid (see imageCells).
const mirrorOff = computed(() => off.value && !(variantsOn.value && usingImage.value));
</script>

<template>
  <section class="panel" aria-labelledby="spacing-h">
    <h2 id="spacing-h">Spacing</h2>
    <p v-if="variantsOn" class="hint-text">Not combined with Reduce repetition yet{{ usingImage ? ', except Mirror' : '' }}.</p>
    <p v-if="curvesOn" class="hint-text">Not combined with Smooth curves yet.</p>
    <p v-if="aspect !== 1" class="hint-text">Not available for this pattern yet.</p>
    <p class="hint-text">Zoom above 1 removes the empty margin around a pattern. Gap adds space between repeats.</p>
    <div class="fields">
      <div class="field">
        <label for="zoom">Zoom <output for="zoom">{{ spacing.zoom.toFixed(2) }}×</output></label>
        <input id="zoom" :disabled="off" v-model.number="spacing.zoom" type="range" min="0.5" max="3" step="0.05">
      </div>
      <div class="field">
        <label for="gap">Gap <output for="gap">{{ spacing.gap }} px</output></label>
        <input id="gap" :disabled="off" v-model.number="spacing.gap" type="range" min="0" max="120" step="2">
      </div>
    </div>
    <label class="radio"><input v-model="spacing.mirror" type="checkbox" :disabled="mirrorOff" aria-describedby="mirror-hint"> Mirror</label>
    <p id="mirror-hint" class="hint-text">Makes any tile repeat without a seam. Use it for traced photos.</p>
    <button type="button" class="btn" @click="resetSpacing">Reset spacing</button>
  </section>
</template>
