import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist-electron',
    emptyOutDir: false,
    target: 'node18',
    minify: false,
    rollupOptions: {
      input: resolve(__dirname, 'electron/main.ts'),
      external: ['electron', 'path', 'url', 'fs', 'os'],
      output: {
        entryFileNames: 'main.js',
        format: 'es',
      },
    },
  },
});

