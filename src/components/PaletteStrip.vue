<script setup lang="ts">
import { ref } from 'vue';
import '@/css/palette-strip.css';
import ToolIcon from './ToolIcon.vue';

// The palette strip of both pages: it shows the colors and the name, the page does the stepping.
defineProps<{ colors: readonly string[]; name: string }>();
const emit = defineEmits<{ previous: []; next: []; random: [] }>();

// Feedback: a new key restarts the CSS animation of the swatches and of the dice.
const rolls = ref(0);
function roll(): void {
  rolls.value++;
  emit('random');
}
</script>

<template>
  <span class="palette-strip">
    <button type="button" class="icon-btn" aria-label="Previous palette" title="Previous palette" @click="emit('previous')"><span aria-hidden="true">‹</span></button>
    <span :key="colors.join()" class="swatches" aria-hidden="true" :title="name"><span v-for="(c, i) in colors" :key="i" class="swatch" :style="{ background: c }"></span></span>
    <span class="palette-name"><span class="visually-hidden">Palette: </span>{{ name }}</span>
    <button type="button" class="icon-btn" aria-label="Next palette" title="Next palette" @click="emit('next')"><span aria-hidden="true">›</span></button>
    <button type="button" class="icon-btn" aria-label="Random palette" title="Random palette" @click="roll"><span :key="rolls" class="dice" aria-hidden="true"><ToolIcon name="dice" /></span></button>
  </span>
</template>
