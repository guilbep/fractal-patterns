// The pattern builder's shared state: one design, its undo history, the selection, and the stored copy.
// Module-level Vue state: every panel imports the same refs.
import { computed, ref, shallowRef } from 'vue';
import { createHistory } from '../history.ts';
import { designSvg, parseDesign } from './design.ts';
import { gridFill } from './fill.ts';
import { BASIC_STAMPS } from './stamps.ts';
import type { Design, Item, Stamp } from './types.ts';

const KEY = 'fp-builder-design-v1';
const FILL_STAMPS = ['Dot', 'Leaf', 'Drop', 'Ring'];

export function defaultDesign(): Design {
  const stamps = BASIC_STAMPS;
  const base = { width: 240, height: 240, background: '#f4f1ea', repeat: 'straight' as const, strokeWidth: 3, stamps };
  const items = gridFill({
    width: base.width,
    height: base.height,
    columns: 4,
    rows: 4,
    stamps: FILL_STAMPS.map((name) => {
      const index = stamps.findIndex((s) => s.name === name);
      const s = stamps[index]!;
      return { index, box: s.box, parts: s.parts.length };
    }),
    seed: 1,
    size: 0.55,
    sizeJitter: 0.3,
    jitter: 0.5,
    rotate: 'free',
    stagger: false,
    flip: false,
    colors: ['#2f6f62', '#d98e4a', '#3b4a6b'],
    firstId: 1,
  });
  return { ...base, items };
}

function load(): Design {
  try {
    if (typeof localStorage === 'undefined') return defaultDesign();
    const text = localStorage.getItem(KEY);
    return (text && parseDesign(JSON.parse(text))) || defaultDesign();
  } catch {
    return defaultDesign();
  }
}

function save(d: Design): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // Full or blocked storage: the design lives on in memory.
  }
}

export const design = shallowRef<Design>(load());
export const selectedId = ref<number | null>(null);
export const selected = computed<Item | null>(() => design.value.items.find((it) => it.id === selectedId.value) ?? null);
export const svg = computed(() => designSvg(design.value));

const history = createHistory<Design>(design.value, 100);
export const canUndo = ref(false);
export const canRedo = ref(false);

function show(d: Design): void {
  design.value = d;
  if (selectedId.value !== null && !d.items.some((it) => it.id === selectedId.value)) selectedId.value = null;
  canUndo.value = history.canUndo();
  canRedo.value = history.canRedo();
}

export function preview(next: Design): void {
  design.value = next;
}

export function commit(next: Design): void {
  history.push(next);
  show(next);
  save(next);
}

export function undo(): void {
  const d = history.undo();
  if (d) {
    show(d);
    save(d);
  }
}

export function redo(): void {
  const d = history.redo();
  if (d) {
    show(d);
    save(d);
  }
}

export function useStamp(s: Stamp): number {
  const key = JSON.stringify(s);
  const i = design.value.stamps.findIndex((t) => JSON.stringify(t) === key);
  if (i >= 0) return i;
  commit({ ...design.value, stamps: [...design.value.stamps, s] });
  return design.value.stamps.length - 1;
}

export function resetDesign(): void {
  commit(defaultDesign());
}
