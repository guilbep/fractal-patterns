<script setup lang="ts">
// Stub: names the selected shape.
import { design, selected } from './store.ts';
</script>

<template>
  <section class="panel" aria-labelledby="item-h">
    <h2 id="item-h">Selected shape</h2>
    <p class="muted">{{ selected ? design.stamps[selected.stamp]?.name : 'Select a shape on the tile.' }}</p>
  </section>
</template>
