<script setup lang="ts">
// "Send to my phone": a modal with a QR code of the design's link (Esc and Close shut it, focus goes back to the opener).
// The QR encoder loads on first open, so the start JavaScript does not carry it.
import { ref, useId } from 'vue';
import { copyText } from '@/clipboard.ts';

const dlg = ref<HTMLDialogElement | null>(null);
const headId = useId();
const link = ref('');
const qr = ref('');
const status = ref('');
let opener: HTMLElement | null = null;

async function open(from: HTMLElement, url: string): Promise<void> {
  opener = from;
  link.value = url;
  status.value = '';
  qr.value = '';
  dlg.value?.showModal();
  try {
    const { qrSvg } = await import('@/qr.ts');
    // Dark on white whatever the theme: a QR code needs its contrast.
    qr.value = qrSvg(url, { title: "QR code for this design's link", dark: '#000', light: '#fff' });
  } catch {
    status.value = 'The QR code could not be made. Copy the link instead.';
  }
}
async function copy(): Promise<void> {
  status.value = (await copyText(link.value)) ? 'Link copied.' : 'Could not copy. Select the link and copy it.';
}
defineExpose({ open });
</script>

<template>
  <!-- Esc must not reach the page: Studio and Builder close the Use it view on it. The dialog still closes. -->
  <dialog
    ref="dlg"
    class="sheet qr-dialog"
    :aria-labelledby="headId"
    @close="opener?.focus()"
    @click.self="dlg?.close()"
    @keydown.esc.stop
  >
    <div class="sheet-body">
      <div class="sheet-head">
        <h2 :id="headId">Send to my phone</h2>
        <button type="button" class="sheet-close" aria-label="Close" @click="dlg?.close()"><span aria-hidden="true">×</span></button>
      </div>
      <div class="qr-code" v-html="qr"></div>
      <p class="qr-text">Scan with your phone camera. The link opens this design; your phone makes the PNG itself. Nothing is uploaded.</p>
      <label class="qr-link">
        Link
        <input type="text" readonly :value="link" @focus="($event.target as HTMLInputElement).select()" />
      </label>
      <button type="button" class="btn" @click="copy">Copy link</button>
      <p class="sheet-status" role="status">{{ status }}</p>
    </div>
  </dialog>
</template>
