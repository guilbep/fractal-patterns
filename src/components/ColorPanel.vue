<script setup lang="ts">
import { computed, ref } from 'vue';
import { PALETTE_GROUPS } from '@/palettes.ts';
import '@/css/palettes.css';
import { largeTarget } from '@/pairing.ts';
import { APCA_SCORE, APCA_VERSION, lcText, polarity } from '@/apca.ts';
import '@/css/apca.css';
import { applyFix, applyPalette, randomPalette, closedShapes, contrast, fill, fillAvailable, hasAccent, lastFix, offPalette, opacity, paletteName, params, plateBlur, plateMode, plateOpacity, plateRadius, ratioText, swap, type PlateMode } from '@/state.ts';
import RoleInput from './RoleInput.vue';
import UiSection from './UiSection.vue';

const apcaWorstLc = computed(() => (plateMode.value === 'direct' ? contrast.value.apca.direct : contrast.value.apca.onPlate));
// The levels and reference sizes (Arial or Helvetica, weight 400) from the APCA minimum compliance document.
const APCA_LEVELS = [
  ['90', 'preferred body text (14px)'],
  ['75', 'minimum body text (16px)'],
  ['60', 'minimum fluent text (24px)'],
  ['45', 'minimum large text (42px)'],
  ['30', 'minimum any text: non-content text only'],
  ['15', 'invisibility point: certain non-text only'],
] as const;
// The APCA raise target: page state only, not in the share link.
const APCA_TARGETS = [
  [60, 'large fluent text'],
  [75, 'body text'],
  [90, 'preferred body text'],
] as const;
const apcaTarget = ref(75);
// In 'split' mode the heading on the bare pattern counts too, at the next lower level (APCA_SCORE.lower).
const apcaReached = computed(
  () =>
    Math.abs(apcaWorstLc.value) >= apcaTarget.value &&
    (plateMode.value !== 'split' || Math.abs(contrast.value.apca.direct) >= APCA_SCORE.lower(apcaTarget.value)),
);

const offPaletteText = computed(() => new Intl.ListFormat('en', { type: 'conjunction' }).format(offPalette.value));

const badges = computed(() => [
  { label: 'AA normal text', min: '4.5', pass: contrast.value.normal !== 'fail' },
  { label: 'AA large text', min: '3', pass: contrast.value.large !== 'fail' },
  { label: 'AAA normal text', min: '7', pass: contrast.value.normal === 'AAA' },
  { label: 'AAA large text', min: '4.5', pass: contrast.value.large === 'AAA' },
]);
const modes: { value: PlateMode; label: string }[] = [
  { value: 'plate', label: 'Text on a plate' },
  { value: 'split', label: 'Heading on pattern, paragraph on a plate' },
  { value: 'direct', label: 'Text on the pattern' },
];
// In 'split' mode the heading on the bare pattern must also pass, at the large-text threshold.
const passes = (target: number): boolean =>
  contrast.value.worst >= target && (plateMode.value !== 'split' || contrast.value.direct >= largeTarget(target));
const fixes = computed(() => [
  { name: 'AA', target: 4.5, ok: passes(4.5) },
  { name: 'AAA', target: 7, ok: passes(7) },
]);
const contrastSummary = computed(() => `${ratioText(contrast.value.worst)}:1 · ${contrast.value.normal === 'fail' ? 'fails AA' : contrast.value.normal}`);
const PLATE_SHORT: Record<PlateMode, string> = { plate: 'plate', split: 'heading on pattern', direct: 'on the pattern' };
const plateSummary = computed(() => (plateMode.value === 'direct' ? PLATE_SHORT.direct : `${PLATE_SHORT[plateMode.value]} · ${Math.round(plateOpacity.value * 100)} %`));
</script>

<template>
  <UiSection title="Colors and contrast" heading-id="colors-h" :summary="contrastSummary" open>
    <p class="lede">Three roles share the tile. The text has to stay readable on both the plain background and the strokes.</p>

    <div class="color-grid">
      <div class="roles">
        <RoleInput role="background" label="Background" hint="fills the tile" />
        <RoleInput role="pattern" label="Pattern" hint="the fractal strokes" />
        <div class="field">
          <label for="opacity">Pattern opacity <output for="opacity">{{ Math.round(opacity * 100) }}%</output></label>
          <input id="opacity" v-model.number="opacity" type="range" min="0" max="1" step="0.01">
        </div>
        <fieldset class="plate-group">
          <legend>Fill</legend>
          <div class="field">
            <label for="fill-mode">Fill closed shapes</label>
            <select id="fill-mode" v-model="fill.mode" :disabled="!fillAvailable" aria-describedby="fill-hint">
              <option value="none">Off</option>
              <option value="closed">All closed shapes</option>
              <option value="alternate">Every second shape</option>
            </select>
          </div>
          <template v-if="fill.mode !== 'none' && fillAvailable">
            <RoleInput role="fill" label="Fill" hint="inside closed shapes" />
            <div class="field">
              <label for="fill-opacity">Fill opacity <output for="fill-opacity">{{ Math.round(fill.opacity * 100) }}%</output></label>
              <input id="fill-opacity" v-model.number="fill.opacity" type="range" min="0" max="1" step="0.01">
            </div>
          </template>
          <p id="fill-hint" class="hint-text">
            <template v-if="!fillAvailable">Not available in this mode yet.</template>
            <template v-else>Fills the closed shapes of the pattern with a second color. Text contrast is checked on the fill too.</template>
            <template v-if="fillAvailable && fill.mode !== 'none' && closedShapes === 0"> This pattern has no closed shape to fill.</template>
          </p>
        </fieldset>
        <RoleInput v-if="hasAccent(params.kind)" role="accent" label="Accent" hint="the shapes this pattern marks" />
        <RoleInput role="text" label="Text" hint="sits on top of both" />
        <p class="adjusted" role="status">
          <template v-if="offPalette.length">Adjusted: the {{ offPaletteText }} {{ offPalette.length > 1 ? 'colors are' : 'color is' }} not from this palette.</template>
        </p>
        <button type="button" class="btn" @click="swap">Swap background and text</button>
      </div>

      <div class="contrast" aria-labelledby="contrast-h">
        <h3 id="contrast-h">Paragraph contrast, worst case</h3>
        <p class="ratio"><span class="ratio-num">{{ ratioText(contrast.worst) }}</span><span class="ratio-unit">:1</span></p>
        <ul class="badges">
          <li v-for="b in badges" :key="b.label" class="badge" :class="b.pass ? 'pass' : 'fail'">
            <span aria-hidden="true" class="badge-icon">{{ b.pass ? '✓' : '✕' }}</span>
            <span>{{ b.pass ? 'Pass' : 'Fail' }}</span>
            <span class="badge-label">{{ b.label }} ({{ b.min }}:1)</span>
          </li>
        </ul>
        <div class="fixes">
          <button v-for="f in fixes" :key="f.name" type="button" class="btn" :class="{ primary: !f.ok }" :disabled="f.ok" @click="applyFix(f.target)">
            {{ f.ok ? `${f.name} passes, nothing to fix` : `Fix contrast for ${f.name} (${f.target}:1)` }}
          </button>
        </div>
        <p class="fix-msg" role="status">
          <template v-if="lastFix?.measure === 'wcag' && lastFix.heading !== undefined && !lastFix.reached">
            Could not reach {{ lastFix.target }}:1 for the paragraph and {{ largeTarget(lastFix.target) }}:1 for the heading with these colors. {{ lastFix.changed }} Best found: paragraph {{ ratioText(lastFix.ratio) }}:1, heading {{ ratioText(lastFix.heading) }}:1, now applied. Try another background or palette.
          </template>
          <template v-else-if="lastFix?.measure === 'wcag' && lastFix.heading !== undefined">Fixed. {{ lastFix.changed }} Paragraph {{ ratioText(lastFix.ratio) }}:1, heading {{ ratioText(lastFix.heading) }}:1.</template>
          <template v-else-if="lastFix?.measure === 'wcag' && !lastFix.reached">
            Could not reach {{ lastFix.target }}:1 with these colors. {{ lastFix.changed }} Best found: {{ ratioText(lastFix.ratio) }}:1, now applied. Try another background or palette.
          </template>
          <template v-else-if="lastFix?.measure === 'wcag'">Fixed. {{ lastFix.changed }} Now {{ ratioText(lastFix.ratio) }}:1.</template>
        </p>
        <dl class="surfaces">
          <div><dt>On the plate</dt><dd>{{ ratioText(contrast.onPlate) }}:1</dd></div>
          <div><dt>Directly on the pattern</dt><dd>{{ ratioText(contrast.direct) }}:1</dd></div>
          <div v-if="contrast.onFill !== null"><dt>On the fill</dt><dd>{{ ratioText(contrast.onFill) }}:1</dd></div>
          <div v-if="contrast.onAccent !== null"><dt>On the accent</dt><dd>{{ ratioText(contrast.onAccent) }}:1</dd></div>
          <div class="info"><dt>Pattern visibility <span class="tag">informational</span></dt><dd>{{ ratioText(contrast.pattern) }}:1</dd></div>
        </dl>
        <p v-if="plateMode === 'split'" class="badge heading-line" :class="contrast.heading === 'fail' ? 'fail' : 'pass'">
          <span aria-hidden="true" class="badge-icon">{{ contrast.heading === 'fail' ? '✕' : '✓' }}</span>
          <span>{{ contrast.heading === 'fail' ? 'Fail' : `Pass ${contrast.heading}` }}</span>
          <span class="badge-label">Heading on the pattern: {{ ratioText(contrast.direct) }}:1, large text (AA 3:1, AAA 4.5:1)</span>
        </p>
        <p class="pattern-warn" role="status">
          <template v-if="contrast.patternInvisible">
            <span class="warn-icon" aria-hidden="true">!</span>
            The pattern is almost invisible on this background ({{ ratioText(contrast.pattern) }}:1). Pick a different pattern color or raise its opacity.
          </template>
        </p>
        <p class="note">Text on the pattern crosses both the background and the strokes, so the lower ratio is the one a reader gets. A plate hides part of the pattern behind the text, so the large number counts the surface the paragraph really sits on: the plate, or the pattern in "Text on the pattern" mode. The pattern itself is decorative and exempt from WCAG 1.4.11; its ratio only tells you how visible it is.</p>

        <p class="links">
          WCAG 2.2:
          <a href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html">1.4.3 Contrast (minimum)</a>,
          <a href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html">1.4.6 Contrast (enhanced)</a>,
          <a href="https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html">1.4.11 Non-text contrast</a>
        </p>
      </div>
    </div>
  </UiSection>

  <UiSection title="Text plate" heading-id="plate-h" :summary="plateSummary">
    <fieldset class="plate-group">
      <legend class="visually-hidden">Text plate</legend>
      <div class="radios">
        <label v-for="m in modes" :key="m.value" class="radio">
          <input v-model="plateMode" type="radio" name="plate-mode" :value="m.value">
          {{ m.label }}
        </label>
      </div>
      <div class="field">
        <label for="plate-opacity">Plate opacity <output for="plate-opacity">{{ Math.round(plateOpacity * 100) }}%</output></label>
        <input id="plate-opacity" v-model.number="plateOpacity" type="range" min="0" max="1" step="0.01" :disabled="plateMode === 'direct'">
      </div>
      <div class="field">
        <label for="plate-radius">Corner radius <output for="plate-radius">{{ plateRadius }} px</output></label>
        <input id="plate-radius" v-model.number="plateRadius" type="range" min="0" max="32" step="1" :disabled="plateMode === 'direct'">
      </div>
      <div class="field">
        <label for="plate-blur">Blur behind the plate <output for="plate-blur">{{ plateBlur }} px</output></label>
        <input id="plate-blur" v-model.number="plateBlur" type="range" min="0" max="12" step="1" aria-describedby="plate-blur-hint" :disabled="plateMode === 'direct'">
        <p id="plate-blur-hint" class="hint-text">Blur costs rendering work on your visitor's device. Keep it at 0 unless you need it.</p>
      </div>
    </fieldset>
  </UiSection>

  <UiSection title="APCA™ Lc value" heading-id="apca-h" :summary="lcText(apcaWorstLc)">
    <div class="apca">
      <p class="apca-lc"><strong>{{ lcText(apcaWorstLc) }}</strong>, {{ polarity(apcaWorstLc) }}, worst case <span class="tag">informational</span></p>
      <dl class="surfaces">
        <div class="info"><dt>On the plate</dt><dd>{{ lcText(contrast.apca.onPlate) }}</dd></div>
        <div class="info"><dt>Directly on the pattern</dt><dd>{{ lcText(contrast.apca.direct) }}</dd></div>
        <div v-if="contrast.apca.onFill !== null" class="info"><dt>On the fill</dt><dd>{{ lcText(contrast.apca.onFill) }}</dd></div>
        <div v-if="contrast.apca.onAccent !== null" class="info"><dt>On the accent</dt><dd>{{ lcText(contrast.apca.onAccent) }}</dd></div>
      </dl>
      <div class="apca-raise">
        <label for="apca-target">Raise target</label>
        <select id="apca-target" v-model.number="apcaTarget">
          <option v-for="[lc, what] in APCA_TARGETS" :key="lc" :value="lc">Lc {{ lc }}: {{ what }}</option>
        </select>
        <button type="button" class="btn" :disabled="apcaReached" @click="applyFix(apcaTarget, 'apca')">
          {{ apcaReached ? `Lc ${apcaTarget} reached` : `Raise to Lc ${apcaTarget}` }}
        </button>
      </div>
      <p class="fix-msg" role="status">
        <template v-if="lastFix?.measure === 'apca' && !lastFix.reached">
          Could not reach Lc {{ lastFix.target }}<template v-if="lastFix.heading !== undefined"> for the paragraph and Lc {{ APCA_SCORE.lower(lastFix.target) }} for the heading</template> with these colors. {{ lastFix.changed }} Best found: <template v-if="lastFix.heading !== undefined">paragraph {{ lcText(lastFix.ratio) }}, heading {{ lcText(lastFix.heading) }}</template><template v-else>{{ lcText(lastFix.ratio) }}</template>, now applied. Try another background or palette.
        </template>
        <template v-else-if="lastFix?.measure === 'apca' && lastFix.heading !== undefined">Raised. {{ lastFix.changed }} Paragraph {{ lcText(lastFix.ratio) }}, heading {{ lcText(lastFix.heading) }}.</template>
        <template v-else-if="lastFix?.measure === 'apca'">Raised. {{ lastFix.changed }} Now {{ lcText(lastFix.ratio) }}.</template>
      </p>
      <p class="hint-text">
        APCA™ is the candidate contrast method for WCAG 3, and is currently in public beta. WCAG 3 is still in development and subject to changes prior to adoption. (<a href="https://www.w3.org/TR/wcag-3.0/#visual-contrast-of-text">WCAG 3 visual contrast of text</a>.) APCA is not part of WCAG 2: the WCAG 2.2 result above is the check of this tool, and Lc is not a pass or fail.
        Lc is signed: positive for dark text on light, negative for light text on dark. Text is the first color, background the second; if you swap them, check again.
      </p>
      <details open>
        <summary>APCA guidance levels</summary>
        <ul class="apca-levels">
          <li v-for="[lc, what] in APCA_LEVELS" :key="lc">Lc {{ lc }}: {{ what }}</li>
        </ul>
        <p class="hint-text">Absolute Lc values; sizes for Arial or Helvetica at weight 400. See <a href="https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell">APCA in a Nutshell</a> for other sizes and weights.</p>
      </details>
      <p class="hint-text">
        Computed with apca-w3 {{ APCA_VERSION }}, unmodified, under its <a href="https://github.com/Myndex/apca-w3/blob/master/LICENSE.md">own license</a> (not MIT). APCA™ is a trademark of Myndex Research and Andrew Somers. APCA is a method for predicting text contrast on self-illuminated displays for web-based content. Some use-cases are prohibited by license, including the following: use in medical, clinical evaluation, human safety related, aerospace, transportation, automotive, military applications, are strictly prohibited without a specific license in writing granting such use.
        <a href="https://git.apcacontrast.com/documentation/WhyAPCA">Why APCA</a> ·
        <a href="https://git.apcacontrast.com/">APCA documentation</a> ·
        <a href="https://github.com/Myndex/SAPC-APCA/discussions">APCA discussion forum</a>
      </p>
    </div>
  </UiSection>

  <UiSection title="Start from a palette" heading-id="palettes-h" :summary="paletteName || 'custom colors'">
    <p class="muted">Picking one assigns the strongest pair to background and text, or on a dark palette the dark paper to the background. The palettes follow studies of color preference: close hues, cool grounds, saturated figures on calm grounds.</p>
    <button type="button" class="btn random-palette" @click="randomPalette">Random palette</button>
    <template v-for="g in PALETTE_GROUPS" :key="g.label">
      <h3 :id="`palettes-${g.label}`" class="palette-group">{{ g.label }}</h3>
      <ul class="palettes" :aria-labelledby="`palettes-${g.label}`">
        <li v-for="p in g.palettes" :key="p.name">
          <button type="button" class="palette" :aria-pressed="paletteName === p.name" @click="applyPalette(p)">
            <span class="swatches" aria-hidden="true">
              <span v-for="c in p.colors" :key="c" :style="{ backgroundColor: c }"></span>
            </span>
            <span class="palette-name">
              <span v-if="paletteName === p.name" class="selected-mark" aria-hidden="true">✓</span>{{ p.name }}
            </span>
          </button>
        </li>
      </ul>
    </template>
  </UiSection>
</template>
