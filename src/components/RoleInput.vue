<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Roles } from '@/pairing.ts';
import { fill, palette, roles, setFillColor, setRole } from '@/state.ts';

// 'fill': the color of the filled closed shapes, kept outside the three roles.
type Role = keyof Roles | 'fill';
const props = defineProps<{ role: Role; label: string; hint: string }>();

// Roles this role must not share a color with: same color hides the pattern or the text.
const CLASHES: Record<Role, (keyof Roles)[]> = { background: ['pattern', 'text'], pattern: ['background'], text: ['background'], fill: ['background'] };
const NAMES: Record<keyof Roles, string> = { background: 'Background', pattern: 'Pattern', text: 'Text' };
function usedBy(c: string): string | undefined {
  const k = CLASHES[props.role].find((o) => roles[o] === c);
  return k && NAMES[k];
}
const value = (r: Role): string => (r === 'fill' ? fill.color : roles[r]);
const set = (r: Role, hex: string): void => (r === 'fill' ? setFillColor(hex) : setRole(r, hex));

const draft = ref(value(props.role));
const invalid = ref(false);
// Resync from state only for full valid values, so a half-typed hex is never overwritten.
watch(
  () => value(props.role),
  (v) => {
    if (v !== draft.value.toLowerCase()) draft.value = v;
    invalid.value = false;
  },
);

function onHex(value: string): void {
  draft.value = value;
  const hex = (value.startsWith('#') ? value : `#${value}`).toLowerCase();
  invalid.value = !/^#[0-9a-f]{6}$/.test(hex);
  if (!invalid.value) set(props.role, hex);
}
</script>

<template>
  <fieldset class="role">
    <legend>{{ label }} <span class="muted">{{ hint }}</span></legend>
    <div class="role-row">
      <label class="visually-hidden" :for="`${role}-picker`">{{ label }} color picker</label>
      <input :id="`${role}-picker`" class="picker" type="color" :value="value(role)" @input="set(role, ($event.target as HTMLInputElement).value)">
      <label class="hex-label" :for="`${role}-hex`">Hex</label>
      <input
        :id="`${role}-hex`"
        class="hex"
        type="text"
        inputmode="text"
        autocomplete="off"
        spellcheck="false"
        maxlength="7"
        :value="draft"
        :aria-invalid="invalid"
        :aria-describedby="invalid ? `${role}-err` : undefined"
        @input="onHex(($event.target as HTMLInputElement).value)"
        @blur="draft = value(role); invalid = false"
      >
    </div>
    <p v-if="invalid" :id="`${role}-err`" class="error">Use 6 hex digits, like #1d1e22.</p>
    <div v-if="palette" class="chips" role="group" :aria-label="`${palette.name} colors for ${label.toLowerCase()}`">
      <button
        v-for="c in palette.colors"
        :key="c"
        type="button"
        class="chip"
        :style="{ backgroundColor: c }"
        :aria-pressed="value(role) === c"
        :disabled="!!usedBy(c)"
        :aria-label="usedBy(c) ? `${c}, already used by ${usedBy(c)}` : `Use ${c}`"
        :title="usedBy(c) ? `${c}, already used by ${usedBy(c)}` : c"
        @click="set(role, c)"
      ><span v-if="value(role) === c" class="chip-mark" aria-hidden="true">✓</span></button>
    </div>
  </fieldset>
</template>
