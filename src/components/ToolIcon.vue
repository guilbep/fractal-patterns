<script setup lang="ts">
// The toolbar's 16 px line icons, drawn in currentColor. Paths from the design canvas.
defineProps<{ name: 'shuffle' | 'undo' | 'redo' | 'reset' | 'dice' | 'download' | 'link' | 'fullscreen' }>();
</script>

<template>
  <svg class="tool-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" :stroke-width="name === 'dice' ? 1.5 : 1.6" aria-hidden="true" focusable="false">
    <path v-if="name === 'shuffle'" d="M2 4h3l6 8h3M2 12h3l2-2.7M10 6.7 11 4h3M12 2l2 2-2 2M12 10l2 2-2 2" />
    <path v-else-if="name === 'undo'" d="M5 3 2 6l3 3M2 6h8a4 4 0 0 1 0 8H7" />
    <path v-else-if="name === 'redo'" d="m11 3 3 3-3 3M14 6H6a4 4 0 0 0 0 8h3" />
    <path v-else-if="name === 'reset'" d="M3 8a5 5 0 1 0 1.5-3.5M3 2v3h3" />
    <path v-else-if="name === 'download'" d="M8 2v8M4.5 6.5 8 10l3.5-3.5M2.5 13.5h11" />
    <path v-else-if="name === 'link'" d="M6.5 9.5l3-3M7 4.5l1-1a2.8 2.8 0 0 1 4 4l-1 1M9 11.5l-1 1a2.8 2.8 0 0 1-4-4l1-1" />
    <path v-else-if="name === 'fullscreen'" d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
    <template v-else>
      <rect x="2" y="2" width="12" height="12" rx="2.5" />
      <circle cx="5.5" cy="5.5" r="0.9" fill="currentColor" />
      <circle cx="10.5" cy="10.5" r="0.9" fill="currentColor" />
      <circle cx="8" cy="8" r="0.9" fill="currentColor" />
    </template>
  </svg>
</template>
