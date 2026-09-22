import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Moodio UI：Vite + React + TypeScript。构建产物在 dist/（纯静态，由 site/wrangler.toml 作为静态资源 Worker 发布）
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
  server: { port: 5174, strictPort: false },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
