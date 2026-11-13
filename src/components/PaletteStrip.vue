<script setup lang="ts">
import { computed } from 'vue';
import { PALETTES } from '@/palettes.ts';
import { applyPalette, palette, paletteName, randomPalette, roles } from '@/state.ts';
import { stepPalette } from '@/shell.ts';

// Custom colors (no palette): show the three role colors instead of the five swatches.
const swatches = computed(() => palette.value?.colors ?? [roles.background, roles.pattern, roles.text]);
const label = computed(() => paletteName.value ?? 'Custom');

function step(dir: 1 | -1): void {
  const i = PALETTES.findIndex((p) => p.name === paletteName.value);
  applyPalette(PALETTES[stepPalette(i, dir, PALETTES.length)]!);
}
</script>

<template>
  <span class="palette-strip">
    <button type="button" class="icon-btn" aria-label="Previous palette" title="Previous palette" @click="step(-1)"><span aria-hidden="true">‹</span></button>
    <span class="swatches" aria-hidden="true"><span v-for="(c, i) in swatches" :key="i" class="swatch" :style="{ background: c }"></span></span>
    <span class="palette-name"><span class="visually-hidden">Palette: </span>{{ label }}</span>
    <button type="button" class="icon-btn" aria-label="Next palette" title="Next palette" @click="step(1)"><span aria-hidden="true">›</span></button>
    <button type="button" class="icon-btn" aria-label="Random palette" title="Random palette" @click="randomPalette"><span aria-hidden="true">⚄</span></button>
  </span>
</template>
