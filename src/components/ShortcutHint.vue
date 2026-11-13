<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import '@/css/shortcut-hint.css';

// A quiet reminder of the single-key shortcuts, in a corner of the preview. Decorative for assistive
// technology: the same facts are in the label of the shortcut checkbox and on the toolbar button.
defineProps<{ on: boolean }>();

// In full screen the F key leaves it, and the hint says so.
const full = ref(false);
const sync = () => (full.value = document.fullscreenElement !== null);
onMounted(() => document.addEventListener('fullscreenchange', sync));
onBeforeUnmount(() => document.removeEventListener('fullscreenchange', sync));
</script>

<template>
  <p v-if="on" class="shortcut-hint" aria-hidden="true"><kbd>R</kbd> shuffle <span class="sep">·</span> <kbd>F</kbd> {{ full ? 'exit full screen' : 'full screen' }}</p>
</template>
