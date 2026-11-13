<script setup lang="ts">
import { LAYOUT_EXAMPLES } from '@/random-design.ts';
import { applyLayoutExample, randomLayoutApply } from '@/state.ts';
</script>

<template>
  <section class="panel" aria-labelledby="presets-h">
    <h2 id="presets-h">Examples</h2>
    <div class="presets">
      <button type="button" class="btn" aria-describedby="presets-hint" @click="randomLayoutApply">Random layout</button>
      <button v-for="(e, i) in LAYOUT_EXAMPLES" :key="e.label" type="button" class="btn" @click="applyLayoutExample(i)">{{ e.label }}</button>
    </div>
    <p id="presets-hint" class="hint-text">Random layout changes the angle, size, skew, and tilt. It never turns drift on: motion costs energy on the visitor's device, so it stays your choice.</p>
  </section>
</template>

<style scoped>
.presets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s1);
}
</style>
