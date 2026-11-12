<script setup lang="ts">
import { ref } from 'vue';
import { cssOut, fileName, footprint, gzipBytes, motionStatic, params, plateMode, rawBytes, svgHref } from '@/state.ts';

const copyStatus = ref('');
let timer: ReturnType<typeof setTimeout> | undefined;

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(cssOut.value);
    copyStatus.value = 'Copied';
  } catch {
    copyStatus.value = 'Copy failed. Select the code and copy it by hand.';
  }
  clearTimeout(timer);
  timer = setTimeout(() => (copyStatus.value = ''), 2500);
}
</script>

<template>
  <section class="panel" aria-labelledby="perf-h">
    <h2 id="perf-h">Performance settings</h2>
    <p class="lede">Fewer decimals and less depth make a lighter tile. <a href="#depth">Depth</a> is set under Pattern.</p>
    <div class="field">
      <label for="precision">Coordinate precision <output for="precision">{{ params.precision }} {{ params.precision === 1 ? 'decimal' : 'decimals' }}</output></label>
      <input id="precision" v-model.number="params.precision" type="range" min="0" max="3" step="1">
    </div>
    <dl class="stats">
      <div><dt>SVG size</dt><dd>{{ rawBytes.toLocaleString('en') }} bytes</dd></div>
      <div><dt>Gzipped</dt><dd>{{ gzipBytes === null ? 'computing' : `${gzipBytes.toLocaleString('en')} bytes` }}</dd></div>
      <div class="wide"><dt>Footprint</dt><dd>{{ footprint ?? 'computing' }}</dd></div>
    </dl>
    <p class="muted">A linear estimate from the gzipped size, the same model as <a href="https://pierreguilbert.com">pierreguilbert.com</a>, calibrated on one websitecarbon.com measurement. It counts only the pattern tile, not the rest of your page.</p>
  </section>

  <section class="panel" aria-labelledby="out-h">
    <h2 id="out-h">Use it</h2>
    <div class="out-actions">
      <button type="button" class="btn primary" @click="copy">Copy CSS</button>
      <a class="btn" :href="svgHref" :download="fileName">Download SVG</a>
      <span class="copy-status" role="status" aria-live="polite">{{ copyStatus }}</span>
    </div>
    <pre class="code" tabindex="0" aria-label="Generated CSS"><code>{{ cssOut }}</code></pre>
    <p v-if="!motionStatic" class="muted out-note">Put the class <code>fp-pattern</code> on the element that shows the pattern.</p>
    <p v-if="plateMode !== 'direct'" class="muted out-note">Put the class <code>fp-plate</code> on the element that holds the text.</p>
  </section>
</template>
