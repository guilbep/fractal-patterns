<script setup lang="ts">
// The tile and fill panel: tile size, repeat, background, line width, and a seeded "Fill the tile".
import { computed, nextTick, reactive, ref, shallowRef, watch } from 'vue';
import PaletteStrip from '@/components/PaletteStrip.vue';
import { PALETTES, rollPalette } from '@/palettes.ts';
import type { Palette } from '@/palettes.ts';
import { stepPalette } from '@/shell.ts';
import { mulberry32 } from '@/patterns/util.ts';
import type { BuilderRepeat, Design } from './types.ts';
import { commit, design, preview } from './store.ts';
import { fillDesign, resizeDesign, usedStamps } from './tile-fill.ts';
import type { FillChoice } from './tile-fill.ts';

const REPEATS: readonly (readonly [BuilderRepeat, string, string])[] = [
  ['straight', 'Straight', 'The tile repeats side by side in a plain grid.'],
  ['half-drop', 'Half-drop', 'Each column drops by half a tile.'],
  ['brick', 'Brick', 'Each row shifts by half a tile, like brickwork.'],
];
const PRESETS = [120, 240, 480] as const;
const repeatHint = computed(() => REPEATS.find(([r]) => r === design.value.repeat)?.[2] ?? '');

// Our own previews and commits: any other new design (a change by hand on the stage) ends the live fill.
let own: Design | null = null;
const live = ref(false);
watch(design, (d) => {
  if (d !== own) live.value = false;
});
function set(next: Design, save: boolean): void {
  if (next === design.value) return;
  own = next;
  if (save) commit(next);
  else preview(next);
}
const val = (e: Event): string => (e.target as HTMLInputElement).value;

// Tile.
let lastBg = design.value.background ?? '#ffffff';
function setBackground(v: string, save: boolean): void {
  lastBg = v;
  set({ ...design.value, background: v }, save);
}
function resize(w: number, h: number): void {
  set(resizeDesign(design.value, w, h), true);
}

// Fill the tile.
const opts = reactive({
  columns: 4,
  rows: 4,
  stampIndices: usedStamps(design.value),
  seed: 1,
  size: 0.55,
  sizeJitter: 0.3,
  jitter: 0.5,
  rotate: 'free' as FillChoice['rotate'],
  stagger: false,
  flip: false,
  colorMode: 'own' as 'own' | 'palette',
});
const paletteIndex = ref(0);
const palette = shallowRef<Palette>(PALETTES[0]!);
let rnd = mulberry32(opts.seed);
watch(
  () => opts.seed,
  (s) => {
    rnd = mulberry32(s);
  },
);
function stepPal(dir: 1 | -1): void {
  paletteIndex.value = stepPalette(paletteIndex.value, dir, PALETTES.length);
  palette.value = PALETTES[paletteIndex.value]!;
  settle();
}
function rollPal(): void {
  paletteIndex.value = -1;
  palette.value = rollPalette(rnd);
  settle();
}

const choice = computed<FillChoice>(() => ({
  columns: opts.columns,
  rows: opts.rows,
  stampIndices: [...opts.stampIndices],
  seed: opts.seed,
  size: opts.size,
  sizeJitter: opts.sizeJitter,
  jitter: opts.jitter,
  rotate: opts.rotate,
  stagger: opts.stagger,
  flip: opts.flip,
  palette: opts.colorMode === 'palette' ? palette.value.colors : null,
}));
function refill(save: boolean): void {
  if (live.value) set(fillDesign(design.value, choice.value), save);
}
// Live mode: a moving control previews at once, its change event commits.
watch(choice, () => refill(false));
async function settle(): Promise<void> {
  await nextTick();
  refill(true);
}
function fillNow(): void {
  live.value = true;
  set(fillDesign(design.value, choice.value), true);
}
function another(): void {
  opts.seed++;
  settle();
}
</script>

<template>
  <section class="panel" aria-labelledby="tile-h">
    <h2 id="tile-h">Tile</h2>
    <div class="fields">
      <div class="field">
        <label for="tile-w">Width</label>
        <input id="tile-w" type="number" min="16" max="2000" step="1" :value="design.width" @change="resize(Number(val($event)), design.height); ($event.target as HTMLInputElement).value = String(design.width)">
      </div>
      <div class="field">
        <label for="tile-h-in">Height</label>
        <input id="tile-h-in" type="number" min="16" max="2000" step="1" :value="design.height" @change="resize(design.width, Number(val($event))); ($event.target as HTMLInputElement).value = String(design.height)">
      </div>
    </div>
    <div class="presets" role="group" aria-label="Square tile size">
      <button v-for="p in PRESETS" :key="p" type="button" class="btn" :aria-pressed="design.width === p && design.height === p" @click="resize(p, p)">{{ p }}</button>
    </div>
    <div class="fields">
      <div class="field">
        <label for="tile-repeat">Repeat</label>
        <select id="tile-repeat" :value="design.repeat" aria-describedby="tile-repeat-hint" @change="set({ ...design, repeat: val($event) as BuilderRepeat }, true)">
          <option v-for="[r, label] in REPEATS" :key="r" :value="r">{{ label }}</option>
        </select>
        <p id="tile-repeat-hint" class="hint-text">{{ repeatHint }}</p>
      </div>
      <div class="field">
        <label for="tile-bg">Background</label>
        <div class="bg-row">
          <input id="tile-bg" type="color" :value="design.background ?? lastBg" :disabled="design.background === null" @input="setBackground(val($event), false)" @change="setBackground(val($event), true)">
          <label class="radio"><input type="checkbox" :checked="design.background === null" @change="set({ ...design, background: ($event.target as HTMLInputElement).checked ? null : lastBg }, true)"> No background</label>
        </div>
      </div>
      <div class="field">
        <label for="tile-line">Line width <output for="tile-line">{{ design.strokeWidth }}</output></label>
        <input id="tile-line" type="range" min="0.5" max="12" step="0.5" :value="design.strokeWidth" @input="set({ ...design, strokeWidth: Number(val($event)) }, false)" @change="set({ ...design, strokeWidth: Number(val($event)) }, true)">
      </div>
    </div>

    <details class="group">
    <summary>Fill the tile with a grid</summary>
    <!-- Every change event inside commits the live fill; the watch on the choice has already previewed it. -->
    <div class="fill" @change="settle">
      <div class="fields">
        <div class="field">
          <label for="fill-cols">Columns <output for="fill-cols">{{ opts.columns }}</output></label>
          <input id="fill-cols" v-model.number="opts.columns" type="range" min="1" max="12" step="1">
        </div>
        <div class="field">
          <label for="fill-rows">Rows <output for="fill-rows">{{ opts.rows }}</output></label>
          <input id="fill-rows" v-model.number="opts.rows" type="range" min="1" max="12" step="1">
        </div>
      </div>
      <fieldset>
        <legend>Shapes to use</legend>
        <div class="check-grid">
          <label v-for="(s, i) in design.stamps" :key="i" class="radio"><input v-model="opts.stampIndices" type="checkbox" :value="i"> {{ s.name }}</label>
        </div>
        <div class="presets">
          <button type="button" class="btn" @click="opts.stampIndices = design.stamps.map((_, i) => i); settle()">All</button>
          <button type="button" class="btn" @click="opts.stampIndices = []; settle()">None</button>
        </div>
      </fieldset>
      <div class="fields">
        <div class="field">
          <label for="fill-size">Size <output for="fill-size">{{ opts.size.toFixed(2) }}</output></label>
          <input id="fill-size" v-model.number="opts.size" type="range" min="0.2" max="1.4" step="0.05">
        </div>
        <div class="field">
          <label for="fill-sj">Size variety <output for="fill-sj">{{ Math.round(opts.sizeJitter * 100) }} %</output></label>
          <input id="fill-sj" v-model.number="opts.sizeJitter" type="range" min="0" max="1" step="0.05">
        </div>
        <div class="field">
          <label for="fill-jit">Position variety <output for="fill-jit">{{ Math.round(opts.jitter * 100) }} %</output></label>
          <input id="fill-jit" v-model.number="opts.jitter" type="range" min="0" max="1" step="0.05">
        </div>
        <div class="field">
          <label for="fill-turn">Turn</label>
          <select id="fill-turn" v-model="opts.rotate">
            <option value="none">None</option>
            <option value="quarter">Quarter turns</option>
            <option value="free">Any angle</option>
          </select>
        </div>
      </div>
      <div class="options">
        <label class="radio"><input v-model="opts.stagger" type="checkbox"> Shift every other row</label>
        <label class="radio"><input v-model="opts.flip" type="checkbox"> Flip some shapes</label>
      </div>
      <fieldset>
        <legend>Colors</legend>
        <div class="radios">
          <label class="radio"><input v-model="opts.colorMode" type="radio" name="fill-colors" value="own"> Keep each shape's own colors</label>
          <label class="radio"><input v-model="opts.colorMode" type="radio" name="fill-colors" value="palette"> Use a palette</label>
        </div>
        <PaletteStrip v-if="opts.colorMode === 'palette'" :colors="palette.colors" :name="palette.name" @previous="stepPal(-1)" @next="stepPal(1)" @random="rollPal" />
      </fieldset>
      <div class="field">
        <label for="fill-seed">Seed</label>
        <div class="seed-row">
          <input id="fill-seed" v-model.number="opts.seed" type="number" min="0" step="1">
          <button type="button" class="btn" @click="another">Another</button>
        </div>
      </div>
    </div>
    <button type="button" class="btn primary" aria-describedby="fill-hint" :disabled="opts.stampIndices.length === 0" @click="fillNow">Fill the tile</button>
    <p id="fill-hint" class="hint-text">This replaces every shape on the tile. Undo brings them back.</p>
    </details>
  </section>
</template>

<style scoped>
.presets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
  margin: 0 0 var(--s3);
}
.bg-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s3);
}
</style>
