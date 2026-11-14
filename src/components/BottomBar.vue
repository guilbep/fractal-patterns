<script setup lang="ts">
// Phones (below 600 px, design boards Mobile-*): the page's main actions in one fixed row at the bottom.
// The page passes its five cells; above 600 px the bar is not shown and the top toolbar does the job.
defineProps<{ label: string }>();
</script>

<template>
  <div class="bottom-bar" role="toolbar" :aria-label="label"><slot /></div>
</template>

<style>
.bottom-bar {
  display: none;
}
/* Above 600 px the phone-only copies (preview chips) stay out of the page. */
@media (min-width: 600px) {
  .phone-only {
    display: none !important;
  }
}
@media (max-width: 599.98px) {
  body {
    padding-bottom: calc(76px + env(safe-area-inset-bottom, 0px));
  }
  .bottom-bar {
    position: fixed;
    inset: auto 0 0;
    z-index: 5;
    display: grid;
    grid-template-columns: var(--bar-cols, 1.6fr 1fr 1fr 1fr 1.6fr);
    gap: 8px;
    padding: 12px 12px calc(12px + env(safe-area-inset-bottom, 0px));
    background: var(--surface);
    border-top: 1px solid var(--hairline);
  }
  .bottom-bar > * {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-width: 0;
    height: 52px;
    min-height: 52px;
    box-sizing: border-box;
    margin: 0;
    padding: 0 4px;
    border: 1px solid var(--ink);
    border-radius: 8px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-size: 14px;
    font-weight: 650;
    line-height: 1.1;
    white-space: nowrap;
    text-align: center;
    cursor: pointer;
  }
  .bottom-bar > select {
    appearance: none;
    font-weight: 400;
  }
  .bottom-bar > :disabled {
    border-style: dashed;
    border-color: var(--line);
    color: var(--muted);
    cursor: default;
  }
  .bottom-bar > .primary {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--accent-ink);
  }
  .bottom-bar > .primary:disabled {
    opacity: 0.5;
  }
  .bottom-bar > .ink {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--page);
  }
  .bottom-bar > :focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  /* The Palette cell: four squares of the current palette. */
  .bar-swatches {
    display: grid;
    grid-template-columns: 1fr 1fr;
    width: 22px;
    height: 22px;
    overflow: hidden;
    border-radius: 4px;
  }
}
</style>
