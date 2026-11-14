<script setup lang="ts">
// The inspector of the selected shape: every change the stage offers by drag, as form controls.
import { computed } from 'vue';
import { duplicateMany, removeMany, reorderMany, updateMany } from './design.ts';
import { setAllColors, setPartColor, usedColors } from './item-colors.ts';
import { commit, design, preview, selected, selectedIds } from './store.ts';
import type { Design, Item } from './types.ts';

const MAX_INPUTS = 6;

const stamp = computed(() => (selected.value ? design.value.stamps[selected.value.stamp] : undefined));
const partColors = computed(() => stamp.value?.parts.map((p) => p.color) ?? []);
const minSide = computed(() => Math.min(design.value.width, design.value.height));
const sizeMin = computed(() => Math.max(1, Math.round(minSide.value * 0.02)));
const sizeMax = computed(() => Math.round(minSide.value * 1.5));
const side = computed(() => (selected.value && stamp.value ? selected.value.scale * stamp.value.box : 0));
const many = computed(() => selectedIds.value.length > 1);
/** The positions of the selected items in the list, low to high. */
const indexes = computed(() => design.value.items.flatMap((it, k) => (selectedIds.value.includes(it.id) ? [k] : [])));
// The group is at the top when its items are the last ones (and at the bottom when they are the first ones).
const atTop = computed(() => indexes.value[0] === design.value.items.length - indexes.value.length);
const atBottom = computed(() => indexes.value[indexes.value.length - 1] === indexes.value.length - 1);
const swatches = computed(() => usedColors(design.value));

// The design at the start of the current drag: each preview and the final commit build on it, so one drag is one undo step.
let base: Design | null = null;

function edit(e: Event, patch: (it: Item) => Partial<Omit<Item, 'id'>>): void {
  const ids = selectedIds.value;
  if (!ids.length) return;
  base ??= design.value;
  const next = updateMany(base, ids, patch);
  if (e.type === 'change') {
    base = null;
    commit(next);
    // A group slider shows the change, not a value: back to its start after each change.
    if (many.value) (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).defaultValue;
  } else preview(next);
}

const value = (e: Event): string => (e.target as HTMLInputElement).value;
const num = (e: Event): number => Number(value(e));

function setAll(color: string): void {
  const d = design.value;
  act((x, ids) => updateMany(x, ids, (it) => ({ colors: setAllColors(d.stamps[it.stamp]?.parts.map((p) => p.color) ?? [], color) })));
}

function act(op: (d: Design, ids: number[]) => Design): void {
  const ids = selectedIds.value;
  if (!ids.length) return;
  const next = op(design.value, ids);
  if (next !== design.value) commit(next);
}

function duplicate(): void {
  const r = duplicateMany(design.value, selectedIds.value);
  if (!r.ids.length) return;
  commit(r.design);
  selectedIds.value = r.ids;
}
</script>

<template>
  <section class="card item-panel" :class="{ active: selected && stamp }" :aria-label="many ? `Selected shapes (${selectedIds.length})` : 'Selected shape'">
    <details open>
      <summary class="card-head">
        <h2 id="item-h">
          <template v-if="many">Selected shapes ({{ selectedIds.length }})</template>
          <template v-else-if="selected && stamp">Selected · <span>{{ stamp.name }}</span></template>
          <template v-else>Selected shape</template>
        </h2>
      </summary>
      <div class="card-body">
        <p v-if="!selected || !stamp" class="muted empty">Select a shape on the tile.</p>
        <template v-else-if="many">
          <p class="muted">Turn and Size change each shape by the amount you set.</p>
          <div class="sliders">
            <div class="field">
              <label for="item-turn">Turn by</label>
              <input id="item-turn" type="range" min="-180" max="180" step="1" value="0" @input="edit($event, (it) => ({ rotate: it.rotate + num($event) }))" @change="edit($event, (it) => ({ rotate: it.rotate + num($event) }))">
            </div>
            <div class="field">
              <label for="item-size">Size, percent</label>
              <input id="item-size" type="range" min="25" max="300" step="1" value="100" @input="edit($event, (it) => ({ scale: (it.scale * num($event)) / 100 }))" @change="edit($event, (it) => ({ scale: (it.scale * num($event)) / 100 }))">
            </div>
            <div class="field">
              <label for="item-opacity">Opacity <output for="item-opacity">{{ Math.round(selected.opacity * 100) }} %</output></label>
              <input id="item-opacity" type="range" min="0.05" max="1" step="0.05" :value="selected.opacity" @input="edit($event, () => ({ opacity: num($event) }))" @change="edit($event, () => ({ opacity: num($event) }))">
            </div>
          </div>
        </template>
        <div v-else class="sliders">
          <div class="field">
            <label for="item-turn">Turn <output for="item-turn">{{ Math.round(selected.rotate) }}°</output></label>
            <input id="item-turn" type="range" min="0" max="359" step="1" :value="Math.round(selected.rotate)" @input="edit($event, () => ({ rotate: num($event) }))" @change="edit($event, () => ({ rotate: num($event) }))">
          </div>
          <div class="field">
            <label for="item-size">Size <output for="item-size">{{ Math.round(side) }}</output></label>
            <input id="item-size" type="range" :min="sizeMin" :max="sizeMax" step="1" :value="Math.round(side)" @input="edit($event, () => ({ scale: num($event) / stamp!.box }))" @change="edit($event, () => ({ scale: num($event) / stamp!.box }))">
          </div>
          <div class="field">
            <label for="item-opacity">Opacity <output for="item-opacity">{{ Math.round(selected.opacity * 100) }} %</output></label>
            <input id="item-opacity" type="range" min="0.05" max="1" step="0.05" :value="selected.opacity" @input="edit($event, () => ({ opacity: num($event) }))" @change="edit($event, () => ({ opacity: num($event) }))">
          </div>
        </div>

        <div v-if="selected && stamp" class="color-row">
          <template v-if="!many">
            <div v-for="(c, i) in partColors.slice(0, MAX_INPUTS)" :key="i" class="color-field">
              <label :for="`item-color-${i}`">{{ partColors.length === 1 ? 'Color' : `Color ${i + 1}` }}</label>
              <input :id="`item-color-${i}`" type="color" :value="selected.colors[i] ?? c" @input="edit($event, (it) => ({ colors: setPartColor(it, partColors, i, value($event)) }))" @change="edit($event, (it) => ({ colors: setPartColor(it, partColors, i, value($event)) }))">
            </div>
            <template v-if="partColors.length > MAX_INPUTS">
              <span class="muted">and {{ partColors.length - MAX_INPUTS }} more parts</span>
              <div class="color-field">
                <label for="item-color-all">All parts</label>
                <input id="item-color-all" type="color" :value="selected.colors[0] ?? partColors[0]" @input="edit($event, () => ({ colors: setAllColors(partColors, value($event)) }))" @change="edit($event, () => ({ colors: setAllColors(partColors, value($event)) }))">
              </div>
            </template>
          </template>
          <div class="color-swatches" role="group" aria-label="Colors in this design">
            <button v-for="c in swatches" :key="c" type="button" class="swatch" :class="{ on: !many && c.toLowerCase() === (selected.colors[0] ?? partColors[0] ?? '').toLowerCase() }" :style="{ background: c }" :aria-label="c" :title="c" @click="setAll(c)" />
          </div>

          <div class="actions">
            <button id="item-flip" type="button" class="btn" :aria-pressed="selected.flip" @click="act((d, ids) => updateMany(d, ids, { flip: !selected!.flip }))">Flip</button>
            <button type="button" class="btn" @click="duplicate">Duplicate</button>
            <details class="order">
              <summary class="btn">Order <span aria-hidden="true">▾</span></summary>
              <div class="order-menu" role="group" aria-label="Order">
                <button type="button" class="btn" :disabled="atTop" @click="act((d, ids) => reorderMany(d, ids, 'front'))">To front</button>
                <button type="button" class="btn" :disabled="atTop" @click="act((d, ids) => reorderMany(d, ids, 'up'))">Forward</button>
                <button type="button" class="btn" :disabled="atBottom" @click="act((d, ids) => reorderMany(d, ids, 'down'))">Backward</button>
                <button type="button" class="btn" :disabled="atBottom" @click="act((d, ids) => reorderMany(d, ids, 'back'))">To back</button>
              </div>
            </details>
            <button type="button" class="btn danger" @click="act(removeMany)">Delete</button>
          </div>
        </div>
      </div>
    </details>
  </section>
</template>

<style scoped>
.item-panel.active {
  border-color: var(--accent);
}
.empty {
  margin: 0;
}
.sliders {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
  gap: var(--s3) var(--s4);
  align-items: end;
}
.sliders .field {
  margin: 0;
}
.sliders label {
  font-weight: 400;
  font-size: 0.875rem;
}
.sliders output {
  font-family: var(--mono);
}
.sliders input[type='range'] {
  accent-color: var(--ink);
}
.color-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2);
  margin-top: var(--s3);
}
.color-field {
  display: flex;
  align-items: center;
  gap: var(--s2);
  font-size: 0.875rem;
}
.color-swatches {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2);
}
.swatch {
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  cursor: pointer;
}
.swatch.on {
  outline: 2px solid var(--ink);
  outline-offset: 2px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2);
  margin-left: auto;
}
.actions .btn {
  min-height: 2.125rem;
  padding: 0 var(--s2-5);
  font-size: 0.875rem;
  font-weight: 400;
}
.order > summary {
  gap: var(--s1);
}
.color-field input[type='color'] {
  min-width: 2rem;
  min-height: 2rem;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius);
}
.danger {
  color: var(--fail);
  border-color: var(--fail);
}
.order {
  position: relative;
}
.order > summary {
  list-style: none;
  min-height: 2.125rem;
}
.order > summary::-webkit-details-marker {
  display: none;
}
.order-menu {
  position: absolute;
  right: 0;
  z-index: 3;
  display: grid;
  gap: var(--s1);
  margin-top: var(--s1);
  padding: var(--s1);
  background: var(--surface);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-card);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.order-menu .btn {
  white-space: nowrap;
}
</style>
