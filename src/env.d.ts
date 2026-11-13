/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent;
  export default component;
}

/** apca-w3 version, set by `define` in vite.config.ts. */
declare const __APCA_VERSION__: string;
