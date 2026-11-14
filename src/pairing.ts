import { blend, contrastRatio, relativeLuminance } from './contrast.ts';
import { plateSurfaces, surfaceColors } from './fills.ts';

export interface Roles {
  readonly background: string;
  readonly pattern: string;
  readonly text: string;
}
// The roles with the fill of closed shapes, when on: one more surface under the text (fills.ts).
// The functions below take Roles and spread them, so a fill passed in rides along to textWorst.
// `second`: the second layer drawn in its own color at `strength` times the stroke opacity (absent = same color as the
// pattern, which the spots model). It rides along the same way.
export type FilledRoles = Roles & {
  readonly fill?: string | null;
  readonly fillOpacity?: number;
  readonly second?: { readonly color: string; readonly strength: number } | null;
  readonly accent?: string | null; // the accent shapes' color, at full opacity; null or absent = none on the tile
};

export interface Fix {
  readonly text: string;
  readonly opacity: number;
  readonly ratio: number;
  readonly reached: boolean;
}

// The stroke opacities a surface shows for a pattern opacity (layerSpots in layers.ts); one layer by default.
export type Spots = (opacity: number) => readonly number[];
const ONE: Spots = (o) => [o];

// THE list of surfaces the text is checked against: background, fill, strokes on both, at every spot of the
// strokes and of the fill (a second layer carries the fill too), under a plate of opacity `plate`.
// Without a fill it equals worstTextContrast at each spot, as before.
export function textWorst(r: FilledRoles, opacity: number, plate: number, spots: Spots = ONE): number {
  return Math.min(...textSurfaces(r, opacity, plate, spots).map((c) => contrastRatio(r.text, c)));
}

// Every color under the text, for WCAG here and APCA (apca.ts). With a second color, the strokes of the first layer
// show at `opacity` alone, and the second layer (::after, painted over ::before) adds its color at opacity * strength
// over each surface under it (background, fill) and over the first stroke on it: the crossing. The plate covers all.
export function textSurfaces(r: FilledRoles, opacity: number, plate: number, spots: Spots = ONE): string[] {
  const fill = r.fill ?? null;
  const fillSpots = fill === null ? [0] : spots(r.fillOpacity ?? 1);
  const second = r.second ?? null;
  const out: string[] = [];
  for (const x of second ? [opacity] : spots(opacity))
    for (const y of fillSpots)
      out.push(
        ...surfaceColors(
          plateSurfaces(
            { background: r.background, pattern: r.pattern, patternOpacity: x, fill, fillOpacity: y, accent: r.accent ?? null },
            plate,
          ),
        ),
      );
  if (second) {
    const o2 = opacity * second.strength;
    const k = Math.min(1, Math.max(0, plate));
    for (const y of fillSpots) {
      const unders = [r.background, ...(fill === null ? [] : [blend(fill, r.background, y)]), ...(r.accent ? [r.accent] : [])];
      for (const u of unders)
        for (const c of [blend(second.color, u, o2), blend(second.color, blend(r.pattern, u, opacity), o2)])
          out.push(blend(r.background, c, k));
    }
  }
  return out;
}
export const worstAt = (r: FilledRoles, o: number, spots: Spots) => textWorst(r, o, 0, spots);

// What the fix search measures and moves. `at`: the worst value over the surfaces, higher is better.
// `ends`: the colors the text may move toward. `lower`: the heading target in 'split' mode.
export interface Score {
  readonly at: (r: FilledRoles, opacity: number, plate: number, spots: Spots) => number;
  readonly ends: (r: Roles) => readonly string[];
  readonly lower: (target: number) => number;
}
// WCAG 2.2: the worst contrast ratio; the text may move toward black or white.
export const WCAG_SCORE: Score = { at: textWorst, ends: () => ['#000000', '#ffffff'], lower: (t) => largeTarget(t) };

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

export function fixContrast(r: Roles, opacity: number, target = 4.5, spots: Spots = ONE, score: Score = WCAG_SCORE): Fix {
  const worstAt = (rr: FilledRoles, o: number, sp: Spots) => score.at(rr, o, 0, sp);
  const start = worstAt(r, opacity, spots);
  if (start >= target) return { text: r.text, opacity, ratio: start, reached: true };
  let best: Fix = { text: r.text, opacity, ratio: start, reached: false };
  for (let k = 0; ; k++) {
    const o = Math.max(0, opacity - k * OPACITY_STEP);
    for (let i = 0; i <= TEXT_STEPS; i++) {
      // Same t passing in both directions: keep the higher ratio.
      let hit: Fix | undefined;
      for (const end of score.ends(r)) {
        const text = blend(end, r.text, i / TEXT_STEPS);
        const ratio = worstAt({ ...r, text }, o, spots);
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
export function plateContrast(r: FilledRoles, opacity: number, plate: number, spots: Spots = ONE, score: Score = WCAG_SCORE): number {
  return score.at(r, opacity, plate, spots);
}

export interface PlateFix {
  readonly text: string;
  readonly plate: number;
  readonly ratio: number;
  readonly reached: boolean;
}

export function fixWithPlate(
  r: Roles,
  opacity: number,
  plate: number,
  target = 4.5,
  spots: Spots = ONE,
  score: Score = WCAG_SCORE,
): PlateFix {
  const plateContrast = (rr: FilledRoles, o: number, p: number, sp: Spots) => score.at(rr, o, p, sp);
  const start = plateContrast(r, opacity, plate, spots);
  if (start >= target) return { text: r.text, plate, ratio: start, reached: true };
  for (let k = 1; ; k++) {
    const p = Math.min(1, Math.round((plate + k * 0.05) * 100) / 100);
    const ratio = plateContrast(r, opacity, p, spots);
    if (ratio >= target) return { text: r.text, plate: p, ratio, reached: true };
    if (p === 1) break;
  }
  // Plate 1 hides the pattern: only the text against the bare background is left.
  const f = fixContrast(r, 0, target, spots, score);
  return { text: f.text, plate: 1, ratio: plateContrast({ ...r, text: f.text }, opacity, 1, spots), reached: f.reached };
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
export function fixSplit(r: Roles, opacity: number, plate: number, target = 4.5, spots: Spots = ONE, score: Score = WCAG_SCORE): SplitFix {
  const worstAt = (rr: FilledRoles, o: number, sp: Spots) => score.at(rr, o, 0, sp);
  const plateContrast = (rr: FilledRoles, o: number, p: number, sp: Spots) => score.at(rr, o, p, sp);
  const large = score.lower(target);
  const fixHeading = (text: string, o: number): Fix => fixContrast({ ...r, text }, o, large, spots, score);
  let { text, opacity: o } = fixHeading(r.text, opacity);
  const p = fixWithPlate({ ...r, text }, o, plate, target, spots, score);
  text = p.text;
  // Step 3 only changes the text at plate 1, where the paragraph no longer depends on the opacity,
  // and at opacity 0 the heading equals the text against the background: lowering the opacity ends.
  while (worstAt({ ...r, text }, o, spots) < large && o > 0) o = Math.max(0, o - OPACITY_STEP);
  // Round away float noise (0.6499999), never above the input.
  o = Math.min(opacity, Math.round(o * 100) / 100);
  const final = { ...r, text };
  const paragraph = plateContrast(final, o, p.plate, spots);
  const heading = worstAt(final, o, spots);
  return { text, plate: p.plate, opacity: o, paragraph, heading, reached: paragraph >= target && heading >= large };
}

export interface ModeFix {
  readonly text: string;
  readonly opacity: number;
  readonly plate: number;
  readonly ratio: number; // the paragraph's surface, the value the badge shows
  readonly heading: number | undefined; // 'split' only
  readonly reached: boolean;
}

// The Fix button for one plate mode, aimed at the layered value the badge shows (pass the same spots).
export function fixForMode(
  mode: 'plate' | 'split' | 'direct',
  r: Roles,
  opacity: number,
  plate: number,
  target: number,
  spots: Spots = ONE,
  score: Score = WCAG_SCORE,
): ModeFix {
  const worstAt = (rr: FilledRoles, o: number, sp: Spots) => score.at(rr, o, 0, sp);
  const plateContrast = (rr: FilledRoles, o: number, p: number, sp: Spots) => score.at(rr, o, p, sp);
  if (mode === 'split') {
    const f = fixSplit(r, opacity, plate, target, spots, score);
    return { text: f.text, opacity: f.opacity, plate: f.plate, ratio: f.paragraph, heading: f.heading, reached: f.reached };
  }
  if (mode === 'direct') {
    const f = fixContrast(r, opacity, target, spots, score);
    const o = Math.round(f.opacity * 100) / 100;
    const ratio = worstAt({ ...r, text: f.text }, o, spots); // after opacity rounding
    return { text: f.text, opacity: o, plate, ratio, heading: undefined, reached: ratio >= target };
  }
  // The pattern opacity stays: only the plate and, if needed, the text change.
  const f = fixWithPlate(r, opacity, plate, target, spots, score);
  const ratio = plateContrast({ ...r, text: f.text }, opacity, f.plate, spots);
  return { text: f.text, opacity, plate: f.plate, ratio, heading: undefined, reached: ratio >= target };
}

export const FILL_FIX_MIN = 0.15;

// The Fix with a fill: lower the fill opacity first, in steps of 0.05 down to FILL_FIX_MIN, while that alone
// can reach the target; otherwise the existing fix runs with the fill as it was.
export function fixWithFill(
  mode: 'plate' | 'split' | 'direct',
  r: FilledRoles,
  opacity: number,
  plate: number,
  target: number,
  spots: Spots = ONE,
  score: Score = WCAG_SCORE,
): ModeFix & { readonly fillOpacity: number | undefined } {
  const worstAt = (rr: FilledRoles, o: number, sp: Spots) => score.at(rr, o, 0, sp);
  const textWorst = (rr: FilledRoles, o: number, p: number, sp: Spots) => score.at(rr, o, p, sp);
  const ok = (rr: FilledRoles): boolean =>
    mode === 'direct'
      ? worstAt(rr, opacity, spots) >= target
      : textWorst(rr, opacity, plate, spots) >= target && (mode !== 'split' || worstAt(rr, opacity, spots) >= score.lower(target));
  const fo = r.fillOpacity ?? 1;
  if (r.fill && !ok(r)) {
    for (let k = 1; ; k++) {
      const f = Math.max(FILL_FIX_MIN, Math.round((fo - k * 0.05) * 100) / 100);
      if (f >= fo) break;
      const rr = { ...r, fillOpacity: f };
      if (ok(rr)) {
        const ratio = mode === 'direct' ? worstAt(rr, opacity, spots) : textWorst(rr, opacity, plate, spots);
        const heading = mode === 'split' ? worstAt(rr, opacity, spots) : undefined;
        return { text: r.text, opacity, plate, ratio, heading, reached: true, fillOpacity: f };
      }
      if (f === FILL_FIX_MIN) break;
    }
  }
  return { ...fixForMode(mode, r, opacity, plate, target, spots, score), fillOpacity: r.fillOpacity };
}
