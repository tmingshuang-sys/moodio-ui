import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// WoW：Vite + React + TypeScript。构建产物在 dist/（纯静态，线上由服务器上的 Caddy 直接发）
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
  // 本机开发时把后端那几条路代理到自建后端（默认 8787，用 WOW_API 可以换）：
  // 页面调的是相对路径（/api/sync/*、/health、模型网关的 /v1 等），线上由 Caddy 同源提供，
  // 开发时没有代理就全是 404，同步和服务器设置根本没法在 5174 上调。
  server: {
    port: 5174, strictPort: false,
    proxy: Object.fromEntries(['/api', '/health', '/v1', '/fal', '/ark', '/byteplus', '/media']
      .map(p => [p, { target: (globalThis as any).process?.env?.WOW_API || 'http://127.0.0.1:8787', changeOrigin: true }])),
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
