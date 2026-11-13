<script setup lang="ts">
// The pattern tool's palette strip: PaletteStrip wired to the tool's state.
import { computed } from 'vue';
import { PALETTES } from '@/palettes.ts';
import { applyPalette, palette, paletteName, randomPalette, roles } from '@/state.ts';
import { stepPalette } from '@/shell.ts';
import PaletteStrip from './PaletteStrip.vue';

// Custom colors (no palette): show the three role colors instead of the five swatches.
const swatches = computed(() => palette.value?.colors ?? [roles.background, roles.pattern, roles.text]);
const label = computed(() => paletteName.value ?? 'Custom');

function step(dir: 1 | -1): void {
  const i = PALETTES.findIndex((p) => p.name === paletteName.value);
  applyPalette(PALETTES[stepPalette(i, dir, PALETTES.length)]!);
}
</script>

<template>
  <PaletteStrip :colors="swatches" :name="label" @previous="step(-1)" @next="step(1)" @random="randomPalette" />
</template>
