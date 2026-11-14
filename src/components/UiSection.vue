<script setup lang="ts">
// A folded card: the title and a one-line summary of its current values stay visible when closed.
// The same markup and class names as the Studio folds (src/css/studio.css), with the title as a heading.
defineProps<{ title: string; summary?: string; open?: boolean; headingId?: string; level?: 2 | 3 }>();
</script>

<template>
  <details class="panel fold ui-section" :open="open">
    <summary>
      <component :is="`h${level ?? 2}`" :id="headingId" class="fold-title">{{ title }}</component>
      <span class="fold-sum">{{ summary }}</span>
      <span class="fold-mark" aria-hidden="true">▸</span>
    </summary>
    <div class="fold-body">
      <slot />
    </div>
  </details>
</template>
