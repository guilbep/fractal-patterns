<script setup lang="ts">
// Weight grade, sizes and footprint of an SVG tile, as the Studio toolbar shows them. Owns the gzip watcher.
import { computed, ref, watch } from 'vue';
import { formatFootprint, formatKb, GRADE_SCALE, gradeBand, gzipSize, rawSize, weightGrade } from '@/co2.ts';

const props = defineProps<{ svg: string }>();

// Raw now, gzipped when CompressionStream answers. A stale answer is dropped.
const raw = computed(() => rawSize(props.svg));
const gz = ref<number | null | 'unknown'>(null);
watch(
  () => props.svg,
  async (text) => {
    gz.value = null;
    try {
      const n = await gzipSize(text);
      if (text === props.svg) gz.value = n;
    } catch {
      if (text === props.svg) gz.value = 'unknown';
    }
  },
  { immediate: true },
);
const sizeText = computed(() => `${raw.value} bytes, ${typeof gz.value === 'number' ? `${gz.value} gzipped` : gz.value === null ? 'compressing' : 'gzip size unknown'}`);
const footprintFull = computed(() => (gz.value === null ? 'computing' : gz.value === 'unknown' ? 'size unknown' : formatFootprint(gz.value)));
const footprintText = computed(() => footprintFull.value.split(' / ')[0]);
</script>

<template>
  <span v-if="typeof gz === 'number'" class="stat" :title="GRADE_SCALE"><span aria-hidden="true" class="grade-chip" :class="gradeBand(weightGrade(gz).grade)">{{ weightGrade(gz).grade }}</span><span class="visually-hidden">Weight grade {{ weightGrade(gz).grade }}, {{ formatKb(gz) }} kilobytes compressed</span></span>
  <span class="stat">{{ sizeText }}</span>
  <span class="stat" :title="footprintFull"><span aria-hidden="true">{{ footprintText }}</span><span class="visually-hidden">{{ footprintFull }}</span></span>
</template>
