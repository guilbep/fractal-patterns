<script setup lang="ts">
// The phone bottom sheet behind the Palette cell: a modal dialog (Esc and Close shut it, focus goes back to the opener).
import { ref, useId } from 'vue';

defineProps<{ title: string }>();
const dlg = ref<HTMLDialogElement | null>(null);
const headId = useId();
let opener: HTMLElement | null = null;
function open(from: HTMLElement): void {
  opener = from;
  dlg.value?.showModal();
}
// close(false): the caller moves focus itself (the close event comes a task later and would take it back).
function close(back = true): void {
  if (!back) opener = null;
  dlg.value?.close();
}
defineExpose({ open, close });
</script>

<template>
  <!-- A click on the backdrop lands on the dialog itself (the content fills its box), so it closes. -->
  <dialog ref="dlg" class="sheet" :aria-labelledby="headId" @close="opener?.focus()" @click.self="close()">
    <div class="sheet-body">
      <span class="sheet-handle" aria-hidden="true"></span>
      <div class="sheet-head">
        <h2 :id="headId">{{ title }}</h2>
        <button type="button" class="sheet-close" aria-label="Close" @click="close()"><span aria-hidden="true">×</span></button>
      </div>
      <slot />
    </div>
  </dialog>
</template>

<style>
.sheet {
  inset: auto 0 0;
  width: 100%;
  max-width: 100%;
  max-height: 85dvh;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 16px 16px 0 0;
  background: var(--surface);
  color: var(--ink);
}
.sheet::backdrop {
  background: rgba(0, 0, 0, 0.4);
}
.sheet-body {
  display: grid;
  gap: 12px;
  padding: 8px 16px calc(16px + env(safe-area-inset-bottom, 0px));
}
.sheet-handle {
  justify-self: center;
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: var(--line);
}
.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sheet-head h2 {
  margin: 0;
  font-size: 1.125rem;
}
.sheet-close {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--sunk);
  color: var(--ink);
  font-size: 22px;
  cursor: pointer;
}
.sheet-close:focus-visible,
.sheet .btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
/* The full strip (‹, swatches, name, ›, dice) at touch size: the phone toolbar rules hid the name. */
.sheet .palette-strip {
  display: flex;
  height: 52px;
  padding: 0 4px;
}
.sheet .palette-strip .swatches {
  block-size: 28px;
}
.sheet .palette-strip .swatch {
  width: 24px;
  height: 28px;
}
.sheet .palette-strip .palette-name {
  position: static;
  flex: 1;
  width: auto;
  height: auto;
  clip-path: none;
  font-size: 15px;
}
.sheet .palette-strip .icon-btn {
  width: 44px;
  height: 44px;
}
.sheet-more {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.sheet-more h3 {
  grid-column: 1 / -1;
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 0.8125rem;
  font-weight: 600;
}
.sheet-more .btn {
  justify-content: center;
  min-height: 44px;
}
.sheet-status {
  min-height: 1.25em;
  margin: 0;
  color: var(--muted);
  font-size: 0.875rem;
}
/* "Use it" on phones (design board Mobile-Builder): taller, a 20 px title, the device preview above the steps. */
.sheet.sheet-use {
  max-height: 92dvh;
  overscroll-behavior: contain;
  box-shadow: 0 -4px 20px rgba(23, 24, 28, 0.2);
}
.sheet-use::backdrop {
  background: rgba(23, 24, 28, 0.4);
}
.sheet-use .sheet-handle {
  width: 36px;
}
.sheet-use .sheet-head h2 {
  font-size: 1.25rem;
}
.sheet-use .use-stage {
  position: relative;
  inset: auto;
  z-index: auto;
  height: 200px;
  padding: 8px;
  border-radius: 10px;
}
.sheet-use .use-it-panel,
.sheet-use .studio-use {
  min-width: 0;
}
</style>
