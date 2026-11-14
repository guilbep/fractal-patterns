<script setup lang="ts">
import UiSegmented from '@/components/UiSegmented.vue';

const MODES = [
  { value: 'off', label: 'Off' },
  { value: 'shape', label: 'By shape' },
  { value: 'neighbours', label: 'Neighbours differ' },
] as const;
const COUNTS = [2, 3, 4].map((n) => ({ value: n, label: String(n) }));
// The page state comes in as props: importing state.ts here would split the start chunks (see ColorSymmetryPanel.vue).
defineProps<{ mode: string; k: number; colors: readonly string[]; note: string }>();
const emit = defineEmits<{ mode: [value: string]; k: [value: number] }>();
</script>

<template>
  <div class="fields pattern-card regions">
    <UiSegmented :model-value="mode" label="Color each region" name="rc-mode" :options="MODES" @update:model-value="emit('mode', String($event))" />
    <template v-if="mode !== 'off'">
      <UiSegmented :model-value="k" label="Colors" name="rc-k" :options="COUNTS" @update:model-value="emit('k', Number($event))" />
      <span class="swatches" aria-hidden="true"><span v-for="(c, i) in colors" :key="i" :style="{ background: c }"></span></span>
      <p v-if="note" role="status" class="hint-text">{{ note }}</p>
    </template>
  </div>
</template>
