import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
      '@runtime-lab/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
    },
  },
  build: {
    // The modulepreload polyfill uses fetch(), which our CSP connect-src would block.
    modulePreload: { polyfill: false },
  },
  plugins: [
    tanstackStart({
      // Static SPA: no SSR server is deployed. The build prerenders one shell HTML file.
      spa: { enabled: true, prerender: { outputPath: '/index.html' } },
    }),
    viteReact(),
    tailwindcss(),
  ],
});
