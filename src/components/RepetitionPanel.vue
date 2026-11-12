<script setup lang="ts">
import { computed } from 'vue';
import { hasCompat } from '@/fractal.ts';
import { repeatDistance, secondSize } from '@/layers.ts';
import { canVary } from '@/supertile.ts';
import { fade, layer2, params, tileSize, usingImage, variantBytes, variants } from '@/state.ts';

const size2 = computed(() => secondSize(tileSize.value));
const repeat = computed(() => repeatDistance(tileSize.value, size2.value));
</script>

<template>
  <section class="panel" aria-labelledby="repetition-h">
    <h2 id="repetition-h">Repetition</h2>
    <label class="radio"><input id="variants" v-model="variants" type="checkbox" :disabled="usingImage || !canVary(params.kind)" aria-describedby="variants-hint"> Reduce repetition</label>
    <p id="variants-hint" class="hint-text">
      <template v-if="usingImage">Variants need a math pattern.</template>
      <template v-else-if="!canVary(params.kind)">Not available for this pattern yet.</template>
      <template v-else>Shows 4 variants in a 4 by 4 tile. The same picture comes back 4 times less often.</template>
      <template v-if="!usingImage && variants && canVary(params.kind) && hasCompat(params.kind)"> This pattern uses its fixed layout in this mode.</template>
      <template v-if="variantBytes">{{ ' ' }}{{ variantBytes.svg.toLocaleString('en') }} bytes against {{ variantBytes.plain.toLocaleString('en') }} for one tile.</template>
    </p>

    <label class="radio"><input id="layer2" v-model="layer2" type="checkbox" aria-describedby="layer2-hint"> Second layer</label>
    <p id="layer2-hint" class="hint-text">
      <template v-if="layer2">A second copy at {{ size2.toLocaleString('en') }} px. Together they repeat every {{ repeat.toLocaleString('en') }} px.</template>
      <template v-else>Adds a second copy with a different size, so the picture repeats far less often.</template>
    </p>

    <label class="radio"><input id="fade" v-model="fade" type="checkbox" aria-describedby="fade-hint"> Soft fade</label>
    <p id="fade-hint" class="hint-text">A soft light and dark variation over the pattern. CSS only, no extra image.</p>
  </section>
</template>
