import { createApp, watch } from 'vue';
import '@/css/app.css';
import '@/css/controls.css';
import App from './App.vue';
import { initShare } from './state-share.ts';
import { params, roles, usingImage, usingPatchwork } from './state.ts';
import { LOGO_DEFAULT, logoSvg } from './logo.ts';
import { svgToDataUri } from './css.ts';

createApp(App).mount('#app');
initShare();

// Live favicon: the current kind and seed in the current colors. Image and patchwork keep the last single pattern.
const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
let mark = { kind: LOGO_DEFAULT.kind, seed: LOGO_DEFAULT.seed };
if (icon)
  watch(
    () => [params.kind, params.seed, roles.background, roles.pattern, usingImage.value || usingPatchwork.value] as const,
    ([kind, seed, background, color, other]) => {
      if (!other) mark = { kind, seed };
      icon.href = svgToDataUri(logoSvg({ ...mark, background, color }));
    },
    { immediate: true },
  );
