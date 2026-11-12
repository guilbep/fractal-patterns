<script setup lang="ts">
import { computed } from 'vue';
import { co2Mg, DRIFT_WATTS, driftMgPerMinute, driftMultiple, GRID_G_PER_KWH } from '@/co2.ts';
import { MOTION_NONE } from '@/motion.ts';
import { motion, motionPaused } from '@/state.ts';
import { exportGzipBytes } from '@/state-export.ts';

const perMinute = Number(driftMgPerMinute().toPrecision(1));
// ponytail: "many" from 1000 up, where a whole number reads as false precision.
const multiple = computed(() => {
  const m = Math.round(driftMultiple(co2Mg(exportGzipBytes.value ?? 0)));
  return m >= 1000 ? 'many' : String(m);
});

const DRIFTS = [
  ['none', 'None'],
  ['x', 'Horizontal'],
  ['y', 'Vertical'],
  ['xy', 'Diagonal'],
] as const;

function resetMotion(): void {
  Object.assign(motion, MOTION_NONE);
  motionPaused.value = false;
}
</script>

<template>
  <section class="panel" aria-labelledby="motion-h">
    <h2 id="motion-h">Transform and motion</h2>
    <p class="lede">Rotate, scale, skew, and tilt are static transforms. They cost almost nothing.</p>

    <div class="fields">
      <div class="field">
        <label for="m-rotate">Rotate <output for="m-rotate">{{ motion.rotate }}°</output></label>
        <input id="m-rotate" v-model.number="motion.rotate" type="range" min="-180" max="180" step="1">
      </div>
      <div class="field">
        <label for="m-scale">Scale <output for="m-scale">{{ motion.scale.toFixed(2) }}×</output></label>
        <input id="m-scale" v-model.number="motion.scale" type="range" min="0.5" max="3" step="0.05">
      </div>
      <div class="field">
        <label for="m-skew">Skew <output for="m-skew">{{ motion.skew }}°</output></label>
        <input id="m-skew" v-model.number="motion.skew" type="range" min="-45" max="45" step="1">
      </div>
      <div class="field">
        <label for="m-tilt">Perspective tilt <output for="m-tilt">{{ motion.tilt }}°</output></label>
        <input id="m-tilt" v-model.number="motion.tilt" type="range" min="0" max="70" step="1">
      </div>
      <div class="field">
        <label for="m-drift">Drift <output for="m-drift">{{ DRIFTS.find(([v]) => v === motion.drift)?.[1] }}</output></label>
        <select id="m-drift" v-model="motion.drift">
          <option v-for="[v, label] in DRIFTS" :key="v" :value="v">{{ label }}</option>
        </select>
      </div>
      <div class="field">
        <label for="m-speed">Speed <output for="m-speed">{{ motion.speed }} s per tile</output></label>
        <input id="m-speed" v-model.number="motion.speed" type="range" min="2" max="30" step="1" :disabled="motion.drift === 'none'">
      </div>
    </div>

    <div class="out-actions">
      <button v-if="motion.drift !== 'none'" type="button" class="btn" :aria-pressed="motionPaused" @click="motionPaused = !motionPaused">Pause motion</button>
      <button type="button" class="btn" @click="resetMotion">Reset transform</button>
    </div>

    <ul class="image-notes">
      <li v-if="motion.drift === 'none'">Drift repaints the pattern layer on every frame, which uses energy on your visitor's device.</li>
      <li v-else>
        Drift repaints the pattern layer on every frame.<template v-if="exportGzipBytes !== null"> Order of magnitude: about {{ perMinute }} mg CO₂ for each minute a visitor watches. That is about {{ multiple }} times the transfer footprint of the exported CSS and script. This assumes {{ DRIFT_WATTS }} W of extra power and an average grid ({{ GRID_G_PER_KWH }} g CO₂ per kWh). Your visitors' devices and grids differ.</template>
      </li>
      <li>Content that moves for more than 5 seconds needs a pause control (<a href="https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html">WCAG 2.2.2</a>). The exported CSS includes a paused state: add the class <code>fp-paused</code>.</li>
      <li>The exported CSS stops the drift for visitors who ask for reduced motion.</li>
    </ul>
  </section>
</template>
