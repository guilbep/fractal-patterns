// The design in the URL hash, and an undo history over it. Pins, the palette name, and the image stay out (see share.ts).
import { computed, ref, watch } from 'vue';
import { FAMILIES } from '@/fractal.ts';
import { createHistory } from '@/history.ts';
import { DESIGN_DEFAULTS, decodeDesign, encodeDesign, sameDesign, type Design } from '@/share.ts';
import {
  fade,
  lastFix,
  layer2,
  layout,
  motion,
  opacity,
  params,
  patch,
  plateBlur,
  plateMode,
  plateOpacity,
  plateRadius,
  roles,
  source,
  spacing,
  variants,
} from '@/state.ts';

export function snapshot(): Design {
  return {
    ...params,
    background: roles.background,
    pattern: roles.pattern,
    text: roles.text,
    opacity: opacity.value,
    plateMode: plateMode.value,
    plateOpacity: plateOpacity.value,
    plateRadius: plateRadius.value,
    plateBlur: plateBlur.value,
    ...motion,
    ...spacing,
    layout: layout.value,
    cells: patch.cells,
    frame: patch.frame,
    // An empty family list is not reachable in the panel; it maps to the default rather than to 0.
    families: FAMILIES.reduce((m, f, i) => (patch.families.includes(f) ? m | (1 << i) : m), 0) || DESIGN_DEFAULTS.families,
    variants: variants.value,
    layer2: layer2.value,
    fade: fade.value,
  };
}

export function applyDesign(d: Design): void {
  Object.assign(params, { kind: d.kind, seed: d.seed, depth: d.depth, size: d.size, strokeWidth: d.strokeWidth, precision: d.precision });
  Object.assign(roles, { background: d.background, pattern: d.pattern, text: d.text });
  opacity.value = d.opacity;
  plateMode.value = d.plateMode;
  plateOpacity.value = d.plateOpacity;
  plateRadius.value = d.plateRadius;
  plateBlur.value = d.plateBlur;
  Object.assign(motion, { rotate: d.rotate, scale: d.scale, skew: d.skew, tilt: d.tilt, drift: d.drift, speed: d.speed });
  Object.assign(spacing, { zoom: d.zoom, gap: d.gap, mirror: d.mirror });
  layout.value = d.layout;
  patch.cells = d.cells;
  patch.frame = d.frame;
  patch.families = FAMILIES.filter((_, i) => d.families & (1 << i));
  variants.value = d.variants;
  layer2.value = d.layer2;
  fade.value = d.fade;
  source.value = 'math';
  lastFix.value = null; // the Fix result no longer describes these colors
}

let history = createHistory(snapshot(), 50, sameDesign);
export const canUndo = ref(false);
export const canRedo = ref(false);

let applying = false; // set by undo/redo so the watcher writes the URL without a new history entry
let pending: { d: Design; skip: boolean; timer: ReturnType<typeof setTimeout> } | null = null;

function writeUrl(d: Design): void {
  try {
    if (typeof window === 'undefined' || !window.history || !window.location) return;
    const hash = encodeDesign(d);
    window.history.replaceState(null, '', hash ? `#${hash}` : window.location.pathname + window.location.search);
  } catch {
    /* sandboxed frame or blocked history: the design just stays out of the URL */
  }
}

function commit(): void {
  if (!pending) return;
  const { d, skip, timer } = pending;
  clearTimeout(timer);
  pending = null;
  if (!skip) history.push(d);
  writeUrl(d);
  canUndo.value = history.canUndo();
  canRedo.value = history.canRedo();
}

function move(d: Design | undefined): void {
  if (!d) return;
  applying = true;
  applyDesign(d);
  canUndo.value = history.canUndo();
  canRedo.value = history.canRedo();
}

// A change still waiting for its debounce becomes an entry first, so undo goes back past it.
export function undo(): void {
  commit();
  move(history.undo());
}
export function redo(): void {
  commit();
  move(history.redo());
}

export function shareUrl(): string {
  if (typeof window === 'undefined' || !window.location) return '';
  const hash = encodeDesign(snapshot());
  return (window.location.href.split('#')[0] ?? '') + (hash ? `#${hash}` : '');
}

let started = false;
export function initShare(): void {
  if (started) return;
  started = true;
  const hasWindow = typeof window !== 'undefined' && !!window.location;
  // A design string always holds '='; a bare anchor such as #depth is not a design.
  const isDesign = (h: string) => h.includes('=');
  if (hasWindow && isDesign(window.location.hash)) applyDesign(decodeDesign(window.location.hash));
  history = createHistory(snapshot(), 50, sameDesign);
  writeUrl(snapshot()); // a reload keeps the first random seed, and a hostile hash is replaced by its clean form
  // ponytail: one entry per 300 ms pause, so a slider drag is one step.
  watch(computed(snapshot), (d) => {
    const skip = applying;
    applying = false;
    if (!skip) canUndo.value = true; // undo() commits the pending change first, so it is undoable at once
    if (pending) clearTimeout(pending.timer);
    pending = { d, skip, timer: setTimeout(commit, 300) };
  });
  // A link pasted into the same tab changes only the hash: no reload, so apply it here. It becomes one undoable entry.
  if (hasWindow)
    window.addEventListener('hashchange', () => {
      if (isDesign(window.location.hash)) applyDesign(decodeDesign(window.location.hash));
    });
}
