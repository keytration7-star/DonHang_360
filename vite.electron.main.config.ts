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
      external: [
        'electron',
        'path',
        'url',
        'fs',
        'os',
        'crypto',
        'events',
        'zlib',
        'http',
        'https',
        'child_process',
        'stream',
        'util',
        'assert',
        'constants',
        'electron-updater'
      ],
      output: {
        entryFileNames: 'main.js',
        format: 'cjs', // Đổi sang CommonJS để tương thích với electron-updater
      },
    },
  },
});

