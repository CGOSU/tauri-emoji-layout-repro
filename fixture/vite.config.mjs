import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
export default defineConfig({
  root: import.meta.dirname,
  base: '/original/',
  plugins: [react(), tailwindcss()],
  cacheDir: path.resolve(import.meta.dirname, '../.cache/vite'),
  resolve: {alias: {'@': path.resolve(import.meta.dirname, 'desktop')}},
  build: {outDir: '../web/original',emptyOutDir:true,sourcemap:true},
});
