import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app-1.0.0.js',
        assetFileNames: 'assets/app-1.0.0.[ext]',
      },
    },
  },
  server: {
    port: 4173,
  },
});
