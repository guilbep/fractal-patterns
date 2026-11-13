<script setup lang="ts">
import { computed, ref } from 'vue';
import { PALETTES } from '@/palettes.ts';
import { applyPalette, palette, paletteName, randomPalette, roles } from '@/state.ts';
import { stepPalette } from '@/shell.ts';

// Custom colors (no palette): show the three role colors instead of the five swatches.
const swatches = computed(() => palette.value?.colors ?? [roles.background, roles.pattern, roles.text]);
const label = computed(() => paletteName.value ?? 'Custom');

// Feedback: a new key restarts the CSS animation of the swatches and of the dice.
const rolls = ref(0);
function roll(): void {
  rolls.value++;
  randomPalette();
}

function step(dir: 1 | -1): void {
  const i = PALETTES.findIndex((p) => p.name === paletteName.value);
  applyPalette(PALETTES[stepPalette(i, dir, PALETTES.length)]!);
}
</script>

<template>
  <span class="palette-strip">
    <button type="button" class="icon-btn" aria-label="Previous palette" title="Previous palette" @click="step(-1)"><span aria-hidden="true">‹</span></button>
    <span :key="swatches.join()" class="swatches" aria-hidden="true"><span v-for="(c, i) in swatches" :key="i" class="swatch" :style="{ background: c }"></span></span>
    <span class="palette-name"><span class="visually-hidden">Palette: </span>{{ label }}</span>
    <button type="button" class="icon-btn" aria-label="Next palette" title="Next palette" @click="step(1)"><span aria-hidden="true">›</span></button>
    <button type="button" class="icon-btn" aria-label="Random palette" title="Random palette" @click="roll"><span :key="rolls" class="dice" aria-hidden="true">⚄</span></button>
  </span>
</template>
