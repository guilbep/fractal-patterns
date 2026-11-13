<script setup lang="ts">
// Weight grade, sizes and footprint of an export. Two layouts:
// - svg: the Studio and Builder stats; the component gzips the SVG itself.
// - gzip + breakdown: the Patterns toolbar; the page knows the compressed size, the grade chip carries a tooltip.
import { computed, ref, watch } from 'vue';
import { formatFootprint, formatKb, GRADE_SCALE, gradeBand, gradeLine, gzipSize, rawSize, weightGrade } from '@/co2.ts';

const props = defineProps<{
  svg?: string;
  gzip?: number | null | 'unknown'; // a known compressed size: no gzip here
  breakdown?: readonly string[]; // the tooltip's size lines (Patterns layout)
}>();

// Raw now, gzipped when CompressionStream answers. A stale answer is dropped.
const raw = computed(() => rawSize(props.svg ?? ''));
const measured = ref<number | null | 'unknown'>(null);
watch(
  () => props.svg,
  async (text) => {
    measured.value = null;
    if (text === undefined) return;
    try {
      const n = await gzipSize(text);
      if (text === props.svg) measured.value = n;
    } catch {
      if (text === props.svg) measured.value = 'unknown';
    }
  },
  { immediate: true },
);
const gz = computed(() => (props.gzip !== undefined ? props.gzip : measured.value));
const sizeText = computed(() => `${raw.value} bytes, ${typeof gz.value === 'number' ? `${gz.value} gzipped` : gz.value === null ? 'compressing' : 'gzip size unknown'}`);
const footprintFull = computed(() => (gz.value === null ? 'computing' : gz.value === 'unknown' ? 'size unknown' : formatFootprint(gz.value)));
// The badge keeps the CO₂ part only ("≈ 0.4 mg CO₂"); the title has the full line.
const footprintText = computed(() => footprintFull.value.split(' / ')[0]);
</script>

<template>
  <template v-if="breakdown">
    <span class="stat" :title="footprintFull"><span aria-hidden="true">{{ footprintText }}</span><span class="visually-hidden">{{ footprintFull }}</span></span>
    <span v-if="typeof gz === 'number'" class="stat size-badge" tabindex="0" aria-describedby="size-tip"><span aria-hidden="true"><span class="grade-chip" :class="gradeBand(weightGrade(gz).grade)">{{ weightGrade(gz).grade }}</span> · {{ formatKb(gz) }} <span class="size-unit">KB<span class="size-gz"> gz</span></span></span><span class="visually-hidden">Weight grade {{ weightGrade(gz).grade }}, {{ formatKb(gz) }} kilobytes compressed</span><span id="size-tip" class="size-tip" role="tooltip"><span class="size-line">{{ gradeLine(gz) }}</span><span class="size-line">{{ GRADE_SCALE }}</span><span v-for="line in breakdown" :key="line" class="size-line">{{ line }}</span></span></span>
  </template>
  <template v-else>
    <span v-if="typeof gz === 'number'" class="stat" :title="GRADE_SCALE"><span aria-hidden="true" class="grade-chip" :class="gradeBand(weightGrade(gz).grade)">{{ weightGrade(gz).grade }}</span><span class="visually-hidden">Weight grade {{ weightGrade(gz).grade }}, {{ formatKb(gz) }} kilobytes compressed</span></span>
    <span class="stat">{{ sizeText }}</span>
    <span class="stat" :title="footprintFull"><span aria-hidden="true">{{ footprintText }}</span><span class="visually-hidden">{{ footprintFull }}</span></span>
  </template>
</template>
