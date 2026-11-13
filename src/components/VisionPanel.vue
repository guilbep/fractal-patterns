<script setup lang="ts">
import { computed } from 'vue';
import { blend } from '@/contrast.ts';
import { contrast, fill, opacity, plateMode, plateOpacity, ratioText, roles } from '@/state.ts';
import { CVD_LABELS, betweenSurfaces, cvdReport, effectiveOpacity, lightnessDiff, type LightnessDiff } from '@/vision.ts';

// The paragraph sits on the plate in 'plate' and 'split', the heading only in 'plate'.
const paraOpacity = computed(() => (plateMode.value === 'direct' ? opacity.value : effectiveOpacity(opacity.value, plateOpacity.value)));
const headOpacity = computed(() => (plateMode.value === 'plate' ? paraOpacity.value : opacity.value));

// The fill counts where the main panel shows "On the fill".
const shownFill = computed(() => (contrast.value.onFill === null ? null : { color: fill.color, opacity: fill.opacity }));

const POLARITY: Record<LightnessDiff['polarity'], string> = {
  'dark-on-light': 'dark text on light',
  'light-on-dark': 'light text on dark',
  same: 'same lightness',
};
const rows = computed(() => {
  const f = shownFill.value;
  return [
    { label: 'Text on the background', diff: lightnessDiff(roles.text, roles.background) },
    { label: 'Text on the pattern strokes', diff: lightnessDiff(roles.text, blend(roles.pattern, roles.background, paraOpacity.value)) },
    ...(f ? [{ label: 'Text on the fill', diff: lightnessDiff(roles.text, blend(f.color, roles.background, f.opacity)) }] : []),
  ];
});

// In 'plate' and 'direct' both texts share one surface, so one hit concerns both.
const between = computed(() => {
  const p = betweenSurfaces(roles, paraOpacity.value, shownFill.value);
  const h = betweenSurfaces(roles, headOpacity.value, shownFill.value);
  return p && h ? 'paragraph and the heading' : p ? 'paragraph' : h ? 'heading' : null;
});

const SWATCHES = [
  { key: 'background', label: 'Background' },
  { key: 'pattern', label: 'Pattern' },
  { key: 'text', label: 'Text' },
] as const;
const cvd = computed(() => cvdReport(roles, paraOpacity.value, shownFill.value).map((c) => ({ ...c, pass: c.text >= 4.5 })));
</script>

<template>
  <section class="panel" aria-labelledby="vision-h">
    <h2 id="vision-h">Second opinion</h2>
    <p class="lede">WCAG 2.2 decides pass or fail. These checks show what the ratio does not.</p>

    <h3 id="lightness-h">Lightness difference</h3>
    <div class="table-wrap">
      <table aria-labelledby="lightness-h">
        <thead>
          <tr><th scope="col">Surface</th><th scope="col">L* difference</th><th scope="col">Polarity</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.label">
            <th scope="row">{{ r.label }}</th>
            <td class="num">{{ Math.round(r.diff.value) }}</td>
            <td>{{ POLARITY[r.diff.polarity] }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="note">A larger difference is easier to read. This number is a guide, not a pass or fail.</p>

    <p class="pattern-warn" role="status">
      <template v-if="between">
        <span class="warn-icon" aria-hidden="true">!</span>
        <span>Concerns the {{ between }}. The text brightness sits between the background and the strokes. The ratio can pass while strokes of the opposite brightness cross the letters. Make the text darker or lighter than both.</span>
      </template>
    </p>

    <h3 id="cvd-h">Color vision preview</h3>
    <ul class="cvd" aria-labelledby="cvd-h">
      <li v-for="c in cvd" :key="c.type" class="cvd-row">
        <span class="cvd-label">{{ CVD_LABELS[c.type] }}</span>
        <span class="cvd-swatches">
          <span v-for="s in SWATCHES" :key="s.key" class="cvd-swatch">
            <span class="chip" role="img" :aria-label="`${s.label} ${c.roles[s.key]}`" :title="`${s.label} ${c.roles[s.key]}`" :style="{ backgroundColor: c.roles[s.key] }"></span>
            <code aria-hidden="true">{{ c.roles[s.key] }}</code>
          </span>
          <span v-if="c.fill" class="cvd-swatch">
            <span class="chip" role="img" :aria-label="`Fill ${c.fill}`" :title="`Fill ${c.fill}`" :style="{ backgroundColor: c.fill }"></span>
            <code aria-hidden="true">{{ c.fill }}</code>
          </span>
        </span>
        <span class="badge" :class="c.pass ? 'pass' : 'fail'">
          <span aria-hidden="true" class="badge-icon">{{ c.pass ? '✓' : '✕' }}</span>
          <span>{{ c.pass ? 'Pass' : 'Fail' }}</span>
          <span class="badge-label">paragraph {{ ratioText(c.text) }}:1 (AA 4.5:1)</span>
        </span>
      </li>
    </ul>
    <p class="note">Simulation after Machado, Oliveira and Fernandes (2009), at full severity.</p>

    <p class="links">
      The Colors panel also shows the APCA™ Lc value, for information only. APCA™ is the candidate contrast method for WCAG 3, and is currently in public beta. WCAG 3 is still in development and subject to changes prior to adoption. APCA is not part of WCAG 2.
      <a href="https://git.apcacontrast.com/">Read about APCA</a>
    </p>
  </section>
</template>

<style scoped>
.table-wrap { max-inline-size: 100%; overflow-x: auto; margin: 0 0 var(--s2); }
table { inline-size: 100%; border-collapse: collapse; font-size: 0.9375rem; }
th, td { text-align: left; padding: var(--s1) var(--s2); border-bottom: 1px solid var(--line); vertical-align: baseline; }
thead th { color: var(--muted); font-weight: 600; }
tbody th { font-weight: 400; }
.num { font-variant-numeric: tabular-nums; font-weight: 600; }

.cvd { list-style: none; padding: 0; margin: 0 0 var(--s2); display: grid; gap: var(--s2); }
.cvd-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s1) var(--s3);
  min-inline-size: 0;
  padding-bottom: var(--s2);
  border-bottom: 1px solid var(--line);
}
.cvd-label { flex: 1 1 10rem; min-inline-size: 0; font-weight: 600; }
.cvd-swatches { display: flex; flex-wrap: wrap; gap: var(--s2); min-inline-size: 0; }
.cvd-swatch { display: inline-flex; align-items: center; gap: var(--s1); }
.chip {
  flex: none;
  inline-size: 1.25rem;
  block-size: 1.25rem;
  border: 1px solid var(--line);
  border-radius: 0.2rem;
}
code { font-family: var(--mono); font-size: 0.8125rem; color: var(--muted); }
.cvd-row .badge { flex-wrap: wrap; min-inline-size: 0; }
</style>
