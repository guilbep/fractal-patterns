<script setup lang="ts">
import { ref } from 'vue';
import { fileName, params, svgHref, usingImage } from '@/state.ts';
import { exportHtml } from '@/export.ts';
import { copyText } from '@/clipboard.ts';
import PrecisionLoupe from '@/components/PrecisionLoupe.vue';
import { GRADE_SCALE, weightGrade } from '@/co2.ts';
import { altBytes, exportGzipBytes, altFormat, altGzip, altOpen, altReason, altText, cssBytes, exportScript, exportText, footprint, gzipped, scriptBytes, sizeBreakdown, scriptCount, scriptEvent, scriptOn } from '@/state-export.ts';

const sizeText = (pick: (g: { css: number; script: number }) => string) =>
  gzipped.value === null ? 'computing' : gzipped.value === 'unknown' ? 'size unknown' : pick(gzipped.value);
const bytes = (n: number) => `${n.toLocaleString('en')} bytes`;

const html = exportHtml();
const emit = defineEmits<{ depth: [] }>();

const copyStatus = ref('');
let timer: ReturnType<typeof setTimeout> | undefined;

async function copy(text: string): Promise<void> {
  copyStatus.value = (await copyText(text)) ? 'Copied' : 'Copy failed. Select the code and copy it by hand.';
  clearTimeout(timer);
  timer = setTimeout(() => (copyStatus.value = ''), 2500);
}
</script>

<template>
  <section class="panel" aria-labelledby="perf-h">
    <h2 id="perf-h" tabindex="-1">Performance settings</h2>
    <p class="lede">Fewer decimals and less depth make a lighter tile. <button type="button" class="link-btn" @click="emit('depth')">Depth</button> is set under Pattern.</p>
    <div class="field">
      <label for="precision">Coordinate precision <output for="precision">{{ params.precision }} {{ params.precision === 1 ? 'decimal' : 'decimals' }}</output></label>
      <input id="precision" v-model.number="params.precision" type="range" min="0" max="3" step="1">
    </div>
    <PrecisionLoupe />
    <dl class="stats">
      <div v-for="line in sizeBreakdown" :key="line" class="wide"><dt>{{ line.slice(0, line.indexOf(':')) }}</dt><dd>{{ line.slice(line.indexOf(':') + 2) }}</dd></div>
      <div v-if="exportGzipBytes !== null" class="wide"><dt>Weight grade</dt><dd>{{ weightGrade(exportGzipBytes).grade }}. {{ GRADE_SCALE }}</dd></div>
      <div class="wide"><dt>Footprint</dt><dd>{{ sizeText(() => footprint ?? '') }}</dd></div>
    </dl>
    <p class="muted">A rough estimate: a straight line from the compressed size, calibrated on one websitecarbon.com measurement of <a href="https://pierreguilbert.com">pierreguilbert.com</a>. It counts one transfer of the exported CSS, and of the script when you add it. It does not count the rest of your page, browser caching (a repeat visit transfers nothing), or the energy to draw the pattern on the visitor's device.</p>
  </section>

  <section class="panel" aria-labelledby="out-h">
    <h2 id="out-h">Use it</h2>
    <div class="out-actions">
      <a class="btn" :href="svgHref" :download="fileName">Download SVG</a>
      <span class="copy-status" role="status" aria-live="polite">{{ copyStatus }}</span>
    </div>

    <div class="block">
      <div class="block-head">
        <h3 id="out-css">CSS</h3>
        <button type="button" class="btn primary" @click="copy(exportText)">Copy CSS</button>
      </div>
      <pre class="code" tabindex="0" aria-labelledby="out-css"><code>{{ exportText }}</code></pre>
    </div>

    <div class="block">
      <div class="block-head">
        <h3 id="out-html">HTML</h3>
        <button type="button" class="btn" @click="copy(html)">Copy HTML</button>
      </div>
      <pre class="code" tabindex="0" aria-labelledby="out-html"><code>{{ html }}</code></pre>
    </div>

    <label class="radio"><input type="checkbox" :checked="scriptOn && !usingImage" :disabled="usingImage" @change="scriptOn = ($event.target as HTMLInputElement).checked" :aria-describedby="usingImage ? 'script-note' : undefined"> Add a script that changes the tile</label>
    <p v-if="usingImage" id="script-note" class="muted out-note">A traced image has one tile.</p>
    <template v-if="scriptOn && !usingImage">
      <div class="field">
        <label for="script-event">When</label>
        <select id="script-event" v-model="scriptEvent">
          <option value="click">On each click</option>
          <option value="load">On each page load</option>
        </select>
      </div>
      <div class="field">
        <label for="script-count">Variants <output for="script-count">{{ scriptCount }}</output></label>
        <input id="script-count" v-model.number="scriptCount" type="range" min="2" max="5" step="1">
      </div>
      <p class="muted out-note">The script holds the variants as data, so each variant adds bytes.</p>
      <div class="block">
        <div class="block-head">
          <h3 id="out-js">Script</h3>
          <button type="button" class="btn" @click="copy(exportScript)">Copy script</button>
        </div>
        <pre class="code" tabindex="0" aria-labelledby="out-js"><code>{{ exportScript }}</code></pre>
      </div>
    </template>

    <p class="muted out-note">CSS: {{ cssBytes.toLocaleString('en') }} bytes<template v-if="exportScript">. Script: {{ scriptBytes.toLocaleString('en') }} bytes</template>.</p>

    <details class="alt" @toggle="altOpen = ($event.target as HTMLDetailsElement).open">
      <summary>Other formats (experimental)</summary>
      <p v-if="altReason" id="alt-unavailable" class="muted out-note">Not available for this design: {{ altReason }}</p>
      <template v-else>
        <div class="field">
          <label for="alt-format">Format</label>
          <select id="alt-format" v-model="altFormat">
            <option value="canvas">Canvas script</option>
            <option value="worklet">CSS Paint worklet (Chromium only)</option>
          </select>
        </div>
        <p id="alt-hint" class="muted out-note">
          <template v-if="altFormat === 'canvas'">Draws the tile with JavaScript on a canvas. It is larger than the CSS export and needs JavaScript. Use it only as a base for a pattern that changes or never repeats.</template>
          <template v-else>An experiment. It works in Chrome and Edge only. Other browsers show the fallback background color. Save the worklet as fp-pattern.worklet.js and register it in the page with <code>if ('paintWorklet' in CSS) CSS.paintWorklet.addModule('fp-pattern.worklet.js');</code></template>
        </p>
        <div class="block">
          <div class="block-head">
            <h3 id="alt-h">Code</h3>
            <button type="button" class="btn" @click="copy(altText)">Copy</button>
          </div>
          <textarea id="alt-out" class="code" readonly rows="12" aria-labelledby="alt-h" :value="altText"></textarea>
        </div>
        <p id="alt-size" class="muted out-note">{{ bytes(altBytes) }}, {{ altGzip === null ? 'computing' : altGzip === 'unknown' ? 'size unknown' : altGzip.toLocaleString('en') }} gzipped, against {{ bytes(cssBytes) }} for the CSS export.</p>
      </template>
    </details>
  </section>
</template>

<style scoped>
.block { margin-bottom: var(--s3); min-inline-size: 0; }
.block-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--s2); margin-bottom: var(--s2); }
.block-head h3 { margin: 0; }
.code { max-inline-size: 100%; }
.alt { margin-top: var(--s3); }
.alt summary { cursor: pointer; }
textarea.code { inline-size: 100%; font-family: inherit; resize: vertical; }
</style>
