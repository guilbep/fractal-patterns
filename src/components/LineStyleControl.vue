<script setup lang="ts">
import { computed } from 'vue';
import UiSegmented from '@/components/UiSegmented.vue';

const STYLES = [
  { value: 'even', label: 'Even' },
  { value: 'brush', label: 'Brush' },
  { value: 'hand', label: 'Hand-drawn' },
] as const;
// The page state comes in as props: importing state.ts here would split the start chunks (see RegionsControl.vue).
// reason: lineStyleOffReason in state.ts ('interlace', or a region colour reason, said here for the line style).
const props = defineProps<{ value: string; reason: string }>();
const emit = defineEmits<{ set: [value: string] }>();
const said = computed(() =>
  props.reason === 'interlace'
    ? 'Interlace draws its own ribbons; turn it off to use a line style.'
    : props.reason.replace(/^Region colors (work|do)/, (_, v: string) => `Line styles ${v}`).replace('them.', 'one.'),
);
</script>

<template>
  <div class="field linestyle">
    <UiSegmented :model-value="value" label="Line style" name="ls-style" :options="STYLES" :disabled="!!said" @update:model-value="emit('set', String($event))" />
    <p v-if="said" class="hint-text">{{ said }}</p>
  </div>
</template>
