<script setup lang="ts">
import { useId } from 'vue';

const props = defineProps<{ modelValue: boolean; label: string; hint?: string; disabled?: boolean; id?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
const uid = props.id ?? useId();
</script>

<template>
  <div class="ui-switch">
    <button
      :id="uid"
      type="button"
      role="switch"
      class="ui-switch-track"
      :aria-checked="modelValue"
      :aria-labelledby="`${uid}-label`"
      :aria-describedby="hint ? `${uid}-hint` : undefined"
      :disabled="disabled"
      @click="emit('update:modelValue', !modelValue)"
    >
      <span class="ui-switch-thumb" aria-hidden="true"></span>
    </button>
    <label :id="`${uid}-label`" :for="uid" class="ui-switch-label">{{ label }}</label>
    <p v-if="hint" :id="`${uid}-hint`" class="ui-switch-hint">{{ hint }}</p>
  </div>
</template>
