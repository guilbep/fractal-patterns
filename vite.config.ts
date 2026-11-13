import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  base: './',
  define: {
    __APCA_VERSION__: JSON.stringify(
      JSON.parse(readFileSync(new URL('./node_modules/apca-w3/package.json', import.meta.url), 'utf8')).version,
    ),
  },
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    target: 'baseline-widely-available',
    // ponytail: no chunk groups. Tried in Nov 2026 (codeSplitting.groups, about 70 lines): one start
    // file less on two pages and about 740 bytes, at the risk of lazy tracers loading a page entry.
    // The real fix is in the source: lazy chunks (tracers, stamps) import modules that a page also
    // loads at start (fractal, simplify, spacing, studio motifs, curvepath). Split those first.
    rolldownOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        studio: fileURLToPath(new URL('./studio.html', import.meta.url)),
        builder: fileURLToPath(new URL('./builder.html', import.meta.url)),
      },
    },
  },
});
