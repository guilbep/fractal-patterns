<script setup lang="ts">
import { computed, ref } from 'vue';
import { DETECTOR_LABELS, TRACE_GROUPS } from '@/detectors.ts';
import { MAX_EXTRA_IMAGES, RESOLUTIONS, activeSample, addImages, extraImages, removeExtraImage, curveBytes, image, loadImage, loadSample, rawBytes, removeImage, source, spacing, trace, traced, usingImage } from '@/state.ts';
import { SAMPLES, SAMPLE_LABELS, sampleImage, type Sample } from '@/samples.ts';

const painted = new WeakSet<Element>();
// Draws each thumbnail once, when its canvas mounts.
function paint(el: unknown, id: Sample): void {
  if (!(el instanceof HTMLCanvasElement) || painted.has(el)) return;
  painted.add(el);
  const { data, width, height } = sampleImage(id, 64);
  el.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
}

const contours = computed(() => trace.detector === 'isolines');
const error = ref('');
const dragging = ref(false);

async function take(file: File | undefined): Promise<void> {
  if (!file) return;
  error.value = '';
  try {
    await loadImage(file);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'The image could not be loaded.';
  }
}

function onPick(e: Event): void {
  const input = e.target as HTMLInputElement;
  void take(input.files?.[0]);
  input.value = ''; // the same file can be picked again
}

async function onPickMore(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const files = [...(input.files ?? [])];
  input.value = '';
  error.value = '';
  try {
    await addImages(files);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'The image could not be loaded.';
  }
}

function onDrop(e: DragEvent): void {
  dragging.value = false;
  void take(e.dataTransfer?.files[0]);
}
</script>

<template>
  <section class="panel" aria-labelledby="image-h">
    <h2 id="image-h">From image</h2>
    <p class="lede">Photograph a wall, a floor, or a fabric. The tool traces its edges into a light tile that uses your colors.</p>
    <ul class="image-notes">
      <li>Use only images that you own or have a license for.</li>
      <li>Your image stays in your browser. Nothing is uploaded.</li>
    </ul>

    <fieldset class="samples">
      <legend>Try an example</legend>
      <div class="sample-list">
        <button v-for="id in SAMPLES" :key="id" type="button" class="btn sample" :aria-pressed="activeSample === id" @click="loadSample(id)">
          <canvas :ref="(el) => paint(el, id)" width="64" height="64" aria-hidden="true" />
          {{ SAMPLE_LABELS[id] }}
        </button>
      </div>
      <p class="muted">These examples are drawn by the app. They are not photos, and nothing is downloaded.</p>
    </fieldset>

    <!-- The label is the drop zone; the native file input inside it gives the keyboard path. -->
    <label class="drop" :class="{ dragging }" @dragover.prevent="dragging = true" @dragleave="dragging = false" @drop.prevent="onDrop">
      <span class="drop-title">Choose an image or drop it here</span>
      <input type="file" accept="image/*" @change="onPick">
    </label>
    <p class="error" role="alert">{{ error }}</p>

    <fieldset v-if="image" class="more-images">
      <legend>More pictures for Reduce repetition</legend>
      <template v-if="extraImages.length < MAX_EXTRA_IMAGES">
        <label for="more-images">Add up to {{ MAX_EXTRA_IMAGES }} more pictures</label>
        <input id="more-images" type="file" accept="image/*" multiple aria-describedby="more-images-hint" @change="onPickMore">
      </template>
      <p v-else class="muted">You added {{ MAX_EXTRA_IMAGES }} more pictures, the limit. Remove one to add another.</p>
      <ul v-if="extraImages.length" class="more-list">
        <li v-for="(x, i) in extraImages" :key="i + x.name">
          {{ x.name }} <button type="button" class="btn" :aria-label="`Remove ${x.name}`" @click="removeExtraImage(i)">Remove</button>
        </li>
      </ul>
      <p id="more-images-hint" class="hint-text">Each cell of the grid shows one of your pictures. Turn on Reduce repetition in the Repetition tab to see them.</p>
    </fieldset>

    <label class="radio"><input id="trace-curves" v-model="trace.curves" type="checkbox" :disabled="!usingImage || contours" aria-describedby="trace-curves-hint"> Smooth curves</label>
    <p id="trace-curves-hint" class="hint-text">
      <template v-if="!usingImage">Load an image or pick a sample first.</template>
      <template v-else-if="contours">Not available with Contour lines: the curve tracer follows edges only.</template>
      <template v-else>Draws round Bézier curves in place of straight segments. Smoother, and usually 1.3 to 3 times larger.</template>
      <template v-if="curveBytes && !contours">{{ ' ' }}{{ curveBytes.svg.toLocaleString('en') }} bytes against {{ curveBytes.plain.toLocaleString('en') }} with straight segments.</template>
    </p>

    <template v-if="image">
      <div class="out-actions">
        <button v-if="source === 'image'" type="button" class="btn" @click="source = 'math'">Use a math pattern</button>
        <button v-else type="button" class="btn primary" @click="source = 'image'">Use the image again</button>
        <button type="button" class="btn" @click="removeImage">Remove image</button>
      </div>

      <div class="fields">
        <div class="field">
          <label for="detector">Edge detector <output for="detector">{{ DETECTOR_LABELS[trace.detector] }}</output></label>
          <select id="detector" v-model="trace.detector">
            <optgroup v-for="g in TRACE_GROUPS" :key="g.label" :label="g.label">
              <option v-for="d in g.ids" :key="d" :value="d">{{ DETECTOR_LABELS[d] }}</option>
            </optgroup>
          </select>
        </div>
        <div v-if="contours" class="field">
          <label for="levels">Levels <output for="levels">{{ trace.levels }}</output></label>
          <input id="levels" v-model.number="trace.levels" type="range" min="2" max="8" step="1">
        </div>
        <div v-else class="field">
          <label for="threshold">Threshold <output for="threshold">{{ trace.threshold.toFixed(2) }}</output></label>
          <input id="threshold" v-model.number="trace.threshold" type="range" min="0.05" max="0.9" step="0.05">
        </div>
        <div class="field">
          <label for="tolerance">Detail <output for="tolerance">{{ trace.tolerance }} px</output></label>
          <input id="tolerance" v-model.number="trace.tolerance" type="range" min="0.5" max="6" step="0.5">
        </div>
        <div class="field">
          <label for="minlen">Minimum line length <output for="minlen">{{ trace.minLength }} px</output></label>
          <input id="minlen" v-model.number="trace.minLength" type="range" min="0" max="40" step="1">
        </div>
        <div class="field">
          <label for="fit">Fit</label>
          <select id="fit" v-model="trace.fit" :disabled="contours" :title="contours ? 'Contour lines always show the whole image.' : undefined">
            <option value="cover">Fill the tile (crop)</option>
            <option value="contain">Show the whole image</option>
          </select>
        </div>
        <div class="field">
          <label for="resolution">Resolution <output for="resolution">{{ trace.resolution }} px</output></label>
          <select id="resolution" v-model.number="trace.resolution">
            <option v-for="r in RESOLUTIONS" :key="r" :value="r">{{ r }} px on the longer edge</option>
          </select>
        </div>
      </div>

      <label class="radio"><input id="img-seamless" v-model="spacing.mirror" type="checkbox" :disabled="!usingImage || (trace.curves && !contours)" aria-describedby="img-seamless-hint"> Seamless edges (mirror)</label>
      <p id="img-seamless-hint" class="hint-text">
        Mirrors the picture left to right and top to bottom, so the edges meet. Each quarter of the tile holds the picture at half size, so the tile size stays the same and the path is about 4 times longer. Same switch as Mirror in Spacing.
        <template v-if="trace.curves && !contours">{{ ' ' }}Not available with Smooth curves yet.</template>
      </p>

      <dl class="stats">
        <div><dt>Lines kept</dt><dd>{{ traced?.length ?? 0 }}</dd></div>
        <div><dt>SVG size</dt><dd>{{ usingImage ? `${rawBytes.toLocaleString('en')} bytes` : 'not in use' }}</dd></div>
      </dl>
      <p v-if="traced && traced.length === 0" class="pattern-warn">The trace kept no line. {{ contours ? 'Add levels or lower the minimum line length.' : 'Lower the threshold or the minimum line length.' }}</p>
    </template>

    <ul class="image-notes muted">
      <li>A traced tile repeats without a visible seam only when the source image itself repeats, or when Seamless edges is on.</li>
      <li>Traced tiles are heavier than math patterns. Watch the CO2 line and raise Detail or Minimum line length to lighten the tile.</li>
    </ul>
  </section>
</template>

<style scoped>
.samples {
  margin: 0 0 var(--s3);
  padding: 0;
  border: 0;
  min-width: 0;
}
.samples legend {
  font-weight: 600;
  margin-bottom: var(--s1);
}
.sample-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: var(--s2);
}
.sample {
  display: flex;
  align-items: center;
  gap: var(--s2);
  text-align: left;
  overflow-wrap: normal;
  word-break: normal;
}
.sample canvas {
  width: 2rem;
  height: 2rem;
  flex: none;
  border-radius: var(--radius);
}
/* Not color alone: a thick outline and a check mark show the active example. */
.sample[aria-pressed='true'] {
  outline: 0.1875rem solid var(--accent);
  outline-offset: 0.125rem;
}
.sample[aria-pressed='true']::after {
  content: '✓';
  margin-left: auto;
}
.sample:focus-visible {
  outline: 0.1875rem solid var(--ink);
  outline-offset: 0.125rem;
}
</style>
