<script setup lang="ts">
// The tile editor: the real repeat in SVG DOM, with select, drag (wrapping across
// the tile edges), one turn-and-resize handle, and keyboard control.
import { computed, ref } from 'vue';
import { instanceMatrix, repeatCell, studioInstances } from '@/studio/model.ts';
import { duplicateItem, moveBy, owners, removeItem, reorder, toStudio, updateItem } from './design.ts';
import { commit, design, preview, selected, selectedId } from './store.ts';
import type { Design } from './types.ts';
import { handleTransform, viewBox } from './stage.ts';

const svgEl = ref<SVGSVGElement | null>(null);

const studio = computed(() => toStudio(design.value, false));
const cell = computed(() => repeatCell(studio.value));
const box = computed(() => viewBox(cell.value.width, cell.value.height));
const instances = computed(() => studioInstances(studio.value));
const ownerIds = computed(() => owners(design.value).map((k) => design.value.items[k]?.id ?? -1));

const motifs = computed(() => [...new Set(instances.value.map((i) => i.motif))].map((m) => ({ m, ...studio.value.motifs[m]! })));

// ponytail: every item is drawn 9 times as real DOM nodes, fine up to about 300 items;
// the upgrade path is one <use> of a cell group plus geometric hit testing.
const drawn = computed(() => {
  const s = studio.value;
  const { width: cw, height: ch } = cell.value;
  const out = [];
  for (const oy of [-1, 0, 1])
    for (const ox of [-1, 0, 1])
      for (const [k, i] of instances.value.entries()) {
        const m = s.motifs[i.motif]!;
        const layer = s.layers[i.layer]!;
        const [a, b, c, d, e, f] = instanceMatrix(i, m.box);
        const stroke = m.paint === 'stroke';
        out.push({
          key: `${ox},${oy},${k}`,
          href: `#bs-m${i.motif}`,
          item: ownerIds.value[i.layer],
          transform: `matrix(${a} ${b} ${c} ${d} ${e + ox * cw} ${f + oy * ch})`,
          fill: stroke ? 'none' : layer.color,
          stroke: stroke ? layer.color : undefined,
          // The matrix scales the stroke too: divide so the line is strokeWidth tile units wide.
          strokeWidth: stroke ? design.value.strokeWidth / Math.abs(i.sx || 1) : undefined,
          opacity: layer.opacity,
        });
      }
  return out;
});

const veil = computed(() => {
  const { width: w, height: h } = cell.value;
  return `M${-w / 2} ${-h / 2}h${2 * w}v${2 * h}h${-2 * w}z M0 0h${w}v${h}H0z`;
});

/** The selected item's outlines: its instances inside or touching the central cell. */
const outlines = computed(() => {
  const it = selected.value;
  if (!it) return [];
  const st = design.value.stamps[it.stamp];
  if (!st) return [];
  const side = it.scale * st.box;
  const r = (side * Math.SQRT2) / 2;
  const layer = ownerIds.value.indexOf(it.id);
  const { width: w, height: h } = cell.value;
  return instances.value
    .filter((i) => i.layer === layer && i.x + r >= 0 && i.x - r <= w && i.y + r >= 0 && i.y - r <= h)
    .map((i) => ({ x: i.x, y: i.y, side, rotate: i.rotate }));
});

const handle = computed(() => {
  const o = outlines.value[0];
  if (!o) return null;
  const t = (o.rotate * Math.PI) / 180;
  const q = o.side / 2;
  return {
    cx: o.x + Math.cos(t) * q + Math.sin(t) * q,
    cy: o.y + Math.sin(t) * q - Math.cos(t) * q,
    center: [o.x, o.y] as [number, number],
    r: Math.max(cell.value.width, cell.value.height) * 0.02,
  };
});

function toSvg(e: PointerEvent): [number, number] {
  const m = svgEl.value?.getScreenCTM()?.inverse();
  if (!m) return [e.clientX, e.clientY];
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
  return [p.x, p.y];
}

type Drag = { kind: 'move' | 'turn'; id: number; start: [number, number]; startDesign: Design; center: [number, number]; changed: boolean };
let drag: Drag | null = null;

function onDown(e: PointerEvent): void {
  if (e.button !== 0) return;
  const target = e.target as Element;
  const start = toSvg(e);
  const startDesign = design.value;
  if (target.closest('[data-handle]') && selected.value && handle.value) {
    drag = { kind: 'turn', id: selected.value.id, start, startDesign, center: handle.value.center, changed: false };
  } else {
    const hit = target.closest('[data-item]');
    const id = hit ? Number(hit.getAttribute('data-item')) : NaN;
    if (!Number.isFinite(id) || id < 0) {
      selectedId.value = null;
      return;
    }
    selectedId.value = id;
    drag = { kind: 'move', id, start, startDesign, center: start, changed: false };
  }
  svgEl.value?.setPointerCapture(e.pointerId);
  svgEl.value?.focus();
  e.preventDefault();
}

function onMove(e: PointerEvent): void {
  if (!drag) return;
  const now = toSvg(e);
  if (drag.kind === 'move') {
    const dx = now[0] - drag.start[0];
    const dy = now[1] - drag.start[1];
    drag.changed = Math.hypot(dx, dy) > 0.5;
    preview(moveBy(drag.startDesign, drag.id, dx, dy));
  } else {
    const it = drag.startDesign.items.find((t) => t.id === drag!.id);
    if (!it) return;
    const next = handleTransform(drag.center, drag.start, now, it.rotate, it.scale, e.shiftKey ? 15 : 0);
    drag.changed = next.rotate !== it.rotate || next.scale !== it.scale;
    preview(updateItem(drag.startDesign, drag.id, next));
  }
}

function onUp(e: PointerEvent): void {
  if (!drag) return;
  if (drag.changed) commit(design.value);
  drag = null;
  if (svgEl.value?.hasPointerCapture(e.pointerId)) svgEl.value.releasePointerCapture(e.pointerId);
}

function onKey(e: KeyboardEvent): void {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const it = selected.value;
  if (!it) return;
  const d = design.value;
  const step = e.shiftKey ? 10 : 1;
  const turn = (by: number): Design => updateItem(d, it.id, { rotate: it.rotate + by });
  const size = (by: number): Design => updateItem(d, it.id, { scale: it.scale * by });
  const actions: Record<string, () => Design | null> = {
    ArrowLeft: () => moveBy(d, it.id, -step, 0),
    ArrowRight: () => moveBy(d, it.id, step, 0),
    ArrowUp: () => moveBy(d, it.id, 0, -step),
    ArrowDown: () => moveBy(d, it.id, 0, step),
    Delete: () => removeItem(d, it.id),
    Backspace: () => removeItem(d, it.id),
    d: () => duplicateItem(d, it.id),
    '[': () => turn(-15),
    ']': () => turn(15),
    '-': () => size(0.9),
    '+': () => size(1 / 0.9),
    '=': () => size(1 / 0.9),
    f: () => updateItem(d, it.id, { flip: !it.flip }),
    PageUp: () => reorder(d, it.id, 'up'),
    PageDown: () => reorder(d, it.id, 'down'),
    Escape: () => {
      selectedId.value = null;
      return null;
    },
  };
  const action = actions[e.key];
  if (!action) return;
  e.preventDefault();
  const next = action();
  if (!next) return;
  commit(next);
  if (e.key === 'd') {
    const i = next.items.findIndex((t) => t.id === it.id);
    selectedId.value = next.items[i + 1]?.id ?? it.id;
  }
}
</script>

<template>
  <div class="stage-editor">
    <svg
      ref="svgEl"
      class="tile-editor"
      xmlns="http://www.w3.org/2000/svg"
      :viewBox="box"
      preserveAspectRatio="xMidYMid meet"
      tabindex="0"
      role="application"
      aria-label="Tile editor. Arrow keys move the selected shape."
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @keydown="onKey"
    >
      <defs>
        <path v-for="m in motifs" :id="`bs-m${m.m}`" :key="m.m" :d="m.d" :fill-rule="m.evenodd ? 'evenodd' : undefined" />
      </defs>
      <rect v-if="design.background" :x="-cell.width / 2" :y="-cell.height / 2" :width="2 * cell.width" :height="2 * cell.height" :fill="design.background" />
      <use
        v-for="u in drawn"
        :key="u.key"
        :href="u.href"
        :transform="u.transform"
        :data-item="u.item"
        :fill="u.fill"
        :stroke="u.stroke"
        :stroke-width="u.strokeWidth"
        :stroke-linecap="u.stroke ? 'round' : undefined"
        :stroke-linejoin="u.stroke ? 'round' : undefined"
        :opacity="u.opacity"
      />
      <path class="veil" :d="veil" fill-rule="evenodd" />
      <rect class="cell-edge" x="0" y="0" :width="cell.width" :height="cell.height" />
      <rect
        v-for="(o, k) in outlines"
        :key="k"
        class="sel"
        :x="-o.side / 2"
        :y="-o.side / 2"
        :width="o.side"
        :height="o.side"
        :transform="`translate(${o.x} ${o.y}) rotate(${o.rotate})`"
      />
      <circle v-if="handle" class="handle" data-handle :cx="handle.cx" :cy="handle.cy" :r="handle.r" />
    </svg>
    <p class="stage-hint">Drag to move. Drag the round handle to turn and resize. Shapes that cross an edge come back on the other side.</p>
  </div>
</template>

<style scoped>
.stage-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.tile-editor {
  flex: 1;
  width: 100%;
  min-height: 20rem;
  touch-action: none;
  user-select: none;
  cursor: default;
}
.tile-editor:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}
.tile-editor use {
  cursor: move;
}
.veil {
  fill: rgba(255, 255, 255, 0.55);
  pointer-events: none;
}
.cell-edge {
  fill: none;
  stroke: #333;
  stroke-dasharray: 6 4;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}
.sel {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}
.handle {
  fill: #fff;
  stroke: var(--accent);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
  cursor: grab;
}
.stage-hint {
  margin: 0.5rem 0 0;
  font-size: 0.875rem;
}
</style>
