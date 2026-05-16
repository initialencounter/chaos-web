/// <reference types="vitest" />
import { join } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePluginDoubleshot } from 'vite-plugin-doubleshot'

// https://vitejs.dev/config/
export default defineConfig({
  root: join(__dirname, 'src/render'),
  plugins: [
    vue(),
    VitePluginDoubleshot({
      type: 'electron',
      main: 'dist/main/index.js',
      entry: 'src/main/index.ts',
      outDir: 'dist/main',
      external: ['electron', 'ws'],
      noExternal: ['@tapsss/server', '@tapsss/shared'],
      electron: {
        build: {
          config: './electron-builder.config.js',
        },
        preload: {
          entry: 'src/preload/index.ts',
          outDir: 'dist/preload',
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '@': join(__dirname, 'src/render'),
      '@render': join(__dirname, 'src/render'),
      '@main': join(__dirname, 'src/main'),
      '@common': join(__dirname, 'src/common'),
      '@tapsss/shared': join(__dirname, 'packages/shared/src'),
      '@tapsss/server': join(__dirname, 'packages/server/src'),
    },
  },
  server: {
    host: '127.0.0.1',
    proxy: {
      '/oss/': {
        target: 'https://minesweeper.oss-cn-hongkong.aliyuncs.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/oss/, ''),
      },
    },
  },
  base: './',
  build: {
    outDir: join(__dirname, 'dist/render'),
    emptyOutDir: true,
  },
})
