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
    rolldownOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        studio: fileURLToPath(new URL('./studio.html', import.meta.url)),
        builder: fileURLToPath(new URL('./builder.html', import.meta.url)),
      },
    },
  },
});
