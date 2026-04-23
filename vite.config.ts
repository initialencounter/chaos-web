import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // 启动 bun 运行 proxy.ts 的插件
    // {
    //   name: 'run-proxy-with-bun',
    //   async configureServer(server) {
    //     const { spawn } = await import('child_process');
    //     const chokidar = (await import('chokidar')).default;
    //     const path = await import('path');
    //     let proxyProcess = null;
    //     const startProxy = () => {
    //       if (proxyProcess) proxyProcess.kill();
    //       proxyProcess = spawn('bun', ['proxy.ts'], {
    //         stdio: 'inherit',
    //         shell: true,
    //       });
    //     };
    //     startProxy();
    //     // 监听 proxy.ts 和 encrypt.ts 变动
    //     const watcher = chokidar.watch([
    //       path.resolve(process.cwd(), 'proxy.ts'),
    //       path.resolve(process.cwd(), 'encrypt.ts'),
    //     ]);
    //     watcher.on('change', () => {
    //       console.log('[proxy] 源码变动，自动重启...');
    //       startProxy();
    //     });
    //     server.httpServer?.on('close', () => {
    //       if (proxyProcess) proxyProcess.kill();
    //       watcher.close();
    //     });
    //   },
    // },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})

