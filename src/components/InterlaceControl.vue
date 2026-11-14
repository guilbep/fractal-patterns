<script setup lang="ts">
import { computed } from 'vue';
import UiSwitch from '@/components/UiSwitch.vue';
import { INTERLACE_DEFAULTS } from '@/share.ts';

// The ranges are decodeInterlace's in share.ts. The page state comes in as props: importing state.ts here would split the start chunks (see RegionsControl.vue).
// reason: interlaceOffReason in state.ts ('fill', or a region colour reason, said here for interlace); touch: no crossing.
// auto: the ribbon width by density (autoWidth in interlace-tile.ts), used while the width is the default (no iw in the link).
const props = defineProps<{ on: boolean; width: number; gap: number; odd: number; reason: string; touch: boolean; auto?: number }>();
const isAuto = computed(() => props.width === INTERLACE_DEFAULTS.width && (props.auto ?? 0) > 0);
const emit = defineEmits<{ set: [value: { on?: boolean; width?: number; gap?: number }] }>();
const said = computed(() =>
  props.reason === 'fill'
    ? 'Interlace draws lines only; set the fill to none to use it.'
    : props.reason
      ? props.reason.replace(/^Region colors (work|do)/, (_, v: string) => `Interlace ${v}${v === 'do' ? 'es' : 's'}`).replace('them.', 'it.')
      : props.touch
        ? "Interlace needs crossing lines; this pattern's lines only touch."
        : '',
);
</script>

<template>
  <div class="fields pattern-card interlace">
    <UiSwitch id="il-on" :model-value="on" label="Interlace" hint="Lines pass over and under in turn at every crossing." :disabled="!!said && !on" @update:model-value="emit('set', { on: $event })" />
    <p v-if="said" class="hint-text">{{ said }}</p>
    <template v-else-if="on">
      <div class="field">
        <label for="il-width">Ribbon width <output for="il-width">{{ isAuto ? `auto · ${auto} px` : `${width} px` }}</output></label>
        <input id="il-width" :value="isAuto ? auto : width" type="range" min="2" max="16" step="0.5" @input="emit('set', { width: +($event.target as HTMLInputElement).value })">
      </div>
      <div class="field">
        <label for="il-gap">Gap <output for="il-gap">{{ gap }} px</output></label>
        <input id="il-gap" :value="gap" type="range" min="0" max="8" step="0.5" @input="emit('set', { gap: +($event.target as HTMLInputElement).value })">
      </div>
      <p v-if="odd" role="status" class="hint-text">{{ odd }} strands cannot alternate here; they are drawn without gaps.</p>
    </template>
  </div>
</template>
