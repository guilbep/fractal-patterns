// The builder's CSS background: one computation for the Export card and the toolbar.
import { computed } from 'vue';
import { tileCss } from '@/export-file.ts';
import { repeatCell } from '@/studio/model.ts';
import { toStudio } from './design.ts';
import { design, svg } from './store.ts';

export const css = computed(() => {
  const cell = repeatCell(toStudio(design.value));
  return tileCss(svg.value, cell.width, cell.height, design.value.background);
});
