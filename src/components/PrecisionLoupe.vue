<script setup lang="ts">
import { computed, ref } from 'vue';
import { accentOut, aspect, curvesOn, params, roles, tileScene } from '@/state.ts';
import { exportGzipBytes, gzipped } from '@/state-export.ts';
import { extraPath } from '@/fractal.ts';
import { badgeText } from '@/co2.ts';
import { busiestRegion, clampRegion, loupeView, type Region } from '@/precision-loupe.ts';

const THUMB = 96; // px, the full-tile thumbnail's width

const scene = computed(() => tileScene.value);
// The tile's lines: the stroke layer (fills sit under it, the accent above).
const polys = computed(() => scene.value.layers.find((l) => l.paint.mode === 'stroke')?.polys ?? []);
const picked = ref<{ x: number; y: number } | null>(null);
const region = computed<Region>(() => {
  const { width, height } = scene.value;
  const auto = busiestRegion(polys.value, width, height);
  return picked.value ? clampRegion({ ...picked.value, w: auto.w }, width, height) : auto;
});
const view = computed(() => loupeView(polys.value, scene.value.width, params.precision, region.value));
const size = computed(() => badgeText(gzipped.value === 'unknown' ? 'unknown' : exportGzipBytes.value).size);
const readout = computed(() => `Precision ${params.precision}: ${size.value} · lines move up to ${view.value.maxShift.toFixed(2)} px`);
const arcs = computed(() => aspect.value !== 1 && extraPath(params) !== '');
// The whole tile for the thumbnail, at the export's finest precision.
const thumbLine = computed(() => loupeView(polys.value, scene.value.width, 3, { x: 0, y: 0, w: Math.max(scene.value.width, scene.value.height) }).exact);

// Drag the marker on the thumbnail: the region centres on the pointer.
const thumb = ref<SVGSVGElement | null>(null);
function moveTo(e: PointerEvent): void {
  const box = thumb.value?.getBoundingClientRect();
  if (!box || box.width === 0) return;
  const k = scene.value.width / box.width;
  const w = region.value.w;
  picked.value = { x: (e.clientX - box.left) * k - w / 2, y: (e.clientY - box.top) * k - w / 2 };
}
function down(e: PointerEvent): void {
  (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  moveTo(e);
}
function drag(e: PointerEvent): void {
  if (e.buttons) moveTo(e);
}
const STEPS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
function key(e: KeyboardEvent): void {
  const step = STEPS[e.key];
  if (!step) return;
  e.preventDefault();
  const { x, y, w } = region.value;
  const d = e.shiftKey ? w : w / 4;
  picked.value = { x: x + step[0] * d, y: y + step[1] * d };
}
const where = computed(() => `Loupe region at x ${Math.round(region.value.x)}, y ${Math.round(region.value.y)} px. Arrow keys move it.`);
</script>

<template>
  <div class="loupe">
    <svg
      class="loupe-view"
      width="200"
      height="200"
      :viewBox="`${region.x} ${region.y} ${region.w} ${region.w}`"
      role="img"
      :aria-label="`Loupe, ${Math.round(200 / region.w)} times: exact lines thin, rounded lines thick. ${readout}`"
    >
      <rect :x="region.x" :y="region.y" :width="region.w" :height="region.w" :fill="roles.background" />
      <path class="loupe-exact" :d="view.exact" fill="none" />
      <path class="loupe-rounded" :d="view.rounded" fill="none" :stroke="roles.pattern" />
    </svg>
    <div class="loupe-side">
      <svg
        ref="thumb"
        class="loupe-thumb"
        :width="THUMB"
        :height="(THUMB * scene.height) / scene.width"
        :viewBox="`0 0 ${scene.width} ${scene.height}`"
        tabindex="0"
        role="slider"
        aria-label="Loupe region"
        :aria-valuemin="0"
        :aria-valuemax="Math.round(scene.width)"
        :aria-valuenow="Math.round(region.x)"
        :aria-valuetext="where"
        @pointerdown="down"
        @pointermove="drag"
        @keydown="key"
      >
        <rect :width="scene.width" :height="scene.height" :fill="roles.background" />
        <path :d="thumbLine" fill="none" :stroke="roles.pattern" class="loupe-thin" />
        <rect class="loupe-marker" :x="region.x" :y="region.y" :width="region.w" :height="region.w" fill="none" />
      </svg>
      <p class="loupe-readout">{{ readout }}</p>
      <p v-if="arcs" class="muted loupe-note">Arcs not shown.</p>
      <p v-if="curvesOn" class="muted loupe-note">Smooth curves not shown: the loupe draws the lines.</p>
      <p v-if="accentOut" class="muted loupe-note">The accent layer is not shown.</p>
    </div>
  </div>
</template>
