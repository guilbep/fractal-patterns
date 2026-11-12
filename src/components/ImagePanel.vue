<script setup lang="ts">
import { ref } from 'vue';
import { DETECTORS, DETECTOR_LABELS } from '@/trace.ts';
import { RESOLUTIONS, image, loadImage, rawBytes, removeImage, source, trace, traced, usingImage } from '@/state.ts';

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

    <!-- The label is the drop zone; the native file input inside it gives the keyboard path. -->
    <label class="drop" :class="{ dragging }" @dragover.prevent="dragging = true" @dragleave="dragging = false" @drop.prevent="onDrop">
      <span class="drop-title">Choose an image or drop it here</span>
      <input type="file" accept="image/*" @change="onPick">
    </label>
    <p class="error" role="alert">{{ error }}</p>

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
            <option v-for="d in DETECTORS" :key="d" :value="d">{{ DETECTOR_LABELS[d] }}</option>
          </select>
        </div>
        <div class="field">
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
          <label for="resolution">Resolution <output for="resolution">{{ trace.resolution }} px</output></label>
          <select id="resolution" v-model.number="trace.resolution">
            <option v-for="r in RESOLUTIONS" :key="r" :value="r">{{ r }} px on the longer edge</option>
          </select>
        </div>
      </div>

      <dl class="stats">
        <div><dt>Lines kept</dt><dd>{{ traced?.length ?? 0 }}</dd></div>
        <div><dt>SVG size</dt><dd>{{ usingImage ? `${rawBytes.toLocaleString('en')} bytes` : 'not in use' }}</dd></div>
      </dl>
      <p v-if="traced && traced.length === 0" class="pattern-warn">The trace kept no line. Lower the threshold or the minimum line length.</p>
    </template>

    <ul class="image-notes muted">
      <li>A traced tile repeats without a visible seam only when the source image itself repeats.</li>
      <li>Traced tiles are heavier than math patterns. Watch the CO2 line and raise Detail or Minimum line length to lighten the tile.</li>
    </ul>
  </section>
</template>
