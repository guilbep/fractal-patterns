<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { LOGO_DEFAULT, logoSvg } from '@/logo.ts';
import { svgToDataUri } from '@/css.ts';
import { formatFootprint, gzipSize, rawSize } from '@/co2.ts';
import { PALETTES } from '@/palettes.ts';
import { compose, composeSummary } from './compose.ts';
import { repeatCell, studioSvg, type Repeat } from './model.ts';
import { MOTIF_FAMILIES, MOTIF_LABELS } from './motifs.ts';
import { decodeStudio, designOptions, encodeStudio, MAX_SEED, SIZE_MAX, SIZE_MIN, SIZE_STEP } from './studio-share.ts';

const LOGO_URI = svgToDataUri(logoSvg(LOGO_DEFAULT));
const REPEAT_INFO: readonly (readonly [Repeat, string, string])[] = [
  ['straight', 'Straight', 'The tile repeats side by side in a plain grid.'],
  ['half-drop', 'Half-drop', 'Each column drops by half a tile.'],
  ['brick', 'Brick', 'Each row shifts by half a tile, like brickwork.'],
  ['mirror', 'Mirror', 'Neighbors are mirror images, left to right and top to bottom.'],
];

const design = reactive(decodeStudio(location.hash));
const zoom = ref(100);

const studio = computed(() => compose(designOptions(design)));
const svg = computed(() => studioSvg(studio.value));
const cell = computed(() => repeatCell(studio.value));
const uri = computed(() => svgToDataUri(svg.value));
const summary = computed(() => composeSummary(studio.value));
const bg = computed(() => studio.value.background ?? 'transparent');
const css = computed(() => `.wallpaper { background: ${bg.value} url("${uri.value}") 0 0 / ${cell.value.width}px ${cell.value.height}px; }`);
const wallStyle = computed(() => ({
  backgroundColor: bg.value,
  backgroundImage: `url("${uri.value}")`,
  backgroundSize: `${(cell.value.width * zoom.value) / 100}px ${(cell.value.height * zoom.value) / 100}px`,
}));
const fileName = computed(() => `wallpaper-${design.repeat}-${design.seed}.svg`);

// Sizes: raw now, gzipped when CompressionStream answers. A stale answer is dropped.
const raw = computed(() => rawSize(svg.value));
const gz = ref<number | null | 'unknown'>(null);
watch(
  svg,
  async (text) => {
    gz.value = null;
    try {
      const n = await gzipSize(text);
      if (text === svg.value) gz.value = n;
    } catch {
      if (text === svg.value) gz.value = 'unknown';
    }
  },
  { immediate: true },
);
const sizeText = computed(() => `${raw.value} bytes, ${typeof gz.value === 'number' ? `${gz.value} gzipped` : gz.value === null ? 'compressing' : 'gzip size unknown'}`);
const footprintFull = computed(() => (gz.value === null ? 'computing' : gz.value === 'unknown' ? 'size unknown' : formatFootprint(gz.value)));
const footprintText = computed(() => footprintFull.value.split(' / ')[0]);

// The hash follows the design, without new history entries; a pasted link loads its design.
watch(design, (d) => history.replaceState(null, '', `#${encodeStudio(d)}`), { deep: true });
const onHash = () => Object.assign(design, decodeStudio(location.hash));
onMounted(() => window.addEventListener('hashchange', onHash));
onBeforeUnmount(() => window.removeEventListener('hashchange', onHash));

function shuffle(): void {
  design.seed = Math.floor(Math.random() * MAX_SEED);
}
function setSeed(v: string): void {
  const n = Math.round(Number(v));
  if (v.trim() !== '' && Number.isFinite(n)) design.seed = Math.min(MAX_SEED, Math.max(0, n));
}

const copyStatus = ref('');
const showCss = ref(false);
let copyTimer: ReturnType<typeof setTimeout> | undefined;
async function copyCss(): Promise<void> {
  copyStatus.value = '';
  try {
    await navigator.clipboard.writeText(css.value);
    copyStatus.value = 'Copied';
  } catch {
    // No clipboard (insecure context, blocked): show the rule to copy by hand.
    showCss.value = true;
    copyStatus.value = 'Could not copy. Select the CSS below and copy it.';
  }
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => (copyStatus.value = ''), 2500);
}

// Sticky offset under the toolbar, as in the pattern tool.
const bar = ref<HTMLElement | null>(null);
const sizes = new ResizeObserver(() => document.documentElement.style.setProperty('--bar-h', `${bar.value?.offsetHeight ?? 0}px`));
onMounted(() => bar.value && sizes.observe(bar.value));
onBeforeUnmount(() => sizes.disconnect());
</script>

<template>
  <header class="site-header">
    <p class="brand"><img class="logo" :src="LOGO_URI" alt="" width="28" height="28">Wallpaper Studio</p>
    <p class="tagline">Original botanical wallpapers from a seed. Every motif is generated here; nothing is copied.</p>
    <p><a href="./index.html">Pattern tool</a></p>
  </header>

  <div ref="bar" class="toolbar" role="toolbar" aria-label="Wallpaper actions">
    <div class="bar-row">
    <button type="button" class="btn primary" @click="shuffle">Shuffle</button>
    <span class="bar-sep" aria-hidden="true"></span>
    <a class="btn" :href="uri" :download="fileName">Download SVG</a>
    <button type="button" class="btn" @click="copyCss">{{ copyStatus === 'Copied' ? 'Copied' : 'Copy CSS' }}</button>
    </div>
    <div class="bar-stats">
    <span id="svg-size" class="stat">{{ sizeText }}</span>
    <span id="svg-co2" class="stat" :title="footprintFull"><span aria-hidden="true">{{ footprintText }}</span><span class="visually-hidden">{{ footprintFull }}</span></span>
    </div>
    <span class="visually-hidden" role="status" aria-live="polite">{{ copyStatus }}</span>
  </div>

  <main class="layout">
    <div class="stage">
      <div id="wall" class="wall" role="img" :aria-label="`Wallpaper preview, ${REPEAT_INFO.find(([r]) => r === design.repeat)?.[1]} repeat, seed ${design.seed}`" :style="wallStyle"></div>
    </div>

    <div class="controls">
      <section v-if="showCss" class="panel" aria-labelledby="css-h">
        <h2 id="css-h">CSS</h2>
        <label for="css-out" class="visually-hidden">CSS rule</label>
        <textarea id="css-out" class="code" readonly rows="4" :value="css" @focus="($event.target as HTMLTextAreaElement).select()"></textarea>
      </section>

      <section class="panel" aria-labelledby="design-h">
        <h2 id="design-h">Design</h2>
        <div class="fields">
          <div class="field">
            <label for="seed">Seed</label>
            <div class="seed-row">
              <input id="seed" type="number" min="0" :max="MAX_SEED" step="1" :value="design.seed" @input="setSeed(($event.target as HTMLInputElement).value)" @change="($event.target as HTMLInputElement).value = String(design.seed)">
              <button type="button" class="btn" @click="shuffle">Shuffle</button>
            </div>
          </div>
          <div class="field">
            <label for="palette">Palette</label>
            <select id="palette" v-model.number="design.palette">
              <option v-for="(p, i) in PALETTES" :key="p.name" :value="i">{{ p.name }}</option>
            </select>
          </div>
          <div class="field">
            <label for="density">Density <output for="density">{{ Math.round(design.density * 100) }} %</output></label>
            <input id="density" v-model.number="design.density" type="range" min="0" max="1" step="0.01">
          </div>
          <div class="field">
            <label for="size">Tile size <output for="size">{{ design.size }} px</output></label>
            <input id="size" v-model.number="design.size" type="range" :min="SIZE_MIN" :max="SIZE_MAX" :step="SIZE_STEP">
          </div>
          <div class="field">
            <label for="zoom">Preview zoom <output for="zoom">{{ zoom }} %</output></label>
            <input id="zoom" v-model.number="zoom" type="range" min="50" max="200" step="10">
          </div>
        </div>
        <label class="radio"><input id="stems" v-model="design.stems" type="checkbox"> Stems behind the large motifs</label>
      </section>

      <section class="panel" aria-labelledby="repeat-h">
        <h2 id="repeat-h">Repeat</h2>
        <fieldset>
          <legend class="visually-hidden">Repeat type</legend>
          <div class="radios">
            <label v-for="[r, label, desc] in REPEAT_INFO" :key="r" class="radio">
              <input v-model="design.repeat" type="radio" name="repeat" :value="r">
              <span>{{ label }} <span class="repeat-desc">{{ desc }}</span></span>
            </label>
          </div>
        </fieldset>
      </section>

      <section class="panel" aria-labelledby="families-h">
        <h2 id="families-h">Motif families</h2>
        <fieldset>
          <legend class="visually-hidden">Motif families (at least one)</legend>
          <div class="families">
            <label v-for="f in MOTIF_FAMILIES" :key="f" class="radio">
              <input v-model="design.families" type="checkbox" :value="f" :disabled="design.families.length === 1 && design.families.includes(f)">
              {{ MOTIF_LABELS[f] }}
            </label>
          </div>
        </fieldset>
        <p id="summary" class="summary muted">{{ summary.instances }} placements, {{ summary.motifs }} motif definitions, {{ summary.plates }} colors (plates).</p>
      </section>
    </div>
  </main>
</template>
