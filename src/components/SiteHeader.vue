<script setup lang="ts">
// One header for both tools: product brand, the tool switch, the current tool's tagline, a GitHub link.
import { APP_NAME } from '@/app-name.ts';
import { ref } from 'vue';
import '@/css/site-header.css';

const props = withDefaults(defineProps<{ current: 'patterns' | 'studio' | 'builder'; patternsHref: string; studioHref: string; builderHref?: string; tagline: string; shortcut?: boolean }>(), {
  builderHref: './builder.html',
});
// The single-key shortcut switch (WCAG 2.1.4) lives in the key panel; Patterns and Studio bind it with v-model:shortcut.
// ponytail: a prop and an emit, not defineModel: defineModel pulls Vue's useModel into the shared start chunk.
const emit = defineEmits<{ 'update:shortcut': [on: boolean] }>();

// The panel (plain DOM, no Vue) is fetched on first open, so it is not in the start JavaScript.
const keysOpen = ref(false);
function openKeys(e: MouseEvent): void {
  keysOpen.value = true;
  const opener = e.currentTarget as HTMLElement;
  void import('@/key-help.ts').then((m) =>
    m.openKeyHelp({
      page: props.current,
      opener,
      shortcut: props.current === 'builder' ? undefined : { get: () => !!props.shortcut, set: (v) => emit('update:shortcut', v) },
      onClose: () => (keysOpen.value = false),
    }),
  );
}

// The marks are the static files that scripts/make-logo.ts writes from src/logo.ts (logo.test.ts pins them).
// Importing logo.ts here would pull every pattern generator into the Studio and the Builder.
// The tool switch has no icons on the design canvas: words only.
const LOGO_URI = './favicon.svg';
</script>

<template>
  <header class="site-header">
    <p class="brand"><img class="logo" :src="LOGO_URI" alt="" width="28" height="28"><span class="brand-name">{{ APP_NAME }}</span></p>
    <nav aria-label="Tools" class="tool-switch">
      <a :href="patternsHref" :aria-current="current === 'patterns' ? 'page' : undefined" @click="current === 'patterns' && $event.preventDefault()">Patterns</a>
      <a :href="studioHref" :aria-current="current === 'studio' ? 'page' : undefined" @click="current === 'studio' && $event.preventDefault()"><span class="label-long">Wallpaper&nbsp;</span>Studio</a>
      <a :href="builderHref" :aria-current="current === 'builder' ? 'page' : undefined" @click="current === 'builder' && $event.preventDefault()">Builder</a>
    </nav>
    <p class="tagline">{{ tagline }}</p>
    <button type="button" class="keys-btn" aria-label="Keyboard shortcuts" aria-haspopup="dialog" :aria-expanded="keysOpen" @click="openKeys">?</button>
    <a class="repo-link" href="https://github.com/guilbep/patterns">GitHub</a>
  </header>
</template>
