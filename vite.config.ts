import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import fs from 'fs-extra'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-files',
      async writeBundle() {
        // 复制manifest.json到dist目录
        await fs.copy('manifest.json', 'dist/manifest.json')
        
        // 复制图标文件到dist目录
        await fs.copy('public/icons', 'dist/icons')
      }
    }
  ],
  build: {
    copyPublicDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
      },
    },
  },
  server: {
    proxy: {
      '/api/deepseek': {
        target: 'https://ark.cn-beijing.volces.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/deepseek/, '/api/v3'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Origin', 'https://ark.cn-beijing.volces.com');
          });
        }
      }
    }
  }
})