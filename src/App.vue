<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { KIND_LABELS } from '@/fractal.ts';
import { DETECTOR_LABELS } from '@/trace.ts';
import { motionCss, motionPaused, params, patch, usingPatchwork, plateMode, plateStyle, reseed, reset, roles, trace, traced, usingImage } from '@/state.ts';
import ColorPanel from '@/components/ColorPanel.vue';
import PatternPanel from '@/components/PatternPanel.vue';
import OutputPanel from '@/components/OutputPanel.vue';
import ImagePanel from '@/components/ImagePanel.vue';
import SpacingPanel from '@/components/SpacingPanel.vue';
import MotionPanel from '@/components/MotionPanel.vue';

function onKey(e: KeyboardEvent): void {
  if (e.key !== 'r' && e.key !== 'R') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target as HTMLElement | null;
  if (t?.closest('input, textarea, select, [contenteditable="true"]')) return;
  reseed();
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <header class="site-header">
    <p class="brand">Fractal Patterns</p>
    <p class="tagline">Seeded fractal tiles for CSS backgrounds, with contrast you can trust.</p>
  </header>

  <main class="layout">
    <div class="stage">
      <div class="toolbar">
        <button type="button" class="btn primary" :disabled="usingImage" @click="reseed">Shuffle</button>
        <button type="button" class="btn" @click="reset">Reset</button>
        <p class="muted hint">{{ usingImage ? 'Shuffle applies to math patterns only.' : '' }}<template v-if="!usingImage">Or click the pattern, or press <kbd>R</kbd>.</template></p>
      </div>
      <!-- ponytail: pointer shortcut only; the Shuffle button is the keyboard path. -->
      <!-- The hero uses the exported .fp-pattern class itself, so what you see is what you copy. -->
      <component :is="'style'">{{ motionCss }}</component>
      <div class="hero fp-pattern" :class="{ 'fp-paused': motionPaused }" @click="reseed">
        <!-- The plate sits on the wrapper in 'plate' mode, on the paragraph in 'split', nowhere in 'direct'. -->
        <div class="hero-text" :class="{ 'hero-plate': plateMode === 'plate' }" :style="plateMode === 'plate' ? plateStyle : undefined">
          <h1 :style="{ color: roles.text }">Fractal Patterns</h1>
          <p :class="{ 'hero-plate': plateMode === 'split' }" :style="[plateMode === 'split' ? plateStyle : '', { color: roles.text }]">
            <template v-if="usingImage">Pattern: traced from your image, {{ DETECTOR_LABELS[trace.detector] }} edges, {{ traced?.length ?? 0 }} lines.</template><template v-else-if="usingPatchwork">Pattern: patchwork {{ patch.cells }} by {{ patch.cells }}, seed {{ params.seed }}.</template><template v-else>Pattern: {{ KIND_LABELS[params.kind] }}, seed {{ params.seed }}.</template> This text uses your text color and text plate settings, so what you read here is what your visitors will read.
          </p>
        </div>
      </div>
    </div>

    <div class="controls">
      <ColorPanel />
      <PatternPanel />
      <SpacingPanel />
      <ImagePanel />
      <MotionPanel />
      <OutputPanel />
    </div>
  </main>

  <footer class="site-footer">
    <p>The app generates the palettes by rule from a hue and a harmony scheme in the OKLCH color space. Contrast follows WCAG 2.2: <a href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html">1.4.3</a>, <a href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html">1.4.6</a>, <a href="https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html">1.4.11</a>.</p>
  </footer>
</template>
