import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths work for both repository Pages URLs and user sites.
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
