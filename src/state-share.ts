// The design in the URL hash, and an undo history over it. Pins, the palette name, and the image stay out (see share.ts).
import { computed, ref, watch } from 'vue';
import { FAMILIES } from '@/fractal.ts';
import { createHistory } from '@/history.ts';
import { PALETTES, linkedPalette } from '@/palettes.ts'; // STUDIO-PAL
import { DESIGN_DEFAULTS, decodeDesign, encodeDesign, sameDesign, type Design, WELCOME } from '@/share.ts';
import {
  accent,
  applyPalette,
  change,
  changeTo,
  fade,
  fill,
  hasAccent,
  lastFix,
  layer2,
  layer2Color,
  layer2Own,
  layer2Settings,
  layout,
  motion,
  opacity,
  paletteName,
  params,
  parallax,
  patch,
  plateBlur,
  plateMode,
  plateOpacity,
  plateRadius,
  roles,
  sections,
  source,
  spacing,
  variantOptions,
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
    layer2Settings: { ...layer2Settings },
    parallax: parallax.value,
    variantOptions: { ...variantOptions },
    sections: sections.value,
    fill: { ...fill },
    layer2Color: layer2Own.value ? layer2Color.value : null,
    change: { dir: change.value, to: changeTo.value },
    // Only a kind with accent shapes carries its accent color: a palette pick on another kind leaves the link as it was.
    accent: hasAccent(params.kind) ? accent.value : DESIGN_DEFAULTS.accent,
  };
}

export function applyDesign(d: Design): void {
  Object.assign(params, { kind: d.kind, seed: d.seed, depth: d.depth, size: d.size, strokeWidth: d.strokeWidth, precision: d.precision });
  Object.assign(roles, { background: d.background, pattern: d.pattern, text: d.text });
  // The link carries colors, not a palette name: name the curated palette that holds all three, else none ("Custom").
  paletteName.value = PALETTES.find((p) => [d.background, d.pattern, d.text].every((c) => p.colors.includes(c)))?.name ?? null;
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
  change.value = d.change.dir;
  changeTo.value = d.change.to;
  Object.assign(layer2Settings, d.layer2Settings);
  parallax.value = d.parallax;
  Object.assign(variantOptions, d.variantOptions);
  sections.value = d.sections;
  Object.assign(fill, d.fill);
  layer2Own.value = d.layer2Color !== null;
  if (d.layer2Color !== null) layer2Color.value = d.layer2Color;
  if (hasAccent(d.kind)) accent.value = d.accent;
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
  // STUDIO-PAL: a hash with only pn or pc is a palette, not a design.
  if (hasWindow && isDesign(window.location.hash) && !/^#?p[nc]=[^&]*$/.test(window.location.hash))
    applyDesign(decodeDesign(window.location.hash));
  // No design in the address (a first visit, or only a palette from the studio): show the welcome design.
  else if (hasWindow) applyDesign(decodeDesign(`#${WELCOME}`));
  // --- STUDIO-PAL: a palette from the Wallpaper Studio link (pn name, pc random colors) wins over the hash colors.
  const linked = hasWindow ? linkedPalette(new URLSearchParams(window.location.hash.slice(1))) : null;
  if (linked) applyPalette(linked);
  // --- end STUDIO-PAL
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
