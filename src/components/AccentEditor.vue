<script setup lang="ts">
// The Edit shapes overlay: the one-tile marker becomes an edit area over the accent shapes of one tile, like the
// Builder's stage. Dragging a shape moves every copy (the tile repeats); a drag is one undo step (state.ts accentDrag).
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { hitStroke } from '@/builder/stage.ts';
import { clampMove, decodeMoves, encodeMoves } from '@/accent-moves.ts';
import { accentDrag, accentDrawn, accentEdit, accentEditing, accentMoves } from '@/state.ts';
import type { Poly, Pt } from '@/patterns/util.ts';

const svgEl = ref<SVGSVGElement | null>(null);
const selected = ref<number | null>(null);
const upp = ref(1); // tile px per screen px
let ro: ResizeObserver | undefined;
onMounted(() => {
  const measure = () => {
    const w = svgEl.value?.getBoundingClientRect().width;
    if (w && accentEdit.value) upp.value = accentEdit.value.width / w;
  };
  measure();
  ro = new ResizeObserver(measure);
  if (svgEl.value) ro.observe(svgEl.value);
});
onBeforeUnmount(() => {
  ro?.disconnect();
  accentDrag.value = null;
});

const centroid = (p: Poly): Pt => {
  const q = p.slice(0, -1);
  return [q.reduce((s, v) => s + v[0], 0) / q.length, q.reduce((s, v) => s + v[1], 0) / q.length];
};
const pathOf = (p: Poly) => `M${p.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L')}Z`;
const shapes = computed(() => {
  const e = accentEdit.value;
  if (!e) return [];
  return e.polys.map((p, i) => {
    const [cx, cy] = centroid(p);
    return { d: pathOf(p), label: `Shape ${i + 1} of ${e.polys.length}, at ${Math.round(cx)}, ${Math.round(cy)}` };
  });
});
const hit = computed(() => hitStroke(0, upp.value, 24)); // at least 24 screen px around the outline

// The shape's current offset from where it was generated: its move, or where Keep clear put it, so it does not jump.
function offsetOf(i: number): Pt {
  const e = accentEdit.value!;
  const a = centroid(e.shapes[i]!);
  const b = centroid(e.polys[i]!);
  return [b[0] - a[0], b[1] - a[1]];
}
function clamped(i: number, d: Pt): Pt {
  const e = accentEdit.value!;
  return clampMove(e.shapes[i]!, d, e.width, e.height);
}
function commit(i: number, d: Pt): void {
  const m = decodeMoves(accentMoves.value);
  m.set(i, clamped(i, d));
  accentMoves.value = encodeMoves(m);
}

function toTile(e: PointerEvent): Pt {
  const m = svgEl.value?.getScreenCTM()?.inverse();
  if (!m) return [e.clientX, e.clientY];
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
  return [p.x, p.y];
}
let drag: { i: number; start: Pt; base: Pt; d: Pt; frame: number } | null = null;
function target(e: PointerEvent): Pt {
  const { i, start, base } = drag!;
  const now = toTile(e);
  let d: Pt = [base[0] + now[0] - start[0], base[1] + now[1] - start[1]];
  const l = accentDrawn.value;
  // On a grid the move snaps to whole cells, so a shape stays on a cell center; Shift moves freely.
  if (l.place === 'grid' && !e.shiftKey) {
    const step = accentEdit.value!.width / l.snap;
    d = [Math.round(d[0] / step) * step, Math.round(d[1] / step) * step];
  }
  return clamped(i, d);
}
function onDown(e: PointerEvent, i: number): void {
  if (e.button !== 0) return;
  selected.value = i;
  (e.currentTarget as SVGElement).focus();
  svgEl.value?.setPointerCapture(e.pointerId);
  const base = offsetOf(i);
  drag = { i, start: toTile(e), base, d: base, frame: 0 };
  e.preventDefault();
}
function onMove(e: PointerEvent): void {
  if (!drag) return;
  drag.d = target(e);
  // One preview update per animation frame.
  if (!drag.frame)
    drag.frame = requestAnimationFrame(() => {
      if (!drag) return;
      drag.frame = 0;
      accentDrag.value = { index: drag.i, d: drag.d };
    });
}
function onUp(e: PointerEvent): void {
  if (!drag) return;
  const { i, base, frame } = drag;
  cancelAnimationFrame(frame);
  const d = target(e);
  drag = null;
  if (Math.hypot(d[0] - base[0], d[1] - base[1]) > 0.05) commit(i, d);
  accentDrag.value = null;
}
function onCancel(): void {
  if (drag) cancelAnimationFrame(drag.frame);
  drag = null;
  accentDrag.value = null;
}

function leave(): void {
  accentEditing.value = false;
  document.getElementById('accent-edit')?.focus();
}
function onKey(e: KeyboardEvent, i: number): void {
  const step = e.shiftKey ? 10 : 1;
  const by = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, Pt>)[e.key];
  if (!by || e.ctrlKey || e.metaKey || e.altKey) return;
  e.preventDefault();
  const o = offsetOf(i);
  commit(i, [o[0] + by[0], o[1] + by[1]]);
}
</script>

<template>
  <svg
    v-if="accentEdit"
    ref="svgEl"
    class="one-tile accent-editor"
    role="group"
    aria-label="Accent shapes, one tile"
    aria-describedby="accent-edit-help"
    :viewBox="`0 0 ${accentEdit.width} ${accentEdit.height}`"
    preserveAspectRatio="none"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onCancel"
    @click.stop
    @mousedown.stop
    @keydown.esc.prevent="leave"
  >
    <path v-for="(s, i) in shapes" :key="`o${i}`" class="accent-editor-outline" :class="{ selected: selected === i }" :d="s.d" vector-effect="non-scaling-stroke" />
    <path
      v-for="(s, i) in shapes"
      :key="`h${i}`"
      class="accent-editor-hit"
      :d="s.d"
      :stroke-width="hit"
      tabindex="0"
      role="button"
      :aria-label="s.label"
      @pointerdown="onDown($event, i)"
      @focus="selected = i"
      @keydown="onKey($event, i)"
    />
  </svg>
</template>
