<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { FAMILIES, FAMILY_LABELS, KINDS, KIND_FAMILY, KIND_LABELS, MAX_DEPTH, tileAspect, type Kind } from '@/fractal.ts';
import { LIB_TABS, kindsForTab, parseLibTab, tabForKind, type LibTab } from '@/library.ts';
import { MAX_SEED, autoCells, layout, opacity, params, patch, patchDepthMax, previews, reseed, roles, setPin, setSeed, source, squareKind, usingImage, usingPatchwork } from '@/state.ts';
import '@/css/library.css';

// Patchwork cells are square: rectangular kinds are not offered.
const squareKinds = KINDS.filter((k) => tileAspect(k) === 1);

const depthMax = computed(() => (usingPatchwork.value ? patchDepthMax.value : MAX_DEPTH[params.kind]));

function pick(): void {
  source.value = 'math';
  layout.value = 'single';
}

// Library tabs: one per family, then All. Only the open tab's kinds are drawn.
const LIB_KEY = 'fp-lib';
function readLibTab(): LibTab {
  try {
    return parseLibTab(sessionStorage.getItem(LIB_KEY), params.kind);
  } catch {
    return parseLibTab(null, params.kind);
  }
}
const libTab = ref<LibTab>(readLibTab());
watch(libTab, (t) => {
  try {
    sessionStorage.setItem(LIB_KEY, t);
  } catch {
    /* storage blocked: the tab resets on reload */
  }
});
// The open tab follows the kind when it changes from outside (Random pattern, undo, a link).
watch(
  () => params.kind,
  (k) => (libTab.value = tabForKind(libTab.value, k)),
);
function onLibKey(e: KeyboardEvent): void {
  const i = LIB_TABS.indexOf(libTab.value);
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: LIB_TABS.length - 1 }[e.key];
  if (next === undefined) return;
  e.preventDefault();
  const t = LIB_TABS[(next + LIB_TABS.length) % LIB_TABS.length]!;
  libTab.value = t;
  void nextTick(() => document.getElementById(`lib-tab-${t}`)?.focus());
}

// Reads the seed, never the colors: a color change only updates the custom properties below.
const groups = computed(() => {
  const items = previews(kindsForTab(libTab.value));
  return FAMILIES.map((family) => ({ family, items: items.filter((p) => KIND_FAMILY[p.kind] === family) })).filter((g) => g.items.length);
});
const galleryVars = computed(() => ({ '--lib-bg': roles.background, '--lib-fg': roles.pattern, '--lib-opacity': String(opacity.value) }));
</script>

<template>
  <section class="panel" aria-labelledby="pattern-h">
    <h2 id="pattern-h">Pattern</h2>
    <fieldset class="gallery" :style="galleryVars">
      <legend>Library</legend>
      <p v-if="usingPatchwork" class="note image-source-note">The tile is a patchwork. Pick a pattern here to go back to a single pattern.</p>
      <p v-if="usingImage" class="note image-source-note">The tile now comes from your image (see From image). Pick a pattern here to go back to math patterns.</p>
      <div class="lib-tabs" role="tablist" aria-label="Pattern families" @keydown="onLibKey">
        <button v-for="t in LIB_TABS" :id="`lib-tab-${t}`" :key="t" type="button" role="tab" class="lib-tab" :aria-selected="libTab === t" aria-controls="lib-panel" :tabindex="libTab === t ? 0 : -1" @click="libTab = t">{{ t === 'all' ? 'All' : FAMILY_LABELS[t] }} <span class="muted">{{ kindsForTab(t).length }}</span></button>
      </div>
      <!-- One radio group over the open tab's kinds: arrow keys move across them in DOM order. -->
      <div id="lib-panel" role="tabpanel" :aria-labelledby="`lib-tab-${libTab}`">
        <div v-for="g in groups" :key="g.family" class="family">
          <h3 v-if="libTab === 'all'" class="family-h">{{ FAMILY_LABELS[g.family] }} <span class="muted">{{ g.items.length }}</span></h3>
          <div class="kinds">
            <label v-for="p in g.items" :key="p.kind" class="kind">
              <input v-model="params.kind" type="radio" name="kind" :value="p.kind" class="visually-hidden" @click="pick">
              <span class="kind-tile lib-tile" aria-hidden="true"><span class="lib-ink" :style="{ maskImage: p.mask, '-webkit-mask-image': p.mask }"></span></span>
              <span class="kind-name">{{ KIND_LABELS[p.kind] }}</span>
            </label>
          </div>
        </div>
      </div>
    </fieldset>

    <div class="fields">
      <div class="field">
        <label for="seed">Seed</label>
        <div class="seed-row">
          <input id="seed" :disabled="usingImage" type="number" min="0" :max="MAX_SEED" step="1" :value="params.seed" @input="setSeed(($event.target as HTMLInputElement).value)" @change="($event.target as HTMLInputElement).value = String(params.seed)">
          <button type="button" class="btn icon-btn" title="New seed" :disabled="usingImage" @click="reseed">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66" /><path d="M20 4v5h-5" /></svg>
            <span class="visually-hidden">New seed</span>
          </button>
        </div>
      </div>
      <div class="field">
        <label for="depth">Depth <output for="depth">{{ Math.min(params.depth, depthMax) }} of {{ depthMax }}</output></label>
        <input id="depth" :disabled="usingImage" v-model.number="params.depth" type="range" min="1" :max="depthMax" step="1">
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

    <details class="lib-patchwork" :open="layout === 'patchwork'">
      <summary>Patchwork</summary>
      <fieldset class="radios">
        <legend>Layout</legend>
        <label class="radio"><input v-model="layout" type="radio" name="layout" value="single"> Single pattern</label>
        <label class="radio"><input v-model="layout" type="radio" name="layout" value="patchwork" :disabled="!squareKind"> Patchwork</label>
        <p v-if="!squareKind" class="hint-text">Patchwork: Not available for this pattern yet.</p>
      </fieldset>

      <div v-if="layout === 'patchwork' && squareKind" class="patchwork">
        <div class="field">
          <label for="cells">Grid size <output for="cells">{{ patch.cells }} by {{ patch.cells }}</output></label>
          <select id="cells" v-model.number="patch.cells">
            <option v-for="n in [2, 3, 4]" :key="n" :value="n">{{ n }} cells per edge</option>
          </select>
        </div>
        <fieldset class="radios">
          <legend>Families</legend>
          <label v-for="f in FAMILIES" :key="f" class="radio">
            <input v-model="patch.families" type="checkbox" :value="f" :disabled="patch.families.length === 1 && patch.families.includes(f)"> {{ FAMILY_LABELS[f] }}
          </label>
        </fieldset>
        <label class="radio"><input v-model="patch.frame" type="checkbox"> Frame lines</label>
        <ol class="cell-list">
          <li v-for="(auto, i) in autoCells" :key="i">
            <label :for="`cell-${i}`">Cell {{ i + 1 }}</label>
            <select :id="`cell-${i}`" :value="patch.pinned[i] ?? ''" @change="setPin(i, ($event.target as HTMLSelectElement).value as Kind | '')">
              <option value="">Auto: {{ KIND_LABELS[auto] }}</option>
              <option v-for="k in squareKinds" :key="k" :value="k">{{ KIND_LABELS[k] }}</option>
            </select>
          </li>
        </ol>
        <button type="button" class="btn" :disabled="Object.keys(patch.pinned).length === 0" @click="patch.pinned = {}">Clear pins</button>
      </div>
    </details>
  </section>
</template>
