import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist-electron',
    emptyOutDir: true,
    target: 'node18',
    minify: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'electron/main.ts'),
        preload: resolve(__dirname, 'electron/preload.ts'),
      },
      external: ['electron', 'path', 'url', 'fs', 'os'],
      output: {
        entryFileNames: '[name].js',
        format: 'cjs', // Use CommonJS for both to ensure compatibility
      },
    },
  },
});

