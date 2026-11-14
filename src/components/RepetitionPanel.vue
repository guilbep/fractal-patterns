<script setup lang="ts">
import { computed, watch } from 'vue';
import '@/css/repetition.css';
import { svgToDataUri } from '@/css.ts';
import { hasCompat } from '@/fractal.ts';
import { repeatDistance, scaledSecondSize } from '@/layers.ts';
import { previewOptions } from '@/repetition-previews.ts';
import { imageOptions, optionsFor } from '@/repetition.ts';
import { canVary, imageSuperTileSvg, shiftsFor, superTileSvg } from '@/supertile.ts';
import {
  accentOut,
  accentVaried,
  accentVary,
  baseCanVary,
  baseTileSize,
  curvesOn,
  change,
  changeTo,
  fade,
  imageCells,
  imageVariants,
  layer2,
  layer2Own,
  layer2Settings,
  parallax,
  params,
  resetLayer2,
  resetVariants,
  roles,
  sections,
  spacing,
  tileSize,
  usingImage,
  variantBytes,
  variantOptions,
  variants,
  variantsOn,
  varyApplies,
  type VaryApplies,
} from '@/state.ts';
import { parallaxDemoCss } from '@/state-export.ts';
import RoleInput from '@/components/RoleInput.vue';
import UiSection from '@/components/UiSection.vue';
import UiSegmented from '@/components/UiSegmented.vue';
import { STRENGTHS } from '@/variants.ts';
import type { VariantOptions } from '@/variants.ts';

// ponytail: the traced tile is always square (the vectorizer fits the image into a square cell).
const applies = computed(() => (usingImage.value ? imageOptions(true) : optionsFor(params.kind)));
const percent = (e: Event) => Number((e.target as HTMLInputElement).value) / 100;
const possible = computed(() => (usingImage.value ? !curvesOn.value : canVary(params.kind)));

// Previews: drawn in black at a small cell size and colored by CSS masks, so colors never rebuild them.
// The stroke is about 1.6 px in the 120 px picture, whatever the cell count, so the picture reads.
const CELL = 20;
const PIC_PX = 120;
const cache = new Map<string, string>(); // ponytail: unbounded, holds one entry per picture seen this session
function picture(o: VariantOptions): string {
  const opts = { ...params, ...o, size: CELL, strokeWidth: (1.6 * o.cells * CELL) / PIC_PX, color: '#000000', opacity: 1 };
  const cells = imageCells.value;
  // ponytail: the key holds no image id; the cache is cleared when the traced picture changes (below).
  const key = JSON.stringify(opts) + (cells ? 'image' : '');
  let url = cache.get(key);
  if (url === undefined) {
    url = `url("${svgToDataUri(cells ? imageSuperTileSvg(opts, cells) : superTileSvg(opts))}")`;
    cache.set(key, url);
  }
  return url;
}
watch(imageCells, () => cache.clear());
const cards = computed(() => (variantsOn.value ? previewOptions({ ...variantOptions }, usingImage.value ? null : params.kind) : []));
const pics = computed(() => new Map(cards.value.map((c) => [c.id, picture(c.options)])));
const example = (id: string) => cards.value.find((c) => c.id === id)?.example;
const group = (g: string) => cards.value.filter((c) => c.group === g);
// A grid size that does not allow the current shift falls back to one half.
watch(
  () => variantOptions.cells,
  (n) => {
    if (!shiftsFor(n).includes(variantOptions.shift)) variantOptions.shift = 2;
  },
);
const panelVars = computed(() => ({ '--rp-fg': roles.pattern, '--rp-bg': roles.background }));

// The second layer copies the base layer alone.
const size2 = computed(() => scaledSecondSize(baseTileSize.value, layer2Settings.scale));
const repeat = computed(() => repeatDistance(baseTileSize.value, size2.value));
// The accent layer shows, so Reduce repetition can reach it even where the base cannot vary.
const accentCan = computed(() => accentOut.value !== null);
const appliesOptions = computed(() => [
  { value: 'base', label: 'Base', disabled: !baseCanVary.value },
  { value: 'accent', label: 'Accent', disabled: !accentCan.value },
  { value: 'both', label: 'Both', disabled: !baseCanVary.value },
]);
const variantsSummary = computed(() => {
  if (!possible.value && !accentCan.value) return 'not available';
  if (!variants.value) return 'off';
  const { cells, count } = variantOptions;
  const strength = variantsOn.value && STRENGTHS.find((s) => s.cells === cells && s.count === count)?.label.split(':')[0];
  const n = variantsOn.value ? cells : accentVary.cells;
  return [accentCan.value ? varyApplies.value : 'on', strength, `${n} by ${n}`].filter(Boolean).join(' · ');
});
const scaleRange = computed(() => {
  const s = Math.round(accentVary.scale * 0.4);
  return s === 0 ? 'off' : `${100 - s} to ${100 + s} %`;
});
const moreSummary = computed(
  () =>
    [layer2.value && 'second layer', fade.value && 'soft fade', change.value !== 'none' && 'slow change', sections.value && 'per-section angle']
      .filter(Boolean)
      .join(' · ') || 'none',
);
const scrollTimelines = typeof CSS !== 'undefined' && CSS.supports('animation-timeline: scroll()');
</script>

<template>
  <UiSection title="Reduce repetition" heading-id="repetition-h" :summary="variantsSummary" open>
    <p v-if="usingImage && curvesOn" id="variants-hint" class="hint-text">Turn off Smooth curves to reduce repetition on an image.</p>
    <p v-else-if="!usingImage && !canVary(params.kind) && !accentCan" id="variants-hint" class="hint-text">This pattern repeats by design, so variants are not available. Second layer and Soft fade below still work.</p>
    <template v-else>
      <label class="rep-switch"><input id="variants" v-model="variants" type="checkbox" role="switch" aria-describedby="variants-hint"> Reduce repetition</label>
      <p id="variants-hint" class="hint-text rep-state">
        <template v-if="!variantsOn && !accentVaried && usingImage">Draws the picture into a grid of cells, each turned, shifted or weighted, so the same tile comes back less often. The edges of a photo do not match, so seams can show.</template>
        <template v-else-if="!variantsOn && !accentVaried">Draws several seeded variants into one larger tile, so the same picture comes back less often.</template>
        <template v-else-if="variantsOn">
          <span id="v-period">The same picture comes back every {{ tileSize.toLocaleString('en') }} px.</span>
          <template v-if="usingImage && imageVariants">{{ ' ' }}{{ imageVariants.length }} {{ imageVariants.length === 1 ? 'picture' : 'pictures' }}.</template>
          <template v-if="!usingImage && hasCompat(params.kind)"> This pattern uses its fixed layout in this mode.</template>
          <template v-if="variantBytes">{{ ' ' }}{{ variantBytes.svg.toLocaleString('en') }} bytes against {{ variantBytes.plain.toLocaleString('en') }} for one tile.</template>
        </template>
      </p>
      <template v-if="!usingImage">
        <UiSegmented :model-value="varyApplies" class="v-applies" label="Applies to" name="v-applies" :options="appliesOptions" @update:model-value="varyApplies = $event as VaryApplies" />
        <p v-if="!baseCanVary" id="v-applies-base" class="hint-text">This pattern must meet at every tile edge, so only the accent shapes can vary.</p>
        <p v-if="!accentCan" id="v-applies-accent" class="hint-text">Turn on Accent shapes in the Pattern tab first.</p>
      </template>
      <p v-if="usingImage && !spacing.mirror" id="v-seamless" class="hint-text">
        The edges of a traced picture do not meet. <button type="button" class="btn" @click="spacing.mirror = true">Turn on Seamless edges</button>
      </p>
    </template>
    <div v-if="possible && variantsOn" class="variants-group" role="group" aria-label="Variants" :style="panelVars">
      <fieldset id="v-strength">
        <legend>Strength</legend>
        <div class="rep-cards">
          <label v-for="c in group('strength')" :key="c.id" class="rep-card">
            <span class="rep-pic" aria-hidden="true"><span :style="{ '--pic': pics.get(c.id) }"></span></span>
            <span><input type="radio" name="v-strength" :checked="c.options.cells === variantOptions.cells && c.options.count === variantOptions.count" @change="Object.assign(variantOptions, { cells: c.options.cells, count: c.options.count })"> {{ c.label }}</span>
          </label>
        </div>
      </fieldset>
      <div v-if="applies.orient || applies.depths" class="rep-cards">
        <label v-for="c in [...group('orient'), ...group('depths')]" :key="c.id" class="rep-card">
          <span class="rep-pic" aria-hidden="true"><span :style="{ '--pic': pics.get(c.id) }"></span></span>
          <span v-if="c.group === 'orient'"><input id="v-orient" v-model="variantOptions.orient" type="checkbox" aria-describedby="v-orient-hint"> {{ c.label }}</span>
          <span v-else><input id="v-depths" v-model="variantOptions.depths" type="checkbox" aria-describedby="v-depths-hint"> {{ c.label }}</span>
          <span v-if="c.group === 'orient'" id="v-orient-hint" class="hint-text">Each cell is turned or mirrored. The strongest effect, at no extra path.</span>
          <span v-else id="v-depths-hint" class="hint-text">Half of the variants are drawn one depth lower.</span>
        </label>
      </div>
      <fieldset v-if="applies.drop" id="v-drop" aria-describedby="v-drop-hint">
        <legend>Offset</legend>
        <p id="v-drop-hint" class="hint-text">Shifts every second column or row by half a cell, which hides the square grid.</p>
        <div class="rep-cards">
          <label v-for="c in group('drop')" :key="c.id" class="rep-card">
            <span class="rep-pic" aria-hidden="true"><span :style="{ '--pic': pics.get(c.id) }"></span></span>
            <span><input v-model="variantOptions.drop" type="radio" name="v-drop" :value="c.options.drop"> {{ c.label }}</span>
          </label>
        </div>
      </fieldset>
      <fieldset v-if="group('shift').length" id="v-shift" aria-describedby="v-shift-hint">
        <legend>Shift by</legend>
        <p id="v-shift-hint" class="hint-text">A third or a quarter of a cell hides the grid faster: the columns line up again only after 3 or 4.</p>
        <div class="rep-cards">
          <label v-for="c in group('shift')" :key="c.id" class="rep-card">
            <span class="rep-pic" aria-hidden="true"><span :style="{ '--pic': pics.get(c.id) }"></span></span>
            <span><input v-model="variantOptions.shift" type="radio" name="v-shift" :value="c.options.shift"> {{ c.label }}</span>
          </label>
        </div>
      </fieldset>
      <div v-if="applies.jitter" class="rep-slider">
        <span class="rep-slider-pic"><span class="rep-pic" aria-hidden="true"><span :style="{ '--pic': pics.get('jitter') }"></span></span><span v-if="example('jitter')" class="hint-text">example</span></span>
        <div class="field">
          <label for="v-jitter">Shift and scale <output for="v-jitter">{{ Math.round(variantOptions.jitter * 100) }}%</output></label>
          <input id="v-jitter" :value="Math.round(variantOptions.jitter * 100)" type="range" min="0" max="100" step="1" aria-describedby="v-jitter-hint" @input="variantOptions.jitter = percent($event)">
          <p id="v-jitter-hint" class="hint-text">A small shift and size change per cell.</p>
        </div>
      </div>
      <div v-if="applies.weights" class="rep-slider">
        <span class="rep-slider-pic"><span class="rep-pic" aria-hidden="true"><span :style="{ '--pic': pics.get('weights') }"></span></span><span v-if="example('weights')" class="hint-text">example</span></span>
        <div class="field">
          <label for="v-weights">Line weight <output for="v-weights">{{ Math.round(variantOptions.weights * 100) }}%</output></label>
          <input id="v-weights" :value="Math.round(variantOptions.weights * 100)" type="range" min="0" max="100" step="1" aria-describedby="v-weights-hint" @input="variantOptions.weights = percent($event)">
          <p id="v-weights-hint" class="hint-text">Varies the stroke weight softly across the tile. It can show faint bands.</p>
        </div>
      </div>
      <div v-if="applies.skip" class="rep-slider">
        <span class="rep-slider-pic"><span class="rep-pic" aria-hidden="true"><span :style="{ '--pic': pics.get('skip') }"></span></span><span v-if="example('skip')" class="hint-text">example</span></span>
        <div class="field">
          <label for="v-skip">Empty cells <output for="v-skip">{{ Math.round(variantOptions.skip * 100) }}%</output></label>
          <input id="v-skip" :value="Math.round(variantOptions.skip * 100)" type="range" min="0" max="50" step="1" aria-describedby="v-skip-hint" @input="variantOptions.skip = percent($event)">
          <p id="v-skip-hint" class="hint-text">Leaves some cells empty. The holes repeat with the tile, so use it lightly.</p>
        </div>
      </div>
      <div class="out-actions">
        <button type="button" class="btn" @click="resetVariants">Reset variants</button>
      </div>
    </div>
    <div v-if="accentVaried && accentOut" class="variants-group accent-vary" role="group" aria-labelledby="av-h">
      <h3 id="av-h">What changes from tile to tile</h3>
      <div class="fields">
        <div class="field">
          <label for="av-move">Move <output for="av-move">{{ accentVary.move ? `up to ${accentVary.move} % of its width` : 'off' }}</output></label>
          <input id="av-move" v-model.number="accentVary.move" type="range" min="0" max="100" step="1">
        </div>
        <div class="field">
          <label for="av-scale">Size <output for="av-scale">{{ scaleRange }}</output></label>
          <input id="av-scale" v-model.number="accentVary.scale" type="range" min="0" max="100" step="1">
        </div>
        <div class="field">
          <label for="av-drop">Drop out <output for="av-drop">{{ accentVary.drop }} %</output></label>
          <input id="av-drop" v-model.number="accentVary.drop" type="range" min="0" max="60" step="1">
        </div>
        <div class="field">
          <label for="av-turn">Turn <output for="av-turn">{{ accentVary.turn ? `up to ±${Math.round(accentVary.turn * 1.8)}°` : 'off' }}</output></label>
          <input id="av-turn" v-model.number="accentVary.turn" type="range" min="0" max="100" step="1">
        </div>
      </div>
      <p id="av-period" class="hint-text">
        The base tile stays {{ baseTileSize.toLocaleString('en') }} px. The accent shapes repeat only every {{ accentVary.cells }} by {{ accentVary.cells }} tiles,
        {{ accentOut.width.toLocaleString('en') }} px.
      </p>
      <div class="field">
        <label for="av-cells">Super tile</label>
        <select id="av-cells" v-model.number="accentVary.cells">
          <option v-for="n in [2, 3, 4, 5, 6, 7, 8]" :key="n" :value="n">{{ n }} by {{ n }} tiles</option>
        </select>
      </div>
    </div>
  </UiSection>

  <UiSection title="More ways to hide the repeat" heading-id="rep-more-h" :summary="moreSummary">
    <label class="radio"><input id="layer2" v-model="layer2" type="checkbox" aria-describedby="layer2-hint"> Second layer</label>
    <p id="layer2-hint" class="hint-text">
      <template v-if="layer2">A second copy at {{ size2.toLocaleString('en') }} px. Together they repeat every {{ repeat.toLocaleString('en') }} px.</template>
      <template v-else>Adds a second copy with a different size, so the picture repeats far less often.</template>
    </p>
    <div v-if="layer2" class="layer2-group" role="group" aria-labelledby="layer2-h">
      <h3 id="layer2-h">Second layer</h3>
      <label class="radio"><input id="layer2-own" v-model="layer2Own" type="checkbox"> Own color for the second layer</label>
      <RoleInput v-if="layer2Own" role="layer2" label="Second layer" hint="the second layer strokes" />
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
          <p id="l2-depth-hint" class="hint-text">Only visible when the pattern drifts (Layout tab). Below 1 the layer moves slower and looks farther away.</p>
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

    <div class="field">
      <label for="change">Slow change across the page</label>
      <select id="change" v-model="change">
        <option value="none">None</option>
        <option value="down">Top to bottom</option>
        <option value="up">Bottom to top</option>
        <option value="across">Left to right</option>
      </select>
    </div>
    <div v-if="change !== 'none'" class="field">
      <label for="change-to">Faint end <output for="change-to">{{ Math.round(changeTo * 100) }}%</output></label>
      <input id="change-to" v-model.number="changeTo" type="range" min="0.2" max="0.8" step="0.05" aria-describedby="change-hint">
      <p id="change-hint" class="hint-text">The pattern keeps full strength at one end and fades to this strength at the other end. CSS only, no extra image. The preview shows it over the height of the preview.</p>
    </div>

    <label class="radio"><input id="sections" v-model="sections" type="checkbox" aria-describedby="sections-hint"> Different angle per section</label>
    <p id="sections-hint" class="hint-text">Adds three helper classes to the CSS, fp-a, fp-b, and fp-c, that turn the pattern by a different angle. Put them on successive sections of a page. The preview does not change.</p>
  </UiSection>
</template>
