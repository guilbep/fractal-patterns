<script setup lang="ts">
// The footprint of this page in the footer: the files the browser loaded for it (compressed body sizes, so a cached file
// still counts as on a first visit), with the size badge's CO2 estimate (co2.ts). Files loaded later (a tab's code,
// Breed's worker) are added as they arrive.
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { formatFootprint } from '@/co2.ts';

const bytes = ref(0);
const size = (e: PerformanceEntry) => (e as PerformanceResourceTiming).encodedBodySize || (e as PerformanceResourceTiming).transferSize || 0;
let observer: PerformanceObserver | undefined;
onMounted(() => {
  bytes.value = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')].reduce((s, e) => s + size(e), 0);
  try {
    observer = new PerformanceObserver((list) => (bytes.value += list.getEntries().reduce((s, e) => s + size(e), 0)));
    observer.observe({ type: 'resource' });
  } catch {
    /* no observer: the first count stays */
  }
});
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <p class="page-footprint">
    This page so far: <span class="mono">{{ bytes > 0 ? formatFootprint(bytes) : 'measuring…' }}</span>. Counted from the files your browser loaded, with the same estimate as the size badge.
  </p>
</template>
