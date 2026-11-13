<script setup lang="ts">
// "Use it": what the tile is for, at which size, and the file to get. Shared by the three pages.
import { computed, reactive, ref, useId } from 'vue';
import UiSwitch from './UiSwitch.vue';
import UseItPreview from './UseItPreview.vue';
import { DESTINATIONS, pngFileName, resolvePreset, type Destination } from '@/use-it.ts';
import { mayExceedMobileLimit } from '@/png-plan.ts';

const props = withDefaults(
  defineProps<{
    svg: string;
    tileWidth: number;
    tileHeight: number;
    background: string | null;
    /** The page's SVG file name without `.svg`; PNG names add the size. */
    baseName: string;
    svgHref: string;
    svgFileName: string;
    initial?: Destination['id'];
  }>(),
  { initial: 'web' },
);
defineSlots<{ web(props: { preset: string }): unknown }>();

const uid = useId();
// Read once: the screen does not change while the panel is open in a way that matters here.
const screenSize = { width: screen.width, height: screen.height, dpr: devicePixelRatio || 1 };
const coarse = matchMedia('(pointer: coarse)').matches;

const destId = ref<Destination['id']>(props.initial);
const dest = computed(() => DESTINATIONS.find((d) => d.id === destId.value) ?? DESTINATIONS[0]!);
const presetIds = reactive<Record<string, string>>(Object.fromEntries(DESTINATIONS.map((d) => [d.id, d.presets[0]!.id])));
const custom = reactive({ width: 1920, height: 1080 });
const clockFade = ref(true);

const sizeOf = (presetId: string) => resolvePreset(dest.value, presetId, screenSize, custom);
const preset = computed(() => dest.value.presets.find((p) => p.id === presetIds[destId.value]) ?? dest.value.presets[0]!);
const chosen = computed(() => sizeOf(presetIds[destId.value]!));
const sizeText = (w: number | null, h: number | null) => (w && h ? `${w} × ${h}` : '');

function pickPreset(id: string) {
  // Custom starts from the size shown just before, so it is a small step from there.
  const before = chosen.value;
  presetIds[destId.value] = id;
  if (dest.value.presets.find((p) => p.id === id)?.custom && before.width && before.height) {
    custom.width = before.width;
    custom.height = before.height;
  }
}
function clampInputs() {
  const { width, height } = chosen.value;
  if (width && height) Object.assign(custom, { width, height });
}

const busy = ref(false);
const status = ref('');
const failed = ref(false);
const warnLarge = computed(() => coarse && !!chosen.value.width && mayExceedMobileLimit(chosen.value.width, chosen.value.height!));

async function downloadPng() {
  const { width, height } = chosen.value;
  if (!width || !height || busy.value) return;
  busy.value = true;
  failed.value = false;
  status.value = 'Making the image…';
  try {
    const { renderPng, downloadBlob } = await import('@/png-export.ts');
    const blob = await renderPng({
      svg: props.svg,
      tileWidth: props.tileWidth,
      tileHeight: props.tileHeight,
      width,
      height,
      background: props.background,
      clockFade: dest.value.clockOption ? clockFade.value : false,
    });
    downloadBlob(blob, pngFileName(props.baseName, width, height));
    status.value = `Saved ${width} × ${height} PNG.`;
  } catch (e) {
    failed.value = true;
    status.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="use-it" :aria-labelledby="`${uid}-h`">
    <h2 :id="`${uid}-h`" class="visually-hidden">Use it</h2>
    <UseItPreview
      class="use-it-left"
      :svg="svg"
      :tile-width="tileWidth"
      :tile-height="tileHeight"
      :background="background"
      :destination="destId"
      :width="chosen.width"
      :height="chosen.height"
      :hero="destId === 'web' && presetIds.web === 'hero'"
      :clock-fade="!!dest.clockOption && clockFade"
      :preset-label="preset.label"
      :output="chosen.output"
    />

    <div class="use-it-steps">
      <fieldset class="use-it-step">
        <legend>1 · What is it for?</legend>
        <div class="use-it-dests">
          <label v-for="d in DESTINATIONS" :key="d.id" class="use-it-dest">
            <input v-model="destId" class="visually-hidden" type="radio" :name="`${uid}-dest`" :value="d.id" />
            <b>{{ d.label }}</b>
            <span class="use-it-hint">{{ d.hint }}</span>
          </label>
        </div>
      </fieldset>

      <fieldset class="use-it-step">
        <legend>2 · Which size?</legend>
        <div class="use-it-presets">
          <label v-for="p in dest.presets" :key="`${dest.id}-${p.id}`" class="use-it-preset">
            <input
              type="radio"
              :name="`${uid}-preset-${dest.id}`"
              :value="p.id"
              :checked="presetIds[dest.id] === p.id"
              @change="pickPreset(p.id)"
            />
            <span>{{ p.label }}</span>
            <span class="use-it-px">{{
              p.custom ? '' : p.output === 'png' ? sizeText(sizeOf(p.id).width, sizeOf(p.id).height) : p.output.toUpperCase()
            }}</span>
          </label>
        </div>
        <div v-if="preset.custom" class="use-it-custom">
          <label>
            Width
            <input v-model.number="custom.width" type="number" min="16" max="8192" step="1" inputmode="numeric" @change="clampInputs" />
          </label>
          <span aria-hidden="true">×</span>
          <label>
            Height
            <input v-model.number="custom.height" type="number" min="16" max="8192" step="1" inputmode="numeric" @change="clampInputs" />
          </label>
          <span class="use-it-px">px</span>
        </div>
        <UiSwitch
          v-if="dest.clockOption"
          v-model="clockFade"
          class="use-it-switch"
          label="Keep the clock readable"
          hint="fades the pattern under the time"
        />
      </fieldset>

      <div class="use-it-step">
        <h3 class="use-it-get">3 · Get it</h3>
        <slot v-if="chosen.output === 'css'" name="web" :preset="presetIds.web!" />
        <template v-else>
          <div class="use-it-actions">
            <a v-if="chosen.output === 'svg'" class="btn use-it-action" :href="svgHref" :download="svgFileName">
              <svg class="use-it-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8M4 7l4 4 4-4M3 14h10" /></svg>
              Download SVG
            </a>
            <button v-else type="button" class="btn use-it-action" :disabled="busy" @click="downloadPng">
              <svg class="use-it-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8M4 7l4 4 4-4M3 14h10" /></svg>
              Download PNG · {{ sizeText(chosen.width, chosen.height) }}
            </button>
            <!-- ponytail: QR hand-off is out of scope; the button is shown, marked unavailable. -->
            <button type="button" class="btn secondary use-it-qr" aria-disabled="true" title="Coming later">Send to my phone (QR)</button>
          </div>
          <p v-if="warnLarge" class="use-it-note">
            This size may be too large for a phone browser. The SVG works everywhere.
            <a :href="svgHref" :download="svgFileName">Download SVG</a>
          </p>
        </template>
        <p class="use-it-note" role="status">
          {{ status }}
          <a v-if="failed" :href="svgHref" :download="svgFileName">Download SVG</a>
        </p>
        <p class="use-it-howto">{{ dest.howTo }}</p>
      </div>
    </div>
  </section>
</template>
