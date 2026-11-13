<script setup lang="ts">
// Stub: the tile's repeat and background color.
import type { BuilderRepeat } from './types.ts';
import { commit, design } from './store.ts';

const REPEATS: readonly (readonly [BuilderRepeat, string])[] = [
  ['straight', 'Straight'],
  ['half-drop', 'Half-drop'],
  ['brick', 'Brick'],
];
</script>

<template>
  <section class="panel" aria-labelledby="tile-h">
    <h2 id="tile-h">Tile</h2>
    <div class="fields">
      <div class="field">
        <label for="tile-repeat">Repeat</label>
        <select id="tile-repeat" :value="design.repeat" @change="commit({ ...design, repeat: ($event.target as HTMLSelectElement).value as BuilderRepeat })">
          <option v-for="[r, label] in REPEATS" :key="r" :value="r">{{ label }}</option>
        </select>
      </div>
      <div class="field">
        <label for="tile-bg">Background</label>
        <input id="tile-bg" type="color" :value="design.background ?? '#ffffff'" @change="commit({ ...design, background: ($event.target as HTMLInputElement).value })">
      </div>
    </div>
  </section>
</template>
