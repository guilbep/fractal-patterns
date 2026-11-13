<script setup lang="ts">
// One header for both tools: product brand, the tool switch, the current tool's tagline, a GitHub link.
import { APP_NAME } from '@/app-name.ts';
import { LOGO_DEFAULT, builderLogoSvg, logoSvg, studioLogoSvg } from '@/logo.ts';
import { svgToDataUri } from '@/css.ts';
import '@/css/site-header.css';

withDefaults(defineProps<{ current: 'patterns' | 'studio' | 'builder'; patternsHref: string; studioHref: string; builderHref?: string; tagline: string }>(), {
  builderHref: './builder.html',
});

const LOGO_URI = svgToDataUri(logoSvg(LOGO_DEFAULT));
const STUDIO_URI = svgToDataUri(studioLogoSvg());
const BUILDER_URI = svgToDataUri(builderLogoSvg());
</script>

<template>
  <header class="site-header">
    <p class="brand"><img class="logo" :src="LOGO_URI" alt="" width="28" height="28"><span class="brand-name">{{ APP_NAME }}</span></p>
    <nav aria-label="Tools" class="tool-switch">
      <a :href="patternsHref" :aria-current="current === 'patterns' ? 'page' : undefined" @click="current === 'patterns' && $event.preventDefault()"><img :src="LOGO_URI" alt="" aria-hidden="true" width="20" height="20">Patterns</a>
      <a :href="studioHref" :aria-current="current === 'studio' ? 'page' : undefined" @click="current === 'studio' && $event.preventDefault()"><img :src="STUDIO_URI" alt="" aria-hidden="true" width="20" height="20"><span class="label-long">Wallpaper </span>Studio</a>
      <a :href="builderHref" :aria-current="current === 'builder' ? 'page' : undefined" @click="current === 'builder' && $event.preventDefault()"><img :src="BUILDER_URI" alt="" aria-hidden="true" width="20" height="20">Builder</a>
    </nav>
    <p class="tagline">{{ tagline }}</p>
    <a class="repo-link" href="https://github.com/guilbep/patterns">GitHub</a>
  </header>
</template>
