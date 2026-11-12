<script setup lang="ts">
import { KIND_LABELS, MAX_DEPTH } from '@/fractal.ts';
import { MAX_SEED, params, previews, setSeed } from '@/state.ts';
</script>

<template>
  <section class="panel" aria-labelledby="pattern-h">
    <h2 id="pattern-h">Pattern</h2>
    <fieldset class="kinds">
      <legend>Fractal</legend>
      <label v-for="p in previews" :key="p.kind" class="kind">
        <input v-model="params.kind" type="radio" name="kind" :value="p.kind" class="visually-hidden">
        <span class="kind-tile" :style="p.css" aria-hidden="true"></span>
        <span class="kind-name">{{ KIND_LABELS[p.kind] }}</span>
      </label>
    </fieldset>

    <div class="fields">
      <div class="field">
        <label for="seed">Seed</label>
        <input id="seed" type="number" min="0" :max="MAX_SEED" step="1" :value="params.seed" @input="setSeed(($event.target as HTMLInputElement).value)" @change="($event.target as HTMLInputElement).value = String(params.seed)">
      </div>
      <div class="field">
        <label for="depth">Depth <output for="depth">{{ params.depth }} of {{ MAX_DEPTH[params.kind] }}</output></label>
        <input id="depth" v-model.number="params.depth" type="range" min="1" :max="MAX_DEPTH[params.kind]" step="1">
      </div>
      <div class="field">
        <label for="size">Tile size <output for="size">{{ params.size }} px</output></label>
        <input id="size" v-model.number="params.size" type="range" min="40" max="240" step="4">
      </div>
      <div class="field">
        <label for="stroke">Stroke width <output for="stroke">{{ params.strokeWidth }} px</output></label>
        <input id="stroke" v-model.number="params.strokeWidth" type="range" min="0.5" max="6" step="0.5">
      </div>
    </div>
  </section>
</template>
