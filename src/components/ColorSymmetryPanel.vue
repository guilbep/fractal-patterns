<script setup lang="ts">
import { computed } from 'vue';
import { DETAIL_MAX, DETAIL_MIN, ORDERS, WAVES_MAX, WAVES_MIN, colorSym, type ColorRender } from '@/color-sym.ts';
import UiSegmented from '@/components/UiSegmented.vue';
import ColorSymHowItsMade from '@/components/ColorSymHowItsMade.vue';

const MODES = [
  { value: 'lines', label: 'Lines' },
  { value: 'color', label: 'Color symmetry' },
];
const RENDERS = [
  { value: 'bands', label: 'Bands · vector SVG' },
  { value: 'wheel', label: 'Smooth wheel · WebP image' },
];
// The page state comes in as props: importing state.ts here would make the bundler split the start chunks (about 1.2 KB more
// start JavaScript on every page, measured), because this panel is loaded on demand.
const props = defineProps<{ kind: string; swatches: readonly string[]; patchwork: boolean; growing: boolean }>();
const emit = defineEmits<{ recipe: [] }>();
const on = computed(() => colorSym.on && !props.patchwork);
const step = (d: number) => (colorSym.order = (colorSym.order + d + ORDERS) % ORDERS);
</script>

<template>
  <div class="fields pattern-card color-sym">
    <UiSegmented :model-value="colorSym.on ? 'color' : 'lines'" label="Draw the group with" name="cs-mode" :options="MODES" :disabled="patchwork" @update:model-value="colorSym.on = $event === 'color'" />
    <p v-if="patchwork" class="hint-text">Color symmetry draws one tile; turn off Patchwork to use it.</p>
    <template v-else-if="on">
      <p class="hint-text">Colors fill the plane with the group's symmetry. The stroke, fill and repetition settings do not apply.</p>
      <div class="field">
        <label for="cs-waves">Waves <output for="cs-waves">{{ colorSym.waves }}</output></label>
        <input id="cs-waves" v-model.number="colorSym.waves" type="range" :min="WAVES_MIN" :max="WAVES_MAX" step="1">
      </div>
      <div class="field">
        <label for="cs-detail">Detail <output for="cs-detail">{{ colorSym.detail }}</output></label>
        <input id="cs-detail" v-model.number="colorSym.detail" type="range" :min="DETAIL_MIN" :max="DETAIL_MAX" step="1">
      </div>
      <button type="button" class="btn secondary recipe-btn" @click="emit('recipe')">New recipe</button>
      <div class="field" role="group" aria-labelledby="cs-order-label">
        <span id="cs-order-label">Color order <output>{{ colorSym.order + 1 }} of {{ ORDERS }}</output></span>
        <div class="cs-order">
          <button type="button" class="btn secondary" aria-label="Previous color order" @click="step(-1)">‹</button>
          <span class="swatches cs-swatches" aria-hidden="true"><span v-for="(c, i) in swatches" :key="i" :style="{ background: c }"></span></span>
          <button type="button" class="btn secondary" aria-label="Next color order" @click="step(1)">›</button>
        </div>
      </div>
      <label class="radio"><input id="cs-balance" v-model="colorSym.balance" type="checkbox"> Balance color areas</label>
      <UiSegmented :model-value="colorSym.render" label="Render" name="cs-render" :options="RENDERS" @update:model-value="colorSym.render = $event as ColorRender" />
      <p v-if="colorSym.render === 'wheel'" class="hint-text">An image tile: heavier than bands, shown in the size badge.</p>
      <p v-if="colorSym.render === 'wheel'" role="status" aria-live="polite" class="hint-text">{{ growing ? 'Growing…' : '' }}</p>
      <ColorSymHowItsMade :group="kind" :waves="colorSym.waves" :detail="colorSym.detail" :balance="colorSym.balance" :render="colorSym.render" />
    </template>
  </div>
</template>

<style scoped>
.recipe-btn {
  align-self: end;
}
.cs-order {
  display: flex;
  align-items: center;
  gap: var(--s1);
}
.cs-order .btn {
  min-inline-size: 2.75rem;
  min-block-size: 2.75rem;
}
.cs-swatches {
  flex: 1;
}
</style>
