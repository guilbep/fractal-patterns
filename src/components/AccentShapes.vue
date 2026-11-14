<script setup lang="ts">
import { computed } from 'vue';
import { ACCENT_PLACES, ACCENT_SHAPES, ACCENT_SNAPS, type AccentPlace, type AccentShape, type AccentSnap } from '@/accent-layer.ts';
import { BASIC_STAMPS } from '@/builder/stamps.ts';
import { accent, accentDrawn, accentLayer, accentOwnOk, clearAvailable, hasAccent, params } from '@/state.ts';
import UiSection from '@/components/UiSection.vue';
import UiSegmented from '@/components/UiSegmented.vue';
import UiSwitch from '@/components/UiSwitch.vue';

const LABELS: Record<AccentShape, string> = { own: "Kind's own", dot: 'Dot', ring: 'Ring', square: 'Square', triangle: 'Triangle', diamond: 'Diamond', drop: 'Drop', leaf: 'Leaf' };
const PLURALS: Record<AccentShape, string> = { own: 'dots', dot: 'dots', ring: 'rings', square: 'squares', triangle: 'triangles', diamond: 'diamonds', drop: 'drops', leaf: 'leaves' };
const PLACES = { own: "The kind's own places", seed: 'Scattered by the seed', grid: 'On a grid' } as const;
const PLACE_SHORT = { own: "the kind's own", seed: 'scattered', grid: 'on a grid' } as const;
// The Builder's drawings of the same shapes (src/builder/stamps.ts), by name.
const stamp = (s: AccentShape) => BASIC_STAMPS.find((b) => b.name === LABELS[s])?.parts[0];
const SNAPS = ACCENT_SNAPS.map((n) => ({ value: n, label: String(n) }));

// Over an image or a patchwork the kind is not drawn: no own shapes or places (accentDrawn shows dot and grid).
const own = computed(() => hasAccent(params.kind) && accentOwnOk.value);
const shapes = computed(() => ACCENT_SHAPES.filter((s) => s !== 'own' || own.value));
const places = computed(() => ACCENT_PLACES.filter((p) => p !== 'own' || own.value));
const off = computed(() => !accentLayer.on);
const summary = computed(() => {
  const l = accentDrawn.value;
  return l.on ? [PLACE_SHORT[l.place], PLURALS[l.shape], `${l.size} %`, ...(l.clear ? ['clear'] : [])].join(' · ') : 'off';
});
// ponytail: the links press the tab buttons; App owns the tab, and this saves an event through PatternPanel.
const openTab = (id: string) => document.getElementById(`tab-${id}`)?.click();
</script>

<template>
  <UiSection title="Accent shapes" heading-id="accent-shapes-h" :summary="summary" :level="3" class="accent-shapes pattern-card">
    <UiSwitch id="accent-on" v-model="accentLayer.on" label="Show accent shapes" hint="Drawn on top of the pattern, in the Accent color." />
    <fieldset class="accent-shape-grid" :disabled="off">
      <legend>Shape</legend>
      <button v-for="s in shapes" :key="s" type="button" class="accent-shape" :aria-pressed="accentDrawn.shape === s" @click="accentLayer.shape = s">
        <svg viewBox="0 0 100 100" width="24" height="24" aria-hidden="true">
          <g v-if="s === 'own'" :fill="accent"><circle cx="30" cy="50" r="18" /><circle cx="74" cy="50" r="18" /></g>
          <path v-else-if="stamp(s)?.paint === 'stroke'" :d="stamp(s)!.d" fill="none" stroke="currentColor" stroke-width="12" />
          <path v-else :d="stamp(s)?.d" fill="currentColor" />
        </svg>
        <span>{{ LABELS[s] }}</span>
      </button>
    </fieldset>
    <div class="field">
      <label for="accent-size">Size <output for="accent-size">{{ accentLayer.size }} % of a cell</output></label>
      <input id="accent-size" v-model.number="accentLayer.size" type="range" min="5" max="40" step="1" :disabled="off">
    </div>
    <div class="field">
      <label for="accent-amount">How many <output for="accent-amount">{{ accentLayer.amount === 100 ? 'every place' : `${accentLayer.amount} %` }}</output></label>
      <input id="accent-amount" v-model.number="accentLayer.amount" type="range" min="10" max="100" step="5" :disabled="off">
    </div>
    <div class="field">
      <label for="accent-place">Where</label>
      <select id="accent-place" :value="accentDrawn.place" :disabled="off" @change="accentLayer.place = ($event.target as HTMLSelectElement).value as AccentPlace">
        <option v-for="p in places" :key="p" :value="p">{{ PLACES[p] }}</option>
      </select>
    </div>
    <UiSegmented v-if="accentDrawn.place === 'grid'" :model-value="accentLayer.snap" class="accent-snap" label="Snap" name="accent-snap" :options="SNAPS" :disabled="off" @update:model-value="accentLayer.snap = $event as AccentSnap" />
    <UiSwitch
      id="accent-clear"
      v-model="accentLayer.clear"
      class="accent-clear"
      label="Keep clear of the lines"
      :hint="clearAvailable ? 'Moves each shape to the nearest spot that does not touch the pattern.' : 'Not available with smooth curves.'"
      :disabled="off || !clearAvailable"
    />
    <p class="hint-text">
      Color: Accent, in the <button type="button" class="link-btn" @click="openTab('colors')">Colors tab</button>. To vary the shapes across tiles,
      <button type="button" class="link-btn" @click="openTab('repetition')">open Repetition</button>.
    </p>
  </UiSection>
</template>
