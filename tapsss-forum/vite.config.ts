import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  build: {
    minify: false,
  },
  resolve: {
    dedupe: ['pinia', 'vue', 'vue-router'],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@tapsss/shared': fileURLToPath(new URL('../packages/shared/src', import.meta.url)),
      '@tapsss/server': fileURLToPath(new URL('../packages/server/src', import.meta.url)),
      '@tapsss/forum-shared': fileURLToPath(new URL('../packages/forum-shared/src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    // 固定 HMR 端口，确保页面从其他端口（如 3001）加载时 HMR 仍能正常连接
    hmr: {
      host: 'localhost',
      port: 5173,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001', // 模拟API服务器运行在3001端口
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, ''),
      },
    },
  },
})
