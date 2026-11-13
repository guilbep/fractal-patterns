<script setup lang="ts">
// Stub: one button per stamp; a click places it at the tile center and selects it.
import { addItem } from './design.ts';
import { commit, design, selectedId } from './store.ts';

function place(stamp: number): void {
  const d = addItem(design.value, stamp, design.value.width / 2, design.value.height / 2);
  commit(d);
  selectedId.value = d.items[d.items.length - 1]!.id;
}
</script>

<template>
  <section class="panel" aria-labelledby="stamps-h">
    <h2 id="stamps-h">Shapes</h2>
    <div class="stamp-grid">
      <button v-for="(s, i) in design.stamps" :key="i" type="button" class="stamp-btn" :aria-label="s.name" :title="s.name" @click="place(i)">
        <svg :viewBox="`0 0 ${s.box} ${s.box}`" aria-hidden="true">
          <path v-for="(p, j) in s.parts" :key="j" :d="p.d" :fill="p.paint === 'fill' ? p.color : 'none'" :fill-rule="p.evenodd ? 'evenodd' : undefined" :stroke="p.paint === 'stroke' ? p.color : 'none'" :stroke-width="p.paint === 'stroke' ? s.box / 16 : undefined" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>
  </section>
</template>
