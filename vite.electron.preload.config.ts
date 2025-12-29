import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist-electron',
    emptyOutDir: false,
    target: 'node18',
    minify: false,
    rollupOptions: {
      input: resolve(__dirname, 'electron/preload.ts'),
      external: ['electron'],
      output: {
        entryFileNames: 'preload.js',
        format: 'cjs',
      },
    },
  },
});

