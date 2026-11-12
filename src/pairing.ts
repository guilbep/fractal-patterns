import { blend, contrastRatio, relativeLuminance } from './contrast.ts';

export interface Roles {
  readonly background: string;
  readonly pattern: string;
  readonly text: string;
}

export interface Fix {
  readonly text: string;
  readonly opacity: number;
  readonly ratio: number;
  readonly reached: boolean;
}

const TEXT_STEPS = 100;
const OPACITY_STEP = 0.05;

export function pickRoles(colors: readonly string[]): Roles {
  if (colors.length < 2) throw new Error('pickRoles needs at least 2 colors');
  let best: [string, string] | undefined;
  let bestRatio = -1;
  for (const [i, a] of colors.entries()) {
    for (const b of colors.slice(i + 1)) {
      const r = contrastRatio(a, b);
      if (r > bestRatio) [best, bestRatio] = [[a, b], r];
    }
  }
  const [a, b] = best!;
  const [background, text] = relativeLuminance(a) >= relativeLuminance(b) ? [a, b] : [b, a];
  // Rank at PICK_OPACITY: visible and AA first, then visible, then the most visible.
  // Within the first two tiers the calmest pattern (highest worst text contrast) wins.
  let pattern = text;
  let bestKey: [number, number] | undefined;
  for (const c of colors) {
    if (c === background || c === text) continue;
    const r = { background, pattern: c, text };
    const visible = patternContrast(r, PICK_OPACITY) >= PATTERN_VISIBLE_MIN;
    const worst = worstTextContrast(r, PICK_OPACITY);
    const key: [number, number] = visible ? [worst >= 4.5 ? 2 : 1, worst] : [0, patternContrast(r, PICK_OPACITY)];
    if (!bestKey || key[0] > bestKey[0] || (key[0] === bestKey[0] && key[1] > bestKey[1])) {
      [pattern, bestKey] = [c, key];
    }
  }
  return { background, pattern, text };
}

export const PICK_OPACITY = 0.6;

export function swapRoles(r: Roles): Roles {
  return { background: r.text, pattern: r.pattern, text: r.background };
}

export function worstTextContrast(r: Roles, opacity: number): number {
  return Math.min(contrastRatio(r.text, r.background), contrastRatio(r.text, blend(r.pattern, r.background, opacity)));
}

export function patternContrast(r: Roles, opacity: number): number {
  return contrastRatio(blend(r.pattern, r.background, opacity), r.background);
}

export const PATTERN_VISIBLE_MIN = 1.2;

export function patternInvisible(r: Roles, opacity: number): boolean {
  return patternContrast(r, opacity) < PATTERN_VISIBLE_MIN;
}

export function fixContrast(r: Roles, opacity: number, target = 4.5): Fix {
  const start = worstTextContrast(r, opacity);
  if (start >= target) return { text: r.text, opacity, ratio: start, reached: true };
  let best: Fix = { text: r.text, opacity, ratio: start, reached: false };
  for (let k = 0; ; k++) {
    const o = Math.max(0, opacity - k * OPACITY_STEP);
    for (let i = 0; i <= TEXT_STEPS; i++) {
      // Same t passing in both directions: keep the higher ratio.
      let hit: Fix | undefined;
      for (const end of ['#000000', '#ffffff']) {
        const text = blend(end, r.text, i / TEXT_STEPS);
        const ratio = worstTextContrast({ ...r, text }, o);
        const cand: Fix = { text, opacity: o, ratio, reached: ratio >= target };
        if (ratio > best.ratio) best = cand;
        if (cand.reached && (!hit || ratio > hit.ratio)) hit = cand;
      }
      if (hit) return hit;
    }
    if (o === 0) return best;
  }
}

// A plate of opacity p over a stroke at `opacity` shows the stroke at opacity * (1 - p).
export function plateContrast(r: Roles, opacity: number, plate: number): number {
  return worstTextContrast(r, opacity * (1 - Math.min(1, Math.max(0, plate))));
}

export interface PlateFix {
  readonly text: string;
  readonly plate: number;
  readonly ratio: number;
  readonly reached: boolean;
}

export function fixWithPlate(r: Roles, opacity: number, plate: number, target = 4.5): PlateFix {
  const start = plateContrast(r, opacity, plate);
  if (start >= target) return { text: r.text, plate, ratio: start, reached: true };
  for (let k = 1; ; k++) {
    const p = Math.min(1, Math.round((plate + k * 0.05) * 100) / 100);
    const ratio = plateContrast(r, opacity, p);
    if (ratio >= target) return { text: r.text, plate: p, ratio, reached: true };
    if (p === 1) break;
  }
  // Plate 1 hides the pattern: only the text against the bare background is left.
  const f = fixContrast(r, 0, target);
  return { text: f.text, plate: 1, ratio: plateContrast({ ...r, text: f.text }, opacity, 1), reached: f.reached };
}

export interface SplitFix {
  readonly text: string;
  readonly plate: number;
  readonly opacity: number;
  readonly paragraph: number;
  readonly heading: number;
  readonly reached: boolean;
}

// WCAG large-text threshold that goes with a normal-text target.
export function largeTarget(target: number): number {
  return target <= 4.5 ? 3 : 4.5;
}

// Split layout: the paragraph sits on a plate, the heading on the bare pattern.
export function fixSplit(r: Roles, opacity: number, plate: number, target = 4.5): SplitFix {
  const large = largeTarget(target);
  const fixHeading = (text: string, o: number): Fix => fixContrast({ ...r, text }, o, large);
  let { text, opacity: o } = fixHeading(r.text, opacity);
  const p = fixWithPlate({ ...r, text }, o, plate, target);
  text = p.text;
  // Step 3 only changes the text at plate 1, where the paragraph no longer depends on the opacity,
  // and at opacity 0 the heading equals the text against the background: lowering the opacity ends.
  while (worstTextContrast({ ...r, text }, o) < large && o > 0) o = Math.max(0, o - OPACITY_STEP);
  // Round away float noise (0.6499999), never above the input.
  o = Math.min(opacity, Math.round(o * 100) / 100);
  const final = { ...r, text };
  const paragraph = plateContrast(final, o, p.plate);
  const heading = worstTextContrast(final, o);
  return { text, plate: p.plate, opacity: o, paragraph, heading, reached: paragraph >= target && heading >= large };
}
