/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ECORIDE_API lets a second copy (e2e runs, QA) talk to its own backend on another port.
const API_TARGET = process.env.ECORIDE_API ?? 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  preview: {
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.ts'],
  },
});
