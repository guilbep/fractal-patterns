// Module-level reactive state for the page. Randomness lives here, never in fractal.ts.
import { computed, reactive, ref, watch } from 'vue';
import { KINDS, MAX_DEPTH, generate, type Kind } from '@/fractal.ts';
import { PALETTES, type Palette } from '@/palettes.ts';
import { blend, contrastRatio, textLevel } from '@/contrast.ts';
import { fixContrast, patternContrast, patternInvisible, pickRoles, swapRoles, worstTextContrast, type Roles } from '@/pairing.ts';
import { cssBackground, svgToDataUri } from '@/css.ts';
import { formatFootprint, gzipSize, rawSize } from '@/co2.ts';

export const MAX_SEED = 0xffffffff;

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

const DEFAULT_PALETTE = PALETTES.find((p) => p.name === 'Classic Double Blue') ?? PALETTES[0]!;
const INITIAL_SEED = randomSeed();
const DEFAULTS = { kind: 'tree' as Kind, depth: 8, size: 120, strokeWidth: 2, precision: 1, opacity: 0.6 };

export const params = reactive({
  kind: DEFAULTS.kind,
  seed: INITIAL_SEED,
  depth: DEFAULTS.depth,
  size: DEFAULTS.size,
  strokeWidth: DEFAULTS.strokeWidth,
  precision: DEFAULTS.precision,
});
export const roles = reactive<{ -readonly [K in keyof Roles]: string }>({ ...pickRoles(DEFAULT_PALETTE.colors) });
export const opacity = ref(DEFAULTS.opacity);
export const paletteName = ref<string | null>(DEFAULT_PALETTE.name);
export const palette = computed(() => PALETTES.find((p) => p.name === paletteName.value) ?? null);

// Result of the last Fix click, shown until the colors change by another action.
export const lastFix = ref<{ target: number; reached: boolean; ratio: number } | null>(null);

watch(
  () => params.kind,
  (k) => {
    params.depth = Math.min(params.depth, MAX_DEPTH[k]);
  },
);

export const svg = computed(() => generate({ ...params, color: roles.pattern, opacity: opacity.value }));
export const css = computed(() => cssBackground(svg.value, roles.background));
export const svgHref = computed(() => svgToDataUri(svg.value));
export const fileName = computed(() => `fractal-${params.kind}-${params.seed}.svg`);

// One small live tile per kind, current colors and seed, for the kind picker.
export const previews = computed(() =>
  KINDS.map((kind) => {
    const tile = generate({ ...params, kind, size: 64, depth: Math.min(params.depth, MAX_DEPTH[kind]), color: roles.pattern, opacity: opacity.value });
    return { kind, css: cssBackground(tile, roles.background) };
  }),
);

export const contrast = computed(() => {
  const textOnBackground = contrastRatio(roles.text, roles.background);
  const textOnPattern = contrastRatio(roles.text, blend(roles.pattern, roles.background, opacity.value));
  const worst = worstTextContrast(roles, opacity.value);
  return {
    textOnBackground,
    textOnPattern,
    worst,
    pattern: patternContrast(roles, opacity.value),
    patternInvisible: patternInvisible(roles, opacity.value),
    normal: textLevel(worst),
    large: textLevel(worst, true),
  };
});

// Truncated, never rounded up: 4.499 shows as 4.49, so a failing ratio never reads as 4.50.
export function ratioText(r: number): string {
  return (Math.floor(r * 100) / 100).toFixed(2);
}

export const rawBytes = computed(() => rawSize(svg.value));
export const gzipBytes = ref<number | null>(null);
export const footprint = computed(() => (gzipBytes.value === null ? null : formatFootprint(gzipBytes.value)));

let request = 0;
watch(
  svg,
  async (s) => {
    const id = ++request;
    try {
      const n = await gzipSize(s);
      if (id === request) gzipBytes.value = n;
    } catch {
      if (id === request) gzipBytes.value = null;
    }
  },
  { immediate: true },
);

export function reseed(): void {
  params.seed = randomSeed();
}

export function setSeed(value: string): void {
  const n = Number(value);
  if (value.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= MAX_SEED) params.seed = n;
}

function setRoles(r: Roles): void {
  Object.assign(roles, { background: r.background, pattern: r.pattern, text: r.text });
}

// Roles whose color is not in the selected palette. The palette stays selected; the page only notes it.
export const offPalette = computed(() =>
  (['background', 'pattern', 'text'] as const).filter((k) => palette.value && !palette.value.colors.includes(roles[k])),
);

export function setRole(role: keyof Roles, hex: string): void {
  lastFix.value = null;
  setRoles({ ...roles, [role]: hex.toLowerCase() });
}

export function applyPalette(p: Palette): void {
  lastFix.value = null;
  paletteName.value = p.name;
  setRoles(pickRoles(p.colors));
}

export function swap(): void {
  lastFix.value = null;
  setRoles(swapRoles(roles));
}

export function applyFix(target: number): void {
  const fix = fixContrast(roles, opacity.value, target);
  opacity.value = Math.round(fix.opacity * 100) / 100;
  setRoles({ ...roles, text: fix.text });
  const ratio = worstTextContrast(roles, opacity.value); // after opacity rounding
  lastFix.value = { target, reached: ratio >= target, ratio };
}

// Back to the first-load state, including the seed drawn at load.
export function reset(): void {
  const { opacity: o, ...rest } = DEFAULTS;
  Object.assign(params, { ...rest, seed: INITIAL_SEED });
  opacity.value = o;
  applyPalette(DEFAULT_PALETTE);
}
