<script setup lang="ts">
import { ref, useId } from 'vue';

const props = defineProps<{ label: string; accept: string; multiple?: boolean; hint?: string; disabled?: boolean; buttonText?: string; hidePrivacy?: boolean; id?: string }>();
const emit = defineEmits<{ files: [files: File[]] }>();
const uid = props.id ?? useId();
const input = ref<HTMLInputElement | null>(null);
const dragging = ref(false);

function onChange(): void {
  const files = [...(input.value?.files ?? [])];
  input.value!.value = ''; // the same file can be chosen again
  if (files.length) emit('files', files);
}
function onDrop(e: DragEvent): void {
  dragging.value = false;
  const files = [...(e.dataTransfer?.files ?? [])];
  if (!props.disabled && files.length) emit('files', files);
}
</script>

<template>
  <div class="ui-file-drop" :class="{ dragging }" @dragover.prevent="dragging = !disabled" @dragleave="dragging = false" @drop.prevent="onDrop">
    <label :id="`${uid}-label`" :for="uid" class="ui-file-drop-label">{{ label }}</label>
    <!-- The real input stays in the page for forms and tests; the button below is the keyboard and pointer path. -->
    <input :id="uid" ref="input" class="visually-hidden" type="file" tabindex="-1" :accept="accept" :multiple="multiple" :disabled="disabled" @change="onChange" />
    <button
      type="button"
      class="btn secondary"
      :aria-describedby="[`${uid}-label`, hint ? `${uid}-hint` : ''].join(' ').trim()"
      :disabled="disabled"
      @click="input?.click()"
    >
      {{ buttonText ?? (multiple ? 'Choose files' : 'Choose a file') }}
    </button>
    <p v-if="hint" :id="`${uid}-hint`" class="ui-file-drop-note">{{ hint }}</p>
    <p v-if="!hidePrivacy" class="ui-file-drop-note">Stays on your device. Nothing is uploaded.</p>
  </div>
</template>
