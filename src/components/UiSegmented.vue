<script setup lang="ts">
import { nextTick, ref, useId } from 'vue';
import { nextIndex } from '@/segmented.ts';

type Option = { value: string | number; label: string; disabled?: boolean };
const props = defineProps<{ modelValue: string | number; options: readonly Option[]; label: string; disabled?: boolean; name?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>();
const uid = props.name ?? useId();
const buttons = ref<HTMLButtonElement[]>([]);

const off = (o: Option) => props.disabled || !!o.disabled;
// The checked option takes the tab stop; with none checked, the first enabled one does.
function tabStop(): number {
  const i = props.options.findIndex((o) => o.value === props.modelValue && !off(o));
  return i >= 0 ? i : props.options.findIndex((o) => !off(o));
}

function onKey(e: KeyboardEvent, current: number) {
  const next = nextIndex(props.options.length, current, e.key, props.options.map(off));
  if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') e.preventDefault();
  if (next === current) return;
  emit('update:modelValue', props.options[next]!.value);
  void nextTick(() => buttons.value[next]?.focus());
}
</script>

<template>
  <div class="ui-segmented">
    <span :id="`${uid}-label`" class="ui-segmented-label">{{ label }}</span>
    <div role="radiogroup" class="ui-segmented-group" :aria-labelledby="`${uid}-label`" :aria-disabled="disabled || undefined">
      <button
        v-for="(o, i) in options"
        :key="o.value"
        ref="buttons"
        type="button"
        role="radio"
        class="ui-segmented-option"
        :aria-checked="o.value === modelValue"
        :tabindex="i === tabStop() ? 0 : -1"
        :disabled="off(o)"
        @click="emit('update:modelValue', o.value)"
        @keydown="onKey($event, i)"
      >
        {{ o.label }}
      </button>
    </div>
  </div>
</template>
