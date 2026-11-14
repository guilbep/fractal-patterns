<script setup lang="ts">
// Loaded on demand from ColorPanel. Page state comes only through props (importing state.ts here would split the start chunks).
import { computed } from 'vue';
import { GRAIN_AMOUNT, GRAIN_SIZE, GRAIN_TILE, type Grain } from '@/grain.ts';
import { ROUTES, TEXTURE_KINDS, TEXTURE_LABELS, toneApplies, type Texture, type TextureKind } from '@/texture.ts';
import UiSegmented from './UiSegmented.vue';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
const props = defineProps<{ texture: Mutable<Texture>; grain: Mutable<Grain>; grainSvg: string | null; status: '' | 'baking' }>();
const emit = defineEmits<{ kind: [kind: TextureKind | 'none'] }>();

const current = computed<TextureKind | 'none'>(() => (props.grain.on ? 'grain' : props.texture.on ? props.texture.kind : 'none'));
const routes = computed(() => ROUTES[props.texture.kind]);
const toneOptions = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];
const routeOptions = [
  { value: 'baked', label: 'Baked' },
  { value: 'live', label: 'Live' },
];
// The Size slider runs fine (left) to coarse (right): it shows the baseFrequency reversed.
const sizeFlip = GRAIN_SIZE[0] + GRAIN_SIZE[1];
const grainSizeText = computed(() => (props.grain.size >= 0.9 ? 'fine' : props.grain.size >= 0.6 ? 'medium' : 'coarse'));
const grainBytes = computed(() => (props.grainSvg ? new TextEncoder().encode(props.grainSvg).length : 0));
const num = (e: Event) => Number((e.target as HTMLInputElement).value);
</script>

<template>
  <fieldset class="plate-group texture-group">
    <legend>Texture</legend>
    <div class="radios texture-kinds">
      <label class="radio"><input type="radio" name="texture-kind" value="none" :checked="current === 'none'" @change="emit('kind', 'none')"> None</label>
      <label v-for="k in TEXTURE_KINDS" :key="k" class="radio">
        <input :id="k === 'grain' ? 'grain' : `texture-${k}`" type="radio" name="texture-kind" :value="k" :checked="current === k" :aria-describedby="k === 'grain' ? 'grain-hint' : undefined" @change="emit('kind', k)">
        {{ TEXTURE_LABELS[k] }}
      </label>
    </div>
    <p id="grain-hint" class="hint-text">Grain: a fine noise behind the pattern. Its own repeat hides the tile's.</p>

    <div v-if="grain.on" class="layer2-group grain-group" role="group" aria-labelledby="grain-h">
      <h3 id="grain-h">Grain</h3>
      <div class="fields">
        <div class="field">
          <label for="grain-amount">Amount <output for="grain-amount">{{ grain.amount }}%</output></label>
          <input id="grain-amount" v-model.number="grain.amount" type="range" :min="GRAIN_AMOUNT[0]" :max="GRAIN_AMOUNT[1]" step="1">
        </div>
        <div class="field">
          <label for="grain-size">Size <output for="grain-size">{{ grainSizeText }}</output></label>
          <input id="grain-size" :value="Math.round((sizeFlip - grain.size) * 100) / 100" type="range" :min="GRAIN_SIZE[0]" :max="GRAIN_SIZE[1]" step="0.05" :aria-valuetext="grainSizeText" @input="grain.size = Math.round((sizeFlip - num($event)) * 100) / 100">
        </div>
      </div>
      <UiSegmented :model-value="grain.tone" label="Tone" name="grain-tone" :options="toneOptions" @update:model-value="grain.tone = $event === 'light' ? 'light' : 'dark'" />
      <p class="hint-text">A {{ GRAIN_TILE }} px tile, about {{ grainBytes }} bytes. The contrast check counts its darkest or lightest specks.</p>
    </div>

    <div v-else-if="texture.on" class="layer2-group" role="group" aria-labelledby="texture-h">
      <h3 id="texture-h">{{ TEXTURE_LABELS[texture.kind] }}</h3>
      <div class="fields">
        <div class="field">
          <label for="texture-strength">Strength <output for="texture-strength">{{ texture.strength }}%</output></label>
          <input id="texture-strength" v-model.number="texture.strength" type="range" min="0" max="100" step="1">
        </div>
        <div class="field">
          <label for="texture-scale">Scale <output for="texture-scale">{{ texture.scale }}×</output></label>
          <input id="texture-scale" v-model.number="texture.scale" type="range" min="0.5" max="2" step="0.25">
        </div>
      </div>
      <p class="texture-seed">Seed {{ texture.seed }} <button type="button" class="btn" @click="texture.seed = Math.floor(Math.random() * 10000)">Another</button></p>
      <UiSegmented v-if="toneApplies(texture.kind)" :model-value="texture.tone" label="Tone" name="texture-tone" :options="toneOptions" @update:model-value="texture.tone = $event === 'light' ? 'light' : 'dark'" />
      <UiSegmented v-if="routes.includes('baked') && routes.includes('live')" :model-value="texture.route" label="Route" name="texture-route" :options="routeOptions" @update:model-value="texture.route = $event === 'live' ? 'live' : 'baked'" />
      <button v-if="texture.route === 'live' && routes.includes('baked')" type="button" class="btn" @click="texture.route = 'baked'">Bake it</button>
      <p class="hint-text" role="status">{{ status === 'baking' ? 'Baking…' : '' }}</p>
    </div>
  </fieldset>
</template>

<style scoped>
.texture-kinds {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--s2);
}
.texture-kinds .radio,
.texture-group .btn {
  min-height: 44px;
}
.texture-seed {
  display: flex;
  align-items: center;
  gap: var(--s1);
}
</style>
