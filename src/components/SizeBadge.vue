<script setup lang="ts">
// The size badge, one wording on every page: [grade] 2.8 kB · 0.6 mg CO₂ (compressed size). The details sit in a tooltip
// on hover and keyboard focus; Esc hides it (WCAG 1.4.13).
// - svg: Studio and Builder; the component gzips the SVG itself and knows the raw size.
// - gzip + breakdown: Patterns; the page knows the compressed size and passes the size lines.
import { computed, ref, useId, watch } from 'vue';
import { badgeText, formatFootprint, GRADE_SCALE, gradeBand, gradeLine, gzipSize, rawSize } from '@/co2.ts';

const props = defineProps<{
  svg?: string;
  gzip?: number | null | 'unknown'; // a known compressed size: no gzip here
  breakdown?: readonly string[]; // extra tooltip lines (Patterns)
}>();

// Raw now, gzipped when CompressionStream answers. A stale answer is dropped.
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
const text = computed(() => badgeText(gz.value));
const lines = computed(() => {
  const g = gz.value;
  const out = typeof g === 'number' ? [gradeLine(g), GRADE_SCALE] : [GRADE_SCALE];
  if (props.svg !== undefined) out.push(`${rawSize(props.svg)} bytes, ${typeof g === 'number' ? `${g} gzipped` : text.value.size}`);
  out.push(typeof g === 'number' ? formatFootprint(g) : g === null ? 'CO₂: computing' : 'CO₂: size unknown');
  return [...out, ...(props.breakdown ?? [])];
});
const label = computed(() =>
  text.value.grade ? `Weight grade ${text.value.grade}, ${text.value.size.slice(0, -3)} kilobytes compressed, ${text.value.co2}` : text.value.size,
);
const tipId = useId();
const tipOff = ref(false);
</script>

<template>
  <span class="stat size-badge" :class="{ 'tip-off': tipOff }" tabindex="0" :aria-describedby="tipId" @keydown.esc="tipOff = true" @focus="tipOff = false" @mouseenter="tipOff = false">
    <span aria-hidden="true" class="size-text">
      <!-- The chip keeps its place while compressing, so the text does not move when the grade arrives (CLS 0). -->
      <span class="grade-chip" :class="text.grade ? gradeBand(text.grade) : 'pending'">{{ text.grade }}</span>
      <span class="num">{{ text.size }}<template v-if="text.co2"> · {{ text.co2 }}</template></span>
    </span>
    <span class="visually-hidden">{{ label }}</span>
    <span :id="tipId" class="size-tip" role="tooltip"><span v-for="line in lines" :key="line" class="size-line">{{ line }}</span></span>
  </span>
</template>
