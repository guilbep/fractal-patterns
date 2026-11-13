<script setup lang="ts">
// The tile editor: the real repeat in SVG DOM, with select, drag (wrapping across
// the tile edges), one turn-and-resize handle, and keyboard control.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { instanceMatrix, passInstances, repeatCell } from '@/studio/model.ts';
import { duplicateMany, moveBy, moveMany, owners, removeMany, reorderMany, toStudio, updateItem, updateMany } from './design.ts';
import { commit, design, preview, select, selectAll, selected, selectedId, selectedIds, toggleSelect } from './store.ts';
import type { Design, Item } from './types.ts';
import { cellOrder, handleTransform, hitStroke, itemsInRect, snapPoint, stepSelection, viewBox } from './stage.ts';
import UiSegmented from '@/components/UiSegmented.vue';
import UiSwitch from '@/components/UiSwitch.vue';

// Snap to grid: a stage setting, not part of the design or of undo.
const SNAP_KEY = 'fp-builder-snap-v1';
const GRIDS = [4, 8, 12, 16];
const GRID_OPTIONS = GRIDS.map((g) => ({ value: g, label: String(g) }));
function loadSnap(): { on: boolean; parts: number } {
  try {
    const v = JSON.parse(localStorage.getItem(SNAP_KEY) ?? 'null');
    return { on: v?.on === true, parts: GRIDS.includes(v?.parts) ? v.parts : 8 };
  } catch {
    return { on: false, parts: 8 };
  }
}
const saved = loadSnap();
const snapOn = ref(saved.on);
const parts = ref(saved.parts);
watch([snapOn, parts], () => {
  try {
    localStorage.setItem(SNAP_KEY, JSON.stringify({ on: snapOn.value, parts: parts.value }));
  } catch {
    // ponytail: no storage, the setting lasts for this page only.
  }
});

const svgEl = ref<SVGSVGElement | null>(null);
const svgPixels = ref(0);

// The drawn width of the stage, for the hit area of line shapes. BuilderApp sets --bar-h.
const sizes = new ResizeObserver(() => (svgPixels.value = svgEl.value?.clientWidth ?? 0));
onMounted(() => svgEl.value && sizes.observe(svgEl.value));
onBeforeUnmount(() => sizes.disconnect());

const studio = computed(() => toStudio(design.value, false));
const cell = computed(() => repeatCell(studio.value));
/** Tile units per screen pixel, for the hit area of line shapes. */
const unitsPerPixel = computed(() => (svgPixels.value ? (2 * cell.value.width) / svgPixels.value : 1));
const box = computed(() => viewBox(cell.value.width, cell.value.height));
const tagged = computed(() => passInstances(studio.value));
const instances = computed(() => tagged.value.map((p) => p.i));
const ownerIdx = computed(() => owners(design.value));
const ownerIds = computed(() => ownerIdx.value.map((k) => design.value.items[k]?.id ?? -1));
/** Which mirror copy an instance is: flipped in x (against the item's own flip) and in y. */
function mirrorOf(i: { layer: number; sx: number; sy: number }): { fx: boolean; fy: boolean } {
  const it = design.value.items[ownerIdx.value[i.layer] ?? -1];
  return { fx: i.sx < 0 !== (it?.flip ?? false), fy: i.sy < 0 };
}

const motifs = computed(() => [...new Set(instances.value.map((i) => i.motif))].map((m) => ({ m, ...studio.value.motifs[m]! })));

// ponytail: every item is drawn 9 times as real DOM nodes (18 for a line shape, which adds a
// wide invisible hit line under each copy), fine up to about 150 items;
// the upgrade path is one <use> of a cell group plus geometric hit testing.
const drawn = computed(() => {
  const s = studio.value;
  const { width: cw, height: ch } = cell.value;
  const out = [];
  // The pass is the outermost loop, as in the export, then the rows top to bottom: a row covers the row above.
  const passes = s.overlap === 'down' ? [-1, 0, 1] : [0];
  for (const pass of passes)
    for (const [ox, oy] of cellOrder())
      for (const [k, { i, pass: p }] of tagged.value.entries()) {
        if (p !== pass) continue;
        const m = s.motifs[i.motif]!;
        const layer = s.layers[i.layer]!;
        const [a, b, c, d, e, f] = instanceMatrix(i, m.box);
        const stroke = m.paint === 'stroke';
        const sx = Math.abs(i.sx || 1);
        const { fx, fy } = mirrorOf(i);
        out.push({
          fx: fx ? 1 : 0,
          fy: fy ? 1 : 0,
          key: `${ox},${oy},${k}`,
          href: `#bs-m${i.motif}`,
          item: ownerIds.value[i.layer],
          transform: `matrix(${a} ${b} ${c} ${d} ${e + ox * cw} ${f + oy * ch})`,
          fill: stroke ? 'none' : layer.color,
          stroke: stroke ? layer.color : undefined,
          // The matrix scales the stroke too: divide so the line is strokeWidth tile units wide.
          strokeWidth: stroke ? design.value.strokeWidth / sx : undefined,
          hitWidth: stroke ? hitStroke(design.value.strokeWidth, unitsPerPixel.value) / sx : undefined,
          opacity: layer.opacity,
        });
      }
  return out;
});

/** The grid points inside the central cell, in tile steps, while snap is on. */
const dots = computed(() => {
  if (!snapOn.value) return [];
  const sx = design.value.width / parts.value;
  const sy = design.value.height / parts.value;
  const { width: w, height: h } = cell.value;
  const out: [number, number][] = [];
  for (let x = 0; x < w - 1e-9; x += sx) for (let y = 0; y < h - 1e-9; y += sy) out.push([x, y]);
  return out;
});

const sizeStyle = computed(() => ({ '--rw': cell.value.width, '--rh': cell.value.height }));

const veil = computed(() => {
  const { width: w, height: h } = cell.value;
  return `M${-w / 2} ${-h / 2}h${2 * w}v${2 * h}h${-2 * w}z M0 0h${w}v${h}H0z`;
});

/** The selected items' outlines: every copy in the visible area, the central cell first (the handle sits on the first). */
const outlines = computed(() => {
  const { width: w, height: h } = cell.value;
  const offsets = [[0, 0], ...cellOrder().filter(([a, b]) => a || b)];
  return selectedIds.value.flatMap((id) => {
    const it = design.value.items.find((t) => t.id === id);
    const st = it && design.value.stamps[it.stamp];
    if (!it || !st) return [];
    const side = it.scale * st.box;
    const r = (side * Math.SQRT2) / 2;
    const layer = ownerIds.value.indexOf(it.id);
    return offsets.flatMap(([ox, oy]) =>
      instances.value
        .filter((i) => i.layer === layer)
        .map((i) => ({ x: i.x + ox! * w, y: i.y + oy! * h, side, rotate: i.rotate, ...mirrorOf(i) }))
        .filter((o) => o.x + r >= -w / 2 && o.x - r <= 1.5 * w && o.y + r >= -h / 2 && o.y - r <= 1.5 * h),
    );
  });
});

/** The turn handle: only with exactly one selected item. */
const handle = computed(() => {
  const o = selectedIds.value.length === 1 ? outlines.value[0] : undefined;
  if (!o) return null;
  const t = (o.rotate * Math.PI) / 180;
  const q = o.side / 2;
  return {
    cx: o.x + Math.cos(t) * q + Math.sin(t) * q,
    cy: o.y + Math.sin(t) * q - Math.cos(t) * q,
    center: [o.x, o.y] as [number, number],
    // A copy flipped in one axis turns the other way.
    mirrored: o.fx !== o.fy,
    r: Math.max(cell.value.width, cell.value.height) * 0.02,
  };
});

function toSvg(e: PointerEvent): [number, number] {
  const m = svgEl.value?.getScreenCTM()?.inverse();
  if (!m) return [e.clientX, e.clientY];
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
  return [p.x, p.y];
}

type Drag = {
  kind: 'move' | 'turn' | 'marquee';
  id: number;
  start: [number, number];
  startDesign: Design;
  center: [number, number];
  changed: boolean;
  /** move: the items that move together; marquee: the selection to add to. */
  ids: number[];
  /** -1 on an axis where the grabbed copy is a mirror image: the item moves (or turns) the other way. */
  mx: number;
  my: number;
};
let drag: Drag | null = null;
/** The marquee rectangle while it is drawn, in tile units. */
const marquee = ref<{ x: number; y: number; width: number; height: number } | null>(null);

function onDown(e: PointerEvent): void {
  if (e.button !== 0) return;
  const target = e.target as Element;
  const start = toSvg(e);
  const startDesign = design.value;
  if (target.closest('[data-handle]') && selected.value && handle.value) {
    const mx = handle.value.mirrored ? -1 : 1;
    drag = { kind: 'turn', id: selected.value.id, start, startDesign, center: handle.value.center, changed: false, ids: [], mx, my: 1 };
  } else {
    const hit = target.closest('[data-item]');
    const id = hit ? Number(hit.getAttribute('data-item')) : NaN;
    const add = e.shiftKey || e.ctrlKey || e.metaKey;
    if (!Number.isFinite(id) || id < 0) {
      // Empty space: a marquee; Shift adds to the selection.
      if (!add) select(null);
      drag = { kind: 'marquee', id: -1, start, startDesign, center: start, changed: false, ids: add ? [...selectedIds.value] : [], mx: 1, my: 1 };
    } else if (add) {
      toggleSelect(id);
      svgEl.value?.focus();
      e.preventDefault();
      return;
    } else {
      if (!selectedIds.value.includes(id)) select(id);
      const m = (a: string): number => (hit?.getAttribute(a) === '1' ? -1 : 1);
      drag = { kind: 'move', id, start, startDesign, center: start, changed: false, ids: [...selectedIds.value], mx: m('data-fx'), my: m('data-fy') };
    }
  }
  svgEl.value?.setPointerCapture(e.pointerId);
  svgEl.value?.focus();
  e.preventDefault();
}

function onMove(e: PointerEvent): void {
  if (!drag) return;
  const now = toSvg(e);
  if (drag.kind === 'move') {
    // On a mirrored copy the item moves the other way, so the copy under the pointer follows it.
    const dx = drag.mx * (now[0] - drag.start[0]);
    const dy = drag.my * (now[1] - drag.start[1]);
    drag.changed = Math.hypot(dx, dy) > 0.5;
    const d = drag.startDesign;
    const it = d.items.find((t) => t.id === drag!.id);
    if (!it) return;
    // The dragged shape's unsnapped target, wrapped by updateItem, then snapped (snapPoint wraps again);
    // the others move by the same step and keep their offsets.
    const moved = moveBy(d, it.id, dx, dy).items.find((t) => t.id === it.id)!;
    const [x, y] = snapOn.value && !e.altKey ? snapPoint(moved.x, moved.y, d.width, d.height, parts.value) : [moved.x, moved.y];
    preview(moveMany(d, drag.ids, x - it.x, y - it.y));
  } else if (drag.kind === 'marquee') {
    const [x0, y0] = drag.start;
    marquee.value = { x: Math.min(x0, now[0]), y: Math.min(y0, now[1]), width: Math.abs(now[0] - x0), height: Math.abs(now[1] - y0) };
  } else {
    const it = drag.startDesign.items.find((t) => t.id === drag!.id);
    if (!it) return;
    // On a mirrored copy, reflect the pointer across the center: the turn goes the other way, the size is the same.
    const [cx] = drag.center;
    const flip = (p: [number, number]): [number, number] => (drag!.mx < 0 ? [2 * cx - p[0], p[1]] : p);
    const next = handleTransform(drag.center, flip(drag.start), flip(now), it.rotate, it.scale, snapOn.value || e.shiftKey ? 15 : 0);
    drag.changed = next.rotate !== it.rotate || next.scale !== it.scale;
    preview(updateItem(drag.startDesign, drag.id, next));
  }
}

function onUp(e: PointerEvent): void {
  if (!drag) return;
  if (drag.kind === 'marquee') {
    const m = marquee.value;
    const d = design.value;
    const found = m ? itemsInRect(d.items, { x0: m.x, y0: m.y, x1: m.x + m.width, y1: m.y + m.height }, d.width, d.height, d.repeat) : [];
    selectedIds.value = [...drag.ids, ...found.filter((id) => !drag!.ids.includes(id))];
    marquee.value = null;
  } else if (drag.changed) commit(design.value);
  drag = null;
  if (svgEl.value?.hasPointerCapture(e.pointerId)) svgEl.value.releasePointerCapture(e.pointerId);
}

/** What the live region says: a function of the selected id and the item list only, so a drag says nothing new. */
const spoken = computed(() => {
  const items = design.value.items;
  if (selectedIds.value.length > 1) return `${selectedIds.value.length} shapes selected`;
  const k = items.findIndex((t) => t.id === selectedId.value);
  if (k < 0) return 'No shape selected';
  return `${design.value.stamps[items[k]!.stamp]?.name ?? 'Shape'}, shape ${k + 1} of ${items.length}`;
});

function onKey(e: KeyboardEvent): void {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    selectAll();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const pick = e.key === 'n' ? 1 : e.key === 'p' || e.key === 'N' ? -1 : 0;
  if (pick) {
    e.preventDefault();
    const ids = design.value.items.map((t) => t.id);
    if (ids.length) selectedId.value = stepSelection(ids, selectedId.value, pick);
    return;
  }
  const ids = selectedIds.value;
  if (!ids.length) return;
  const d = design.value;
  const step = e.shiftKey ? 10 : 1;
  const sx = snapOn.value ? (step * d.width) / parts.value : step;
  const sy = snapOn.value ? (step * d.height) / parts.value : step;
  const each = (f: (it: Item) => Partial<Item>): Design => updateMany(d, ids, f);
  const turn = (by: number): Design => each((it) => ({ rotate: it.rotate + by }));
  const size = (by: number): Design => each((it) => ({ scale: it.scale * by }));
  let copies: number[] = [];
  const actions: Record<string, () => Design | null> = {
    ArrowLeft: () => moveMany(d, ids, -sx, 0),
    ArrowRight: () => moveMany(d, ids, sx, 0),
    ArrowUp: () => moveMany(d, ids, 0, -sy),
    ArrowDown: () => moveMany(d, ids, 0, sy),
    Delete: () => removeMany(d, ids),
    Backspace: () => removeMany(d, ids),
    d: () => {
      const r = duplicateMany(d, ids);
      copies = r.ids;
      return r.design;
    },
    '[': () => turn(-15),
    ']': () => turn(15),
    '-': () => size(0.9),
    '+': () => size(1 / 0.9),
    '=': () => size(1 / 0.9),
    f: () => each((it) => ({ flip: !it.flip })),
    PageUp: () => reorderMany(d, ids, 'up'),
    PageDown: () => reorderMany(d, ids, 'down'),
    Escape: () => {
      select(null);
      return null;
    },
  };
  const action = actions[e.key];
  if (!action) return;
  e.preventDefault();
  const next = action();
  if (!next) return;
  if (next === d) return;
  commit(next);
  if (copies.length) selectedIds.value = copies;
}
</script>

<template>
  <div class="stage-editor">
    <div class="snap-bar">
      <UiSwitch v-model="snapOn" label="Snap" />
      <UiSegmented v-model="parts" label="Grid" :options="GRID_OPTIONS" :disabled="!snapOn" />
    </div>
    <svg
      ref="svgEl"
      class="tile-editor"
      xmlns="http://www.w3.org/2000/svg"
      :viewBox="box"
      preserveAspectRatio="xMidYMid meet"
      overflow="hidden"
      :style="sizeStyle"
      tabindex="0"
      role="application"
      aria-label="Tile editor. N and P select the next and previous shape. Arrow keys move the selected shapes. Control or Command A selects all."
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
      <template v-for="u in drawn" :key="u.key">
        <use
          v-if="u.hitWidth"
          :href="u.href"
          :transform="u.transform"
          :data-item="u.item"
          :data-fx="u.fx"
          :data-fy="u.fy"
          fill="none"
          stroke="transparent"
          :stroke-width="u.hitWidth"
          stroke-linecap="round"
          pointer-events="stroke"
        />
        <use
          :href="u.href"
          :transform="u.transform"
          :data-item="u.item"
          :data-fx="u.fx"
          :data-fy="u.fy"
          :fill="u.fill"
          :stroke="u.stroke"
          :stroke-width="u.strokeWidth"
          :stroke-linecap="u.stroke ? 'round' : undefined"
          :stroke-linejoin="u.stroke ? 'round' : undefined"
          :opacity="u.opacity"
          :pointer-events="u.stroke ? 'all' : undefined"
        />
      </template>
      <path class="veil" :d="veil" fill-rule="evenodd" />
      <circle v-for="([x, y], k) in dots" :key="`g${k}`" class="grid-dot" :cx="x" :cy="y" :r="Math.max(cell.width, cell.height) * 0.004" />
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
      <rect v-if="marquee" class="marquee" :x="marquee.x" :y="marquee.y" :width="marquee.width" :height="marquee.height" />
      <circle v-if="handle" class="handle" data-handle :cx="handle.cx" :cy="handle.cy" :r="handle.r" />
    </svg>
    <p class="visually-hidden" aria-live="polite">{{ spoken }}</p>
    <p class="stage-hint stage-hint-short">Drag to move. Shapes that cross an edge come back on the other side.</p>
    <p class="stage-hint stage-hint-long">Keys: N and P choose a shape, arrows move the selection. Shift-click adds a shape; drag on empty space to select an area. Drag to move. Drag the round handle to turn and resize. Shapes that cross an edge come back on the other side. With Snap on, hold Alt to drag freely.</p>
  </div>
</template>

<style scoped>
.stage-editor {
  /* The room the svg may take: the sticky stage minus the snap bar and the hint line. */
  --max-h: calc(min(var(--stage-h), 100dvh - var(--bar-h, 0px)) - 6.5rem);
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  min-height: 0;
}
@media (min-width: 64rem) {
  .stage-editor {
    --max-h: calc(100dvh - var(--bar-h, 0px) - 5.5rem);
  }
}
/* Exactly the viewBox: its ratio, as wide as the column unless the height limit is reached. */
.tile-editor {
  flex: none;
  aspect-ratio: var(--rw) / var(--rh);
  width: min(100%, var(--max-h) * var(--rw) / var(--rh));
  height: auto;
  max-height: var(--max-h);
  overflow: hidden;
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
.marquee {
  fill: rgba(0, 0, 0, 0.06);
  stroke: var(--accent);
  stroke-dasharray: 4 3;
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
.snap-bar {
  align-self: stretch;
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2) var(--s4);
  align-items: center;
  margin: 0 0 var(--s2);
  padding-inline: var(--s3);
  font-size: 0.875rem;
}
/* One row: the Grid label beside its options, not above them. */
.snap-bar :deep(.ui-segmented) {
  grid-auto-flow: column;
  align-items: center;
  gap: var(--s2);
}
.grid-dot {
  fill: rgba(0, 0, 0, 0.35);
  pointer-events: none;
}
.stage-hint {
  align-self: stretch;
  margin: 0.5rem 0 0;
  padding-inline: var(--s3);
  font-size: 0.875rem;
}
/* ponytail: the phone stage has a fixed height, so it shows one short line; the full key list needs the wide layout. */
.stage-hint-long {
  display: none;
}
@media (min-width: 64rem) {
  .stage-hint-short {
    display: none;
  }
  .stage-hint-long {
    display: block;
  }
}
</style>
