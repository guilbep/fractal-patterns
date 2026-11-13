<script setup lang="ts">
import '@/css/shortcut-hint.css';

// A quiet reminder of the single-key shortcuts, in a corner of the preview. Decorative for assistive
// technology: the same facts are in the label of the shortcut checkbox and on the toolbar button.
defineProps<{ on: boolean }>();
</script>

<template>
  <p v-if="on" class="shortcut-hint" aria-hidden="true"><kbd>R</kbd> shuffle <span class="sep">·</span> <kbd>F</kbd> full screen</p>
</template>
