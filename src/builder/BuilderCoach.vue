<script setup lang="ts">
// The first-run coach: three short steps over the stage, non-modal. Skip, Done or Esc end it for good.
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { COACH_KEY, COACH_STEPS, nextStep, shouldShowCoach } from './coach.ts';
import { defaultDesign, design } from './store.ts';

function stored(): string | null {
  try {
    return localStorage.getItem(COACH_KEY);
  } catch {
    return null;
  }
}

const step = ref<number | null>(shouldShowCoach(stored(), JSON.stringify(design.value) === JSON.stringify(defaultDesign()), false) ? 0 : null);
const nextBtn = ref<HTMLButtonElement | null>(null);

function finish(): void {
  step.value = null;
  try {
    localStorage.setItem(COACH_KEY, 'done');
  } catch {
    /* storage blocked: the coach shows again on the next page load */
  }
}
function next(): void {
  step.value = nextStep(step.value ?? 0);
  if (step.value === null) finish();
}
function onKey(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return;
  e.stopPropagation();
  finish();
}

// A design opened from a file ("Open a design file" in Use it) is not a first visit: end the coach for good.
function onFileOpen(e: Event): void {
  if ((e.target as HTMLElement | null)?.id === 'open-design' && step.value !== null) finish();
}
onMounted(async () => {
  document.addEventListener('change', onFileOpen, true);
  await nextTick();
  nextBtn.value?.focus({ preventScroll: true });
});
onBeforeUnmount(() => document.removeEventListener('change', onFileOpen, true));
</script>

<template>
  <div v-if="step !== null" class="coach" role="dialog" aria-label="Builder tour" @keydown="onKey">
    <div class="coach-head">
      <span class="coach-step">Step {{ step + 1 }} of {{ COACH_STEPS.length }} · {{ COACH_STEPS[step]!.title }}</span>
      <span class="coach-bar" aria-hidden="true">
        <span v-for="(_, i) in COACH_STEPS" :key="i" :class="{ on: i === step }"></span>
      </span>
    </div>
    <p class="coach-text" aria-live="polite">{{ COACH_STEPS[step]!.text }}</p>
    <div class="coach-actions">
      <button type="button" class="coach-skip" @click="finish">Skip</button>
      <button ref="nextBtn" type="button" class="coach-next" @click="next">
        {{ step + 1 < COACH_STEPS.length ? `Next: ${COACH_STEPS[step + 1]!.title.toLowerCase()}` : 'Done' }}
      </button>
    </div>
  </div>
</template>
