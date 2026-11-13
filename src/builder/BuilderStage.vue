<script setup lang="ts">
// Stub stage: the design tiled as a CSS background, like the studio's wall. Editing comes later.
import { computed } from 'vue';
import { svgToDataUri } from '@/css.ts';
import { repeatCell } from '@/studio/model.ts';
import { toStudio } from './design.ts';
import { design, svg } from './store.ts';

const wallStyle = computed(() => {
  const cell = repeatCell(toStudio(design.value));
  return {
    backgroundColor: design.value.background ?? 'transparent',
    backgroundImage: `url("${svgToDataUri(svg.value)}")`,
    backgroundSize: `${cell.width}px ${cell.height}px`,
  };
});
</script>

<template>
  <div id="wall" class="wall" role="img" :aria-label="`Pattern preview, ${design.items.length} shapes, ${design.repeat} repeat`" :style="wallStyle"></div>
</template>
