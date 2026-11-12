<script setup lang="ts">
import { computed } from 'vue';
import { hasCompat } from '@/fractal.ts';
import { repeatDistance, scaledSecondSize } from '@/layers.ts';
import { optionsFor } from '@/repetition.ts';
import { canVary } from '@/supertile.ts';
import {
  fade,
  layer2,
  layer2Settings,
  parallax,
  params,
  resetLayer2,
  resetVariants,
  tileSize,
  usingImage,
  variantBytes,
  variantOptions,
  variants,
  variantsOn,
} from '@/state.ts';
import { parallaxDemoCss } from '@/state-export.ts';
import { STRENGTHS } from '@/variants.ts';

const applies = computed(() => optionsFor(params.kind));
const percent = (e: Event) => Number((e.target as HTMLInputElement).value) / 100;
function setStrength(v: string): void {
  const s = STRENGTHS.find((x) => `${x.cells}_${x.count}` === v);
  if (s) Object.assign(variantOptions, { cells: s.cells, count: s.count });
}

const size2 = computed(() => scaledSecondSize(tileSize.value, layer2Settings.scale));
const repeat = computed(() => repeatDistance(tileSize.value, size2.value));
const scrollTimelines = typeof CSS !== 'undefined' && CSS.supports('animation-timeline: scroll()');
</script>

<template>
  <section class="panel" aria-labelledby="repetition-h">
    <h2 id="repetition-h">Repetition</h2>
    <label class="radio"><input id="variants" v-model="variants" type="checkbox" :disabled="usingImage || !canVary(params.kind)" aria-describedby="variants-hint"> Reduce repetition</label>
    <p id="variants-hint" class="hint-text">
      <template v-if="usingImage">Variants need a math pattern.</template>
      <template v-else-if="!canVary(params.kind)">Not available for this pattern yet.</template>
      <template v-else>Shows several seeded variants in one larger tile, so the same picture comes back less often.</template>
      <template v-if="!usingImage && variants && canVary(params.kind) && hasCompat(params.kind)"> This pattern uses its fixed layout in this mode.</template>
      <template v-if="variantBytes">{{ ' ' }}{{ variantBytes.svg.toLocaleString('en') }} bytes against {{ variantBytes.plain.toLocaleString('en') }} for one tile.</template>
    </p>
    <p v-if="variantsOn" id="v-period" class="hint-text">The same picture comes back every {{ tileSize.toLocaleString('en') }} px.</p>
    <div v-if="variantsOn" class="variants-group" role="group" aria-labelledby="variants-h">
      <h3 id="variants-h">Variants</h3>
      <div class="fields">
        <div class="field">
          <label for="v-strength">Strength</label>
          <select id="v-strength" :value="`${variantOptions.cells}_${variantOptions.count}`" @change="setStrength(($event.target as HTMLSelectElement).value)">
            <option v-for="s in STRENGTHS" :key="s.label" :value="`${s.cells}_${s.count}`">{{ s.label }}</option>
          </select>
        </div>
        <div v-if="applies.orient" class="field">
          <label class="radio"><input id="v-orient" v-model="variantOptions.orient" type="checkbox" aria-describedby="v-orient-hint"> Turn and flip each cell</label>
          <p id="v-orient-hint" class="hint-text">Each cell is turned or mirrored. The strongest effect, at no extra path.</p>
        </div>
        <div v-if="applies.drop" class="field">
          <label for="v-drop">Offset</label>
          <select id="v-drop" v-model="variantOptions.drop" aria-describedby="v-drop-hint">
            <option value="none">None</option>
            <option value="half-drop">Half-drop</option>
            <option value="brick">Brick</option>
          </select>
          <p id="v-drop-hint" class="hint-text">Shifts every second column or row by half a cell, which hides the square grid.</p>
        </div>
        <div v-if="applies.depths" class="field">
          <label class="radio"><input id="v-depths" v-model="variantOptions.depths" type="checkbox" aria-describedby="v-depths-hint"> Mix two depths</label>
          <p id="v-depths-hint" class="hint-text">Half of the variants are drawn one depth lower.</p>
        </div>
        <div v-if="applies.jitter" class="field">
          <label for="v-jitter">Shift and scale <output for="v-jitter">{{ Math.round(variantOptions.jitter * 100) }}%</output></label>
          <input id="v-jitter" :value="Math.round(variantOptions.jitter * 100)" type="range" min="0" max="100" step="1" aria-describedby="v-jitter-hint" @input="variantOptions.jitter = percent($event)">
          <p id="v-jitter-hint" class="hint-text">A small shift and size change per cell.</p>
        </div>
        <div v-if="applies.weights" class="field">
          <label for="v-weights">Line weight <output for="v-weights">{{ Math.round(variantOptions.weights * 100) }}%</output></label>
          <input id="v-weights" :value="Math.round(variantOptions.weights * 100)" type="range" min="0" max="100" step="1" aria-describedby="v-weights-hint" @input="variantOptions.weights = percent($event)">
          <p id="v-weights-hint" class="hint-text">Varies the stroke weight softly across the tile. It can show faint bands.</p>
        </div>
        <div v-if="applies.skip" class="field">
          <label for="v-skip">Empty cells <output for="v-skip">{{ Math.round(variantOptions.skip * 100) }}%</output></label>
          <input id="v-skip" :value="Math.round(variantOptions.skip * 100)" type="range" min="0" max="50" step="1" aria-describedby="v-skip-hint" @input="variantOptions.skip = percent($event)">
          <p id="v-skip-hint" class="hint-text">Leaves some cells empty. The holes repeat with the tile, so use it lightly.</p>
        </div>
      </div>
      <div class="out-actions">
        <button type="button" class="btn" @click="resetVariants">Reset variants</button>
      </div>
    </div>

    <label class="radio"><input id="layer2" v-model="layer2" type="checkbox" aria-describedby="layer2-hint"> Second layer</label>
    <p id="layer2-hint" class="hint-text">
      <template v-if="layer2">A second copy at {{ size2.toLocaleString('en') }} px. Together they repeat every {{ repeat.toLocaleString('en') }} px.</template>
      <template v-else>Adds a second copy with a different size, so the picture repeats far less often.</template>
    </p>
    <div v-if="layer2" class="layer2-group" role="group" aria-labelledby="layer2-h">
      <h3 id="layer2-h">Second layer</h3>
      <div class="fields">
        <div class="field">
          <label for="l2-x">Shift right <output for="l2-x">{{ layer2Settings.x }}%</output></label>
          <input id="l2-x" v-model.number="layer2Settings.x" type="range" min="0" max="100" step="1">
        </div>
        <div class="field">
          <label for="l2-y">Shift down <output for="l2-y">{{ layer2Settings.y }}%</output></label>
          <input id="l2-y" v-model.number="layer2Settings.y" type="range" min="0" max="100" step="1">
        </div>
        <div class="field">
          <label for="l2-rotate">Turn <output for="l2-rotate">{{ layer2Settings.rotate }}°</output></label>
          <input id="l2-rotate" v-model.number="layer2Settings.rotate" type="range" min="-180" max="180" step="1">
        </div>
        <div class="field">
          <label for="l2-scale">Size <output for="l2-scale">{{ layer2Settings.scale.toFixed(2) }}×</output></label>
          <input id="l2-scale" v-model.number="layer2Settings.scale" type="range" min="0.5" max="3" step="0.05">
        </div>
        <div class="field">
          <label for="l2-opacity">Strength <output for="l2-opacity">{{ Math.round(layer2Settings.opacity * 100) }}%</output></label>
          <input id="l2-opacity" :value="Math.round(layer2Settings.opacity * 100)" type="range" min="10" max="100" step="1" @input="layer2Settings.opacity = Number(($event.target as HTMLInputElement).value) / 100">
        </div>
        <div class="field">
          <label for="l2-depth">Depth <output for="l2-depth">{{ layer2Settings.depth.toFixed(2) }}×</output></label>
          <input id="l2-depth" v-model.number="layer2Settings.depth" type="range" min="0.25" max="4" step="0.05" aria-describedby="l2-depth-hint">
          <p id="l2-depth-hint" class="hint-text">Only visible when the pattern drifts (Motion tab). Below 1 the layer moves slower and looks farther away.</p>
        </div>
      </div>
      <label class="radio"><input id="parallax" v-model="parallax" type="checkbox" aria-describedby="parallax-hint"> Parallax on scroll</label>
      <p id="parallax-hint" class="hint-text">The two layers move at different speeds when the page scrolls. Uses the Depth value. At Depth 0.5 the two layers move together. Off for visitors who ask for reduced motion.</p>
      <template v-if="parallax">
        <component :is="'style'">{{ parallaxDemoCss }}</component>
        <div id="parallax-demo" class="parallax-demo">
          <div v-if="scrollTimelines" class="fp-pattern fp-parallax-demo"></div>
          <p v-else class="hint-text">This browser does not support parallax on scroll. The export still works where it is supported.</p>
        </div>
      </template>
      <div class="out-actions">
        <button type="button" class="btn" @click="resetLayer2">Reset second layer</button>
      </div>
    </div>

    <label class="radio"><input id="fade" v-model="fade" type="checkbox" aria-describedby="fade-hint"> Soft fade</label>
    <p id="fade-hint" class="hint-text">A soft light and dark variation over the pattern. CSS only, no extra image.</p>
  </section>
</template>
